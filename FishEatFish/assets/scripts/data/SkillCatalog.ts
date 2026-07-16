import type { SkillConfig } from '../core/types.ts';

/** Read-only lookup for the configured skill set. Keeps UI and effect code away from raw JSON paths. */
export class SkillCatalog {
  private readonly byId = new Map<string, SkillConfig>();
  private readonly byNetworkSkillId = new Map<string, SkillConfig>();

  public constructor(skills: SkillConfig[]) {
    for (const skill of skills) {
      if (this.byId.has(skill.id)) throw new Error(`duplicate skill id: ${skill.id}`);
      this.byId.set(skill.id, skill);
      if (!this.byNetworkSkillId.has(skill.networkSkillId)) this.byNetworkSkillId.set(skill.networkSkillId, skill);
    }
  }

  public get(id: string): SkillConfig {
    const skill = this.byId.get(id);
    if (!skill) throw new Error(`unknown configured skill: ${id}`);
    return skill;
  }

  public getByNetworkSkillId(networkSkillId: string): SkillConfig {
    const skill = this.byNetworkSkillId.get(networkSkillId);
    if (!skill) throw new Error(`unknown network skill: ${networkSkillId}`);
    return skill;
  }

  public findByClientEffect(kind: SkillConfig['clientEffect']['kind']): SkillConfig | undefined {
    return this.all().find((skill) => skill.clientEffect.kind === kind);
  }

  public all(): SkillConfig[] { return [...this.byId.values()]; }
}
