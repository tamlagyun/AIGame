import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const fromRoot = (...parts) => join(root, ...parts);
const required = [
  'AGENTS.md',
  'README.md',
  '.gitattributes',
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
  'assets/resources/configs/skill-whale-swallow.json',
  'assets/resources/configs/world-sea-001.json',
  'assets/resources/art/map/sea-background.png',
  'assets/resources/art/ui/skill-whale-swallow.png',
  'assets/resources/art/characters/player/swim-0.png',
  'assets/resources/art/characters/player/swim-5.png',
  'assets/resources/art/characters/player/hurt-0.png',
  'assets/resources/art/characters/player/hurt-7.png',
  'docs/game-requirements.md',
  'docs/requirements-changelog.md',
  'docs/art-direction.md',
  'docs/art-prompts.md',
  'docs/art-assets-register.md',
  'build-config/targets.json'
  ,'server/package.json'
  ,'server/tsconfig.json'
  ,'server/src/app.ts'
  ,'server/src/server.ts'
  ,'server/src/protocol/protocol-version.ts'
  ,'server/src/room/room.ts'
  ,'server/tests/room.test.ts'
  ,'docs/server-architecture.md'
  ,'docs/server-directory.md'
  ,'docs/realtime-protocol.md'
  ,'docs/auth-and-platform-adapters.md'
  ,'docs/deployment.md'
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

for (const file of required.filter((path) => path.startsWith('assets/resources/configs/'))) {
  const json = JSON.parse(readFileSync(fromRoot(file), 'utf8'));
  if (json.schemaVersion !== 2) throw new Error(`${file} 缺少 schemaVersion 2`);
}
const buildTargets = JSON.parse(readFileSync(fromRoot('build-config/targets.json'), 'utf8'));
if (buildTargets.schemaVersion !== 1) throw new Error('build-config/targets.json 缺少 schemaVersion 1');

console.log(`项目结构检查通过：${required.length} 个关键文件，场景节点和版本基线有效。`);
