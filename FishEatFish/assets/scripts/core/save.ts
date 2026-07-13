import { SAVE_SCHEMA_VERSION, type SaveData } from './types.ts';

export const createDefaultSaveData = (): SaveData => ({
  schemaVersion: SAVE_SCHEMA_VERSION,
  savedAt: new Date(0).toISOString(),
  player: { level: 1, experience: 0, maxHealth: 100 },
  settings: { musicVolume: 0.8, effectsVolume: 1, vibrationEnabled: true },
  tutorial: { completedSteps: [] }
});

export const migrateSaveData = (value: unknown): SaveData => {
  if (!value || typeof value !== 'object') return createDefaultSaveData();
  const candidate = value as Partial<SaveData>;
  if (candidate.schemaVersion !== SAVE_SCHEMA_VERSION) return createDefaultSaveData();
  return candidate as SaveData;
};

