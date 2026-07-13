import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const fromRoot = (...parts) => join(root, ...parts);
const required = [
  'AGENTS.md',
  'README.md',
  'package.json',
  'tsconfig.json',
  'assets/scenes/MainScene.scene',
  'assets/scripts/core/types.ts',
  'assets/scripts/core/save.ts',
  'assets/scripts/data/ConfigValidator.ts',
  'assets/scripts/platform/PlatformService.ts',
  'assets/scripts/platform/PlatformServiceEditor.ts',
  'assets/resources/configs/fish-player.json',
  'assets/resources/configs/fish-small-carp.json',
  'assets/resources/configs/skill-basic-bite.json',
  'assets/resources/configs/skill-dash-bite.json',
  'assets/resources/configs/world-sea-001.json',
  'docs/game-requirements.md',
  'docs/requirements-changelog.md',
  'docs/art-direction.md',
  'docs/art-prompts.md',
  'docs/art-assets-register.md',
  'build-config/targets.json'
];

const missing = required.filter((path) => !existsSync(fromRoot(path)));
if (missing.length) throw new Error(`缺少项目文件：\n${missing.join('\n')}`);

const packageJson = JSON.parse(readFileSync(fromRoot('package.json'), 'utf8'));
if (packageJson.version !== '0.1.0' || packageJson.creator?.version !== '3.8.8') {
  throw new Error('package.json 版本基线不正确');
}

const sceneText = readFileSync(fromRoot('assets/scenes/MainScene.scene'), 'utf8');
for (const nodeName of ['Canvas', 'WorldRoot', 'MainCamera', 'PlayerLayer', 'FishLayer', 'EffectLayer', 'HudRoot', 'SafeAreaRoot', 'InputLayer']) {
  if (!sceneText.includes(`\"_name\": \"${nodeName}\"`)) throw new Error(`场景缺少节点：${nodeName}`);
}
if (!sceneText.includes('"width": 1280') || !sceneText.includes('"height": 720')) {
  throw new Error('场景设计分辨率不是 1280 × 720');
}

for (const file of required.filter((path) => path.startsWith('assets/resources/configs/') || path === 'build-config/targets.json')) {
  const json = JSON.parse(readFileSync(fromRoot(file), 'utf8'));
  if (json.schemaVersion !== 1) throw new Error(`${file} 缺少 schemaVersion 1`);
}

console.log(`项目结构检查通过：${required.length} 个关键文件，场景节点和版本基线有效。`);
