# architecture

Components and their dependencies: who calls, reads or depends on whom, inside which runtime or ownership boundary. Read with `graph-common.md`.

| Node `kind` | Group `kind` | Edge `kind` |
| --- | --- | --- |
| `external`, `config`, `framework`, `security`, `service`, `business`, `data`, `failure`, `system`, `component`, `database` | `runtime`, `security`, `ownership`, `external` | `request`, `call`, `data`, `success`, `failure`, `framework`, `optional`, `depends` |

## Rules

- `business` is the business centre (one or two per view); `service` for services and entry points, `component` for internal modules, `data` for repositories / caches / queues as code, `database` for the store itself, `external` for systems outside the repository (clients, gateways, third parties — no `source`), `security` for auth / filters, `config` for configuration, `framework` for framework-owned runtime pieces, `failure` for an explicit failure handler or dead-letter path, `system` for a whole subsystem shown as one box.
- Edges follow the direction of the call or data movement: `request` for HTTP / RPC into the system, `call` for in-process or service calls, `data` for reads / writes, `depends` for configuration or library dependency, `success` / `failure` for outcome branches, `framework` for wiring supplied by a framework, `optional` for conditional paths. Label with the operation (`createOrder`, `publish order.created`), not the kind.
- `groupId` puts a node inside a real boundary (`runtime` = one process / JVM / container, `ownership` = team or module, `security` = trust zone, `external` = outside world). Nodes outside every group are fine.
- Keep 6–12 nodes per view; a second view beats a crowded one. Every node needs a `source` anchor except externals and framework pieces.

## Minimal valid skeleton

```json
{
  "meta": { "title": "Order service · components", "sourceRef": "repo@main", "diagramType": "architecture", "locale": "zh-CN" },
  "groups": [{ "id": "process", "label": "order-service process", "kind": "runtime" }],
  "nodes": [
    { "id": "client", "label": "Web client", "kind": "external", "subtitle": "calls POST /orders" },
    { "id": "api", "label": "OrderController", "kind": "service", "groupId": "process", "module": "order", "source": { "kind": "source", "file": "src/api/orders.js", "lineStart": 1, "lineEnd": 40, "symbol": "OrderController" } },
    { "id": "service", "label": "OrderService", "kind": "business", "groupId": "process", "module": "order", "subtitle": "createOrder · payOrder", "source": { "kind": "source", "file": "src/services/order-service.js", "lineStart": 6, "lineEnd": 49 } },
    { "id": "db", "label": "orders DB", "kind": "database", "groupId": "process", "module": "order", "source": { "kind": "schema", "file": "db/schema.sql", "lineStart": 1, "lineEnd": 31 } }
  ],
  "edges": [
    { "id": "e1", "source": "client", "target": "api", "kind": "request", "label": "HTTP", "evidence": "source" },
    { "id": "e2", "source": "api", "target": "service", "kind": "call", "label": "createOrder", "evidence": "source" },
    { "id": "e3", "source": "service", "target": "db", "kind": "data", "label": "save order", "evidence": "source" }
  ]
}
```

## Frequent validation errors

- `node X.kind is unsupported for architecture` — you used a kind from another type (`actor`, `process`, `entity`); pick from the table.
- `node X.groupId does not name a group` — add the group to `groups` or remove `groupId`.
- `edge e.evidence is unsupported` — one of `source code config schema test document framework inference`.
- Layout diagnostics after generation (`group.member-inset`, `route.*`) mean the view is too dense: split into two views rather than removing facts.
