import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpDir, put, runCli } from './helpers.mjs';
import { localDate } from '../engine/naming.mjs';

test('plan-slug CLI: <date>-<topic> from the plan title', () => {
  const r = runCli('plan-slug.mjs', [tmpDir()], 'Add partial refunds to checkout!\n');
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), `${localDate()}-add-partial-refunds-to-checkout`);
});

test('plan-slug CLI never returns an empty topic (Review Focus 5)', () => {
  assert.equal(runCli('plan-slug.mjs', [tmpDir()], '退款流程\n').stdout.trim(), `${localDate()}-plan`);
  assert.equal(runCli('plan-slug.mjs', [tmpDir()], '!!!\n').stdout.trim(), `${localDate()}-plan`);
});

test('plan-slug CLI skips a folder that already exists: -2, -3', () => {
  const root = tmpDir();
  const base = `${localDate()}-add-refunds`;
  put(root, `docs/plans/${base}/plan.json`, '{}');
  assert.equal(runCli('plan-slug.mjs', [root], 'Add refunds\n').stdout.trim(), `${base}-2`);
  put(root, `docs/plans/${base}-2/plan.json`, '{}');
  assert.equal(runCli('plan-slug.mjs', [root], 'Add refunds\n').stdout.trim(), `${base}-3`);
});

test('final review I3: the CLI still runs when engine/ is reached through a junction or symlink', async () => {
  const { symlinkSync } = await import('node:fs');
  const { spawnSync } = await import('node:child_process');
  const { join } = await import('node:path');
  const { ROOT } = await import('./helpers.mjs');
  const link = join(tmpDir(), 'engine-link');
  symlinkSync(join(ROOT, 'engine'), link, 'junction');
  const r = spawnSync(process.execPath, [join(link, 'plan-slug.mjs'), tmpDir()], { input: 'Add refunds\n', encoding: 'utf8' });
  assert.equal(r.stdout.trim(), `${localDate()}-add-refunds`);
});

test('naming.mjs is the same as the repo-avengers naming rule (skipped when it is not a sibling)', (t) => {
  const sibling = fileURLToPath(new URL('../../repo-avengers/engine/naming.mjs', import.meta.url));
  if (!existsSync(sibling)) return t.skip('repo-avengers is not a sibling folder');
  const strip = (s) => s.replace(/^\/\/ COPY of .*\n/, '').replace(/\r\n/g, '\n');
  assert.equal(strip(readFileSync(fileURLToPath(new URL('../engine/naming.mjs', import.meta.url)), 'utf8')), strip(readFileSync(sibling, 'utf8')));
});
