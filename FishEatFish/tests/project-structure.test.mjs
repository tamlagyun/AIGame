import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const fromRoot = (...parts) => join(root, ...parts);

test('Cocos 3.8.8 工程骨架和中文档案存在', () => {
  const required = [
    'assets/scenes/MainScene.scene',
    'assets/scripts/core/types.ts',
    'assets/scripts/platform/PlatformService.ts',
    'assets/resources/configs/world-sea-001.json',
    'docs/game-requirements.md',
    'docs/art-prompts.md',
    'AGENTS.md'
  ];
  assert.deepEqual(required.filter((path) => !existsSync(fromRoot(path))), []);
  const pkg = JSON.parse(readFileSync(fromRoot('package.json'), 'utf8'));
  assert.equal(pkg.displayName, '鲫鱼吃鲤鱼');
  assert.equal(pkg.creator.version, '3.8.8');
});

test('主场景包含约定层级和 1280 × 720 设计尺寸', () => {
  const scene = readFileSync(fromRoot('assets/scenes/MainScene.scene'), 'utf8');
  for (const name of ['WorldRoot', 'MainCamera', 'PlayerLayer', 'FishLayer', 'EffectLayer', 'HudRoot', 'SafeAreaRoot', 'InputLayer']) {
    assert.match(scene, new RegExp(`\"_name\": \"${name}\"`));
  }
  assert.match(scene, /"width": 1280/);
  assert.match(scene, /"height": 720/);
  assert.match(scene, /d3e04CsSh1IBqyn\/meEPSz7/);
});

test('Agent 规则锁定需求存档、美术审批和卫生检查', () => {
  const rules = readFileSync(fromRoot('AGENTS.md'), 'utf8');
  assert.match(rules, /game-requirements\.md/);
  assert.match(rules, /每次调用美术 AI 前/);
  assert.match(rules, /不得使用 SVG/);
  assert.match(rules, /npm run hygiene/);
});
