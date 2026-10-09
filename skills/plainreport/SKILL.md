---
name: plainreport
description: Rebuild a saved hero report as a plain page, with no emblem, header band or hero tagline. No agent runs and nothing is rewritten. Read-only apart from one new HTML file. Trigger: /plainreport
---

# plainreport

Rebuilds a report you already have without the hero look, so it can be forwarded to someone else. It does not rewrite the answer: the wording and sections stay as the hero wrote them. For an answer written for another audience, run `/ask for <audience> <question>` instead.

Usage:
- `/plainreport`: the most recent report folder in `docs/flows/`.
- `/plainreport <slug>`: that folder, `docs/flows/<slug>/`.
- `/plainreport <slug>/heroes/<hero>`: one hero's report inside an `/assemble` run.

## Steps
1. Find the folder. With no argument, take the most recently changed `docs/flows/<slug>/` that has a `report.json` (ignore `heroes/` subfolders). If none exists, say so and stop. If the slug is not a folder in `docs/flows/`, say so and stop. Never accept a path with `..` or one outside `docs/flows/`.
2. Read its `report.json`. If its `type` is `assemble`, it is the team page: say that the team page is not supported and list the `heroes/<hero>` folders that can be rebuilt, then stop.
3. Locate the plugin's `engine/` folder (the same scripts dir the `ask` skill uses) and run:
   `node "<scripts dir>/build-report.mjs" docs/flows/<slug>/report.json docs/flows/<slug>/report.plain.html --no-theme`
   Keep the original `report.json` and `report.html` exactly as they are. If the build exits with code 3 it found a credential-like value and wrote nothing: tell the user which fields it named (never the value) and stop.
4. Give the absolute path of `report.plain.html` and say the themed `report.html` is still there. Do not open it unless asked.

Read-only: the only file written is `report.plain.html`. The report builder's secret scan runs on every build.
