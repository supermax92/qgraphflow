# dataflow

How data moves between external entities, processes and data stores (Gane–Sarson style). Read with `graph-common.md`.

| Node `kind` | Group `kind` | Edge `kind` |
| --- | --- | --- |
| `external`, `process`, `dataStore` | `ownership`, `external` | `data` |

## Rules

- `external` is a source or sink outside the system (user, partner API — no `source`); `process` transforms data (a service method, a job); `dataStore` holds it (table group, file, cache, topic).
- Every edge is `data` and its `label` names the data that flows (`customerId, items`, `paid orders`), not the operation. Direction is the direction the data moves; a request and its response are two edges when both carry data.
- Flows directly between stores, or from an external entity to a store, are kept when the source shows them; do not insert a process to make the notation "pure".
- `groups` mark ownership (`ownership`) or the outside world (`external`) only when the boundary is real. Anchor processes to the function, stores to the schema / file writer.
- Keep 6–10 nodes per view; one pipeline or one request path per view. `module` follows the evidenced domain of each process and store (the service, the cache layer, the topic); an external that belongs to a channel carries it too.

## Minimal valid skeleton

```json
{
  "meta": { "title": "Order data flow", "sourceRef": "repo@main", "diagramType": "dataflow", "locale": "zh-CN" },
  "nodes": [
    { "id": "buyer", "label": "Buyer", "kind": "external" },
    { "id": "create", "label": "createOrder", "kind": "process", "tags": ["core"], "source": { "kind": "source", "file": "src/services/order-service.js", "lineStart": 15, "lineEnd": 37 } },
    { "id": "orders", "label": "orders / order_items", "kind": "dataStore", "source": { "kind": "source", "file": "src/repo/order-repository.js", "lineStart": 8, "lineEnd": 11 } },
    { "id": "export", "label": "settlement export", "kind": "process", "source": { "kind": "source", "file": "src/jobs/settlement-export.js", "lineStart": 6, "lineEnd": 21 } },
    { "id": "csv", "label": "settlement CSV", "kind": "dataStore" }
  ],
  "edges": [
    { "id": "d1", "source": "buyer", "target": "create", "kind": "data", "label": "customerId, items", "evidence": "source" },
    { "id": "d2", "source": "create", "target": "orders", "kind": "data", "label": "order", "evidence": "source" },
    { "id": "d3", "source": "orders", "target": "export", "kind": "data", "label": "paid orders", "evidence": "source" },
    { "id": "d4", "source": "export", "target": "csv", "kind": "data", "label": "settlement rows", "evidence": "source" }
  ]
}
```

## Frequent validation errors

- `edge d.kind is unsupported for dataflow` — only `data`; the operation belongs in the label.
- `node X.kind is unsupported for dataflow` — `service` / `component` / `database` are architecture kinds; here they are `process` or `dataStore`.
