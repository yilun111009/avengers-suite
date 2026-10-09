# Changelog

## 0.1.0 - 2026-10-09

### Added
- `/flightplan <slug>... [on opus|sonnet|haiku] <goal>`: turns saved repo-avengers reports into a plan (`plan.html`, `plan.md`, `plan.json`) under `docs/plans/<name>/`.
- The `flight-director` agent: read-only (`Read, Grep, Glob`), no model of its own.
- A citation check of every `file:line` in the reports before planning.
- The model is always chosen by the user (a question, or `on <model>` in the command). `build-plan.mjs` refuses to run without `--model`.
