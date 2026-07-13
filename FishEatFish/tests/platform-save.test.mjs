import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultSaveData, migrateSaveData } from '../assets/scripts/core/save.ts';
import { PlatformServiceEditor } from '../assets/scripts/platform/PlatformServiceEditor.ts';
import { createPlatformService } from '../assets/scripts/platform/PlatformAdapters.ts';

test('默认存档使用格式版本 1，未知版本安全降级', () => {
  const save = createDefaultSaveData();
  assert.equal(save.schemaVersion, 1);
  assert.equal(save.player.level, 1);
  assert.equal(migrateSaveData({ schemaVersion: 999 }).schemaVersion, 1);
});

test('编辑器平台服务提供内存存档与安全降级', async () => {
  const platform = new PlatformServiceEditor();
  const save = createDefaultSaveData();
  save.player.level = 3;
  assert.deepEqual(await platform.save(save), { ok: true });
  assert.equal((await platform.load()).player.level, 3);
  assert.equal((await platform.share({ title: '鲫鱼吃鲤鱼' })).ok, false);
  assert.equal((await platform.showRewardAd('test')).rewarded, false);
  assert.deepEqual(platform.getSafeArea(), { top: 0, right: 0, bottom: 0, left: 0 });
});

test('未接入 SDK 的平台适配器明确失败', () => {
  assert.equal(createPlatformService('editor').target, 'editor');
  assert.throws(() => createPlatformService('wechat'), /requires its SDK integration/);
});

