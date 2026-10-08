# repo-avengers 1.2.0: heroes and /assemble, design

Date: 2026-10-08. Status: draft for review. Builds on `2026-10-07-repo-avengers-v1-design.md` (1.0.0) and the 1.1.0 `/ask deep` change.

## 1. Goal and scope

Add Avengers-themed commands that are fun but each does something useful, and one powerful command, `/assemble`, that picks the heroes for the user.

Success means:
1. Each hero command feels like its character and differs from plain `/ask` in a way a user can see (forced lens, default audience, default model, or output mode).
2. Plain `/ask <question>` still auto-detects the question type, now including the three new lenses.
3. `/assemble <goal>` plans a team, the user approves the team and the model for each hero, the heroes run in parallel, and one merged report comes back.
4. The plugin stays read-only toward the target repo. The agent's tool list stays `Read, Grep, Glob`.
5. Saved reports from 1.0.0 and 1.1.0 still open and still appear in the index.

### Out of scope (future phases)
- A write-capable team (writing docs, fixing code, opening PRs). It needs a second agent with write tools, its own approval gates, and a change to the read-only guarantee.
- Parallel `/ask` without a plan step.
- Automatic re-run of a failed hero (each re-run costs money, so it is always offered, never done).
- Auto-detecting heroes by persona (only the question type is auto-detected).

## 2. Decisions already made with the user

| Decision | Choice |
|---|---|
| `/assemble` power | Read-only team now (A). Write-capable team is a future phase (B). |
| Cost control | Fury picks a model per hero, the user approves or changes it before anything runs. Hard cap of 5 heroes per run. |
| Roster | Thor, Captain America, Dr. Strange, Black Widow, Hulk (existing five types), plus new Thanos, Ant-Man, Loki, plus Ironman, Hawkeye, Spiderman. 11 heroes. |
| How new lenses trigger | Both: auto-detected by `/ask` with conservative keywords, and forced by hero command. |
| Packaging | One thin skill per hero plus a single hero definition file. Restructure now (no attachment to old paths). |
| `/ask deep` | Kept as a working alias of `/ironman`. |

## 3. Structure

```
.claude-plugin/        plugin.json, marketplace.json
agents/repo-avengers.md   unchanged: tools Read, Grep, Glob; model: sonnet
heroes/                one definition file per hero (11 files)
audiences/             dev, qa, pm, support (moved up from skills/ask/audiences)
engine/                check-onboarding, detect-route, build-report, build-index,
                       migrate-reports (moved from skills/explain/), build-assemble (new)
skills/
  ask/                 front door: parse, route, preflight, run, report
  assemble/            Fury: plan, approve, parallel run, merge
  <hero>/SKILL.md      11 thin entry points, a few lines each
  explain/SKILL.md     deprecated alias of ask, kept for one release
```

`skills/explain/` stops holding scripts. `/explain` stays as a short alias skill.

### 3.1 Hero file format

```markdown
---
name: hulk
command: /hulk
type: impact            # existing type slug, or "auto" to let the router decide
audience: dev           # default; a named audience in the question overrides it
model: sonnet           # sonnet | opus | haiku; Fury's default suggestion
report: true            # false means text answer only
approval: none          # none | required (asks the user before running)
intro: "Hulk smash. Checking what breaks..."   # one line, flavour only
---
## Looks for
## Sections
## Diagram
```

- The body keeps today's lens format, so the existing report layouts work unchanged.
- The `type` slugs are not renamed, so saved reports and the index filter keep working.
- `intro` is flavour only. It cannot change rules, sections or the read-only guarantee.
- Heroes with `type: auto` (ironman, hawkeye, spiderman) have no lens body; they route like plain `/ask`.

### 3.2 The roster

| Hero | Command | type | audience | model | report | approval | What it does |
|---|---|---|---|---|---|---|---|
| Thor | /thor | architecture | dev | sonnet | yes | none | Layer map ("the nine realms"), boundaries, component diagram |
| Captain America | /captainamerica | logic | dev | sonnet | yes | none | Rules and decision table, edge cases |
| Dr. Strange | /drstrange | workflow | dev | sonnet | yes | none | Follows a request through every path: success plus all failure branches |
| Black Widow | /blackwidow | support | support | sonnet | yes | none | Symptom to cause to who to escalate |
| Hulk | /hulk | impact | dev | sonnet | yes | none | Blast radius ranked by risk, tests to run |
| Thanos | /thanos | dead-code (new) | dev | sonnet | yes | none | Candidates for removal: unused files, unreachable branches, unreferenced exports. Lists only, never acts. |
| Ant-Man | /antman | deep-dive (new) | dev | sonnet | yes | none | Line-by-line walk through one function or class |
| Loki | /loki | risk (new) | dev | sonnet | yes | none | Hidden risks and tricks: unchecked permissions, ignored return values, silent catches |
| Iron Man | /ironman | auto | dev | opus | yes | required | The expensive deep search; routes like `/ask`, runs on opus after approval. Ends with a "systems check" listing what could not be seen (flavour on the existing Confidence section). |
| Hawkeye | /hawkeye | auto | dev | haiku | no | none | Cheap, precise lookup: one answer with `file:line`, text only |
| Spider-Man | /spiderman | auto | pm | sonnet | yes | none | Same investigation as `/ask`, written in plain language for a newcomer (the existing `plain` mode with a name) |

New type slugs: `deadcode`, `deepdive`, `risk`. `build-report`, `build-index` and the index filter learn them. An unknown type still falls back to workflow with one warning.

## 4. Routing

Precedence, highest first:
1. `/assemble`: Fury chooses the heroes; per-hero routing is skipped.
2. A hero command: forces that hero's type, audience default, model default, report mode. A named audience in the question still overrides the hero's default audience.
3. Plain `/ask`: `detect-route.mjs` auto-detects, as today, with new rules for the three new types.

New auto-detect rules are conservative and need explicit phrases:
- deadcode: "unused", "dead code", "never called", "unreferenced". Phrases like "safe to remove" or "safe to delete" stay with the impact type (they ask what depends on something), so they are deliberately not deadcode keywords.
- deepdive: "line by line", "walk through this function", "explain this function".
- risk: "hidden risk", "what could go wrong in", "security smell", "unchecked".

Anything vague falls back to workflow and says so, as today. Every new rule gets fixtures in `tests/routing-fixtures.json`, and every existing fixture must keep its result. The known misroutes recorded in `.superpowers/progress.md` (for example "error handling middleware" going to support) are not fixed here and must not get worse.

## 5. /assemble

Fury is the skill itself, not a separate agent. Planning and merging run in the main session. Only the heroes run as agents, each the read-only `repo-avengers` agent.

1. **Preflight and onboarding:** identical to `/ask`. A failure stops the run.
2. **Plan:** Fury reads the front matter of every hero file, the repo profile and the goal. He splits the goal into sub-questions, one hero per sub-question, at most 5 heroes. Each line has a model and a one-line reason. He sees the profile only, never the source. A simple goal gets a single hero, and he says so.
3. **Approval screen (nothing runs before the user answers):**
   ```
   Fury's plan for: "<goal>"
   1. Dr. Strange  opus    trace the refund flow end to end
   2. Hulk         sonnet  what breaks if Order status changes
   3. Loki         sonnet  hidden risks in the refund path
   Rough cost: 3 agents (1 opus), about 5x a normal /ask
   ```
   Choices: `Approve`, `Approve, all on sonnet`, `Change`, `Cancel`. `Change` takes a free-text edit ("drop Loki, Hulk on opus"); Fury applies it and shows the screen again. The cap of 5 holds after edits. The cost line is relative (agents weighted by model), not a price.
4. **Parallel run:** all heroes launch in one message, each with its own lens, audience, sub-question, context block and approved model, and the reminder that it is read-only and must not quote secrets.
5. **Merge:** Fury writes a combined summary and compares findings. He flags a disagreement only where two heroes cite conflicting evidence, and marks it as his own inference. The Confidence section is the union of the heroes' Confidence sections.

Output, all under `docs/flows/<slug>/`:
- `report.html` and `report.json`: the combined page (new type `assemble`), built by `engine/build-assemble.mjs`.
- `heroes/<hero>/report.{json,html}`: one per hero, built by the existing `build-report.mjs`, so the secret scan runs on every one.
- `answer.md`: the goal, date, the approved plan, and the merged prose answer.

### Failure handling
- Preflight failure: stop before any agent runs.
- One hero returns invalid JSON: the others finish; the combined page marks that hero failed and offers a re-run of only that hero. Never automatic.
- Cancel at approval: nothing runs, nothing is written.
- Fury names a hero that does not exist: reject the plan and re-plan once; if it happens again, say so and stop.
- Unknown hero or model in a hero file: preflight fails naming the file and the fix.

## 6. Preflight changes

- The list of lenses comes from `heroes/*.md`, not the hard-coded `LENSES` array.
- Each hero file is validated: frontmatter fields present, `type` known or `auto`, `model` in the allowed set, `report` and `approval` valid.
- The existing unsafe-wording scan runs on every hero file body and on the audience files. Hero text must say "candidates for removal", never "delete files"; it must not name tools.
- Pairing: a hero file with no `skills/<name>/SKILL.md`, or a hero skill with no hero file, is a failure.
- Unchanged: the agent's tool list must be exactly `Read, Grep, Glob`, and a project-level agent copy matching `explainer` or `avengers` is still a failure.

## 7. Migration order

The work splits into three independently shippable phases, so the implementation plan may be written as three plans: (1) restructure, steps 1-4; (2) new heroes, step 5; (3) `/assemble`, step 6. Step 7 closes whichever phase ships.

Before step 1, copy the folder to `../repo-avengers-1.1.0-backup` (there is no git). Each step ends with `node --test "tests/*.test.mjs"` green.

1. Move scripts from `skills/explain/` to `engine/`; update paths in the `SKILL.md` files, tests and preflight. No behavior change.
2. Move `audiences/` to the plugin root; update paths.
3. Convert the five lenses to hero files; preflight builds its list from `heroes/`.
4. Add the five thin skills and the hero/skill pairing test.
5. Add Thanos, Ant-Man, Loki, Ironman, Hawkeye and Spiderman with their tests and routing fixtures; `/ask deep` becomes an alias of `/ironman`.
6. Add `/assemble`: the skill, `engine/build-assemble.mjs`, the `assemble` report type and index filter.
7. Update README, CHANGELOG (new `## 1.2.0` section), `plugin.json` to 1.2.0 and the version test.

## 8. Testing

Written first, red then green.
- Hero files: valid frontmatter, allowed values, unsafe-wording scan (the Thanos text must pass it).
- Pairing: hero file without skill, or skill without hero file, fails.
- Routing: fixtures for the new conservative rules; existing fixtures unchanged; hero commands and `/assemble` skip detection.
- Reports: `build-report` accepts `deadcode`, `deepdive`, `risk`; unknown types fall back with one warning. `build-assemble` renders the combined page, handles a failed hero, and the secret scan covers every hero report. A test checks the 5-hero cap cannot be exceeded through an edit.
- Approval text: skill tests check `Approve`, `Approve, all on sonnet`, `Change`, `Cancel`, and "do not spawn until they answer", for `/assemble` and `/ironman`.
- Read-only: the existing test that rejects any agent tool beyond `Read, Grep, Glob` stays unchanged.
- Migration: the 70 existing tests keep passing at every step.

## 9. Known limits (state these in the README)

- Approval, the 5-hero cap and the write-path limit are instructions in the skill text. The only technical barrier is the agent's tool list.
- The per-call `model` override has not been checked against `CLAUDE_CODE_SUBAGENT_MODEL`. If that variable wins, Fury's per-hero models are silently ignored. The first real run must check which model actually ran.
- "About 5x a normal `/ask`" is a relative count, not a price.
- Hero personas are flavour. They do not change the investigation rules.
- Tested so far only on Razer Gold Admin Web; `/assemble` has no real-repo run yet.
- Trademark: "Avengers" and the hero names are Marvel trademarks, fine for a private or team plugin, rename before any public publish.
