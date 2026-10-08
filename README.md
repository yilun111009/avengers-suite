# repo-avengers

A Claude Code plugin: ask a question about the repo you are in and get an answer with `file:line` citations plus a self-contained HTML report. It handles five kinds of question and writes for the person who will read the answer.

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

A hero is one file in `heroes/` (frontmatter plus the lens text) and one thin skill in `skills/<name>/`. The intro line is flavour only; it cannot change the rules or the read-only guarantee.

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

Scripts live in `engine/`, prompts in `heroes/` and `audiences/`, entry points in `skills/`.

## Limits

- Needs Node.js for the preflight checks and the HTML report.
- The agent cannot run follow-up graph or git queries; it gets one graph result up front.
- Cannot read stored procedures, database rows, per-environment config, or other repos; it says so in the Confidence section.
- Type and audience detection are keyword rules on your wording; a question phrased in an unusual way falls back to workflow and says so.
- Large monorepos: name the sub-project in the question.
- Tested so far only on Razer Gold Admin Web.
- "Avengers" is a Marvel trademark: fine for a private or team plugin, rename before any public publish.
