# Lens: architecture

The question is about how the system is put together.

## Looks for
- Layers and what each one is responsible for, named the way this repo names them
- Module and service boundaries, and what crosses them (calls, events, shared tables)
- Dependency direction, and any place it points the wrong way
- Where state lives and which outside services are used
- Cross-cutting parts: auth, validation, errors, config

## Sections
Put these in the answer and in the JSON `sections` array:
1. "Layer map": kind `table`, columns ["Layer", "What lives here", "Evidence"]. One row per layer. Evidence is a `path:line`.
2. "Boundaries and dependencies": kind `list`. One item per boundary, saying what crosses it, with a `path:line`.

Under "Things worth flagging", give real risks you verified, for example a layer that skips another.

## Diagram
Component diagram. Lanes are this repo's own layers, ordered from the entry point to the outside world. One node per module or store that matters. Edges show the direction of the dependency. Use kind `async` for events and queues.
