export type CombatSkillId = 'skill-basic-bite' | 'skill-dash-bite' | 'skill-whale-swallow' | 'skill-death-roll' | 'skill-ink-splash' | 'skill-orca-charge';
export interface CombatSkillConfig { damage: number; range: number; angleRadians: number; cooldownSeconds: number; dashDistance: number; knockbackDistance?: number; targetStopDistance?: number; }
export const combatSkills: Record<CombatSkillId, CombatSkillConfig> = {
  'skill-basic-bite': { damage: 15, range: 72, angleRadians: 110 * Math.PI / 180, cooldownSeconds: 0.55, dashDistance: 0 },
  'skill-dash-bite': { damage: 30, range: 96, angleRadians: 120 * Math.PI / 180, cooldownSeconds: 5, dashDistance: 240 },
  'skill-whale-swallow': { damage: 0, range: 800, angleRadians: Math.PI * 2, cooldownSeconds: 8, dashDistance: 0 },
  'skill-death-roll': { damage: 3, range: 120, angleRadians: 125 * Math.PI / 180, cooldownSeconds: 7, dashDistance: 0 },
  // 世界单位按 60 单位约合 1 米；10 米喷墨半径对应 600 世界单位。
  'skill-ink-splash': { damage: 25, range: 600, angleRadians: Math.PI * 2, cooldownSeconds: 10, dashDistance: 0 },
  'skill-orca-charge': { damage: 60, range: 900, angleRadians: 100 * Math.PI / 180, cooldownSeconds: 12, dashDistance: 0, knockbackDistance: 360, targetStopDistance: 96 }
};
// 与当前鱼的显示尺寸保持一致的服务器逻辑碰撞半径。
export const PLAYER_HIT_RADIUS = 64;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_EXPERIENCE_REWARD = 10;
export const RESPAWN_DELAY_MS = 3000;
export const RESPAWN_INVULNERABILITY_MS = 3000;
export const WHALE_SWALLOW_DURATION_MS = 3000;
export const DEATH_ROLL_DURATION_MS = 1150;
export const INK_SPLASH_SPRAY_MS = 500;
export const INK_SPLASH_EXPANSION_DELAY_MS = 500;
export const INK_SPLASH_DURATION_MS = INK_SPLASH_SPRAY_MS + INK_SPLASH_EXPANSION_DELAY_MS;
export const INK_SPLASH_RAY_COUNT = 16;
export const ORCA_CHARGE_DURATION_MS = 650;
