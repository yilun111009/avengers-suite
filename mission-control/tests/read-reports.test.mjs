import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpDir, put, runCli } from './helpers.mjs';
import { loadReports, collectCites } from '../engine/read-reports.mjs';
import { REPORT_FIELDS_USED } from '../engine/constants.mjs';

const baselineText = readFileSync(fileURLToPath(new URL('./fixtures/report-baseline.json', import.meta.url)), 'utf8');
const baseline = JSON.parse(baselineText);

test('interface: the baseline report still carries every field the planner reads', () => {
  for (const f of REPORT_FIELDS_USED) assert.ok(f in baseline, `report.json lost the field "${f}"; update the planner before upgrading repo-avengers`);
});

test('interface: the fixture matches the sibling repo-avengers baseline (skipped when it is not next to this folder)', (t) => {
  const sibling = fileURLToPath(new URL('../../repo-avengers/tests/fixtures/report-baseline.json', import.meta.url));
  if (!existsSync(sibling)) return t.skip('repo-avengers is not a sibling folder');
  assert.deepEqual(JSON.parse(readFileSync(sibling, 'utf8')), baseline, 'repo-avengers changed its report format: review the fields in REPORT_FIELDS_USED, then refresh the fixture');
});

test('loadReports reads one folder', () => {
  const root = tmpDir();
  put(root, 'docs/flows/refund-flow/report.json', baselineText);
  const r = loadReports(root, ['refund-flow']);
  assert.deepEqual(r.errors, []);
  assert.equal(r.reports.length, 1);
  assert.equal(r.reports[0].slug, 'refund-flow');
  assert.equal(r.reports[0].data.title, 'Baseline report');
});

test('loadReports reads an /assemble folder: the combined report and each hero that has one', () => {
  const root = tmpDir();
  put(root, 'docs/flows/team/report.json', JSON.stringify({ type: 'assemble', title: 'Team run', summary: 'combined' }));
  put(root, 'docs/flows/team/heroes/hulk/report.json', baselineText);
  put(root, 'docs/flows/team/heroes/loki/notes.txt', 'this hero failed and wrote no report.json');
  const r = loadReports(root, ['team']);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.reports.map((x) => x.slug), ['team', 'team/heroes/hulk']);
});

test('loadReports names each problem and keeps going', () => {
  const root = tmpDir();
  put(root, 'docs/flows/bad/report.json', '{');
  put(root, 'docs/flows/notitle/report.json', JSON.stringify({ summary: 'x' }));
  put(root, 'docs/flows/empty/keep.txt', 'x');
  put(root, 'docs/flows/ok/report.json', baselineText);
  const r = loadReports(root, ['../x', 'gone', 'bad', 'notitle', 'empty', 'ok']);
  assert.equal(r.reports.length, 1);
  assert.equal(r.reports[0].slug, 'ok');
  assert.equal(r.errors.length, 5);
  assert.ok(r.errors.some((e) => e.startsWith('../x:')));
  assert.ok(r.errors.some((e) => e.startsWith('gone:') && e.includes('no folder')));
  assert.ok(r.errors.some((e) => e.startsWith('bad:') && e.includes('not valid JSON')));
  assert.ok(r.errors.some((e) => e.startsWith('notitle:') && e.includes('title')));
  assert.ok(r.errors.some((e) => e.startsWith('empty:') && e.includes('no report.json')));
});

test('collectCites finds citations in sources, steps, rules, section cells and /assemble results', () => {
  const cites = collectCites([
    { slug: 'a', data: baseline },
    { slug: 'b', data: { sources: ['src/b.ts:5'], results: [{ sources: ['src/c.ts:9', 'not a cite'] }] } },
  ]);
  assert.deepEqual([...cites].sort(), ['src/a.ts:1', 'src/a.ts:2', 'src/b.ts:5', 'src/c.ts:9']);
});

test('collectCites survives odd reports (Review Focus 1)', () => {
  const odd = { title: 't', summary: 's', steps: 'nope', rules: [null, { cite: 5 }], sections: [{ rows: ['a string row', [null, 'src/z.ts:2']] }, null], sources: null };
  assert.deepEqual(collectCites([{ slug: 'odd', data: odd }]), ['src/z.ts:2']);
  assert.deepEqual(collectCites([{ slug: 'none', data: {} }]), []);
});

test('the CLI prints reports, errors and cites', () => {
  const root = tmpDir();
  put(root, 'docs/flows/refund-flow/report.json', baselineText);
  const r = runCli('read-reports.mjs', [root, 'refund-flow']);
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.reports.length, 1);
  assert.deepEqual([...out.cites].sort(), ['src/a.ts:1', 'src/a.ts:2']);
  assert.equal(runCli('read-reports.mjs', [root]).status, 2);
});
