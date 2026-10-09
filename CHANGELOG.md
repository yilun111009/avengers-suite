# Changelog

## 0.2.0 - 2026-10-09 11:56

### Added
- A brief version of the plan (`brief.html`, `brief.md`): the flow, one line per step and the decisions to approve, with no files, verify, risk or citation detail. `/flightplan` asks Brief, Detailed or Both on every run.
- `build-plan.mjs --detail brief|detailed|both` (default `detailed`, the 0.1.0 behaviour).

### Changed
- `build-plan.mjs` renders every file before writing any, so a render error leaves nothing half-written.

## 0.1.0 - 2026-10-09 11:42

### Added
- `/flightplan <slug>... [on opus|sonnet|haiku] <goal>`: turns saved repo-avengers reports into a plan (`plan.html`, `plan.md`, `plan.json`) under `docs/plans/<name>/`.
- The `flight-director` agent: read-only (`Read, Grep, Glob`), no model of its own.
- A citation check of every `file:line` in the reports before planning.
- The model is always chosen by the user (a question, or `on <model>` in the command). `build-plan.mjs` refuses to run without `--model`.
