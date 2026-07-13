import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const ignoredDirectories = new Set(['.git', '.creator', 'library', 'temp', 'local', 'build', 'profiles', 'node_modules', 'logs', 'output', 'art-output']);
const forbiddenDirectories = new Set(['.creator', 'library', 'temp', 'local', 'build', 'profiles', 'node_modules', 'logs', 'output', 'art-output']);
const textExtensions = new Set(['.ts', '.js', '.mjs', '.json', '.md', '.txt', '.scene', '.meta', '.gitignore', '.editorconfig']);
const binaryArtExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.mp3', '.wav', '.ogg']);
const errors = [];
const files = [];
const directories = [];

const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    const projectPath = relative(root, absolute).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      directories.push({ absolute, projectPath });
      if (!ignoredDirectories.has(entry.name)) walk(absolute);
    } else {
      files.push({ absolute, projectPath });
    }
  }
};
walk(root);

for (const { absolute, projectPath } of files) {
  if (statSync(absolute).size === 0) errors.push(`空文件：${projectPath}`);
  if (projectPath.toLowerCase().endsWith('.svg')) errors.push(`禁止 SVG：${projectPath}`);
  if (/\.(keystore|jks|p12|mobileprovision|pem|key)$/i.test(projectPath)) errors.push(`禁止签名或密钥：${projectPath}`);

  const extension = extname(projectPath).toLowerCase() || (projectPath.startsWith('.') ? projectPath : '');
  if (textExtensions.has(extension)) {
    const bytes = readFileSync(absolute);
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (text.includes('\r\n')) errors.push(`不是 LF 换行：${projectPath}`);
    } catch {
      errors.push(`不是有效 UTF-8：${projectPath}`);
    }
  }
}

const assetFiles = files.filter(({ projectPath }) => projectPath.startsWith('assets/'));
for (const { absolute, projectPath } of assetFiles) {
  if (projectPath.endsWith('.meta')) {
    const source = absolute.slice(0, -5);
    if (!existsSync(source)) errors.push(`孤立 .meta：${projectPath}`);
  } else if (!existsSync(`${absolute}.meta`)) {
    errors.push(`缺少 .meta：${projectPath}`);
  }
}

for (const { absolute, projectPath } of directories.filter((directory) => directory.projectPath.startsWith('assets/'))) {
  if (!existsSync(`${absolute}.meta`)) errors.push(`资源目录缺少 .meta：${projectPath}`);
}

try {
  const gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' }).trim();
  const projectPrefix = relative(gitRoot, root).replaceAll('\\', '/');
  const tracked = execFileSync('git', ['ls-files'], { cwd: gitRoot, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
  for (const trackedPath of tracked.filter((path) => path === projectPrefix || path.startsWith(`${projectPrefix}/`))) {
    const localPath = trackedPath.slice(projectPrefix.length + 1);
    const segments = localPath.split('/');
    if (segments.some((segment) => forbiddenDirectories.has(segment)) || /\.(log|keystore|jks|p12|mobileprovision|pem|key)$/i.test(localPath)) {
      errors.push(`禁止文件已被 Git 跟踪：${localPath}`);
    }
  }
} catch {
  errors.push('无法读取 Git 跟踪状态');
}

for (const layer of ['assets/scripts/core', 'assets/scripts/data', 'assets/scripts/shared']) {
  for (const { absolute, projectPath } of files.filter((file) => file.projectPath.startsWith(layer) && file.projectPath.endsWith('.ts'))) {
    const text = readFileSync(absolute, 'utf8');
    if (/from\s+['\"]cc['\"]/.test(text)) errors.push(`核心层越界导入 Cocos：${projectPath}`);
    if (/\b(wx|tt)\./.test(text)) errors.push(`核心层越界调用平台 API：${projectPath}`);
  }
}

const hashes = new Map();
for (const { absolute, projectPath } of files.filter((file) => binaryArtExtensions.has(extname(file.projectPath).toLowerCase()))) {
  const hash = createHash('sha256').update(readFileSync(absolute)).digest('hex');
  if (hashes.has(hash)) errors.push(`重复二进制资源：${hashes.get(hash)} 与 ${projectPath}`);
  else hashes.set(hash, projectPath);
}

if (errors.length) {
  console.error(`项目卫生检查失败（${errors.length} 项）：\n${errors.join('\n')}`);
  process.exit(1);
}
console.log(`项目卫生检查通过：扫描 ${files.length} 个文件，无 SVG、凭证、编码、.meta、重复资源或分层问题。`);
