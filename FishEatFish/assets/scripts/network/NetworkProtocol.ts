export const NETWORK_PROTOCOL_VERSION = 1;
export type ClientMessageType = 'joinRoom' | 'input' | 'skill' | 'ping' | 'leaveRoom';
export type ServerMessageType = 'roomSnapshot' | 'playerJoined' | 'playerRemoved' | 'stateSnapshot' | 'stateCorrection' | 'skillEffect' | 'skillResolved' | 'hitConfirmed' | 'playerDamaged' | 'playerDied' | 'playerRespawned' | 'combatSettlement' | 'pong' | 'error';
export interface NetworkMessage<T = unknown> { protocolVersion: number; type: ClientMessageType | ServerMessageType; requestId?: string; payload: T; }
export interface RemotePlayerState { playerId: string; displayName: string; x: number; y: number; rotation: number; lastProcessedClientTick: number; health: number; maxHealth: number; level: number; dead: boolean; action?: 'skill-basic-bite' | 'skill-dash-bite'; actionSequence?: number; }
export interface RoomSnapshot { roomId: string; mapId: string; serverTick: number; selfPlayerId?: string; players: RemotePlayerState[]; }
export interface SkillEffect { playerId: string; skillId: 'skill-basic-bite' | 'skill-dash-bite'; actionSequence: number; clientTick: number; x: number; y: number; rotation: number; serverTick: number; }
export interface SkillResolved { playerId: string; skillId: 'skill-basic-bite' | 'skill-dash-bite'; hitCount: number; reason?: 'dead' | 'staleInput' | 'cooldown'; serverTick: number; }
export interface PlayerDamaged { attackerId: string; targetId: string; skillId: string; damage: number; health: number; maxHealth: number; serverTick: number; }
export interface PlayerDied { attackerId: string; targetId: string; respawnAt: number; serverTick: number; }
export interface PlayerRespawned { playerId: string; x: number; y: number; health: number; maxHealth: number; invulnerableUntil: number; serverTick: number; }
export interface CombatSettlement { playerId: string; kills: number; experience: number; level: number; maxHealth: number; health: number; leveled: boolean; serverTick: number; }
