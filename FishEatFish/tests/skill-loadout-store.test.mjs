import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSkillConfig } from '../assets/scripts/data/ConfigValidator.ts';
import { SkillLoadoutStore } from '../assets/scripts/data/SkillLoadoutStore.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const readSkill = (name) => parseSkillConfig(JSON.parse(readFileSync(join(root, 'assets', 'resources', 'configs', name), 'utf8')));

test('技能装配存储可把未装备技能替换进指定槽位并恢复存档', () => {
  const primary = readSkill('skill-basic-bite.json');
  const defaults = [
    readSkill('skill-dash-bite.json'),
    readSkill('skill-whale-swallow.json'),
    readSkill('skill-placeholder-3.json'),
    readSkill('skill-placeholder-4.json')
  ];
  const extra = {
    ...defaults[0],
    id: 'skill-future-test',
    displayName: '未来技能',
    networkSkillId: 'skill-future-test',
    ui: { ...defaults[0].ui, nodeName: 'FutureSkillButton', slotIndex: 9 }
  };
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const store = new SkillLoadoutStore([primary, ...defaults, extra], defaults, 4, storage);
  assert.deepEqual(store.getAvailableSkills().map((skill) => skill.id), ['skill-future-test']);
  assert.equal(store.replace(2, 'skill-future-test'), true);
  assert.equal(store.getEquippedSkills()[2].id, 'skill-future-test');
  assert.equal(store.getEquippedSkills()[2].ui.slotIndex, 2);
  assert.equal(store.getEquippedSkills()[2].ui.nodeName, 'SkillSlot3Button');

  const restored = new SkillLoadoutStore([primary, ...defaults, extra], defaults, 4, storage);
  assert.equal(restored.getEquippedSkills()[2].id, 'skill-future-test');
  assert.deepEqual(restored.getAvailableSkills().map((skill) => skill.id), [defaults[2].id]);
  assert.equal(restored.replace(1, 'skill-future-test'), false);
});
