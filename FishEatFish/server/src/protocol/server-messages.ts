import type { ProtocolMessage } from './protocol-version.js';
import type { SkillActionId } from '../room/player-session.js';
export interface PlayerSnapshot { playerId: string; displayName: string; x: number; y: number; rotation: number; lastProcessedClientTick: number; health: number; maxHealth: number; level: number; dead: boolean; action?: SkillActionId; actionSequence?: number; }
export interface RoomSnapshot { roomId: string; mapId: string; serverTick: number; selfPlayerId?: string; players: PlayerSnapshot[]; }
export interface SkillEffect { playerId: string; skillId: 'skill-basic-bite' | 'skill-dash-bite'; actionSequence: number; clientTick: number; x: number; y: number; rotation: number; serverTick: number; }
export const message = <T>(type: ProtocolMessage<T>['type'], payload: T, requestId?: string): ProtocolMessage<T> => ({ protocolVersion: 1, type, payload, ...(requestId ? { requestId } : {}) });
