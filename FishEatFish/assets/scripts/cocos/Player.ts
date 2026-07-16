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

  public constructor(
    public readonly id: string,
    public readonly node: Node,
    public readonly sprite: Sprite,
    private readonly artFacingDirection: ArtFacingDirection
  ) {}

  public setPosition(x: number, y: number): void {
    this.node.setPosition(x, y, 0);
  }

  public setFacing(angle: number, scale = this.visualScale): void {
    this.facingAngle = normalizeHorizontalFacingAngle(angle);
    this.node.angle = 0;
    this.node.setScale(horizontalScaleForFacing(this.facingAngle, this.artFacingDirection, scale), scale, 1);
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
}
