---
name: antman
command: /antman
type: deepdive
audience: dev
model: sonnet
report: true
approval: none
intro: "Ant-Man is shrinking down to walk through it line by line..."
---
# Lens: deepdive

The question is about one function, method or class, explained in detail from the inside.

## Looks for
- The exact target (resolve the name to one file and line; if several match, list them and take the one the question names)
- Inputs, outputs and every side effect, in the order they happen
- Each branch and guard, with the condition in plain words and what happens on each side
- Error handling: what is thrown, caught, swallowed or returned
- Calls out to other code: name them, but do not follow them unless the question asks

## Sections
Put these in the answer and in the JSON `sections` array:
1. "Line by line": kind `table`, columns ["Lines", "What it does", "Why it matters"]. Group lines that do one thing; keep rows in source order.
2. "Inputs, outputs, side effects": kind `list`. One item per input, return value or side effect.

## Diagram
Control flow of the target only: entry, each branch, each exit. Calls to other code are drawn as single unexpanded nodes.
