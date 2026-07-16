import type { ArtFacingDirection, Vec2Value } from './types.ts';

export interface MovementBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const normalizeMovement = (value: Vec2Value): Vec2Value => {
  const length = Math.hypot(value.x, value.y);
  if (length <= 1) return { x: value.x, y: value.y };
  return { x: value.x / length, y: value.y / length };
};

export type HorizontalFacingAngle = 0 | 180;

/** Keeps the previous facing for vertical/idle input and only changes it on horizontal movement. */
export const horizontalFacingAngleDegrees = (value: Vec2Value, current: HorizontalFacingAngle): HorizontalFacingAngle => {
  if (value.x > 0.01) return 0;
  if (value.x < -0.01) return 180;
  return current;
};

/** Normalizes any network angle to the nearest horizontal facing. */
export const normalizeHorizontalFacingAngle = (angle: number): HorizontalFacingAngle =>
  Math.cos(angle * Math.PI / 180) >= 0 ? 0 : 180;

/** Converts logical left/right into X scale after every frame has been normalized to one configured art direction. */
export const horizontalScaleForFacing = (
  angle: HorizontalFacingAngle,
  artFacingDirection: ArtFacingDirection,
  scale = 1
): number => {
  const logicalDirection: ArtFacingDirection = angle === 0 ? 'right' : 'left';
  return logicalDirection === artFacingDirection ? scale : -scale;
};

/** Normalizes generated animation frames to the fish's configured default art direction. */
export const shouldFlipArtFrame = (
  sourceFacingDirection: ArtFacingDirection,
  artFacingDirection: ArtFacingDirection
): boolean => sourceFacingDirection !== artFacingDirection;

export const moveWithinBounds = (
  position: Vec2Value,
  direction: Vec2Value,
  speed: number,
  deltaSeconds: number,
  bounds: MovementBounds
): Vec2Value => {
  const normalized = normalizeMovement(direction);
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, position.x + normalized.x * speed * deltaSeconds)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, position.y + normalized.y * speed * deltaSeconds))
  };
};
