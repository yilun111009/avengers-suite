import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpDir, put, runCli } from './helpers.mjs';
import { slugify, uniqueSlug } from '../engine/slug.mjs';
import { SLUG_RE } from '../engine/constants.mjs';

test('slugify makes a short lowercase folder name', () => {
  assert.equal(slugify('Add partial refunds to checkout!'), 'add-partial-refunds-to-checkout');
  const long = slugify('word '.repeat(40));
  assert.ok(long.length <= 50 && !long.endsWith('-') && SLUG_RE.test(long));
});

test('slugify never returns an empty name (Review Focus 5)', () => {
  assert.equal(slugify('退款流程'), 'plan');
  assert.equal(slugify('!!!'), 'plan');
  assert.equal(slugify(undefined), 'plan');
});

test('uniqueSlug: the name, then name-date, then name-date-2, -3', () => {
  const taken = new Set();
  const exists = (s) => taken.has(s);
  assert.equal(uniqueSlug('p', exists, '20261009'), 'p');
  taken.add('p');
  assert.equal(uniqueSlug('p', exists, '20261009'), 'p-20261009');
  taken.add('p-20261009');
  assert.equal(uniqueSlug('p', exists, '20261009'), 'p-20261009-2');
  taken.add('p-20261009-2');
  assert.equal(uniqueSlug('p', exists, '20261009'), 'p-20261009-3');
});

test('plan-slug CLI skips a folder that already exists', () => {
  const root = tmpDir();
  put(root, 'docs/plans/add-refunds/plan.json', '{}');
  const r = runCli('plan-slug.mjs', [root], 'Add refunds\n');
  assert.equal(r.status, 0);
  assert.match(r.stdout.trim(), /^add-refunds-\d{8}$/);
});
