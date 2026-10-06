# architecture

Components and their dependencies: who calls, reads or depends on whom, inside which runtime or ownership boundary. Read with `graph-common.md`.

| Node `kind` | Group `kind` | Edge `kind` |
| --- | --- | --- |
| `external`, `config`, `framework`, `security`, `service`, `business`, `data`, `failure`, `system`, `component`, `database` | `runtime`, `security`, `ownership`, `external` | `request`, `call`, `data`, `success`, `failure`, `framework`, `optional`, `depends`, `aggregates`, `inherits`, `provides` |

## Rules

- `business` is the business centre (one or two per view); `service` for services and entry points, `component` for internal modules, `data` for repositories / caches / queues as code, `database` for the store itself, `external` for systems outside the repository (clients, gateways, third parties — no `source`), `security` for auth / filters, `config` for configuration, `framework` for framework-owned runtime pieces, `failure` for an explicit failure handler or dead-letter path, `system` for a whole subsystem shown as one box.
- Edges follow the direction of the call or data movement: `request` for HTTP / RPC into the system, `call` for in-process or service calls, `data` for reads / writes, `depends` for configuration or library dependency, `success` / `failure` for outcome branches, `framework` for wiring supplied by a framework, `optional` for conditional paths. Label with the operation (`createOrder`, `publish order.created`), not the kind.
- Edge `site`: the call, client construction or config read that makes the edge hold.
- `groupId` puts a node inside a real boundary (`runtime` = one process / JVM / container, `ownership` = team or module, `security` = trust zone, `external` = outside world). Nodes outside every group are fine.
- Card text (this replaces graph-common's real-name rule for architecture): `label` is the component's short name as the team would say it (`订单服务`, `Order API`; about 12 characters or 3 words), never a list of classes; `subtitle` is one short line naming the class, route or table it stands for, verbatim (`OrderController`). One node is one component: when several classes form it, label their shared role, name the main one or the package in `subtitle` and list the rest in `facts`. Edge labels stay within 3 words (`下单`, `扣减库存`); details go to `facts`. Draw a filter or interceptor that guards a whole area as a `security` group around that area, not as an edge to each component.
- Keep all components needed by the requested scope. Prefer separate relationship views when dense; overview sections retain the complete requested inventory. Every repository-backed node needs a `source` anchor except externals and framework pieces. Document and conceptual scopes must be identified explicitly.

## Minimal valid skeleton

```json
{
  "meta": { "title": "Order service · components", "sourceRef": "repo@main", "diagramType": "architecture", "locale": "zh-CN" },
  "groups": [{ "id": "process", "label": "order-service process", "kind": "runtime" }],
  "nodes": [
    { "id": "client", "label": "Web client", "kind": "external", "subtitle": "calls POST /orders" },
    { "id": "api", "label": "Order API", "kind": "service", "groupId": "process", "module": "order", "subtitle": "OrderController", "source": { "kind": "source", "file": "src/api/orders.js", "lineStart": 1, "lineEnd": 40, "symbol": "OrderController" } },
    { "id": "service", "label": "Order service", "kind": "business", "groupId": "process", "module": "order", "subtitle": "OrderService", "source": { "kind": "source", "file": "src/services/order-service.js", "lineStart": 6, "lineEnd": 49 } },
    { "id": "db", "label": "Orders DB", "kind": "database", "groupId": "process", "module": "order", "subtitle": "orders table", "source": { "kind": "schema", "file": "db/schema.sql", "lineStart": 1, "lineEnd": 31 } }
  ],
  "edges": [
    { "id": "e1", "source": "client", "target": "api", "kind": "request", "label": "HTTP", "evidence": "source", "site": { "file": "src/api/orders.js", "lineStart": 5, "symbol": "POST /orders" } },
    { "id": "e2", "source": "api", "target": "service", "kind": "call", "label": "createOrder", "evidence": "source", "site": { "file": "src/api/orders.js", "lineStart": 14, "symbol": "createOrder" } },
    { "id": "e3", "source": "service", "target": "db", "kind": "data", "label": "save order", "evidence": "source", "site": { "file": "src/services/order-service.js", "lineStart": 31, "symbol": "save" } }
  ]
}
```

## Frequent validation errors

- `node X.kind is unsupported for architecture` — you used a kind from another type (`actor`, `process`, `entity`); pick from the table.
- `node X.groupId does not name a group` — add the group to `groups` or remove `groupId`.
- `edge e.evidence is unsupported` — one of `source code config schema test document framework inference`.
- Layout diagnostics after generation (`group.member-inset`, `route.*`) mean the view is too dense: split into two views rather than removing facts.

## Architecture overview templates

Set `meta.architectureView` to `relations` (default), `capabilities` (platform capabilities and application integration), or `engineering` (project organization and component layers). Choose from the user's question without asking them to select a template. These are all `architecture`, not additional diagram types. A plain architecture request keeps `relations`.

A requested collection may contain several architecture views. Give **every** architecture view in such a collection a distinct `meta.viewId`; IDs must be unique across all views, including legacy type identities. Collections contain 1–32 views, and other diagram types remain unique. Same-type views appear in input order and show their titles. A single view has no menu.

For either overview, supply non-empty `layout.sections`. Each section has a unique `id`, a `title`, and `mode`: `stack` (vertical layers), `grid` (automatically wrapping peer cards), `row` (parallel main/support columns), or `note` (explanatory text). Non-note sections have `items`, each exactly one `{ "nodeId": "..." }`, `{ "groupId": "..." }`, or a nested section. Note sections have non-empty `text` (paragraph strings) and no items. A section may have a `source` anchor. A component section may set `detailOf` to the overview component node ID. Every node is placed exactly once; referencing a group includes its real members and nested groups. Section IDs must not collide with node/group IDs. Sections are presentation only; retain real ownership in `groupId` / `parentId`.

Use `overviewText` on nodes for visible paragraph strings (an empty array enables overview editing). Optional `badges` is an array of `{ "label": "JDK 17", "role": "version", "evidence": "document", "source": { ... } }`. Roles are `status`, `version`, `requirement`; evidence and optional anchors follow the common rules. Never infer implementation status or runtime compatibility from module names or compiler versions. Images and planning text establish document claims, not source implementation.

Relationship directions: `aggregates` aggregator → member; `inherits` child → parent; `provides` provider → consumer; `depends` dependent → dependency. Record repository-backed sites; do not turn these into calls or remove relations to simplify layout.

```json
{
  "meta": { "title": "Platform integration", "diagramType": "architecture", "architectureView": "capabilities", "viewId": "platform-overview", "sourceRef": "Conceptual example", "locale": "en" },
  "nodes": [
    { "id": "platform", "label": "Platform", "kind": "system", "module": "platform", "overviewText": ["Shared capabilities for applications"], "badges": [] },
    { "id": "application", "label": "Application", "kind": "component", "module": "application", "overviewText": [], "badges": [] }
  ],
  "edges": [{ "id": "capabilities", "source": "platform", "target": "application", "kind": "provides", "label": "Shared capabilities", "evidence": "inference" }],
  "layout": { "sections": [
    { "id": "platform-layer", "title": "Platform", "mode": "stack", "items": [{ "nodeId": "platform" }] },
    { "id": "application-layer", "title": "Applications", "mode": "grid", "items": [{ "nodeId": "application" }] },
    { "id": "scope-note", "title": "Evidence scope", "mode": "note", "text": ["Conceptual structure; no source implementation claims."] }
  ] }
}
```

Generation computes all geometry. In the Viewer, unlock to reorder cards within their existing layer or group. Text, badges and notes are editable; successful edits relayout the overview. Failed edits keep the form and valid board; cancel discards the draft. Save persists the complete collection; reset affects only the current view.
