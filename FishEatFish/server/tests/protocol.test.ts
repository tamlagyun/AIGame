import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClientMessage, parseInput, parseSkill } from '../src/protocol/message-schemas.js';
test('protocol validates input bounds', () => { assert.equal(parseClientMessage({ protocolVersion: 1, type: 'input', payload: { clientTick: 1, moveX: 0, moveY: 0, rotation: 0 } }).type, 'input'); assert.throws(() => parseInput({ clientTick: 1, moveX: 2, moveY: 0, rotation: 0 })); });
test('protocol accepts target skills and rejects unsupported skills', () => {
  assert.equal(parseSkill({ skillId: 'skill-whale-swallow', clientTick: 1, x: 0, y: 0, rotation: 0 }).skillId, 'skill-whale-swallow');
  assert.equal(parseSkill({ skillId: 'skill-orca-charge', clientTick: 2, x: 0, y: 0, rotation: 0 }).skillId, 'skill-orca-charge');
  assert.throws(() => parseSkill({ skillId: 'skill-unknown', clientTick: 1, x: 0, y: 0, rotation: 0 }));
});
