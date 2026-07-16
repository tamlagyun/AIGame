import {
  _decorator,
  BlockInputEvents,
  Color,
  Component,
  EditBox,
  EventKeyboard,
  EventTouch,
  ImageAsset,
  input,
  Input,
  JsonAsset,
  KeyCode,
  Label,
  LabelOutline,
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
  Widget,
  tween
} from 'cc';
import { horizontalFacingAngleDegrees, horizontalScaleForFacing, moveWithinBounds, normalizeHorizontalFacingAngle, shouldFlipArtFrame, type HorizontalFacingAngle } from '../core/MovementSystem.ts';
import type { ArtFacingDirection } from '../core/types.ts';
import { parseFishConfig } from '../data/ConfigValidator.ts';
import { createPlatformService } from '../platform/PlatformAdapters.ts';
import { RealtimeSession } from '../network/RealtimeSession.ts';
import { RemotePlayerRegistry } from '../network/RemotePlayerRegistry.ts';
import { resolveNetworkEndpoint } from '../network/NetworkEnvironment.ts';
import type { NetworkMessage, RemotePlayerState, SkillEffect, SkillResolved, PlayerDamaged, PlayerDied, PlayerRespawned, CombatSettlement, SkillId } from '../network/NetworkProtocol.ts';

const { ccclass } = _decorator;
type SkillCooldownKey = 'dash' | 'whale';

@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
  private static readonly WORLD_WIDTH = 3840;
  private static readonly WORLD_HEIGHT = 2160;
  private static readonly PLAYER_SPEED = 260;
  private static readonly PLAYER_MARGIN = 96;
  private static readonly JOYSTICK_RADIUS = 120;
  private static readonly ACTION_CONTROLS_WIDTH = 450;
  private static readonly ACTION_CONTROLS_HEIGHT = 340;
  private static readonly BASIC_ATTACK_CENTER = new Vec2(350, 104);
  private static readonly SKILL_ARC_RADIUS = 176;
  private static readonly SKILL_ARC_ANGLES = [190, 155, 120, 85] as const;
  private static readonly DASH_SKILL_COOLDOWN_SECONDS = 5;
  private static readonly WHALE_SKILL_COOLDOWN_SECONDS = 8;
  private static readonly WHALE_EFFECT_DURATION_MS = 3000;
  private static readonly SKILL_COOLDOWN_START = 0.25;

  private removePauseListener?: () => void;
  private removeResumeListener?: () => void;
  private playerNode?: Node;
  private playerSprite?: Sprite;
  private playerFacingAngle: HorizontalFacingAngle = 180;
  private artFacingDirection!: ArtFacingDirection;
  private cameraNode?: Node;
  private hudRoot?: Node;
  private actionHint?: Label;
  private healthLabel?: Label;
  private fishHealthOverlay?: Node;
  private readonly fishHealthDisplays = new Map<string, { fish: Node; node: Node; fill: Sprite; label: Label }>();
  private readonly fishNameDisplays = new Map<string, { fish: Node; node: Node; label: Label }>();
  private readonly skillCooldownRemaining: Record<SkillCooldownKey, number> = { dash: 0, whale: 0 };
  private readonly skillCooldownMasks: Array<{ sprite: Sprite; key: SkillCooldownKey }> = [];
  private basicCooldownRemaining = 0;
  private joystickKnob?: Node;
  private joystickNode?: Node;
  private swimFrames: SpriteFrame[] = [];
  private biteFrames: SpriteFrame[] = [];
  private hurtFrames: SpriteFrame[] = [];
  private healthBarFrame?: SpriteFrame;
  private healthBarFill?: SpriteFrame;
  private readonly remoteAnimationTokens = new WeakMap<Sprite, number>();
  private readonly remoteSwimStates = new Map<Sprite, { frameIndex: number; elapsed: number; active: boolean }>();
  private readonly fishVisualScales = new WeakMap<Node, number>();
  private readonly whaleOpacityTokens = new WeakMap<Sprite, number>();
  private readonly whaleScaleTokens = new WeakMap<Node, number>();
  private readonly localWhaleTargetSequences = new Map<string, number>();
  private localActionSequence = 0;
  private swimFrameIndex = 0;
  private animationElapsed = 0;
  private fishActionState: 'swim' | 'bite' | 'dashBite' | 'hurt' = 'swim';
  private fishActionElapsed = 0;
  private fishActionDuration = 0;
  private localHealth = 100;
  private localMaxHealth = 100;
  private localDead = false;
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
  private loginDom?: HTMLElement;
  private loginDialog?: Node;
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
    this.remoteSwimStates.clear();
    this.skillCooldownMasks.length = 0;
    this.localWhaleTargetSequences.clear();
    this.fishHealthDisplays.clear();
    this.fishNameDisplays.clear();
    this.loginDom?.remove();
  }

  protected update(deltaTime: number): void {
    if (!this.playerNode || !this.playerSprite || !this.cameraNode) return;
    this.skillCooldownRemaining.dash = Math.max(0, this.skillCooldownRemaining.dash - deltaTime);
    this.skillCooldownRemaining.whale = Math.max(0, this.skillCooldownRemaining.whale - deltaTime);
    this.updateSkillCooldownMasks();
    this.basicCooldownRemaining = Math.max(0, this.basicCooldownRemaining - deltaTime);
    this.updateFishAction(deltaTime);
    this.advanceRemoteSwimAnimations(deltaTime);
    if (this.loginDialog || this.loginDom) { this.updateFishHealthDisplays(); return; }
    if (this.localDead) { this.updateFishHealthDisplays(); return; }

    const keyboard = this.readKeyboardDirection();
    const direction = {
      x: keyboard.x + this.joystickDirection.x,
      y: keyboard.y + this.joystickDirection.y
    };
    const moving = Math.hypot(direction.x, direction.y) > 0.01;
    const current = this.playerNode.position;
    const next = moveWithinBounds(
      { x: current.x, y: current.y },
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
    this.playerNode.setPosition(next.x, next.y, 0);

    this.playerFacingAngle = horizontalFacingAngleDegrees(direction, this.playerFacingAngle);
    this.applyHorizontalFacing(this.playerNode, this.playerFacingAngle);
    this.advanceSwimAnimation(deltaTime, moving);
    this.followPlayer(next.x, next.y);
    this.updateFishHealthDisplays();
    this.networkInputElapsed += deltaTime;
    if (this.networkInputElapsed >= 0.05) {
      this.networkInputElapsed = 0;
      this.realtime.sendInput({ clientTick: ++this.networkClientTick, moveX: direction.x, moveY: direction.y, rotation: this.playerFacingAngle });
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
    const playerFishConfig = parseFishConfig(await this.loadJson('configs/fish-player'));
    this.artFacingDirection = playerFishConfig.artFacingDirection;
    // WorldRoot、HudRoot 和 MainCamera 共用 Canvas 中心作为局部原点。
    // Canvas 的锚点换算由引擎负责，子根节点不得再次减去半屏尺寸。
    this.hudRoot.setPosition(0, 0, 0);
    const safeArea = this.hudRoot.getChildByName('SafeAreaRoot');
    const inputLayer = safeArea?.getChildByName('InputLayer');
    if (inputLayer) {
      const uiTransform = inputLayer.getComponent(UITransform) ?? inputLayer.addComponent(UITransform);
      uiTransform.setAnchorPoint(0.5, 0.5);
      uiTransform.setContentSize(1280, 720);
      inputLayer.setPosition(0, 0, 0);
      this.fishHealthOverlay = this.createUiContainer(inputLayer, 'FishHealthOverlay', 1280, 720);
      this.fishHealthOverlay.getComponent(UITransform)?.setAnchorPoint(0.5, 0.5);
      this.fishHealthOverlay.setPosition(0, 0, 0);
    }

    const [backgroundImage, ...images] = await Promise.all([
      this.loadImage('art/map/sea-background'),
      ...Array.from({ length: 6 }, (_, index) => this.loadImage(`art/characters/player/swim-${index}`)),
      ...Array.from({ length: 8 }, (_, index) => this.loadImage(`art/characters/player/bite-${index}`)),
      ...Array.from({ length: 8 }, (_, index) => this.loadImage(`art/characters/player/hurt-${index}`)),
      this.loadImage('art/ui/joystick-base'),
      this.loadImage('art/ui/joystick-knob'),
      this.loadImage('art/ui/basic-attack'),
      this.loadImage('art/ui/skill-dash'),
      this.loadImage('art/ui/skill-whale-swallow'),
      this.loadImage('art/ui/health-bar-frame'),
      this.loadImage('art/ui/health-bar-fill')
    ]);
    const fishImages = images.slice(0, 6);
    const biteImages = images.slice(6, 14);
    const hurtImages = images.slice(14, 22);
    const [joystickBase, joystickKnob, basicAttack, skillDash, skillWhaleSwallow, healthBarFrame, healthBarFill] = images.slice(22);

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
    this.playerNode = new Node('PlayerFish');
    this.playerNode.layer = playerLayer.layer;
    const playerTransform = this.playerNode.addComponent(UITransform);
    playerTransform.setContentSize(196, 196);
    this.playerSprite = this.playerNode.addComponent(Sprite);
    this.playerSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.playerSprite.spriteFrame = this.swimFrames[0];
    playerLayer.addChild(this.playerNode);
    this.applyHorizontalFacing(this.playerNode, this.playerFacingAngle);
    this.createFishHealthDisplay('local-player', this.playerNode, this.localHealth, this.localMaxHealth);
    this.createFishNameDisplay('local-player', this.playerNode, '');
    this.remotePlayers = new RemotePlayerRegistry((state) => this.createRemotePlayerView(playerLayer, state));

    this.createControlHint(this.hudRoot);
    this.createCombatUi(this.hudRoot, joystickBase, joystickKnob, basicAttack, skillDash, skillWhaleSwallow);
  }

  private createRemotePlayerView(parent: Node, state: RemotePlayerState) {
    const node = new Node(`RemotePlayer-${state.playerId}`);
    node.layer = parent.layer;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(196, 196);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = this.swimFrames[0];
    parent.addChild(node);
    this.remoteSwimStates.set(sprite, { frameIndex: 0, elapsed: 0, active: true });
    let facingAngle = normalizeHorizontalFacingAngle(state.rotation);
    let dead = state.dead;
    this.applyHorizontalFacing(node, facingAngle);
    this.createFishHealthDisplay(state.playerId, node, state.health, state.maxHealth);
    this.createFishNameDisplay(state.playerId, node, state.displayName);
    return {
      setPosition: (x: number, y: number) => node.setPosition(x, y, 0),
      setRotation: (angle: number) => {
        facingAngle = normalizeHorizontalFacingAngle(angle);
        this.applyHorizontalFacing(node, facingAngle);
      },
      setHealth: (health: number, maxHealth: number) => this.setFishHealth(state.playerId, health, maxHealth),
      playSkill: (skillId: SkillId, effectDurationMs?: number) => {
        const actionDuration = skillId === 'skill-dash-bite' || skillId === 'skill-whale-swallow' ? 0.42 : 0.34;
        const radians = facingAngle * Math.PI / 180;
        if (skillId === 'skill-dash-bite') this.createDashEffect(node.position.x, node.position.y, facingAngle);
        this.createBiteEffect(
          node.position.x + Math.cos(radians) * 76,
          node.position.y,
          facingAngle,
          skillId === 'skill-basic-bite' ? 72 : 96,
          skillId === 'skill-basic-bite' ? new Color(255, 236, 120, 235) : new Color(120, 230, 255, 235),
          actionDuration
        );
        this.playRemoteFishAnimation(sprite, this.biteFrames, actionDuration);
        if (skillId === 'skill-whale-swallow') {
          this.applyWhaleSourceVisual(
            node,
            sprite,
            () => facingAngle,
            effectDurationMs ?? GameBootstrap.WHALE_EFFECT_DURATION_MS,
            () => dead ? 0.6 : 1
          );
        }
      },
      playWhaleTarget: (effectDurationMs?: number) => {
        this.applyWhaleOpacity(sprite, effectDurationMs ?? GameBootstrap.WHALE_EFFECT_DURATION_MS);
      },
      playHurt: (skillId: string) => {
        const duration = skillId === 'skill-dash-bite' ? 0.42 : 0.34;
        this.playRemoteFishAnimation(sprite, this.hurtFrames, duration);
      },
      playDeath: () => {
        dead = true;
        this.remoteAnimationTokens.set(sprite, (this.remoteAnimationTokens.get(sprite) ?? 0) + 1);
        const swimState = this.remoteSwimStates.get(sprite);
        if (swimState) { swimState.active = false; swimState.elapsed = 0; }
        node.active = true;
        this.applyHorizontalFacing(node, facingAngle, 0.6);
      },
      playRespawn: () => {
        dead = false;
        this.stopRemoteFishAnimation(sprite);
        sprite.spriteFrame = this.swimFrames[0] ?? null;
        node.active = true;
        this.applyHorizontalFacing(node, facingAngle);
      },
      destroy: () => {
        this.remoteSwimStates.delete(sprite);
        this.removeFishHealthDisplay(state.playerId);
        this.removeFishNameDisplay(state.playerId);
        node.destroy();
      }
    };
  }

  private applyHorizontalFacing(node: Node, angle: HorizontalFacingAngle, scale?: number): void {
    const effectiveScale = scale ?? this.fishVisualScales.get(node) ?? 1;
    node.angle = 0;
    // 所有动画帧加载时已归一到配置的默认美术方向；这里只处理逻辑朝向。
    node.setScale(horizontalScaleForFacing(angle, this.artFacingDirection, effectiveScale), effectiveScale, 1);
  }

  private applyWhaleSourceVisual(
    node: Node,
    sprite: Sprite,
    getFacingAngle: () => HorizontalFacingAngle,
    durationMs: number,
    getRestoreScale: () => number
  ): void {
    const durationSeconds = Math.max(0.05, durationMs / 1000);
    const scaleToken = (this.whaleScaleTokens.get(node) ?? 0) + 1;
    this.whaleScaleTokens.set(node, scaleToken);
    this.fishVisualScales.set(node, 3);
    this.applyHorizontalFacing(node, getFacingAngle());
    this.applyWhaleOpacity(sprite, durationMs);
    this.scheduleOnce(() => {
      if (!node.isValid || this.whaleScaleTokens.get(node) !== scaleToken) return;
      this.fishVisualScales.delete(node);
      this.applyHorizontalFacing(node, getFacingAngle(), getRestoreScale());
    }, durationSeconds);
  }

  private applyWhaleOpacity(sprite: Sprite, durationMs: number): void {
    const durationSeconds = Math.max(0.05, durationMs / 1000);
    const opacityToken = (this.whaleOpacityTokens.get(sprite) ?? 0) + 1;
    this.whaleOpacityTokens.set(sprite, opacityToken);
    const current = sprite.color;
    sprite.color = new Color(current.r, current.g, current.b, 128);
    this.scheduleOnce(() => {
      if (!sprite.isValid || this.whaleOpacityTokens.get(sprite) !== opacityToken) return;
      const color = sprite.color;
      sprite.color = new Color(color.r, color.g, color.b, 255);
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
    const node = new Node(`FishHealth-${id}`);
    node.layer = this.fishHealthOverlay.layer;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(176, 48);
    transform.setAnchorPoint(0.5, 0.5);
    this.fishHealthOverlay.addChild(node);

    const frameNode = new Node('HealthBarFrame');
    frameNode.layer = node.layer;
    const frameTransform = frameNode.addComponent(UITransform);
    frameTransform.setContentSize(168, 44);
    frameTransform.setAnchorPoint(0.5, 0.5);
    const frame = frameNode.addComponent(Sprite);
    frame.sizeMode = Sprite.SizeMode.CUSTOM;
    frame.spriteFrame = this.healthBarFrame;
    node.addChild(frameNode);
    frameNode.setPosition(0, 0, 0);

    const fillNode = new Node('HealthBarFill');
    fillNode.layer = node.layer;
    const fillTransform = fillNode.addComponent(UITransform);
    fillTransform.setContentSize(144, 22);
    fillTransform.setAnchorPoint(0.5, 0.5);
    const fill = fillNode.addComponent(Sprite);
    fill.sizeMode = Sprite.SizeMode.CUSTOM;
    fill.spriteFrame = this.healthBarFill;
    fill.type = Sprite.Type.FILLED;
    fill.fillType = Sprite.FillType.HORIZONTAL;
    fill.fillStart = 0;
    fill.fillRange = 1;
    node.addChild(fillNode);
    fillNode.setPosition(0, 0, 0);

    const labelNode = new Node('HealthValueLabel');
    labelNode.layer = node.layer;
    const labelTransform = labelNode.addComponent(UITransform);
    labelTransform.setContentSize(168, 32);
    labelTransform.setAnchorPoint(0.5, 0.5);
    const label = labelNode.addComponent(Label);
    label.fontSize = 17;
    label.lineHeight = 22;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.color = new Color(255, 255, 255, 255);
    const outline = labelNode.addComponent(LabelOutline);
    outline.color = new Color(8, 35, 58, 255);
    outline.width = 2;
    node.addChild(labelNode);
    labelNode.setPosition(0, 0, 0);

    this.fishHealthDisplays.set(id, { fish, node, fill, label });
    this.setFishHealth(id, health, maxHealth);
  }

  private setFishHealth(id: string, health: number, maxHealth: number): void {
    const display = this.fishHealthDisplays.get(id);
    if (!display) return;
    const safeMaxHealth = Number.isFinite(maxHealth) && maxHealth > 0 ? maxHealth : 1;
    const safeHealth = Number.isFinite(health) ? Math.min(safeMaxHealth, Math.max(0, health)) : 0;
    display.fill.fillRange = safeHealth / safeMaxHealth;
    display.label.string = `${Math.ceil(safeHealth)}/${Math.ceil(safeMaxHealth)}`;
  }

  private removeFishHealthDisplay(id: string): void { const display = this.fishHealthDisplays.get(id); display?.node.destroy(); this.fishHealthDisplays.delete(id); }

  private createFishNameDisplay(id: string, fish: Node, name: string): void {
    if (!this.fishHealthOverlay || this.fishNameDisplays.has(id)) return;
    const node = new Node(`FishName-${id}`); node.layer = this.fishHealthOverlay.layer;
    const transform = node.addComponent(UITransform); transform.setContentSize(180, 30);
    const label = node.addComponent(Label); label.fontSize = 20; label.lineHeight = 24; label.horizontalAlign = Label.HorizontalAlign.CENTER; label.color = new Color(255, 255, 255, 255);
    this.fishHealthOverlay.addChild(node); this.fishNameDisplays.set(id, { fish, node, label }); this.setFishName(id, name);
  }

  private setFishName(id: string, name: string): void { const display = this.fishNameDisplays.get(id); if (display) display.label.string = name; }
  private removeFishNameDisplay(id: string): void { const display = this.fishNameDisplays.get(id); display?.node.destroy(); this.fishNameDisplays.delete(id); }

  private updateFishHealthDisplays(): void {
    const overlayTransform = this.fishHealthOverlay?.getComponent(UITransform); if (!overlayTransform) return;
    for (const display of this.fishHealthDisplays.values()) {
      const world = display.fish.worldPosition.clone(); world.y += 120;
      const screen = overlayTransform.convertToNodeSpaceAR(world);
      display.node.setPosition(screen.x, screen.y, 0);
      display.node.angle = 0;
    }
    for (const display of this.fishNameDisplays.values()) {
      const world = display.fish.worldPosition.clone(); world.y += 160;
      const screen = overlayTransform.convertToNodeSpaceAR(world);
      display.node.setPosition(screen.x, screen.y, 0);
      display.node.angle = 0;
    }
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
    if (typeof window !== 'undefined' && window.location.hostname === 'scene') {
      this.showEditorTestLoginDialog();
      return;
    }
    if (typeof document !== 'undefined') {
      if (this.loginDom) return;
      const overlay = document.createElement('div');
      overlay.id = 'fish-eat-fish-test-login';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,20,45,.74);font-family:Arial,"Microsoft YaHei",sans-serif;';
      const panel = document.createElement('div');
      panel.style.cssText = 'width:420px;max-width:calc(100vw - 48px);padding:32px;border-radius:20px;background:#11456a;color:#fff;box-shadow:0 16px 48px rgba(0,0,0,.45);text-align:center;box-sizing:border-box;';
      panel.innerHTML = '<div style="font-size:28px;font-weight:700;color:#fff5b4;margin-bottom:12px;">测试环境登录</div><div style="font-size:18px;margin-bottom:22px;">输入用户名后进入默认海域</div>';
      const input = document.createElement('input');
      input.type = 'text'; input.maxLength = 16; input.placeholder = '用户名（1-16 个字符）'; input.value = this.testUsername;
      input.style.cssText = 'display:block;width:100%;height:52px;padding:0 16px;box-sizing:border-box;border:0;border-radius:10px;background:#fff;color:#124260;font-size:20px;outline:none;';
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = '进入海域'; button.style.cssText = 'margin-top:22px;width:190px;height:56px;border:0;border-radius:14px;background:#2499c8;color:#fff;font-size:20px;cursor:pointer;';
      const submit = () => { const username = input.value.trim(); if (!username) { input.focus(); return; } this.testUsername = username; this.setFishName('local-player', username); overlay.remove(); this.loginDom = undefined; void this.connectOnline(username); };
      button.onclick = submit; input.onkeydown = (event) => { if (event.key === 'Enter') submit(); };
      panel.append(input, button); overlay.appendChild(panel); document.body.appendChild(overlay); input.focus(); this.loginDom = overlay;
      return;
    }
    if (this.loginDialog) return;
    const canvas = this.node;
    const canvasTransform = canvas.getComponent(UITransform);
    if (!canvasTransform) return;
    const canvasWidth = canvasTransform.width;
    const canvasHeight = canvasTransform.height;
    const dialog = new Node('TestLoginDialog'); dialog.layer = canvas.layer;
    const dialogTransform = dialog.addComponent(UITransform); dialogTransform.setContentSize(canvasWidth, canvasHeight); dialogTransform.setAnchorPoint(0, 0); dialog.addComponent(BlockInputEvents); canvas.addChild(dialog); dialog.setPosition(-canvasWidth / 2, -canvasHeight / 2, 0);
    const shade = dialog.addComponent(Graphics); shade.fillColor = new Color(0, 20, 45, 190); shade.rect(0, 0, canvasWidth, canvasHeight); shade.fill();
    const panel = new Node('TestLoginPanel'); panel.layer = dialog.layer; const panelTransform = panel.addComponent(UITransform); panelTransform.setContentSize(520, 300); panelTransform.setAnchorPoint(0.5, 0.5); const panelGraphics = panel.addComponent(Graphics); panelGraphics.fillColor = new Color(17, 69, 106, 248); panelGraphics.roundRect(-260, -150, 520, 300, 24); panelGraphics.fill(); dialog.addChild(panel); panel.setPosition(canvasWidth / 2, canvasHeight / 2, 0);
    const panelWidget = panel.addComponent(Widget); panelWidget.isAlignHorizontalCenter = true; panelWidget.isAlignVerticalCenter = true; panelWidget.horizontalCenter = 0; panelWidget.verticalCenter = 0; panelWidget.updateAlignment();
    this.createDialogLabel(panel, '测试环境登录', 30, new Color(255, 245, 180, 255), 0, 88);
    this.createDialogLabel(panel, '输入用户名后进入默认海域', 20, new Color(230, 245, 255, 255), 0, 42);
    const usernameBackground = new Node('UsernameInputBackground'); usernameBackground.layer = panel.layer; const usernameBackgroundTransform = usernameBackground.addComponent(UITransform); usernameBackgroundTransform.setContentSize(360, 56); usernameBackgroundTransform.setAnchorPoint(0.5, 0.5); const usernameGraphics = usernameBackground.addComponent(Graphics); usernameGraphics.fillColor = new Color(255, 255, 255, 245); usernameGraphics.roundRect(-180, -28, 360, 56, 12); usernameGraphics.fill(); panel.addChild(usernameBackground); usernameBackground.setPosition(0, -12, 0);
    const usernameNode = new Node('UsernameInput'); usernameNode.layer = panel.layer; const usernameTransform = usernameNode.addComponent(UITransform); usernameTransform.setContentSize(340, 46); usernameTransform.setAnchorPoint(0.5, 0.5); const usernameInput = usernameNode.addComponent(EditBox); usernameInput.placeholder = '用户名（1-16 个字符）'; usernameInput.maxLength = 16; usernameInput.fontSize = 22; usernameInput.fontColor = new Color(18, 66, 96, 255); usernameInput.placeholderFontSize = 20; usernameInput.placeholderFontColor = new Color(100, 132, 152, 255); usernameInput.string = this.testUsername; usernameBackground.addChild(usernameNode); usernameNode.setPosition(0, 0, 0);
    const submit = () => { const username = usernameInput.string.trim(); if (!username) { this.actionHint && (this.actionHint.string = '请输入用户名'); return; } this.testUsername = username; this.setFishName('local-player', username); dialog.destroy(); this.loginDialog = undefined; void this.connectOnline(username); };
    const enter = this.createDialogButton(panel, '进入海域', 0, -96, submit); enter.name = 'TestLoginSubmitButton';
    this.loginDialog = dialog;
  }

  private showEditorTestLoginDialog(): void {
    if (this.loginDialog) return;
    const inputLayer = this.hudRoot?.getChildByName('SafeAreaRoot')?.getChildByName('InputLayer');
    if (!inputLayer) return;
    const dialog = new Node('EditorTestLoginDialog'); dialog.layer = inputLayer.layer;
    const dialogTransform = dialog.addComponent(UITransform); dialogTransform.setContentSize(1280, 720); dialogTransform.setAnchorPoint(0.5, 0.5); dialog.addComponent(BlockInputEvents); inputLayer.addChild(dialog); dialog.setPosition(0, 0, 0);
    const shade = dialog.addComponent(Graphics); shade.fillColor = new Color(0, 20, 45, 190); shade.rect(-640, -360, 1280, 720); shade.fill();
    const panel = new Node('EditorTestLoginPanel'); panel.layer = dialog.layer; const panelTransform = panel.addComponent(UITransform); panelTransform.setContentSize(520, 300); panelTransform.setAnchorPoint(0.5, 0.5); const panelGraphics = panel.addComponent(Graphics); panelGraphics.fillColor = new Color(17, 69, 106, 248); panelGraphics.roundRect(-260, -150, 520, 300, 24); panelGraphics.fill(); dialog.addChild(panel); panel.setPosition(0, 0, 0);
    this.createDialogLabel(panel, '测试环境登录', 30, new Color(255, 245, 180, 255), 0, 88);
    this.createDialogLabel(panel, '输入用户名后进入默认海域', 20, new Color(230, 245, 255, 255), 0, 42);
    const background = new Node('EditorUsernameBackground'); background.layer = panel.layer; const backgroundTransform = background.addComponent(UITransform); backgroundTransform.setContentSize(360, 56); backgroundTransform.setAnchorPoint(0.5, 0.5); const backgroundGraphics = background.addComponent(Graphics); backgroundGraphics.fillColor = new Color(255, 255, 255, 245); backgroundGraphics.roundRect(-180, -28, 360, 56, 12); backgroundGraphics.fill(); panel.addChild(background); background.setPosition(0, -12, 0);
    const inputNode = new Node('EditorUsernameInput'); inputNode.layer = panel.layer; const inputTransform = inputNode.addComponent(UITransform); inputTransform.setContentSize(340, 46); inputTransform.setAnchorPoint(0.5, 0.5); const usernameInput = inputNode.addComponent(EditBox); usernameInput.inputMode = EditBox.InputMode.SINGLE_LINE; usernameInput.placeholder = '用户名（1-16 个字符）'; usernameInput.maxLength = 16; usernameInput.fontSize = 22; usernameInput.fontColor = new Color(18, 66, 96, 255); usernameInput.placeholderFontSize = 20; usernameInput.placeholderFontColor = new Color(100, 132, 152, 255); usernameInput.string = this.testUsername; background.addChild(inputNode); inputNode.setPosition(0, 0, 0);
    inputNode.on(EditBox.EventType.EDITING_DID_BEGAN, () => this.alignEditorEditBoxDom(usernameInput));
    const submit = () => { const username = usernameInput.string.trim(); if (!username) { this.actionHint && (this.actionHint.string = '请输入用户名'); return; } this.testUsername = username; this.setFishName('local-player', username); dialog.destroy(); this.loginDialog = undefined; void this.connectOnline(username); };
    const submitButton = this.createDialogButton(panel, '进入海域', 0, -96, submit); submitButton.name = 'EditorTestLoginSubmitButton';
    this.loginDialog = dialog;
  }

  private alignEditorEditBoxDom(editBox: EditBox): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const apply = () => {
      const impl = editBox._impl as unknown as { _edTxt?: HTMLInputElement | HTMLTextAreaElement } | null;
      const element = impl?._edTxt;
      const canvas = (document.getElementById('GameCanvas') ?? document.querySelector('canvas')) as HTMLCanvasElement | null;
      if (!element || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / 1280;
      const scaleY = rect.height / 720;
      const width = 340 * scaleX;
      const height = 46 * scaleY;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2 + 12 * scaleY;
      element.style.position = 'fixed';
      element.style.left = `${centerX - width / 2}px`;
      element.style.top = `${centerY - height / 2}px`;
      element.style.bottom = 'auto';
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
      element.style.transform = 'none';
      element.style.setProperty('-webkit-transform', 'none');
      element.style.transformOrigin = 'center center';
      element.style.boxSizing = 'border-box';
      element.style.padding = `0 ${Math.max(6, 10 * scaleX)}px`;
      element.style.overflow = 'hidden';
      element.style.fontSize = `${Math.max(14, 22 * scaleY)}px`;
      element.style.lineHeight = `${height}px`;
      element.style.color = '#124260';
      element.style.background = 'transparent';
      element.style.zIndex = '2147483647';
    };
    window.requestAnimationFrame(() => window.requestAnimationFrame(apply));
  }

  private showConnectionDialog(reason: string): void {
    if (this.offlineModeSelected || this.isDestroying) return;
    this.actionHint && (this.actionHint.string = reason);
    if (this.connectionDialog) { this.connectionDialog.active = true; return; }
    const inputLayer = this.hudRoot?.getChildByName('SafeAreaRoot')?.getChildByName('InputLayer');
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
      if (effect.skillId === 'skill-whale-swallow') this.handleWhaleSwallowEffect(effect);
      else if (effect.playerId !== this.networkPlayerId) {
        this.remotePlayers?.setTransform(effect.playerId, effect.x, effect.y, effect.rotation);
        this.remotePlayers?.playSkill(effect.playerId, effect.skillId, effect.actionSequence);
      }
    } else if (message.type === 'skillResolved') {
      const result = message.payload as SkillResolved;
      if (result.playerId === this.networkPlayerId && this.actionHint) {
        if (result.skillId === 'skill-whale-swallow' && result.reason === 'noTarget') {
          this.skillCooldownRemaining.whale = 0;
          this.updateSkillCooldownMasks();
          this.actionHint.string = '鲸吞范围内没有可用目标';
        } else if (!result.reason && result.skillId === 'skill-whale-swallow') this.actionHint.string = '鲸吞已锁定目标，效果持续 3 秒';
        else if (!result.reason) this.actionHint.string = result.hitCount > 0 ? `命中 ${result.hitCount} 名玩家` : '未命中：靠近并面向对方后再撕咬';
        else if (result.reason === 'cooldown') this.actionHint.string = '技能冷却中';
        else if (result.reason === 'dead') this.actionHint.string = '死亡期间不能攻击';
        else this.actionHint.string = '攻击输入已过期，请重新释放';
      }
    } else if (message.type === 'playerDamaged') {
      const event = message.payload as PlayerDamaged;
      if (event.targetId === this.networkPlayerId) { this.localHealth = event.health; this.localMaxHealth = event.maxHealth; this.updateHealthHud(); this.actionHint && (this.actionHint.string = `受到撕咬伤害：${event.damage}，生命 ${event.health}/${event.maxHealth}`); this.startFishAction('hurt', event.skillId === 'skill-dash-bite' ? 0.42 : 0.34); }
      else { this.remotePlayers?.setHealth(event.targetId, event.health, event.maxHealth); this.remotePlayers?.playHurt(event.targetId, event.skillId); }
    } else if (message.type === 'playerDied') {
      const event = message.payload as PlayerDied;
      if (event.targetId === this.networkPlayerId) { this.localDead = true; if (this.playerNode) this.applyHorizontalFacing(this.playerNode, this.playerFacingAngle, 0.6); this.actionHint && (this.actionHint.string = '你已被击败，3 秒后复活'); }
      else this.remotePlayers?.playDeath(event.targetId);
    } else if (message.type === 'playerRespawned') {
      const event = message.payload as PlayerRespawned;
      if (event.playerId === this.networkPlayerId) { this.localDead = false; this.localHealth = event.health; this.localMaxHealth = event.maxHealth; this.updateHealthHud(); if (this.playerNode) this.applyHorizontalFacing(this.playerNode, this.playerFacingAngle); this.playerNode?.setPosition(event.x, event.y, 0); this.actionHint && (this.actionHint.string = '已复活，3 秒无敌'); }
      else { this.remotePlayers?.upsert({ playerId: event.playerId, displayName: '远端玩家', x: event.x, y: event.y, rotation: 0, lastProcessedClientTick: 0, health: event.health, maxHealth: event.maxHealth, level: 1, dead: false }); this.remotePlayers?.playRespawn(event.playerId); }
    } else if (message.type === 'combatSettlement') {
      const event = message.payload as CombatSettlement;
      if (event.playerId === this.networkPlayerId) { this.localHealth = event.health; this.localMaxHealth = event.maxHealth; this.updateHealthHud(); this.actionHint && (this.actionHint.string = event.leveled ? `击败玩家，升级至 ${event.level} 级，生命上限 ${event.maxHealth}` : `击败玩家，获得经验，击杀 ${event.kills}`); }
    } else if (message.type === 'stateCorrection') {
      const state = message.payload as RemotePlayerState;
      if (state.playerId === this.networkPlayerId) {
        this.localHealth = state.health;
        this.localMaxHealth = state.maxHealth;
        this.localDead = state.dead;
        this.updateHealthHud();
        this.playerNode?.setPosition(state.x, state.y, 0);
        if (this.playerNode) {
          this.playerFacingAngle = normalizeHorizontalFacingAngle(state.rotation);
          this.applyHorizontalFacing(this.playerNode, this.playerFacingAngle, state.dead ? 0.6 : undefined);
          this.playerNode.active = true;
        }
        this.applyLocalSnapshotAction(state);
      }
    }
  }

  private applyRemotePlayers(players: RemotePlayerState[]): void {
    const seen = new Set<string>();
    for (const player of players) {
      if (player.playerId === this.networkPlayerId) continue;
      seen.add(player.playerId);
      const targetsLocalPlayer = player.action === 'skill-whale-swallow' && player.actionTargetId === this.networkPlayerId;
      this.remotePlayers?.upsert(targetsLocalPlayer ? { ...player, actionTargetId: undefined } : player);
      if (
        targetsLocalPlayer
        && player.actionSequence !== undefined
        && player.actionSequence > (this.localWhaleTargetSequences.get(player.playerId) ?? 0)
      ) {
        this.localWhaleTargetSequences.set(player.playerId, player.actionSequence);
        if (this.playerSprite) this.applyWhaleOpacity(this.playerSprite, player.actionRemainingMs ?? GameBootstrap.WHALE_EFFECT_DURATION_MS);
      }
    }
    for (const id of this.remotePlayers?.ids() ?? []) if (!seen.has(id)) this.remotePlayers?.remove(id);
  }

  private handleWhaleSwallowEffect(effect: SkillEffect): void {
    const durationMs = effect.effectDurationMs ?? GameBootstrap.WHALE_EFFECT_DURATION_MS;
    if (effect.playerId === this.networkPlayerId) {
      if (effect.actionSequence <= this.localActionSequence) return;
      this.localActionSequence = effect.actionSequence;
      this.playerNode?.setPosition(effect.x, effect.y, 0);
      this.startFishAction('dashBite', 0.42);
      if (this.playerNode && this.playerSprite) {
        this.applyWhaleSourceVisual(
          this.playerNode,
          this.playerSprite,
          () => this.playerFacingAngle,
          durationMs,
          () => this.localDead ? 0.6 : 1
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
      if (this.playerSprite) this.applyWhaleOpacity(this.playerSprite, durationMs);
    }
  }

  private applyLocalSnapshotAction(state: RemotePlayerState): void {
    if (
      state.action !== 'skill-whale-swallow'
      || state.actionSequence === undefined
      || state.actionSequence <= this.localActionSequence
    ) return;
    this.localActionSequence = state.actionSequence;
    const durationMs = state.actionRemainingMs ?? GameBootstrap.WHALE_EFFECT_DURATION_MS;
    this.startFishAction('dashBite', 0.42);
    if (this.playerNode && this.playerSprite) {
      this.applyWhaleSourceVisual(
        this.playerNode,
        this.playerSprite,
        () => this.playerFacingAngle,
        durationMs,
        () => this.localDead ? 0.6 : 1
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

  private updateHealthHud(): void { if (this.healthLabel) this.healthLabel.string = `生命 ${Math.max(0, Math.ceil(this.localHealth))}/${this.localMaxHealth}`; this.setFishHealth('local-player', this.localHealth, this.localMaxHealth); }

  private createCombatUi(hudRoot: Node, base: ImageAsset, knob: ImageAsset, basic: ImageAsset, skill: ImageAsset, whaleSkill: ImageAsset): void {
    const inputLayer = hudRoot.getChildByName('SafeAreaRoot')?.getChildByName('InputLayer') ?? hudRoot;
    // 先对齐整体容器，再处理容器内部节点，避免显示坐标和触摸坐标分裂。
    const joystick = this.createUiSprite(inputLayer, 'JoystickControlRoot', base, 220, 220, 0, 0);
    this.joystickNode = joystick;
    joystick.getComponent(UITransform)?.setAnchorPoint(0, 0);
    this.alignContainerToScreen(joystick, { left: 60, bottom: 35 });
    this.joystickKnob = this.createUiSprite(joystick, 'JoystickKnob', knob, 120, 120, 110, 110);
    const actionRoot = this.createUiContainer(
      inputLayer,
      'ActionControlsRoot',
      GameBootstrap.ACTION_CONTROLS_WIDTH,
      GameBootstrap.ACTION_CONTROLS_HEIGHT
    );
    this.alignContainerToScreen(actionRoot, { right: 24, bottom: 20 });
    const attackCenter = GameBootstrap.BASIC_ATTACK_CENTER;
    const attackButton = this.createUiSprite(actionRoot, 'BasicAttackButton', basic, 132, 132, attackCenter.x, attackCenter.y);
    this.createButtonLabel(attackButton, '普攻');
    const skillButtons = [
      { name: 'SkillDashButton', label: '冲刺', image: skill, cooldownKey: 'dash' as const, action: () => this.triggerDashBite() },
      { name: 'SkillWhaleSwallowButton', label: '鲸吞', image: whaleSkill, cooldownKey: 'whale' as const, action: () => this.triggerWhaleSwallow() },
      { name: 'SkillPlaceholderButton3', label: '技能3', image: skill, cooldownKey: 'dash' as const, action: () => this.triggerDashBite() },
      { name: 'SkillPlaceholderButton4', label: '技能4', image: skill, cooldownKey: 'dash' as const, action: () => this.triggerDashBite() }
    ].map((definition, slotIndex) => {
      const position = this.getSkillArcPosition(slotIndex);
      const button = this.createUiSprite(actionRoot, definition.name, definition.image, 104, 104, position.x, position.y);
      this.createSkillCooldownMask(button, definition.cooldownKey);
      this.createButtonLabel(button, definition.label);
      return { button, action: definition.action };
    });
    joystick.on(Node.EventType.TOUCH_START, this.onJoystickTouchStart, this);
    joystick.on(Node.EventType.TOUCH_MOVE, this.onJoystickTouchMove, this);
    joystick.on(Node.EventType.TOUCH_END, this.onJoystickTouchEnd, this);
    joystick.on(Node.EventType.TOUCH_CANCEL, this.onJoystickTouchEnd, this);
    this.bindActionButton(attackButton, () => {
      this.triggerBasicBite();
    });
    for (const { button, action } of skillButtons) this.bindActionButton(button, action);
  }

  private getSkillArcPosition(slotIndex: number): Vec2 {
    const angle = GameBootstrap.SKILL_ARC_ANGLES[Math.min(slotIndex, GameBootstrap.SKILL_ARC_ANGLES.length - 1)];
    const radians = angle * Math.PI / 180;
    return new Vec2(
      GameBootstrap.BASIC_ATTACK_CENTER.x + Math.cos(radians) * GameBootstrap.SKILL_ARC_RADIUS,
      GameBootstrap.BASIC_ATTACK_CENTER.y + Math.sin(radians) * GameBootstrap.SKILL_ARC_RADIUS
    );
  }

  private triggerBasicBite(): void {
    if (!this.playerNode || this.basicCooldownRemaining > 0) return;
    this.basicCooldownRemaining = 0.55;
    this.startFishAction('bite', 0.34);
    this.sendSkillEvent('skill-basic-bite');
    const radians = this.playerFacingAngle * Math.PI / 180;
    const x = this.playerNode.position.x + Math.cos(radians) * 76;
    const y = this.playerNode.position.y;
    this.createBiteEffect(x, y, this.playerFacingAngle, 72, new Color(255, 236, 120, 235), 0.16);
    this.actionHint && (this.actionHint.string = '普通撕咬：攻击范围 72');
  }

  private triggerDashBite(): void {
    if (!this.playerNode || this.skillCooldownRemaining.dash > 0) return;
    this.skillCooldownRemaining.dash = GameBootstrap.DASH_SKILL_COOLDOWN_SECONDS;
    this.updateSkillCooldownMasks();
    this.startFishAction('dashBite', 0.42);
    this.sendSkillEvent('skill-dash-bite');
    const angle = this.playerFacingAngle * Math.PI / 180;
    const start = this.playerNode.position;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    const next = moveWithinBounds(
      { x: start.x, y: start.y }, direction, 240, 1,
      { minX: -GameBootstrap.WORLD_WIDTH / 2 + GameBootstrap.PLAYER_MARGIN, maxX: GameBootstrap.WORLD_WIDTH / 2 - GameBootstrap.PLAYER_MARGIN, minY: -GameBootstrap.WORLD_HEIGHT / 2 + GameBootstrap.PLAYER_MARGIN, maxY: GameBootstrap.WORLD_HEIGHT / 2 - GameBootstrap.PLAYER_MARGIN }
    );
    this.createDashEffect(start.x, start.y, this.playerFacingAngle);
    this.playerNode.setPosition(next.x, next.y, 0);
    this.createBiteEffect(next.x + direction.x * 84, next.y, this.playerFacingAngle, 96, new Color(120, 230, 255, 235), 0.22);
    this.actionHint && (this.actionHint.string = '冲刺撕咬：突进 240，冷却 5 秒');
  }

  private triggerWhaleSwallow(): void {
    if (!this.playerNode || this.localDead || this.skillCooldownRemaining.whale > 0) return;
    if (this.offlineModeSelected) {
      this.actionHint && (this.actionHint.string = '鲸吞需要连接多人房间并锁定其它玩家');
      return;
    }
    this.skillCooldownRemaining.whale = GameBootstrap.WHALE_SKILL_COOLDOWN_SECONDS;
    this.updateSkillCooldownMasks();
    this.startFishAction('dashBite', 0.42);
    this.sendSkillEvent('skill-whale-swallow');
    this.actionHint && (this.actionHint.string = '鲸吞：正在搜索 800 范围内最近目标');
  }

  private createSkillCooldownMask(parent: Node, key: SkillCooldownKey): void {
    const parentTransform = parent.getComponent(UITransform);
    const parentSprite = parent.getComponent(Sprite);
    if (!parentTransform || !parentSprite?.spriteFrame) return;
    const maskNode = new Node(`${parent.name}CooldownMask`);
    maskNode.layer = parent.layer;
    const transform = maskNode.addComponent(UITransform);
    transform.setContentSize(parentTransform.width, parentTransform.height);
    transform.setAnchorPoint(0.5, 0.5);
    const mask = maskNode.addComponent(Sprite);
    mask.sizeMode = Sprite.SizeMode.CUSTOM;
    mask.spriteFrame = parentSprite.spriteFrame;
    mask.type = Sprite.Type.FILLED;
    mask.fillType = Sprite.FillType.RADIAL;
    mask.fillCenter = new Vec2(0.5, 0.5);
    mask.fillStart = GameBootstrap.SKILL_COOLDOWN_START;
    mask.fillRange = 0;
    mask.color = new Color(0, 0, 0, 160);
    parent.addChild(maskNode);
    maskNode.setPosition(0, 0, 0);
    maskNode.active = false;
    this.skillCooldownMasks.push({ sprite: mask, key });
  }

  private updateSkillCooldownMasks(): void {
    for (const { sprite: mask, key } of this.skillCooldownMasks) {
      const cooldownSeconds = key === 'whale'
        ? GameBootstrap.WHALE_SKILL_COOLDOWN_SECONDS
        : GameBootstrap.DASH_SKILL_COOLDOWN_SECONDS;
      const remainingRatio = Math.min(1, Math.max(0, this.skillCooldownRemaining[key] / cooldownSeconds));
      const elapsedRatio = 1 - remainingRatio;
      const clockwiseStart = (GameBootstrap.SKILL_COOLDOWN_START - elapsedRatio + 1) % 1;
      const active = remainingRatio > 0;
      mask.node.active = active;
      mask.fillStart = active ? clockwiseStart : GameBootstrap.SKILL_COOLDOWN_START;
      mask.fillRange = active ? -remainingRatio : 0;
    }
  }

  private sendSkillEvent(skillId: SkillId): void {
    if (!this.playerNode) return;
    const position = this.playerNode.position;
    // 服务端只信任它保存的朝向。技能前先发送当前朝向，确保快速转向后立即撕咬不会按旧朝向判定。
    this.realtime.sendInput({ clientTick: ++this.networkClientTick, moveX: 0, moveY: 0, rotation: this.playerFacingAngle });
    this.realtime.sendSkill({ skillId, clientTick: ++this.networkClientTick, x: position.x, y: position.y, rotation: this.playerFacingAngle });
  }

  private startFishAction(state: 'bite' | 'dashBite' | 'hurt', duration: number): void {
    this.fishActionState = state;
    this.fishActionElapsed = 0;
    this.fishActionDuration = duration;
    const frames = state === 'hurt' ? this.hurtFrames : this.biteFrames;
    if (this.playerSprite && frames.length > 0) this.playerSprite.spriteFrame = frames[0];
  }

  private updateFishAction(deltaTime: number): void {
    if (!this.playerNode || this.fishActionState === 'swim') return;
    this.fishActionElapsed += deltaTime;
    const progress = Math.min(1, this.fishActionElapsed / this.fishActionDuration);
    const frames = this.fishActionState === 'hurt' ? this.hurtFrames : this.biteFrames;
    const index = Math.min(frames.length - 1, Math.floor(progress * frames.length));
    if (this.playerSprite && index >= 0) this.playerSprite.spriteFrame = frames[index] ?? this.swimFrames[this.swimFrameIndex];
    if (progress >= 1) {
      this.fishActionState = 'swim';
      this.fishActionElapsed = 0;
      this.fishActionDuration = 0;
      if (this.playerSprite) this.playerSprite.spriteFrame = this.swimFrames[this.swimFrameIndex] ?? null;
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

  private createUiSprite(parent: Node, name: string, image: ImageAsset, width: number, height: number, x: number, y: number): Node {
    const node = new Node(name);
    node.layer = parent.layer;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    transform.setAnchorPoint(0.5, 0.5);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = this.createSpriteFrame(image);
    parent.addChild(node);
    node.setPosition(x, y, 0);
    return node;
  }

  private createUiContainer(parent: Node, name: string, width: number, height: number): Node {
    const node = new Node(name);
    node.layer = parent.layer;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    transform.setAnchorPoint(0, 0);
    parent.addChild(node);
    node.setPosition(0, 0, 0);
    return node;
  }

  private createButtonLabel(parent: Node, text: string): void {
    const parentTransform = parent.getComponent(UITransform);
    if (!parentTransform) return;
    const labelNode = new Node(`${parent.name}Label`);
    labelNode.layer = parent.layer;
    const transform = labelNode.addComponent(UITransform);
    transform.setContentSize(Math.max(72, parentTransform.width - 12), 28);
    transform.setAnchorPoint(0.5, 0);
    const label = labelNode.addComponent(Label);
    label.string = text;
    label.fontSize = 17;
    label.lineHeight = 22;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.BOTTOM;
    label.color = new Color(255, 255, 255, 255);
    const outline = labelNode.addComponent(LabelOutline);
    outline.color = new Color(8, 35, 58, 255);
    outline.width = 2;
    parent.addChild(labelNode);
    labelNode.setPosition(0, -parentTransform.height / 2, 0);
  }

  private alignContainerToScreen(node: Node, edges: { left?: number; right?: number; bottom: number }): void {
    const widget = node.addComponent(Widget);
    widget.isAlignLeft = edges.left !== undefined;
    widget.isAlignRight = edges.right !== undefined;
    widget.isAlignBottom = true;
    if (edges.left !== undefined) widget.left = edges.left;
    if (edges.right !== undefined) widget.right = edges.right;
    widget.bottom = edges.bottom;
    widget.updateAlignment();
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
    if (!this.playerSprite || this.swimFrames.length === 0 || this.fishActionState !== 'swim') return;
    this.animationElapsed += deltaTime;
    const frameDuration = moving ? 0.11 : 0.22;
    while (this.animationElapsed >= frameDuration) {
      this.animationElapsed -= frameDuration;
      this.swimFrameIndex = (this.swimFrameIndex + 1) % this.swimFrames.length;
      this.playerSprite.spriteFrame = this.swimFrames[this.swimFrameIndex];
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
