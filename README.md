# repo-avengers

A Claude Code plugin: ask a question about the repo you are in and get an answer with `file:line` citations plus a self-contained HTML report. It handles eight kinds of question and writes for the person who will read the answer.

Formerly `rg-repo-explainer` (0.x). See [CHANGELOG.md](CHANGELOG.md).

## Install (local folder)

Clone or copy this folder anywhere on your machine, then in Claude Code, from any repo:

```
/plugin marketplace add <path-to-this-folder>
/plugin install repo-avengers@rg-local
```

Upgrading from `rg-repo-explainer`: the plugin name changed, so uninstall the old one once (`/plugin uninstall rg-repo-explainer@rg-local`), install the new one, then restart the session or run `/reload-plugins`. To check, run `/plugin` and look for `repo-avengers` under the Installed tab.

## Use

```
/ask how does the checkout flow work
/ask for qa what are the refund rules
/ask explain to the PM what happens when a payment fails
/ask plain why would a user see error 4012          # non-technical answer
/ask deep what breaks if I change the Order status enum   # runs the agent on opus, asks you first
/hulk what breaks if I change the Order status enum   # hero command: impact lens
/drstrange what happens when a payment fails          # hero command: workflow lens
/assemble how does the refund flow work and what could break it   # Fury picks a team, you approve it
/ironman how does the whole refund flow hold together       # opus, asks you first, ends with a systems check
/hawkeye where is the retry logic                            # haiku, one to three lines, no report
/thanos is anything unused in the billing module             # candidates for removal; never deletes
/ask text where is the retry logic                  # no report
/ask profile                                        # (re)build the saved repo profile
/ask migrate                                        # move old loose reports into per-question folders
```

`/explain` still works and does the same thing.

### Question types (detected from your wording, never asked)

| Type | Example | You get |
|---|---|---|
| Architecture | how is the billing module structured | layer map, boundaries, component diagram |
| Logic | what are the rules for refunds | decision table, edge cases, decision flow |
| Workflow | what happens from checkout to payout | numbered steps with actors, flow diagram |
| Support | why would a user see error 4012 | symptom to cause table, cause tree |
| Impact | what breaks if I change the Order status enum | blast-radius list, tests to run, caller graph |
| Dead code | is anything unused in the billing module | candidates for removal with how each was checked (never deletes) |
| Deep dive | explain this function line by line: calculateRefund | line-by-line table, inputs and side effects, control flow |
| Risk | what could go wrong in the payout job | risks ranked by severity, and what was checked and found fine |

Every answer starts with `Treated as: <type> question, for <audience>.` so you can correct it. If the type is unclear it uses workflow and says so.

### Hero commands

Each hero is `/ask` with the question type fixed and a default audience. Name an audience in the question to override it.

| Command | Lens | Default audience |
|---|---|---|
| `/thor` | architecture | dev |
| `/captainamerica` | logic | dev |
| `/drstrange` | workflow | dev |
| `/blackwidow` | support | support |
| `/hulk` | impact | dev |
| `/thanos` | dead code: candidates for removal, never deletes | dev |
| `/antman` | deep dive: one function, line by line | dev |
| `/loki` | risk: hidden risks and tricks | dev |
| `/ironman` | auto (detected as in `/ask`), opus after approval, ends with a systems check | dev |
| `/hawkeye` | auto, haiku, one to three lines, no report | dev |
| `/spiderman` | auto, plain language for a newcomer | pm |

Presets (`type: auto`: ironman, hawkeye, spiderman) have no lens of their own; the question type is detected as in `/ask`. `/ask deep` is the same as `/ironman`.

A hero is one file in `heroes/` (frontmatter plus the lens text) and one thin skill in `skills/<name>/`. The intro line is flavour only; it cannot change the rules or the read-only guarantee.

### Assemble (Fury)

`/assemble <goal>` plans a team instead of answering directly. Fury splits the goal into sub-questions, picks a hero for each and a model for each, and shows you the plan before anything runs:

```
Fury's plan for: "how does the refund flow work and what could break it"
1. drstrange  opus    trace the refund flow end to end
2. hulk       sonnet  what breaks if Order status changes
3. loki       sonnet  hidden risks in the refund path
Rough cost: 3 agents (1 opus), about 5x a normal /ask
```

Your choices are `Approve`, `Approve, all on sonnet`, `Change` (type an edit such as "drop Loki, Hulk on opus") and `Cancel`. A team has at most 5 heroes; an edit that would pass 5 is refused. The same hero may appear twice for two different sub-questions, and each counts. The cost line is a relative count, not a price.

The heroes run in parallel as the same read-only agent. You get `docs/flows/<slug>/report.html` for the team and `docs/flows/<slug>/heroes/<hero>/report.html` for each hero. If one hero fails, the others still finish and the team page marks it failed; run `/assemble rerun <hero>` to re-run only that hero. Fury never re-runs one on his own. `/hawkeye` answers in text only, so it cannot be part of a team; use it on its own. `Change` is applied by `engine/plan-team.mjs edit`, so an edit that names a hero not in the plan, or that would pass 5, is refused with the reason and the previous plan is kept.

### Report themes

Every report has a look that belongs to the hero that made it: an accent colour (one for light mode, one for dark), a small emblem, a coloured header band and one tagline under the title. The `/assemble` team page has Fury's look, and each hero card on it shows that hero's emblem and a coloured edge. Findings, sections, wording and the diagram are exactly the same; only the header and the accent change.

A look is one small file in `themes/`:

```
name: hulk
accent: "#2e7d32"        # accent in light mode, #rrggbb only
accentDark: "#7bd88f"    # accent in dark mode
emblem: fist             # a name from the fixed set of twelve
tagline: "Hulk smash. Here is what breaks."
```

A theme can only pick an emblem by name from the fixed set; it never supplies SVG, and colours must be `#rrggbb`. Preflight checks every theme, including contrast: the accent must reach 4.5:1 as text on the page background in both modes, and the title on the band must reach 4.5:1 too. A hero without a theme fails preflight; two coloured themes whose accents are within 12 degrees of hue only produce a warning.

A report with no `hero`, an unknown hero or a broken theme looks byte-for-byte as it did before themes existed. A report built before 1.5.0 keeps its old look until it is rebuilt.

### Audience

Name the audience in the question ("for qa", "explain to the PM", "answer for support") and you are not asked. If you do not, you are asked once: "Is this answer for you, or for someone else?" and, if someone else, "Who?". Answers for QA, PM and support use no code names in the body and end with source references for a developer to verify before forwarding.

| Audience | Extra sections |
|---|---|
| dev | `path:line` after every claim |
| qa | test scenarios, edge cases to try |
| pm | business rules, user impact |
| support | symptom, likely cause, what to check, who to escalate to |

### Reports

Each question gets its own folder:

```
docs/flows/
  _repo-profile.md
  _onboarding.md
  checkout-flow/   report.html, report.json, answer.md
  refund-flow/     report.html, report.json, answer.md
```

A repeated slug becomes `<slug>-<YYYYMMDD>`. Open `docs/flows/index.html` for a searchable list of all reports, with a filter by question type. Add `docs/flows/` to `.gitignore` if you do not want them committed.

## Read-only guarantee

- The agent's tool list is `Read, Grep, Glob`. It has no shell and cannot write; this is enforced by the tool list, not by a prompt.
- The skill writes only to `docs/flows/` and `.claude/avengers-hints.md` (an instruction to the skill, not a technical barrier).
- Preflight fails if the plugin agent ever gains another tool, if a project-level `.claude/agents/*explainer*` or `*avengers*` copy exists that could shadow it, or if any hero or audience prompt file is missing, invalid, names a tool, or tells the agent to run or change something, or if a hero and its skill do not match (a best-effort text scan).
- The agent is told never to quote secret values (a prompt rule), and `build-report.mjs` backs that up with a pattern scan that refuses to write a report containing an obvious credential. The scan is best-effort, so still keep `docs/flows/` out of git.

## First run in a repo (onboarding)

1. **Preflight (every run, by script):** source readable, `docs/flows/` writable, no shadowing agent, agent still read-only, prompt files present and safe. A failure stops the run and shows the fix. Warnings (no gitignore entry, no README, no graph, not git) do not stop it.
2. **Onboarding (once):** the agent builds `docs/flows/_repo-profile.md`; the script verifies the paths in it exist and a `Scope:` line is present; you pick the scope if the repo holds several apps; you answer up to 3 blind-spot questions (stored procedures, config, other services) saved to `.claude/avengers-hints.md`; the result is recorded in `docs/flows/_onboarding.md`.
3. Later runs skip onboarding unless the profile goes stale (over 25% of its paths gone). `/ask onboard --force` redoes it.

## How an answer is produced

1. The skill runs preflight, then detects the question type and the audience from your wording.
2. It passes the agent the profile, hints, freshness (last commit vs graph date), one pre-run `graphify` result if a graph exists, and the matching lens and audience files.
3. The agent runs once: it searches, traces the topic through the layers named in the profile, and reads function bodies for rules and failure paths.
4. You get citations, things worth flagging, and a confidence section (confirmed / graph-only / not confirmed). The report's diagram lanes are named after that repo's own layers.

## Optional per-repo hints

Create `.claude/avengers-hints.md` in a repo to guide the agent (`.claude/explainer-hints.md` from older versions is still read), for example:

```
- Permissions are declared with [Permission(...)] on controllers.
- DB schema lives in sql/; stored procedures are not in the C# code.
- Feature flags are in config/flags.yaml.
- Payment errors are owned by the payments team (#payments-support).
```

## Develop

```
node --test "tests/*.test.mjs"
```

Use the quoted glob form; passing a bare folder does not work on current Node versions.

Report looks live in `themes/` (one file per theme) and `engine/themes.mjs`. Scripts live in `engine/` (`plan-team.mjs` and `build-assemble.mjs` serve `/assemble`), prompts in `heroes/` and `audiences/`, entry points in `skills/`.

## Limits

- Needs Node.js for the preflight checks and the HTML report.
- The agent cannot run follow-up graph or git queries; it gets one graph result up front.
- Cannot read stored procedures, database rows, per-environment config, or other repos; it says so in the Confidence section.
- Type and audience detection are keyword rules on your wording; a question phrased in an unusual way falls back to workflow and says so.
- Large monorepos: name the sub-project in the question.
- Approval questions (`/ironman`, `/ask deep`), the write-path limit and the hero model settings are instructions in the skill text. The only technical barrier is the agent's tool list (`Read, Grep, Glob`).
- Each hero sets a model on the Agent call. It has not been checked against `CLAUDE_CODE_SUBAGENT_MODEL`: if that variable wins, Hawkeye's haiku and Ironman's opus are silently ignored. Check which model actually ran the first time.
- Hero personas are flavour. They do not change the investigation rules.
- On a repo's first use, onboarding runs before the opus approval question, so a cancelled `/ironman` can still leave a repo profile behind.
- `/assemble` runs several agents at once, so it costs several times a normal `/ask`; the cost line is a relative count, not a price.
- Looks cannot be checked by tests; open a themed report in a browser. The contrast rule guarantees a readable accent, not a good-looking one. Emblems are simple original icons, not Marvel artwork.
- Tested so far only on Razer Gold Admin Web.
- "Avengers" is a Marvel trademark: fine for a private or team plugin, rename before any public publish.
