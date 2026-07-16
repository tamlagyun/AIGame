import test from 'node:test';
import assert from 'node:assert/strict';
import { CombatService } from '../src/combat/combat-service.js';
import { createCombatState } from '../src/combat/combat-state.js';

const player = (id: string, x: number, y = 0) => ({ playerId: id, x, y, rotation: 0, combat: createCombatState() });

test('server applies cone damage using the visible fish hit radius and enforces cooldown', () => {
  const combat = new CombatService(); const attacker = player('a', 0); const target = player('b', 128); const players = [attacker, target];
  const first = combat.useSkill(attacker, 'skill-basic-bite', 1, players, 0, 1);
  assert.equal(first.accepted, true); assert.equal(target.combat.health, 85); assert.equal(first.events.some((event) => event.type === 'hitConfirmed'), true);
  const blocked = combat.useSkill(attacker, 'skill-basic-bite', 2, players, 100, 2);
  assert.equal(blocked.accepted, false); assert.equal(blocked.reason, 'cooldown'); assert.equal(target.combat.health, 85);
  target.y = 100; const outside = combat.useSkill(attacker, 'skill-basic-bite', 3, players, 1000, 3);
  assert.equal(outside.hitCount, 0);
});

test('server settles death, experience and respawn invulnerability', () => {
  const combat = new CombatService(); const attacker = player('a', 0); const target = player('b', 50); const players = [attacker, target];
  let now = 0;
  for (let i = 1; i <= 6; i += 1) { now += 600; combat.useSkill(attacker, 'skill-basic-bite', i, players, now, i); }
  assert.equal(target.combat.dead, false);
  now += 600; const result = combat.useSkill(attacker, 'skill-basic-bite', 7, players, now, 7);
  assert.equal(target.combat.dead, true); assert.equal(attacker.combat.kills, 1); assert.equal(attacker.combat.experience, 10); assert.equal(result.events.some((event) => event.type === 'playerDied'), true);
  const respawn = combat.respawn(target, now + 3000, 0, 0, 10);
  assert.equal(respawn?.type, 'playerRespawned'); assert.equal(target.combat.health, 100); assert.ok((target.combat.invulnerableUntil ?? 0) > now + 3000);
});

test('server moves dash bite before authoritative hit detection', () => {
  const combat = new CombatService();
  const attacker = player('a', 0);
  const target = player('b', 300);
  const result = combat.useSkill(attacker, 'skill-dash-bite', 1, [attacker, target], 0, 1, (distance) => { attacker.x += distance; });
  assert.equal(attacker.x, 240);
  assert.equal(result.accepted, true);
  assert.equal(result.hitCount, 1);
  assert.equal(target.combat.health, 70);
});

test('whale swallow selects the nearest valid target, teleports without damage and enforces cooldown', () => {
  const combat = new CombatService();
  const attacker = player('a', 0);
  const nearest = player('b', 420, 20);
  const farther = player('c', 700, 0);
  let teleport = { x: attacker.x, y: attacker.y };
  const result = combat.useSkill(
    attacker,
    'skill-whale-swallow',
    1,
    [attacker, farther, nearest],
    0,
    1,
    undefined,
    (x, y) => {
      attacker.x = x;
      attacker.y = y;
      teleport = { x, y };
    }
  );
  assert.equal(result.accepted, true);
  assert.equal(result.targetId, nearest.playerId);
  assert.deepEqual(teleport, { x: nearest.x, y: nearest.y });
  assert.equal(nearest.combat.health, 100);
  assert.equal(result.events.some((event) => event.type === 'playerDamaged'), false);

  const blocked = combat.useSkill(attacker, 'skill-whale-swallow', 2, [attacker, nearest], 1000, 2);
  assert.equal(blocked.accepted, false);
  assert.equal(blocked.reason, 'cooldown');
});

test('whale swallow without a target does not consume its input tick or cooldown', () => {
  const combat = new CombatService();
  const attacker = player('a', 0);
  const target = player('b', 900);
  const rejected = combat.useSkill(attacker, 'skill-whale-swallow', 1, [attacker, target], 0, 1);
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason, 'noTarget');
  assert.equal(attacker.combat.lastSkillTick, 0);
  assert.equal(attacker.combat.skillCooldowns['skill-whale-swallow'], undefined);

  target.x = 700;
  const accepted = combat.useSkill(attacker, 'skill-whale-swallow', 1, [attacker, target], 0, 2);
  assert.equal(accepted.accepted, true);
});
