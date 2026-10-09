import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAME_RE, TOPIC_MAX, topicOf, localDate, folderName, uniqueName, resolveName } from '../engine/naming.mjs';
import { REPORT_TYPES } from '../engine/types.mjs';

const script = fileURLToPath(new URL('../engine/name-folder.mjs', import.meta.url));
const run = (args, input) => spawnSync(process.execPath, [script, ...args], { input, encoding: 'utf8' });

test('topicOf: lowercase hyphen words, cut at a word boundary', () => {
  assert.equal(topicOf('Order status enum!'), 'order-status-enum');
  assert.equal(topicOf('  --Refund   flow-- '), 'refund-flow');
  const long = topicOf('what breaks if I change the order status enum in the billing module');
  assert.ok(long.length <= TOPIC_MAX && !long.endsWith('-'), long);
  assert.equal(long, 'what-breaks-if-i-change-the-order-status');
  assert.equal(topicOf('x'.repeat(60)).length, TOPIC_MAX);
  assert.equal(topicOf('退款流程'), '');
  assert.equal(topicOf(undefined), '');
});

test('localDate is YYYY-MM-DD in local time', () => {
  assert.equal(localDate(new Date(2026, 0, 5, 7, 30)), '2026-01-05');
  assert.match(localDate(), /^\d{4}-\d{2}-\d{2}$/);
});

test('folderName: <date>-<tag>-<topic>, or <date>-<topic> without a tag', () => {
  assert.equal(folderName({ date: '2026-10-09', tag: 'impact', text: 'Order status enum' }), '2026-10-09-impact-order-status-enum');
  assert.equal(folderName({ date: '2026-10-09', text: 'Add partial refunds' }), '2026-10-09-add-partial-refunds');
  assert.equal(folderName({ date: '2026-10-09', tag: 'logic', text: '退款', fallback: 'question' }), '2026-10-09-logic-question');
  assert.throws(() => folderName({ date: '20261009', text: 'x' }), /YYYY-MM-DD/);
  assert.throws(() => folderName({ date: '2026-10-09', tag: '../x', text: 'x' }), /tag/);
});

test('every type makes a valid name, even with the longest topic and a suffix', () => {
  for (const tag of REPORT_TYPES) {
    const name = uniqueName(folderName({ date: '2026-10-09', tag, text: 'w'.repeat(99) }), (n) => !n.endsWith('-99'));
    assert.ok(NAME_RE.test(name), name);
  }
});

test('uniqueName: the name, then -2, -3', () => {
  const taken = new Set();
  const exists = (n) => taken.has(n);
  assert.equal(uniqueName('a', exists), 'a');
  taken.add('a');
  assert.equal(uniqueName('a', exists), 'a-2');
  taken.add('a-2');
  assert.equal(uniqueName('a', exists), 'a-3');
});

test('NAME_RE keeps old names valid and refuses unsafe ones', () => {
  for (const ok of ['refund-flow', 'refund-flow-20261009', '2026-10-09-impact-order-status-enum']) assert.ok(NAME_RE.test(ok), ok);
  for (const bad of ['', '-x', '../x', 'a/b', 'A', 'a.b', 'a'.repeat(81)]) assert.ok(!NAME_RE.test(bad), bad);
});

test('resolveName: exact name first, else the newest dated folder with that topic', () => {
  const names = [
    'refund-flow',
    '2026-10-01-workflow-refund-flow',
    '2026-10-09-logic-refund-flow',
    '2026-10-09-logic-refund-flow-2',
    '2026-10-09-workflow-partial-refund-flow',
    '2026-10-09-add-partial-refunds',
  ];
  assert.equal(resolveName('refund-flow', names), 'refund-flow');
  assert.equal(resolveName('refund-flow', names.slice(1)), '2026-10-09-logic-refund-flow-2');
  assert.equal(resolveName('workflow-refund-flow', names), '2026-10-01-workflow-refund-flow');
  assert.equal(resolveName('add-partial-refunds', names), '2026-10-09-add-partial-refunds');
  assert.equal(resolveName('flow', names), null, 'a part of a topic is not a match');
  assert.equal(resolveName('../x', names), null);
  assert.equal(resolveName('nothing', names), null);
});

test('name-folder CLI: dated, typed, and skips a taken name', () => {
  const flows = join(mkdtempSync(join(tmpdir(), 'avengers-name-')), 'docs', 'flows');
  const first = run([flows, '--type', 'impact'], 'Order status enum\n');
  assert.equal(first.status, 0, first.stderr);
  const name = first.stdout.trim();
  assert.equal(name, `${localDate()}-impact-order-status-enum`);
  mkdirSync(join(flows, name), { recursive: true });
  assert.equal(run([flows, '--type', 'impact'], 'Order status enum\n').stdout.trim(), `${name}-2`);
});

test('name-folder CLI refuses a missing or unknown type and never lets a shell see the title', () => {
  const flows = mkdtempSync(join(tmpdir(), 'avengers-name-'));
  assert.equal(run([flows], 'x').status, 2);
  assert.equal(run([flows, '--type', 'nope'], 'x').status, 2);
  const r = run([flows, '--type', 'assemble'], 'Refund $(whoami) `id` "flow"\n');
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), `${localDate()}-assemble-refund-whoami-id-flow`);
});

test('ask and assemble pick the folder with name-folder.mjs, not by hand', () => {
  for (const s of ['ask', 'assemble']) {
    const text = readFileSync(fileURLToPath(new URL(`../skills/${s}/SKILL.md`, import.meta.url)), 'utf8');
    assert.match(text, /node "<scripts dir>\/name-folder\.mjs" docs\/flows --type/, s);
    assert.ok(!/<slug>-<YYYYMMDD>/.test(text), `${s} still describes the old date-on-collision rule`);
  }
});
