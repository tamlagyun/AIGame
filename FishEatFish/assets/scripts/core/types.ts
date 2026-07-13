export const CONFIG_SCHEMA_VERSION = 1;
export const SAVE_SCHEMA_VERSION = 1;

export type FishCollider =
  | { kind: 'circle'; radius: number }
  | { kind: 'capsule'; radius: number; length: number };

export interface FishConfig {
  schemaVersion: 1;
  id: string;
  displayName: string;
  maxHealth: number;
  moveSpeed: number;
  experienceReward: number;
  collider: FishCollider;
  basicAttackId: string;
  initialSkillId: string;
}

export interface SkillConfig {
  schemaVersion: 1;
  id: string;
  displayName: string;
  animationState: 'bite' | 'dashBite';
  damage: number;
  range: number;
  cooldownSeconds: number;
  dashDistance: number;
}

export interface WorldConfig {
  schemaVersion: 1;
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

