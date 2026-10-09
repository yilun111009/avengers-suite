import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpDir, put, runCli } from './helpers.mjs';
import { parseCommand } from '../engine/parse-command.mjs';

const folders = ['refund-flow', 'team'];
const isFolder = (w) => folders.includes(w);

test('slugs, then an optional "on <model>", then the goal', () => {
  assert.deepEqual(parseCommand('refund-flow on sonnet plan the change', isFolder),
    { slugs: ['refund-flow'], model: 'sonnet', goal: 'plan the change', errors: [] });
  assert.deepEqual(parseCommand('refund-flow team plan it', isFolder).slugs, ['refund-flow', 'team']);
});

test('without "on <model>" the model is null: the user will be asked', () => {
  assert.equal(parseCommand('refund-flow plan the change', isFolder).model, null);
});

test('a goal that starts with a word that is not a folder is still the goal', () => {
  const r = parseCommand('refund-flow plan the refund change', isFolder);
  assert.deepEqual(r.slugs, ['refund-flow']);
  assert.equal(r.goal, 'plan the refund change');
});

test('only opus, sonnet and haiku count as a model; "on <other>" stays in the goal', () => {
  const r = parseCommand('refund-flow on gpt4 plan it', isFolder);
  assert.equal(r.model, null);
  assert.equal(r.goal, 'on gpt4 plan it');
  assert.equal(parseCommand('refund-flow ON Haiku plan it', isFolder).model, 'haiku');
});

test('a repeated folder is listed once', () => {
  assert.deepEqual(parseCommand('refund-flow refund-flow go now', isFolder).slugs, ['refund-flow']);
});

test('errors say what to fix', () => {
  assert.ok(parseCommand('nothing here', isFolder).errors[0].includes('"nothing" is not a folder'));
  assert.ok(parseCommand('refund-flow', isFolder).errors[0].includes('what the plan is for'));
  assert.ok(parseCommand('', isFolder).errors.length > 0);
  assert.ok(parseCommand(undefined, isFolder).errors.length > 0);
});

test('the CLI reads the arguments from stdin and never lets a shell see them (Review Focus 3)', () => {
  const root = tmpDir();
  put(root, 'docs/flows/refund-flow/report.json', '{}');
  const goal = 'handle $(whoami) and `id` and "quotes" and \'single\'';
  const r = runCli('parse-command.mjs', [root], `refund-flow on haiku ${goal}\n`);
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.model, 'haiku');
  assert.equal(out.goal, goal);
});
