import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpDir, put, runCli } from './helpers.mjs';
import { parseCite } from '../engine/cite.mjs';
import { checkCitation, checkCitations } from '../engine/check-citations.mjs';

test('parseCite reads file:line, ranges and lists, and fixes backslashes', () => {
  assert.deepEqual(parseCite('src/a.ts:12'), { path: 'src/a.ts', line: 12 });
  assert.deepEqual(parseCite('src/a.ts:12-20'), { path: 'src/a.ts', line: 12 });
  assert.deepEqual(parseCite('src/a.ts:12,15'), { path: 'src/a.ts', line: 12 });
  assert.deepEqual(parseCite('src\\a.ts:3'), { path: 'src/a.ts', line: 3 });
  assert.equal(parseCite('no line here'), null);
  assert.equal(parseCite(undefined), null);
});

test('checkCitation: ok, moved, missing, invalid', () => {
  const root = tmpDir();
  put(root, 'src/a.ts', 'a\nb\nc\n');
  assert.equal(checkCitation(root, 'src/a.ts:3').status, 'ok');
  assert.equal(checkCitation(root, 'src/a.ts:4').status, 'moved');
  assert.equal(checkCitation(root, 'src/a.ts:0').status, 'moved');
  assert.equal(checkCitation(root, 'src/none.ts:1').status, 'missing');
  assert.equal(checkCitation(root, 'src:1').status, 'missing'); // a folder is not a file
  assert.equal(checkCitation(root, 'hello').status, 'invalid');
});

test('checkCitation: a path that leaves the repo is outside and is never read', () => {
  const root = tmpDir();
  put(root, 'src/a.ts', 'a\n');
  assert.equal(checkCitation(root, '../x.ts:1').status, 'outside');
  assert.equal(checkCitation(root, '..\\x.ts:1').status, 'outside');
  assert.equal(checkCitation(root, 'src/../../x.ts:1').status, 'outside');
  assert.equal(checkCitation(root, `${join(root, 'src', 'a.ts')}:1`).status, 'outside'); // absolute
});

test('checkCitations removes duplicates and counts each status', () => {
  const root = tmpDir();
  put(root, 'src/a.ts', 'a\nb\nc\n');
  const r = checkCitations(root, ['src/a.ts:3', 'src/a.ts:3', 'src/none.ts:1']);
  assert.equal(r.results.length, 2);
  assert.deepEqual(r.counts, { ok: 1, moved: 0, missing: 1, outside: 0, invalid: 0 });
});

test('the CLI reads a JSON array on stdin', () => {
  const root = tmpDir();
  put(root, 'src/a.ts', 'a\n');
  const r = runCli('check-citations.mjs', [root], JSON.stringify(['src/a.ts:1']));
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).counts.ok, 1);
  const bad = runCli('check-citations.mjs', [root], '{"not":"an array"}');
  assert.equal(bad.status, 2);
});
