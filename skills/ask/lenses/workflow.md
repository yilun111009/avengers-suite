# Lens: workflow

The question is about what happens from one point to another, in order, and who or what does each step.

## Looks for
- The ordered steps from the trigger to the end result
- The actor of each step: a user, a service, a job, an outside system
- Hand-offs between actors, including queues and events
- Side effects: notifications, cache changes, audit records
- Retries, timeouts and the failure path

## Sections
Give the numbered steps in `steps`, and say who acts in each step's text. Also put one section in the JSON `sections` array:
1. "Actors and hand-offs": kind `list`. One item per hand-off, saying who passes what to whom.

## Diagram
Flow diagram. Set `step` on every edge of the main path so the numbered badges and the animation follow the Steps table.
