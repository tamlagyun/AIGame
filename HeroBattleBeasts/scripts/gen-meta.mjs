import crypto from 'node:crypto';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const fromRoot = (...parts) => join(root, ...parts);

function generateUuid() {
  return crypto.randomUUID();
}

// Template for directories
function dirMeta(uuid) {
  return JSON.stringify({
    ver: '1.2.0',
    importer: 'directory',
    imported: true,
    uuid,
    files: [],
    subMetas: {},
    userData: {}
  }, null, 2) + '\n';
}

// Template for TypeScript files
function tsMeta(uuid) {
  return JSON.stringify({
    ver: '4.0.24',
    importer: 'typescript',
    imported: true,
    uuid,
    files: [],
    subMetas: {},
    userData: {}
  }, null, 2) + '\n';
}

// Template for JavaScript files
function jsMeta(uuid) {
  return JSON.stringify({
    ver: '4.0.24',
    importer: 'javascript',
    imported: true,
    uuid,
    files: [],
    subMetas: {},
    userData: {}
  }, null, 2) + '\n';
}

// Template for JSON config files
function jsonMeta(uuid) {
  return JSON.stringify({
    ver: '1.0.1',
    importer: 'json',
    imported: true,
    uuid,
    files: ['.json'],
    subMetas: {},
    userData: {}
  }, null, 2) + '\n';
}

// Track all generated UUIDs
const uuidMap = {};

function writeIfMissing(filePath, content) {
  if (!existsSync(filePath)) {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, content, 'utf8');
    console.log('  CREATED:', filePath.replace(root, ''));
    return true;
  }
  console.log('  EXISTS:', filePath.replace(root, ''));
  return false;
}

function writeDirMeta(dirPath, uuid) {
  return writeIfMissing(join(dirPath, '.meta'), dirMeta(uuid));
}
writeDirMeta.missing = function(dirPath) {
  return !existsSync(join(dirPath, '.meta'));
};

function writeTsMeta(filePath, uuid) {
  return writeIfMissing(filePath + '.meta', tsMeta(uuid));
}

function writeJsMeta(filePath, uuid) {
  return writeIfMissing(filePath + '.meta', jsMeta(uuid));
}

function writeJsonMeta(filePath, uuid) {
  return writeIfMissing(filePath + '.meta', jsonMeta(uuid));
}

console.log('=== Generating missing .meta files for HeroBattleBeasts ===\n');

// 1. Script subdirectories that need .meta
const scriptDirs = [
  'assets/scripts/core',
  'assets/scripts/runtime',
  'assets/scripts/data',
  'assets/scripts/platform',
  'assets/scripts/shared',
  'assets/scripts/ui',
  'assets/scripts/audio',
];

console.log('--- Script subdirectory .meta ---');
for (const dir of scriptDirs) {
  const dirPath = fromRoot(dir);
  const uuid = generateUuid();
  uuidMap[dir] = uuid;
  writeDirMeta(dirPath, uuid);
}

// 2. TypeScript files needing .meta
const tsFiles = [
  // core/
  'assets/scripts/core/GameState.ts',
  'assets/scripts/core/index.ts',
  // runtime/
  'assets/scripts/runtime/GameRuntime.ts',
  'assets/scripts/runtime/InputAdapter.ts',
  'assets/scripts/runtime/RuntimeViewModel.ts',
  'assets/scripts/runtime/GameBootstrap.ts',
  // cocos/
  'assets/scripts/cocos/GameAppComponent.ts',
  'assets/scripts/cocos/CocosNodeNames.ts',
  'assets/scripts/cocos/RuntimeNodeBinder.ts',
  // data/
  'assets/scripts/data/LevelData.ts',
  'assets/scripts/data/index.ts',
  // platform/
  'assets/scripts/platform/PlatformService.ts',
  'assets/scripts/platform/PlatformServiceEditor.ts',
  // shared/
  'assets/scripts/shared/types.ts',
  // ui/
  'assets/scripts/ui/index.ts',
  // audio/
  'assets/scripts/audio/index.ts',
];

console.log('\n--- TypeScript .meta ---');
for (const file of tsFiles) {
  const filePath = fromRoot(file);
  const uuid = generateUuid();
  uuidMap[file] = uuid;
  writeTsMeta(filePath, uuid);
}

// 3. JavaScript files needing .meta
const jsFiles = [
  'assets/scripts/core/GameState.js',
  'assets/scripts/runtime/GameRuntime.js',
  'assets/scripts/runtime/InputAdapter.js',
  'assets/scripts/runtime/RuntimeViewModel.js',
  'assets/scripts/cocos/GameAppComponent.js',
  'assets/scripts/cocos/CocosNodeNames.js',
  'assets/scripts/cocos/RuntimeNodeBinder.js',
  'assets/scripts/data/LevelData.js',
  'assets/scripts/platform/PlatformServiceEditor.js',
];

console.log('\n--- JavaScript .meta ---');
for (const file of jsFiles) {
  const filePath = fromRoot(file);
  const uuid = generateUuid();
  uuidMap[file] = uuid;
  writeJsMeta(filePath, uuid);
}

// 4. Config JSON files needing .meta
const jsonFiles = [
  'assets/resources/configs/player.json',
  'assets/resources/configs/weapon-basic.json',
  'assets/resources/configs/enemy-slime.json',
  'assets/resources/configs/level-001.json',
];

console.log('\n--- JSON config .meta ---');
for (const file of jsonFiles) {
  const filePath = fromRoot(file);
  const uuid = generateUuid();
  uuidMap[file] = uuid;
  writeJsonMeta(filePath, uuid);
}

// 5. Configs directory .meta
const configsDir = fromRoot('assets/resources/configs');
if (writeDirMeta.missing(configsDir)) {
  writeDirMeta(configsDir, generateUuid());
}

console.log('\n=== Complete ===');
console.log('GameAppComponent.ts UUID:', uuidMap['assets/scripts/cocos/GameAppComponent.ts']);
