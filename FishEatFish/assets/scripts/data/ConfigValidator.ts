import { CONFIG_SCHEMA_VERSION, type FishConfig, type SkillConfig, type SkillLibraryConfig, type SkillLoadoutConfig, type WorldConfig } from '../core/types.ts';

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

const requireNonNegative = (value: unknown, key: string): void => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${key} must be zero or positive`);
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
  if (config.animationState !== 'bite' && config.animationState !== 'dashBite' && config.animationState !== 'whaleSwallow' && config.animationState !== 'deathRoll' && config.animationState !== 'inkSplash' && config.animationState !== 'orcaCharge') {
    throw new Error('animationState must be bite, dashBite, whaleSwallow, deathRoll, inkSplash or orcaCharge');
  }
  requireNonNegative(config.damage, 'damage');
  requirePositive(config.range, 'range');
  requireNonNegative(config.cooldownSeconds, 'cooldownSeconds');
  requireNonNegative(config.dashDistance, 'dashDistance');
  if (config.knockbackDistance !== undefined) requirePositive(config.knockbackDistance, 'knockbackDistance');
  if (config.targetStopDistance !== undefined) requirePositive(config.targetStopDistance, 'targetStopDistance');
  if (typeof config.networkSkillId !== 'string' || config.networkSkillId.length === 0) throw new Error('networkSkillId is required');
  if (!isRecord(config.ui)) throw new Error('ui must be an object');
  if (typeof config.ui.nodeName !== 'string' || config.ui.nodeName.length === 0) throw new Error('ui.nodeName is required');
  if (config.ui.slot !== 'primary' && config.ui.slot !== 'arc') throw new Error('ui.slot must be primary or arc');
  if (config.ui.slot === 'primary' && config.ui.slotIndex !== undefined) throw new Error('ui.slotIndex is only valid for arc');
  if (config.ui.slot === 'arc' && (!Number.isInteger(config.ui.slotIndex) || (config.ui.slotIndex as number) < 0)) throw new Error('ui.slotIndex must be a non-negative integer');
  if (typeof config.ui.iconPath !== 'string' || config.ui.iconPath.length === 0) throw new Error('ui.iconPath is required');
  if (typeof config.ui.cooldownGroup !== 'string' || config.ui.cooldownGroup.length === 0) throw new Error('ui.cooldownGroup is required');
  if (!isRecord(config.clientEffect)) throw new Error('clientEffect must be an object');
  if (config.clientEffect.kind !== 'bite' && config.clientEffect.kind !== 'dashBite' && config.clientEffect.kind !== 'whaleSwallow' && config.clientEffect.kind !== 'deathRoll' && config.clientEffect.kind !== 'inkSplash' && config.clientEffect.kind !== 'orcaCharge') throw new Error('clientEffect.kind is invalid');
  requirePositive(config.clientEffect.animationDurationSeconds, 'clientEffect.animationDurationSeconds');
  requireNonNegative(config.clientEffect.visualOffset, 'clientEffect.visualOffset');
  requirePositive(config.clientEffect.visualRadius, 'clientEffect.visualRadius');
  requirePositive(config.clientEffect.visualDurationSeconds, 'clientEffect.visualDurationSeconds');
  if (typeof config.clientEffect.hint !== 'string') throw new Error('clientEffect.hint must be a string');
  for (const key of ['rayCount', 'rayLength', 'sprayDurationSeconds', 'expansionDelaySeconds', 'expansionDurationSeconds']) {
    if (config.clientEffect[key] !== undefined) requirePositive(config.clientEffect[key], `clientEffect.${key}`);
  }
  if (!isRecord(config.clientEffect.visualColor)) throw new Error('clientEffect.visualColor must be an object');
  for (const color of ['r', 'g', 'b', 'a']) {
    const value = config.clientEffect.visualColor[color];
    if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 255) throw new Error(`clientEffect.visualColor.${color} must be an integer between 0 and 255`);
  }
  if (config.effectDurationSeconds !== undefined) requirePositive(config.effectDurationSeconds, 'effectDurationSeconds');
  if (config.scaleMultiplier !== undefined) requirePositive(config.scaleMultiplier, 'scaleMultiplier');
  if (config.opacity !== undefined && (typeof config.opacity !== 'number' || !Number.isFinite(config.opacity) || config.opacity < 0 || config.opacity > 1)) {
    throw new Error('opacity must be between zero and one');
  }
  return config as unknown as SkillConfig;
};

export const parseSkillLoadoutConfig = (value: unknown): SkillLoadoutConfig => {
  const config = requireBase(value, 'skill loadout');
  if (!isRecord(config.layout)) throw new Error('layout must be an object');
  const layout = config.layout;
  for (const key of ['width', 'height', 'right', 'bottom', 'primaryButtonSize', 'arcRadius']) requireNonNegative(layout[key], `layout.${key}`);
  if (typeof layout.rootName !== 'string' || layout.rootName.length === 0) throw new Error('layout.rootName is required');
  if (!isRecord(layout.primaryCenter)) throw new Error('layout.primaryCenter must be an object');
  requireNonNegative(layout.primaryCenter.x, 'layout.primaryCenter.x');
  requireNonNegative(layout.primaryCenter.y, 'layout.primaryCenter.y');
  if (!Array.isArray(layout.arcAngles) || layout.arcAngles.length === 0 || layout.arcAngles.some((angle) => typeof angle !== 'number' || !Number.isFinite(angle))) throw new Error('layout.arcAngles must be a non-empty number array');
  if (typeof layout.cooldownStart !== 'number' || !Number.isFinite(layout.cooldownStart) || layout.cooldownStart < 0 || layout.cooldownStart > 1) throw new Error('layout.cooldownStart must be between zero and one');
  if (!Array.isArray(config.skillConfigPaths) || config.skillConfigPaths.length === 0 || config.skillConfigPaths.some((path) => typeof path !== 'string' || path.length === 0)) throw new Error('skillConfigPaths must be a non-empty string array');
  if (new Set(config.skillConfigPaths).size !== config.skillConfigPaths.length) throw new Error('skillConfigPaths must not contain duplicates');
  return config as unknown as SkillLoadoutConfig;
};

export const parseSkillLibraryConfig = (value: unknown): SkillLibraryConfig => {
  const config = requireBase(value, 'skill library');
  if (!Array.isArray(config.skillConfigPaths) || config.skillConfigPaths.length === 0 || config.skillConfigPaths.some((path) => typeof path !== 'string' || path.length === 0)) {
    throw new Error('skill library skillConfigPaths must be a non-empty string array');
  }
  if (new Set(config.skillConfigPaths).size !== config.skillConfigPaths.length) {
    throw new Error('skill library skillConfigPaths must not contain duplicates');
  }
  return config as unknown as SkillLibraryConfig;
};

export const parseWorldConfig = (value: unknown): WorldConfig => {
  const config = requireBase(value, 'world');
  for (const key of ['width', 'height', 'sectorWidth', 'sectorHeight', 'maxActiveFish', 'maxFullUpdateFish']) {
    requirePositive(config[key], key);
  }
  return config as unknown as WorldConfig;
};
