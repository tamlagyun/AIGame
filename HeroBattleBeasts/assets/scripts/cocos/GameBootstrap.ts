import {
  Color,
  Director,
  Graphics,
  HorizontalTextAlignment,
  Input,
  KeyCode,
  Label,
  Node,
  UITransform,
  director,
  input
} from 'cc';
import { GameRuntime } from '../runtime/GameRuntime';
import type { InputCommand } from '../shared/types';
import type { RuntimeViewModel } from '../runtime/RuntimeViewModel';

type RuntimeInputState = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  shootQueued: boolean;
};

const BOOTSTRAP_FLAG = '__heroBattleBeastsCocosBootstrapStarted';
const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 720;

const playerConfig = {
  id: 'hero-ranger',
  displayName: 'Hero Ranger',
  maxHealth: 5,
  moveSpeed: 260,
  jumpVelocity: 620,
  invulnerableSecondsAfterHit: 1,
  startWeaponId: 'starter-blaster'
};

const weaponConfig = {
  id: 'starter-blaster',
  displayName: 'Starter Blaster',
  damage: 1,
  bulletSpeed: 720,
  fireCooldownSeconds: 0.22,
  boostedFireCooldownSeconds: 0.11,
  boostDurationSeconds: 8
};

const enemyConfig = {
  id: 'forest-slime',
  displayName: 'Forest Slime',
  maxHealth: 2,
  contactDamage: 1,
  moveSpeed: 90,
  patrolDistance: 160,
  score: 100
};

const levelConfig = {
  schemaVersion: 2,
  id: 'level-001',
  displayName: 'Forest Gate',
  size: { width: 2400, height: 720 },
  spawnPoints: {
    playerStart: { x: 320, y: 640 },
    exit: { x: 2260, y: 560, width: 80, height: 80 }
  },
  objective: {
    type: 'defeatEnemiesAndReachExit',
    requiredDefeats: 3
  },
  physics: {
    gravity: 1400,
    maxFallSpeed: 900,
    playerBounds: { width: 32, height: 48 }
  },
  combat: {
    bulletBounds: { width: 18, height: 12 },
    enemyBounds: { width: 48, height: 48 },
    pickupBounds: { width: 32, height: 32 },
    bulletLifetimeSeconds: 1.2
  },
  platforms: [
    { id: 'ground', x: 0, y: 640, width: 2400, height: 80 },
    { id: 'bridge-left', x: 420, y: 500, width: 360, height: 36 },
    { id: 'tree-root-mid', x: 980, y: 420, width: 320, height: 36 },
    { id: 'bridge-right', x: 1500, y: 520, width: 420, height: 36 }
  ],
  encounters: [
    {
      id: 'forest-slime-line',
      enemyId: 'forest-slime',
      points: [
        { id: 'slime-a', x: 620, y: 460 },
        { id: 'slime-b', x: 1160, y: 380 },
        { id: 'slime-c', x: 1740, y: 480 }
      ]
    }
  ],
  pickupGroups: [
    {
      id: 'coin-line-a',
      type: 'coin' as const,
      value: 1,
      points: [
        { id: 'coin-a', x: 500, y: 450 },
        { id: 'coin-b', x: 1080, y: 370 }
      ]
    },
    {
      id: 'weapon-boost-a',
      type: 'weaponBoost' as const,
      weaponId: 'starter-blaster',
      points: [{ id: 'weapon-boost-a', x: 1580, y: 470 }]
    }
  ]
};

export class GameBootstrap {
  readonly sceneName = 'MainScene';

  start(): void {
    startCocosRuntimePreview();
  }
}

export function startCocosRuntimePreview(): void {
  const globalState = globalThis as Record<string, unknown>;
  if (globalState[BOOTSTRAP_FLAG]) {
    return;
  }
  globalState[BOOTSTRAP_FLAG] = true;

  const run = () => {
    const scene = director.getScene();
    if (!scene || scene.name !== 'MainScene') {
      return;
    }

    const canvas = ensureCanvasRoot(scene);
    const graphicsNode = ensureRenderNode(canvas, 'HeroBattleBeastsRuntimeGraphics');
    const graphics = graphicsNode.getComponent(Graphics) ?? graphicsNode.addComponent(Graphics);
    const hudNode = ensureNode(canvas, 'HeroBattleBeastsRuntimeHud');
    const statusLabel = ensureLabel(hudNode, 'StatusLabel', 24, -626, 310);
    const helpLabel = ensureLabel(hudNode, 'HelpLabel', 18, -626, -320);

    const runtime = new GameRuntime({
      levelConfig,
      playerConfig,
      weaponConfig,
      enemyConfig
    });
    const inputState: RuntimeInputState = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      shootQueued: false
    };

    bindKeyboard(inputState, runtime);
    let lastTimeMs = Date.now();

    const update = () => {
      const now = Date.now();
      const deltaSeconds = Math.min(0.033, Math.max(0.001, (now - lastTimeMs) / 1000));
      lastTimeMs = now;

      const viewModel = runtime.step(createInputCommand(inputState), deltaSeconds);
      inputState.shootQueued = false;

      renderGame(graphics, viewModel);
      renderHud(statusLabel, helpLabel, viewModel);
    };

    director.on(Director.EVENT_BEFORE_UPDATE, update);
    update();
    console.info('[HeroBattleBeasts] Cocos runtime preview started.');
  };

  director.once(Director.EVENT_AFTER_SCENE_LAUNCH, run);
  setTimeout(run, 0);
}

function ensureCanvasRoot(scene: Node): Node {
  let canvas = scene.getChildByName('Canvas');
  if (!canvas) {
    canvas = new Node('Canvas');
    scene.addChild(canvas);
  }

  const transform = canvas.getComponent(UITransform) ?? canvas.addComponent(UITransform);
  transform.setContentSize(VIEW_WIDTH, VIEW_HEIGHT);
  return canvas;
}

function ensureNode(parent: Node, name: string): Node {
  let node = parent.getChildByName(name);
  if (!node) {
    node = new Node(name);
    parent.addChild(node);
  }
  node.layer = parent.layer;
  return node;
}

function ensureRenderNode(parent: Node, name: string): Node {
  const node = ensureNode(parent, name);
  node.setPosition(0, 0);

  const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  transform.setContentSize(VIEW_WIDTH, VIEW_HEIGHT);
  return node;
}

function createInputCommand(inputState: RuntimeInputState): InputCommand {
  const moveX: -1 | 0 | 1 = inputState.left === inputState.right ? 0 : inputState.right ? 1 : -1;
  const aimY: -1 | 0 | 1 = inputState.up === inputState.down ? 0 : inputState.up ? -1 : 1;
  return {
    moveX,
    aimX: moveX,
    aimY,
    jumpPressed: inputState.jump,
    shootPressed: inputState.shootQueued,
    pausePressed: false
  };
}

function ensureLabel(parent: Node, name: string, fontSize: number, x: number, y: number): Label {
  const node = ensureNode(parent, name);
  node.setPosition(x, y);
  const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  transform.setContentSize(1180, fontSize + 10);
  transform.setAnchorPoint(0, 0.5);
  const label = node.getComponent(Label) ?? node.addComponent(Label);
  label.fontSize = fontSize;
  label.lineHeight = fontSize + 6;
  label.horizontalAlign = HorizontalTextAlignment.LEFT;
  label.color = new Color(35, 40, 48, 255);
  return label;
}

function bindKeyboard(inputState: RuntimeInputState, runtime: GameRuntime): void {
  input.on(Input.EventType.KEY_DOWN, (event) => {
    switch (event.keyCode) {
      case KeyCode.KEY_A:
      case KeyCode.ARROW_LEFT:
        inputState.left = true;
        break;
      case KeyCode.KEY_D:
      case KeyCode.ARROW_RIGHT:
        inputState.right = true;
        break;
      case KeyCode.KEY_W:
      case KeyCode.ARROW_UP:
        inputState.up = true;
        inputState.jump = true;
        break;
      case KeyCode.SPACE:
        inputState.jump = true;
        break;
      case KeyCode.KEY_S:
      case KeyCode.ARROW_DOWN:
        inputState.down = true;
        break;
      case KeyCode.KEY_J:
      case KeyCode.KEY_Z:
        inputState.shootQueued = true;
        break;
      case KeyCode.KEY_R:
        runtime.restart();
        break;
      default:
        break;
    }
  });

  input.on(Input.EventType.KEY_UP, (event) => {
    switch (event.keyCode) {
      case KeyCode.KEY_A:
      case KeyCode.ARROW_LEFT:
        inputState.left = false;
        break;
      case KeyCode.KEY_D:
      case KeyCode.ARROW_RIGHT:
        inputState.right = false;
        break;
      case KeyCode.KEY_W:
      case KeyCode.ARROW_UP:
        inputState.up = false;
        inputState.jump = false;
        break;
      case KeyCode.SPACE:
        inputState.jump = false;
        break;
      case KeyCode.KEY_S:
      case KeyCode.ARROW_DOWN:
        inputState.down = false;
        break;
      default:
        break;
    }
  });
}

function renderHud(statusLabel: Label, helpLabel: Label, viewModel: RuntimeViewModel): void {
  statusLabel.string = [
    'HP ' + viewModel.hud.healthText,
    'Coin ' + viewModel.hud.coinText,
    'Score ' + viewModel.hud.scoreText,
    'Goal ' + viewModel.hud.objectiveText,
    viewModel.status.toUpperCase()
  ].join('   ');
  helpLabel.string = 'Move/Aim: WASD or Arrow  Jump: W/Space  Shoot: J/Z  Restart: R';
}

function renderGame(graphics: Graphics, viewModel: RuntimeViewModel): void {
  const cameraX = clamp(viewModel.player.position.x - 360, 0, levelConfig.size.width - VIEW_WIDTH);

  graphics.clear();
  drawBackground(graphics);
  drawPlatforms(graphics, cameraX);
  drawExit(graphics, cameraX, viewModel);
  drawPickups(graphics, cameraX, viewModel);
  drawEnemies(graphics, cameraX, viewModel);
  drawBullets(graphics, cameraX, viewModel);
  drawPlayer(graphics, cameraX, viewModel);
  drawResultOverlay(graphics, viewModel);
}

function worldToScreenX(x: number, cameraX: number): number {
  return x - cameraX - VIEW_WIDTH / 2;
}

function worldToScreenY(y: number): number {
  return VIEW_HEIGHT / 2 - y;
}

function drawBackground(graphics: Graphics): void {
  graphics.fillColor = new Color(202, 232, 255, 255);
  graphics.rect(-VIEW_WIDTH / 2, -VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT);
  graphics.fill();

  graphics.fillColor = new Color(112, 185, 126, 255);
  graphics.rect(-VIEW_WIDTH / 2, -VIEW_HEIGHT / 2, VIEW_WIDTH, 115);
  graphics.fill();

  graphics.fillColor = new Color(252, 214, 92, 255);
  graphics.circle(470, 245, 42);
  graphics.fill();
}

function drawPlatforms(graphics: Graphics, cameraX: number): void {
  graphics.fillColor = new Color(88, 152, 91, 255);
  for (const platform of levelConfig.platforms) {
    graphics.roundRect(
      worldToScreenX(platform.x, cameraX),
      worldToScreenY(platform.y),
      platform.width,
      platform.height,
      14
    );
    graphics.fill();
  }
}

function drawExit(graphics: Graphics, cameraX: number, viewModel: RuntimeViewModel): void {
  graphics.fillColor = new Color(84, 122, 214, 210);
  graphics.roundRect(
    worldToScreenX(viewModel.exit.x, cameraX),
    worldToScreenY(viewModel.exit.y),
    viewModel.exit.width,
    viewModel.exit.height,
    18
  );
  graphics.fill();
}

function drawPickups(graphics: Graphics, cameraX: number, viewModel: RuntimeViewModel): void {
  for (const pickup of viewModel.pickups) {
    if (pickup.collected) {
      continue;
    }
    graphics.fillColor = pickup.type === 'weaponBoost'
      ? new Color(245, 102, 155, 255)
      : new Color(255, 204, 61, 255);
    graphics.circle(worldToScreenX(pickup.position.x, cameraX), worldToScreenY(pickup.position.y), 16);
    graphics.fill();
  }
}

function drawEnemies(graphics: Graphics, cameraX: number, viewModel: RuntimeViewModel): void {
  for (const enemy of viewModel.enemies) {
    if (enemy.defeated) {
      continue;
    }
    graphics.fillColor = new Color(116, 214, 143, 255);
    graphics.roundRect(
      worldToScreenX(enemy.position.x, cameraX) - 24,
      worldToScreenY(enemy.position.y) - 24,
      48,
      48,
      22
    );
    graphics.fill();
  }
}

function drawBullets(graphics: Graphics, cameraX: number, viewModel: RuntimeViewModel): void {
  graphics.fillColor = new Color(250, 245, 120, 255);
  for (const bullet of viewModel.bullets) {
    graphics.roundRect(
      worldToScreenX(bullet.position.x, cameraX) - 9,
      worldToScreenY(bullet.position.y) - 6,
      18,
      12,
      6
    );
    graphics.fill();
  }
}

function drawPlayer(graphics: Graphics, cameraX: number, viewModel: RuntimeViewModel): void {
  const x = worldToScreenX(viewModel.player.position.x, cameraX);
  const y = worldToScreenY(viewModel.player.position.y);
  graphics.fillColor = new Color(244, 94, 89, 255);
  graphics.roundRect(x - 18, y - 48, 36, 48, 12);
  graphics.fill();
  graphics.fillColor = new Color(48, 76, 161, 255);
  graphics.roundRect(x - 22, y - 18, 44, 16, 8);
  graphics.fill();
}

function drawResultOverlay(graphics: Graphics, viewModel: RuntimeViewModel): void {
  if (!viewModel.result) {
    return;
  }
  graphics.fillColor = new Color(255, 255, 255, 210);
  graphics.roundRect(-220, -95, 440, 190, 18);
  graphics.fill();
  graphics.fillColor = viewModel.result.status === 'won'
    ? new Color(80, 172, 104, 255)
    : new Color(205, 80, 80, 255);
  graphics.rect(-220, 70, 440, 25);
  graphics.fill();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
