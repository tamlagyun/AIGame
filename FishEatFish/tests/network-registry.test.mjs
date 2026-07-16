import test from 'node:test';
import assert from 'node:assert/strict';
import { RemotePlayerRegistry } from '../assets/scripts/network/RemotePlayerRegistry.ts';

const state = (playerId, overrides = {}) => ({
  playerId,
  displayName: playerId,
  x: 0,
  y: 0,
  rotation: 0,
  lastProcessedClientTick: 0,
  health: 100,
  maxHealth: 100,
  level: 1,
  dead: false,
  ...overrides
});

test('鲸吞快照按动作序号播放一次，并在目标稍后创建时补偿透明效果', () => {
  const calls = new Map();
  const registry = new RemotePlayerRegistry((player) => {
    const record = { skills: [], whaleTargetDurations: [] };
    calls.set(player.playerId, record);
    return {
      setPosition() {},
      setRotation() {},
      playSkill(skillId, duration) { record.skills.push([skillId, duration]); },
      playWhaleTarget(duration) { record.whaleTargetDurations.push(duration); },
      destroy() {}
    };
  });

  registry.upsert(state('source', {
    action: 'skill-whale-swallow',
    actionSequence: 1,
    actionTargetId: 'target',
    actionRemainingMs: 1800
  }));
  assert.deepEqual(calls.get('source').skills, [['skill-whale-swallow', 1800]]);

  registry.upsert(state('target'));
  assert.deepEqual(calls.get('target').whaleTargetDurations, [1800]);

  registry.upsert(state('source', {
    action: 'skill-whale-swallow',
    actionSequence: 1,
    actionTargetId: 'target',
    actionRemainingMs: 1600
  }));
  assert.equal(calls.get('source').skills.length, 1);
  assert.equal(calls.get('target').whaleTargetDurations.length, 1);
});
