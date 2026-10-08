---
name: hulk
command: /hulk
type: impact
audience: dev
model: sonnet
report: true
approval: none
intro: "Hulk smash. Checking what breaks..."
---
# Lens: impact

The question is about what is affected if something changes or is removed.

## Looks for
- Direct callers and users of the target, then the callers of those callers
- Flows and features that pass through the target
- Tests that cover the target, and whether any exist
- Config, database objects and public interfaces that depend on it
- Anything outside this repo that may depend on it. You cannot see it, so say so in the confidence section.

## Sections
Put these in the answer and in the JSON `sections` array:
1. "Blast radius": kind `table`, columns ["Affected area", "Why it is affected", "Risk", "Evidence"]. Rank the rows from highest risk to lowest. Risk is high, medium or low.
2. "Tests to run": kind `list`. One item per existing test that covers the target. If none exists, give one item saying "no covering test found".

## Diagram
Caller graph. The target is in the middle lane, its callers before it and its dependents after it.
