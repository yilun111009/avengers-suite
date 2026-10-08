import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeSources, mergeConfidence, collectDisagreements } from '../engine/build-assemble.mjs';

const script = fileURLToPath(new URL('../engine/build-assemble.mjs', import.meta.url));
const ok = (hero, extra = {}) => ({ hero, model: 'sonnet', task: `task of ${hero}`, status: 'ok', title: `${hero} title`, summary: `${hero} summary`, type: 'impact', reportPath: `heroes/${hero}/report.html`, sources: [], confidence: { confirmed: [], graphOnly: [], unconfirmed: [] }, ...extra });
const BASE = { type: 'assemble', title: 'Team run', question: 'the goal', summary: 'combined', plainSummary: 'plain', plan: [], results: [ok('hulk'), ok('loki', { type: 'risk' })], generated: '2026-10-08' };

function build(extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'avengers-assemble-'));
  const inPath = join(dir, 'report.json');
  const outPath = join(dir, 'report.html');
  writeFileSync(inPath, JSON.stringify({ ...BASE, ...extra }));
  const r = spawnSync(process.execPath, [script, inPath, outPath], { encoding: 'utf8' });
  return { status: r.status, stderr: r.stderr, wrote: existsSync(outPath), html: existsSync(outPath) ? readFileSync(outPath, 'utf8') : '' };
}

test('a normal run builds a page with the goal, the summary and a link to every hero page', () => {
  const r = build();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.html, /the goal/);
  assert.match(r.html, /combined/);
  assert.match(r.html, /href="heroes\/hulk\/report\.html"/);
  assert.match(r.html, /href="heroes\/loki\/report\.html"/);
  assert.match(r.html, /Treated as: Assemble/);
});

test('a failed hero is marked failed, links to nothing, and the others still show', () => {
  const r = build({ results: [ok('hulk'), { hero: 'loki', model: 'sonnet', task: 't', status: 'failed', error: 'the agent returned no JSON' }] });
  assert.equal(r.status, 0);
  assert.match(r.html, /loki[\s\S]{0,200}failed/i);
  assert.match(r.html, /the agent returned no JSON/);
  assert.match(r.html, /Re-run only this hero/);
  assert.doesNotMatch(r.html, /heroes\/loki\/report\.html/);
  assert.match(r.html, /heroes\/hulk\/report\.html/);
});

test('when every hero failed the page still builds and says so', () => {
  const r = build({ results: [{ hero: 'hulk', model: 'sonnet', task: 't', status: 'failed', error: 'x' }] });
  assert.equal(r.status, 0);
  assert.match(r.html, /No hero finished/);
  assert.doesNotMatch(r.html, /href="heroes\//);
});

test('names, goals and summaries are HTML-escaped', () => {
  const r = build({ question: '<script>alert(1)</script>', results: [ok('hulk', { title: '<img src=x onerror=1>', summary: 'a & b <b>' })] });
  assert.doesNotMatch(r.html, /<script>alert/);
  assert.doesNotMatch(r.html, /<img src=x/);
  assert.match(r.html, /&lt;script&gt;/);
  assert.match(r.html, /a &amp; b &lt;b&gt;/);
});

test('a hero page link is only used when it stays inside heroes/', () => {
  const r = build({ results: [ok('hulk', { reportPath: '../../secrets.html' }), ok('loki', { reportPath: 'https://evil.example/x' })] });
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.html, /secrets\.html/);
  assert.doesNotMatch(r.html, /evil\.example/);
});

test('a secret in any hero field makes the build refuse, name the field and write nothing', () => {
  const r = build({ results: [ok('hulk', { summary: 'the key is AKIAABCDEFGHIJKLMNOP' })] });
  assert.equal(r.status, 3);
  assert.equal(r.wrote, false);
  assert.match(r.stderr, /results\[0\]\.summary/);
  assert.doesNotMatch(r.stderr, /AKIAABCDEFGHIJKLMNOP/);
});

test('sources cited by two heroes are listed once', () => {
  const s = mergeSources([ok('hulk', { sources: ['src/a.ts:1', 'src/b.ts:2'] }), ok('loki', { sources: ['src/a.ts:1', 'src/c.ts:3'] })]);
  assert.deepEqual(s, ['src/a.ts:1', 'src/b.ts:2', 'src/c.ts:3']);
});

test('confidence is the union of the heroes, de-duplicated, and failed heroes add nothing', () => {
  const c = mergeConfidence([
    ok('hulk', { confidence: { confirmed: ['A'], graphOnly: [], unconfirmed: ['X'] } }),
    ok('loki', { confidence: { confirmed: ['A', 'B'], graphOnly: ['G'], unconfirmed: [] } }),
    { hero: 'thor', status: 'failed', error: 'e', confidence: { confirmed: ['NOPE'] } },
  ]);
  assert.deepEqual(c, { confirmed: ['A', 'B'], graphOnly: ['G'], unconfirmed: ['X'] });
});

test('disagreements are only the ones the heroes reported, never invented', () => {
  assert.deepEqual(collectDisagreements([ok('hulk'), ok('loki')]), []);
  const d = collectDisagreements([ok('hulk', { disagrees: [{ with: 'loki', about: 'cache', mine: 'a:1', theirs: 'b:2' }] }), ok('loki')]);
  assert.equal(d.length, 1);
  assert.equal(d[0].hero, 'hulk');
  assert.equal(d[0].with, 'loki');
});

test('the page shows the disagreement section only when there is one', () => {
  assert.doesNotMatch(build().html, /Where the heroes disagree/);
  const r = build({ results: [ok('hulk', { disagrees: [{ with: 'loki', about: 'cache', mine: 'a:1', theirs: 'b:2' }] }), ok('loki')] });
  assert.match(r.html, /Where the heroes disagree/);
  assert.match(r.html, /marked as Fury's inference|inference/i);
});

test('usage errors exit 2', () => {
  assert.equal(spawnSync(process.execPath, [script], { encoding: 'utf8' }).status, 2);
});

test('a failed hero card names the real re-run command', () => {
  const r = build({ results: [{ hero: 'loki', model: 'sonnet', task: 't', status: 'failed', error: 'x' }] });
  assert.match(r.html, /\/assemble rerun loki/);
  assert.doesNotMatch(r.html, /ask Fury to re-run/);
});

test('a null or non-object entry in results does not crash the page', () => {
  const r = build({ results: [null, 'oops', ok('hulk')] });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.html, /heroes\/hulk\/report\.html/);
});

test('bad input JSON gives a clear one-line error and exit 2, not a stack trace', () => {
  const dir = mkdtempSync(join(tmpdir(), 'avengers-assemble-'));
  const inPath = join(dir, 'report.json');
  writeFileSync(inPath, '{not json');
  const r = spawnSync(process.execPath, [script, inPath, join(dir, 'o.html')], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /not valid JSON/);
  assert.doesNotMatch(r.stderr, /at JSON\.parse|node:internal/);
});

test('the disagreement section says the reading is the Fury inference, as the spec does', () => {
  const r = build({ results: [ok('hulk', { disagrees: [{ with: 'loki', about: 'cache', mine: 'a:1', theirs: 'b:2' }] }), ok('loki')] });
  assert.match(r.html, /Fury's inference from conflicting citations/);
  assert.doesNotMatch(r.html, /Reported by the heroes themselves/);
});

test('the plain-language summary is rendered for non-developer readers', () => {
  const r = build({ summary: 'technical text', plainSummary: 'plain words for everyone' });
  assert.match(r.html, /plain words for everyone/);
  assert.match(r.html, /technical text/);
});

test('the merge helpers skip null and non-object entries instead of throwing', () => {
  const dirty = [null, 'x', undefined, ok('hulk', { sources: ['s:1'], confidence: { confirmed: ['c'], graphOnly: [], unconfirmed: [] }, disagrees: [{ with: 'loki', about: 'a', mine: 'm', theirs: 't' }] })];
  assert.deepEqual(mergeSources(dirty), ['s:1']);
  assert.deepEqual(mergeConfidence(dirty).confirmed, ['c']);
  assert.equal(collectDisagreements(dirty).length, 1);
});

import { mkdirSync as mkdirSyncT } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));
const asmJson = join(root, 'tests', 'fixtures', 'assemble-baseline.json');
const asmHtml = readFileSync(join(root, 'tests', 'fixtures', 'assemble-baseline.html'), 'utf8');
function buildThemed(obj, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'avengers-assemble-t-'));
  const inPath = join(dir, 'report.json');
  const outPath = join(dir, 'report.html');
  writeFileSync(inPath, JSON.stringify(obj));
  const r = spawnSync(process.execPath, [script, inPath, outPath], { encoding: 'utf8', env: { ...process.env, ...env } });
  return { status: r.status, stderr: r.stderr, html: existsSync(outPath) ? readFileSync(outPath, 'utf8') : '' };
}
const cardOf = (html, hero) => html.split('<li class="item').find((c) => c.includes('<b>' + hero + '</b>'));

test('with no themes folder the team page is byte-for-byte what it was before themes', () => {
  const r = buildThemed(JSON.parse(readFileSync(asmJson, 'utf8')), { AVENGERS_PLUGIN_DIR: mkdtempSync(join(tmpdir(), 'avengers-empty-')) });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.html, asmHtml);
});

test("the team page takes fury's look", () => {
  const r = buildThemed(JSON.parse(readFileSync(asmJson, 'utf8')));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.html, /class="band"/);
  assert.match(r.html, /The team has assembled\./);
  assert.match(r.html, /:root\{--accent:#4a4a4a\}/);
  assert.match(r.html, /<h1>Team run<\/h1>/);
});

test("a hero card carries that hero's emblem and accent, and a failed hero's card has no emblem", () => {
  const r = buildThemed(JSON.parse(readFileSync(asmJson, 'utf8')));
  const hulk = cardOf(r.html, 'hulk');
  const loki = cardOf(r.html, 'loki');
  assert.match(hulk, /class="emblem"/);
  assert.match(hulk, /border-left:4px solid #2e7d32/);
  assert.doesNotMatch(loki, /class="emblem"/);
  assert.match(loki, /failed/);
});

test('a hero with no theme still gets its card, plain', () => {
  const obj = JSON.parse(readFileSync(asmJson, 'utf8'));
  obj.results[0].hero = 'nobody';
  const r = buildThemed(obj);
  assert.equal(r.status, 0, r.stderr);
  const card = cardOf(r.html, 'nobody');
  assert.ok(card);
  assert.doesNotMatch(card, /class="emblem"/);
});

test('a hero value that tries to leave themes/ gets a plain card', () => {
  const obj = JSON.parse(readFileSync(asmJson, 'utf8'));
  obj.results[0].hero = '../themes/hulk';
  const r = buildThemed(obj);
  assert.equal(r.status, 0);
  const card = r.html.split('<li class="item').find((c) => c.includes('themes/hulk'));
  assert.ok(card);
  assert.doesNotMatch(card, /class="emblem"/);
  assert.doesNotMatch(card, /border-left/);
});

test('a hero name is shown once on its card, not twice', () => {
  const r = buildThemed(JSON.parse(readFileSync(asmJson, 'utf8')));
  const card = cardOf(r.html, 'hulk');
  assert.equal((card.match(/<b>hulk<\/b>/g) ?? []).length, 1);
});

test('a hostile title is escaped inside the themed team band, and replacement patterns survive', () => {
  const obj = JSON.parse(readFileSync(asmJson, 'utf8'));
  obj.title = '<img src=x onerror=alert(1)> & "q" $& $1';
  const r = buildThemed(obj);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.html, /class="band"/);
  assert.ok(r.html.includes('<h1>&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot; $&amp; $1</h1>'), 'title was not escaped verbatim');
  assert.doesNotMatch(r.html, /<img src=x/);
});
