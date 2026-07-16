import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFishConfig, parseSkillConfig, parseWorldConfig } from '../assets/scripts/data/ConfigValidator.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const readJson = (name) => JSON.parse(readFileSync(join(root, 'assets', 'resources', 'configs', name), 'utf8'));

test('鱼、技能和世界样例配置可校验', () => {
  const player = parseFishConfig(readJson('fish-player.json'));
  assert.equal(player.id, 'fish-player-crucian');
  assert.equal(player.artFacingDirection, 'right');
  assert.deepEqual(player.animationArtFacingDirections, { swim: 'right', bite: 'left', hurt: 'right' });
  assert.equal(parseSkillConfig(readJson('skill-basic-bite.json')).animationState, 'bite');
  assert.equal(parseSkillConfig(readJson('skill-dash-bite.json')).animationState, 'dashBite');
  const world = parseWorldConfig(readJson('world-sea-001.json'));
  assert.equal(world.maxActiveFish, 30);
  assert.equal(world.maxFullUpdateFish, 16);
});

test('配置校验拒绝错误版本和非法数值', () => {
  assert.throws(() => parseWorldConfig({ schemaVersion: 3, id: 'bad' }), /schemaVersion/);
  assert.throws(() => parseFishConfig({ ...readJson('fish-player.json'), maxHealth: 0 }), /maxHealth/);
  assert.throws(() => parseFishConfig({ ...readJson('fish-player.json'), artFacingDirection: 'up' }), /artFacingDirection/);
  assert.throws(() => parseFishConfig({ ...readJson('fish-player.json'), animationArtFacingDirections: { swim: 'right', bite: 'up', hurt: 'right' } }), /animationArtFacingDirections\.bite/);
});
