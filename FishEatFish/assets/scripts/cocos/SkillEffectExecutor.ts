import type { SkillConfig, Vec2Value } from '../core/types.ts';

export interface SkillEffectExecutorHooks {
  canActivate(): boolean;
  isOfflineMode(): boolean;
  getPlayerPosition(): Vec2Value | undefined;
  getFacingAngle(): number;
  startAction(animationState: SkillConfig['animationState'], durationSeconds: number): void;
  createBiteEffect(x: number, y: number, angle: number, radius: number, color: SkillConfig['clientEffect']['visualColor'], durationSeconds: number): void;
  createDashEffect(x: number, y: number, angle: number): void;
  startVisualRoll(durationSeconds: number): void;
  createInkSplashEffect(x: number, y: number, radius: number, rayCount: number, rayLength: number, color: SkillConfig['clientEffect']['visualColor'], sprayDurationSeconds: number, expansionDelaySeconds: number, expansionDurationSeconds: number): void;
  moveDash(distance: number, angle: number): Vec2Value;
  sendSkill(networkSkillId: string): void;
  showHint(text: string): void;
}

/** Executes local visual feedback from skill JSON; authority remains with the server. */
export class SkillEffectExecutor {
  public constructor(private readonly hooks: SkillEffectExecutorHooks) {}

  public activate(skill: SkillConfig): boolean {
    if (!this.hooks.canActivate()) return false;
    if ((skill.clientEffect.kind === 'whaleSwallow' || skill.clientEffect.kind === 'inkSplash' || skill.clientEffect.kind === 'orcaCharge') && this.hooks.isOfflineMode()) {
      this.hooks.showHint(
        skill.clientEffect.kind === 'inkSplash'
          ? '大王喷墨需要连接多人房间'
          : skill.clientEffect.kind === 'orcaCharge'
            ? '虎鲸冲刺需要连接多人房间并锁定前方玩家'
            : '鲸吞需要连接多人房间并锁定其它玩家'
      );
      return false;
    }
    const position = this.hooks.getPlayerPosition();
    if (!position) return false;
    const angle = this.hooks.getFacingAngle();
    const radians = angle * Math.PI / 180;
    const effect = skill.clientEffect;
    this.hooks.startAction(skill.animationState, effect.animationDurationSeconds);
    if (effect.kind === 'orcaCharge') {
      this.hooks.createDashEffect(position.x, position.y, angle);
    } else if (effect.kind === 'dashBite') {
      this.hooks.createDashEffect(position.x, position.y, angle);
      const next = this.hooks.moveDash(skill.dashDistance, angle);
      this.hooks.createBiteEffect(
        next.x + Math.cos(radians) * effect.visualOffset,
        next.y,
        angle,
        effect.visualRadius,
        effect.visualColor,
        effect.visualDurationSeconds
      );
    } else if (effect.kind === 'deathRoll') {
      this.hooks.startVisualRoll(effect.animationDurationSeconds);
      this.hooks.createBiteEffect(
        position.x + Math.cos(radians) * effect.visualOffset,
        position.y,
        angle,
        effect.visualRadius,
        effect.visualColor,
        effect.visualDurationSeconds
      );
    } else if (effect.kind === 'inkSplash') {
      this.hooks.createInkSplashEffect(
        position.x,
        position.y,
        effect.visualRadius,
        effect.rayCount ?? 16,
        effect.rayLength ?? effect.visualRadius,
        effect.visualColor,
        effect.sprayDurationSeconds ?? 0.5,
        effect.expansionDelaySeconds ?? 0.5,
        effect.expansionDurationSeconds ?? 0.5
      );
    } else if (effect.kind === 'bite') {
      this.hooks.createBiteEffect(
        position.x + Math.cos(radians) * effect.visualOffset,
        position.y,
        angle,
        effect.visualRadius,
        effect.visualColor,
        effect.visualDurationSeconds
      );
    }
    this.hooks.sendSkill(skill.networkSkillId);
    this.hooks.showHint(effect.hint);
    return true;
  }
}
