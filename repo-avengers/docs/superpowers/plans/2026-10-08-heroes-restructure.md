# Heroes Restructure (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the plugin to the `engine/` + `heroes/` + `audiences/` layout and ship five hero commands (`/thor`, `/captainamerica`, `/drstrange`, `/blackwidow`, `/hulk`) with no change to what `/ask` does.

**Architecture:** Scripts move from `skills/explain/` to `engine/`. The five lens files become hero definition files (`heroes/<name>.md`: frontmatter + the existing lens body). Audiences move to the plugin root. Each hero gets a thin skill that calls `ask` in "hero mode". Preflight builds its prompt-file list from `heroes/`, validates hero frontmatter, and checks that every hero has a skill and every hero skill has a hero file.

**Tech Stack:** Node.js ESM scripts, `node:test`, Markdown skills. No dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-heroes-and-assemble-design.md` (sections 3, 6, 7 steps 1-4 and 7). This plan is phase 1 of 3. Phase 2 (Thanos, Ant-Man, Loki, Ironman, Hawkeye, Spiderman) and phase 3 (`/assemble`) get their own plans.

## Global Constraints

- The agent file keeps `tools: Read, Grep, Glob` and `model: sonnet`. Nothing in this plan edits `agents/repo-avengers.md`.
- The skill may write only to `docs/flows/**` and `.claude/avengers-hints.md`.
- The `type` slugs (`architecture`, `logic`, `workflow`, `support`, `impact`) are not renamed, so saved reports and the index filter keep working.
- Marketplace id stays `rg-local`; plugin name stays `repo-avengers`.
- Hero `intro` is flavour only; it cannot change rules or sections.
- Prompt files (heroes and audiences) must pass the existing unsafe-wording scan: no tool names, no "run a command", no "delete/modify/create files", no modifying git/npm commands.
- Hero file frontmatter fields: `name`, `command`, `type`, `audience`, `model` (`sonnet|opus|haiku`), `report` (`true|false`), `approval` (`none|required`), `intro`.
- Version after this plan: `1.2.0`. Later phases ship as their own versions with their own CHANGELOG sections (the user wants every update tracked separately; the spec's "1.2.0" label covered the whole design).
- Edit files with their existing line endings. `CHANGELOG.md` is CRLF in the working tree; use the Python snippet in Task 4, not the Edit tool, for it.
- Run the whole suite with `node --test "tests/*.test.mjs"` (quoted glob). It must be green at the end of every task. Baseline: 70 tests passing at commit `396136a`.

## Review Focus

Inputs and conditions the spec implies but does not spell out; each has a pinning test in the task shown.

1. A hero file saved with Windows line endings must still validate (Task 2).
2. A hero `intro` containing a colon ("Hulk smash: checking...") must parse, not break the frontmatter (Task 2).
3. A hero file whose frontmatter `name` does not match its file name must fail, naming the file (Task 2).
4. A stray folder under `skills/` (a half-created hero skill) must fail preflight and name the folder (Task 3).
5. `/hulk for qa <question>`: the named audience wins over the hero's default audience (Task 3, skill text test).

## File Structure

| Path | Responsibility | Change |
|---|---|---|
| `engine/*.mjs` (5 files) | check-onboarding, detect-route, build-report, build-index, migrate-reports | moved from `skills/explain/` (Task 1) |
| `engine/check-onboarding.mjs` | preflight: hero listing, frontmatter validation, unsafe scan, pairing | modified (Tasks 1-3) |
| `heroes/{thor,captainamerica,drstrange,blackwidow,hulk}.md` | frontmatter + lens body | moved/converted from `skills/ask/lenses/` (Task 2) |
| `audiences/{dev,qa,pm,support}.md` | audience prompt files | moved from `skills/ask/audiences/` (Task 2) |
| `skills/<hero>/SKILL.md` (5 files) | thin entry points | created (Task 3) |
| `skills/ask/SKILL.md` | front door, gains hero mode | modified (Tasks 1-3) |
| `skills/explain/SKILL.md` | deprecated alias | modified (Task 1) |
| `tests/*.test.mjs` | paths, fixtures, new tests | modified; `lenses.test.mjs` renamed `heroes.test.mjs` |
| `README.md`, `CHANGELOG.md`, `.claude-plugin/plugin.json` | docs and version | modified (Task 4) |

---

### Task 1: Move the scripts to `engine/`

**Files:**
- Move: `skills/explain/{check-onboarding,detect-route,build-report,build-index,migrate-reports}.mjs` to `engine/`
- Modify: `engine/check-onboarding.mjs:18-19`
- Modify: `tests/{build-index,build-report,detect-route,lenses,preflight,plugin}.test.mjs` (path strings), `tests/agent.test.mjs:10`
- Modify: `skills/ask/SKILL.md:23`, `skills/explain/SKILL.md`
- Test: `tests/plugin.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: scripts at `engine/<name>.mjs`. `check-onboarding.mjs` still honours `AVENGERS_AGENT_PATH` and `AVENGERS_ASK_DIR` (renamed in Task 2). `<scripts dir>` in skill text now means `<plugin dir>/engine`, and `<plugin dir>` means `<ask dir>/../..`.

- [ ] **Step 1: Write the failing test**

In `tests/plugin.test.mjs`, add `existsSync` to the existing `node:fs` import, then append:

```js
test('the scripts live in engine/, not skills/explain/', () => {
  for (const f of ['check-onboarding', 'detect-route', 'build-report', 'build-index', 'migrate-reports']) {
    assert.ok(existsSync(fileURLToPath(new URL(`../engine/${f}.mjs`, import.meta.url))), `engine/${f}.mjs is missing`);
    assert.ok(!existsSync(fileURLToPath(new URL(`../skills/explain/${f}.mjs`, import.meta.url))), `skills/explain/${f}.mjs should have moved`);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/plugin.test.mjs`
Expected: FAIL, `engine/check-onboarding.mjs is missing`.

- [ ] **Step 3: Move the scripts**

```bash
mkdir engine
git mv skills/explain/check-onboarding.mjs skills/explain/detect-route.mjs skills/explain/build-report.mjs skills/explain/build-index.mjs skills/explain/migrate-reports.mjs engine/
```

- [ ] **Step 4: Fix the two relative paths in `engine/check-onboarding.mjs`**

Replace lines 18-19:

```js
const agentPath = process.env.AVENGERS_AGENT_PATH ?? fileURLToPath(new URL('../agents/repo-avengers.md', import.meta.url));
const askDir = process.env.AVENGERS_ASK_DIR ?? fileURLToPath(new URL('../skills/ask/', import.meta.url));
```

(`migrate-reports.mjs` finds `build-report.mjs` next to itself via `import.meta.url`, and both moved together, so it needs no change.)

- [ ] **Step 5: Update the test path strings**

```bash
sed -i -E 's#skills/explain/(check-onboarding|build-report|build-index|migrate-reports|detect-route)\.mjs#engine/\1.mjs#g' tests/*.mjs
```

In `tests/agent.test.mjs`, change line 10 to:

```js
const script = join(root, 'engine', 'check-onboarding.mjs');
```

- [ ] **Step 6: Update the skill text**

In `skills/ask/SKILL.md`, replace

```
`<scripts dir>` is the sibling folder `<ask dir>/../explain`, where the scripts live.
```

with

```
`<plugin dir>` is `<ask dir>/../..`. `<scripts dir>` is `<plugin dir>/engine`, where the scripts live.
```

In `skills/explain/SKILL.md`, replace the sentence `This folder also holds the scripts that `ask` runs (`check-onboarding.mjs`, `detect-route.mjs`, `build-report.mjs`, `build-index.mjs`, `migrate-reports.mjs`), so do not delete it.` with `The scripts that `ask` runs live in the plugin's `engine/` folder.` Keep the file under 25 lines.

- [ ] **Step 7: Run the whole suite and preflight**

Run: `node --test "tests/*.test.mjs"` then `node engine/check-onboarding.mjs preflight`
Expected: all tests pass (71 with the new one); preflight prints `"ok": true`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: move scripts from skills/explain to engine" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Convert lenses to hero files, move audiences, validate heroes in preflight

**Files:**
- Move: `skills/ask/lenses/*.md` to `heroes/<hero>.md` (with frontmatter prepended)
- Move: `skills/ask/audiences/` to `audiences/`
- Rename: `tests/lenses.test.mjs` to `tests/heroes.test.mjs`
- Modify: `engine/check-onboarding.mjs` (constants block and `promptProblems`)
- Modify: `tests/preflight.test.mjs`, `tests/agent.test.mjs`, `tests/skills.test.mjs:12`
- Modify: `skills/ask/SKILL.md` (step 1 note, step 5, step 7)

**Interfaces:**
- Consumes: Task 1 layout.
- Produces: env var `AVENGERS_PLUGIN_DIR` (directory containing `heroes/`, `audiences/`, `skills/`; replaces `AVENGERS_ASK_DIR`). Failure ids: `prompt-missing`, `prompt-unsafe`, `hero-invalid` (replace `lens-missing`, `lens-unsafe`). Constants `CORE_HEROES`, `KNOWN_TYPES`, `MODELS`. Functions `frontmatter(text) -> object|null`, `heroFiles() -> string[]`, `heroProblems(name, text) -> failure[]`.

- [ ] **Step 1: Rewrite the preflight test fixtures and add the hero tests**

In `tests/preflight.test.mjs`:

Change the imports line `import { join } from 'node:path';` to `import { join, dirname } from 'node:path';`.

Replace lines 9-28 (everything from `const script` through the end of `makeAsk`) with:

```js
const script = fileURLToPath(new URL('../engine/check-onboarding.mjs', import.meta.url));
const HEROES = ['thor', 'captainamerica', 'drstrange', 'blackwidow', 'hulk'];
const TYPE_OF = { thor: 'architecture', captainamerica: 'logic', drstrange: 'workflow', blackwidow: 'support', hulk: 'impact' };
const AUDIENCES = ['dev', 'qa', 'pm', 'support'];
const SAFE = '# Prompt file\n\nLook at the code and describe what you find.\n';

function makeRepo() {
  const d = mkdtempSync(join(tmpdir(), 'avengers-repo-'));
  writeFileSync(join(d, 'app.js'), 'export {}\n');
  return d;
}
function heroText(name, body = SAFE) {
  return ['---', `name: ${name}`, `command: /${name}`, `type: ${TYPE_OF[name]}`, 'audience: dev', 'model: sonnet', 'report: true', 'approval: none', 'intro: "Ready."', '---', body].join('\n');
}
// overrides: { 'heroes/hulk': 'text' } replaces a file; a null value leaves it out;
// { 'skills/stray': 'text' } adds a skill folder that has no hero.
function makePlugin(overrides = {}) {
  const d = mkdtempSync(join(tmpdir(), 'avengers-plugin-'));
  const put = (rel, text) => { mkdirSync(join(d, dirname(rel)), { recursive: true }); writeFileSync(join(d, rel), text); };
  for (const n of HEROES) {
    const hk = `heroes/${n}`;
    const ht = hk in overrides ? overrides[hk] : heroText(n);
    if (ht !== null) put(`${hk}.md`, ht);
    const sk = `skills/${n}`;
    const st = sk in overrides ? overrides[sk] : '# thin skill\n';
    if (st !== null) put(`${sk}/SKILL.md`, st);
  }
  for (const n of AUDIENCES) {
    const ak = `audiences/${n}`;
    const at = ak in overrides ? overrides[ak] : SAFE;
    if (at !== null) put(`${ak}.md`, at);
  }
  for (const k of Object.keys(overrides)) {
    if (k.startsWith('skills/') && !HEROES.some((h) => k === `skills/${h}`)) put(`${k}/SKILL.md`, overrides[k]);
  }
  return d;
}
```

Change the `preflight` helper to take `plugin` and the new env var:

```js
function preflight({ repo = makeRepo(), plugin = makePlugin(), agent = makeAgent('Read, Grep, Glob') } = {}) {
  const r = spawnSync(process.execPath, [script, 'preflight'], {
    cwd: repo,
    env: { ...process.env, AVENGERS_AGENT_PATH: agent, AVENGERS_PLUGIN_DIR: plugin },
    encoding: 'utf8',
  });
  return JSON.parse(r.stdout);
}
```

Replace the four prompt-file tests (the ones that use `makeAsk` and `lens-*` ids) with:

```js
test('preflight fails when a hero names a tool, and says which file', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/captainamerica': heroText('captainamerica', '# Lens\n\nUse Bash to list the files.\n') }) });
  const f = r.failures.find((x) => x.id === 'prompt-unsafe');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /heroes[\\/]captainamerica\.md/);
});

test('preflight fails when an audience tells the agent to run something', () => {
  const r = preflight({ plugin: makePlugin({ 'audiences/qa': '# Audience\n\nThen run the command and show the output.\n' }) });
  assert.ok(ids(r).includes('prompt-unsafe'));
});

test('preflight fails when a prompt file tells the agent to change files', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk', '# Lens\n\nAlso delete the old file.\n') }) });
  assert.ok(ids(r).includes('prompt-unsafe'));
});

test('preflight fails when a core hero file is missing, and names the path', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': null }) });
  const f = r.failures.find((x) => x.id === 'prompt-missing');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /hulk\.md/);
});

test('preflight accepts a hero file with Windows line endings', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk').replace(/\n/g, '\r\n') }) });
  assert.equal(r.ok, true, JSON.stringify(r.failures));
});

test('preflight accepts a hero intro that contains a colon and a comma', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk').replace('intro: "Ready."', 'intro: "Hulk smash: checking, now."') }) });
  assert.equal(r.ok, true, JSON.stringify(r.failures));
});

test('preflight fails on a hero with an unknown model, and names the file', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk').replace('model: sonnet', 'model: gpt') }) });
  const f = r.failures.find((x) => x.id === 'hero-invalid');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /hulk\.md/);
  assert.match(f.problem, /model/);
});

test('preflight fails on a hero with an unknown type', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk').replace('type: impact', 'type: nonsense') }) });
  assert.ok(ids(r).includes('hero-invalid'));
});

test('preflight fails when the hero frontmatter name does not match the file name', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk').replace('name: hulk', 'name: thanos') }) });
  const f = r.failures.find((x) => x.id === 'hero-invalid');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /name/);
});

test('preflight fails when a hero file has no frontmatter', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': '# Lens: impact\n\nNo frontmatter here.\n' }) });
  assert.ok(ids(r).includes('hero-invalid'));
});
```

- [ ] **Step 2: Rewrite the lens test file as the hero test file**

```bash
git mv tests/lenses.test.mjs tests/heroes.test.mjs
```

Replace its whole content with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginDir = fileURLToPath(new URL('../', import.meta.url));
const script = fileURLToPath(new URL('../engine/check-onboarding.mjs', import.meta.url));
const HEROES = ['thor', 'captainamerica', 'drstrange', 'blackwidow', 'hulk'];
const AUDIENCES = ['dev', 'qa', 'pm', 'support'];

test('each hero file has the three headings the agent relies on', () => {
  for (const n of HEROES) {
    const t = readFileSync(join(pluginDir, 'heroes', `${n}.md`), 'utf8');
    for (const h of ['## Looks for', '## Sections', '## Diagram']) assert.ok(t.includes(h), `${n}.md is missing ${h}`);
  }
});

test('each hero file starts with its own name and command in the frontmatter', () => {
  for (const n of HEROES) {
    const t = readFileSync(join(pluginDir, 'heroes', `${n}.md`), 'utf8').replace(/\r\n/g, '\n');
    assert.ok(t.startsWith(`---\nname: ${n}\ncommand: /${n}\ntype: `), `${n}.md frontmatter is wrong`);
  }
});

test('each audience file has the two headings the agent relies on', () => {
  for (const n of AUDIENCES) {
    const t = readFileSync(join(pluginDir, 'audiences', `${n}.md`), 'utf8');
    for (const h of ['## Voice', '## Extra sections']) assert.ok(t.includes(h), `${n}.md is missing ${h}`);
  }
});

test('the shipped hero and audience files pass the preflight scan', () => {
  const repo = mkdtempSync(join(tmpdir(), 'avengers-repo-'));
  writeFileSync(join(repo, 'app.js'), 'export {}\n');
  const agent = join(mkdtempSync(join(tmpdir(), 'avengers-agent-')), 'agent.md');
  writeFileSync(agent, '---\nname: x\ntools: Read, Grep, Glob\n---\nbody\n');
  const env = { ...process.env, AVENGERS_AGENT_PATH: agent };
  delete env.AVENGERS_PLUGIN_DIR;
  const r = JSON.parse(spawnSync(process.execPath, [script, 'preflight'], { cwd: repo, env, encoding: 'utf8' }).stdout);
  assert.deepEqual(r.failures.filter((f) => f.id.startsWith('prompt') || f.id.startsWith('hero')), []);
});
```

- [ ] **Step 3: Fix the other tests that name the old paths**

`tests/agent.test.mjs`: change `delete env.AVENGERS_ASK_DIR;` to `delete env.AVENGERS_PLUGIN_DIR;` and change the last test's second path to `join(root, 'audiences', 'dev.md')`.

`tests/skills.test.mjs` line 12: change the needle `'lenses/'` to `'heroes/'`.

- [ ] **Step 4: Run the suite to verify it fails**

Run: `node --test "tests/*.test.mjs"`
Expected: FAIL in `heroes.test.mjs` and `preflight.test.mjs` (hero files and the new env var do not exist yet).

- [ ] **Step 5: Move the files and prepend the frontmatter**

```bash
mkdir heroes
mv_hero() { # <old lens> <hero> <default audience> <intro>
  git mv "skills/ask/lenses/$1.md" "heroes/$2.md"
  { printf -- '---\nname: %s\ncommand: /%s\ntype: %s\naudience: %s\nmodel: sonnet\nreport: true\napproval: none\nintro: "%s"\n---\n' "$2" "$2" "$1" "$3" "$4"; cat "heroes/$2.md"; } > "heroes/$2.md.tmp" && mv "heroes/$2.md.tmp" "heroes/$2.md"
}
mv_hero architecture thor dev "Thor is mapping the realms of this repo..."
mv_hero logic captainamerica dev "Captain America is checking the rules..."
mv_hero workflow drstrange dev "Doctor Strange is viewing every path this request can take..."
mv_hero support blackwidow support "Black Widow is tracing the trail from symptom to cause..."
mv_hero impact hulk dev "Hulk smash. Checking what breaks..."
git mv skills/ask/audiences audiences
```

Check: `head -12 heroes/hulk.md` shows the frontmatter, a blank-free `---`, then `# Lens: impact`. `ls skills/ask` shows only `SKILL.md`.

- [ ] **Step 6: Implement the preflight changes**

In `engine/check-onboarding.mjs`, replace the `agentPath`/`askDir`/`LENSES` block (lines 17-20) with:

```js
// AVENGERS_AGENT_PATH and AVENGERS_PLUGIN_DIR exist so tests can point the checks at fixture files; the checks still apply in full.
const agentPath = process.env.AVENGERS_AGENT_PATH ?? fileURLToPath(new URL('../agents/repo-avengers.md', import.meta.url));
const pluginDir = process.env.AVENGERS_PLUGIN_DIR ?? fileURLToPath(new URL('../', import.meta.url));
const CORE_HEROES = ['thor', 'captainamerica', 'drstrange', 'blackwidow', 'hulk'];
const KNOWN_TYPES = ['architecture', 'logic', 'workflow', 'support', 'impact'];
const MODELS = ['sonnet', 'opus', 'haiku'];
```

Replace the comment and `promptProblems` function (from the line `// Lens and audience files are instructions` down to the closing brace of `promptProblems`, keeping the `UNSAFE_PATTERNS` array unchanged between them) so the section reads:

```js
// Hero and audience files are instructions placed in the agent's prompt. They must exist, and must not name tools
// or tell the agent to run or change anything. Best-effort text scan, like the secret scan in build-report.mjs.
const UNSAFE_PATTERNS = [
  [/\b(Bash|PowerShell|NotebookEdit|WebFetch|WebSearch|Write|Edit)\b/, 'names a tool'],
  [/\b(run|execute|invoke)\s+(a |an |the |any )?(shell|command|script|program|tool)s?\b/i, 'tells the agent to run something'],
  [/\b(create|modify|delete|overwrite|rename)\s+(?:(?:a|an|the|any|this|that|old|new|existing|local|temporary)\s+){0,3}(file|files|folder|folders|director(y|ies))\b/i, 'tells the agent to change files'],
  [/\b(git\s+(commit|push|checkout|reset)|npm\s+(install|run))\b/i, 'names a modifying command'],
];

function frontmatter(text) {
  const m = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const o = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (kv) o[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return o;
}

// every hero that must exist (the core five) plus any other file in heroes/
function heroFiles() {
  const dir = join(pluginDir, 'heroes');
  const found = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)) : [];
  return [...new Set([...CORE_HEROES, ...found])];
}

function heroProblems(name, text) {
  const fm = frontmatter(text);
  const file = `heroes/${name}.md`;
  const fix = `Fix the frontmatter of ${file}: name, command, type, audience, model, report, approval and intro are all required.`;
  if (!fm) return [{ id: 'hero-invalid', problem: `${file} has no frontmatter.`, fix }];
  const bad = [];
  if (fm.name !== name) bad.push('name (must equal the file name)');
  if (fm.command !== '/' + name) bad.push('command (must be /' + name + ')');
  if (!KNOWN_TYPES.includes(fm.type)) bad.push('type (one of ' + KNOWN_TYPES.join(', ') + ')');
  if (!AUDIENCES.includes(fm.audience)) bad.push('audience (one of ' + AUDIENCES.join(', ') + ')');
  if (!MODELS.includes(fm.model)) bad.push('model (one of ' + MODELS.join(', ') + ')');
  if (!['true', 'false'].includes(fm.report)) bad.push('report (true or false)');
  if (!['none', 'required'].includes(fm.approval)) bad.push('approval (none or required)');
  if (!fm.intro) bad.push('intro (one line)');
  return bad.length ? [{ id: 'hero-invalid', problem: `${file} has invalid frontmatter: ${bad.join('; ')}.`, fix }] : [];
}

function promptProblems() {
  const found = [];
  const expected = [...heroFiles().map((n) => ['heroes', n]), ...AUDIENCES.map((n) => ['audiences', n])];
  for (const [dir, name] of expected) {
    const p = join(pluginDir, dir, name + '.md');
    if (!existsSync(p)) {
      found.push({ id: 'prompt-missing', problem: 'Missing prompt file: ' + p, fix: 'Restore ' + dir + '/' + name + '.md in the plugin folder.' });
      continue;
    }
    const text = readFileSync(p, 'utf8');
    for (const [re, why] of UNSAFE_PATTERNS) {
      if (re.test(text)) found.push({ id: 'prompt-unsafe', problem: dir + '/' + name + '.md ' + why + '.', fix: 'Edit ' + dir + '/' + name + '.md so it only says what to look for and how to write the answer.' });
    }
    if (dir === 'heroes') found.push(...heroProblems(name, text));
  }
  return found;
}
```

The four `UNSAFE_PATTERNS` entries are unchanged from the current file; they are repeated here so the block is complete.

- [ ] **Step 7: Update `skills/ask/SKILL.md`**

1. Step 2 failure text: replace `a missing or unsafe lens/audience file (the failure names the file)` with `a missing, invalid or unsafe hero or audience file (the failure names the file)`.
2. Replace step 5 (heading and paragraph) with:

```
### 5. Load the hero prompt and the audience
Read the hero file in `<plugin dir>/heroes/` whose `type:` equals the detected type (architecture is `thor.md`, logic is `captainamerica.md`, workflow is `drstrange.md`, support is `blackwidow.md`, impact is `hulk.md`) and `<plugin dir>/audiences/<audience>.md`. Use the hero file text after its closing `---` line as the lens. If either file is missing, stop and name the exact path. Never continue with a blank prompt: that would silently drop the format rules.
```

3. Step 7: replace `then the lens file text under a line `LENS:`` with `then the hero file text after its frontmatter under a line `LENS:``.

- [ ] **Step 8: Run the suite and the real preflight**

Run: `node --test "tests/*.test.mjs"` then `node engine/check-onboarding.mjs preflight`
Expected: all pass; preflight `"ok": true`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: lenses become hero files; audiences move to the plugin root" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Hero skills, hero mode and the pairing check

**Files:**
- Create: `skills/{thor,captainamerica,drstrange,blackwidow,hulk}/SKILL.md`
- Modify: `engine/check-onboarding.mjs` (add `pairingProblems`)
- Modify: `skills/ask/SKILL.md` (add the Hero mode section)
- Modify: `tests/preflight.test.mjs`, `tests/skills.test.mjs`

**Interfaces:**
- Consumes: `heroFiles()`, `pluginDir` (Task 2).
- Produces: `pairingProblems() -> failure[]` (id `hero-unpaired`); `NON_HERO_SKILLS`; hero mode contract in the `ask` skill (`hero: <name>`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/preflight.test.mjs`:

```js
test('preflight fails when a hero has no skill, and names it', () => {
  const r = preflight({ plugin: makePlugin({ 'skills/hulk': null }) });
  const f = r.failures.find((x) => x.id === 'hero-unpaired');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /skills\/hulk\/SKILL\.md/);
});

test('preflight fails on a stray skill folder that has no hero file, and names the folder', () => {
  const r = preflight({ plugin: makePlugin({ 'skills/stray': '# half made\n' }) });
  const f = r.failures.find((x) => x.id === 'hero-unpaired');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /skills\/stray/);
});

test('preflight ignores the ask, assemble and explain skill folders', () => {
  const plugin = makePlugin({ 'skills/ask': '# ask\n', 'skills/assemble': '# assemble\n', 'skills/explain': '# explain\n' });
  assert.equal(preflight({ plugin }).ok, true);
});
```

Append to `tests/skills.test.mjs` (add `readdirSync` to a new `import { readdirSync } from 'node:fs';` line if it is not imported):

```js
const heroNames = readdirSync(fileURLToPath(new URL('../heroes/', import.meta.url))).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));

test('every hero has a thin skill that calls ask in hero mode', () => {
  assert.ok(heroNames.length >= 5);
  for (const n of heroNames) {
    const s = read(`skills/${n}/SKILL.md`).replace(/\r\n/g, '\n');
    assert.match(s, new RegExp(`^---\\nname: ${n}\\n`), `${n} skill name`);
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test "tests/*.test.mjs"`
Expected: FAIL (no hero skills, no pairing check, no Hero mode section).

- [ ] **Step 3: Create the five thin skills**

```bash
mk_skill() { # <name> <description sentence>
  mkdir -p "skills/$1"
  printf -- '---\nname: %s\ndescription: %s Trigger: /%s\n---\n\n# %s\n\nInvoke the `ask` skill (use the exact name in the skill list; it may carry a plugin prefix) in hero mode with `hero: %s` and exactly the arguments given here, and follow it. All settings for this hero are in `heroes/%s.md`; do not copy them here.\n' "$1" "$2" "$1" "$1" "$1" "$1" > "skills/$1/SKILL.md"
}
mk_skill thor "Thor maps how the current repo is structured: layers, boundaries and how the parts connect, with file:line citations and an HTML report."
mk_skill captainamerica "Captain America checks the rules in the current repo: what is allowed, when things happen and why something is refused, with citations and an HTML report."
mk_skill drstrange "Doctor Strange follows a request through every path in the current repo, the success path and each failure branch, with citations and an HTML report."
mk_skill blackwidow "Black Widow traces a symptom or error in the current repo to its cause and says what to check and who to escalate to, written for support."
mk_skill hulk "Hulk shows what breaks if you change or remove something in the current repo: blast radius ranked by risk and the tests to run."
```

Check: `cat skills/hulk/SKILL.md` is 8 lines and ends with `Trigger: /hulk` in the description.

- [ ] **Step 4: Add the pairing check to `engine/check-onboarding.mjs`**

Add `const NON_HERO_SKILLS = new Set(['ask', 'assemble', 'explain']);` next to the other constants, add this function above `promptProblems`:

```js
// every hero needs a skill (or /<hero> would not exist) and every skill folder except the known non-hero ones needs a hero
function pairingProblems() {
  const found = [];
  const skillsDir = join(pluginDir, 'skills');
  if (!existsSync(skillsDir)) return found;
  const heroes = heroFiles();
  for (const name of heroes) {
    if (!existsSync(join(skillsDir, name, 'SKILL.md'))) found.push({ id: 'hero-unpaired', problem: `heroes/${name}.md has no skills/${name}/SKILL.md, so /${name} would not exist.`, fix: `Add skills/${name}/SKILL.md (copy a thin hero skill) or remove heroes/${name}.md.` });
  }
  for (const d of readdirSync(skillsDir, { withFileTypes: true })) {
    if (d.isDirectory() && !NON_HERO_SKILLS.has(d.name) && !heroes.includes(d.name)) found.push({ id: 'hero-unpaired', problem: `skills/${d.name}/ has no heroes/${d.name}.md.`, fix: `Add heroes/${d.name}.md or remove skills/${d.name}/.` });
  }
  return found;
}
```

and in `promptProblems`, change the last line `return found;` to:

```js
  found.push(...pairingProblems());
  return found;
```

- [ ] **Step 5: Add the Hero mode section to `skills/ask/SKILL.md`**

Insert before the `## Safety contract (read first)` heading:

```
## Hero mode

A hero skill (`/thor`, `/captainamerica`, `/drstrange`, `/blackwidow`, `/hulk`) invokes this skill with `hero: <name>`. In hero mode:
1. Read `<plugin dir>/heroes/<name>.md`. Print its `intro` line first. Its `type`, `audience`, `model`, `report` and `approval` replace the detected defaults.
2. Skip the type detection in step 4. Still run the router for the audience only: a named audience in the question (for example `/hulk for qa ...`) wins over the hero's default audience. When the hero file sets an audience and none is named, use it and do not ask the audience question.
3. Pass the hero's `model` on the Agent call. If `approval: required`, ask for approval first, exactly as for `deep` in step 7.
4. `report: false` means the same as `text`.
5. Everything else (preflight, onboarding, context, report, index) is unchanged. The `Treated as:` line gains the hero's name: `Treated as: <type> question, for <audience> (<name>).`
```

Also add to the Usage list: ``- `/thor`, `/captainamerica`, `/drstrange`, `/blackwidow`, `/hulk` `<question>`: the same as `/ask`, with the question type fixed to the hero's lens and the hero's default audience`` .

- [ ] **Step 6: Run the suite and the real preflight**

Run: `node --test "tests/*.test.mjs"` then `node engine/check-onboarding.mjs preflight`
Expected: all pass; preflight `"ok": true`, no `hero-unpaired`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: five hero commands, hero mode in ask, hero/skill pairing check" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Docs and version 1.2.0

**Files:**
- Modify: `README.md`, `CHANGELOG.md` (CRLF), `.claude-plugin/plugin.json`, `tests/plugin.test.mjs`

**Interfaces:**
- Consumes: the finished layout and hero commands.
- Produces: version `1.2.0`; changelog sections for 1.2.0 (new), 1.1.0, 1.0.0.

- [ ] **Step 1: Write the failing version tests**

In `tests/plugin.test.mjs` change the first test to expect `'1.2.0'` (title `plugin.json is repo-avengers 1.2.0`), and replace the changelog test with:

```js
test('the changelog has a 1.2.0 entry on top and keeps 1.1.0 and 1.0.0', () => {
  const c = read('CHANGELOG.md').replace(/\r\n/g, '\n');
  assert.match(c, /^# Changelog\n\n## 1\.2\.0 /);
  assert.match(c, /\n## 1\.1\.0 /);
  assert.match(c, /\n## 1\.0\.0 /);
});

test('the README documents the hero commands and the new layout', () => {
  const r = read('README.md');
  for (const needle of ['/thor', '/captainamerica', '/drstrange', '/blackwidow', '/hulk', 'heroes/', 'engine/']) {
    assert.ok(r.includes(needle), `README does not mention ${needle}`);
  }
});
```

Run `node --test tests/plugin.test.mjs`; expected: FAIL on all three.

- [ ] **Step 2: Bump the version**

In `.claude-plugin/plugin.json` change `"version": "1.1.0"` to `"version": "1.2.0"`.

- [ ] **Step 3: Add the changelog section (keeps CRLF)**

```bash
python - <<'EOF'
p = 'CHANGELOG.md'
s = open(p, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
head = '# Changelog' + nl + nl
assert s.startswith(head)
entry = '''## 1.2.0 - 2026-10-08

### Added
- Hero commands: `/thor` (architecture), `/captainamerica` (logic), `/drstrange` (workflow), `/blackwidow` (support) and `/hulk` (impact). Each is `/ask` with the question type fixed to that hero's lens and the hero's default audience. A named audience in the question still wins (`/hulk for qa ...`).
- `heroes/<name>.md`: one definition file per hero (frontmatter: name, command, type, audience, model, report, approval, intro; body: the lens). Preflight validates every hero file and checks that each hero has a skill and each hero skill has a hero file.

### Changed
- Layout: the scripts moved from `skills/explain/` to `engine/`; the lens files became hero files in `heroes/`; `audiences/` moved to the plugin root. `/explain` stays as an alias.
- Preflight failure ids: `lens-missing` and `lens-unsafe` are now `prompt-missing` and `prompt-unsafe`; new ids `hero-invalid` and `hero-unpaired`. The test override `AVENGERS_ASK_DIR` is now `AVENGERS_PLUGIN_DIR`.

### Notes
- Reinstall or run `/reload-plugins` after updating. Saved reports keep working: the question type names did not change.

'''.replace('\\n', '\n').replace('\n', nl)
open(p, 'w', encoding='utf-8', newline='').write(head + entry + s[len(head):])
EOF
```

- [ ] **Step 4: Update `README.md`**

1. In the `## Use` code block, add after the `/ask deep ...` line:

```
/hulk what breaks if I change the Order status enum   # hero command: impact lens
/drstrange what happens when a payment fails          # hero command: workflow lens
```

2. Add a section after "Question types":

```
### Hero commands

Each hero is `/ask` with the question type fixed and a default audience. Name an audience in the question to override it.

| Command | Lens | Default audience |
|---|---|---|
| `/thor` | architecture | dev |
| `/captainamerica` | logic | dev |
| `/drstrange` | workflow | dev |
| `/blackwidow` | support | support |
| `/hulk` | impact | dev |

A hero is one file in `heroes/` (frontmatter plus the lens text) and one thin skill in `skills/<name>/`. The intro line is flavour only; it cannot change the rules or the read-only guarantee.
```

3. In the "Read-only guarantee" preflight bullet, replace `if any lens or audience prompt file is missing, names a tool, or tells the agent to run or change something` with `if any hero or audience prompt file is missing, invalid, names a tool, or tells the agent to run or change something, or if a hero and its skill do not match`.
4. In `## Develop`, add: ``Scripts live in `engine/`, prompts in `heroes/` and `audiences/`, entry points in `skills/`.``

- [ ] **Step 5: Run the suite and the real preflight**

Run: `node --test "tests/*.test.mjs"` then `node engine/check-onboarding.mjs preflight`
Expected: all pass; preflight `"ok": true`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: 1.2.0 hero commands and new layout" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Manual check after the plan (needs the user)

Run `/reload-plugins`, then in a real repo: `/hulk what breaks if I change <something>`. Expect the Hulk intro line, a `Treated as: impact question, for dev (hulk).` line, and no audience question. Then `/hulk for qa <same question>` should answer for QA without asking. `/ask` and `/explain` must behave as before.
