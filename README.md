# avengers-suite

A Claude Code plugin marketplace with two plugins that work as a pair: one researches a repo, the other turns that research into an implementation plan.

| Plugin | What it does | Writes to |
|---|---|---|
| [`repo-avengers`](repo-avengers/README.md) | Ask anything about the repo you are in (architecture, logic, workflow, support, impact, dead code, deep dive, risk). You get an answer with `file:line` citations and a self-contained HTML report written for dev, QA, PM or support. | `docs/flows/<date>-<type>-<topic>/` |
| [`mission-control`](mission-control/README.md) | Turn saved reports into an implementation plan (`plan.html` and `plan.md`) on a model you choose. Read-only: it never changes your code. | `docs/plans/<date>-<topic>/` |

## How they fit together

```
/ask how does the refund flow work           -> docs/flows/2026-10-09-workflow-refund-flow/report.html
/flightplan refund-flow add partial refunds  -> docs/plans/2026-10-09-add-partial-refunds/plan.html
```

1. `repo-avengers` saves a report per question.
2. `mission-control` reads those reports, re-checks every cited `file:line` against the current code, and asks you to approve a model and a level of detail before planning.

The plugins are coupled only through the `report.json` schema. `mission-control` depends on these fields: `title`, `question`, `summary`, `type`, `generated`, `commit`, `steps`, `rules`, `sources`, `confidence`, `sections`. Its fixture `mission-control/tests/fixtures/report-baseline.json` must stay in sync with `repo-avengers/tests/fixtures/report-baseline.json`; a test fails if they drift.

## Folder names

Both plugins name their folders with one shared rule (`engine/naming.mjs`; mission-control holds a copy that a test keeps identical):

| Saved | Format | Example |
|---|---|---|
| Report | `<YYYY-MM-DD>-<type>-<topic>` | `docs/flows/2026-10-09-impact-order-status-enum/` |
| Assemble run | `<YYYY-MM-DD>-assemble-<topic>` | `docs/flows/2026-10-09-assemble-refund-flow/` |
| Plan | `<YYYY-MM-DD>-<topic>` | `docs/plans/2026-10-09-add-partial-refunds/` |

The date comes first so `ls` sorts oldest to newest. A taken name gets `-2`, `-3`. Search with globs such as `ls -d docs/flows/*-impact-*` or `ls docs/flows/2026-10-*`. `/flightplan` accepts a topic alone (`refund-flow`) and picks the newest matching folder. Folders made before this rule keep their old names and still work.

## Install

From any repo in Claude Code, add this folder as a marketplace and install the plugins you want:

```
/plugin marketplace add <path-to-avengers-suite>
/plugin install repo-avengers@avengers-suite
/plugin install mission-control@avengers-suite
```

Then restart the session or run `/reload-plugins`, and check `/plugin` for both plugins.

Each plugin also ships its own marketplace file, so it can be installed on its own (see each plugin's README).

## Quick start

```
/ask how does the checkout flow work
/hulk what breaks if I change the Order status enum
/assemble how does the refund flow work and what could break it
/flightplan refund-flow add partial refunds
```

See the plugin READMEs for the full command list, hero commands and audiences.

## Repository layout

```
.claude-plugin/marketplace.json   marketplace listing both plugins
repo-avengers/                    skills, heroes, themes, audiences, agent, engine, tests
mission-control/                  skill, flight-director agent, engine, tests
```

Both plugins are plain Node ESM with no dependencies and no build step. Skills and agents are markdown prompts; `engine/` holds the deterministic code (routing, report and plan rendering, citation checks, secret scrubbing).

## Develop

Requires Node 22 or newer. Run each plugin's tests from its own folder:

```
cd repo-avengers   && node --test "tests/*.test.mjs"
cd mission-control && node --test "tests/*.test.mjs"
```

## Changelogs

- [repo-avengers](repo-avengers/CHANGELOG.md)
- [mission-control](mission-control/CHANGELOG.md)
