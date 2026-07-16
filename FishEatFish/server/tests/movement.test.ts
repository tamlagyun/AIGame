import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateMovement } from '../src/simulation/movement-system.js';
test('server clamps movement to map bounds', () => { const result = simulateMovement({ x: 1910, y: 0, rotation: 0 }, { moveX: 1, moveY: 0, rotation: 0 }, 260, 1, { minX: -1920, maxX: 1920, minY: -1080, maxY: 1080 }); assert.equal(result.x, 1920); });
test('server normalizes fish facing to left or right', () => {
  const bounds = { minX: -1920, maxX: 1920, minY: -1080, maxY: 1080 };
  assert.equal(simulateMovement({ x: 0, y: 0, rotation: 0 }, { moveX: 0, moveY: 1, rotation: 35 }, 260, 0.05, bounds).rotation, 0);
  assert.equal(simulateMovement({ x: 0, y: 0, rotation: 180 }, { moveX: 0, moveY: -1, rotation: 145 }, 260, 0.05, bounds).rotation, 180);
});
