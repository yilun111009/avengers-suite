# repo-avengers 1.0.0: design

Date: 2026-10-07. Status: draft, awaiting review. Replaces `rg-repo-explainer` 0.7.1.

## 1. Purpose

Developers use this plugin to ask questions about the repo they are in. The answer is sometimes for the developer and sometimes for QA, PM or technical support. Today there is one fixed behaviour (trace a flow, cite `file:line`, build a report). It fits "how does X flow work" but not architecture, rule, support or impact questions, and `plain` is the only audience switch.

1.0.0 turns it into a general "ask this repo anything" plugin. Two things vary independently:

- **Question type** (lens) decides what the agent looks for and which sections it writes.
- **Audience** decides who the answer is written for.

### Success criteria

1. Each of the five question types produces its own section layout, not the flow layout.
2. The same question can be answered for dev, QA, PM or support, with the same investigation behind it.
3. The read-only guarantee is unchanged and still enforced by preflight.
4. Existing installs' saved reports still open and still appear in the index.

### Out of scope

Onboarding guide and Compare/diff lenses (need accumulated reports first). Parallel multi-agent mode (possible later; `/ask deep` as built is single-agent, see section 2). Any write access to the target repo.

## 2. Name and commands

| Item | Decision |
|---|---|
| Plugin name | `repo-avengers` (new). Avengers is a Marvel trademark: fine for a private or team plugin, rename before any public publish. |
| Version | 1.0.0 |
| Commands | `/ask <question>` (new). `/explain` stays as an alias. |
| Deep mode (1.1.0) | `/ask deep <question>` runs the single agent on opus for that one run, after the user approves it (`Use opus` / `Use the default model instead` / `Cancel`). The agent's frontmatter default is `model: sonnet`. Only the question run is affected, not onboarding profile builds. |
| Marketplace id | `rg-local` unchanged. A reinstall is needed once because the plugin name changes. |
| Agent | `agents/repo-avengers.md` (renamed from `rg-repo-explainer.md`), still `tools: Read, Grep, Glob` |
| Hints file | `.claude/avengers-hints.md`; the old `.claude/explainer-hints.md` is read as a fallback |

Usage:
```
/ask how does checkout work
/ask for qa what are the refund rules
/ask plain why would a user see error 4012      # plain = non-technical, shortcut kept
/ask text where is the retry logic              # no report, as today
/ask onboard | profile | migrate                # unchanged
```

## 3. How a question is handled

```
question
  -> preflight (unchanged; stops on failure)
  -> detect audience from wording ("for qa", "explain to PM", "for support")
       not named -> ask "for you or someone else?" -> me = dev; others -> ask "who?"
  -> detect type from keyword rules in SKILL.md; unclear -> workflow, said in header
  -> build context (profile, hints, freshness, graph result)       [unchanged]
  -> ONE agent run with: lens file + audience file + context + question
  -> relay answer, build report in docs/flows/<slug>/
```

Decisions:

- **One agent run, not two.** The audience file goes into the same prompt and the agent writes in that voice directly. A second "rewrite for audience" pass would double the cost and could add claims nobody verified against source.
- **Audience is detected from wording only**, never guessed from tone or topic. "For me" always means dev. A typed role such as "customer success" maps to the closest view (technical for engineering-like roles, plain-language for the rest).
- **Type is detected, never asked.** The header states it ("Treated as: logic question") so it can be corrected. Detection is written as explicit keyword rules so it can be tested.
- **Mixed questions:** the better-matching type leads in full; the second type gets a short section. Still one run.

## 4. Lenses (what the agent looks for)

| Type | Detected from | Agent looks for | Dev sections | Diagram |
|---|---|---|---|---|
| Architecture | "how is X structured", "what layers", "how do A and B connect" | Layers, boundaries, dependencies, stores, external services | Layer map with `path:line` per boundary; risks | Component diagram, lanes named after the repo's layers |
| Logic | "what are the rules for", "when does X happen", "why does it reject" | Validation, branches, permission checks, status mapping, edge cases | Rule list and decision table, cited | Decision flow, failure branches marked |
| Workflow | "what happens from A to B", "walk me through", "who does what" | Ordered steps, actors, hand-offs, async effects, retries | Numbered steps with actors | Flow diagram (today's) |
| Support | "why would a user see", "error X", "customer says", "how do I fix" | Error messages and codes, where raised, triggers, what to check, who owns the fix | Symptom -> cause -> check -> escalate table | Short cause tree |
| Impact | "what breaks if I change", "who calls X", "is it safe to remove" | Callers, affected flows, covering tests, config/DB touchpoints | Blast-radius list ranked by risk, tests to run | Caller graph |

Each lens is one markdown file in `skills/ask/lenses/`. Default when unclear: Workflow.

## 5. Audiences (who it is written for)

| Audience | Voice and extra sections |
|---|---|
| dev | Current cited trace, `path:line`, risks, confidence |
| qa | Test scenarios, expected outcomes, edge cases to try; code names kept out of the body |
| pm | Business rules, user impact, decisions the system makes; no code names |
| support | Symptoms, likely causes, what to check, who to escalate to; no code names |

Non-dev audiences end with "Source references (for the developer to verify before forwarding)" and use "needs developer confirmation" when unsure, as plain mode does today. `plain` maps to the pm/support voice. One file each in `skills/ask/audiences/`.

## 6. Structure

```
agents/repo-avengers.md             read-only agent; accepts `type:` and `audience:`
skills/ask/
  SKILL.md                          parse, detect audience and type, context, agent call, report
  lenses/    architecture.md logic.md workflow.md support.md impact.md
  audiences/ dev.md qa.md pm.md support.md
skills/explain/
  SKILL.md                          alias: "same as /ask"
  check-onboarding.mjs  build-report.mjs  build-index.mjs  migrate-reports.mjs   (stay in place)
.claude-plugin/plugin.json          name, version 1.0.0
.claude-plugin/marketplace.json     plugin entry renamed
```

`skills/ask/SKILL.md` calls the scripts through the sibling `../explain/` directory. Moving the scripts was rejected as the only risky part of the change; leaving them keeps every working path as it is.

### Agent changes

- New inputs `type:` and `audience:`.
- The fixed "Output: dev mode / plain mode" sections are replaced by "follow the sections of the supplied lens and audience".
- Unchanged: tools, safety rules, never quote secrets, `task: profile`, citation rule, "say what you searched and stop" rule.

### Report JSON

- Adds `type` and `audience`. Absent means `workflow` / `dev`.
- `build-report.mjs` renders the lens's sections and the audience's extras. The index gets a type filter.

### Preflight changes

- Agent path and name updated; the shadow check regex `/explainer/i` becomes `/(explainer|avengers)/i` so a stale project copy of either name is caught.
- New scan: every lens and audience file must not mention tools or instruct the agent to write or run anything. Best-effort text scan, like the secret scan.

## 7. Error handling

| Situation | Behaviour |
|---|---|
| Preflight fails | Stop and show the fix, as today |
| Type unclear | Workflow, stated in the header; never blocks |
| Audience not in wording | Ask; if skipped, dev |
| Lens or audience file missing | Stop and name the missing path; never fall back to a blank prompt |
| Unknown `type` / `audience` in the agent's JSON | Treated as workflow/dev, one warning, report still builds |
| Agent returns no JSON | Say so and offer a re-run; the JSON is never hand-written |
| Old report without `type` | Builds and lists as workflow/dev |
| Secrets | Agent rule and `build-report.mjs` scan apply to every lens and audience, including new sections |

## 8. Migration

- Reinstall once: plugin name changed. Marketplace id `rg-local` is unchanged.
- Saved reports in `docs/flows/` need no action. `/explain migrate` is unchanged.
- Repos with `.claude/explainer-hints.md` keep working through the fallback; new hints are written to `.claude/avengers-hints.md`.
- A project-level agent copy named for either old or new name fails preflight with the existing fix message.

## 9. Testing

The repo has no tests today; this adds a small suite.

1. `node --test`, no new dependencies:
   - preflight fails when the agent gains a tool
   - the lens/audience scan rejects a file that mentions tools or writing
   - `build-report.mjs` renders each type and audience from fixture JSON
   - an old report with no `type` still builds
   - the index type filter works
2. Routing fixtures: about 20 sample questions with expected type and audience. Valid only because detection is written as keyword rules.
3. One real run per type on a repo you know, judged by you. Pass checks: support answer names where the error is raised; impact answer lists at least one covering test; logic answer has a decision table; architecture answer names the repo's own layers; workflow answer has ordered steps.

### Limits

Answer quality per type is only exercised by step 3; no automated test judges citation quality. The plugin has been tested on one repo so far (per the current README).

## 10. Open items

- Whether `/assemble` should be added as a themed alias for `/ask`. Not decided; `/ask` ships regardless.
- This directory is not a git repo, so the spec and later changes cannot be committed until `git init` is run.
