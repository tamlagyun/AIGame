import { CONFIG_SCHEMA_VERSION, type FishConfig, type SkillConfig, type WorldConfig } from '../core/types.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireBase = (value: unknown, kind: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error(`${kind} config must be an object`);
  if (value.schemaVersion !== CONFIG_SCHEMA_VERSION) throw new Error(`${kind} schemaVersion must be ${CONFIG_SCHEMA_VERSION}`);
  if (typeof value.id !== 'string' || value.id.length === 0) throw new Error(`${kind} id is required`);
  return value;
};

const requirePositive = (value: unknown, key: string): void => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${key} must be a positive number`);
  }
};

export const parseFishConfig = (value: unknown): FishConfig => {
  const config = requireBase(value, 'fish');
  if (config.artFacingDirection !== 'left' && config.artFacingDirection !== 'right') {
    throw new Error('artFacingDirection must be left or right');
  }
  if (!isRecord(config.animationArtFacingDirections)) {
    throw new Error('animationArtFacingDirections must be an object');
  }
  for (const state of ['swim', 'bite', 'hurt']) {
    const direction = config.animationArtFacingDirections[state];
    if (direction !== 'left' && direction !== 'right') {
      throw new Error(`animationArtFacingDirections.${state} must be left or right`);
    }
  }
  requirePositive(config.maxHealth, 'maxHealth');
  requirePositive(config.moveSpeed, 'moveSpeed');
  requirePositive(config.experienceReward, 'experienceReward');
  return config as unknown as FishConfig;
};

export const parseSkillConfig = (value: unknown): SkillConfig => {
  const config = requireBase(value, 'skill');
  requirePositive(config.damage, 'damage');
  requirePositive(config.range, 'range');
  if (typeof config.cooldownSeconds !== 'number' || config.cooldownSeconds < 0) {
    throw new Error('cooldownSeconds must be zero or positive');
  }
  return config as unknown as SkillConfig;
};

export const parseWorldConfig = (value: unknown): WorldConfig => {
  const config = requireBase(value, 'world');
  for (const key of ['width', 'height', 'sectorWidth', 'sectorHeight', 'maxActiveFish', 'maxFullUpdateFish']) {
    requirePositive(config[key], key);
  }
  return config as unknown as WorldConfig;
};
