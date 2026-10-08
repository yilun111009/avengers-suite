import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../engine/build-index.mjs', import.meta.url));

function buildIndex(reports) {
  const flows = join(mkdtempSync(join(tmpdir(), 'avengers-index-')), 'docs', 'flows');
  mkdirSync(flows, { recursive: true });
  for (const [name, content] of Object.entries(reports)) {
    mkdirSync(join(flows, name), { recursive: true });
    writeFileSync(join(flows, name, 'report.json'), content);
  }
  const r = spawnSync(process.execPath, [script, flows], { encoding: 'utf8' });
  return { status: r.status, html: readFileSync(join(flows, 'index.html'), 'utf8') };
}

test('each report carries its type, and a type filter is present', () => {
  const r = buildIndex({ a: JSON.stringify({ title: 'A', type: 'logic' }), b: JSON.stringify({ title: 'B', type: 'support' }) });
  assert.equal(r.status, 0);
  assert.match(r.html, /data-type="logic"/);
  assert.match(r.html, /data-type="support"/);
  assert.match(r.html, /<select id="t"/);
  assert.match(r.html, /<option value="impact">impact<\/option>/);
});

test('a report with no type, an unknown type, or unreadable JSON is listed as workflow', () => {
  const r = buildIndex({ legacy: JSON.stringify({ title: 'L' }), odd: JSON.stringify({ title: 'O', type: 'banana' }), broken: '{not json' });
  assert.equal(r.status, 0);
  assert.equal((r.html.match(/data-type="workflow"/g) ?? []).length, 3);
  assert.doesNotMatch(r.html, /banana/);
});

test('the index lists and filters the three new types', () => {
  const r = buildIndex({ a: JSON.stringify({ title: 'A', type: 'deadcode' }), b: JSON.stringify({ title: 'B', type: 'deepdive' }), c: JSON.stringify({ title: 'C', type: 'risk' }) });
  assert.match(r.html, /data-type="deadcode"/);
  assert.match(r.html, /data-type="deepdive"/);
  assert.match(r.html, /data-type="risk"/);
  assert.match(r.html, /<option value="risk">risk<\/option>/);
});

test('the index lists and filters assemble reports', () => {
  const r = buildIndex({ a: JSON.stringify({ title: 'Team run', type: 'assemble' }) });
  assert.match(r.html, /data-type="assemble"/);
  assert.match(r.html, /<option value="assemble">assemble<\/option>/);
});
