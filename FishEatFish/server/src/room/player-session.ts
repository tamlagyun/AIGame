import type { WebSocket } from 'ws';
import type { InputPayload } from '../protocol/client-messages.js';
import type { CombatState } from '../combat/combat-state.js';
export type SkillActionId = 'skill-basic-bite' | 'skill-dash-bite';
export interface PlayerSession { playerId: string; accountId: string; displayName: string; socket: WebSocket; x: number; y: number; rotation: number; lastInput: InputPayload; combat: CombatState; actionSequence: number; activeAction?: SkillActionId; actionUntil: number; }
