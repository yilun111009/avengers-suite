---
name: ask
description: Ask anything about the current repo (architecture, logic rules, workflows, support and troubleshooting, change impact) and get a cited answer written for the right audience (dev, QA, PM, support), by delegating to the read-only repo-avengers agent. First run in a repo does a one-time onboarding (preflight checks + repo profile). Writes a self-contained HTML report into its own folder docs/flows/<slug>/ by default. `plain` gives a non-technical view; `text` skips the report. Works in any repository. Trigger: /ask (alias /explain)
---

# Ask the repo

Usage:
- `/ask <question>`: answer + HTML report. The question type and the audience are detected from your wording.
- `/ask for qa <question>` / `/ask explain to the PM <question>`: name the audience in the question and you are not asked.
- `/ask plain <question>`: non-technical answer (treated as the PM audience)
- `/ask deep <question>`: same answer and report, but the agent runs on the opus model for harder questions, after you approve it (default is the agent's own model, sonnet). It uses the same opus approval and model as `/ironman`, but not its intro, systems-check closing or dev default audience.
- `/thor`, `/captainamerica`, `/drstrange`, `/blackwidow`, `/hulk`, `/thanos`, `/antman`, `/loki` `<question>`: the same as `/ask`, with the question type fixed to the hero's lens and the hero's default audience
- `/ironman`, `/hawkeye`, `/spiderman` `<question>`: presets with no lens of their own. The question type is detected as in `/ask`; the hero sets the model, audience and report mode (ironman: opus after approval; hawkeye: haiku, one to three lines, no report; spiderman: plain language for a newcomer)
- `/ask text <question>`: answer only, no report
- `/ask onboard` / `/ask onboard --force`: run (or redo) onboarding only
- `/ask profile`: rebuild the repo profile only
- `/ask migrate`: move old loose reports (`docs/flows/<slug>.html/.json`) into per-question folders

## Hero mode

A hero skill (`/thor`, `/captainamerica`, `/drstrange`, `/blackwidow`, `/hulk`, `/thanos`, `/antman`, `/loki`, `/ironman`, `/hawkeye`, `/spiderman`) invokes this skill so that the arguments start with `hero: <name>` followed by the user's own words. In hero mode:
1. Remove that token first, then run step 1 (keywords) and the router on the rest, so that a leading `for qa` or `plain` is still seen as the user's own words.
2. Read `<plugin dir>/heroes/<name>.md`. Print its `intro` line first. Its `type` (unless it is `auto`, see item 7), `audience`, `model`, `report` and `approval` replace the detected defaults.
3. For a lens hero, skip the type detection in step 4 (the hero's `type` is the type); for a `type: auto` hero, use the router's type. Either way still run the router for the audience: a named audience in the question (for example `/hulk for qa ...`) wins over the hero's default audience. When the hero file sets an audience and none is named, use it and do not ask the audience question.
4. Pass the hero's `model` on the Agent call. If `approval: required`, ask for approval before spawning the explain agent in step 7, exactly as for `deep`.
5. `report: false` means the same as `text`.
6. The user's keywords win over the hero's defaults: `plain` gives `pm` unless an audience is named, `text` gives no report, and `deep` triggers the step 7 opus approval instead of the hero's model. `report` is the one keyword that does not win over `report: false`.
7. With `type: auto` (ironman, hawkeye, spiderman) the hero has no lens of its own: keep the router's type, and use the hero file for that type in step 5. The hero's own text after its frontmatter is sent as the last part of the `LENS:` block (step 7).
8. With `approval: required` (ironman), ask for approval before spawning the explain agent in step 7: one question with three choices, `Use opus`, `Use the default model instead`, `Cancel`, exactly as for `deep`. On `Cancel`, stop; the explain agent does not run and no report is written. Preflight and onboarding come first, so onboarding may already have run on a repo's first use. Ask at most once per run: ask at most once per run even if `deep` was also typed.
9. With `report: false` (hawkeye) step 9 is skipped: the skill writes no `docs/flows/<slug>/` folder, even if the user typed `report`; do not write `answer.md` either. Print the agent's answer and stop.
10. Everything else (preflight, onboarding, context, report, index) is unchanged. The `Treated as:` line gains the hero's name: `Treated as: <type> question, for <audience> (<name>).`

## Safety contract (read first)

- The **agent** is read-only by construction: its tool list is `Read, Grep, Glob`. It cannot write or run commands.
- **You (this skill)** may write only to: `docs/flows/**` and `.claude/avengers-hints.md`. Never write, edit or delete any other path, and never run a command that modifies the repository (no formatters, no installs, no git writes). If something seems to require touching source, stop and tell the user.
- Commands you may run are limited to: `node "<scripts dir>/check-onboarding.mjs" ...`, `node "<scripts dir>/detect-route.mjs" ...`, `node "<scripts dir>/build-report.mjs" ...`, `node "<scripts dir>/build-index.mjs" ...`, `node "<scripts dir>/migrate-reports.mjs" ...`, `graphify query|path|explain ...` (only if `graphify-out/graph.json` exists), `git log -1 --format=%cI`, `git rev-parse`. Nothing else.
- `<ask dir>` is the "Base directory for this skill" path shown when this skill loaded. `<plugin dir>` is `<ask dir>/../..`. `<scripts dir>` is `<plugin dir>/engine`, where the scripts live.

## Steps

### 1. Parse
Strip leading words `plain`, `text`, `report`, `deep` (any order). `report: true` unless `text`. `deep: true` if `deep` was present; it only changes the model used in step 7, and only after user approval. `plain` means audience `pm` unless the question names another audience. If the first word is `onboard` or `profile`, jump to Onboarding / Profile. If it is `migrate`, jump to Migrate. If nothing remains, ask what to ask and stop.

### 2. Preflight (every run, fast, mechanical)
Run from the repo root: `node "<scripts dir>/check-onboarding.mjs" preflight`.
- If `ok` is false: **stop.** Show each failure with its fix. Do not call the agent. Common ones: a project-level `.claude/agents/*explainer*` or `*avengers*` copy that could shadow the plugin agent (delete it); a missing, invalid or unsafe hero or audience file (the failure names the file).
- If `node` itself is missing: report text-only mode is still possible, but preflight cannot run; ask the user whether to continue without checks. Do not silently skip.
- Show warnings once in a single short line each (gitignore, no README, no graph, not a git repo). Do not stop for warnings.
- Remember `info` (graphDate, lastCommit, graphStale, hasProfile, hasOnboardingRecord, hasHints) for the context block.

### 3. Onboarding (only when needed)
Needed when `docs/flows/_onboarding.md` is missing, `--force` was given, or the profile validation below fails.
1. If `docs/flows/_repo-profile.md` is missing or `node "<scripts dir>/check-onboarding.mjs" validate-profile` returns `ok: false`: spawn the `repo-avengers` agent (use the exact name in the agent list; it may carry a plugin prefix) with `task: profile` (plus the README/CLAUDE.md hint if present). Write the markdown part of its answer to `docs/flows/_repo-profile.md` (if a profile already exists, show a short diff and ask before replacing). Then run `validate-profile` again; if it still fails, stop and show the `problem` and `missing` list.
2. If the agent's JSON has non-empty `scopeOptions`, ask the user which one to cover, then record it in the profile's `Scope:` line (re-write the profile file).
3. If neither `.claude/avengers-hints.md` nor `.claude/explainer-hints.md` exists, ask the user the agent's `blindSpotQuestions` (at most 3, one message). Write the answers to `.claude/avengers-hints.md` as short bullets. If the user declines, write nothing.
4. Run `node "<scripts dir>/check-onboarding.mjs" record` to write `docs/flows/_onboarding.md`.
5. Tell the user onboarding is complete (one line each: profile path, scope, hints file or none). If the request was just `onboard`, stop here.

### 4. Detect the question type and the audience
Run the router with the question on stdin through a quoted heredoc, so that backticks, `$()` and quotes in the question are never run by the shell:
```
node "<scripts dir>/detect-route.mjs" <<'QUESTION_END'
<the question, exactly as the user typed it>
QUESTION_END
```
It prints `{type, alsoMatches, unclear, audience}`. The type is never asked.

Audience:
1. If `audience` is not null, use it. Do not ask.
2. Else if the request started with `plain`, use `pm`.
3. Else ask once, in one short message: "Is this answer for you, or for someone else?"
   - For me, or no answer: audience `dev`.
   - Someone else: ask "Who is it for? QA, PM, support, or another role (type it)?" Map the reply: `qa`, `pm`, `support` as named. For a typed role: developer, engineer, devops, architect, SRE or tech lead means `dev`; a role containing test or QA means `qa`; a role containing support or helpdesk means `support`; anything else means `pm`.

Tell the user, in one line before the answer: `Treated as: <type> question, for <audience>.` Add `(couldn't tell, using workflow)` when `unclear` is true, and `also touches <alsoMatches>` when it is not null, so they can correct it.

### 5. Load the hero prompt and the audience
Read the hero file in `<plugin dir>/heroes/` whose `type:` equals the detected type (architecture is `thor.md`, logic is `captainamerica.md`, workflow is `drstrange.md`, support is `blackwidow.md`, impact is `hulk.md`, deadcode is `thanos.md`, deepdive is `antman.md`, risk is `loki.md`) and `<plugin dir>/audiences/<audience>.md`. Use the hero file text after its closing `---` line as the lens. If either file is missing, stop and name the exact path. Never continue with a blank prompt: that would silently drop the format rules.

### 6. Build the context block for the agent
You prepare facts the agent cannot fetch itself:
- `lastCommit`, `graphDate`, `graphStale` from preflight `info`.
- If a graph exists: run `graphify query` with the question as a single-quoted argument (replace each `'` in it with `'\''`) (add `--budget 3000`) and include the output as `graphResult`. If it fails, say so in the block.
- Include the repo profile text and the hints text (`.claude/avengers-hints.md`, else `.claude/explainer-hints.md`, if present).

### 7. Ask the agent (one run)
Spawn the `repo-avengers` agent with: `task: explain`, `type`, `alsoMatches` (or none), `audience`, `report`, the question verbatim, the context block, then the hero file text after its frontmatter under a line `LENS:` (for a `type: auto` hero, append the hero file text after its frontmatter as the last part of that same block, introduced by the sentence "This hero's instructions replace the Sections and Diagram above when they conflict.") and the audience file text under a line `AUDIENCE:`. If `deep: true`, first ask the user to approve opus (it is slower and costs more): one question with three choices, `Use opus`, `Use the default model instead`, `Cancel`. Do not spawn the agent until they answer. On `Use opus`, pass `model: "opus"` on the Agent call for this one run. On `Use the default model instead`, pass no model and say so in one line. On `Cancel`, stop. If `deep` is not set, pass no model (or the hero's model in hero mode) and do not ask. Treat `deep` like `/ironman` for the model and the approval question (the same question, asked once). Remind it in the prompt that it is read-only and must not quote secrets. Do not run the agent a second time to rewrite the answer for another audience.

### 8. Relay
Relay the prose answer. Keep citations, "Things worth flagging" and the confidence section. If `graphStale` is true, say so and suggest `/graphify <src> --update`.

### 9. Report (if `report: true`)
Every question gets its own folder: `docs/flows/<slug>/`. Nothing but `index.html`, `_repo-profile.md` and `_onboarding.md` lives loose in `docs/flows/`.
1. Extract the agent's last ```json block. If missing/invalid, say so and offer a re-run; do not hand-write it.
2. Check the JSON for secrets before writing: if any field looks like a password, key, token or connection string, remove it and tell the user. `build-report.mjs` also scans and refuses (exit code 3, no HTML written) if it finds one; redact the flagged fields in `report.json` and re-run. Never print the secret value.
3. Make sure `type` and `audience` are present and are among the known values; if not, set them to the values you routed with. Stamp the JSON so the report can show its age later: set `generated` to today (`YYYY-MM-DD`) and `commit` to the output of `git rev-parse --short HEAD` (omit `commit` if not a git repo). Do not hand-edit these when rebuilding; keep the values already in `report.json`.
4. Pick the folder: slug = short lowercase letters, digits, hyphens from the question (max ~50 chars). If `docs/flows/<slug>/` already exists, use `<slug>-<YYYYMMDD>`; if that exists too, append `-2`, `-3`.
5. Write into the folder:
   - `report.json`: the agent's JSON
   - `report.html`: built by `node "<scripts dir>/build-report.mjs" docs/flows/<slug>/report.json docs/flows/<slug>/report.html` (add `--plain` to open a developer report on the plain view). It opens on the plain view by itself when the audience is not `dev`. If it errors, show the error; keep the JSON.
   - `answer.md`: the question verbatim, date, the `Treated as:` line, then the prose answer you relayed (citations, flags, confidence). Never include secret values.
6. Refresh the index: `node "<scripts dir>/build-index.mjs" docs/flows` (writes `docs/flows/index.html`, a searchable list of every question folder with a type filter). Then give the absolute path of `report.html` and mention the index. Open it in the browser only if the user asks.
7. If the user wants the same question written for another audience, run it again with that audience named. Do not rewrite the report by hand.
8. For `text` mode (no report), still write `docs/flows/<slug>/answer.md` only if the user asks to keep the answer.

Layout:
```
docs/flows/
  index.html              (list of all reports, rebuilt after each run)
  _repo-profile.md        (onboarding, one per repo)
  _onboarding.md
  checkout-flow/
    report.html
    report.json
    answer.md
  refund-flow/
    ...
```

## Migrate
`/ask migrate`: tidy reports made before 0.3.0 into per-question folders. Old loose files are moved, not copied (no backup).
1. Run `node "<scripts dir>/migrate-reports.mjs" docs/flows` (dry run: prints the plan, changes nothing).
2. Show the user the plan. If nothing to migrate, say so and stop. Tell them plainly that the old files will be moved with no backup, and ask to confirm.
3. On yes, run the same command with `--apply`, then `node "<scripts dir>/build-index.mjs" docs/flows`.
4. Report the result. For any `NOTE` line (a report whose JSON looked like it held a secret, so its HTML was not rebuilt), tell the user to review that `report.json` and redact it.

## Profile
`/ask profile`: run Onboarding step 1 with `--force` semantics (ask before replacing an existing profile), then `record`.

## Notes
- Needs Node.js for the checks and the HTML report. Without Node the skill cannot run the gate.
- Reports, the profile and the onboarding record live in `docs/flows/`; add it to `.gitignore` if you do not want them committed.
- Reports made before 1.0.0 have no `type` or `audience`; they are listed and shown as workflow questions for developers.
- Only the agent's tool list is an enforced restriction. The write-path limit on this skill is an instruction, not a technical barrier.
