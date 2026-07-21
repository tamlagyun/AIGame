import type { CombatSkillId } from './combat-config.js';
import { combatSkills, PLAYER_HIT_RADIUS } from './combat-config.js';
import { addExperience, type CombatState } from './combat-state.js';
import { isWithinAttackCone } from './hit-test.js';
import { invulnerableUntil, respawnAt } from './respawn-policy.js';
export interface CombatPlayer { playerId: string; x: number; y: number; rotation: number; combat: CombatState; radius?: number; }
export interface CombatEvent { type: 'hitConfirmed' | 'playerDamaged' | 'playerDied' | 'combatSettlement' | 'playerRespawned'; payload: Record<string, unknown>; }
export type SkillRejectReason = 'dead' | 'staleInput' | 'cooldown' | 'noTarget';
export interface SkillUseResult { accepted: boolean; hitCount: number; targetId?: string; targetX?: number; targetY?: number; reason?: SkillRejectReason; events: CombatEvent[]; }
export class CombatService {
  useSkill(
    source: CombatPlayer,
    skillId: CombatSkillId,
    clientTick: number,
    players: CombatPlayer[],
    now: number,
    serverTick: number,
    applyDash?: (distance: number) => void,
    applyTeleport?: (x: number, y: number) => void,
    applyKnockback?: (target: CombatPlayer, x: number, y: number) => { x: number; y: number }
  ): SkillUseResult {
    const config = combatSkills[skillId];
    if (source.combat.dead) return { accepted: false, hitCount: 0, reason: 'dead', events: [] };
    if (clientTick <= source.combat.lastSkillTick) return { accepted: false, hitCount: 0, reason: 'staleInput', events: [] };
    const readyAt = source.combat.skillCooldowns[skillId] ?? 0;
    if (now < readyAt) return { accepted: false, hitCount: 0, reason: 'cooldown', events: [] };

    if (skillId === 'skill-whale-swallow') {
      const target = players
        .filter((candidate) =>
          candidate.playerId !== source.playerId
          && !candidate.combat.dead
          && (candidate.combat.invulnerableUntil ?? 0) <= now
        )
        .map((candidate) => ({
          candidate,
          distanceSquared: (candidate.x - source.x) ** 2 + (candidate.y - source.y) ** 2
        }))
        .filter(({ distanceSquared }) => distanceSquared <= config.range ** 2)
        .sort((left, right) => left.distanceSquared - right.distanceSquared)[0]?.candidate;
      if (!target) return { accepted: false, hitCount: 0, reason: 'noTarget', events: [] };

      source.combat.lastSkillTick = clientTick;
      source.combat.skillCooldowns[skillId] = now + config.cooldownSeconds * 1000;
      applyTeleport?.(target.x, target.y);
      return {
        accepted: true,
        hitCount: 1,
        targetId: target.playerId,
        events: [{
          type: 'hitConfirmed',
          payload: { attackerId: source.playerId, targetId: target.playerId, skillId, serverTick }
        }]
      };
    }

    // 喷墨技能先锁定释放点和冷却，伤害在喷洒完成并开始扩散时由 Room 定时结算。
    if (skillId === 'skill-ink-splash') {
      source.combat.lastSkillTick = clientTick;
      source.combat.skillCooldowns[skillId] = now + config.cooldownSeconds * 1000;
      return { accepted: true, hitCount: 0, events: [] };
    }

    if (skillId === 'skill-orca-charge') {
      const target = players
        .filter((candidate) =>
          candidate.playerId !== source.playerId
          && !candidate.combat.dead
          && (candidate.combat.invulnerableUntil ?? 0) <= now
          && isWithinAttackCone(source, candidate, config.range, config.angleRadians, source.radius ?? PLAYER_HIT_RADIUS)
        )
        .map((candidate) => ({ candidate, distanceSquared: (candidate.x - source.x) ** 2 + (candidate.y - source.y) ** 2 }))
        .sort((left, right) => left.distanceSquared - right.distanceSquared)[0]?.candidate;
      if (!target) return { accepted: false, hitCount: 0, reason: 'noTarget', events: [] };

      source.combat.lastSkillTick = clientTick;
      source.combat.skillCooldowns[skillId] = now + config.cooldownSeconds * 1000;
      const radians = source.rotation * Math.PI / 180;
      const directionX = Math.cos(radians);
      const directionY = Math.sin(radians);
      const stopDistance = config.targetStopDistance ?? 96;
      const sourceX = target.x - directionX * stopDistance;
      const sourceY = target.y - directionY * stopDistance;
      if (applyTeleport) applyTeleport(sourceX, sourceY);
      else { source.x = sourceX; source.y = sourceY; }
      const desiredTargetX = target.x + directionX * (config.knockbackDistance ?? 360);
      const desiredTargetY = target.y + directionY * (config.knockbackDistance ?? 360);
      const knocked = applyKnockback?.(target, desiredTargetX, desiredTargetY) ?? { x: desiredTargetX, y: desiredTargetY };
      target.x = knocked.x;
      target.y = knocked.y;

      const events: CombatEvent[] = [{ type: 'hitConfirmed', payload: { attackerId: source.playerId, targetId: target.playerId, skillId, serverTick } }];
      target.combat.health = Math.max(0, target.combat.health - config.damage);
      events.push({ type: 'playerDamaged', payload: { attackerId: source.playerId, targetId: target.playerId, skillId, damage: config.damage, health: target.combat.health, maxHealth: target.combat.maxHealth, serverTick } });
      if (target.combat.health <= 0) {
        target.combat.dead = true;
        target.combat.respawnAt = respawnAt(now);
        source.combat.kills += 1;
        const leveled = addExperience(source.combat);
        events.push({ type: 'playerDied', payload: { attackerId: source.playerId, targetId: target.playerId, respawnAt: target.combat.respawnAt, serverTick } });
        events.push({ type: 'combatSettlement', payload: { playerId: source.playerId, kills: source.combat.kills, experience: source.combat.experience, level: source.combat.level, maxHealth: source.combat.maxHealth, health: source.combat.health, leveled, serverTick } });
      }
      return { accepted: true, hitCount: 1, targetId: target.playerId, targetX: target.x, targetY: target.y, events };
    }

    source.combat.lastSkillTick = clientTick;
    source.combat.skillCooldowns[skillId] = now + config.cooldownSeconds * 1000;
    if (config.dashDistance > 0) applyDash?.(config.dashDistance);
    const events: CombatEvent[] = [];
    for (const target of players) {
      if (target.playerId === source.playerId || target.combat.dead || (target.combat.invulnerableUntil ?? 0) > now) continue;
      if (!isWithinAttackCone(source, target, config.range, config.angleRadians, source.radius ?? PLAYER_HIT_RADIUS)) continue;
      events.push({ type: 'hitConfirmed', payload: { attackerId: source.playerId, targetId: target.playerId, skillId, serverTick } });
      target.combat.health = Math.max(0, target.combat.health - config.damage);
      events.push({ type: 'playerDamaged', payload: { attackerId: source.playerId, targetId: target.playerId, skillId, damage: config.damage, health: target.combat.health, maxHealth: target.combat.maxHealth, serverTick } });
      if (target.combat.health <= 0) {
        target.combat.dead = true;
        target.combat.respawnAt = respawnAt(now);
        source.combat.kills += 1;
        const leveled = addExperience(source.combat);
        events.push({ type: 'playerDied', payload: { attackerId: source.playerId, targetId: target.playerId, respawnAt: target.combat.respawnAt, serverTick } });
        events.push({ type: 'combatSettlement', payload: { playerId: source.playerId, kills: source.combat.kills, experience: source.combat.experience, level: source.combat.level, maxHealth: source.combat.maxHealth, health: source.combat.health, leveled, serverTick } });
      }
    }
    return { accepted: true, hitCount: events.filter((event) => event.type === 'hitConfirmed').length, events };
  }

  resolveInkSplash(source: CombatPlayer, centerX: number, centerY: number, players: CombatPlayer[], now: number, serverTick: number): CombatEvent[] {
    const config = combatSkills['skill-ink-splash'];
    const events: CombatEvent[] = [];
    for (const target of players) {
      if (target.playerId === source.playerId || target.combat.dead || (target.combat.invulnerableUntil ?? 0) > now) continue;
      const distance = Math.hypot(target.x - centerX, target.y - centerY);
      if (distance > config.range + (target.radius ?? PLAYER_HIT_RADIUS)) continue;
      target.combat.health = Math.max(0, target.combat.health - config.damage);
      events.push({ type: 'hitConfirmed', payload: { attackerId: source.playerId, targetId: target.playerId, skillId: 'skill-ink-splash', serverTick } });
      events.push({ type: 'playerDamaged', payload: { attackerId: source.playerId, targetId: target.playerId, skillId: 'skill-ink-splash', damage: config.damage, health: target.combat.health, maxHealth: target.combat.maxHealth, serverTick } });
      if (target.combat.health <= 0) {
        target.combat.dead = true;
        target.combat.respawnAt = respawnAt(now);
        source.combat.kills += 1;
        const leveled = addExperience(source.combat);
        events.push({ type: 'playerDied', payload: { attackerId: source.playerId, targetId: target.playerId, respawnAt: target.combat.respawnAt, serverTick } });
        events.push({ type: 'combatSettlement', payload: { playerId: source.playerId, kills: source.combat.kills, experience: source.combat.experience, level: source.combat.level, maxHealth: source.combat.maxHealth, health: source.combat.health, leveled, serverTick } });
      }
    }
    return events;
  }
  respawn(player: CombatPlayer, now: number, x: number, y: number, serverTick: number): CombatEvent | undefined {
    if (!player.combat.dead || !player.combat.respawnAt || now < player.combat.respawnAt) return undefined;
    player.combat.dead = false; player.combat.health = player.combat.maxHealth; player.combat.respawnAt = undefined; player.combat.invulnerableUntil = invulnerableUntil(now); player.x = x; player.y = y;
    return { type: 'playerRespawned', payload: { playerId: player.playerId, x, y, health: player.combat.health, maxHealth: player.combat.maxHealth, invulnerableUntil: player.combat.invulnerableUntil, serverTick } };
  }
}
