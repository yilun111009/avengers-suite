import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const s = read('skills/assemble/SKILL.md');
const ask = read('skills/ask/SKILL.md');

test('the assemble skill is named assemble and ends its description with the trigger', () => {
  assert.match(s, /^---\nname: assemble\n/);
  assert.match(s, /\ndescription: [^\n]* Trigger: \/assemble\n---/);
});

test('it runs the same preflight and onboarding as ask, and stops on a preflight failure', () => {
  assert.match(s, /check-onboarding\.mjs" preflight/);
  assert.match(s, /If `ok` is false: \*\*stop\.\*\*/);
  assert.match(s, /onboarding[^\n]*as in the `ask` skill/i);
});

test('the plan step sees the profile and hero front matter, never source, and caps the team at five', () => {
  assert.match(s, /at most 5 heroes/);
  assert.match(s, /never (reads )?(the )?source/i);
  assert.match(s, /plan-team\.mjs" validate/);
});

test('the approval screen has exactly four choices and nothing runs before the answer', () => {
  for (const c of ['`Approve`', '`Approve, all on sonnet`', '`Change`', '`Cancel`']) assert.ok(s.includes(c), c);
  assert.match(s, /Do not spawn any agent until they answer/);
  assert.match(s, /On `Cancel`, stop; no hero runs and no team report is written/);
  assert.match(s, /plan-team\.mjs" show/);
});

test('a Change edit is applied by the script, re-checked against the cap and shown again', () => {
  assert.match(s, /drop[^\n]*models[^\n]*add/s);
  assert.match(s, /show the screen again/);
  assert.match(s, /never above 5/i);
});

test('an unknown hero in the plan is rejected and re-planned once, then the run stops', () => {
  assert.match(s, /re-plan once/);
  assert.match(s, /second time[^\n]*stop/i);
});

test('the heroes are launched in one message, each read-only, with its own lens, task, audience and approved model', () => {
  assert.match(s, /all (the )?agents in one message/i);
  assert.match(s, /read-only and must not quote secrets/);
  assert.match(s, /`model: "<approved model>"`/);
  assert.match(s, /\bLENS:/);
  assert.match(s, /\bAUDIENCE:/);
});

test('each hero gets its own report built by build-report so the secret scan runs on every one', () => {
  assert.match(s, /heroes\/<hero>\/report\.json/);
  assert.match(s, /build-report\.mjs" docs\/flows\/<slug>\/heroes\/<hero>\/report\.json/);
});

test('a hero with invalid or missing JSON is marked failed, the others finish, and re-run is offered but never automatic', () => {
  assert.match(s, /`status: "failed"`/);
  assert.match(s, /Never re-run a hero on your own/);
  assert.match(s, /re-run only that hero/i);
});

test('a re-run of one hero replaces only that hero and rebuilds the combined page', () => {
  assert.match(s, /replaces only that hero's folder/);
  assert.match(s, /build-assemble\.mjs"/);
});

test('the merge marks a disagreement only where heroes cite conflicting evidence, as inference, and unions confidence', () => {
  assert.match(s, /only where two heroes cite conflicting evidence/);
  assert.match(s, /own inference/);
  assert.match(s, /union/);
});

test('the combined report is written as type assemble into docs/flows/<slug>/, then the index is rebuilt', () => {
  assert.match(s, /"type": "assemble"/);
  assert.match(s, /docs\/flows\/<slug>\/report\.json/);
  assert.match(s, /build-index\.mjs" docs\/flows/);
  assert.match(s, /answer\.md/);
});

test('the write limit is stated and matches ask', () => {
  assert.ok(s.includes('`docs/flows/**` and `.claude/avengers-hints.md`'));
  assert.match(s, /instruction, not a technical barrier/);
});

test('ask lists the two new scripts among the commands it may run', () => {
  assert.match(ask, /plan-team\.mjs/);
  assert.match(ask, /build-assemble\.mjs/);
});

test('the router is an allowed command and is used for auto heroes', () => {
  assert.match(s, /detect-route\.mjs/);
  const safety = s.split('## Steps')[0];
  assert.match(safety, /detect-route\.mjs/);
});

test('the folder name is chosen before anything is written into it', () => {
  const idx = (re) => s.search(re);
  assert.ok(idx(/Pick `<slug>`/) >= 0, 'slug rule missing');
  assert.ok(idx(/Pick `<slug>`/) < idx(/as `docs\/flows\/<slug>\/heroes\/<folder>\/report\.json`/), 'slug must be picked before the first write');
});

test('the second run of the same hero gets its own folder name in the collect step', () => {
  const collect = s.split('### 6. Collect, per hero')[1].split('### 7.')[0];
  assert.match(collect, /heroes\/<hero>-2\//);
});

const section = (title, next) => s.split(title)[1].split(next)[0];

test('I1: Fury is told that text-only heroes cannot be on a team', () => {
  const plan = section('### 3. Plan (Fury)', '### 4.');
  assert.match(plan, /text only|no report/);
  assert.match(plan, /\/hawkeye/);
});

test('I3: the secret check happens before the hero report.json is written, and an unredactable file is deleted', () => {
  const collect = section('### 6. Collect, per hero', '### 7.');
  const check = collect.search(/before (you )?write/i);
  const write = collect.search(/as `docs\/flows\/<slug>\/heroes\/<folder>\/report\.json`/);
  assert.ok(check >= 0 && write >= 0 && check < write, 'the secret check must come before the write');
  assert.match(collect, /delete that hero's `report\.json`/);
});

test('I4: the Cancel promise says onboarding may already have written files', () => {
  const approval = section('### 4. Approval', '### 5.');
  assert.match(approval, /On `Cancel`, stop; no hero runs and no team report is written/);
  assert.match(approval, /onboarding, if it ran in step 2, has already written its files/);
  assert.doesNotMatch(approval, /nothing runs and nothing is written/);
});

test('I5: Change goes through the edit command, and its errors keep the previous plan', () => {
  const approval = section('### 4. Approval', '### 5.');
  assert.match(approval, /plan-team\.mjs" edit/);
  assert.match(approval, /show the errors and keep the previous plan/);
});

test('I6: the disagrees entry shape is in the merge step', () => {
  const merge = section('### 7. Merge (Fury)', '## Re-run');
  assert.match(merge, /"disagrees": \[\{"with": "<other hero>", "about": "<the claim>", "mine": "<path:line>", "theirs": "<path:line>"\}\]/);
  assert.match(merge, /"audience":/);
});

test('I2: re-run runs preflight, reuses the slug and the audience, rewrites the summaries and accepts hulk-2', () => {
  const rerun = s.split('## Re-run')[1].split('## Notes')[0];
  assert.match(rerun, /check-onboarding\.mjs" preflight/);
  assert.match(rerun, /Reuse the slug of the run you found; do not pick a new one/);
  assert.match(rerun, /reuse its stored `audience`/);
  assert.match(rerun, /Rewrite `summary`, `plainSummary` and `answer\.md` from all the `ok` results/);
  assert.match(rerun, /`hulk-2`/);
});

test('I2: parse sends rerun to Re-run only when the next word is a hero (or hero-N)', () => {
  const parse = section('### 1. Parse', '### 2.');
  assert.match(parse, /only if the word after `rerun` is a hero name/);
});

test('each hero JSON gets its hero name and the combined JSON gets fury', () => {
  const collect = section('### 6. Collect, per hero', '### 7.');
  assert.match(collect, /set `hero` to the hero's base name \(`hulk` even for the second Hulk run\)/);
  const merge = section('### 7. Merge (Fury)', '## Re-run');
  assert.match(merge, /"hero": "fury"/);
});

test('a repeated hero is written to its own folder, not over the first run', () => {
  const collect = section('### 6. Collect, per hero', '### 7.');
  assert.match(collect, /set `hero` to the hero's base name \(`hulk` even for the second Hulk run\)/);
  assert.match(collect, /write it to that run's own folder \(`heroes\/hulk\/`, or `heroes\/hulk-2\/` for the second run\)/);
  assert.doesNotMatch(collect, /`hulk` for `hulk-2`/);
});
