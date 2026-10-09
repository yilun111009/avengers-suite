import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LENS_TYPES, TYPE_LABEL, HERO_TYPES, REPORT_TYPES } from '../engine/types.mjs';

test('the shared type list has the five old and the three new types', () => {
  assert.deepEqual(LENS_TYPES, ['architecture', 'logic', 'workflow', 'support', 'impact', 'deadcode', 'deepdive', 'risk']);
});

test('every type has a label, and hero files may also say auto', () => {
  for (const t of LENS_TYPES) assert.ok(TYPE_LABEL[t], `no label for ${t}`);
  assert.deepEqual(HERO_TYPES, [...LENS_TYPES, 'auto']);
});

test('assemble is a report type but not a hero type', () => {
  assert.deepEqual(REPORT_TYPES, [...LENS_TYPES, 'assemble']);
  assert.ok(TYPE_LABEL.assemble);
  assert.ok(!HERO_TYPES.includes('assemble'));
  assert.ok(!LENS_TYPES.includes('assemble'));
});
