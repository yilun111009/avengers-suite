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

test('/ask deep is documented next to /ironman as sharing its opus approval', () => {
  assert.match(ask, /`\/ask deep <question>`[^\n]*`\/ironman`/);
});

test('the hero command list in the usage section names all eleven', () => {
  for (const n of ['thor', 'captainamerica', 'drstrange', 'blackwidow', 'hulk', 'thanos', 'antman', 'loki', 'ironman', 'hawkeye', 'spiderman']) {
    assert.ok(ask.includes('`/' + n + '`'), `usage does not list /${n}`);
  }
});

test('step 7 sends the preset text inside the LENS block and says it replaces conflicting sections', () => {
  const step7 = ask.split('### 7. Ask the agent')[1].split('### 8.')[0];
  assert.match(step7, /for a `type: auto` hero, append the hero file text/);
  assert.match(step7, /instructions replace the Sections and Diagram above when they conflict/);
  assert.doesNotMatch(heroSection(), /under a line `HERO:`/);
});

test('the approval question comes in step 7 and the text does not promise that nothing was written before it', () => {
  const h = heroSection();
  assert.match(h, /before spawning the explain agent in step 7/);
  assert.match(h, /onboarding may already have run/);
  assert.doesNotMatch(h, /nothing runs and nothing is written/);
});

test('the approval question is asked at most once per run', () => {
  assert.match(heroSection(), /ask at most once per run/);
});

test('report false also means no answer.md, and report is the one keyword that does not win', () => {
  const h = heroSection();
  assert.match(h, /do not write `answer\.md` either/);
  assert.match(h, /`report` is the one keyword that does not win/);
});

test('/ask deep is described as sharing the opus approval, not as identical to /ironman', () => {
  assert.match(ask, /uses the same opus approval and model as `\/ironman`/);
  assert.doesNotMatch(ask, /This is the same as `\/ironman`\./);
});

test('ask writes the hero name into the report JSON, with ironman only for plain /ask deep, and omits it in plain /ask', () => {
  const step9 = ask.split('### 9. Report')[1].split('Layout:')[0];
  assert.match(step9, /Also set `hero`:/);
  assert.match(step9, /omit `hero` in plain `\/ask`/);
  assert.match(step9, /The report builder uses it to pick the look in `themes\/`/);
});

test('the hero look is only for the user: a named audience (even dev) leaves hero out', () => {
  const step4 = ask.split('### 4. Detect')[1].split('### 5.')[0];
  assert.match(step4, /Remember `forMe`/);
  assert.match(step4, /It is false when the audience was named in the question \(even `dev`\)/);
  const step9 = ask.split('### 9. Report')[1].split('Layout:')[0];
  assert.match(step9, /Set `hero` only when `forMe` is true/);
  assert.match(step9, /omits `hero`, so it carries no emblem, band or hero tagline/);
});

test('plainreport rebuilds with --no-theme into report.plain.html, keeps the originals, and rebuilds a team folder too', () => {
  const s = read('skills/plainreport/SKILL.md').replace(/\r\n/g, '\n');
  assert.match(s, /^---\nname: plainreport\n/);
  assert.match(s, /build-report\.mjs" docs\/flows\/<slug>\/report\.json docs\/flows\/<slug>\/report\.plain\.html --no-theme/);
  assert.match(s, /Keep the original `report\.json` and `report\.html`/);
  assert.match(s, /`type` is `assemble`/);
  assert.match(s, /build-assemble\.mjs" docs\/flows\/<slug>\/report\.json docs\/flows\/<slug>\/report\.plain\.html --no-theme/);
  assert.match(s, /has no link that leads back to a themed one/);
  assert.match(s, /labelled Agent 1, Agent 2/);
  assert.match(s, /does not edit the free text/);
  assert.doesNotMatch(s, /team page is not supported/);
  assert.match(s, /Never accept a path with `\.\.`/);
  assert.match(s, /No agent runs|does not rewrite the answer/);
});

test('the hero command wins over deep when choosing the look, and ironman is only for plain /ask deep', () => {
  const step9 = ask.split('### 9. Report')[1].split('Layout:')[0];
  assert.match(step9, /in hero mode set `hero` to the hero's name even when `deep` was typed/);
  assert.match(step9, /only for plain `\/ask deep` set it to `ironman`/);
});

test('every skill shows a short usage hint after its command name (argument-hint)', () => {
  const skills = readdirSync(fileURLToPath(new URL('../skills/', import.meta.url)));
  assert.ok(skills.length >= 15);
  for (const n of skills) {
    const front = read(`skills/${n}/SKILL.md`).split('\n---\n')[0];
    const m = /\nargument-hint: "([^"\n]+)"$/m.exec(front);
    assert.ok(m, `${n} skill has no argument-hint in its frontmatter`);
    assert.ok(m[1].length <= 70, `${n} argument-hint is too long to read at a glance`);
    if (heroNames.includes(n) || n === 'ask' || n === 'explain') assert.match(m[1], /</, `${n} hint should name the argument`);
  }
});
