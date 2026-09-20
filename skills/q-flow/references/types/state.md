# state

The lifecycle of one component or entity: states, the events that move between them, guards and actions. Read with `graph-common.md`.

| Node `kind` | Group `kind` | Edge `kind` |
| --- | --- | --- |
| `initial`, `state`, `final`, `choice` | none | `transition` |

## Rules

- One `initial`; any number of `state`; `final` only when the source has an explicit terminal state or the object is destroyed — otherwise a state with no outgoing transition is simply terminal. `choice` is a diamond for a pure branch point that is not a state.
- Every `transition` has a `label` naming the event (`pay`, `ship`); optional `guard` (the condition text, e.g. `payment.ok`, `within 7 days`) and `action` (`record payment id`). The Viewer displays `event [guard] / action`. Copy guards and actions from the transition table or code; do not invent them.
- Self-transitions are allowed. Anchor each state to where it is declared (enum member, transition-table row, status constant).
- One machine per view; keep 5–10 states. States carry the component's `module`; a `choice` takes the module of the subsystem whose result it branches on; `initial` / `final` never carry a wash.

## Minimal valid skeleton

```json
{
  "meta": { "title": "Order status", "sourceRef": "repo@main", "diagramType": "state", "locale": "zh-CN" },
  "nodes": [
    { "id": "initial", "label": "start", "kind": "initial" },
    { "id": "created", "label": "created", "kind": "state", "source": { "kind": "source", "file": "src/domain/order.js", "lineStart": 22, "lineEnd": 22 } },
    { "id": "paid", "label": "paid", "kind": "state", "source": { "kind": "source", "file": "src/domain/order-state.js", "lineStart": 5, "lineEnd": 5 } },
    { "id": "cancelled", "label": "cancelled", "kind": "state", "source": { "kind": "source", "file": "src/domain/order-state.js", "lineStart": 6, "lineEnd": 6 } }
  ],
  "edges": [
    { "id": "s0", "source": "initial", "target": "created", "kind": "transition", "label": "new Order", "evidence": "source" },
    { "id": "s1", "source": "created", "target": "paid", "kind": "transition", "label": "pay", "guard": "payment.ok", "action": "record payment id", "evidence": "source" },
    { "id": "s2", "source": "created", "target": "cancelled", "kind": "transition", "label": "cancel", "action": "release inventory", "evidence": "source" }
  ]
}
```

## Frequent validation errors

- `edge s.guard must be a string` — guards and actions are plain text, not objects or booleans.
- `edge s.kind is unsupported for state` — every edge is a `transition`; encode success / failure in the label or guard.
- Layout `route.anchor … exceeds an endpoint side` on a `final` with several long-labelled incoming transitions — when the object can be recreated (a cache slot, a session) let removal return to the empty state instead of a `final`.
- Layout `spacing.label-edge` between two self-transitions on one state — keep the one that changes something (a refresh); behaviour that changes no state (a read hit) belongs in the state's `facts`.
