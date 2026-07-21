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

test('鲸吞按钮加载独立正式位图而不改变既有技能区布局', () => {
  const source = readFileSync(fromRoot('assets/scripts/cocos/GameBootstrap.ts'), 'utf8');
  const loadout = readFileSync(fromRoot('assets/resources/configs/skill-loadout-player.json'), 'utf8');
  const whale = readFileSync(fromRoot('assets/resources/configs/skill-whale-swallow.json'), 'utf8');
  const mainUi = readFileSync(fromRoot('assets/scripts/cocos/MainUIManager.ts'), 'utf8');
  assert.match(source, /new MainUIManager\(/);
  assert.match(mainUi, /new SkillActionPanel\([\s\S]*this\.inputLayer,[\s\S]*options\.skillLoadout/);
  assert.match(loadout, /"configs\/skill-whale-swallow"/);
  assert.match(whale, /"iconPath": "art\/ui\/skill-whale-swallow"/);
  assert.match(whale, /"slotIndex": 1/);
});

test('参数化登录组件保持在 HUD 输入层并统一 IDE 与 Web 的登录参数', () => {
  const source = readFileSync(fromRoot('assets/scripts/cocos/GameBootstrap.ts'), 'utf8');
  const dialog = readFileSync(fromRoot('assets/scripts/cocos/LoginDialog.ts'), 'utf8');
  assert.match(source, /new LoginDialog|LoginDialog\.open/);
  assert.match(source, /variant: 'test-environment'/);
  assert.match(source, /this\.mainUi\?\.inputLayer/);
  assert.match(dialog, /export interface LoginDialogOptions/);
  assert.match(dialog, /presentation: LoginDialogPresentation/);
  assert.match(dialog, /EditBox\.InputMode\.SINGLE_LINE/);
  assert.match(dialog, /parent\.addChild\(dialog\)/);
  assert.match(dialog, /dialog\.setPosition\(0, 0, 0\)/);
  assert.match(dialog, /options\.presentation === 'dom'/);
  assert.doesNotMatch(dialog, /canvas\.addChild\(dialog\)/);
});

test('MainUIManager owns fixed large-world HUD node creation', () => {
  const bootstrap = readFileSync(fromRoot('assets/scripts/cocos/GameBootstrap.ts'), 'utf8');
  const mainUi = readFileSync(fromRoot('assets/scripts/cocos/MainUIManager.ts'), 'utf8');
  assert.match(bootstrap, /this\.mainUi = new MainUIManager\(/);
  assert.match(bootstrap, /this\.fishHealthOverlay = this\.mainUi\.fishHealthOverlay/);
  assert.match(bootstrap, /this\.joystickNode = this\.mainUi\.joystickRoot/);
  assert.match(mainUi, /getChildByName\('SafeAreaRoot'\)\?\.getChildByName\('InputLayer'\)/);
  assert.match(mainUi, /createContainer\(this\.inputLayer, 'FishHealthOverlay', 1280, 720, 0\.5, 0\.5\)/);
  assert.match(mainUi, /this\.alignToBottomLeft\(this\.joystickRoot, 60, 35\)/);
  assert.match(mainUi, /new SkillActionPanel\([\s\S]*this\.inputLayer/);
});

test('右上技能入口打开技能配置界面并通过技能库替换四个槽位', () => {
  const bootstrap = readFileSync(fromRoot('assets/scripts/cocos/GameBootstrap.ts'), 'utf8');
  const mainUi = readFileSync(fromRoot('assets/scripts/cocos/MainUIManager.ts'), 'utf8');
  const dialog = readFileSync(fromRoot('assets/scripts/cocos/SkillLoadoutDialog.ts'), 'utf8');
  const panel = readFileSync(fromRoot('assets/scripts/cocos/SkillActionPanel.ts'), 'utf8');
  const store = readFileSync(fromRoot('assets/scripts/data/SkillLoadoutStore.ts'), 'utf8');
  const library = JSON.parse(readFileSync(fromRoot('assets/resources/configs/skill-library-player.json'), 'utf8'));
  assert.match(bootstrap, /loadJson\('configs\/skill-library-player'\)/);
  assert.match(bootstrap, /loadImage\('art\/ui\/skill-loadout-entry'\)/);
  assert.match(mainUi, /new SkillLoadoutStore\(options\.allSkills, options\.skills\)/);
  assert.match(mainUi, /new SkillLoadoutDialog\(/);
  assert.match(dialog, /'SkillLoadoutEntryRoot'/);
  assert.match(dialog, /widget\.isAlignRight = true/);
  assert.match(dialog, /widget\.isAlignTop = true/);
  assert.match(dialog, /'SkillLoadoutDialog'/);
  assert.match(dialog, /当前没有未装备技能/);
  assert.match(panel, /public replaceArcSkill\(slotIndex: number, skill: SkillConfig\)/);
  assert.match(store, /fish-eat-fish\.skill-loadout\.v1/);
  assert.equal(library.schemaVersion, 2);
  assert.equal(library.skillConfigPaths.length, 6);
  assert.ok(library.skillConfigPaths.includes('configs/skill-orca-charge'));
});

test('虎鲸冲刺只进入技能库并由服务器权威处理伤害和顶飞', () => {
  const loadout = readFileSync(fromRoot('assets/resources/configs/skill-loadout-player.json'), 'utf8');
  const library = readFileSync(fromRoot('assets/resources/configs/skill-library-player.json'), 'utf8');
  const skill = readFileSync(fromRoot('assets/resources/configs/skill-orca-charge.json'), 'utf8');
  const combat = readFileSync(fromRoot('server/src/combat/combat-service.ts'), 'utf8');
  const room = readFileSync(fromRoot('server/src/room/room.ts'), 'utf8');
  const player = readFileSync(fromRoot('assets/scripts/cocos/Player.ts'), 'utf8');
  assert.doesNotMatch(loadout, /skill-orca-charge/);
  assert.match(library, /configs\/skill-orca-charge/);
  assert.match(skill, /"damage": 60/);
  assert.match(skill, /"knockbackDistance": 360/);
  assert.match(combat, /skillId === 'skill-orca-charge'/);
  assert.match(room, /targetX: result\.targetX/);
  assert.match(player, /public playKnockback\(targetX: number, targetY: number/);
});

test('技能 3 使用独立死亡翻滚配置和网络 ID', () => {
  const config = readFileSync(fromRoot('assets/resources/configs/skill-placeholder-3.json'), 'utf8');
  const inkConfig = readFileSync(fromRoot('assets/resources/configs/skill-placeholder-4.json'), 'utf8');
  const protocol = readFileSync(fromRoot('assets/scripts/network/NetworkProtocol.ts'), 'utf8');
  const combat = readFileSync(fromRoot('server/src/combat/combat-config.ts'), 'utf8');
  assert.match(config, /"id": "skill-death-roll"/);
  assert.match(config, /"animationState": "deathRoll"/);
  assert.match(config, /"damage": 3/);
  assert.match(protocol, /'skill-death-roll'/);
  assert.match(combat, /'skill-death-roll': \{ damage: 3/);
  assert.match(inkConfig, /"id": "skill-ink-splash"/);
  assert.match(protocol, /'skill-ink-splash'/);
  assert.match(combat, /'skill-ink-splash': \{ damage: 25, range: 600/);
});

test('死亡翻滚使用局部 X 轴而不是 2D Z 轴角度', () => {
  const player = readFileSync(join(root, 'assets', 'scripts', 'cocos', 'Player.ts'), 'utf8');
  assert.match(player, /setRotationFromEuler\(this\.visualRollAngleX, 0, 0\)/);
  assert.match(player, /this\.visualRollAngleX = end \* progress/);
  assert.doesNotMatch(player, /node\.angle = this\.visual/);
});

test('大王喷墨使用泼洒墨团而不是长方形墨柱', () => {
  const bootstrap = readFileSync(fromRoot('assets/scripts/cocos/GameBootstrap.ts'), 'utf8');
  const effect = bootstrap.slice(bootstrap.indexOf('private createInkSplashEffect'), bootstrap.indexOf('private bindActionButton'));
  assert.match(effect, /drawBlob/);
  assert.match(effect, /graphics\.circle/);
  assert.doesNotMatch(effect, /graphics\.lineTo\(dx \* rayLength/);
});

test('RoleManager 统一创建和移除本地与远端玩家对象', () => {
  const bootstrap = readFileSync(fromRoot('assets/scripts/cocos/GameBootstrap.ts'), 'utf8');
  const roles = readFileSync(fromRoot('assets/scripts/cocos/RoleManager.ts'), 'utf8');
  const player = readFileSync(fromRoot('assets/scripts/cocos/Player.ts'), 'utf8');
  const local = readFileSync(fromRoot('assets/scripts/cocos/LocalPlayer.ts'), 'utf8');
  assert.match(bootstrap, /new RoleManager\(playerLayer, this\.swimFrames\[0\], this\.artFacingDirection\)/);
  assert.match(bootstrap, /this\.roleManager\.createLocalPlayer\(\)/);
  assert.match(bootstrap, /roleManager\.createRemotePlayer\(state\.playerId\)/);
  assert.match(bootstrap, /roleManager\.remove\(state\.playerId\)/);
  assert.match(roles, /new LocalPlayer\(/);
  assert.match(roles, /new Player\(/);
  assert.match(player, /export class Player/);
  assert.match(player, /private readonly visualNode: Node/);
  assert.match(player, /visualNode\.setRotationFromEuler\(this\.visualRollAngleX, 0, 0\)/);
  assert.match(player, /setHealth\(health: number, maxHealth: number\)/);
  assert.match(player, /setFacing\(angle: number/);
  assert.match(local, /export class LocalPlayer extends Player/);
  assert.match(local, /public move\(direction: Vec2Value/);
  assert.match(roles, /public remove\(id: string\)/);
  assert.match(roles, /role\.node\.destroy\(\)/);
});

test('鱼动画原图方向由配置归一，节点翻转只读取统一美术方向', () => {
  const source = readFileSync(fromRoot('assets/scripts/cocos/GameBootstrap.ts'), 'utf8');
  const player = readFileSync(fromRoot('assets/scripts/cocos/Player.ts'), 'utf8');
  assert.match(source, /this\.loadJson\('configs\/fish-player'\)/);
  assert.match(source, /const playerFishConfig = parseFishConfig\(playerFishConfigRaw\)/);
  assert.match(source, /spriteFrame\.flipUVX = shouldFlipArtFrame\(sourceFacingDirection, this\.artFacingDirection\)/);
  assert.match(player, /horizontalScaleForFacing\(this\.facingAngle, this\.artFacingDirection, scale\)/);
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

test('鱼儿头顶血条、血量和用户名由独立 HUD Overlay 类管理', () => {
  const source = readFileSync(fromRoot('assets/scripts/cocos/GameBootstrap.ts'), 'utf8');
  const health = readFileSync(fromRoot('assets/scripts/cocos/FishHealthBarOverlay.ts'), 'utf8');
  const name = readFileSync(fromRoot('assets/scripts/cocos/FishNameOverlay.ts'), 'utf8');
  assert.match(source, /new FishHealthBarOverlay\(/);
  assert.match(source, /new FishNameOverlay\(/);
  assert.match(source, /display\.updatePosition\(overlayTransform\)/);
  assert.match(health, /new Node\('HealthBarFrame'\)/);
  assert.match(health, /new Node\('HealthBarFill'\)/);
  assert.match(health, /this\.fill\.type = Sprite\.Type\.FILLED/);
  assert.match(health, /this\.fill\.fillType = Sprite\.FillType\.HORIZONTAL/);
  assert.match(health, /this\.fill\.fillRange = safeHealth \/ safeMaxHealth/);
  assert.match(health, /this\.label\.string = `\$\{Math\.ceil\(safeHealth\)\}\/\$\{Math\.ceil\(safeMaxHealth\)\}`/);
  assert.match(health, /this\.label\.enableOutline = true/);
  assert.match(health, /this\.label\.useSystemFont = true/);
  assert.match(health, /this\.label\.cacheMode = Label\.CacheMode\.NONE/);
  assert.match(health, /this\.label\.outlineWidth = 2/);
  assert.match(name, /this\.label\.enableOutline = true/);
  assert.match(name, /this\.label\.useSystemFont = true/);
  assert.match(name, /this\.label\.cacheMode = Label\.CacheMode\.NONE/);
  assert.match(name, /this\.label\.outlineWidth = 2/);
  assert.match(health, /world\.y \+= 120/);
  assert.match(name, /world\.y \+= 160/);
  assert.match(health, /overlayTransform\.convertToNodeSpaceAR\(world\)/);
  assert.match(name, /overlayTransform\.convertToNodeSpaceAR\(world\)/);
  assert.match(health, /this\.node\.angle = 0/);
  assert.match(name, /this\.node\.angle = 0/);
});

test('远端技能动作使用服务器动作序号，并由状态快照补偿播放', () => {
  const registry = readFileSync(fromRoot('assets/scripts/network/RemotePlayerRegistry.ts'), 'utf8');
  const protocol = readFileSync(fromRoot('assets/scripts/network/NetworkProtocol.ts'), 'utf8');
  const room = readFileSync(fromRoot('server/src/room/room.ts'), 'utf8');
  assert.match(protocol, /actionSequence\?: number/);
  assert.match(room, /source\.actionSequence \+= 1/);
  assert.match(room, /actionUntil = now \+ effectDurationMs/);
  assert.match(registry, /state\.actionSequence > \(this\.actionSequences\.get\(state\.playerId\) \?\? 0\)/);
  assert.match(registry, /this\.playSkill\(state\.playerId, state\.action, state\.actionSequence, state\.actionTargetId, state\.actionRemainingMs\)/);
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

test('技能区域以普攻为圆心并从左向上形成扇形槽位', () => {
  const panel = readFileSync(fromRoot('assets/scripts/cocos/SkillActionPanel.ts'), 'utf8');
  const loadout = JSON.parse(readFileSync(fromRoot('assets/resources/configs/skill-loadout-player.json'), 'utf8'));
  assert.deepEqual(loadout.layout.primaryCenter, { x: 350, y: 104 });
  assert.equal(loadout.layout.arcRadius, 176);
  assert.deepEqual(loadout.layout.arcAngles, [190, 155, 120, 85]);
  assert.equal(loadout.layout.width, 450);
  assert.equal(loadout.layout.height, 340);
  assert.equal(loadout.layout.right, 24);
  assert.equal(loadout.layout.bottom, 20);
  assert.match(panel, /this\.alignToBottomRight\(this\.root, layout\.right, layout\.bottom\)/);
  assert.match(panel, /layout\.primaryCenter\.x \+ Math\.cos\(radians\) \* layout\.arcRadius/);
  assert.match(panel, /const size = skill\.ui\.slot === 'primary' \? layout\.primaryButtonSize : layout\.arcButtonSize/);
});

test('技能名称位于图标内部下侧并与图标下边缘对齐', () => {
  const labelSource = readFileSync(fromRoot('assets/scripts/cocos/SkillActionPanel.ts'), 'utf8');
  assert.match(labelSource, /transform\.setAnchorPoint\(0\.5, 0\)/);
  assert.match(labelSource, /label\.verticalAlign = Label\.VerticalAlign\.BOTTOM/);
  assert.match(labelSource, /node\.setPosition\(0, -parentTransform\.height \/ 2, 0\)/);
  assert.match(labelSource, /label\.outlineColor = new Color\(4, 18, 34, 255\)/);
  assert.match(labelSource, /label\.enableOutline = true/);
  assert.match(labelSource, /label\.outlineWidth = 2/);
  assert.doesNotMatch(labelSource, /height \/ 2 - 18/);
});

test('四个技能按钮使用从十二点方向顺时针消退的独立径向冷却蒙板', () => {
  const panel = readFileSync(fromRoot('assets/scripts/cocos/SkillActionPanel.ts'), 'utf8');
  const loadout = readFileSync(fromRoot('assets/resources/configs/skill-loadout-player.json'), 'utf8');
  assert.match(loadout, /"cooldownStart": 0\.25/);
  assert.match(panel, /sprite\.type = Sprite\.Type\.FILLED/);
  assert.match(panel, /sprite\.fillType = Sprite\.FillType\.RADIAL/);
  assert.match(panel, /sprite\.fillCenter = new Vec2\(0\.5, 0\.5\)/);
  assert.match(panel, /sprite\.color = new Color\(0, 0, 0, 160\)/);
  assert.match(panel, /this\.loadout\.layout\.cooldownStart - elapsedRatio \+ 1/);
  assert.match(panel, /sprite\.fillRange = active \? -remainingRatio : 0/);
  assert.match(panel, /cooldown\.remaining = cooldown\.duration/);
});

test('鲸吞由服务器选择目标并同步三秒缩放与透明度表现', () => {
  const client = readFileSync(fromRoot('assets/scripts/cocos/GameBootstrap.ts'), 'utf8');
  const whaleConfig = readFileSync(fromRoot('assets/resources/configs/skill-whale-swallow.json'), 'utf8');
  const protocol = readFileSync(fromRoot('assets/scripts/network/NetworkProtocol.ts'), 'utf8');
  const combat = readFileSync(fromRoot('server/src/combat/combat-service.ts'), 'utf8');
  const room = readFileSync(fromRoot('server/src/room/room.ts'), 'utf8');
  assert.match(protocol, /'skill-whale-swallow'/);
  assert.match(protocol, /targetId\?: string/);
  assert.match(protocol, /effectDurationMs\?: number/);
  assert.match(combat, /reason: 'noTarget'/);
  assert.match(combat, /applyTeleport\?\.\(target\.x, target\.y\)/);
  assert.match(room, /WHALE_SWALLOW_DURATION_MS/);
  assert.match(whaleConfig, /"displayName": "鲸吞"/);
  assert.match(whaleConfig, /"effectDurationSeconds": 3/);
  assert.match(client, /this\.getWhaleEffectDurationMs\(\)/);
  assert.match(client, /player\.setVisualScale\(this\.getWhaleScaleMultiplier\(\)\)/);
  assert.match(client, /player\.setOpacity\(this\.getWhaleOpacityAlpha\(\)\)/);
  assert.match(client, /this\.applyWhaleOpacity\(this\.localPlayer, durationMs\)/);
});
