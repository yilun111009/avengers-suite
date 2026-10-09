import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, MODEL_NOTE, SLUG_RE, FLOWS_ROOT, PLAN_ROOT, REPORT_FIELDS_USED } from '../engine/constants.mjs';

test('the three models and a one-line note for each', () => {
  assert.deepEqual(MODELS, ['opus', 'sonnet', 'haiku']);
  for (const m of MODELS) assert.ok(MODEL_NOTE[m] && !MODEL_NOTE[m].includes('\n'), `note for ${m}`);
});

test('slugs: lowercase letters, digits, hyphens; no dots, slashes or leading hyphen', () => {
  for (const ok of ['refund-flow', 'a', 'refund-flow-20261009']) assert.ok(SLUG_RE.test(ok), ok);
  for (const bad of ['', '-x', '../x', 'a/b', 'A', 'a.b', 'a'.repeat(61)]) assert.ok(!SLUG_RE.test(bad), bad);
});

test('roots and the report fields the planner reads', () => {
  assert.equal(FLOWS_ROOT, 'docs/flows');
  assert.equal(PLAN_ROOT, 'docs/plans');
  assert.ok(['title', 'summary', 'sources', 'confidence'].every((f) => REPORT_FIELDS_USED.includes(f)));
});
