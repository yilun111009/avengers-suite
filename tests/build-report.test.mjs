import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../engine/build-report.mjs', import.meta.url));
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

test('a deadcode report builds with its own label', () => {
  const r = build({ type: 'deadcode' });
  assert.equal(r.status, 0);
  assert.match(r.html, /Treated as: Dead code question/);
});

test('deepdive and risk reports build with their own labels', () => {
  assert.match(build({ type: 'deepdive' }).html, /Treated as: Deep dive question/);
  assert.match(build({ type: 'risk' }).html, /Treated as: Risk question/);
});

test('type auto is not a report type: it builds as workflow with one warning', () => {
  const r = build({ type: 'auto' });
  assert.equal(r.status, 0);
  assert.match(r.html, /Treated as: Workflow question/);
  assert.equal((r.stderr.match(/unknown type/g) ?? []).length, 1);
});

test('an assemble report built by build-report falls back with its own label rather than as workflow', () => {
  const r = build({ type: 'assemble' });
  assert.equal(r.status, 0);
  assert.match(r.html, /Treated as: Assemble question/);
});

import { mkdirSync as mkdirSyncB } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));
const baselineJson = join(root, 'tests', 'fixtures', 'report-baseline.json');
const baselineHtml = readFileSync(join(root, 'tests', 'fixtures', 'report-baseline.html'), 'utf8');

function buildFile(jsonObj, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'avengers-themed-'));
  const inPath = join(dir, 'report.json');
  const outPath = join(dir, 'report.html');
  writeFileSync(inPath, JSON.stringify(jsonObj));
  const r = spawnSync(process.execPath, [script, inPath, outPath], { encoding: 'utf8', env: { ...process.env, ...env } });
  return { status: r.status, stderr: r.stderr, html: existsSync(outPath) ? readFileSync(outPath, 'utf8') : '' };
}
const baseObj = () => JSON.parse(readFileSync(baselineJson, 'utf8'));

test('a report with no hero is byte-for-byte what the builder wrote before themes existed', () => {
  const r = buildFile(baseObj());
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.html, baselineHtml);
});

test('an unknown, unsafe or non-string hero changes nothing and does not crash', () => {
  for (const hero of ['nobody', '../secrets', 'a/b', 'HULK', '', 5, ['hulk'], {}, null]) {
    const r = buildFile({ ...baseObj(), hero });
    assert.equal(r.status, 0, `${JSON.stringify(hero)}: ${r.stderr}`);
    assert.equal(r.html, baselineHtml, JSON.stringify(hero));
  }
});

test('hero hulk adds the band, the emblem, the tagline and the three accent overrides', () => {
  const r = buildFile({ ...baseObj(), hero: 'hulk' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.html, /class="band"/);
  assert.match(r.html, /class="emblem"/);
  assert.match(r.html, /Hulk smash\. Here is what breaks\./);
  assert.match(r.html, /:root\{--accent:#2e7d32\}/);
  assert.match(r.html, /:root:not\(\[data-theme=light\]\)\{--accent:#7bd88f\}/);
  assert.match(r.html, /:root\[data-theme=dark\]\{--accent:#7bd88f\}/);
});

test('--no-theme on a hero report gives the same page as a report with no hero, and leaves the JSON alone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'avengers-notheme-'));
  const inPath = join(dir, 'report.json');
  const outPath = join(dir, 'report.plain.html');
  const text = JSON.stringify({ ...baseObj(), hero: 'hulk' });
  writeFileSync(inPath, text);
  const r = spawnSync(process.execPath, [script, inPath, outPath, '--no-theme'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(outPath, 'utf8'), baselineHtml);
  assert.equal(readFileSync(inPath, 'utf8'), text);
});

test('without --no-theme a hero report still gets its look', () => {
  assert.match(buildFile({ ...baseObj(), hero: 'hulk' }).html, /class="band"/);
});

test('the themed title is still a real h1, escaped, and the rest of the page is unchanged', () => {
  const r = buildFile({ ...baseObj(), hero: 'hulk', title: '<b>Bold & "quoted"</b>' });
  assert.match(r.html, /<h1>&lt;b&gt;Bold &amp; &quot;quoted&quot;&lt;\/b&gt;<\/h1>/);
  assert.doesNotMatch(r.html, /<h1><b>/);
  assert.ok(r.html.includes('<h2>Summary</h2>'));
  assert.ok(r.html.includes('class="diagram dev-only"'));
});

test('a hero whose theme file is missing or broken renders unthemed, with exit 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'avengers-plug-'));
  mkdirSyncB(join(dir, 'themes'), { recursive: true });
  writeFileSync(join(dir, 'themes', 'hulk.md'), '---\nname: hulk\naccent: "green"\naccentDark: "#7bd88f"\nemblem: fist\ntagline: "x"\n---\n');
  for (const plugin of [dir, mkdtempSync(join(tmpdir(), 'avengers-empty-'))]) {
    const r = buildFile({ ...baseObj(), hero: 'hulk' }, { AVENGERS_PLUGIN_DIR: plugin });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.html, baselineHtml);
  }
});

test('a secret is still refused when a hero is set', () => {
  const r = buildFile({ ...baseObj(), hero: 'hulk', summary: 'key AKIAABCDEFGHIJKLMNOP' });
  assert.equal(r.status, 3);
});

test('a title containing replacement patterns comes out verbatim in the themed band', () => {
  // in String.replace a plain-string replacement reads $&, $1, $$ and $' as patterns; a function replacement does not
  const bt = String.fromCharCode(96);
  for (const title of ['Costs $& more', "Price $1 and $$ and $'", '$' + bt + ' before']) {
    const r = buildFile({ ...baseObj(), hero: 'hulk', title });
    assert.equal(r.status, 0, r.stderr);
    const esc = title.replace(/&/g, '&amp;').replace(/'/g, '&#39;');
    assert.ok(r.html.includes('<h1>' + esc + '</h1>'), 'title was altered: ' + title);
  }
});
