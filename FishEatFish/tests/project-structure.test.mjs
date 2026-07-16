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
    '.gitattributes',
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

test('Canvas 下的世界与 HUD 根节点共用中心原点，HUD 只同步相机局部坐标', () => {
  const scene = JSON.parse(readFileSync(fromRoot('assets/scenes/MainScene.scene'), 'utf8'));
  for (const name of ['WorldRoot', 'HudRoot']) {
    const node = scene.find((entry) => entry?.__type__ === 'cc.Node' && entry?._name === name);
    assert.ok(node, `${name} 节点不存在`);
    assert.equal(node._lpos.x, 0);
    assert.equal(node._lpos.y, 0);
  }

  const source = readFileSync(fromRoot('assets/scripts/cocos/GameBootstrap.ts'), 'utf8');
  assert.match(source, /this\.hudRoot\.setPosition\(0, 0, 0\)/);
  assert.match(source, /this\.hudRoot\.setPosition\(cameraX, cameraY, 0\)/);
  assert.doesNotMatch(source, /this\.hudRoot\.setPosition\(cameraX - 640, cameraY - 360, 0\)/);
});

test('Agent 规则锁定需求存档、美术审批和卫生检查', () => {
  const rules = readFileSync(fromRoot('AGENTS.md'), 'utf8');
  assert.match(rules, /game-requirements\.md/);
  assert.match(rules, /每次调用美术 AI 前/);
  assert.match(rules, /不得使用 SVG/);
  assert.match(rules, /npm run hygiene/);
  assert.match(rules, /Scene 编辑视图、游戏 `MainCamera`、Canvas\/HUD 局部坐标和浏览器 DOM/);
  assert.match(rules, /WorldRoot.*HudRoot.*局部原点必须保持 `\(0,0\)`/s);
});

test('IDE login dialog stays in the HUD input layer and uses a single-line input', () => {
  const source = readFileSync(fromRoot('assets/scripts/cocos/GameBootstrap.ts'), 'utf8');
  const editorDialogStart = source.indexOf('private showEditorTestLoginDialog');
  const editorDialogEnd = source.indexOf('private alignEditorEditBoxDom', editorDialogStart);
  const editorDialog = source.slice(editorDialogStart, editorDialogEnd);

  assert.match(editorDialog, /getChildByName\('SafeAreaRoot'\).*getChildByName\('InputLayer'\)/s);
  assert.match(editorDialog, /inputLayer\.addChild\(dialog\)/);
  assert.match(editorDialog, /dialog\.setPosition\(0, 0, 0\)/);
  assert.match(editorDialog, /EditBox\.InputMode\.SINGLE_LINE/);
  assert.doesNotMatch(editorDialog, /canvas\.addChild\(dialog\)/);
  assert.doesNotMatch(editorDialog, /dialog\.setPosition\(-canvasWidth \/ 2/);
});

test('鱼动画原图方向由配置归一，节点翻转只读取统一美术方向', () => {
  const source = readFileSync(fromRoot('assets/scripts/cocos/GameBootstrap.ts'), 'utf8');
  assert.match(source, /parseFishConfig\(await this\.loadJson\('configs\/fish-player'\)\)/);
  assert.match(source, /spriteFrame\.flipUVX = shouldFlipArtFrame\(sourceFacingDirection, this\.artFacingDirection\)/);
  assert.match(source, /horizontalScaleForFacing\(angle, this\.artFacingDirection, scale\)/);
});

test('受击事件只切换翻肚动画帧，不修改目标位置', () => {
  const source = readFileSync(fromRoot('assets/scripts/cocos/GameBootstrap.ts'), 'utf8');
  const damagedStart = source.indexOf("message.type === 'playerDamaged'");
  const damagedEnd = source.indexOf("message.type === 'playerDied'", damagedStart);
  const damagedBranch = source.slice(damagedStart, damagedEnd);

  assert.match(damagedBranch, /startFishAction\('hurt'/);
  assert.match(damagedBranch, /playHurt\(event\.targetId, event\.skillId\)/);
  assert.doesNotMatch(damagedBranch, /setPosition/);
});

test('鱼儿生命条在 HUD Overlay 中跟随并按服务器生命比例裁剪', () => {
  const source = readFileSync(fromRoot('assets/scripts/cocos/GameBootstrap.ts'), 'utf8');
  assert.match(source, /new Node\('HealthBarFrame'\)/);
  assert.match(source, /new Node\('HealthBarFill'\)/);
  assert.match(source, /fill\.type = Sprite\.Type\.FILLED/);
  assert.match(source, /fill\.fillType = Sprite\.FillType\.HORIZONTAL/);
  assert.match(source, /display\.fill\.fillRange = safeHealth \/ safeMaxHealth/);
  assert.match(source, /display\.label\.string = `\$\{Math\.ceil\(safeHealth\)\}\/\$\{Math\.ceil\(safeMaxHealth\)\}`/);
  assert.match(source, /overlayTransform\.convertToNodeSpaceAR\(world\)/);
  assert.match(source, /display\.node\.angle = 0/);
});

test('远端技能动作使用服务器动作序号，并由状态快照补偿播放', () => {
  const registry = readFileSync(fromRoot('assets/scripts/network/RemotePlayerRegistry.ts'), 'utf8');
  const protocol = readFileSync(fromRoot('assets/scripts/network/NetworkProtocol.ts'), 'utf8');
  const room = readFileSync(fromRoot('server/src/room/room.ts'), 'utf8');
  assert.match(protocol, /actionSequence\?: number/);
  assert.match(room, /source\.actionSequence \+= 1/);
  assert.match(room, /actionUntil = Date\.now\(\) \+/);
  assert.match(registry, /state\.actionSequence > \(this\.actionSequences\.get\(state\.playerId\) \?\? 0\)/);
  assert.match(registry, /view\.playSkill\?\.\(state\.action\)/);
  assert.match(registry, /actionSequence !== undefined && actionSequence <=/);
});

test('远端鱼儿待机时循环播放游泳帧，动作和死亡期间暂停后恢复', () => {
  const source = readFileSync(fromRoot('assets/scripts/cocos/GameBootstrap.ts'), 'utf8');
  assert.match(source, /remoteSwimStates\.set\(sprite, \{ frameIndex: 0, elapsed: 0, active: true \}\)/);
  assert.match(source, /this\.advanceRemoteSwimAnimations\(deltaTime\)/);
  assert.match(source, /state\.frameIndex = \(state\.frameIndex \+ 1\) % this\.swimFrames\.length/);
  assert.match(source, /swimState\.active = false/);
  assert.match(source, /swimState\.active = true/);
});
