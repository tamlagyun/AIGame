import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const fromRoot = (...parts) => join(root, ...parts);

function listFiles(dir, extensions) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return listFiles(fullPath, extensions);
    }
    return extensions.some((extension) => entry.name.endsWith(extension)) ? [fullPath] : [];
  });
}

test('assets scripts do not import Node builtins in Cocos runtime path', () => {
  const offenders = listFiles(fromRoot('assets/scripts'), ['.js', '.ts'])
    .filter((file) => /from ['"]node:/.test(readFileSync(file, 'utf8')));

  assert.deepEqual(offenders.map((file) => file.replace(`${root}\\`, '')), []);
});

test('assets TypeScript files contain runtime implementations instead of declare-only exports', () => {
  const offenders = listFiles(fromRoot('assets/scripts'), ['.ts'])
    .filter((file) => /\bexport\s+declare\b/.test(readFileSync(file, 'utf8')));

  assert.deepEqual(offenders.map((file) => file.replace(`${root}\\`, '')), []);
});

test('assets JavaScript files avoid private fields for Cocos browser compatibility', () => {
  const offenders = listFiles(fromRoot('assets/scripts'), ['.js'])
    .filter((file) => /#[A-Za-z_]/.test(readFileSync(file, 'utf8')));

  assert.deepEqual(offenders.map((file) => file.replace(`${root}\\`, '')), []);
});

test('Cocos component TypeScript entry exists with concrete class implementation', () => {
  const componentPath = fromRoot('assets/scripts/cocos/GameAppComponent.ts');
  const content = readFileSync(componentPath, 'utf8');

  assert.equal(existsSync(componentPath), true);
  assert.match(content, /@ccclass\(['"]GameAppComponent['"]\)/);
  assert.match(content, /export class GameAppComponent extends Component/);
  assert.match(content, /\bstart\(\): void/);
  assert.doesNotMatch(content, /export declare class GameAppComponent/);
});

test('runtime bootstrap uses a Cocos preview safe timer', () => {
  const bootstrapPath = fromRoot('assets/scripts/cocos/GameBootstrap.ts');
  const content = readFileSync(bootstrapPath, 'utf8');

  assert.match(content, /\bDate\.now\(\)/);
  assert.doesNotMatch(content, /\bsys\.now\(\)/);
});

test('runtime bootstrap sends normalized input commands into GameRuntime', () => {
  const bootstrapPath = fromRoot('assets/scripts/cocos/GameBootstrap.ts');
  const content = readFileSync(bootstrapPath, 'utf8');
  const inputFactory = content.match(/function createInputCommand[\s\S]*?\n}/)?.[0] ?? '';

  assert.match(content, /runtime\.step\(createInputCommand\(inputState\), deltaSeconds\)/);
  assert.match(inputFactory, /\bmoveX:/);
  assert.match(inputFactory, /\bjumpPressed:/);
  assert.match(inputFactory, /\bshootPressed:/);
  assert.match(inputFactory, /\bpausePressed:/);
  assert.doesNotMatch(inputFactory, /\bleft:/);
  assert.doesNotMatch(inputFactory, /\bright:/);
});
