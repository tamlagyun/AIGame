import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

test('统一构建清单覆盖全部目标平台', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'build-config', 'targets.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest.targets), [
    'web-desktop',
    'wechatgame',
    'bytedance-mini-game',
    'android',
    'ios',
    'harmonyos-next'
  ]);
  assert.equal(manifest.targets.ios.host, 'darwin');
  assert.equal(manifest.targets['web-desktop'].sdkRequired, false);
});

