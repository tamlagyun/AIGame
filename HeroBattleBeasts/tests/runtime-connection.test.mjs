import test from 'node:test';
import assert from 'node:assert/strict';

import { GameRuntime } from '../assets/scripts/runtime/GameRuntime.js';
import { normalizeKeyboardInput } from '../assets/scripts/runtime/InputAdapter.js';
import { createRuntimeViewModel } from '../assets/scripts/runtime/RuntimeViewModel.js';

const configs = {
  levelConfig: {
    id: 'level-001',
    objective: { type: 'defeatEnemiesAndReachExit', requiredDefeats: 1 },
    playerSpawn: { x: 24, y: 400 },
    enemies: [{ id: 'slime-a', enemyId: 'forest-slime', x: 220, y: 400 }],
    pickups: [{ id: 'coin-a', type: 'coin', x: 100, y: 360, value: 1 }],
    exit: { x: 500, y: 360, width: 80, height: 120 }
  },
  playerConfig: {
    id: 'hero-ranger',
    maxHealth: 5,
    moveSpeed: 200,
    jumpVelocity: 500,
    invulnerableSecondsAfterHit: 1,
    startWeaponId: 'starter-blaster'
  },
  weaponConfig: {
    id: 'starter-blaster',
    damage: 1,
    bulletSpeed: 600,
    fireCooldownSeconds: 0.2,
    boostedFireCooldownSeconds: 0.1,
    boostDurationSeconds: 8
  },
  enemyConfig: {
    id: 'forest-slime',
    maxHealth: 1,
    contactDamage: 1,
    moveSpeed: 90,
    patrolDistance: 160,
    score: 100
  }
};

test('keyboard input is normalized into platform neutral commands', () => {
  assert.deepEqual(normalizeKeyboardInput(new Set(['KeyD', 'Space', 'KeyJ'])), {
    moveX: 1,
    aimX: 1,
    aimY: 0,
    jumpPressed: true,
    shootPressed: true,
    pausePressed: false,
    restartPressed: false
  });

  assert.deepEqual(normalizeKeyboardInput(new Set(['ArrowLeft', 'KeyR'])), {
    moveX: -1,
    aimX: -1,
    aimY: 0,
    jumpPressed: false,
    shootPressed: false,
    pausePressed: false,
    restartPressed: true
  });

  assert.deepEqual(normalizeKeyboardInput(new Set(['ArrowUp', 'KeyJ'])), {
    moveX: 0,
    aimX: 0,
    aimY: -1,
    jumpPressed: true,
    shootPressed: true,
    pausePressed: false,
    restartPressed: false
  });
});

test('runtime starts from configs and exposes Cocos-friendly view model', () => {
  const runtime = new GameRuntime(configs);
  const view = runtime.getViewModel();

  assert.equal(view.status, 'playing');
  assert.equal(view.hud.healthText, '5/5');
  assert.equal(view.hud.coinText, '0');
  assert.equal(view.hud.objectiveText, '0/1');
  assert.deepEqual(view.player.position, { x: 24, y: 400 });
  assert.equal(view.enemies.length, 1);
  assert.equal(view.pickups.length, 1);
});

test('runtime step applies input and shooting without platform API dependency', () => {
  const platformCalls = [];
  const runtime = new GameRuntime(configs, {
    platform: {
      login: () => platformCalls.push('login'),
      share: () => platformCalls.push('share')
    }
  });

  runtime.step({ moveX: 1, jumpPressed: true, shootPressed: true, pausePressed: false }, 0.1);
  const view = runtime.getViewModel();

  assert.ok(view.player.position.x > 24);
  assert.equal(view.player.grounded, false);
  assert.equal(view.bullets.length, 1);
  assert.deepEqual(platformCalls, []);
});

test('runtime commands bridge hit collect damage and win conditions', () => {
  const runtime = new GameRuntime(configs);

  runtime.collectPickup('coin-a', 0);
  assert.equal(runtime.getViewModel().hud.coinText, '1');

  runtime.hitEnemy('slime-a', 1);
  assert.equal(runtime.getViewModel().hud.objectiveText, '1/1');

  runtime.replacePlayerPositionForRuntime({ x: 520, y: 390 });
  runtime.step({ moveX: 0, jumpPressed: false, shootPressed: false, pausePressed: false }, 0.016);
  assert.equal(runtime.getViewModel().status, 'won');
});

test('view model hides core-only mutable details from render layer', () => {
  const runtime = new GameRuntime(configs);
  const view = createRuntimeViewModel(runtime.getState());

  assert.equal(Object.hasOwn(view.player, 'invulnerableUntil'), false);
  assert.deepEqual(Object.keys(view.hud), ['healthText', 'coinText', 'scoreText', 'objectiveText', 'weaponText']);
});
