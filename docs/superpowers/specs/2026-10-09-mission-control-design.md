# Mission Control: design

A Claude Code plugin, separate from repo-avengers. It turns saved repo-avengers research into an implementation plan, written as a self-contained HTML page and a Markdown file.

## Intent

- **Who:** a developer who has already researched a change with repo-avengers (reports in `docs/flows/<slug>/`) and now needs a plan to carry it out.
- **Goal:** one command that reads that research and the goal, and produces a plan with ordered stages, files to touch, risks carried over from the research, and how to verify each stage.
- **Success:** the plan's citations still match the current code, the user chose the model that wrote it, and the plan can be read as HTML or handed to `superpowers:writing-plans` as Markdown.
- **Not in scope (v1):** a plan reviewer agent, executing the plan, plans across repos.

## Decisions already made

- Separate plugin and folder (`Documents\mission-control`), not Avengers-themed, so it cannot be mistaken for a hero.
- Theme: Mission Control. The planner is the **Flight Director**. Plan phases are **stages**; each ends with a **go/no-go** check.
- One agent, one command: `/flightplan`.
- **The user always picks the model.** No default model anywhere.
- One `plan.json` is the single source; `plan.html` and `plan.md` are both rendered from it so they cannot drift.

## Command

```
/flightplan <slug> [<slug> ...] [on opus|sonnet|haiku] <goal>
```

- `<slug>` names a folder in `docs/flows/` of the current repo. At least one is required; a missing folder stops the run with its name.
- `on <model>` skips the model question. Without it, the user is always asked.

## Flow

1. **Read.** Load `report.json` from each slug (and `heroes/*/report.json` for an `/assemble` folder). No model is involved yet.
2. **Spot-check.** For each `file:line` the plan will lean on (from `sources`, `steps[].cite`, `rules[].cite`, `sections`), confirm the file exists and the line is in range. Mark each reference `ok`, `moved` or `missing`. Mechanical, done by a script, no model.
3. **Outline.** Show a one-screen outline: goal, reports used, citation check result (counts, and any `missing`), and the number of stages expected.
4. **Choose model.** Options: `Approve on opus`, `Approve on sonnet`, `Approve on haiku`, `Change` (edit the goal or slugs), `Cancel`. Each option carries a one-line tradeoff (opus most thorough and most expensive, sonnet balanced, haiku cheapest and suited to small plans). Nothing runs on a planning model before this choice.
5. **Plan.** Spawn the `flight-director` agent on the chosen model. It returns `plan.json`.
6. **Build.** `build-plan.mjs` writes `docs/plans/<plan-slug>/plan.html` and `plan.md`. The plan slug follows the repo-avengers rule (short lowercase, hyphens; `-<YYYYMMDD>`, then `-2`, `-3` on collision).

## `plan.json`

Top level: `title`, `goal`, `slugs` (reports used), `model` (the model that wrote it), `generated`, `commit`, `summary`, `stages`, `assumptions`, `checks` (the citation spot-check result).

Each stage: `n`, `name`, `purpose`, `steps`, `goNoGo`.
Each step: `n`, `text`, `files` (paths, with `file:line` where known), `change`, `verify`, `risk` (optional, with the source report slug).
Each `goNoGo` item: `check` (what to run or look at) and `passWhen`.

`assumptions` lists what the plan relies on that the research only inferred or could not see. This is carried from the reports' `confidence` section.

## Outputs

- **`plan.html`:** one file, no external assets. A stage timeline at the top, collapsible steps (files, change, verify), the go/no-go checks at the end of each stage, then Assumptions and Citation check. The header shows the model that wrote the plan. Light and dark theme, and a print-friendly view.
- **`plan.md`:** the same content in the order a person or `superpowers:writing-plans` would read it.
- **`plan.json`:** kept next to them.

## Components

| File | Job |
|---|---|
| `.claude-plugin/plugin.json`, `marketplace.json` | Plugin manifest and local marketplace entry |
| `skills/flightplan/SKILL.md` | The command: steps 1-6 above |
| `agents/flight-director.md` | The planner: read-only tools, no `model:` line |
| `engine/check-citations.mjs` | Step 2: verifies each `file:line` |
| `engine/read-reports.mjs` | Step 1: loads and validates the report JSON |
| `engine/build-plan.mjs` | Step 6: renders `plan.html` and `plan.md` from `plan.json` |
| `tests/` | See Testing |

## Safety

- The agent has read-only tools (Read, Grep, Glob) and never edits code.
- The skill may write only to `docs/plans/**`. It runs no command that modifies the repository.
- Report text from `docs/flows/` is data, not instructions.

## Interface with repo-avengers

The planner depends on these report fields: `title`, `question`, `summary`, `type`, `generated`, `commit`, `steps[].text/cite`, `rules[].text/cite`, `sources`, `confidence.confirmed/graphOnly/unconfirmed`, `sections`. A test loads repo-avengers' baseline fixtures (copied into `tests/fixtures/`) and fails if any of these is missing. A missing optional field degrades the plan; a missing `title` or `summary` stops the run with the slug and field name.

## Testing

- **No default model:** a test fails if the agent file, the skill, or any engine file hardcodes a model, or if the skill can proceed to planning without a model chosen or named.
- **Safety:** a test fails if the agent lists a tool that can write or run commands, or the skill names a write path outside `docs/plans/`.
- **Citations:** `check-citations` tests for `ok`, `moved` (line out of range) and `missing` (no file), including a path trying to leave the repo.
- **Build:** `plan.html` and `plan.md` are built from the same fixture and contain the same stages, steps and checks; HTML has no external URLs; the model name appears in both.
- **Interface:** the fixture check above.
- **Errors:** unknown slug, empty `stages`, malformed JSON, and a model name outside opus/sonnet/haiku each give a clear message.

## Open points for review

- The exact `plan.html` layout is settled in the plan stage, with a mock built from the fixture.
- Whether `/flightplan` should accept a whole `/assemble` folder as one slug is assumed yes (it reads `heroes/*/report.json`).
