import {
  _decorator,
  BlockInputEvents,
  Color,
  Component,
  EventKeyboard,
  EventTouch,
  ImageAsset,
  input,
  Input,
  JsonAsset,
  KeyCode,
  Label,
  Graphics,
  Node,
  resources,
  ResolutionPolicy,
  Sprite,
  SpriteFrame,
  Texture2D,
  UITransform,
  Vec2,
  Vec3,
  view,
  tween
} from 'cc';
import { moveWithinBounds, shouldFlipArtFrame } from '../core/MovementSystem.ts';
import type { ArtFacingDirection, SkillConfig, Vec2Value } from '../core/types.ts';
import { parseFishConfig, parseSkillConfig, parseSkillLoadoutConfig } from '../data/ConfigValidator.ts';
import { SkillCatalog } from '../data/SkillCatalog.ts';
import { createPlatformService } from '../platform/PlatformAdapters.ts';
import { RealtimeSession } from '../network/RealtimeSession.ts';
import { RemotePlayerRegistry } from '../network/RemotePlayerRegistry.ts';
import { resolveNetworkEndpoint } from '../network/NetworkEnvironment.ts';
import type { NetworkMessage, RemotePlayerState, SkillEffect, SkillResolved, PlayerDamaged, PlayerDied, PlayerRespawned, CombatSettlement, SkillId } from '../network/NetworkProtocol.ts';
import { SkillActionPanel } from './SkillActionPanel.ts';
import { SkillEffectExecutor } from './SkillEffectExecutor.ts';
import { FishHealthBarOverlay } from './FishHealthBarOverlay.ts';
import { FishNameOverlay } from './FishNameOverlay.ts';
import { LoginDialog } from './LoginDialog.ts';
import { RoleManager } from './RoleManager.ts';
import { LocalPlayer } from './LocalPlayer.ts';
import { Player } from './Player.ts';
import { MainUIManager } from './MainUIManager.ts';

const { ccclass } = _decorator;

@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
  private static readonly WORLD_WIDTH = 3840;
  private static readonly WORLD_HEIGHT = 2160;
  private static readonly PLAYER_SPEED = 260;
  private static readonly PLAYER_MARGIN = 96;
  private static readonly JOYSTICK_RADIUS = 120;

  private removePauseListener?: () => void;
  private removeResumeListener?: () => void;
  private localPlayer?: LocalPlayer;
  private roleManager?: RoleManager;
  private artFacingDirection!: ArtFacingDirection;
  private cameraNode?: Node;
  private hudRoot?: Node;
  private actionHint?: Label;
  private healthLabel?: Label;
  private fishHealthOverlay?: Node;
  private mainUi?: MainUIManager;
  private readonly fishHealthDisplays = new Map<string, FishHealthBarOverlay>();
  private readonly fishNameDisplays = new Map<string, FishNameOverlay>();
  private skillPanel?: SkillActionPanel;
  private skillCatalog?: SkillCatalog;
  private skillExecutor?: SkillEffectExecutor;
  private joystickKnob?: Node;
  private joystickNode?: Node;
  private swimFrames: SpriteFrame[] = [];
  private biteFrames: SpriteFrame[] = [];
  private hurtFrames: SpriteFrame[] = [];
  private healthBarFrame?: SpriteFrame;
  private healthBarFill?: SpriteFrame;
  private readonly remoteAnimationTokens = new WeakMap<Sprite, number>();
  private readonly remoteSwimStates = new Map<Sprite, { frameIndex: number; elapsed: number; active: boolean }>();
  private readonly whaleOpacityTokens = new WeakMap<Player, number>();
  private readonly whaleScaleTokens = new WeakMap<Player, number>();
  private readonly localWhaleTargetSequences = new Map<string, number>();
  private localActionSequence = 0;
  private swimFrameIndex = 0;
  private animationElapsed = 0;
  private fishActionState: 'swim' | 'bite' | 'dashBite' | 'whaleSwallow' | 'hurt' = 'swim';
  private fishActionElapsed = 0;
  private fishActionDuration = 0;
  private readonly pressedKeys = new Set<KeyCode>();
  private joystickTouchId: number | null = null;
  private readonly joystickOrigin = new Vec2();
  private readonly joystickDirection = new Vec2();
  private readonly realtime = new RealtimeSession();
  private remotePlayers?: RemotePlayerRegistry;
  private networkPlayerId?: string;
  private networkClientTick = 0;
  private networkInputElapsed = 0;
  private connectionDialog?: Node;
  private connectionDetailLabel?: Label;
  private connectionDetail = '';
  private offlineModeSelected = false;
  private isDestroying = false;
  private loginDialog?: LoginDialog;
  private testUsername = '';

  protected async start(): Promise<void> {
    view.setDesignResolutionSize(1280, 720, ResolutionPolicy.SHOW_ALL);
    const platform = createPlatformService('web');
    await platform.init();
    this.removePauseListener = platform.onPause(() => this.node.pauseSystemEvents(true));
    this.removeResumeListener = platform.onResume(() => this.node.resumeSystemEvents(true));
    await this.createOceanWorld();
    this.bindInput();
    this.showTestLoginDialog();
  }

  protected onDestroy(): void {
    this.isDestroying = true;
    this.unbindInput();
    this.removePauseListener?.();
    this.removeResumeListener?.();
    this.realtime.close();
    this.remotePlayers?.clear();
    this.roleManager?.clear();
    this.roleManager = undefined;
    this.remoteSwimStates.clear();
    this.localWhaleTargetSequences.clear();
    for (const display of this.fishHealthDisplays.values()) display.destroy();
    for (const display of this.fishNameDisplays.values()) display.destroy();
    this.fishHealthDisplays.clear();
    this.fishNameDisplays.clear();
    this.loginDialog?.close();
    this.loginDialog = undefined;
  }

  protected update(deltaTime: number): void {
    const localPlayer = this.localPlayer;
    if (!localPlayer || !this.cameraNode) return;
    this.skillPanel?.update(deltaTime);
    this.updateFishAction(deltaTime);
    this.advanceRemoteSwimAnimations(deltaTime);
    if (this.loginDialog?.isOpen) { this.updateFishHealthDisplays(); return; }
    if (localPlayer.dead) { this.updateFishHealthDisplays(); return; }

    const keyboard = this.readKeyboardDirection();
    const direction = {
      x: keyboard.x + this.joystickDirection.x,
      y: keyboard.y + this.joystickDirection.y
    };
    const moving = Math.hypot(direction.x, direction.y) > 0.01;
    const next = localPlayer.move(
      direction,
      GameBootstrap.PLAYER_SPEED,
      deltaTime,
      {
        minX: -GameBootstrap.WORLD_WIDTH / 2 + GameBootstrap.PLAYER_MARGIN,
        maxX: GameBootstrap.WORLD_WIDTH / 2 - GameBootstrap.PLAYER_MARGIN,
        minY: -GameBootstrap.WORLD_HEIGHT / 2 + GameBootstrap.PLAYER_MARGIN,
        maxY: GameBootstrap.WORLD_HEIGHT / 2 - GameBootstrap.PLAYER_MARGIN
      }
    );
    this.advanceSwimAnimation(deltaTime, moving);
    this.followPlayer(next.x, next.y);
    this.updateFishHealthDisplays();
    this.networkInputElapsed += deltaTime;
    if (this.networkInputElapsed >= 0.05) {
      this.networkInputElapsed = 0;
      this.realtime.sendInput({ clientTick: ++this.networkClientTick, moveX: direction.x, moveY: direction.y, rotation: localPlayer.facingAngle });
    }
  }

  private async createOceanWorld(): Promise<void> {
    const worldRoot = this.node.getChildByName('WorldRoot');
    const playerLayer = worldRoot?.getChildByName('PlayerLayer');
    this.cameraNode = worldRoot?.getChildByName('MainCamera');
    this.hudRoot = this.node.getChildByName('HudRoot');
    if (!worldRoot || !playerLayer || !this.cameraNode || !this.hudRoot) {
      throw new Error('MainScene 缺少世界、玩家、镜头或 HUD 节点。');
    }
    const [playerFishConfigRaw, skillLoadoutRaw] = await Promise.all([
      this.loadJson('configs/fish-player'),
      this.loadJson('configs/skill-loadout-player')
    ]);
    const playerFishConfig = parseFishConfig(playerFishConfigRaw);
    const skillLoadout = parseSkillLoadoutConfig(skillLoadoutRaw);
    const skills = await Promise.all(skillLoadout.skillConfigPaths.map(async (path) => parseSkillConfig(await this.loadJson(path))));
    this.skillCatalog = new SkillCatalog(skills);
    this.artFacingDirection = playerFishConfig.artFacingDirection;
    // WorldRoot、HudRoot 和 MainCamera 共用 Canvas 中心作为局部原点。
    // Canvas 的锚点换算由引擎负责，子根节点不得再次减去半屏尺寸。
    this.hudRoot.setPosition(0, 0, 0);
    const skillImages = new Map<string, ImageAsset>();
    const [backgroundImage, ...images] = await Promise.all([
      this.loadImage('art/map/sea-background'),
      ...Array.from({ length: 6 }, (_, index) => this.loadImage(`art/characters/player/swim-${index}`)),
      ...Array.from({ length: 8 }, (_, index) => this.loadImage(`art/characters/player/bite-${index}`)),
      ...Array.from({ length: 8 }, (_, index) => this.loadImage(`art/characters/player/hurt-${index}`)),
      this.loadImage('art/ui/joystick-base'),
      this.loadImage('art/ui/joystick-knob'),
      this.loadImage('art/ui/health-bar-frame'),
      this.loadImage('art/ui/health-bar-fill'),
      ...skills.map((skill) => this.loadImage(skill.ui.iconPath))
    ]);
    const fishImages = images.slice(0, 6);
    const biteImages = images.slice(6, 14);
    const hurtImages = images.slice(14, 22);
    const [joystickBase, joystickKnob, healthBarFrame, healthBarFill, ...skillImageAssets] = images.slice(22);
    skills.forEach((skill, index) => skillImages.set(skill.id, skillImageAssets[index] as ImageAsset));

    const background = new Node('OceanMap');
    background.layer = worldRoot.layer;
    const backgroundTransform = background.addComponent(UITransform);
    backgroundTransform.setContentSize(GameBootstrap.WORLD_WIDTH, GameBootstrap.WORLD_HEIGHT);
    const backgroundSprite = background.addComponent(Sprite);
    backgroundSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    backgroundSprite.spriteFrame = this.createSpriteFrame(backgroundImage);
    worldRoot.addChild(background);
    background.setSiblingIndex(0);

    this.swimFrames = fishImages.map((image) => this.createFishSpriteFrame(image, playerFishConfig.animationArtFacingDirections.swim));
    this.biteFrames = biteImages.map((image) => this.createFishSpriteFrame(image, playerFishConfig.animationArtFacingDirections.bite));
    this.hurtFrames = hurtImages.map((image) => this.createFishSpriteFrame(image, playerFishConfig.animationArtFacingDirections.hurt));
    this.healthBarFrame = this.createSpriteFrame(healthBarFrame);
    this.healthBarFill = this.createSpriteFrame(healthBarFill);
    this.mainUi = new MainUIManager({
      hudRoot: this.hudRoot,
      joystickBase,
      joystickKnob,
      skillLoadout,
      skills,
      skillImages,
      onSkillActivate: (skill) => this.skillExecutor?.activate(skill) ?? false,
      onJoystickStart: this.onJoystickTouchStart,
      onJoystickMove: this.onJoystickTouchMove,
      onJoystickEnd: this.onJoystickTouchEnd
    });
    this.fishHealthOverlay = this.mainUi.fishHealthOverlay;
    this.actionHint = this.mainUi.actionHint;
    this.healthLabel = this.mainUi.healthLabel;
    this.joystickNode = this.mainUi.joystickRoot;
    this.joystickKnob = this.mainUi.joystickKnob;
    this.skillPanel = this.mainUi.skillPanel;
    this.roleManager = new RoleManager(playerLayer, this.swimFrames[0], this.artFacingDirection);
    const localRole = this.roleManager.createLocalPlayer();
    this.localPlayer = localRole;
    localRole.setFacing(180);
    this.createFishHealthDisplay('local-player', localRole.node, localRole.health, localRole.maxHealth);
    this.createFishNameDisplay('local-player', localRole.node, '');
    this.remotePlayers = new RemotePlayerRegistry((state) => this.createRemotePlayerView(state));
    this.skillExecutor = this.createSkillEffectExecutor();

    this.updateHealthHud();
  }

  private createRemotePlayerView(state: RemotePlayerState) {
    const roleManager = this.roleManager;
    if (!roleManager) throw new Error('RoleManager 尚未初始化。');
    const role = roleManager.createRemotePlayer(state.playerId);
    const node = role.node;
    const sprite = role.sprite;
    this.remoteSwimStates.set(sprite, { frameIndex: 0, elapsed: 0, active: true });
    role.setFacing(state.rotation);
    role.setHealth(state.health, state.maxHealth);
    role.setDead(state.dead);
    this.createFishHealthDisplay(state.playerId, node, state.health, state.maxHealth);
    this.createFishNameDisplay(state.playerId, node, state.displayName);
    return {
      setPosition: (x: number, y: number) => role.setPosition(x, y),
      setRotation: (angle: number) => role.setFacing(angle),
      setHealth: (health: number, maxHealth: number) => { role.setHealth(health, maxHealth); this.setFishHealth(state.playerId, health, maxHealth); },
      playSkill: (skillId: SkillId, effectDurationMs?: number) => {
        const skill = this.getConfiguredNetworkSkill(skillId);
        if (!skill) return;
        const actionDuration = skill.clientEffect.animationDurationSeconds;
        const radians = role.facingAngle * Math.PI / 180;
        if (skill.clientEffect.kind === 'dashBite') this.createDashEffect(node.position.x, node.position.y, role.facingAngle);
        this.createBiteEffect(
          node.position.x + Math.cos(radians) * skill.clientEffect.visualOffset,
          node.position.y,
          role.facingAngle,
          skill.clientEffect.visualRadius,
          new Color(skill.clientEffect.visualColor.r, skill.clientEffect.visualColor.g, skill.clientEffect.visualColor.b, skill.clientEffect.visualColor.a),
          skill.clientEffect.visualDurationSeconds
        );
        this.playRemoteFishAnimation(sprite, this.biteFrames, actionDuration);
        if (skill.clientEffect.kind === 'whaleSwallow') {
          this.applyWhaleSourceVisual(
            role,
            effectDurationMs ?? this.getWhaleEffectDurationMs(),
            () => role.dead ? 0.6 : 1
          );
        }
      },
      playWhaleTarget: (effectDurationMs?: number) => {
        this.applyWhaleOpacity(role, effectDurationMs ?? this.getWhaleEffectDurationMs());
      },
      playHurt: (skillId: string) => {
        const duration = this.getConfiguredNetworkSkill(skillId)?.clientEffect.animationDurationSeconds ?? 0.34;
        this.playRemoteFishAnimation(sprite, this.hurtFrames, duration);
      },
      playDeath: () => {
        role.setDead(true);
        this.remoteAnimationTokens.set(sprite, (this.remoteAnimationTokens.get(sprite) ?? 0) + 1);
        const swimState = this.remoteSwimStates.get(sprite);
        if (swimState) { swimState.active = false; swimState.elapsed = 0; }
      },
      playRespawn: () => {
        role.setDead(false);
        this.stopRemoteFishAnimation(sprite);
        role.setFrame(this.swimFrames[0] ?? null);
      },
      destroy: () => {
        this.remoteSwimStates.delete(sprite);
        this.removeFishHealthDisplay(state.playerId);
        this.removeFishNameDisplay(state.playerId);
        roleManager.remove(state.playerId);
      }
    };
  }

  private getConfiguredNetworkSkill(networkSkillId: string): SkillConfig | undefined {
    try { return this.skillCatalog?.getByNetworkSkillId(networkSkillId); }
    catch { return undefined; }
  }

  private isWhaleSwallowNetworkSkill(networkSkillId: string): boolean {
    return this.getConfiguredNetworkSkill(networkSkillId)?.clientEffect.kind === 'whaleSwallow';
  }

  private getWhaleSkill(): SkillConfig | undefined {
    return this.skillCatalog?.findByClientEffect('whaleSwallow');
  }

  private getWhaleEffectDurationMs(): number {
    return (this.getWhaleSkill()?.effectDurationSeconds ?? 3) * 1000;
  }

  private getWhaleScaleMultiplier(): number {
    return this.getWhaleSkill()?.scaleMultiplier ?? 3;
  }

  private getWhaleOpacityAlpha(): number {
    return Math.round((this.getWhaleSkill()?.opacity ?? 0.5) * 255);
  }

  private applyWhaleSourceVisual(
    player: Player,
    durationMs: number,
    getRestoreScale: () => number
  ): void {
    const durationSeconds = Math.max(0.05, durationMs / 1000);
    const scaleToken = (this.whaleScaleTokens.get(player) ?? 0) + 1;
    this.whaleScaleTokens.set(player, scaleToken);
    player.setVisualScale(this.getWhaleScaleMultiplier());
    this.applyWhaleOpacity(player, durationMs);
    this.scheduleOnce(() => {
      if (!player.node.isValid || this.whaleScaleTokens.get(player) !== scaleToken) return;
      player.restoreVisualScale(getRestoreScale());
    }, durationSeconds);
  }

  private applyWhaleOpacity(player: Player, durationMs: number): void {
    const durationSeconds = Math.max(0.05, durationMs / 1000);
    const opacityToken = (this.whaleOpacityTokens.get(player) ?? 0) + 1;
    this.whaleOpacityTokens.set(player, opacityToken);
    player.setOpacity(this.getWhaleOpacityAlpha());
    this.scheduleOnce(() => {
      if (!player.node.isValid || this.whaleOpacityTokens.get(player) !== opacityToken) return;
      player.setOpacity(255);
    }, durationSeconds);
  }

  private playRemoteFishAnimation(sprite: Sprite, frames: SpriteFrame[], duration: number): void {
    if (frames.length === 0) return;
    const swimState = this.remoteSwimStates.get(sprite);
    if (swimState) { swimState.active = false; swimState.elapsed = 0; }
    const token = (this.remoteAnimationTokens.get(sprite) ?? 0) + 1;
    this.remoteAnimationTokens.set(sprite, token);
    const frameDuration = duration / frames.length;
    frames.forEach((frame, index) => this.scheduleOnce(() => {
      if (sprite.isValid && this.remoteAnimationTokens.get(sprite) === token) sprite.spriteFrame = frame;
    }, index * frameDuration));
    this.scheduleOnce(() => {
      if (sprite.isValid && this.remoteAnimationTokens.get(sprite) === token) {
        sprite.spriteFrame = this.swimFrames[0] ?? null;
        if (swimState) { swimState.frameIndex = 0; swimState.elapsed = 0; swimState.active = true; }
      }
    }, duration);
  }

  private stopRemoteFishAnimation(sprite: Sprite): void {
    this.remoteAnimationTokens.set(sprite, (this.remoteAnimationTokens.get(sprite) ?? 0) + 1);
    const swimState = this.remoteSwimStates.get(sprite);
    if (swimState) { swimState.frameIndex = 0; swimState.elapsed = 0; swimState.active = true; }
  }

  private advanceRemoteSwimAnimations(deltaTime: number): void {
    if (this.swimFrames.length === 0) return;
    for (const [sprite, state] of this.remoteSwimStates) {
      if (!sprite.isValid || !state.active) continue;
      state.elapsed += deltaTime;
      while (state.elapsed >= 0.11) {
        state.elapsed -= 0.11;
        state.frameIndex = (state.frameIndex + 1) % this.swimFrames.length;
        sprite.spriteFrame = this.swimFrames[state.frameIndex] ?? this.swimFrames[0];
      }
    }
  }

  private createFishHealthDisplay(id: string, fish: Node, health: number, maxHealth: number): void {
    if (!this.fishHealthOverlay || !this.healthBarFrame || !this.healthBarFill || this.fishHealthDisplays.has(id)) return;
    const display = new FishHealthBarOverlay(this.fishHealthOverlay, fish, id, this.healthBarFrame, this.healthBarFill);
    this.fishHealthDisplays.set(id, display);
    this.setFishHealth(id, health, maxHealth);
  }

  private setFishHealth(id: string, health: number, maxHealth: number): void {
    const display = this.fishHealthDisplays.get(id);
    if (!display) return;
    display.setHealth(health, maxHealth);
  }

  private removeFishHealthDisplay(id: string): void { const display = this.fishHealthDisplays.get(id); display?.destroy(); this.fishHealthDisplays.delete(id); }

  private createFishNameDisplay(id: string, fish: Node, name: string): void {
    if (!this.fishHealthOverlay || this.fishNameDisplays.has(id)) return;
    const display = new FishNameOverlay(this.fishHealthOverlay, fish, id, name);
    this.fishNameDisplays.set(id, display);
  }

  private setFishName(id: string, name: string): void { this.fishNameDisplays.get(id)?.setName(name); }
  private removeFishNameDisplay(id: string): void { const display = this.fishNameDisplays.get(id); display?.destroy(); this.fishNameDisplays.delete(id); }

  private updateFishHealthDisplays(): void {
    const overlayTransform = this.fishHealthOverlay?.getComponent(UITransform); if (!overlayTransform) return;
    for (const display of this.fishHealthDisplays.values()) display.updatePosition(overlayTransform);
    for (const display of this.fishNameDisplays.values()) display.updatePosition(overlayTransform);
  }

  private async connectOnline(username = this.testUsername): Promise<void> {
    if (this.offlineModeSelected || this.isDestroying) return;
    try {
      const endpoint = resolveNetworkEndpoint();
      const baseUrl = endpoint.httpBaseUrl;
      const runtime = typeof window !== 'undefined' ? window.location.href : 'no-window-runtime';
      this.setConnectionDiagnostic(`runtime=${runtime}\nHTTP=${baseUrl}`);
      const authResponse = await fetch(`${baseUrl}/auth/test-login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username }) });
      if (!authResponse.ok) throw new Error(`AUTH_FAILED status=${authResponse.status}`);
      const auth = await authResponse.json() as { token: string };
      const matchResponse = await fetch(`${baseUrl}/match/join`, { method: 'POST', headers: { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ mapId: 'sea-default-001' }) });
      if (!matchResponse.ok) throw new Error(`MATCH_FAILED status=${matchResponse.status}`);
      this.realtime.onMessage = (message) => this.handleNetworkMessage(message);
      this.realtime.onDiagnostic = (detail) => this.setConnectionDiagnostic(detail);
      this.realtime.onStatus = (status) => {
        if (status === 'open') { this.realtime.join(); this.hideConnectionDialog(); }
        if ((status === 'error' || status === 'closed') && !this.isDestroying && !this.offlineModeSelected) this.showConnectionDialog('在线服务连接已断开');
      };
      this.realtime.connect(endpoint.websocketUrl, auth.token);
      if (this.actionHint) this.actionHint.string = '已连接默认海域';
    } catch (error) { this.setConnectionDiagnostic(`Connection failed: ${error instanceof Error ? error.message : String(error)}`); this.showConnectionDialog('无法连接在线服务'); }
  }

  private setConnectionDiagnostic(detail: string): void { this.connectionDetail = detail; console.warn(`[FishEatFish] ${detail}`); if (this.connectionDetailLabel) this.connectionDetailLabel.string = detail; }

  private showTestLoginDialog(): void {
    const inputLayer = this.mainUi?.inputLayer;
    if (!inputLayer) return;
    if (this.loginDialog?.isOpen) return;
    const isEditorPreview = typeof window !== 'undefined' && window.location.hostname === 'scene';
    this.loginDialog = LoginDialog.open({
      variant: 'test-environment',
      presentation: isEditorPreview || typeof document === 'undefined' ? 'cocos' : 'dom',
      parent: inputLayer,
      title: '测试环境登录',
      description: '输入用户名后进入默认海域',
      placeholder: '用户名（1-16 个字符）',
      submitText: '进入海域',
      initialUsername: this.testUsername,
      maxLength: 16,
      onValidationError: () => { if (this.actionHint) this.actionHint.string = '请输入用户名'; },
      onSubmit: (username) => {
        this.testUsername = username;
        this.setFishName('local-player', username);
        this.loginDialog = undefined;
        void this.connectOnline(username);
      }
    });
  }

  private showConnectionDialog(reason: string): void {
    if (this.offlineModeSelected || this.isDestroying) return;
    this.actionHint && (this.actionHint.string = reason);
    if (this.connectionDialog) { this.connectionDialog.active = true; return; }
    const inputLayer = this.mainUi?.inputLayer;
    if (!inputLayer) return;
    const dialog = new Node('NetworkConnectionDialog'); dialog.layer = inputLayer.layer;
    const dialogTransform = dialog.addComponent(UITransform); dialogTransform.setContentSize(1280, 720); dialogTransform.setAnchorPoint(0.5, 0.5); dialog.addComponent(BlockInputEvents); inputLayer.addChild(dialog); dialog.setPosition(0, 0, 0);
    const shade = dialog.addComponent(Graphics); shade.fillColor = new Color(0, 20, 45, 190); shade.rect(-640, -360, 1280, 720); shade.fill();
    const panel = new Node('ConnectionPanel'); panel.layer = dialog.layer; const panelTransform = panel.addComponent(UITransform); panelTransform.setContentSize(600, 330); panelTransform.setAnchorPoint(0.5, 0.5); const panelGraphics = panel.addComponent(Graphics); panelGraphics.fillColor = new Color(17, 69, 106, 248); panelGraphics.roundRect(-300, -165, 600, 330, 24); panelGraphics.fill(); dialog.addChild(panel);
    const title = this.createDialogLabel(panel, '联网服务不可用', 30, new Color(255, 245, 180, 255), 0, 78);
    title.name = 'ConnectionTitle';
    this.createDialogLabel(panel, '可继续尝试连接，或进入本地单机模式。', 20, new Color(230, 245, 255, 255), 0, 30);
    const detailNode = this.createDialogLabel(panel, this.connectionDetail || reason, 14, new Color(180, 225, 255, 255), 0, -18); const detailLabel = detailNode.getComponent(Label); if (detailLabel) { detailLabel.overflow = Label.Overflow.SHRINK; this.connectionDetailLabel = detailLabel; }
    const retry = this.createDialogButton(panel, '重新连接', -115, -112, () => { this.hideConnectionDialog(); this.realtime.close(); void this.connectOnline(); });
    const offline = this.createDialogButton(panel, '本地单机游玩', 115, -112, () => { this.offlineModeSelected = true; this.realtime.close(); this.hideConnectionDialog(); if (this.actionHint) this.actionHint.string = '当前为本地单机模式'; });
    retry.name = 'RetryConnectionButton'; offline.name = 'OfflineModeButton'; this.connectionDialog = dialog;
  }

  private hideConnectionDialog(): void { if (this.connectionDialog) this.connectionDialog.active = false; }

  private createDialogLabel(parent: Node, text: string, fontSize: number, color: Color, x: number, y: number): Node {
    const node = new Node('DialogLabel'); node.layer = parent.layer; const transform = node.addComponent(UITransform); transform.setContentSize(460, 42); transform.setAnchorPoint(0.5, 0.5); const label = node.addComponent(Label); label.string = text; label.fontSize = fontSize; label.lineHeight = fontSize + 8; label.horizontalAlign = Label.HorizontalAlign.CENTER; label.color = color; parent.addChild(node); node.setPosition(x, y, 0); return node;
  }

  private createDialogButton(parent: Node, text: string, x: number, y: number, action: () => void): Node {
    const node = new Node(`DialogButton-${text}`); node.layer = parent.layer; const transform = node.addComponent(UITransform); transform.setContentSize(190, 64); transform.setAnchorPoint(0.5, 0.5); const graphics = node.addComponent(Graphics); graphics.fillColor = new Color(36, 153, 200, 255); graphics.roundRect(-95, -32, 190, 64, 16); graphics.fill(); parent.addChild(node); node.setPosition(x, y, 0); this.createDialogLabel(node, text, 20, new Color(255, 255, 255, 255), 0, 0); this.bindActionButton(node, action); return node;
  }

  private handleNetworkMessage(message: NetworkMessage): void {
    if (message.type === 'roomSnapshot') {
      const snapshot = message.payload as { selfPlayerId?: string; players: RemotePlayerState[] };
      this.networkPlayerId = snapshot.selfPlayerId;
      const self = snapshot.players.find((player) => player.playerId === this.networkPlayerId);
      if (self) this.setFishName('local-player', self.displayName);
      this.applyRemotePlayers(snapshot.players);
      if (self) this.applyLocalSnapshotAction(self);
    } else if (message.type === 'stateSnapshot') {
      const snapshot = message.payload as { players: RemotePlayerState[] };
      this.applyRemotePlayers(snapshot.players);
      const self = snapshot.players.find((player) => player.playerId === this.networkPlayerId);
      if (self) this.applyLocalSnapshotAction(self);
    } else if (message.type === 'playerJoined') {
      const player = message.payload as RemotePlayerState;
      if (player.playerId !== this.networkPlayerId) this.remotePlayers?.upsert(player);
    } else if (message.type === 'playerRemoved') {
      this.remotePlayers?.remove((message.payload as { playerId: string }).playerId);
    } else if (message.type === 'skillEffect') {
      const effect = message.payload as SkillEffect;
      if (this.isWhaleSwallowNetworkSkill(effect.skillId)) this.handleWhaleSwallowEffect(effect);
      else if (effect.playerId !== this.networkPlayerId) {
        this.remotePlayers?.setTransform(effect.playerId, effect.x, effect.y, effect.rotation);
        this.remotePlayers?.playSkill(effect.playerId, effect.skillId, effect.actionSequence);
      }
    } else if (message.type === 'skillResolved') {
      const result = message.payload as SkillResolved;
      if (result.playerId === this.networkPlayerId && this.actionHint) {
        if (this.isWhaleSwallowNetworkSkill(result.skillId) && result.reason === 'noTarget') {
          this.skillPanel?.cancelCooldownForNetworkSkill(result.skillId);
          this.actionHint.string = '鲸吞范围内没有可用目标';
        } else if (!result.reason && this.isWhaleSwallowNetworkSkill(result.skillId)) this.actionHint.string = `鲸吞已锁定目标，效果持续 ${this.getWhaleEffectDurationMs() / 1000} 秒`;
        else if (!result.reason) this.actionHint.string = result.hitCount > 0 ? `命中 ${result.hitCount} 名玩家` : '未命中：靠近并面向对方后再撕咬';
        else if (result.reason === 'cooldown') this.actionHint.string = '技能冷却中';
        else if (result.reason === 'dead') this.actionHint.string = '死亡期间不能攻击';
        else this.actionHint.string = '攻击输入已过期，请重新释放';
      }
    } else if (message.type === 'playerDamaged') {
      const event = message.payload as PlayerDamaged;
      if (event.targetId === this.networkPlayerId) { this.localPlayer?.setHealth(event.health, event.maxHealth); this.updateHealthHud(); this.actionHint && (this.actionHint.string = `受到撕咬伤害：${event.damage}，生命 ${event.health}/${event.maxHealth}`); this.startFishAction('hurt', this.getConfiguredNetworkSkill(event.skillId)?.clientEffect.animationDurationSeconds ?? 0.34); }
      else { this.remotePlayers?.setHealth(event.targetId, event.health, event.maxHealth); this.remotePlayers?.playHurt(event.targetId, event.skillId); }
    } else if (message.type === 'playerDied') {
      const event = message.payload as PlayerDied;
      if (event.targetId === this.networkPlayerId) { this.localPlayer?.setDead(true); this.actionHint && (this.actionHint.string = '你已被击败，3 秒后复活'); }
      else this.remotePlayers?.playDeath(event.targetId);
    } else if (message.type === 'playerRespawned') {
      const event = message.payload as PlayerRespawned;
      if (event.playerId === this.networkPlayerId) { this.localPlayer?.setDead(false); this.localPlayer?.setHealth(event.health, event.maxHealth); this.updateHealthHud(); this.localPlayer?.setPosition(event.x, event.y); this.actionHint && (this.actionHint.string = '已复活，3 秒无敌'); }
      else { this.remotePlayers?.upsert({ playerId: event.playerId, displayName: '远端玩家', x: event.x, y: event.y, rotation: 0, lastProcessedClientTick: 0, health: event.health, maxHealth: event.maxHealth, level: 1, dead: false }); this.remotePlayers?.playRespawn(event.playerId); }
    } else if (message.type === 'combatSettlement') {
      const event = message.payload as CombatSettlement;
      if (event.playerId === this.networkPlayerId) { this.localPlayer?.setHealth(event.health, event.maxHealth); this.updateHealthHud(); this.actionHint && (this.actionHint.string = event.leveled ? `击败玩家，升级至 ${event.level} 级，生命上限 ${event.maxHealth}` : `击败玩家，获得经验，击杀 ${event.kills}`); }
    } else if (message.type === 'stateCorrection') {
      const state = message.payload as RemotePlayerState;
      if (state.playerId === this.networkPlayerId) {
        this.localPlayer?.setHealth(state.health, state.maxHealth);
        this.localPlayer?.setDead(state.dead);
        this.updateHealthHud();
        this.localPlayer?.setPosition(state.x, state.y);
        this.localPlayer?.setFacing(state.rotation, state.dead ? 0.6 : undefined);
        this.applyLocalSnapshotAction(state);
      }
    }
  }

  private applyRemotePlayers(players: RemotePlayerState[]): void {
    const seen = new Set<string>();
    for (const player of players) {
      if (player.playerId === this.networkPlayerId) continue;
      seen.add(player.playerId);
      const targetsLocalPlayer = player.action !== undefined && this.isWhaleSwallowNetworkSkill(player.action) && player.actionTargetId === this.networkPlayerId;
      this.remotePlayers?.upsert(targetsLocalPlayer ? { ...player, actionTargetId: undefined } : player);
      if (
        targetsLocalPlayer
        && player.actionSequence !== undefined
        && player.actionSequence > (this.localWhaleTargetSequences.get(player.playerId) ?? 0)
      ) {
        this.localWhaleTargetSequences.set(player.playerId, player.actionSequence);
        if (this.localPlayer) this.applyWhaleOpacity(this.localPlayer, player.actionRemainingMs ?? this.getWhaleEffectDurationMs());
      }
    }
    for (const id of this.remotePlayers?.ids() ?? []) if (!seen.has(id)) this.remotePlayers?.remove(id);
  }

  private handleWhaleSwallowEffect(effect: SkillEffect): void {
    const durationMs = effect.effectDurationMs ?? this.getWhaleEffectDurationMs();
    if (effect.playerId === this.networkPlayerId) {
      if (effect.actionSequence <= this.localActionSequence) return;
      this.localActionSequence = effect.actionSequence;
      this.localPlayer?.setPosition(effect.x, effect.y);
      this.startFishAction('whaleSwallow', this.getConfiguredNetworkSkill(effect.skillId)?.clientEffect.animationDurationSeconds ?? 0.42);
      if (this.localPlayer) {
        this.applyWhaleSourceVisual(
          this.localPlayer,
          durationMs,
          () => this.localPlayer?.dead ? 0.6 : 1
        );
      }
      if (effect.targetId && effect.targetId !== this.networkPlayerId) this.remotePlayers?.playWhaleTarget(effect.targetId, durationMs);
      return;
    }

    this.remotePlayers?.setTransform(effect.playerId, effect.x, effect.y, effect.rotation);
    this.remotePlayers?.playSkill(
      effect.playerId,
      effect.skillId,
      effect.actionSequence,
      effect.targetId === this.networkPlayerId ? undefined : effect.targetId,
      durationMs
    );
    if (
      effect.targetId === this.networkPlayerId
      && effect.actionSequence > (this.localWhaleTargetSequences.get(effect.playerId) ?? 0)
    ) {
      this.localWhaleTargetSequences.set(effect.playerId, effect.actionSequence);
      if (this.localPlayer) this.applyWhaleOpacity(this.localPlayer, durationMs);
    }
  }

  private applyLocalSnapshotAction(state: RemotePlayerState): void {
    if (
      state.action === undefined
      || !this.isWhaleSwallowNetworkSkill(state.action)
      || state.actionSequence === undefined
      || state.actionSequence <= this.localActionSequence
    ) return;
    this.localActionSequence = state.actionSequence;
    const durationMs = state.actionRemainingMs ?? this.getWhaleEffectDurationMs();
    this.startFishAction('whaleSwallow', this.getWhaleSkill()?.clientEffect.animationDurationSeconds ?? 0.42);
    if (this.localPlayer) {
      this.applyWhaleSourceVisual(
        this.localPlayer,
        durationMs,
        () => this.localPlayer?.dead ? 0.6 : 1
      );
    }
    if (state.actionTargetId && state.actionTargetId !== this.networkPlayerId) {
      this.remotePlayers?.playWhaleTarget(state.actionTargetId, durationMs);
    }
  }

  private createControlHint(hudRoot: Node): void {
    const hintNode = new Node('ControlHint');
    hintNode.layer = hudRoot.layer;
    const transform = hintNode.addComponent(UITransform);
    transform.setContentSize(720, 48);
    transform.setAnchorPoint(0, 1);
    const label = hintNode.addComponent(Label);
    this.actionHint = label;
    label.string = 'WASD / 方向键，或在屏幕左侧拖动游泳';
    label.fontSize = 25;
    label.lineHeight = 32;
    label.color = new Color(255, 255, 255, 230);
    hudRoot.addChild(hintNode);
    hintNode.setPosition(28, 690, 0);
    const healthNode = new Node('HealthLabel'); const healthTransform = healthNode.addComponent(UITransform); healthTransform.setContentSize(260, 36); this.healthLabel = healthNode.addComponent(Label); this.healthLabel.fontSize = 22; this.healthLabel.color = new Color(255, 245, 180, 245); hudRoot.addChild(healthNode); healthNode.setPosition(28, 648, 0); this.updateHealthHud();
  }

  private updateHealthHud(): void {
    const player = this.localPlayer;
    if (!player) return;
    if (this.healthLabel) this.healthLabel.string = `生命 ${Math.max(0, Math.ceil(player.health))}/${player.maxHealth}`;
    this.setFishHealth('local-player', player.health, player.maxHealth);
  }

  private createSkillEffectExecutor(): SkillEffectExecutor {
    return new SkillEffectExecutor({
      canActivate: () => Boolean(this.localPlayer) && !this.localPlayer?.dead,
      isOfflineMode: () => this.offlineModeSelected,
      getPlayerPosition: () => this.localPlayer ? { x: this.localPlayer.node.position.x, y: this.localPlayer.node.position.y } : undefined,
      getFacingAngle: () => this.localPlayer?.facingAngle ?? 180,
      startAction: (state, duration) => this.startFishAction(state, duration),
      createBiteEffect: (x, y, angle, radius, color, duration) => this.createBiteEffect(x, y, angle, radius, new Color(color.r, color.g, color.b, color.a), duration),
      createDashEffect: (x, y, angle) => this.createDashEffect(x, y, angle),
      moveDash: (distance, angle) => this.moveDash(distance, angle),
      sendSkill: (networkSkillId) => this.sendSkillEvent(networkSkillId),
      showHint: (text) => { if (this.actionHint) this.actionHint.string = text; }
    });
  }

  private moveDash(distance: number, angle: number): Vec2Value {
    const player = this.localPlayer;
    if (!player) return { x: 0, y: 0 };
    const start = player.node.position;
    const next = moveWithinBounds(
      { x: start.x, y: start.y },
      { x: Math.cos(angle * Math.PI / 180), y: Math.sin(angle * Math.PI / 180) },
      distance,
      1,
      {
        minX: -GameBootstrap.WORLD_WIDTH / 2 + GameBootstrap.PLAYER_MARGIN,
        maxX: GameBootstrap.WORLD_WIDTH / 2 - GameBootstrap.PLAYER_MARGIN,
        minY: -GameBootstrap.WORLD_HEIGHT / 2 + GameBootstrap.PLAYER_MARGIN,
        maxY: GameBootstrap.WORLD_HEIGHT / 2 - GameBootstrap.PLAYER_MARGIN
      }
    );
    player.setPosition(next.x, next.y);
    this.followPlayer(next.x, next.y);
    return next;
  }

  private sendSkillEvent(skillId: string): void {
    const player = this.localPlayer;
    if (!player) return;
    const position = player.node.position;
    // 服务端只信任它保存的朝向。技能前先发送当前朝向，确保快速转向后立即撕咬不会按旧朝向判定。
    this.realtime.sendInput({ clientTick: ++this.networkClientTick, moveX: 0, moveY: 0, rotation: player.facingAngle });
    this.realtime.sendSkill({ skillId: skillId as SkillId, clientTick: ++this.networkClientTick, x: position.x, y: position.y, rotation: player.facingAngle });
  }

  private startFishAction(state: 'bite' | 'dashBite' | 'whaleSwallow' | 'hurt', duration: number): void {
    this.fishActionState = state;
    this.fishActionElapsed = 0;
    this.fishActionDuration = duration;
    const frames = state === 'hurt' ? this.hurtFrames : this.biteFrames;
    if (this.localPlayer && frames.length > 0) this.localPlayer.setFrame(frames[0]);
  }

  private updateFishAction(deltaTime: number): void {
    if (!this.localPlayer || this.fishActionState === 'swim') return;
    this.fishActionElapsed += deltaTime;
    const progress = Math.min(1, this.fishActionElapsed / this.fishActionDuration);
    const frames = this.fishActionState === 'hurt' ? this.hurtFrames : this.biteFrames;
    const index = Math.min(frames.length - 1, Math.floor(progress * frames.length));
    if (index >= 0) this.localPlayer.setFrame(frames[index] ?? this.swimFrames[this.swimFrameIndex]);
    if (progress >= 1) {
      this.fishActionState = 'swim';
      this.fishActionElapsed = 0;
      this.fishActionDuration = 0;
      this.localPlayer.setFrame(this.swimFrames[this.swimFrameIndex] ?? null);
    }
  }

  private createBiteEffect(x: number, y: number, angle: number, radius: number, color: Color, duration: number): void {
    const node = new Node('BiteEffect');
    node.layer = this.node.layer;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(radius * 2, radius * 2);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = color;
    graphics.moveTo(0, 0);
    graphics.arc(0, 0, radius, -0.58, 0.58, false);
    graphics.close();
    graphics.fill();
    this.node.getChildByName('WorldRoot')?.addChild(node);
    node.setPosition(x, y, 0);
    node.angle = angle;
    tween(node).to(duration, { scale: new Vec3(1.25, 1.25, 1) }).call(() => node.destroy()).start();
  }

  private createDashEffect(x: number, y: number, angle: number): void {
    const node = new Node('DashEffect');
    node.layer = this.node.layer;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(180, 100);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(90, 220, 255, 150);
    graphics.ellipse(0, 0, 82, 34);
    graphics.fill();
    this.node.getChildByName('WorldRoot')?.addChild(node);
    node.setPosition(x, y, 0);
    node.angle = angle;
    tween(node).to(0.3, { scale: new Vec3(1.5, 0.55, 1) }).call(() => node.destroy()).start();
  }

  private bindActionButton(node: Node, action: () => void): void {
    node.on(Node.EventType.TOUCH_START, () => node.setScale(0.92, 0.92, 1));
    node.on(Node.EventType.TOUCH_END, () => { node.setScale(1, 1, 1); action(); });
    node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(1, 1, 1));
  }

  private bindInput(): void {
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
  }

  private unbindInput(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
  }

  private readonly onKeyDown = (event: EventKeyboard): void => {
    this.pressedKeys.add(event.keyCode);
  };

  private readonly onKeyUp = (event: EventKeyboard): void => {
    this.pressedKeys.delete(event.keyCode);
  };

  private readonly onJoystickTouchStart = (event: EventTouch): void => {
    if (this.joystickTouchId !== null) return;
    const location = event.getUILocation();
    this.joystickTouchId = event.getID();
    this.joystickOrigin.set(location.x, location.y);
    this.joystickDirection.set(0, 0);
    this.joystickKnob?.setPosition(110, 110, 0);
  };

  private readonly onJoystickTouchMove = (event: EventTouch): void => {
    if (event.getID() !== this.joystickTouchId) return;
    const location = event.getUILocation();
    this.joystickDirection.set(
      (location.x - this.joystickOrigin.x) / GameBootstrap.JOYSTICK_RADIUS,
      (location.y - this.joystickOrigin.y) / GameBootstrap.JOYSTICK_RADIUS
    );
    if (this.joystickDirection.length() > 1) this.joystickDirection.normalize();
    this.joystickKnob?.setPosition(
      110 + this.joystickDirection.x * GameBootstrap.JOYSTICK_RADIUS * 0.55,
      110 + this.joystickDirection.y * GameBootstrap.JOYSTICK_RADIUS * 0.55,
      0
    );
  };

  private readonly onJoystickTouchEnd = (event: EventTouch): void => {
    if (event.getID() !== this.joystickTouchId) return;
    this.joystickTouchId = null;
    this.joystickDirection.set(0, 0);
    this.joystickKnob?.setPosition(110, 110, 0);
  };

  private readKeyboardDirection(): Vec2 {
    const left = this.pressedKeys.has(KeyCode.KEY_A) || this.pressedKeys.has(KeyCode.ARROW_LEFT);
    const right = this.pressedKeys.has(KeyCode.KEY_D) || this.pressedKeys.has(KeyCode.ARROW_RIGHT);
    const up = this.pressedKeys.has(KeyCode.KEY_W) || this.pressedKeys.has(KeyCode.ARROW_UP);
    const down = this.pressedKeys.has(KeyCode.KEY_S) || this.pressedKeys.has(KeyCode.ARROW_DOWN);
    return new Vec2(Number(right) - Number(left), Number(up) - Number(down));
  }

  private advanceSwimAnimation(deltaTime: number, moving: boolean): void {
    if (!this.localPlayer || this.swimFrames.length === 0 || this.fishActionState !== 'swim') return;
    this.animationElapsed += deltaTime;
    const frameDuration = moving ? 0.11 : 0.22;
    while (this.animationElapsed >= frameDuration) {
      this.animationElapsed -= frameDuration;
      this.swimFrameIndex = (this.swimFrameIndex + 1) % this.swimFrames.length;
      this.localPlayer.setFrame(this.swimFrames[this.swimFrameIndex]);
    }
  }

  private followPlayer(playerX: number, playerY: number): void {
    if (!this.cameraNode || !this.hudRoot) return;
    const cameraX = Math.min(1280, Math.max(-1280, playerX));
    const cameraY = Math.min(720, Math.max(-720, playerY));
    this.cameraNode.setPosition(cameraX, cameraY, 1000);
    // MainCamera 同时承担 Canvas 渲染；HUD 与相机是 Canvas 下不同分支，
    // 使用相同的局部 XY 即可保持屏幕固定，不能混入 Canvas 的半屏锚点偏移。
    this.hudRoot.setPosition(cameraX, cameraY, 0);
  }

  private loadImage(path: string): Promise<ImageAsset> {
    return new Promise((resolve, reject) => {
      resources.load(path, ImageAsset, (error, image) => {
        if (error || !image) reject(error ?? new Error(`无法加载图片：${path}`));
        else resolve(image);
      });
    });
  }

  private loadJson(path: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      resources.load(path, JsonAsset, (error, asset) => {
        if (error || !asset) reject(error ?? new Error(`无法加载配置：${path}`));
        else resolve(asset.json);
      });
    });
  }

  private createSpriteFrame(image: ImageAsset): SpriteFrame {
    const texture = new Texture2D();
    texture.image = image;
    const spriteFrame = new SpriteFrame();
    spriteFrame.texture = texture;
    return spriteFrame;
  }

  private createFishSpriteFrame(image: ImageAsset, sourceFacingDirection: ArtFacingDirection): SpriteFrame {
    const spriteFrame = this.createSpriteFrame(image);
    spriteFrame.flipUVX = shouldFlipArtFrame(sourceFacingDirection, this.artFacingDirection);
    return spriteFrame;
  }
}
