import { Color, Node, Sprite } from 'cc';
import { horizontalScaleForFacing, normalizeHorizontalFacingAngle, type HorizontalFacingAngle } from '../core/MovementSystem.ts';
import type { ArtFacingDirection } from '../core/types.ts';

/** 所有可见玩家共有的客户端角色对象与表现状态。 */
export class Player {
  public health = 100;
  public maxHealth = 100;
  public dead = false;
  public facingAngle: HorizontalFacingAngle = 180;
  private visualScale = 1;
  /** 死亡翻滚只绕 X 轴翻转，Z 轴仍由 2D 朝向体系保持为 0。 */
  private visualRollAngleX = 0;
  private visualRollToken = 0;
  private visualRollTimer?: ReturnType<typeof setInterval>;
  private knockbackToken = 0;
  private knockbackTimer?: ReturnType<typeof setInterval>;

  public constructor(
    public readonly id: string,
    public readonly node: Node,
    public readonly sprite: Sprite,
    private readonly visualNode: Node,
    private readonly artFacingDirection: ArtFacingDirection
  ) {}

  public setPosition(x: number, y: number): void {
    this.node.setPosition(x, y, 0);
  }

  public setFacing(angle: number, scale = this.visualScale): void {
    this.facingAngle = normalizeHorizontalFacingAngle(angle);
    // 根节点只负责世界坐标；鱼的朝向和翻滚都作用于独立视觉节点，避免被世界同步覆盖。
    this.node.setRotationFromEuler(0, 0, 0);
    this.visualNode.setRotationFromEuler(this.visualRollAngleX, 0, 0);
    this.visualNode.setScale(horizontalScaleForFacing(this.facingAngle, this.artFacingDirection, scale), scale, 1);
  }

  public setHealth(health: number, maxHealth: number): void {
    this.maxHealth = Number.isFinite(maxHealth) && maxHealth > 0 ? maxHealth : 1;
    this.health = Number.isFinite(health) ? Math.min(this.maxHealth, Math.max(0, health)) : 0;
  }

  public setDead(dead: boolean): void {
    this.dead = dead;
    this.node.active = true;
    this.setFacing(this.facingAngle, dead ? 0.6 : this.visualScale);
  }

  public setVisualScale(scale: number): void {
    this.visualScale = Math.max(0.01, scale);
    this.setFacing(this.facingAngle);
  }

  public restoreVisualScale(scale = 1): void {
    this.visualScale = Math.max(0.01, scale);
    this.setFacing(this.facingAngle, this.dead ? 0.6 : this.visualScale);
  }

  public setOpacity(alpha: number): void {
    const color = this.sprite.color;
    this.sprite.color = new Color(color.r, color.g, color.b, Math.max(0, Math.min(255, alpha)));
  }

  public setFrame(frame: Sprite['spriteFrame']): void {
    this.sprite.spriteFrame = frame;
  }

  /** Plays a visual-only full roll; world position and facing remain authoritative elsewhere. */
  public startVisualRoll(durationSeconds: number, turns = 1): void {
    if (this.visualRollTimer) clearInterval(this.visualRollTimer);
    const token = ++this.visualRollToken;
    this.visualRollAngleX = 0;
    this.node.setRotationFromEuler(0, 0, 0);
    this.visualNode.setRotationFromEuler(0, 0, 0);
    const end = 360 * turns;
    const step = Math.max(0.05, durationSeconds);
    const startedAt = Date.now();
    const tick = () => {
      if (!this.node.isValid || !this.visualNode.isValid || token !== this.visualRollToken) {
        if (this.visualRollTimer) clearInterval(this.visualRollTimer);
        return;
      }
      const progress = Math.min(1, (Date.now() - startedAt) / (step * 1000));
      this.visualRollAngleX = end * progress;
      this.visualNode.setRotationFromEuler(this.visualRollAngleX, 0, 0);
      if (progress >= 1) {
        if (this.visualRollTimer) clearInterval(this.visualRollTimer);
        this.visualRollTimer = undefined;
        this.visualRollAngleX = 0;
        this.visualNode.setRotationFromEuler(0, 0, 0);
      }
    };
    this.visualRollTimer = setInterval(tick, 16);
    tick();
  }

  public stopVisualRoll(): void {
    this.visualRollToken += 1;
    if (this.visualRollTimer) clearInterval(this.visualRollTimer);
    this.visualRollTimer = undefined;
    this.visualRollAngleX = 0;
    this.node.setRotationFromEuler(0, 0, 0);
    this.visualNode.setRotationFromEuler(0, 0, 0);
  }

  /** Keeps the root at the authoritative destination while the visual fish follows a short airborne arc. */
  public playKnockback(targetX: number, targetY: number, durationSeconds: number): void {
    if (this.knockbackTimer) clearInterval(this.knockbackTimer);
    const token = ++this.knockbackToken;
    const startX = this.node.position.x;
    const startY = this.node.position.y;
    this.node.setPosition(targetX, targetY, 0);
    const offsetX = startX - targetX;
    const offsetY = startY - targetY;
    const duration = Math.max(0.12, durationSeconds);
    const startedAt = Date.now();
    const tick = () => {
      if (!this.node.isValid || !this.visualNode.isValid || token !== this.knockbackToken) {
        if (this.knockbackTimer) clearInterval(this.knockbackTimer);
        return;
      }
      const progress = Math.min(1, (Date.now() - startedAt) / (duration * 1000));
      const lift = Math.sin(progress * Math.PI) * 72;
      this.visualNode.setPosition(offsetX * (1 - progress), offsetY * (1 - progress) + lift, 0);
      const baseScale = this.dead ? 0.6 : this.visualScale;
      this.setFacing(this.facingAngle, baseScale * (1 + Math.sin(progress * Math.PI) * 0.3));
      if (progress >= 1) {
        if (this.knockbackTimer) clearInterval(this.knockbackTimer);
        this.knockbackTimer = undefined;
        this.visualNode.setPosition(0, 0, 0);
        this.setFacing(this.facingAngle, this.dead ? 0.6 : this.visualScale);
      }
    };
    this.knockbackTimer = setInterval(tick, 16);
    tick();
  }
}
