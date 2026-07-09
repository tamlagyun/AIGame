import { GameRuntime } from '../assets/scripts/runtime/GameRuntime.js';
import { normalizeKeyboardInput } from '../assets/scripts/runtime/InputAdapter.js';

// AI生成的主角精灵图
let playerSprite = null;
(function preloadPlayerSprite() {
  playerSprite = new Image();
  playerSprite.src = './player_hero.png';
})();

export function createPreviewInputState() {
  return {
    activeCodes: new Set()
  };
}

export function createPreviewRuntime() {
  return new GameRuntime({
    levelConfig: {
      id: 'level-001',
      objective: { type: 'defeatEnemiesAndReachExit', requiredDefeats: 3 },
      playerSpawn: { x: 120, y: 480 },
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
        { id: 'ground', x: 0, y: 480, width: 2100, height: 90 },
        { id: 'bridge-left', x: 360, y: 410, width: 260, height: 28 },
        { id: 'tree-root-mid', x: 800, y: 320, width: 300, height: 28 },
        { id: 'bridge-right', x: 1240, y: 430, width: 320, height: 28 }
      ],
      enemies: [
        { id: 'slime-a', enemyId: 'forest-slime', x: 520, y: 420 },
        { id: 'slime-b', enemyId: 'forest-slime', x: 940, y: 330 },
        { id: 'slime-c', enemyId: 'forest-slime', x: 1450, y: 430 }
      ],
      pickups: [
        { id: 'coin-a', type: 'coin', x: 420, y: 370, value: 1 },
        { id: 'coin-b', type: 'coin', x: 840, y: 280, value: 1 },
        { id: 'boost-a', type: 'weaponBoost', x: 1280, y: 380, weaponId: 'starter-blaster' }
      ],
      exit: { x: 1830, y: 360, width: 90, height: 130 }
    },
    playerConfig: {
      id: 'hero-ranger',
      maxHealth: 5,
      moveSpeed: 260,
      jumpVelocity: 620,
      invulnerableSecondsAfterHit: 1,
      startWeaponId: 'starter-blaster'
    },
    weaponConfig: {
      id: 'starter-blaster',
      damage: 1,
      bulletSpeed: 720,
      fireCooldownSeconds: 0.22,
      boostedFireCooldownSeconds: 0.11,
      boostDurationSeconds: 8
    },
    enemyConfig: {
      id: 'forest-slime',
      maxHealth: 2,
      contactDamage: 1,
      moveSpeed: 90,
      patrolDistance: 160,
      score: 100
    }
  });
}

function startPreview() {
  const canvas = document.querySelector('#gameCanvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  const context = canvas.getContext('2d');
  const runtime = createPreviewRuntime();
  const inputState = createPreviewInputState();
  let lastFrameAt = performance.now();

  window.addEventListener('keydown', (event) => {
    inputState.activeCodes.add(event.code);
    if (event.code === 'KeyR') {
      runtime.restart();
      inputState.activeCodes.clear();
    }
  });
  window.addEventListener('keyup', (event) => inputState.activeCodes.delete(event.code));

  const tick = (now) => {
    const deltaSeconds = Math.min(0.033, (now - lastFrameAt) / 1000);
    lastFrameAt = now;

    const command = normalizeKeyboardInput(inputState.activeCodes);
    runtime.step(command, deltaSeconds);
    drawPreview(context, runtime.getViewModel(), runtime.getState(), canvas, now / 1000);

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

/* ───────── Main draw ───────── */

function drawPreview(context, view, state, canvas, time) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground(context, canvas, time);

  const cameraX = Math.max(0, view.player.position.x - 240);
  const toScreen = (position) => ({ x: position.x - cameraX, y: position.y });

  drawDistantTrees(context, cameraX);
  drawPlatforms(context, state.platforms, cameraX, time);
  drawExit(context, view.exit, cameraX, time);

  for (const pickup of view.pickups) {
    if (!pickup.collected) drawPickup(context, toScreen(pickup.position), pickup.type, time);
  }
  for (const enemy of view.enemies) {
    if (!enemy.defeated) drawEnemy(context, toScreen(enemy.position), enemy.health / enemy.maxHealth, time);
  }
  for (const bullet of view.bullets) {
    drawBullet(context, toScreen(bullet.position), time);
  }

  drawPlayer(context, toScreen(view.player.position), view.player.facing, view.player.grounded, time);
  drawHud(context, view);
}

/* ───────── Background ───────── */

function drawBackground(context, canvas, time) {
  // Sky gradient
  const sky = context.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#4a90d9');
  sky.addColorStop(0.35, '#87ceeb');
  sky.addColorStop(0.65, '#b8e6f0');
  sky.addColorStop(1, '#6ab04c');
  context.fillStyle = sky;
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Sun with glow
  const sunX = 780, sunY = 80;
  const sunGlow = context.createRadialGradient(sunX, sunY, 10, sunX, sunY, 80);
  sunGlow.addColorStop(0, 'rgba(255,240,150,0.9)');
  sunGlow.addColorStop(0.4, 'rgba(255,220,100,0.3)');
  sunGlow.addColorStop(1, 'rgba(255,200,50,0)');
  context.fillStyle = sunGlow;
  context.fillRect(sunX - 80, sunY - 80, 160, 160);
  context.fillStyle = '#fff5cc';
  context.beginPath();
  context.arc(sunX, sunY, 28, 0, Math.PI * 2);
  context.fill();

  // Clouds (animated drift)
  context.fillStyle = 'rgba(255,255,255,0.92)';
  const drift = (time * 8) % 960;
  for (const [bx, by, size] of [[100, 80, 70], [400, 55, 50], [700, 100, 60], [250, 130, 40]]) {
    const cx = ((bx + drift) % 1050) - 50;
    drawCloud(context, cx, by, size);
  }

  // Distant mountains
  context.fillStyle = 'rgba(100,140,100,0.35)';
  context.beginPath();
  context.moveTo(0, 420);
  context.lineTo(80, 300); context.lineTo(180, 380);
  context.lineTo(280, 260); context.lineTo(400, 370);
  context.lineTo(500, 290); context.lineTo(620, 360);
  context.lineTo(720, 280); context.lineTo(850, 370);
  context.lineTo(960, 310); context.lineTo(960, 420);
  context.closePath();
  context.fill();

  // Nearer hills
  context.fillStyle = 'rgba(80,160,60,0.3)';
  context.beginPath();
  context.moveTo(0, 460);
  context.quadraticCurveTo(150, 360, 300, 440);
  context.quadraticCurveTo(500, 380, 700, 450);
  context.quadraticCurveTo(850, 390, 960, 460);
  context.lineTo(960, 480); context.lineTo(0, 480);
  context.closePath();
  context.fill();
}

function drawCloud(context, x, y, size) {
  context.beginPath();
  context.arc(x, y, size * 0.38, 0, Math.PI * 2);
  context.arc(x + size * 0.3, y - size * 0.2, size * 0.32, 0, Math.PI * 2);
  context.arc(x + size * 0.6, y - size * 0.05, size * 0.28, 0, Math.PI * 2);
  context.arc(x + size * 0.85, y + size * 0.05, size * 0.25, 0, Math.PI * 2);
  context.fill();
}

function drawDistantTrees(context, cameraX) {
  const parallax = cameraX * 0.15;
  context.fillStyle = 'rgba(40,100,30,0.4)';
  for (let i = 0; i < 12; i++) {
    const tx = i * 90 + 30 - parallax;
    const th = 50 + (i % 3) * 20;
    const ty = 460 - th;
    // Trunk
    context.fillStyle = 'rgba(80,50,20,0.35)';
    context.fillRect(tx - 3, ty + th * 0.5, 6, th * 0.5);
    // Canopy (triangle pine)
    context.fillStyle = 'rgba(30,90,25,0.45)';
    context.beginPath();
    context.moveTo(tx, ty);
    context.lineTo(tx - 18, ty + th * 0.6);
    context.lineTo(tx + 18, ty + th * 0.6);
    context.closePath();
    context.fill();
  }
}

/* ───────── Platforms ───────── */

function drawPlatforms(context, platforms, cameraX, time) {
  for (const platform of platforms) {
    const x = platform.x - cameraX;
    const y = platform.y;
    const w = platform.width;
    const h = platform.height;

    if (platform.id === 'ground') {
      // Ground: dirt + grass top
      const dirt = context.createLinearGradient(0, y, 0, y + h);
      dirt.addColorStop(0, '#8B6914');
      dirt.addColorStop(1, '#6B4E12');
      context.fillStyle = dirt;
      context.fillRect(x, y + 8, w, h - 8);
      // Grass layer
      const grass = context.createLinearGradient(0, y, 0, y + 14);
      grass.addColorStop(0, '#4CAF50');
      grass.addColorStop(1, '#388E3C');
      context.fillStyle = grass;
      roundRect(context, x, y, w, 14, 4);
      context.fill();
      // Grass blades
      context.strokeStyle = '#66BB6A';
      context.lineWidth = 1.5;
      for (let gx = x + 8; gx < x + w; gx += 18) {
        const sway = Math.sin(time * 2 + gx * 0.05) * 3;
        context.beginPath();
        context.moveTo(gx, y);
        context.quadraticCurveTo(gx + sway, y - 10, gx + sway * 1.5, y - 14);
        context.stroke();
      }
    } else {
      // Floating platform: stone with moss
      const stoneGrad = context.createLinearGradient(0, y, 0, y + h);
      stoneGrad.addColorStop(0, '#9E9E9E');
      stoneGrad.addColorStop(1, '#757575');
      context.fillStyle = stoneGrad;
      roundRect(context, x, y + 4, w, h - 4, 6);
      context.fill();
      // Moss top
      const mossGrad = context.createLinearGradient(0, y, 0, y + 8);
      mossGrad.addColorStop(0, '#66BB6A');
      mossGrad.addColorStop(1, '#43A047');
      context.fillStyle = mossGrad;
      roundRect(context, x, y, w, 10, 5);
      context.fill();
      // Small grass tufts
      context.strokeStyle = '#81C784';
      context.lineWidth = 1;
      for (let gx = x + 12; gx < x + w - 10; gx += 24) {
        const sway = Math.sin(time * 1.8 + gx * 0.08) * 2;
        context.beginPath();
        context.moveTo(gx, y);
        context.lineTo(gx + sway, y - 7);
        context.stroke();
      }
    }
  }
}

/* ───────── Exit Portal ───────── */

function drawExit(context, exit, cameraX, time) {
  const cx = exit.x - cameraX + exit.width / 2;
  const cy = exit.y + exit.height / 2;
  const pulse = Math.sin(time * 3) * 0.15 + 1;

  // Outer glow
  const glow = context.createRadialGradient(cx, cy, 10, cx, cy, 70 * pulse);
  glow.addColorStop(0, 'rgba(180,130,255,0.5)');
  glow.addColorStop(0.6, 'rgba(120,80,220,0.2)');
  glow.addColorStop(1, 'rgba(80,40,180,0)');
  context.fillStyle = glow;
  context.fillRect(cx - 80, cy - 80, 160, 160);

  // Portal ring
  context.strokeStyle = '#9c5cff';
  context.lineWidth = 4;
  context.beginPath();
  context.ellipse(cx, cy, 32 * pulse, 50 * pulse, 0, 0, Math.PI * 2);
  context.stroke();

  // Inner swirl
  context.strokeStyle = 'rgba(200,170,255,0.6)';
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(cx, cy, 20 * pulse, 34 * pulse, time * 1.5, 0, Math.PI * 2);
  context.stroke();

  // Sparkles
  context.fillStyle = '#e0c0ff';
  for (let i = 0; i < 5; i++) {
    const angle = time * 2 + i * Math.PI * 0.4;
    const r = 38 + Math.sin(time * 4 + i) * 8;
    const sx = cx + Math.cos(angle) * r * 0.7;
    const sy = cy + Math.sin(angle) * r;
    const sparkleSize = 2 + Math.sin(time * 5 + i * 2) * 1.5;
    context.beginPath();
    context.arc(sx, sy, sparkleSize, 0, Math.PI * 2);
    context.fill();
  }

  // Arrow indicator
  context.fillStyle = '#ffd15c';
  context.font = 'bold 16px sans-serif';
  context.textAlign = 'center';
  const arrowBob = Math.sin(time * 4) * 4;
  context.fillText('▼ EXIT', cx, exit.y - 10 + arrowBob);
  context.textAlign = 'left';
}

/* ───────── Player ───────── */

function drawPlayer(context, position, facing, grounded, time) {
  if (!playerSprite || !playerSprite.complete) {
    // 图片未加载完成时绘制占位
    context.fillStyle = '#ff7043';
    context.fillRect(position.x - 16, position.y - 36, 32, 48);
    return;
  }

  const px = position.x;
  const py = position.y;
  const w = 64;  // 角色显示宽度
  const h = 80;  // 角色显示高度

  context.save();
  context.translate(px, py);
  context.scale(facing, 1);

  // 影子
  context.fillStyle = 'rgba(0,0,0,0.15)';
  context.beginPath();
  context.ellipse(0, h / 2 - 8, 16, 5, 0, 0, Math.PI * 2);
  context.fill();

  // 绘制AI生成的主角图片
  context.drawImage(playerSprite, -w / 2, -h + 10, w, h);

  context.restore();
}

/* ───────── Enemy (Slime) ───────── */

function drawEnemy(context, position, healthRatio, time) {
  const ex = position.x;
  const ey = position.y;
  const bounce = Math.sin(time * 3) * 3;
  const squash = 1 + Math.sin(time * 3) * 0.06;

  // Shadow
  context.fillStyle = 'rgba(0,0,0,0.12)';
  context.beginPath();
  context.ellipse(ex, ey + 2, 22 * squash, 6, 0, 0, Math.PI * 2);
  context.fill();

  // Body
  context.save();
  context.translate(ex, ey - 20 + bounce);
  context.scale(squash, 1 / squash);

  const slimeGrad = context.createRadialGradient(-5, -8, 4, 0, 0, 28);
  slimeGrad.addColorStop(0, '#81C784');
  slimeGrad.addColorStop(0.6, '#4CAF50');
  slimeGrad.addColorStop(1, '#2E7D32');
  context.fillStyle = slimeGrad;
  context.beginPath();
  context.moveTo(-24, 8);
  context.quadraticCurveTo(-26, -16, -10, -24);
  context.quadraticCurveTo(0, -30, 10, -24);
  context.quadraticCurveTo(26, -16, 24, 8);
  context.quadraticCurveTo(0, 16, -24, 8);
  context.closePath();
  context.fill();

  // Shine
  context.fillStyle = 'rgba(255,255,255,0.25)';
  context.beginPath();
  context.ellipse(-8, -14, 6, 10, -0.3, 0, Math.PI * 2);
  context.fill();

  // Eyes
  context.fillStyle = '#fff';
  context.beginPath();
  context.ellipse(-8, -6, 6, 7, 0, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.ellipse(8, -6, 6, 7, 0, 0, Math.PI * 2);
  context.fill();
  // Pupils
  context.fillStyle = '#1b5e20';
  context.beginPath();
  context.arc(-7, -5, 3, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(9, -5, 3, 0, Math.PI * 2);
  context.fill();
  // Eye highlights
  context.fillStyle = '#fff';
  context.beginPath();
  context.arc(-6, -7, 1.2, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(10, -7, 1.2, 0, Math.PI * 2);
  context.fill();

  // Mouth
  context.strokeStyle = '#1b5e20';
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(0, 2, 6, 0.1, Math.PI - 0.1);
  context.stroke();

  context.restore();

  // Health bar
  const barW = 40;
  const barX = ex - barW / 2;
  const barY = ey - 58 + bounce;
  context.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(context, barX - 1, barY - 1, barW + 2, 7, 3);
  context.fill();
  context.fillStyle = '#ef5350';
  roundRect(context, barX, barY, barW * healthRatio, 5, 2);
  context.fill();
  if (healthRatio > 0.5) {
    context.fillStyle = '#66BB6A';
    roundRect(context, barX, barY, barW * healthRatio, 5, 2);
    context.fill();
  }
}

/* ───────── Bullet ───────── */

function drawBullet(context, position, time) {
  const bx = position.x;
  const by = position.y - 24;

  // Glow
  const glow = context.createRadialGradient(bx, by, 2, bx, by, 14);
  glow.addColorStop(0, 'rgba(0,229,255,0.6)');
  glow.addColorStop(1, 'rgba(0,229,255,0)');
  context.fillStyle = glow;
  context.fillRect(bx - 14, by - 14, 28, 28);

  // Core
  const coreGrad = context.createRadialGradient(bx - 1, by - 1, 1, bx, by, 6);
  coreGrad.addColorStop(0, '#ffffff');
  coreGrad.addColorStop(0.4, '#00e5ff');
  coreGrad.addColorStop(1, '#0097a7');
  context.fillStyle = coreGrad;
  context.beginPath();
  context.arc(bx, by, 5, 0, Math.PI * 2);
  context.fill();

  // Trail
  context.fillStyle = 'rgba(0,229,255,0.3)';
  for (let i = 1; i <= 3; i++) {
    context.beginPath();
    context.arc(bx - i * 8, by, 3 - i * 0.5, 0, Math.PI * 2);
    context.fill();
  }
}

/* ───────── Pickups ───────── */

function drawPickup(context, position, type, time) {
  const px = position.x;
  const py = position.y - 18;
  const bob = Math.sin(time * 4) * 4;

  if (type === 'coin') {
    // Glow
    const glow = context.createRadialGradient(px, py + bob, 2, px, py + bob, 20);
    glow.addColorStop(0, 'rgba(255,215,0,0.4)');
    glow.addColorStop(1, 'rgba(255,215,0,0)');
    context.fillStyle = glow;
    context.fillRect(px - 20, py + bob - 20, 40, 40);

    // Coin body
    const coinGrad = context.createRadialGradient(px - 2, py + bob - 2, 2, px, py + bob, 11);
    coinGrad.addColorStop(0, '#fff176');
    coinGrad.addColorStop(0.5, '#ffd54f');
    coinGrad.addColorStop(1, '#f9a825');
    context.fillStyle = coinGrad;
    context.beginPath();
    context.arc(px, py + bob, 10, 0, Math.PI * 2);
    context.fill();

    // Dollar sign
    context.fillStyle = '#e65100';
    context.font = 'bold 12px sans-serif';
    context.textAlign = 'center';
    context.fillText('$', px, py + bob + 4);
    context.textAlign = 'left';

    // Sparkle
    const sparkleAngle = time * 3;
    context.fillStyle = 'rgba(255,255,255,0.8)';
    const sx = px + Math.cos(sparkleAngle) * 13;
    const sy = py + bob + Math.sin(sparkleAngle) * 13;
    drawStar(context, sx, sy, 3, 1.5, 4);
  } else {
    // Weapon boost
    const pulse = Math.sin(time * 5) * 0.2 + 1;

    const glow = context.createRadialGradient(px, py + bob, 2, px, py + bob, 24 * pulse);
    glow.addColorStop(0, 'rgba(123,97,255,0.5)');
    glow.addColorStop(1, 'rgba(123,97,255,0)');
    context.fillStyle = glow;
    context.fillRect(px - 28, py + bob - 28, 56, 56);

    // Crystal shape
    const crystalGrad = context.createLinearGradient(px - 10, py + bob - 14, px + 10, py + bob + 14);
    crystalGrad.addColorStop(0, '#b388ff');
    crystalGrad.addColorStop(0.5, '#7c4dff');
    crystalGrad.addColorStop(1, '#6200ea');
    context.fillStyle = crystalGrad;
    context.beginPath();
    context.moveTo(px, py + bob - 14 * pulse);
    context.lineTo(px + 10 * pulse, py + bob);
    context.lineTo(px, py + bob + 14 * pulse);
    context.lineTo(px - 10 * pulse, py + bob);
    context.closePath();
    context.fill();

    // Shine
    context.fillStyle = 'rgba(255,255,255,0.35)';
    context.beginPath();
    context.moveTo(px - 2, py + bob - 10);
    context.lineTo(px + 4, py + bob - 2);
    context.lineTo(px - 4, py + bob);
    context.closePath();
    context.fill();

    // Label
    context.fillStyle = '#e0c0ff';
    context.font = 'bold 10px sans-serif';
    context.textAlign = 'center';
    context.fillText('BOOST', px, py + bob + 24);
    context.textAlign = 'left';
  }
}

function drawStar(context, cx, cy, outerR, innerR, points) {
  context.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.fill();
}

/* ───────── HUD ───────── */

function drawHud(context, view) {
  // Background panel
  context.fillStyle = 'rgba(20,30,48,0.82)';
  roundRect(context, 12, 10, 500, 46, 10);
  context.fill();
  // Border
  context.strokeStyle = 'rgba(255,255,255,0.15)';
  context.lineWidth = 1;
  roundRect(context, 12, 10, 500, 46, 10);
  context.stroke();

  context.font = 'bold 15px Microsoft YaHei, sans-serif';

  // Health hearts
  const maxHearts = 5;
  const currentHearts = view.player.health;
  for (let i = 0; i < maxHearts; i++) {
    const hx = 28 + i * 22;
    const hy = 33;
    drawHeart(context, hx, hy, i < currentHearts ? '#ef5350' : '#555');
  }

  // Coin icon + count
  context.fillStyle = '#ffd54f';
  context.beginPath();
  context.arc(155, 33, 8, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#e65100';
  context.font = 'bold 9px sans-serif';
  context.textAlign = 'center';
  context.fillText('$', 155, 36);
  context.textAlign = 'left';
  context.fillStyle = '#fff';
  context.font = 'bold 15px Microsoft YaHei, sans-serif';
  context.fillText(`x${view.hud.coinText}`, 168, 38);

  // Objective
  context.fillStyle = '#b0bec5';
  context.font = '13px Microsoft YaHei, sans-serif';
  context.fillText(view.hud.objectiveText, 230, 38);

  // Weapon
  context.fillStyle = '#80cbc4';
  context.font = '13px Microsoft YaHei, sans-serif';
  context.fillText(`武器: ${view.hud.weaponText}`, 400, 38);

  // Result overlay
  if (view.result) {
    // Dim overlay
    context.fillStyle = 'rgba(10,15,30,0.75)';
    context.fillRect(0, 0, 960, 540);

    // Result panel
    context.fillStyle = 'rgba(30,40,65,0.95)';
    roundRect(context, 200, 120, 560, 300, 16);
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.2)';
    context.lineWidth = 2;
    roundRect(context, 200, 120, 560, 300, 16);
    context.stroke();

    // Title
    context.fillStyle = view.result.title.includes('Clear') ? '#66BB6A' : '#ef5350';
    context.font = 'bold 38px Microsoft YaHei, sans-serif';
    context.textAlign = 'center';
    context.fillText(view.result.title, 480, 185);

    // Stats
    context.fillStyle = '#cfd8dc';
    context.font = '18px Microsoft YaHei, sans-serif';
    context.fillText(`分数: ${view.result.score}`, 480, 230);
    context.fillText(`金币: ${view.result.coins}`, 480, 260);
    context.fillText(`击败: ${view.result.defeatedEnemies}`, 480, 290);
    context.fillText(`用时: ${view.result.elapsedSeconds}s`, 480, 320);

    // Restart hint
    context.fillStyle = '#ffd54f';
    context.font = 'bold 16px Microsoft YaHei, sans-serif';
    context.fillText('按 R 重新开始', 480, 370);
    context.textAlign = 'left';
  }
}

function drawHeart(context, x, y, color) {
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(x, y + 3);
  context.bezierCurveTo(x, y - 2, x - 7, y - 5, x - 7, y);
  context.bezierCurveTo(x - 7, y + 4, x, y + 9, x, y + 11);
  context.bezierCurveTo(x, y + 9, x + 7, y + 4, x + 7, y);
  context.bezierCurveTo(x + 7, y - 5, x, y - 2, x, y + 3);
  context.fill();
}

/* ───────── Utility ───────── */

function roundRect(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + w - r, y);
  context.quadraticCurveTo(x + w, y, x + w, y + r);
  context.lineTo(x + w, y + h - r);
  context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  context.lineTo(x + r, y + h);
  context.quadraticCurveTo(x, y + h, x, y + h - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

if (typeof window !== 'undefined') {
  startPreview();
}
