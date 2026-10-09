import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const tmpDir = () => mkdtempSync(join(tmpdir(), 'mc-'));
export const put = (root, rel, text) => {
  const f = join(root, rel);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, text);
  return f;
};
export const runCli = (script, args = [], input = '') => {
  const r = spawnSync(process.execPath, [join(ROOT, 'engine', script), ...args], { input, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
};
