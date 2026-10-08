import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../skills/explain/build-report.mjs', import.meta.url));
const BASE = { title: 'T', question: 'Q', summary: 'S', nodes: [], edges: [] };

function build(extra = {}, flags = []) {
  const dir = mkdtempSync(join(tmpdir(), 'avengers-report-'));
  const inPath = join(dir, 'report.json');
  const outPath = join(dir, 'report.html');
  writeFileSync(inPath, JSON.stringify({ ...BASE, ...extra }));
  const r = spawnSync(process.execPath, [script, inPath, outPath, ...flags], { encoding: 'utf8' });
  return { status: r.status, stderr: r.stderr, wrote: existsSync(outPath), html: existsSync(outPath) ? readFileSync(outPath, 'utf8') : '' };
}

test('a report with no type or audience builds as workflow / developers', () => {
  const r = build();
  assert.equal(r.status, 0);
  assert.match(r.html, /Treated as: Workflow question/);
  assert.match(r.html, /For: Developers/);
  assert.match(r.html, /<body data-view="dev">/);
});

test('a logic report for QA renders its table and opens on the plain view', () => {
  const r = build({
    type: 'logic', audience: 'qa',
    sections: [{ heading: 'Decision table', kind: 'table', columns: ['Condition', 'Outcome'], rows: [['Amount over limit', 'Rejected']] }],
  });
  assert.equal(r.status, 0);
  assert.match(r.html, /Treated as: Logic question/);
  assert.match(r.html, /For: QA/);
  assert.match(r.html, /<h2>Decision table<\/h2>/);
  assert.match(r.html, /<th>Condition<\/th>/);
  assert.match(r.html, /<td>Rejected<\/td>/);
  assert.match(r.html, /<body data-view="plain">/);
});

test('list and text sections render', () => {
  const r = build({ sections: [{ heading: 'Edge cases', kind: 'list', items: ['Empty cart'] }, { heading: 'User impact', kind: 'text', text: 'A user sees a message.' }] });
  assert.match(r.html, /<h2>Edge cases<\/h2><ul><li>Empty cart<\/li><\/ul>/);
  assert.match(r.html, /<h2>User impact<\/h2><div class="card"><p>A user sees a message\.<\/p><\/div>/);
});

test('an unknown type or audience falls back with one warning and no value in it', () => {
  const r = build({ type: 'banana', audience: 'wizard' });
  assert.equal(r.status, 0);
  assert.match(r.stderr, /unknown type/);
  assert.match(r.stderr, /unknown audience/);
  assert.doesNotMatch(r.stderr, /banana|wizard/);
  assert.match(r.html, /Treated as: Workflow question/);
  assert.match(r.html, /For: Developers/);
});

test('an unknown section kind is ignored', () => {
  const r = build({ sections: [{ heading: 'Mystery', kind: 'carousel' }] });
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.html, /Mystery/);
});

test('HTML in a section cell is escaped', () => {
  const r = build({ sections: [{ heading: 'H', kind: 'table', columns: ['A'], rows: [['<script>alert(1)</script>']] }] });
  assert.doesNotMatch(r.html, /<script>alert\(1\)<\/script>/);
  assert.match(r.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('a secret in a section cell is refused, nothing is written, the value is not printed', () => {
  const secret = 'AKIAABCDEFGHIJKLMNOP';
  const r = build({ sections: [{ heading: 'H', kind: 'table', columns: ['A'], rows: [[secret]] }] });
  assert.equal(r.status, 3);
  assert.equal(r.wrote, false);
  assert.doesNotMatch(r.stderr, new RegExp(secret));
});

test('--plain still opens a developer report on the plain view', () => {
  const r = build({ audience: 'dev' }, ['--plain']);
  assert.match(r.html, /<body data-view="plain">/);
});
