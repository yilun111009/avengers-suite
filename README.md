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
3. The `flight-director` agent plans on the model you picked.
4. You get `docs/plans/<name>/plan.html` (stages, collapsible steps, go/no-go checks, assumptions, the citation check), `plan.md` (the same, as checkboxes you can hand to `superpowers:writing-plans`) and `plan.json` (the source of both).

A folder name must be a folder in `docs/flows/`. The first word that is not a folder starts the goal. An `/assemble` folder works as one name: its combined report and every hero's report are read.

## What a plan is built from

The planner depends on these `report.json` fields from repo-avengers: `title`, `question`, `summary`, `type`, `generated`, `commit`, `steps`, `rules`, `sources`, `confidence`, `sections`. A test fails if the bundled baseline loses one, and (when both plugins sit in the same parent folder) if it differs from repo-avengers' own baseline.

## Develop

```
node --test "tests/*.test.mjs"
```
