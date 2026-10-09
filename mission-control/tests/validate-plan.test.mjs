import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validatePlan } from '../engine/validate-plan.mjs';

const sample = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/plan-sample.json', import.meta.url)), 'utf8'));
const merged = (patch = {}) => ({ ...structuredClone(sample), model: 'sonnet', slugs: ['refund-flow'], ...patch });
const errorsOf = (p) => validatePlan(p).errors.join('\n');

test('a complete plan is ok', () => {
  assert.deepEqual(validatePlan(merged()), { ok: true, errors: [] });
});

test('the raw planner output is not ok until a model and slugs are set', () => {
  const r = validatePlan(structuredClone(sample));
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /model/);
  assert.match(r.errors.join('\n'), /slugs/);
});

test('each missing or wrong field is named with its path', () => {
  assert.match(errorsOf(merged({ title: '' })), /title/);
  assert.match(errorsOf(merged({ model: 'gpt' })), /model must be opus, sonnet or haiku/);
  assert.match(errorsOf(merged({ stages: [] })), /stages/);
  assert.match(errorsOf(merged({ assumptions: 'none' })), /assumptions/);
  const p = merged();
  delete p.stages[0].steps[1].verify;
  assert.match(errorsOf(p), /stages\[0\]\.steps\[1\]\.verify/);
  const q = merged();
  q.stages[1].goNoGo = [];
  assert.match(errorsOf(q), /stages\[1\]\.goNoGo/);
  const r = merged();
  r.stages[0].steps[0].files = 'src/a.ts';
  assert.match(errorsOf(r), /stages\[0\]\.steps\[0\]\.files/);
});

test('input that is not an object, and a malformed checks block, are reported', () => {
  assert.equal(validatePlan(null).ok, false);
  assert.equal(validatePlan([]).ok, false);
  assert.match(errorsOf(merged({ checks: 'ok' })), /checks/);
});

test('final review M3: a newline in the title or goal is rejected (they are passed through a quoted heredoc)', () => {
  assert.match(errorsOf(merged({ title: 'x\nTITLE\nid' })), /title must be a single line/);
  assert.match(errorsOf(merged({ goal: 'a\nb' })), /goal must be a single line/);
});
