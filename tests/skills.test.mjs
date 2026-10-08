import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// the working copy may have CRLF (git autocrlf on Windows); the assertions below match LF
const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const ask = read('skills/ask/SKILL.md');
const explain = read('skills/explain/SKILL.md');

test('ask skill is named ask and points at the router, lenses, audiences and agent', () => {
  assert.match(ask, /^---\nname: ask\n/);
  for (const needle of ['detect-route.mjs', 'heroes/', 'audiences/', 'repo-avengers', 'avengers-hints.md', 'explainer-hints.md', 'Treated as:']) {
    assert.ok(ask.includes(needle), `ask SKILL.md does not mention ${needle}`);
  }
});

test('ask skill lists every script it may run and limits where it may write', () => {
  for (const s of ['check-onboarding.mjs', 'build-report.mjs', 'build-index.mjs', 'migrate-reports.mjs', 'detect-route.mjs']) {
    assert.ok(ask.includes(s), `ask SKILL.md does not list ${s}`);
  }
  assert.ok(ask.includes('`docs/flows/**` and `.claude/avengers-hints.md`'));
});

test('explain skill is a short alias of ask', () => {
  assert.match(explain, /^---\nname: explain\n/);
  assert.match(explain, /ask/);
  assert.ok(explain.split('\n').length < 25, 'alias should stay short');
});

test('ask skill never puts the raw question inside double quotes in a shell command', () => {
  assert.ok(!ask.includes('detect-route.mjs" "<question>"'), 'detect-route must read the question from stdin');
  assert.ok(!ask.includes('graphify query "<question>"'), 'graphify query must not wrap the question in double quotes');
  assert.ok(ask.includes("<<'QUESTION_END'"), 'ask skill should pass the question through a quoted heredoc');
});

test('ask skill supports deep, which runs the agent on opus', () => {
  assert.match(ask, /`\/ask deep/);
  assert.match(ask, /model: "opus"/);
});

test('ask skill asks the user to approve opus before a deep run', () => {
  assert.match(ask, /ask the user to approve opus/);
  assert.match(ask, /Do not spawn the agent until they answer/);
});

const heroNames = readdirSync(fileURLToPath(new URL('../heroes/', import.meta.url))).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));

test('every hero has a thin skill that calls ask in hero mode', () => {
  assert.ok(heroNames.length >= 5);
  for (const n of heroNames) {
    const s = read(`skills/${n}/SKILL.md`).replace(/\r\n/g, '\n');
    assert.match(s, new RegExp(`^---\nname: ${n}\n`), `${n} skill name`);
    assert.ok(s.includes(`hero: ${n}`), `${n} skill must pass hero: ${n}`);
    assert.ok(s.includes(`Trigger: /${n}`), `${n} skill description must end with its trigger`);
    assert.ok(s.split('\n').length < 16, `${n} skill should stay thin`);
  }
});

test('ask skill documents hero mode, and a named audience still wins', () => {
  assert.match(ask, /## Hero mode/);
  assert.match(ask, /`hero: <name>`/);
  assert.match(ask, /named audience in the question/);
  assert.ok(ask.includes('heroes/<name>.md'));
});

test('hero mode strips the hero marker first and lets the user keywords win', () => {
  const hero = ask.replace(/\r\n/g, '\n').split('## Hero mode')[1].split('## Safety contract')[0];
  assert.match(hero, /arguments start with `hero: <name>`/);
  assert.match(hero, /Remove that token/);
  assert.match(hero, /user's keywords win/);
  assert.match(hero, /`plain` gives `pm`/);
  assert.match(hero, /`text` gives no report/);
  assert.match(hero, /`deep` triggers the step 7 opus approval/);
});

test('hero skills pass the hero marker followed by the user arguments', () => {
  for (const n of heroNames) {
    assert.ok(read(`skills/${n}/SKILL.md`).includes(`\`hero: ${n}\` followed by`), `${n} skill must say hero marker followed by the arguments`);
  }
});

test('step 7 allows the hero model when deep is not set', () => {
  assert.match(ask, /pass no model \(or the hero's model in hero mode\)/);
});

const heroSection = () => ask.split('## Hero mode')[1].split('## Safety contract')[0];

test('hero mode explains type auto: the router still picks the lens', () => {
  assert.match(heroSection(), /`type: auto`/);
  assert.match(heroSection(), /router's type/);
});

test('hero mode asks before spawning when approval is required, and Cancel stops', () => {
  assert.match(heroSection(), /`approval: required`/);
  assert.match(heroSection(), /Cancel/);
});

test('hero mode with report false writes no folder, even if the user typed report', () => {
  assert.match(heroSection(), /writes no `docs\/flows\/<slug>\/` folder/);
  assert.match(heroSection(), /even if the user typed `report`/);
});

test('/ask deep is documented as the same as /ironman', () => {
  assert.match(ask, /`\/ask deep <question>`[^\n]*same as `\/ironman`/);
});

test('the hero command list in the usage section names all eleven', () => {
  for (const n of ['thor', 'captainamerica', 'drstrange', 'blackwidow', 'hulk', 'thanos', 'antman', 'loki', 'ironman', 'hawkeye', 'spiderman']) {
    assert.ok(ask.includes('`/' + n + '`'), `usage does not list /${n}`);
  }
});
