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
- `/plainreport <slug>` on an `/assemble` folder rebuilds the team page and every finished hero's page.

## Steps
1. Find the folder. With no argument, take the most recently changed `docs/flows/<slug>/` that has a `report.json` (ignore `heroes/` subfolders). If none exists, say so and stop. If the slug is not a folder in `docs/flows/`, say so and stop. Never accept a path with `..` or one outside `docs/flows/`.
2. Read its `report.json`. If its `type` is `assemble`, it is a team folder: follow "Team folder" below instead of step 3.
3. Locate the plugin's `engine/` folder (the same scripts dir the `ask` skill uses) and run:
   `node "<scripts dir>/build-report.mjs" docs/flows/<slug>/report.json docs/flows/<slug>/report.plain.html --no-theme`
   Keep the original `report.json` and `report.html` exactly as they are. If the build exits with code 3 it found a credential-like value and wrote nothing: tell the user which fields it named (never the value) and stop.
4. Give the absolute path of `report.plain.html` and say the themed `report.html` is still there. Do not open it unless asked.

## Team folder
A team folder has `report.json` with `type: assemble` and a `heroes/<hero>/report.json` for each hero that finished. Build every plain page, so the plain team page has no link that leads back to a themed one:
1. For each `heroes/<folder>/report.json` that exists, run the step 3 command for that folder (output `heroes/<folder>/report.plain.html`). A hero with no `report.json` (it failed) is skipped.
2. Then build the team page: `node "<scripts dir>/build-assemble.mjs" docs/flows/<slug>/report.json docs/flows/<slug>/report.plain.html --no-theme`. The hero cards still show each hero's name and summary, but have no emblem or coloured edge, and link to that hero's `report.plain.html`.
3. If any build exits with code 3, tell the user which fields it named (never the value), keep going with the other folders, and say which pages were not written.
4. Give the absolute path of the team `report.plain.html` and the count of hero pages rebuilt.

Read-only: the only files written are `report.plain.html` files. The secret scan runs on every build.
