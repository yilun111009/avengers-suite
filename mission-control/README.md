# mission-control

A Claude Code plugin: turn research you already saved (reports in `docs/flows/<slug>/`) into an implementation plan, as a self-contained `plan.html` and a `plan.md`. You choose the model that writes the plan; there is no default.

It reads reports written by the separate `repo-avengers` plugin. It never changes your code: the planner is read-only and the only folder written is `docs/plans/`.

## Install (local folder)

```
/plugin marketplace add <path-to-this-folder>
/plugin install mission-control@mc-local
```

Then restart the session or run `/reload-plugins`, and check `/plugin` for `mission-control`.

## Use

```
/flightplan refund-flow add partial refunds                  # asks which model
/flightplan refund-flow on sonnet add partial refunds        # named, so no question
/flightplan refund-flow team on haiku plan the migration     # several report folders
```

1. It reads the reports and checks every cited `file:line` against the current code (`ok`, `moved`, `missing`, `outside`, `invalid`). No model is used yet.
2. It shows an outline and asks: `Approve on opus`, `Approve on sonnet`, `Approve on haiku`, `Change` or `Cancel`.
3. It asks how much detail you want: `Brief`, `Detailed` or `Both` (asked on every run, even with `on <model>`).
4. The `flight-director` agent plans on the model you picked.
5. You get the files for your choice in `docs/plans/<YYYY-MM-DD>-<topic>/` (for example `docs/plans/2026-10-09-add-partial-refunds/`; a taken name gets `-2`, `-3`), all rendered from one `plan.json` (no extra model cost):
   - **Brief** (`brief.html`, `brief.md`): the flow, one line per step, and the decisions/assumptions to approve. Short enough to send to someone who just needs to decide.
   - **Detailed** (`plan.html`, `plan.md`): stages, collapsible steps with files, change, verify and risk, go/no-go checks, assumptions and the citation check. `plan.md` is checkboxes you can hand to `superpowers:writing-plans`.
   - `plan.json` and `checks.json` are always kept.

A folder name must be a folder in `docs/flows/`. You can type the full name (`2026-10-09-workflow-refund-flow`) or just its topic (`refund-flow`); a topic picks the newest folder with that topic, and the outline shows which one was used. The first word that is not a folder starts the goal. An `/assemble` folder works as one name: its combined report and every hero's report are read.

## What a plan is built from

The planner depends on these `report.json` fields from repo-avengers: `title`, `question`, `summary`, `type`, `generated`, `commit`, `steps`, `rules`, `sources`, `confidence`, `sections`. A test fails if the bundled baseline loses one, and (when both plugins sit in the same parent folder) if it differs from repo-avengers' own baseline.

## Develop

```
node --test "tests/*.test.mjs"
```
