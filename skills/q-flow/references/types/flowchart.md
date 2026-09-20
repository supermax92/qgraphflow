# flowchart

The steps and decisions of one function, use case or job, top to bottom. Read with `graph-common.md`.

| Node `kind` | Group `kind` | Edge `kind` |
| --- | --- | --- |
| `start`, `end`, `process`, `decision`, `input`, `output`, `subprocess` | none | `flow`, `yes`, `no`, `success`, `failure` |

## Rules

- Exactly one `start`; one or more `end` nodes (success and failure endings may be separate nodes). Every other node lies on a path from `start` to an `end`.
- A `decision` asks one question in its label (`payment.ok?`) and has at least two outgoing edges: `yes` / `no` (label them `yes` / `no`, the locale's words, or the actual condition). Other kinds use `flow`; use `success` / `failure` for outcome edges into an `end`.
- `process` is a step that changes state; `input` / `output` read or emit data; `subprocess` is a call into another flow you are not expanding.
- The main path must read downward. When the happy path is not obvious from the edges, list it in `layout.primaryPath` (node ids in order, each pair joined by a directed edge). Feedback / retry edges are allowed and route around the outside.
- `module` per step is the subsystem whose work the step performs: a call into inventory is inventory's work, a payment check is payment's, a pure control decision keeps the owning component, `start` / `end` take the caller. A flow that really lives inside one subsystem keeps one module; `module.single-tone` only asks you to check.
- A `process`, `input`, `output` or `subprocess` has exactly one outgoing edge; only a `decision` branches (`flowchart.process-branch`).
- Anchor each step to the lines that implement it. Keep 8–14 nodes; merge trivial assignments into the step that owns them.

## Minimal valid skeleton

```json
{
  "meta": { "title": "createOrder flow", "sourceRef": "repo@main", "diagramType": "flowchart", "locale": "zh-CN" },
  "layout": { "primaryPath": ["start", "reserve", "ok", "persist", "done"] },
  "nodes": [
    { "id": "start", "label": "createOrder called", "kind": "start", "module": "orders" },
    { "id": "reserve", "label": "reserve inventory", "kind": "process", "module": "inventory", "source": { "kind": "source", "file": "src/services/order-service.js", "lineStart": 17, "lineEnd": 17 } },
    { "id": "ok", "label": "payment.ok?", "kind": "decision", "module": "payment", "source": { "kind": "source", "file": "src/services/order-service.js", "lineStart": 25, "lineEnd": 25 } },
    { "id": "persist", "label": "save order and payment", "kind": "process", "module": "orders", "source": { "kind": "source", "file": "src/services/order-service.js", "lineStart": 32, "lineEnd": 34 } },
    { "id": "done", "label": "return order", "kind": "end", "module": "orders" },
    { "id": "failed", "label": "throw 402", "kind": "end", "module": "orders" }
  ],
  "edges": [
    { "id": "f1", "source": "start", "target": "reserve", "kind": "flow", "evidence": "source" },
    { "id": "f2", "source": "reserve", "target": "ok", "kind": "flow", "evidence": "source" },
    { "id": "f3", "source": "ok", "target": "persist", "kind": "yes", "label": "yes", "evidence": "source" },
    { "id": "f4", "source": "ok", "target": "failed", "kind": "no", "label": "no", "evidence": "source" },
    { "id": "f5", "source": "persist", "target": "done", "kind": "success", "evidence": "source" }
  ]
}
```

## Frequent validation errors

- `layout.primaryPath has no directed edge from A to B` — the path must follow existing edges; fix the path or add the missing edge.
- `layout.primaryPath conflicts with node.layout.rank` — do not combine the two hints.
- A flow whose main path runs sideways fails the direction gate after generation: give the happy path as `primaryPath`.
