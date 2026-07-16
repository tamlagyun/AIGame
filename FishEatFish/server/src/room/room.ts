import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import { encode } from '../protocol/protocol-codec.js';
import { message, type PlayerSnapshot, type RoomSnapshot } from '../protocol/server-messages.js';
import { simulateMovement } from '../simulation/movement-system.js';
import type { ServerConfig } from '../config/server-config.js';
import type { InputPayload, SkillPayload } from '../protocol/client-messages.js';
import type { PlayerSession } from './player-session.js';
import { createCombatState } from '../combat/combat-state.js';
import { CombatService } from '../combat/combat-service.js';
import { clampPosition } from '../simulation/bounds-system.js';

export class Room {
  readonly id = randomUUID();
  private tickCount = 0;
  private readonly players = new Map<string, PlayerSession>();
  private readonly combat = new CombatService();
  constructor(private readonly config: ServerConfig) {}
  get size() { return this.players.size; }
  add(accountId: string, displayName: string, socket: WebSocket) {
    if (this.size >= this.config.roomCapacity) throw new Error('ROOM_FULL');
    const player: PlayerSession = { playerId: randomUUID(), accountId, displayName, socket, x: 0, y: 0, rotation: 0, lastInput: { clientTick: 0, moveX: 0, moveY: 0, rotation: 0 }, combat: createCombatState(), actionSequence: 0, actionUntil: 0 };
    this.players.set(player.playerId, player);
    this.broadcast(message('playerJoined', this.playerSnapshot(player)));
    return player;
  }
  remove(playerId: string) { this.players.delete(playerId); this.broadcast(message('playerRemoved', { playerId })); }
  input(playerId: string, input: InputPayload) {
    const player = this.players.get(playerId);
    if (!player) throw new Error('PLAYER_NOT_IN_ROOM');
    const rotation = Math.cos(input.rotation * Math.PI / 180) >= 0 ? 0 : 180;
    player.lastInput = { ...input, rotation };
    // 输入与技能消息按 WebSocket 顺序到达；立即更新左右朝向，保证快速转向后攻击方向正确。
    player.rotation = rotation;
  }
  skill(playerId: string, skill: SkillPayload) {
    const source = this.players.get(playerId);
    if (!source) throw new Error('PLAYER_NOT_IN_ROOM');
    const result = this.combat.useSkill(source, skill.skillId, skill.clientTick, [...this.players.values()], Date.now(), this.tickCount, (distance) => {
      const radians = source.rotation * Math.PI / 180;
      const next = clampPosition(source.x + Math.cos(radians) * distance, source.y + Math.sin(radians) * distance, {
        minX: -this.config.mapWidth / 2,
        maxX: this.config.mapWidth / 2,
        minY: -this.config.mapHeight / 2,
        maxY: this.config.mapHeight / 2
      });
      source.x = next.x;
      source.y = next.y;
    });
    if (result.accepted) {
      source.actionSequence += 1;
      source.activeAction = skill.skillId;
      source.actionUntil = Date.now() + (skill.skillId === 'skill-dash-bite' ? 420 : 340);
      this.broadcast(message('skillEffect', { playerId, skillId: skill.skillId, actionSequence: source.actionSequence, clientTick: skill.clientTick, x: source.x, y: source.y, rotation: source.rotation, serverTick: this.tickCount }));
    }
    this.sendTo(source, message('skillResolved', { playerId, skillId: skill.skillId, hitCount: result.hitCount, reason: result.reason, serverTick: this.tickCount }));
    for (const event of result.events) this.broadcast(message(event.type, event.payload));
  }
  tick() {
    this.tickCount += 1;
    const now = Date.now();
    for (const player of this.players.values()) {
      const respawn = this.combat.respawn(player, now, (Math.random() - 0.5) * 400, (Math.random() - 0.5) * 240, this.tickCount);
      if (respawn) this.broadcast(message(respawn.type, respawn.payload));
      if (player.combat.dead) continue;
      const next = simulateMovement({ x: player.x, y: player.y, rotation: player.rotation }, player.lastInput, this.config.playerSpeed, 1 / this.config.tickRate, { minX: -this.config.mapWidth / 2, maxX: this.config.mapWidth / 2, minY: -this.config.mapHeight / 2, maxY: this.config.mapHeight / 2 });
      player.x = next.x; player.y = next.y; player.rotation = next.rotation;
    }
    if (this.tickCount % Math.max(1, Math.round(this.config.tickRate / this.config.snapshotRate)) === 0) {
      this.broadcast(message('stateSnapshot', this.snapshot()));
      for (const player of this.players.values()) if (player.socket.readyState === 1) player.socket.send(encode(message('stateCorrection', this.playerSnapshot(player))));
    }
  }
  snapshot(selfPlayerId?: string): RoomSnapshot { return { roomId: this.id, mapId: this.config.mapId, serverTick: this.tickCount, ...(selfPlayerId ? { selfPlayerId } : {}), players: [...this.players.values()].map((player) => this.playerSnapshot(player)) }; }
  private playerSnapshot(player: PlayerSession): PlayerSnapshot {
    const actionActive = !player.combat.dead && player.activeAction !== undefined && player.actionUntil > Date.now();
    return { playerId: player.playerId, displayName: player.displayName, x: player.x, y: player.y, rotation: player.rotation, lastProcessedClientTick: player.lastInput.clientTick, health: player.combat.health, maxHealth: player.combat.maxHealth, level: player.combat.level, dead: player.combat.dead, ...(actionActive ? { action: player.activeAction, actionSequence: player.actionSequence } : {}) };
  }
  private sendTo(player: PlayerSession, value: unknown) { if (player.socket.readyState === 1) player.socket.send(encode(value as never)); }
  private broadcast(value: unknown) { const encoded = encode(value as never); for (const player of this.players.values()) if (player.socket.readyState === 1) player.socket.send(encoded); }
}
