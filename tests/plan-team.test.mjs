import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MAX_HEROES, heroNames, normalizeHero, validatePlan, costLine, approvalText, applyChoice, applyEdit } from '../engine/plan-team.mjs';

const pluginDir = fileURLToPath(new URL('../', import.meta.url));
const script = fileURLToPath(new URL('../engine/plan-team.mjs', import.meta.url));
const known = heroNames(pluginDir);
const H = (hero, model = 'sonnet', task = 't') => ({ hero, model, task, why: 'w' });
const plan = (...heroes) => ({ goal: 'g', heroes });

test('the cap is five, and the real hero names are read from heroes/', () => {
  assert.equal(MAX_HEROES, 5);
  for (const n of ['thor', 'hulk', 'loki', 'ironman', 'hawkeye', 'spiderman']) assert.ok(known.includes(n), n);
});

test('hero names accept a slash and any case, and reject unknown names', () => {
  assert.equal(normalizeHero('/Hulk', known), 'hulk');
  assert.equal(normalizeHero(' HULK ', known), 'hulk');
  assert.equal(normalizeHero('batman', known), null);
  assert.equal(normalizeHero('', known), null);
});

test('a valid two-hero plan passes and comes back normalised', () => {
  const r = validatePlan(plan(H('/Hulk', 'sonnet'), H('loki', 'opus')), known);
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.deepEqual(r.plan.heroes.map((h) => h.hero), ['hulk', 'loki']);
});

test('an empty plan is refused', () => {
  const r = validatePlan(plan(), known);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /at least one hero/);
});

test('six heroes are refused and the error says the cap', () => {
  const r = validatePlan(plan(H('thor'), H('hulk'), H('loki'), H('antman'), H('thanos'), H('drstrange')), known);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /at most 5/);
});

test('the same hero twice is allowed and counts twice toward the cap', () => {
  assert.equal(validatePlan(plan(H('hulk'), H('hulk')), known).ok, true);
  const r = validatePlan(plan(H('hulk'), H('hulk'), H('hulk'), H('hulk'), H('hulk'), H('hulk')), known);
  assert.equal(r.ok, false);
});

test('an unknown hero or model is an error that names it', () => {
  const r = validatePlan(plan(H('batman'), H('hulk', 'gpt')), known);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /batman/);
  assert.match(r.errors.join(' '), /gpt/);
});

test('a hero with no task is refused', () => {
  const r = validatePlan(plan({ hero: 'hulk', model: 'sonnet', task: '  ' }), known);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /task/);
});

test('the cost line weights opus 3, sonnet 1, haiku 0.5 and never says a price', () => {
  assert.equal(costLine(plan(H('thor', 'sonnet'))), 'Rough cost: 1 agent (0 opus), about 1x a normal /ask');
  assert.equal(costLine(plan(H('drstrange', 'opus'), H('hulk'), H('loki'))), 'Rough cost: 3 agents (1 opus), about 5x a normal /ask');
  assert.equal(costLine(plan(H('hawkeye', 'haiku'))), 'Rough cost: 1 agent (0 opus), about 1x a normal /ask');
  assert.doesNotMatch(costLine(plan(H('thor'))), /\$|usd|dollar/i);
});

test('the approval text lists every hero with its model and says a single hero plainly', () => {
  const t = approvalText(plan(H('drstrange', 'opus', 'trace the refund flow'), H('hulk', 'sonnet', 'what breaks')));
  assert.match(t, /Fury's plan for: "g"/);
  assert.match(t, /1\. drstrange\s+opus\s+trace the refund flow/);
  assert.match(t, /2\. hulk\s+sonnet\s+what breaks/);
  assert.match(t, /Rough cost: 2 agents \(1 opus\)/);
  assert.match(approvalText(plan(H('hulk'))), /A single hero is enough for this goal\./);
});

test('Approve, all on sonnet turns an opus hero into sonnet, Cancel returns null', () => {
  const p = plan(H('drstrange', 'opus'), H('hulk', 'sonnet'));
  assert.deepEqual(applyChoice(p, 'sonnet').heroes.map((h) => h.model), ['sonnet', 'sonnet']);
  assert.deepEqual(applyChoice(p, 'approve').heroes.map((h) => h.model), ['opus', 'sonnet']);
  assert.equal(applyChoice(p, 'cancel'), null);
});

test('an edit can drop a hero, change a model and add a hero', () => {
  const p = plan(H('drstrange', 'opus'), H('hulk'), H('loki'));
  const r = applyEdit(p, { drop: ['Loki'], models: { hulk: 'opus' }, add: [{ hero: 'thor', task: 'map the layers' }] }, known);
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.deepEqual(r.plan.heroes.map((h) => [h.hero, h.model]), [['drstrange', 'opus'], ['hulk', 'opus'], ['thor', 'sonnet']]);
});

test('an edit that would pass five is refused and leaves the plan unchanged', () => {
  const p = plan(H('thor'), H('hulk'), H('loki'), H('antman'));
  const r = applyEdit(p, { add: [{ hero: 'thanos', task: 'a' }, { hero: 'drstrange', task: 'b' }] }, known);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /at most 5/);
  assert.equal(p.heroes.length, 4);
});

test('an edit naming an unknown hero or dropping one that is not in the plan is an error', () => {
  const p = plan(H('hulk'));
  assert.equal(applyEdit(p, { drop: ['loki'] }, known).ok, false);
  assert.equal(applyEdit(p, { add: [{ hero: 'batman', task: 'x' }] }, known).ok, false);
  assert.equal(applyEdit(p, { models: { hulk: 'gpt' } }, known).ok, false);
});

test('an edit that drops every hero is refused', () => {
  assert.equal(applyEdit(plan(H('hulk')), { drop: ['hulk'] }, known).ok, false);
});

test('the CLI validates a plan on stdin and exits 1 on a bad one', () => {
  const good = spawnSync(process.execPath, [script, 'validate'], { input: JSON.stringify(plan(H('hulk'))), encoding: 'utf8' });
  assert.equal(good.status, 0, good.stderr);
  assert.equal(JSON.parse(good.stdout).ok, true);
  const bad = spawnSync(process.execPath, [script, 'validate'], { input: JSON.stringify(plan()), encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.equal(JSON.parse(bad.stdout).ok, false);
  const shown = spawnSync(process.execPath, [script, 'show'], { input: JSON.stringify(plan(H('hulk'))), encoding: 'utf8' });
  assert.match(shown.stdout, /Fury's plan for/);
});
