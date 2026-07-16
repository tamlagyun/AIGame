export type CombatSkillId = 'skill-basic-bite' | 'skill-dash-bite' | 'skill-whale-swallow';
export interface CombatSkillConfig { damage: number; range: number; angleRadians: number; cooldownSeconds: number; dashDistance: number; }
export const combatSkills: Record<CombatSkillId, CombatSkillConfig> = {
  'skill-basic-bite': { damage: 15, range: 72, angleRadians: 110 * Math.PI / 180, cooldownSeconds: 0.55, dashDistance: 0 },
  'skill-dash-bite': { damage: 30, range: 96, angleRadians: 120 * Math.PI / 180, cooldownSeconds: 5, dashDistance: 240 },
  'skill-whale-swallow': { damage: 0, range: 800, angleRadians: Math.PI * 2, cooldownSeconds: 8, dashDistance: 0 }
};
// 与当前鱼的显示尺寸保持一致的服务器逻辑碰撞半径。
export const PLAYER_HIT_RADIUS = 64;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_EXPERIENCE_REWARD = 10;
export const RESPAWN_DELAY_MS = 3000;
export const RESPAWN_INVULNERABILITY_MS = 3000;
export const WHALE_SWALLOW_DURATION_MS = 3000;
