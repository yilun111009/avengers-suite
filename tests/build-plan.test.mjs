import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpDir, put, runCli } from './helpers.mjs';
import { renderHtml, renderMarkdown } from '../engine/build-plan.mjs';

const fixture = (n) => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));
const sample = JSON.parse(readFileSync(fixture('plan-sample.json'), 'utf8'));
const checks = {
  results: [{ cite: 'src/order.ts:12', status: 'ok' }, { cite: 'src/gone.ts:9', status: 'missing' }],
  counts: { ok: 1, moved: 0, missing: 1, outside: 0, invalid: 0 },
};
const merged = (patch = {}) => ({ ...structuredClone(sample), model: 'sonnet', slugs: ['refund-flow'], generated: '2026-10-09', commit: 'abc1234', checks, ...patch });

test('html and markdown carry the same stages, steps and checks, and the model', () => {
  const p = merged();
  const html = renderHtml(p);
  const md = renderMarkdown(p);
  for (const s of p.stages) {
    assert.ok(html.includes(s.name) && md.includes(s.name), s.name);
    for (const st of s.steps) assert.ok(html.includes(st.text) && md.includes(st.text), st.text);
    for (const g of s.goNoGo) assert.ok(html.includes(g.passWhen) && md.includes(g.passWhen), g.passWhen);
  }
  for (const a of p.assumptions) assert.ok(html.includes(a) && md.includes(a));
  assert.match(html, /sonnet/);
  assert.match(md, /sonnet/);
  assert.ok(html.includes('src/gone.ts:9') && md.includes('src/gone.ts:9'));
});

test('the html is self-contained: no URL, no external asset, no script', () => {
  const html = renderHtml(merged());
  assert.ok(!/https?:\/\//i.test(html));
  assert.ok(!/<script|<link|<img|src=/i.test(html));
  assert.match(html, /prefers-color-scheme: ?dark/);
});

test('plan fields are escaped in the html (Review Focus 4)', () => {
  const p = merged({ title: '<script>alert(1)</script>' });
  p.stages[0].steps[0].text = '"><img src=x onerror=alert(1)>';
  const html = renderHtml(p);
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('markdown steps are checkboxes so the file can be worked through', () => {
  const md = renderMarkdown(merged());
  assert.match(md, /- \[ \] Add a RefundedAmount field to Order/);
  assert.match(md, /## Stage 2: Wire the payout job/);
});

test('without a citation check the pages say so', () => {
  const p = merged();
  delete p.checks;
  assert.match(renderHtml(p), /citation check was not run/i);
  assert.match(renderMarkdown(p), /citation check was not run/i);
});

test('the CLI refuses to run without a chosen model: there is no default', () => {
  const out = tmpDir();
  const r = runCli('build-plan.mjs', [fixture('plan-sample.json'), out, '--slugs', 'refund-flow']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no default/);
  assert.ok(!existsSync(join(out, 'plan.html')));
  assert.equal(runCli('build-plan.mjs', [fixture('plan-sample.json'), out, '--model', 'gpt', '--slugs', 'refund-flow']).status, 2);
});

test('the CLI writes plan.json, plan.html and plan.md and records the chosen model', () => {
  const out = tmpDir();
  const raw = { ...structuredClone(sample), model: 'opus' }; // an agent that guessed a model is overridden
  const rawPath = put(tmpDir(), 'plan.json', JSON.stringify(raw));
  const checksPath = put(tmpDir(), 'checks.json', JSON.stringify(checks));
  const r = runCli('build-plan.mjs', [rawPath, out, '--model', 'sonnet', '--slugs', 'refund-flow,team', '--checks', checksPath, '--commit', 'abc1234', '--generated', '2026-10-09']);
  assert.equal(r.status, 0, r.stderr);
  for (const f of ['plan.json', 'plan.html', 'plan.md']) assert.ok(existsSync(join(out, f)), f);
  const written = JSON.parse(readFileSync(join(out, 'plan.json'), 'utf8'));
  assert.equal(written.model, 'sonnet');
  assert.deepEqual(written.slugs, ['refund-flow', 'team']);
  assert.equal(written.commit, 'abc1234');
  assert.deepEqual(written.checks.counts, checks.counts);
  assert.equal(JSON.parse(r.stdout).html, join(out, 'plan.html'));
});

test('the CLI reports an invalid plan and writes nothing', () => {
  const out = tmpDir();
  const bad = put(tmpDir(), 'plan.json', JSON.stringify({ ...sample, stages: [] }));
  const r = runCli('build-plan.mjs', [bad, out, '--model', 'haiku', '--slugs', 'refund-flow']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /stages/);
  assert.ok(!existsSync(join(out, 'plan.html')));
  const notJson = put(tmpDir(), 'plan.json', '{');
  assert.equal(runCli('build-plan.mjs', [notJson, out, '--model', 'haiku', '--slugs', 'x']).status, 2);
});

test('the CLI stops on a possible secret and writes nothing (Review Focus 4)', () => {
  const out = tmpDir();
  const p = structuredClone(sample);
  p.stages[0].steps[0].change = 'Use the key ' + 'AKIA' + 'ABCDEFGHIJKLMNOP' + ' for the upload.';
  const path = put(tmpDir(), 'plan.json', JSON.stringify(p));
  const r = runCli('build-plan.mjs', [path, out, '--model', 'haiku', '--slugs', 'refund-flow']);
  assert.equal(r.status, 3);
  assert.ok(!r.stderr.includes('ABCDEFGHIJKLMNOP'));
  assert.ok(!existsSync(join(out, 'plan.html')));
});

test('secrets.mjs is the same as the repo-avengers scanner (skipped when it is not a sibling)', (t) => {
  const sibling = fileURLToPath(new URL('../../repo-avengers/engine/secrets.mjs', import.meta.url));
  if (!existsSync(sibling)) return t.skip('repo-avengers is not a sibling folder');
  const strip = (s) => s.replace(/^\/\/ COPY of .*\n/, '').replace(/\r\n/g, '\n');
  assert.equal(strip(readFileSync(fileURLToPath(new URL('../engine/secrets.mjs', import.meta.url)), 'utf8')), strip(readFileSync(sibling, 'utf8')));
});

test('brief: flow, one line per step and the decisions, without the detail', async () => {
  const { renderBriefHtml, renderBriefMarkdown } = await import('../engine/build-plan.mjs');
  const p = merged();
  const html = renderBriefHtml(p);
  const md = renderBriefMarkdown(p);
  for (const out of [html, md]) {
    for (const s of p.stages) {
      assert.ok(out.includes(s.name), s.name);
      for (const st of s.steps) assert.ok(out.includes(st.text), st.text);
    }
    for (const a of p.assumptions) assert.ok(out.includes(a), a);
    assert.ok(out.includes(p.summary) && out.includes('sonnet'));
    for (const hidden of ['npm test -- order', 'src/order.ts:12', 'RefundTooLargeError', 'The Order status enum', 'src/gone.ts:9']) assert.ok(!out.includes(hidden), `brief leaks detail: ${hidden}`);
  }
  assert.ok(!/https?:\/\/|<script|<link|<img|src=/i.test(html));
});

test('brief: plan fields are escaped in the html', async () => {
  const { renderBriefHtml } = await import('../engine/build-plan.mjs');
  const p = merged({ title: '<script>alert(1)</script>' });
  p.stages[0].steps[0].text = '"><img src=x onerror=alert(1)>';
  const html = renderBriefHtml(p);
  assert.ok(!html.includes('<script>alert(1)') && !html.includes('<img src=x'));
});

test('--detail brief writes brief.html and brief.md only (plus plan.json); detailed and both behave as named', () => {
  const run = (detail) => {
    const out = tmpDir();
    const args = [fixture('plan-sample.json'), out, '--model', 'haiku', '--slugs', 'refund-flow'];
    if (detail) args.push('--detail', detail);
    const r = runCli('build-plan.mjs', args);
    return { r, has: (f) => existsSync(join(out, f)) };
  };
  let x = run('brief');
  assert.equal(x.r.status, 0, x.r.stderr);
  assert.ok(x.has('plan.json') && x.has('brief.html') && x.has('brief.md') && !x.has('plan.html') && !x.has('plan.md'));
  assert.ok(JSON.parse(x.r.stdout).brief_html);
  x = run('detailed');
  assert.ok(x.has('plan.html') && x.has('plan.md') && !x.has('brief.html'));
  x = run('both');
  assert.ok(x.has('plan.html') && x.has('plan.md') && x.has('brief.html') && x.has('brief.md'));
  x = run(undefined); // omitted = detailed, the 0.1.0 behaviour
  assert.ok(x.has('plan.html') && !x.has('brief.html'));
});

test('--detail with an unknown value exits 2 and writes nothing', () => {
  const out = tmpDir();
  const r = runCli('build-plan.mjs', [fixture('plan-sample.json'), out, '--model', 'haiku', '--slugs', 'x', '--detail', 'tiny']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--detail/);
  assert.ok(!existsSync(join(out, 'plan.json')));
});
