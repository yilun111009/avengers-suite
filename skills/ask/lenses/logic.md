# Lens: logic

The question is about the rules: when something happens, what is allowed, and why something is refused.

## Looks for
- Validation and the exact condition for each rejection
- Branches, defaults and limits
- Permission and ownership checks
- How internal states and errors map to what the caller sees
- Edge cases: empty input, repeated calls, boundary values, partial failure

## Sections
Put these in the answer and in the JSON `sections` array:
1. "Decision table": kind `table`, columns ["Condition", "Outcome", "Evidence"]. One row per rule or branch. Evidence is a `path:line`.
2. "Edge cases": kind `list`. One item per edge case and what the code does with it.

Cover the failure path as well as the happy path.

## Diagram
Decision flow starting at the entry point. Each decision is a node. Use kind `fail` for every rejection branch.
