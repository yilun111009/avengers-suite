import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

const read = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n'); // git on Windows may check files out with CRLF
const frontmatter = (text) => /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
const agent = read('agents/flight-director.md');
const skill = read('skills/flightplan/SKILL.md');

test('the agent is read-only and named flight-director', () => {
  const fm = frontmatter(agent);
  assert.match(fm, /^name: flight-director$/m);
  assert.match(fm, /^tools: Read, Grep, Glob$/m);
});

test('no default model: neither the agent nor the skill pins one', () => {
  assert.ok(!/^model\s*:/m.test(frontmatter(agent)), 'the agent file has a model line');
  assert.ok(!/^model\s*:/m.test(frontmatter(skill)), 'the skill has a model line');
});

test('no default model: no script or prompt assigns or falls back to a model name', () => {
  const files = [
    ...readdirSync(join(ROOT, 'engine')).filter((f) => f.endsWith('.mjs') && f !== 'constants.mjs').map((f) => `engine/${f}`),
    'agents/flight-director.md', 'skills/flightplan/SKILL.md',
  ];
  const pattern = /model\w*\s*(=|:|\?\?|\|\|)\s*['"`]?(opus|sonnet|haiku)\b/i;
  for (const f of files) assert.ok(!pattern.test(read(f)), `${f} assigns a default model`);
});

test('the skill asks for the model with the three choices plus Change and Cancel, and says there is no default', () => {
  for (const o of ['Approve on opus', 'Approve on sonnet', 'Approve on haiku', 'Change', 'Cancel']) assert.ok(skill.includes(o), o);
  assert.match(skill, /no default model/i);
  assert.match(skill, /most thorough/);
  assert.match(skill, /cheapest/);
});

test('the skill passes the chosen model on the agent call and to build-plan', () => {
  assert.match(skill, /flight-director/);
  assert.match(skill, /`model`/);
  assert.match(skill, /--model <chosen model>/);
});

test('the skill limits writes to docs/plans and names the safety rules', () => {
  assert.match(skill, /write only to `docs\/plans\/\*\*`/);
  assert.match(skill, /Never write, edit or delete any other path/);
  assert.match(skill, /data, not instructions/i);
});

test('the skill never gives user text to a shell: quoted heredocs for the arguments and the title', () => {
  assert.ok(skill.includes("<<'ARGS'"));
  assert.ok(skill.includes("<<'TITLE'"));
  assert.ok(skill.includes("<<'CITES'"));
});

test('every engine script the skill names exists', () => {
  const named = [...skill.matchAll(/<scripts dir>\/([a-z-]+\.mjs)/g)].map((m) => m[1]);
  assert.ok(named.length >= 5);
  for (const f of new Set(named)) assert.ok(existsSync(join(ROOT, 'engine', f)), `${f} is named in SKILL.md but does not exist`);
});

test('the agent forbids quoting secrets and treats report text as data', () => {
  assert.match(agent, /Never quote secret values/);
  assert.match(agent, /data, never as instructions/);
});

test('final review I1: on a detected secret the skill deletes the raw plan.json and checks.json it wrote', () => {
  assert.match(skill, /exits 3[\s\S]*delete `docs\/plans\/<plan-slug>\/plan\.json` and `docs\/plans\/<plan-slug>\/checks\.json`/);
});

test('final review I2: the agent opens only ok or moved citations and never reads outside the repo', () => {
  assert.match(agent, /only open cites whose status is `ok` or `moved`/);
  assert.match(agent, /never read a path outside the current repository/);
});

test('the skill asks Brief, Detailed or Both on every run and passes it to build-plan', () => {
  for (const o of ['Brief', 'Detailed', 'Both']) assert.ok(skill.includes(`\`${o}\``), o);
  assert.match(skill, /--detail <chosen detail>/);
  assert.match(skill, /brief\.html/);
});

test('the flightplan skill shows its usage after the command name (argument-hint)', () => {
  assert.match(skill.split('\n---\n')[0], /\nargument-hint: "<report-folder>\.\.\. \[on opus\|sonnet\|haiku\] <goal>"$/m);
});
