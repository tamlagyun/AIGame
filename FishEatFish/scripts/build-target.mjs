import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'build-config', 'targets.json'), 'utf8'));
const args = process.argv.slice(2);
const targetName = args.find((arg) => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');

if (!targetName || !manifest.targets[targetName]) {
  console.error(`用法：node scripts/build-target.mjs <target> [--dry-run]\n可用目标：${Object.keys(manifest.targets).join(', ')}`);
  process.exit(2);
}

const target = manifest.targets[targetName];
if (target.host !== 'any' && target.host !== process.platform) {
  console.error(`${targetName} 必须在 ${target.host} 主机工具链运行，当前为 ${process.platform}。`);
  process.exit(3);
}

const missingEnvironment = (target.requiredEnvironment ?? []).filter((key) => !process.env[key]);
if (!dryRun && missingEnvironment.length) {
  console.error(`${targetName} 缺少平台配置：${missingEnvironment.join(', ')}`);
  process.exit(4);
}

const creator = process.env.COCOS_CREATOR_PATH ?? 'F:\\soft\\cocos\\Creator\\3.8.8\\CocosCreator.exe';
const buildArg = `platform=${target.platform};debug=true;buildPath=project://build`;
console.log(JSON.stringify({ target: targetName, creator, project: root, buildArg, sdkRequired: target.sdkRequired, dryRun }, null, 2));
if (dryRun) process.exit(0);
if (!existsSync(creator)) {
  console.error(`找不到 Cocos Creator：${creator}`);
  process.exit(5);
}

const result = spawnSync(creator, ['--project', root, '--build', buildArg], { stdio: 'inherit' });
process.exit(result.status ?? 1);

