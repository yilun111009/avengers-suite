# Changelog

## 0.3.0 - 2026-10-09 14:28

### Changed
- Plan folders are named `<YYYY-MM-DD>-<topic>` (for example `docs/plans/2026-10-09-add-partial-refunds/`), with `-2`, `-3` when taken. Before, the date was added only when the name was taken.
- `/flightplan` accepts a report folder by its topic alone: `refund-flow` finds the newest `<date>-<type>-refund-flow` folder written by repo-avengers 1.6.0. A full folder name, old or new, still works and always wins. The outline shows the folders used.
- Report folder names may now be up to 80 characters (was 60), to fit the date and type.

### Added
- `engine/naming.mjs`: a copy of repo-avengers' naming rule; a test fails if the two drift apart (skipped when repo-avengers is not a sibling folder). It replaces `engine/slug.mjs`.

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
