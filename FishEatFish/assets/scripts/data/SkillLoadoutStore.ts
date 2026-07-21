import type { SkillConfig } from '../core/types.ts';

interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface StoredSkillLoadout {
  schemaVersion: 1;
  equippedSkillIds: string[];
}

const STORAGE_KEY = 'fish-eat-fish.skill-loadout.v1';

/** Owns the four equipped arc slots and safely persists them when storage is available. */
export class SkillLoadoutStore {
  private readonly arcSkills = new Map<string, SkillConfig>();
  private readonly slotCount: number;
  private readonly storage: StoragePort | undefined;
  private equippedSkillIds: string[];

  public constructor(
    allSkills: SkillConfig[],
    defaultEquippedSkills: SkillConfig[],
    slotCount = 4,
    storage: StoragePort | undefined = SkillLoadoutStore.resolveStorage()
  ) {
    this.slotCount = slotCount;
    this.storage = storage;
    for (const skill of allSkills) if (skill.ui.slot === 'arc') this.arcSkills.set(skill.id, skill);
    const defaults = defaultEquippedSkills
      .filter((skill) => skill.ui.slot === 'arc')
      .sort((left, right) => (left.ui.slotIndex ?? 0) - (right.ui.slotIndex ?? 0))
      .map((skill) => skill.id);
    if (defaults.length !== slotCount || new Set(defaults).size !== defaults.length) {
      throw new Error(`default skill loadout must contain ${slotCount} unique arc skills`);
    }
    this.equippedSkillIds = this.readStored(defaults);
  }

  public getEquippedSkills(): SkillConfig[] {
    return this.equippedSkillIds.map((id, slotIndex) => this.forSlot(this.arcSkills.get(id) as SkillConfig, slotIndex));
  }

  public getAvailableSkills(): SkillConfig[] {
    const equipped = new Set(this.equippedSkillIds);
    return [...this.arcSkills.values()].filter((skill) => !equipped.has(skill.id));
  }

  public replace(slotIndex: number, skillId: string): boolean {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= this.slotCount) return false;
    if (!this.arcSkills.has(skillId) || this.equippedSkillIds.includes(skillId)) return false;
    this.equippedSkillIds[slotIndex] = skillId;
    this.persist();
    return true;
  }

  private readStored(defaults: string[]): string[] {
    try {
      const text = this.storage?.getItem(STORAGE_KEY);
      if (!text) return [...defaults];
      const value = JSON.parse(text) as Partial<StoredSkillLoadout>;
      const ids = value.equippedSkillIds;
      if (
        value.schemaVersion !== 1
        || !Array.isArray(ids)
        || ids.length !== this.slotCount
        || new Set(ids).size !== ids.length
        || ids.some((id) => typeof id !== 'string' || !this.arcSkills.has(id))
      ) return [...defaults];
      return [...ids];
    } catch {
      return [...defaults];
    }
  }

  private persist(): void {
    try {
      const value: StoredSkillLoadout = { schemaVersion: 1, equippedSkillIds: [...this.equippedSkillIds] };
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Native/IDE storage may be unavailable. The in-memory loadout remains usable.
    }
  }

  private forSlot(skill: SkillConfig, slotIndex: number): SkillConfig {
    return {
      ...skill,
      ui: {
        ...skill.ui,
        slot: 'arc',
        slotIndex,
        nodeName: `SkillSlot${slotIndex + 1}Button`
      }
    };
  }

  private static resolveStorage(): StoragePort | undefined {
    try {
      return (globalThis as { localStorage?: StoragePort }).localStorage;
    } catch {
      return undefined;
    }
  }
}
