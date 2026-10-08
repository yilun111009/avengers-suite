# Changelog

## 1.4.0 - 2026-10-08

### Added
- `/assemble <goal>`: Fury splits a goal into sub-questions and proposes a team of at most 5 heroes, with a model for each and a relative cost line. Nothing runs until you choose `Approve`, `Approve, all on sonnet`, `Change` or `Cancel`. The heroes then run in parallel as read-only agents. You get one merged report plus a full report per hero under `docs/flows/<slug>/heroes/`.
- `/assemble rerun <hero>`: re-run only a failed hero and rebuild the combined page. A failed hero never blocks the others and is never re-run automatically.
- `engine/plan-team.mjs` (validates and edits a team plan, builds the approval text and the cost line), `engine/build-assemble.mjs` (renders the combined page) and `engine/secrets.mjs` (the secret scan, now shared by both report builders, with the patterns unchanged).
- Report type `assemble`, with its own entry in the index filter. It is a report type only: heroes cannot claim it and the router never returns it.

### Notes
- Approval, the cap of 5 and the write limit are instructions in the skill text. The only technical barrier is still the agent's tool list (`Read, Grep, Glob`).
- Each hero's per-call model has not been checked against `CLAUDE_CODE_SUBAGENT_MODEL`; check which model actually ran the first time.
- `/assemble` has not had a run on a real repository yet.

## 1.3.0 - 2026-10-08

### Added
- Lens heroes: `/thanos` (candidates for removal: unused code, never deletes anything), `/antman` (one function, line by line) and `/loki` (hidden risks). Plain `/ask` also detects these three question types from conservative keywords; "safe to remove" still means impact, and everyday words such as "unreachable" (a server) or "unchecked" (a checkbox) are not triggers.
- Preset heroes: `/ironman` (opus after your approval, ends with a systems check), `/hawkeye` (haiku, one to three lines, no report) and `/spiderman` (plain language for a newcomer). They have no lens of their own and detect the question type like `/ask`.
- `engine/types.mjs`: the one list of question types, used by the report builder, the index, preflight and the router.
- Report types `deadcode`, `deepdive` and `risk`, with labels and an entry in the index filter. Hero files may now say `type: auto`.

### Changed
- `/ask deep` is now documented as the same as `/ironman`.

### Notes
- Reports from earlier versions are unaffected. An unknown report type still builds as workflow with one warning.

## 1.2.0 - 2026-10-08

### Added
- Hero commands: `/thor` (architecture), `/captainamerica` (logic), `/drstrange` (workflow), `/blackwidow` (support) and `/hulk` (impact). Each is `/ask` with the question type fixed to that hero's lens and the hero's default audience. A named audience in the question still wins (`/hulk for qa ...`).
- `heroes/<name>.md`: one definition file per hero (frontmatter: name, command, type, audience, model, report, approval, intro; body: the lens). Preflight validates every hero file and checks that each hero has a skill and each hero skill has a hero file.

### Changed
- Layout: the scripts moved from `skills/explain/` to `engine/`; the lens files became hero files in `heroes/`; `audiences/` moved to the plugin root. `/explain` stays as an alias.
- Preflight failure ids: `lens-missing` and `lens-unsafe` are now `prompt-missing` and `prompt-unsafe`; new ids `hero-invalid` and `hero-unpaired`. The test override `AVENGERS_ASK_DIR` is now `AVENGERS_PLUGIN_DIR`.

### Notes
- Reinstall or run `/reload-plugins` after updating. Saved reports keep working: the question type names did not change.

## 1.1.0 - 2026-10-08

### Added
- `/ask deep <question>`: runs the agent on opus for harder questions. The skill asks you to approve opus first (`Use opus` / `Use the default model instead` / `Cancel`) and passes the model for that one run only. The agent's own default is `model: sonnet`. Onboarding profile builds always use the default model.

### Changed
- The agent now sets `model: sonnet` in its frontmatter, so it no longer depends on the session's model.

## 1.0.0 - 2026-10-07

### Changed
- Renamed the plugin to `repo-avengers` (was `rg-repo-explainer`). Reinstall once; the marketplace id `rg-local` is unchanged. The agent is now `repo-avengers`.
- New front door `/ask`. `/explain` stays as an alias.
- The agent now takes a question type and an audience. Five question types (architecture, logic, workflow, support, impact) are detected from the wording and shown as `Treated as: ...`. Four audiences (dev, qa, pm, support) are detected from the wording, or asked once if absent. `plain` is kept and means the pm audience.
- Hints are read from `.claude/avengers-hints.md`, falling back to `.claude/explainer-hints.md`.

### Added
- `skills/ask/lenses/` and `skills/ask/audiences/`: plain markdown prompt files. A new question type or audience is one new file.
- `detect-route.mjs`: keyword rules for type and audience, covered by 26 routing fixtures.
- Reports carry `type`, `audience` and `sections` (tables, lists, text). The report header shows how the question was treated, and reports for QA, PM and support open on the plain view.
- `docs/flows/index.html` has a filter by question type.
- Preflight fails when a lens or audience file is missing, names a tool, or tells the agent to run or change something, and when a project-level agent copy matches `explainer` or `avengers`.
- A test suite: `node --test "tests/*.test.mjs"`.

### Notes
- Reports from earlier versions have no `type` or `audience`; they keep working and show as workflow questions for developers.
- An unknown `type` or `audience` in a report is treated as workflow / dev with one warning; the report still builds.

## 0.7.1 - 2026-10-07

### Changed
- Removed the click-a-step interaction (clickable rows in the Steps table). The diagram keeps the step-ordered motion, the numbered badges and hover-to-isolate; hovering a box is how you follow one path.

## 0.7.0 - 2026-10-07

### Added
- `/explain migrate`: moves pre-0.3.0 loose reports (`docs/flows/<slug>.json` + `.html`) into `docs/flows/<slug>/report.{json,html}`. Dry run first; `--apply` performs it. Old files are moved, not copied (no backup).
- Migrated reports are rebuilt so they get the animation and age banner; the date comes from the file's modified time.

### Notes
- Skips a slug whose folder already exists or whose JSON is invalid, and never touches `_*` files or `index.html`.
- If a report's JSON trips the secret scan, its old HTML is kept as-is and the script says so; review and redact that `report.json`.

## 0.6.0 - 2026-10-07

### Added
- Report age: each report records `generated` and `commit`. The page shows "(N days ago)" and a warning banner once a report is 14 days or older.
- `docs/flows/index.html` shows, per report, how much the code changed since it was written: "up to date", "N commits since", or "N commits touched cited files" (counts commits that changed the files named in the report's citations). Uses read-only git; shows nothing outside a git repo.

### Notes
- Reports made before 0.6.0 have no `commit`; they get the date-based banner only if they have a `generated` date.

## 0.5.0 - 2026-10-07

### Added
- Step-ordered animation: edges can carry a `step` number matching the Steps table. The packets then run in step order and each arrow shows a numbered badge. Parallel edges may share a step.
- The agent now sets `step` on edges (see `agents/rg-repo-explainer.md`).

### Notes
- Reports without `step` (older reports, or edges the agent left unnumbered) keep the previous column-based timing.

## 0.4.0 - 2026-10-07

### Added
- `docs/flows/index.html`: a searchable list of every question folder, rebuilt after each report (`build-index.mjs`).
- Secret scan in `build-report.mjs`: refuses to write a report (exit code 3, values not shown) if the JSON contains an AWS key, private key, JWT, bearer token, `Password=` connection-string value, URL with credentials, or an assigned secret value.

### Fixed
- Animation: the failure/return packet on a back edge now starts one step after the request instead of at the same moment.

## 0.3.0 - 2026-10-07

### Added
- Animated flow diagram in the HTML report: packets travel along each edge in order, nodes glow when reached, arrows have flowing dashes.
- Pause/Play and Replay controls; hovering a node isolates its connections.
- Respects `prefers-reduced-motion` (starts paused).
- `answer.md` saved next to each report (question, date, mode, prose answer).

### Changed
- Reports are now organised per question: `docs/flows/<slug>/report.html`, `report.json`, `answer.md`. Repeated slugs become `<slug>-<YYYYMMDD>`, then `-2`, `-3`.
- Agent looks for earlier answers in `docs/flows/*/`.

### Notes
- Reports from earlier versions (loose `docs/flows/<slug>.html`) are not moved automatically.
- Animation timing follows the diagram's column layout, not the numbered steps.

## 0.2.1
- Earlier release (no notes recorded).
