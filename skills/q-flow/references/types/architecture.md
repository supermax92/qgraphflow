# architecture

Read with `graph-common.md`. Architecture is drawn as one view: 组件关系架构图 — components, their calls and dependencies.

| Node `kind` | Group `kind` | Edge `kind` |
| --- | --- | --- |
| `external`, `config`, `framework`, `security`, `service`, `business`, `data`, `failure`, `system`, `component`, `database` | `runtime`, `security`, `ownership`, `external` | `request`, `call`, `data`, `success`, `failure`, `framework`, `optional`, `depends`, `aggregates`, `inherits`, `provides` |

## Components and evidence

Use `business` for one or two business centres, `service` for entry points, `component` for internal modules, `data` for repositories/caches/queues as code, `database` for stores, `external` for systems outside the repo (no `source`), `security` for filters/auth, `config` for configuration, `framework` for framework-owned pieces, `failure` for explicit failure handling and `system` for a subsystem shown as one box.

`label` names the component at the chosen level; `subtitle` states its responsibility. Use exact class/route/table/package names when relevant; supporting detail goes in `facts`. Keep conceptual scope explicit; names/config do not prove status or runtime compatibility.

Edges follow calls/data: `request` HTTP/RPC, `call` in-process/service calls, `data` reads/writes, `success`/`failure` outcome branches, `framework` wiring, `optional` conditional paths. Label with the operation, usually up to 3 words; put details in `facts`. `site` anchors the call, construction or config that establishes repository evidence.

Direction is fixed: `aggregates` aggregator → member; `inherits` child → parent; `provides` provider → consumer; `depends` dependent → dependency. These are not runtime calls. Never reverse them to match the drawing's reading direction or delete them to simplify layout.

`groupId` / `parentId` encode real ownership: `runtime` process/JVM/container, `ownership` module/team, `security` trust zone, `external` outside systems. Draw an area-wide filter as a security boundary, not edges to every component. Nodes may be ungrouped.

## Cards and layout

Nodes accept `badges`: `{ "label": "JDK 17", "role": "version", "evidence": "document", "source": { ... } }`. Roles: `status`, `version`, `requirement`; evidence kinds and optional anchors follow common rules. Cards show them as tags. Reference-image status/version/rules are document claims, not verified source.

List components nearly every card uses in `layout.sharedDependencies`: edges into them become caller tags, kept in data. `layout.rank` sets columns. Repeated views require distinct `meta.viewId`; collections have 1–32 views.

## Minimal valid skeleton

```json
{
  "meta": { "title": "Order service", "diagramType": "architecture", "sourceRef": "Conceptual example", "locale": "en" },
  "nodes": [
    { "id": "api", "label": "OrderController", "kind": "service", "module": "order", "subtitle": "Accepts order requests" },
    { "id": "store", "label": "OrderRepository", "kind": "data", "module": "order", "subtitle": "Persists orders" }
  ],
  "edges": [{ "id": "save", "source": "api", "target": "store", "kind": "data", "label": "save order", "evidence": "inference" }]
}
```

## Frequent validation errors

Reject unknown kinds/evidence, missing references/geometry and duplicate/missing placements. Report blockers; never drop facts or shrink text.
