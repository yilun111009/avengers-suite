# Heroes Phase 2 (new lenses and three presets) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new lens heroes (`/thanos`, `/antman`, `/loki`) and three preset heroes (`/ironman`, `/hawkeye`, `/spiderman`), keep `/ask deep` working as an alias of `/ironman`, and let plain `/ask` auto-detect the three new question types.

**Architecture:** One shared `engine/types.mjs` holds the question types and labels; `build-report`, `build-index`, `check-onboarding` and `detect-route` import it, so a type is added in one place. Lens heroes get their own `type` slug (`deadcode`, `deepdive`, `risk`) and a lens body. Preset heroes use `type: auto`: they have no lens body, route like plain `/ask`, and differ only in model, audience, report mode and approval.

**Tech Stack:** Node.js ESM scripts, `node:test`, Markdown skills. No dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-heroes-and-assemble-design.md` (sections 3.1, 3.2, 4, 6, 8). Phase 1 shipped as 1.2.0 (commit `8ced84b` on `main`). This is phase 2 of 3; `/assemble` is phase 3 and gets its own plan.

## Global Constraints

- `agents/repo-avengers.md` keeps `tools: Read, Grep, Glob` and `model: sonnet`. Task 4 adds one sentence about the new types to its body and nothing else.
- The skill writes only to `docs/flows/**` and `.claude/avengers-hints.md`.
- Existing type slugs (`architecture`, `logic`, `workflow`, `support`, `impact`) are not renamed. New slugs: `deadcode`, `deepdive`, `risk`.
- Hero frontmatter fields (unchanged): `name`, `command`, `type`, `audience`, `model` (`sonnet|opus|haiku`), `report` (`true|false`), `approval` (`none|required`), `intro`. New allowed `type` value: `auto`.
- The unsafe-wording scan (`UNSAFE_PATTERNS` in `engine/check-onboarding.mjs`) is not edited. Thanos text must say "candidates for removal" and never "delete files"; no hero text names a tool.
- Ruling (departs from spec section 4): the spec lists bare `unchecked` and the plan first listed bare `unreachable`; testing against the real router showed both misroute everyday questions ("the gateway is unreachable", "an unchecked checkbox"). The deadcode and risk rules therefore require a code noun ("unused function", "unreachable code", "unchecked return"). Cost if wrong: a few real dead-code or risk questions need a hero command (`/thanos`, `/loki`) instead of auto-detection.
- New auto-detect keywords are conservative. "safe to remove" and "safe to delete" stay with `impact`. Every existing routing fixture must keep its result.
- Version after this plan: `1.3.0`, with its own CHANGELOG section (every update is tracked separately).
- Line endings: working-copy files are CRLF on this machine (`core.autocrlf=true`). Tests that read repo files must normalise `\r\n` to `\n`. Edit files with the Edit tool or with a Python script that keeps each file's own line ending. **In Python source, never write `\r`, `\n` or `\b` inside a normal string that is meant to land in a JS file; use the Edit tool or a raw string** (this went wrong three times in phase 1).
- Run the whole suite with `node --test "tests/*.test.mjs"` (quoted glob). Baseline: 91 tests passing at commit `8ced84b`. It must be green at the end of every task.

## Review Focus

Inputs and conditions the spec implies but does not spell out; each has a pinning test in the task shown.

1. `/ask is anything unused in billing` must route to `deadcode`, but `/ask is it safe to remove the Order status enum` must still route to `impact` (Task 3).
2. Everyday words that look like the new keywords must NOT reroute: "unreachable" (a server), "unchecked" (a checkbox) and "unused" (a user inactive for 30 days) keep their old routes (Task 3).
3. A question containing both a new and an old keyword ("what could go wrong in the refund rules") must still return a sensible `alsoMatches` and never crash the router (Task 3).
4. A `type: auto` hero must not need a lens body, but a `type: auto` hero that has `## Looks for` text must still be scanned for unsafe wording (Task 5).
5. A report JSON with an unknown or missing `type` still builds as workflow with one warning, now including for `auto` (Task 1).
6. `/ironman` must ask for opus approval before spawning anything, and `/ask deep` must do the same; neither may spawn on `Cancel` (Task 6, skill text test).
7. `/hawkeye` must not write a report folder even though `report` could be flipped by a user keyword (Task 6, skill text test).

## File Structure

| Path | Responsibility | Change |
|---|---|---|
| `engine/types.mjs` | The single list of question types, their labels, and which are lens types | create (Task 1) |
| `engine/build-report.mjs`, `engine/build-index.mjs`, `engine/check-onboarding.mjs`, `engine/detect-route.mjs` | import the shared list | modify (Tasks 1, 2, 3) |
| `heroes/{thanos,antman,loki}.md` | lens heroes (frontmatter + lens body) | create (Task 4) |
| `heroes/{ironman,hawkeye,spiderman}.md` | preset heroes (`type: auto`, no lens) | create (Task 5) |
| `skills/{thanos,antman,loki,ironman,hawkeye,spiderman}/SKILL.md` | thin entry points | create (Tasks 4, 5) |
| `skills/ask/SKILL.md` | hero mode for `auto` heroes, `deep` as alias | modify (Task 6) |
| `agents/repo-avengers.md` | list the three new type slugs | modify, one sentence (Task 4) |
| `tests/*.test.mjs`, `tests/routing-fixtures.json` | new tests and fixtures | modify |
| `README.md`, `CHANGELOG.md`, `.claude-plugin/plugin.json` | docs and version 1.3.0 | modify (Task 7) |

---

### Task 1: One shared type list, and the three new types in reports and index

**Files:**
- Create: `engine/types.mjs`
- Modify: `engine/build-report.mjs:13-15`, `engine/build-index.mjs:30`
- Test: `tests/types.test.mjs` (create), `tests/build-report.test.mjs`, `tests/build-index.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces (from `engine/types.mjs`):
  - `export const LENS_TYPES = ['architecture', 'logic', 'workflow', 'support', 'impact', 'deadcode', 'deepdive', 'risk']`
  - `export const TYPE_LABEL = { architecture: 'Architecture', logic: 'Logic', workflow: 'Workflow', support: 'Support', impact: 'Impact', deadcode: 'Dead code', deepdive: 'Deep dive', risk: 'Risk' }`
  - `export const HERO_TYPES = [...LENS_TYPES, 'auto']` (what a hero file may say in `type:`)

- [ ] **Step 1: Write the failing tests**

Create `tests/types.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LENS_TYPES, TYPE_LABEL, HERO_TYPES } from '../engine/types.mjs';

test('the shared type list has the five old and the three new types', () => {
  assert.deepEqual(LENS_TYPES, ['architecture', 'logic', 'workflow', 'support', 'impact', 'deadcode', 'deepdive', 'risk']);
});

test('every type has a label, and hero files may also say auto', () => {
  for (const t of LENS_TYPES) assert.ok(TYPE_LABEL[t], `no label for ${t}`);
  assert.deepEqual(HERO_TYPES, [...LENS_TYPES, 'auto']);
});
```

Append to `tests/build-report.test.mjs`:

```js
test('a deadcode report builds with its own label', () => {
  const r = build({ type: 'deadcode' });
  assert.equal(r.status, 0);
  assert.match(r.html, /Treated as: Dead code question/);
});

test('deepdive and risk reports build with their own labels', () => {
  assert.match(build({ type: 'deepdive' }).html, /Treated as: Deep dive question/);
  assert.match(build({ type: 'risk' }).html, /Treated as: Risk question/);
});

test('type auto is not a report type: it builds as workflow with one warning', () => {
  const r = build({ type: 'auto' });
  assert.equal(r.status, 0);
  assert.match(r.html, /Treated as: Workflow question/);
  assert.equal((r.stderr.match(/unknown type/g) ?? []).length, 1);
});
```

Append to `tests/build-index.test.mjs`:

```js
test('the index lists and filters the three new types', () => {
  const r = buildIndex({ a: JSON.stringify({ title: 'A', type: 'deadcode' }), b: JSON.stringify({ title: 'B', type: 'deepdive' }), c: JSON.stringify({ title: 'C', type: 'risk' }) });
  assert.match(r.html, /data-type="deadcode"/);
  assert.match(r.html, /data-type="deepdive"/);
  assert.match(r.html, /data-type="risk"/);
  assert.match(r.html, /<option value="risk">risk<\/option>/);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test tests/types.test.mjs tests/build-report.test.mjs tests/build-index.test.mjs`
Expected: FAIL. `types.test.mjs` cannot import `engine/types.mjs`; the new report and index tests fail because the types are unknown (they fall back to workflow).

- [ ] **Step 3: Create `engine/types.mjs`**

```js
// The one list of question types. build-report, build-index, check-onboarding and detect-route all import it,
// so adding a type is a change in this file (plus its hero file and routing rule), not four.
export const LENS_TYPES = ['architecture', 'logic', 'workflow', 'support', 'impact', 'deadcode', 'deepdive', 'risk'];
export const TYPE_LABEL = {
  architecture: 'Architecture', logic: 'Logic', workflow: 'Workflow', support: 'Support', impact: 'Impact',
  deadcode: 'Dead code', deepdive: 'Deep dive', risk: 'Risk',
};
// a hero file may also say `auto`: no lens of its own, the router decides the type like plain /ask
export const HERO_TYPES = [...LENS_TYPES, 'auto'];
```

- [ ] **Step 4: Use it in `build-report.mjs` and `build-index.mjs`**

In `engine/build-report.mjs`, add `import { LENS_TYPES, TYPE_LABEL } from './types.mjs';` with the other imports, delete the two lines `const KNOWN_TYPES = [...]` and `const TYPE_LABEL = {...}`, and add `const KNOWN_TYPES = LENS_TYPES;` in their place.

In `engine/build-index.mjs`, add `import { LENS_TYPES } from './types.mjs';` with the other imports and replace `const TYPES = ['architecture', 'logic', 'workflow', 'support', 'impact'];` with `const TYPES = LENS_TYPES;`.

- [ ] **Step 5: Run the whole suite**

Run: `node --test "tests/*.test.mjs"`
Expected: all pass (91 existing + 5 new = 96).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: one shared type list; deadcode, deepdive and risk in reports and index" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Preflight understands `auto` and the new types

**Files:**
- Modify: `engine/check-onboarding.mjs:21` (the `KNOWN_TYPES` constant) and the `heroProblems` type check
- Test: `tests/preflight.test.mjs`

**Interfaces:**
- Consumes: `HERO_TYPES` from `engine/types.mjs` (Task 1).
- Produces: `heroProblems` accepts `type: auto` and the three new slugs. No signature change.

- [ ] **Step 1: Write the failing tests**

Append to `tests/preflight.test.mjs`:

```js
test('preflight accepts a hero whose type is auto', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk').replace('type: impact', 'type: auto') }) });
  assert.equal(r.ok, true, JSON.stringify(r.failures));
});

test('preflight accepts the three new lens types in a hero file', () => {
  for (const t of ['deadcode', 'deepdive', 'risk']) {
    const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk').replace('type: impact', `type: ${t}`) }) });
    assert.equal(r.ok, true, `${t}: ${JSON.stringify(r.failures)}`);
  }
});

test('preflight still rejects a made-up hero type, and lists auto among the choices', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk').replace('type: impact', 'type: banana') }) });
  const f = r.failures.find((x) => x.id === 'hero-invalid');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /auto/);
});

test('an auto hero is still scanned for unsafe wording', () => {
  const text = heroText('hulk', '# Preset\n\nThen delete the old file.\n').replace('type: impact', 'type: auto');
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': text }) });
  assert.ok(ids(r).includes('prompt-unsafe'));
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test tests/preflight.test.mjs`
Expected: FAIL on the first three (`type: auto`, `deadcode` and the choices message are not accepted yet). The fourth passes already, which is correct: the scan already covers every hero body.

- [ ] **Step 3: Implement**

In `engine/check-onboarding.mjs` add `import { HERO_TYPES } from './types.mjs';` with the other imports, delete the line `const KNOWN_TYPES = ['architecture', 'logic', 'workflow', 'support', 'impact'];`, and in `heroProblems` change the type line to:

```js
  if (!HERO_TYPES.includes(fm.type)) bad.push('type (one of ' + HERO_TYPES.join(', ') + ')');
```

- [ ] **Step 4: Run the whole suite and the real preflight**

Run: `node --test "tests/*.test.mjs"` then `node engine/check-onboarding.mjs preflight`
Expected: all pass (100); preflight `"ok": true`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: preflight accepts type auto and the new lens types" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Router rules for the three new types

**Files:**
- Modify: `engine/detect-route.mjs` (`TYPE_ORDER`, `TYPE_RULES`)
- Modify: `tests/routing-fixtures.json`
- Test: `tests/detect-route.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `detect(question)` can return `type` of `deadcode`, `deepdive` or `risk`. `TYPE_ORDER` becomes `['support', 'impact', 'deadcode', 'risk', 'architecture', 'logic', 'deepdive', 'workflow']` (ties go to the earlier entry).

- [ ] **Step 1: Add the fixtures (the failing tests)**

Append these objects to the array in `tests/routing-fixtures.json` (before the final `]`, with a comma after the previous last entry):

```json
  { "q": "is anything unused in the billing module", "type": "deadcode", "audience": null },
  { "q": "find dead code in the payments service", "type": "deadcode", "audience": null },
  { "q": "which exports are never called", "type": "deadcode", "audience": null },
  { "q": "are there unreferenced files under src/legacy", "type": "deadcode", "audience": null },
  { "q": "is it safe to remove the Order status enum", "type": "impact", "audience": null },
  { "q": "is it safe to delete the old refund endpoint", "type": "impact", "audience": null },
  { "q": "explain this function line by line: calculateRefund", "type": "deepdive", "audience": null },
  { "q": "walk through this function: applyDiscount", "type": "deepdive", "audience": null },
  { "q": "are there any hidden risks in the refund path", "type": "risk", "audience": null },
  { "q": "what could go wrong in the payout job", "type": "risk", "audience": null },
  { "q": "any security smell in the login handler", "type": "risk", "audience": null },
  { "q": "what are the unchecked return values in the payment client", "type": "risk", "audience": null },
  { "q": "what could go wrong in the refund rules", "type": "risk", "audience": null, "also": "logic" },
  { "q": "how does checkout work", "type": "workflow", "audience": null },
  { "q": "hero: hulk for qa is anything unused in billing", "type": "deadcode", "audience": "qa" },
  { "q": "what happens when the payment gateway is unreachable", "type": "workflow", "audience": null },
  { "q": "why is the API unreachable for the customer", "type": "workflow", "audience": null },
  { "q": "why does a user see an unchecked state", "type": "support", "audience": null },
  { "q": "unchecked checkbox rule on the form", "type": "logic", "audience": null },
  { "q": "what happens when a user is unused for 30 days", "type": "workflow", "audience": null }
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/detect-route.test.mjs`
Expected: FAIL on every new fixture except the two that expect `impact`, `workflow` (they already pass, which is correct: they pin that old behaviour does not change).

- [ ] **Step 3: Implement**

In `engine/detect-route.mjs` replace the `TYPE_ORDER` line with:

```js
export const TYPE_ORDER = ['support', 'impact', 'deadcode', 'risk', 'architecture', 'logic', 'deepdive', 'workflow'];
```

and add three entries to the `TYPE_RULES` object (keep the five existing entries unchanged):

```js
  deadcode: [/\b(unused (code|files?|exports?|functions?|classes|methods?|variables?|imports?|config|flags?|routes?|modules?)|anything unused|dead code|never called|unreferenced|unreachable (code|branch|branches))\b/i, /\bnot (used|referenced|called) anywhere\b/i],
  risk: [/\bhidden risks?\b/i, /\bwhat could go wrong\b/i, /\bsecurity smell\b/i, /\bunchecked (return|result|error|exception|input|permission)s?\b/i, /\bsilent(ly)? (catch|fail|swallow)/i],
  deepdive: [/\bline[- ]by[- ]line\b/i, /\bwalk through this (function|method|class)\b/i, /\bexplain this (function|method|class)\b/i],
```

- [ ] **Step 4: Run the whole suite**

Run: `node --test "tests/*.test.mjs"`
Expected: all pass. If an OLD fixture changed result, stop: a new keyword is too broad. Narrow the new rule; do not edit the old fixture.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: router detects deadcode, risk and deepdive questions" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Lens heroes Thanos, Ant-Man and Loki

**Files:**
- Create: `heroes/thanos.md`, `heroes/antman.md`, `heroes/loki.md`
- Create: `skills/thanos/SKILL.md`, `skills/antman/SKILL.md`, `skills/loki/SKILL.md`
- Modify: `agents/repo-avengers.md:18` (one line), `engine/check-onboarding.mjs` (`CORE_HEROES`), `skills/ask/SKILL.md` (step 5 mapping)
- Test: `tests/heroes.test.mjs`, `tests/skills.test.mjs`

**Interfaces:**
- Consumes: type slugs from Task 1, router rules from Task 3, `heroFiles()` and `pairingProblems()` from phase 1.
- Produces: three hero files and three thin skills; `CORE_HEROES` lists eight lens heroes.

- [ ] **Step 1: Write the failing tests**

In `tests/heroes.test.mjs` change the `HEROES` constant to:

```js
const HEROES = ['thor', 'captainamerica', 'drstrange', 'blackwidow', 'hulk', 'thanos', 'antman', 'loki'];
```

Append:

```js
test('the thanos lens only lists candidates and never tells the agent to delete', () => {
  const t = readFileSync(join(pluginDir, 'heroes', 'thanos.md'), 'utf8');
  assert.match(t, /candidates for removal/i);
  assert.match(t, /never (delete|remove|change)/i);
});

test('the agent file lists every lens type slug', () => {
  const agent = readFileSync(join(pluginDir, 'agents', 'repo-avengers.md'), 'utf8');
  for (const t of ['architecture', 'logic', 'workflow', 'support', 'impact', 'deadcode', 'deepdive', 'risk']) {
    assert.ok(agent.includes(t), `agent file does not list ${t}`);
  }
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/heroes.test.mjs tests/skills.test.mjs`
Expected: FAIL. The heroes tests cannot read `heroes/thanos.md`; the agent file does not list `deadcode`.

- [ ] **Step 3: Create the three hero files**

`heroes/thanos.md`:

```markdown
---
name: thanos
command: /thanos
type: deadcode
audience: dev
model: sonnet
report: true
approval: none
intro: "Thanos is looking for the half of this repo that nobody will miss..."
---
# Lens: deadcode

The question is about code that looks unused: files, exports, branches or config that nothing seems to reach. You only report candidates for removal. You never delete, remove or change anything, and you say so in the answer.

## Looks for
- Exports, functions, classes and files with no references in the repo (search by name, by path and by string key)
- Branches that cannot be reached (conditions that are always true or false, code after an unconditional return)
- Config keys, feature flags and routes that nothing reads or registers
- Test-only code and code kept alive only by its own tests
- For each candidate: how you searched, and what dynamic use (reflection, string-built names, other repos, runtime config) could still reach it. You cannot see those, so say so in the confidence section.

## Sections
Put these in the answer and in the JSON `sections` array:
1. "Candidates for removal": kind `table`, columns ["Candidate", "Why it looks unused", "Confidence", "Evidence"]. Confidence is high, medium or low. Rank from highest confidence to lowest.
2. "Could still be reached by": kind `list`. One item per kind of dynamic or external use you could not rule out.

## Diagram
Reference graph. Each candidate is drawn with no incoming edge from live code; a candidate that is only referenced by tests has an edge from a test node.
```

`heroes/antman.md`:

```markdown
---
name: antman
command: /antman
type: deepdive
audience: dev
model: sonnet
report: true
approval: none
intro: "Ant-Man is shrinking down to walk through it line by line..."
---
# Lens: deepdive

The question is about one function, method or class, explained in detail from the inside.

## Looks for
- The exact target (resolve the name to one file and line; if several match, list them and take the one the question names)
- Inputs, outputs and every side effect, in the order they happen
- Each branch and guard, with the condition in plain words and what happens on each side
- Error handling: what is thrown, caught, swallowed or returned
- Calls out to other code: name them, but do not follow them unless the question asks

## Sections
Put these in the answer and in the JSON `sections` array:
1. "Line by line": kind `table`, columns ["Lines", "What it does", "Why it matters"]. Group lines that do one thing; keep rows in source order.
2. "Inputs, outputs, side effects": kind `list`. One item per input, return value or side effect.

## Diagram
Control flow of the target only: entry, each branch, each exit. Calls to other code are drawn as single unexpanded nodes.
```

`heroes/loki.md`:

```markdown
---
name: loki
command: /loki
type: risk
audience: dev
model: sonnet
report: true
approval: none
intro: "Loki is looking for the tricks hiding in this code..."
---
# Lens: risk

The question is about hidden risks: places where the code can do something other than what it appears to do.

## Looks for
- Permission or authorization checks that are missing, partial or bypassable
- Return values and errors that are ignored, and catch blocks that swallow failures
- Input that reaches a query, command, path or template without validation
- State that can change between a check and its use, retries that repeat a side effect, and transactions that do not cover everything they should
- Surprising defaults, fallbacks that hide a failure, and comments that disagree with the code
- Only report what you verified by reading the code; mark anything inferred as inferred

## Sections
Put these in the answer and in the JSON `sections` array:
1. "Risks found": kind `table`, columns ["Risk", "Where", "What can go wrong", "Severity", "Evidence"]. Severity is high, medium or low. Rank from highest to lowest.
2. "Checked and found fine": kind `list`. One item per area you looked at and found no problem, so the reader knows it was covered.

## Diagram
The main path with each risk marked on the node or edge where it occurs.
```

- [ ] **Step 4: Create the three thin skills**

For each of `thanos`, `antman`, `loki` create `skills/<name>/SKILL.md` in exactly the shape of `skills/hulk/SKILL.md`, with these descriptions on the `description:` line (each ends with ` Trigger: /<name>`):

- thanos: `Thanos lists code in the current repo that looks unused, as candidates for removal with how each was checked. It never deletes anything.`
- antman: `Ant-Man explains one function, method or class in the current repo line by line: inputs, branches, errors and side effects.`
- loki: `Loki looks for hidden risks in the current repo: missing checks, ignored errors, swallowed failures and surprising behaviour.`

Body of each (replace `<name>`):

```
# <name>

Invoke the `ask` skill (use the exact name in the skill list; it may carry a plugin prefix) in hero mode, passing `hero: <name>` followed by exactly the arguments given here, and follow it. All settings for this hero are in `heroes/<name>.md`; do not copy them here.
```

- [ ] **Step 5: Wire the rest**

- `engine/check-onboarding.mjs`: change `CORE_HEROES` to `['thor', 'captainamerica', 'drstrange', 'blackwidow', 'hulk', 'thanos', 'antman', 'loki']`.
- `agents/repo-avengers.md` line 18: change `- `type: architecture|logic|workflow|support|impact` (default `workflow`).` to `- `type: architecture|logic|workflow|support|impact|deadcode|deepdive|risk` (default `workflow`).`. This is the only change to the agent file.
- `skills/ask/SKILL.md` step 5: extend the mapping sentence to `... impact is `hulk.md`, deadcode is `thanos.md`, deepdive is `antman.md`, risk is `loki.md`)`.

- [ ] **Step 6: Run the whole suite and the real preflight**

Run: `node --test "tests/*.test.mjs"` then `node engine/check-onboarding.mjs preflight`
Expected: all pass; preflight `"ok": true`; `git diff main -- agents/repo-avengers.md` shows only the one changed line and the `tools:`/`model:` lines untouched.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Thanos, Ant-Man and Loki heroes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Preset heroes Ironman, Hawkeye and Spiderman

**Files:**
- Create: `heroes/ironman.md`, `heroes/hawkeye.md`, `heroes/spiderman.md`
- Create: `skills/ironman/SKILL.md`, `skills/hawkeye/SKILL.md`, `skills/spiderman/SKILL.md`
- Modify: `engine/check-onboarding.mjs` (`CORE_HEROES`, `heroProblems`: an `auto` hero needs no lens headings)
- Test: `tests/heroes.test.mjs`, `tests/preflight.test.mjs`

**Interfaces:**
- Consumes: `type: auto` support from Task 2.
- Produces: three preset hero files. `CORE_HEROES` lists eleven heroes. Preset hero body contract: no `## Looks for/Sections/Diagram` headings are required (the router chooses the lens at run time).

- [ ] **Step 1: Write the failing tests**

In `tests/heroes.test.mjs` add above the first test:

```js
const PRESETS = { ironman: { model: 'opus', audience: 'dev', report: 'true', approval: 'required' }, hawkeye: { model: 'haiku', audience: 'dev', report: 'false', approval: 'none' }, spiderman: { model: 'sonnet', audience: 'pm', report: 'true', approval: 'none' } };
```

and append:

```js
test('the preset heroes are type auto and carry the settings from the spec', () => {
  for (const [n, want] of Object.entries(PRESETS)) {
    const t = readFileSync(join(pluginDir, 'heroes', `${n}.md`), 'utf8').replace(/\r\n/g, '\n');
    const fm = Object.fromEntries(t.split('---')[1].trim().split('\n').map((l) => [l.split(':')[0], l.slice(l.indexOf(':') + 1).trim()]));
    assert.equal(fm.type, 'auto', `${n} type`);
    for (const [k, v] of Object.entries(want)) assert.equal(fm[k], v, `${n} ${k}`);
  }
});

test('the preset heroes need no lens headings, and the shipped set passes preflight', () => {
  const repo = mkdtempSync(join(tmpdir(), 'avengers-repo-'));
  writeFileSync(join(repo, 'app.js'), 'export {}\n');
  const agent = join(mkdtempSync(join(tmpdir(), 'avengers-agent-')), 'agent.md');
  writeFileSync(agent, '---\nname: x\ntools: Read, Grep, Glob\n---\nbody\n');
  const env = { ...process.env, AVENGERS_AGENT_PATH: agent };
  delete env.AVENGERS_PLUGIN_DIR;
  const r = JSON.parse(spawnSync(process.execPath, [script, 'preflight'], { cwd: repo, env, encoding: 'utf8' }).stdout);
  assert.deepEqual(r.failures, []);
});
```

Also change the first test (`each hero file has the three headings`) so it skips presets: replace `for (const n of HEROES) {` in that test with `for (const n of HEROES.filter((h) => !(h in PRESETS))) {`. The frontmatter-start test keeps iterating `HEROES` only, so presets are not in it (they are checked by the new test above).

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/heroes.test.mjs`
Expected: FAIL: `heroes/ironman.md` does not exist.

- [ ] **Step 3: Create the three preset hero files**

`heroes/ironman.md`:

```markdown
---
name: ironman
command: /ironman
type: auto
audience: dev
model: opus
report: true
approval: required
intro: "Suit up. Running a full systems scan..."
---
# Preset: ironman

This hero has no lens of its own. The question type is detected like plain /ask, and the answer is the same shape, produced by the most capable model after the user approves it.

## Closing
End the answer with a short "Systems check" list: what you confirmed in source, what you could only infer, and what you could not see (stored procedures, database rows, per-environment config, other repos, runtime flags). This is the Confidence section written in this hero's voice; it adds no new investigation.
```

`heroes/hawkeye.md`:

```markdown
---
name: hawkeye
command: /hawkeye
type: auto
audience: dev
model: haiku
report: false
approval: none
intro: "Hawkeye has the target in sight..."
---
# Preset: hawkeye

This hero has no lens of its own. It is for quick lookups such as "where is the retry logic".

## Closing
Answer in one to three lines: what it is and where it is, each with `path:line`. Name the single best match first and list other plausible matches after it. No sections, no diagram and no report. If nothing matches, say what you searched and stop.
```

`heroes/spiderman.md`:

```markdown
---
name: spiderman
command: /spiderman
type: auto
audience: pm
model: sonnet
report: true
approval: none
intro: "Spider-Man is swinging in to explain it in plain words..."
---
# Preset: spiderman

This hero has no lens of its own. The question type is detected like plain /ask; the answer is written for someone new to the code.

## Closing
Explain as you would to a smart newcomer: short sentences, no class, function or file names in the body, and one everyday comparison at most. End with the source references for a developer to verify.
```

Create the three thin skills exactly like Task 4 step 4, with these descriptions:

- ironman: `Iron Man runs the thorough, expensive version of /ask on the most capable model, after you approve it, and ends with a systems check of what could not be seen.`
- hawkeye: `Hawkeye answers a quick lookup in the current repo in one to three lines with path:line, on the cheapest model, with no report.`
- spiderman: `Spider-Man explains how the current repo works in plain language for a newcomer, with no code names, plus an HTML report.`

- [ ] **Step 4: Update the preflight for presets**

In `engine/check-onboarding.mjs`: change `CORE_HEROES` to the eleven names (`'thor', 'captainamerica', 'drstrange', 'blackwidow', 'hulk', 'thanos', 'antman', 'loki', 'ironman', 'hawkeye', 'spiderman'`). No change to `heroProblems` is needed: it already validates only frontmatter, and the unsafe scan already covers the body.

- [ ] **Step 5: Run the whole suite and the real preflight**

Run: `node --test "tests/*.test.mjs"` then `node engine/check-onboarding.mjs preflight`
Expected: all pass; preflight `"ok": true`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Ironman, Hawkeye and Spiderman preset heroes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Hero mode for preset heroes, and `/ask deep` as an alias of `/ironman`

**Files:**
- Modify: `skills/ask/SKILL.md` (Hero mode section, step 1, step 4, step 5, step 7, step 9 note)
- Test: `tests/skills.test.mjs`

**Interfaces:**
- Consumes: hero files from Task 5.
- Produces: skill text rules: `type: auto` means keep the router's type and use the router's hero file for the lens; `approval: required` ask before spawning; `report: false` writes no folder; `/ask deep` behaves as `/ironman`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/skills.test.mjs`:

```js
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/skills.test.mjs`
Expected: FAIL (the hero section does not mention `type: auto`; the usage list has five heroes).

- [ ] **Step 3: Edit `skills/ask/SKILL.md`** (use the Edit tool; match the text exactly)

1. Usage list: replace the line starting ``- `/thor`, `/captainamerica`, `/drstrange`, `/blackwidow`, `/hulk` `<question>` `` with:

```
- `/thor`, `/captainamerica`, `/drstrange`, `/blackwidow`, `/hulk`, `/thanos`, `/antman`, `/loki` `<question>`: the same as `/ask`, with the question type fixed to the hero's lens and the hero's default audience
- `/ironman`, `/hawkeye`, `/spiderman` `<question>`: presets with no lens of their own. The question type is detected as in `/ask`; the hero sets the model, audience and report mode (ironman: opus after approval; hawkeye: haiku, one to three lines, no report; spiderman: plain language for a newcomer)
```

2. Usage list: replace the `/ask deep` line so it ends with `This is the same as `/ironman`.` (keep the existing words before it, and keep "after you approve it").

3. In the Hero mode section, replace the intro sentence's list of five commands with all eleven, and add these items after the existing item about `report: false`, renumbering the items that follow:

```
- With `type: auto` (ironman, hawkeye, spiderman) there is no lens of its own: keep the router's type, and use the hero file for that type in step 5. The hero's text after its frontmatter is added to the prompt after the `LENS:` block, under a line `HERO:`.
- With `approval: required` (ironman), ask for approval before spawning anything: one question with three choices, `Use opus`, `Use the default model instead`, `Cancel`, exactly as for `deep` in step 7. On `Cancel`, stop; nothing runs and nothing is written.
- With `report: false` (hawkeye) step 9 is skipped: the skill writes no `docs/flows/<slug>/` folder, even if the user typed `report`. Print the agent's answer and stop.
```

4. Step 5 mapping sentence: after `risk is `loki.md`` add `; when the hero is a `type: auto` preset, the lens is still chosen by this mapping`.

5. Step 7: after the `deep` sentence add `Treat `deep` exactly as `/ironman`: the same approval question, the same model.`

- [ ] **Step 4: Run the whole suite**

Run: `node --test "tests/*.test.mjs"`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: hero mode handles preset heroes; /ask deep is the same as /ironman" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Docs and version 1.3.0

**Files:**
- Modify: `README.md`, `CHANGELOG.md`, `.claude-plugin/plugin.json`, `tests/plugin.test.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces: version `1.3.0`; a `## 1.3.0` changelog section above 1.2.0.

- [ ] **Step 1: Write the failing tests**

In `tests/plugin.test.mjs`: change the first test's title and expected version to `1.3.0`, and replace the changelog test with:

```js
test('the changelog has a 1.3.0 entry on top and keeps 1.2.0, 1.1.0 and 1.0.0', () => {
  const c = read('CHANGELOG.md').replace(/\r\n/g, '\n');
  assert.match(c, /^# Changelog\n\n## 1\.3\.0 /);
  for (const v of ['1.2.0', '1.1.0', '1.0.0']) assert.ok(c.includes(`\n## ${v} `), `changelog lost ${v}`);
});
```

and extend the README test's needle list with `'/thanos', '/antman', '/loki', '/ironman', '/hawkeye', '/spiderman'`.

Run `node --test tests/plugin.test.mjs`. Expected: FAIL on all three.

- [ ] **Step 2: Version and changelog**

`.claude-plugin/plugin.json`: `"version": "1.3.0"`. Insert directly under `# Changelog` (use the Edit tool; this file is CRLF in the working copy, so match the heading line only: `## 1.2.0 - 2026-10-08` and put the new section above it):

```
## 1.3.0 - 2026-10-08

### Added
- Lens heroes: `/thanos` (candidates for removal: unused code, never deletes), `/antman` (one function, line by line) and `/loki` (hidden risks). Plain `/ask` also detects these three question types from conservative keywords; "safe to remove" still means impact.
- Preset heroes: `/ironman` (opus after approval, ends with a systems check), `/hawkeye` (haiku, one to three lines, no report) and `/spiderman` (plain language for a newcomer). They have no lens of their own and detect the type like `/ask`.
- `engine/types.mjs`: the one list of question types, used by the report builder, the index, preflight and the router.
- Report types `deadcode`, `deepdive` and `risk`, with labels and an index filter entry. Hero files may now say `type: auto`.

### Changed
- `/ask deep` is now documented as the same as `/ironman`.

### Notes
- Reports from earlier versions are unaffected. An unknown report type still builds as workflow with one warning.

```

- [ ] **Step 3: README**

In the `## Use` block add:

```
/ironman how does the whole refund flow hold together       # opus, asks you first, ends with a systems check
/hawkeye where is the retry logic                            # haiku, one to three lines, no report
/thanos is anything unused in the billing module             # candidates for removal; never deletes
```

Extend the "Hero commands" table with rows for `/thanos` (dead code, dev), `/antman` (deep dive, dev), `/loki` (risk, dev), `/ironman` (auto, opus), `/hawkeye` (auto, haiku, no report) and `/spiderman` (auto, plain language), and add one sentence under the table: ``Presets (`type: auto`) have no lens of their own; the question type is detected as in `/ask`.``

- [ ] **Step 4: Run the whole suite and the real preflight**

Run: `node --test "tests/*.test.mjs"` then `node engine/check-onboarding.mjs preflight`
Expected: all pass; preflight `"ok": true`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: 1.3.0 six more heroes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Manual check after the plan (needs the user)

`/reload-plugins`, then in a real repo:
1. `/thanos is anything unused in <module>`: expect the Thanos intro, `Treated as: deadcode question, for dev (thanos).`, a "Candidates for removal" table, and **no file changed**.
2. `/ironman <question>`: expect the opus approval question before anything runs; `Cancel` must run nothing.
3. `/hawkeye where is <thing>`: expect one to three lines and no `docs/flows/<slug>/` folder.
4. `/ask is it safe to remove <enum>`: must still say `impact`, not `deadcode`.
5. Check which model actually ran for `/ironman` (the spec's section 9 caveat about `CLAUDE_CODE_SUBAGENT_MODEL`).
