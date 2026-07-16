import { horizontalFacingAngleDegrees, moveWithinBounds, type MovementBounds } from '../core/MovementSystem.ts';
import type { Vec2Value } from '../core/types.ts';
import { Player } from './Player.ts';

/** 本地客户端主角：在 Player 共用能力上增加输入驱动的预测移动与转向。 */
export class LocalPlayer extends Player {
  public move(direction: Vec2Value, speed: number, deltaSeconds: number, bounds: MovementBounds): Vec2Value {
    const current = this.node.position;
    const next = moveWithinBounds({ x: current.x, y: current.y }, direction, speed, deltaSeconds, bounds);
    this.setPosition(next.x, next.y);
    this.setFacing(horizontalFacingAngleDegrees(direction, this.facingAngle));
    return next;
  }
}
