---
name: assemble
description: Assemble a team. Fury splits a goal into sub-questions, proposes up to five heroes with a model for each, shows you the plan and the relative cost, and only after you approve runs them in parallel as read-only agents. You get one merged report plus a full report per hero. Read-only. Trigger: /assemble
---

# Assemble (Fury)

Usage:
- `/assemble <goal>`: Fury plans a team, you approve or change it, the heroes run, and one merged report comes back.
- `/assemble for qa <goal>`: name the audience for the whole team (default: each hero's own default).
- `/assemble rerun <hero>`: re-run only that hero of the most recent team run, then rebuild the combined page.

Fury is this skill. He is not an agent. Planning and merging happen here; only the heroes run as agents, each the read-only `repo-avengers` agent.

## Safety contract (read first)

- Every hero is the read-only `repo-avengers` agent (`Read, Grep, Glob`). It cannot write or run commands.
- **You (this skill)** may write only to `docs/flows/**` and `.claude/avengers-hints.md`. Never write, edit or delete any other path, and never run a command that modifies the repository. This limit is an instruction, not a technical barrier.
- Commands you may run: `node "<scripts dir>/check-onboarding.mjs" ...`, `node "<scripts dir>/plan-team.mjs" ...`, `node "<scripts dir>/detect-route.mjs" ...`, `node "<scripts dir>/build-report.mjs" ...`, `node "<scripts dir>/build-assemble.mjs" ...`, `node "<scripts dir>/build-index.mjs" ...`, `graphify query|path|explain ...` (only if `graphify-out/graph.json` exists), `git log -1 --format=%cI`, `git rev-parse`. Nothing else.
- `<assemble dir>` is the "Base directory for this skill". `<plugin dir>` is `<assemble dir>/../..`. `<scripts dir>` is `<plugin dir>/engine`.
- Approval, the cap of 5 and the write limit are instructions in this text. The only technical barrier is the agent's tool list.

## Steps

### 1. Parse
If the first word is `rerun` and the next word is a hero name (or a hero name with a number, such as `hulk-2`), jump to Re-run. Use Re-run only if the word after `rerun` is a hero name: a goal such as "rerun the nightly job, why does it fail" is a normal goal. Strip a leading `for <audience>` the way the `ask` skill does (the audience applies to every hero). If no goal remains, ask what the goal is and stop.

### 2. Preflight and onboarding
Run from the repo root: `node "<scripts dir>/check-onboarding.mjs" preflight`.
- If `ok` is false: **stop.** Show each failure with its fix. Do not spawn any agent.
- Show warnings once, one short line each. Do not stop for warnings.
- Run onboarding exactly as in the `ask` skill (its step 3: profile, scope, hints, record) when it is needed. This can run an agent and write files in `docs/flows/` and `.claude/` before the approval screen; say so if it happens.

### 3. Plan (Fury)
Read, without opening any source file: the front matter and the first heading of every file in `<plugin dir>/heroes/`, `docs/flows/_repo-profile.md`, and the hints file. Fury never reads source code; he plans from the profile.

Split the goal into sub-questions, one hero per sub-question, **at most 5 heroes**. Pick the hero whose lens fits the sub-question. Give each a model and a one-line reason: `opus` for sub-questions that need tracing across several layers, `sonnet` for bounded ones, `haiku` for simple lookups. A hero that answers in text only (no report), such as `/hawkeye`, cannot be on a team, because every team member must produce a report; `plan-team.mjs` refuses it. Use `/hawkeye` on its own for quick lookups. A simple goal gets a single hero, and Fury says so. The same hero may appear twice for two different sub-questions; each counts toward the 5.

Write the plan as JSON (`{"goal": ..., "heroes": [{"hero", "model", "task", "why"}]}`) and check it:

```
node "<scripts dir>/plan-team.mjs" validate <<'PLAN_END'
<the plan JSON>
PLAN_END
```

If `ok` is false, the plan names an unknown hero, a bad model, an empty task or too many heroes. Fix it and re-plan once. If it fails a second time, say so, show the errors and stop. Do not spawn any agent.

### 4. Approval (nothing runs before this)
Show the screen the script builds:

```
node "<scripts dir>/plan-team.mjs" show <<'PLAN_END'
<the validated plan JSON>
PLAN_END
```

Then ask one question with exactly four choices: `Approve`, `Approve, all on sonnet`, `Change`, `Cancel`. Do not spawn any agent until they answer.
- `Approve`: run the plan as shown.
- `Approve, all on sonnet`: set every hero's model to `sonnet`, then run.
- `Change`: the user types an edit in words ("drop Loki, Hulk on opus, add Thor for the layer map"). Turn it into the structured edit `{"drop": [...], "models": {...}, "add": [{"hero", "task"}]}` and apply it with the script, not by hand:

```
node "<scripts dir>/plan-team.mjs" edit <<'PLAN_END'
{"plan": <the current plan>, "edit": <the structured edit>}
PLAN_END
```

If `ok` is false, show the errors and keep the previous plan, then ask for another edit. If `ok` is true, show the screen again with `plan-team.mjs show`. The cap is never above 5 after an edit: if an edit would pass 5, the script refuses it; do not trim the team yourself.
- `Cancel`: On `Cancel`, stop; no hero runs and no team report is written (onboarding, if it ran in step 2, has already written its files).

### 5. Run the heroes (in parallel)
Pick `<slug>` first, before anything is written: lowercase letters, digits and hyphens from the goal (max ~50 chars); if `docs/flows/<slug>/` already exists use `<slug>-<YYYYMMDD>`, and if that exists too append `-2`, `-3`. The same folder is used for the combined page and every hero.

For each hero in the approved plan, read `<plugin dir>/heroes/<hero>.md` and `<plugin dir>/audiences/<audience>.md` (audience: the one named in step 1, else the hero's default). Build the context block exactly as in the `ask` skill's step 6 (freshness, one `graphify` result if a graph exists, the profile, the hints).

Spawn **all the agents in one message** so they run concurrently. Each is the `repo-avengers` agent with: `task: explain`, `type` (the hero's type; for a `type: auto` hero run `node "<scripts dir>/detect-route.mjs"` on that hero's sub-question, with the question on stdin through a quoted heredoc as in the `ask` skill's step 4, and use the type it prints), `audience`, `report: true`, **the hero's sub-question as the question**, the context block, the hero file text after its frontmatter under `LENS:` (for a `type: auto` hero, appended as the last part of that block with the sentence "This hero's instructions replace the Sections and Diagram above when they conflict."), the audience file text under `AUDIENCE:`, `model: "<approved model>"` on the Agent call, and the reminder that it is read-only and must not quote secrets.

### 6. Collect, per hero
For each reply, extract its last ```json block.
- Valid: first check the JSON for secrets before you write it (a password, key, token or connection string in any field: remove it and tell the user), then stamp `generated` (today) and `commit` (`git rev-parse --short HEAD`, omit if not a git repo), set `type` and `audience` to the values you used, set `hero` to that hero's name (`hulk` for `hulk-2`), and write it to `docs/flows/<slug>/heroes/<hero>/report.json`. Build its page: `node "<scripts dir>/build-report.mjs" docs/flows/<slug>/heroes/<hero>/report.json docs/flows/<slug>/heroes/<hero>/report.html`. The secret scan runs here, for every hero. If it refuses (exit code 3), redact the flagged fields in that hero's JSON and tell the user; do not publish a page that refused.
- Missing or invalid JSON, or a refused build you cannot redact: that hero is `status: "failed"` with a one-line `error`. If a `report.json` with a credential-like value was already written and cannot be redacted, delete that hero's `report.json` (it is inside `docs/flows/`) and say so. The other heroes still finish. Never re-run a hero on your own: each re-run costs money. Offer it once at the end.

If the same hero appears twice in the plan, its second run uses `heroes/<hero>-2/` (third: `-3/`), and that run's `reportPath` names that folder.

### 7. Merge (Fury)
Write one combined summary (2-5 sentences, plus a plain version with no code names). Compare the heroes' findings. Flag a disagreement only where two heroes cite conflicting evidence (different `path:line` for the same claim, or opposite conclusions about the same behaviour), record it in the later hero's `disagrees` list using exactly the fields `with`, `about`, `mine`, `theirs` shown below, and say it is your own inference. Do not invent agreement or disagreement. The Confidence section is the union of the heroes' confidence sections; `build-assemble.mjs` does the union and skips failed heroes.

Write the combined JSON to `docs/flows/<slug>/report.json`:

```json
{
  "type": "assemble",
  "hero": "fury",
  "title": "<short title>",
  "question": "<the goal, verbatim>",
  "summary": "...", "plainSummary": "...",
  "audience": "<the audience used for every hero>",
  "plan": [{"hero": "...", "model": "...", "task": "..."}],
  "results": [{"hero": "...", "model": "...", "task": "...", "status": "ok", "title": "...", "summary": "...", "type": "...", "reportPath": "heroes/<hero>/report.html", "sources": [], "confidence": {"confirmed": [], "graphOnly": [], "unconfirmed": []}, "disagrees": [{"with": "<other hero>", "about": "<the claim>", "mine": "<path:line>", "theirs": "<path:line>"}]}],
  "generated": "<YYYY-MM-DD>", "commit": "<short sha>"
}
```

Then build the page: `node "<scripts dir>/build-assemble.mjs" docs/flows/<slug>/report.json docs/flows/<slug>/report.html`. If it exits with code 3 it found a credential-like value; redact that field and run it again.

Write `docs/flows/<slug>/answer.md`: the goal, today's date, the approved plan (the screen from step 4), then the merged prose answer. Never include secret values.

Refresh the index: `node "<scripts dir>/build-index.mjs" docs/flows`. Give the absolute path of `report.html`, list the failed heroes (if any) and offer `/assemble rerun <hero>` for each. Do not run it.

## Re-run
`/assemble rerun <hero>` (for a hero that ran twice, use its folder name, such as `hulk-2`):
1. Run preflight first, exactly as in step 2: `node "<scripts dir>/check-onboarding.mjs" preflight`. If `ok` is false, **stop** and show the failures. Do not spawn any agent.
2. Find the most recent `docs/flows/*/report.json` whose `type` is `assemble` and whose `results` contain that hero; if there is none, say so and stop. Reuse the slug of the run you found; do not pick a new one. Read its `plan`, `results` and `audience` from that file.
3. Show that hero's one plan line and ask for approval with the same four choices (with a single hero, `Approve, all on sonnet` simply sets sonnet). On `Cancel`, stop.
4. Re-run only that hero as in steps 5 and 6, writing to `docs/flows/<slug>/heroes/<hero>/` of the run you found and reuse its stored `audience`. This replaces only that hero's folder and its entry in `results`; no other hero's files are touched.
5. Rewrite `summary`, `plainSummary` and `answer.md` from all the `ok` results, so the team page no longer describes the hero as failed. Then rebuild the combined page with `build-assemble.mjs`, refresh the index with `build-index.mjs`, and keep the hero marked failed if it failed again.

## Notes
- A hero that appears twice in a plan gets folders `heroes/<hero>/` and `heroes/<hero>-2/`; `reportPath` names the right one.
- `/ask`, the hero commands and `/explain` are unchanged.
- Rough cost is a relative count (agents weighted by model), not a price.
