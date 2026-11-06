import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const studioRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The distributed kit contains an isolated snapshot; development reads the source workspace.
export const baseRoot = fs.existsSync(path.join(studioRoot, 'templates/base/package.json'))
  ? path.join(studioRoot, 'templates/base') : path.resolve(studioRoot, '..');
export const appFiles = ['src', 'worker', 'migrations', 'public', 'tests', 'scripts/init-secrets.mjs',
  'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'vitest.config.ts',
  'playwright.config.ts', 'index.html', 'worker-configuration.d.ts'];
export function copyBase(destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const file of appFiles) fs.cpSync(path.join(baseRoot, file), path.join(destination, file), { recursive: true });
}
export function write(root, relative, value) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
}
export function patch(root, relative, transform) {
  const target = path.join(root, relative);
  fs.writeFileSync(target, transform(fs.readFileSync(target, 'utf8')));
}
export function replaceOnce(source, search, replacement) {
  if (!source.includes(search)) throw new Error('Base incompatible: falta el marcador ' + search.slice(0, 75));
  return source.replace(search, replacement);
}
export function args(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) throw new Error('Argumento inesperado: ' + argv[i]);
    const key = argv[i].slice(2);
    if (!argv[i + 1] || argv[i + 1].startsWith('--')) result[key] = true;
    else result[key] = argv[++i];
  }
  return result;
}
export function json(root, relative, value) { write(root, relative, JSON.stringify(value, null, 2) + '\n'); }
export function files(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(path.join(root, entry.name)) : [path.join(root, entry.name)]);
}
