export const CONFIG_SCHEMA_VERSION = 2;
export const SAVE_SCHEMA_VERSION = 1;

export type ArtFacingDirection = 'left' | 'right';

export type FishCollider =
  | { kind: 'circle'; radius: number }
  | { kind: 'capsule'; radius: number; length: number };

export interface FishConfig {
  schemaVersion: 2;
  id: string;
  displayName: string;
  artFacingDirection: ArtFacingDirection;
  animationArtFacingDirections: {
    swim: ArtFacingDirection;
    bite: ArtFacingDirection;
    hurt: ArtFacingDirection;
  };
  maxHealth: number;
  moveSpeed: number;
  experienceReward: number;
  collider: FishCollider;
  basicAttackId: string;
  initialSkillId: string;
}

export interface SkillConfig {
  schemaVersion: 2;
  id: string;
  displayName: string;
  networkSkillId: string;
  animationState: 'bite' | 'dashBite' | 'whaleSwallow' | 'deathRoll' | 'inkSplash' | 'orcaCharge';
  damage: number;
  range: number;
  cooldownSeconds: number;
  dashDistance: number;
  knockbackDistance?: number;
  targetStopDistance?: number;
  ui: {
    nodeName: string;
    slot: 'primary' | 'arc';
    slotIndex?: number;
    iconPath: string;
    cooldownGroup: string;
  };
  clientEffect: {
    kind: 'bite' | 'dashBite' | 'whaleSwallow' | 'deathRoll' | 'inkSplash' | 'orcaCharge';
    animationDurationSeconds: number;
    visualOffset: number;
    visualRadius: number;
    visualDurationSeconds: number;
    visualColor: { r: number; g: number; b: number; a: number };
    hint: string;
    rayCount?: number;
    rayLength?: number;
    sprayDurationSeconds?: number;
    expansionDelaySeconds?: number;
    expansionDurationSeconds?: number;
  };
  effectDurationSeconds?: number;
  scaleMultiplier?: number;
  opacity?: number;
}

export interface SkillLoadoutConfig {
  schemaVersion: 2;
  id: string;
  layout: {
    rootName: string;
    width: number;
    height: number;
    right: number;
    bottom: number;
    primaryCenter: Vec2Value;
    primaryButtonSize: number;
    arcRadius: number;
    arcAngles: number[];
    arcButtonSize: number;
    cooldownStart: number;
  };
  skillConfigPaths: string[];
}

export interface SkillLibraryConfig {
  schemaVersion: 2;
  id: string;
  skillConfigPaths: string[];
}

export interface WorldConfig {
  schemaVersion: 2;
  id: string;
  width: number;
  height: number;
  sectorWidth: number;
  sectorHeight: number;
  maxActiveFish: number;
  maxFullUpdateFish: number;
}

export interface Vec2Value {
  x: number;
  y: number;
}

export interface InputCommand {
  move: Vec2Value;
  basicAttackPressed: boolean;
  skillPressed: boolean;
  pausePressed: boolean;
}

export interface FishState {
  id: string;
  configId: string;
  position: Vec2Value;
  facing: Vec2Value;
  health: number;
  maxHealth: number;
  level: number;
  experience: number;
  active: boolean;
}

export type CombatEvent =
  | { type: 'bite'; sourceId: string; targetId: string; skillId: string; damage: number }
  | { type: 'defeated'; sourceId: string; targetId: string; experience: number }
  | { type: 'levelUp'; fishId: string; level: number; maxHealth: number; healed: number };

export interface GameState {
  phase: 'booting' | 'playing' | 'paused';
  elapsedSeconds: number;
  playerFishId: string;
  fish: FishState[];
  events: CombatEvent[];
}

export interface SaveData {
  schemaVersion: 1;
  savedAt: string;
  player: {
    level: number;
    experience: number;
    maxHealth: number;
  };
  settings: {
    musicVolume: number;
    effectsVolume: number;
    vibrationEnabled: boolean;
  };
  tutorial: {
    completedSteps: string[];
  };
}
