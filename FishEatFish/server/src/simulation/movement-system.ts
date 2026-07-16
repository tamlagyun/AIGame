import { clampPosition, type Bounds } from './bounds-system.js';
export interface MovementInput { moveX: number; moveY: number; rotation: number; }
export interface Position { x: number; y: number; rotation: number; }
export const simulateMovement = (position: Position, input: MovementInput, speed: number, deltaSeconds: number, bounds: Bounds): Position => {
  const length = Math.hypot(input.moveX, input.moveY); const scale = length > 1 ? 1 / length : 1;
  const next = clampPosition(position.x + input.moveX * scale * speed * deltaSeconds, position.y + input.moveY * scale * speed * deltaSeconds, bounds);
  return { ...next, rotation: Math.cos(input.rotation * Math.PI / 180) >= 0 ? 0 : 180 };
};
