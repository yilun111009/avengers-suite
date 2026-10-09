import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, tmpDir, put, runCli } from './helpers.mjs';

const fx = (n) => readFileSync(join(ROOT, 'tests', 'fixtures', n), 'utf8');

test('the whole pipeline on a temp repo, running the same commands the skill runs', () => {
  const repo = tmpDir();
  put(repo, 'docs/flows/refund-flow/report.json', fx('report-baseline.json'));
  put(repo, 'src/a.ts', 'one\ntwo\n'); // the baseline cites src/a.ts:1 and src/a.ts:2

  const parsed = JSON.parse(runCli('parse-command.mjs', [repo], 'refund-flow on sonnet add partial refunds\n').stdout);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.model, 'sonnet');

  const read = JSON.parse(runCli('read-reports.mjs', [repo, ...parsed.slugs]).stdout);
  assert.deepEqual(read.errors, []);

  const checked = runCli('check-citations.mjs', [repo], JSON.stringify(read.cites));
  const counts = JSON.parse(checked.stdout).counts;
  assert.equal(counts.ok, 2);

  const slug = runCli('plan-slug.mjs', [repo], 'Add partial refunds\n').stdout.trim();
  assert.match(slug, /^\d{4}-\d{2}-\d{2}-add-partial-refunds$/);
  const dir = join(repo, 'docs', 'plans', slug);
  put(repo, `docs/plans/${slug}/plan.json`, fx('plan-sample.json'));
  writeFileSync(join(dir, 'checks.json'), checked.stdout);

  const built = runCli('build-plan.mjs', [join(dir, 'plan.json'), dir, '--model', 'sonnet', '--slugs', parsed.slugs.join(','), '--checks', join(dir, 'checks.json'), '--commit', 'abc1234']);
  assert.equal(built.status, 0, built.stderr);
  for (const f of ['plan.json', 'plan.html', 'plan.md', 'checks.json']) assert.ok(existsSync(join(dir, f)), f);
  assert.match(readFileSync(join(dir, 'plan.html'), 'utf8'), /Planned by <b>sonnet<\/b>/);
  assert.equal(JSON.parse(readFileSync(join(dir, 'plan.json'), 'utf8')).checks.counts.ok, 2);
});
