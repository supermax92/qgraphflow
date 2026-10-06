# architecture

Read with `graph-common.md`. Architecture offers three views:

- `meta.architectureView: "relations"` (default): component calls and dependencies.
- `capabilities`: platform capabilities and business integration, organized as platform foundation, capability inventory and application modules, with rules below.
- `engineering`: project organization above, one component's internal dependency layers below; test/support content may be parallel.

Choose from intent or an explicit template. The Viewer selects generated views.

| Node `kind` | Group `kind` | Edge `kind` |
| --- | --- | --- |
| `external`, `config`, `framework`, `security`, `service`, `business`, `data`, `failure`, `system`, `component`, `database` | `runtime`, `security`, `ownership`, `external` | `request`, `call`, `data`, `success`, `failure`, `framework`, `optional`, `depends`, `aggregates`, `inherits`, `provides` |

## Components and evidence

Use `business` for one or two business centres, `service` for entry points, `component` for internal modules, `data` for repositories/caches/queues as code, `database` for stores, `external` for systems outside the repo (no `source`), `security` for filters/auth, `config` for configuration, `framework` for framework-owned pieces, `failure` for explicit failure handling and `system` for a subsystem shown as one box.

`label` is the short component name used by the team (about 12 characters or 3 words), not a class list. `subtitle` names its main class, route, table or package verbatim; other details go in `facts` or overview body. Keep every component needed by the requested scope; dense relations may use separate views with complete coverage. Overview inventories have no fixed node limit. Repository-backed nodes need a `source` except externals/framework pieces; conceptual/document scopes must be explicit. Module names or compiler settings do not prove implementation status or runtime compatibility.

Edges follow calls/data: `request` HTTP/RPC, `call` in-process/service calls, `data` reads/writes, `success`/`failure` outcome branches, `framework` wiring, `optional` conditional paths. Label with the operation, usually up to 3 words; put details in `facts`. `site` anchors the call, construction or config that establishes repository evidence.

Direction is fixed: `aggregates` aggregator → member; `inherits` child → parent; `provides` provider → consumer; `depends` dependent → dependency. These are not runtime calls. Never reverse them to match the drawing's reading direction or delete them to simplify layout.

`groupId` / `parentId` encode real ownership: `runtime` process/JVM/container, `ownership` module/team, `security` trust zone, `external` outside systems. Draw an area-wide filter as a security boundary, not edges to every component. Nodes may be ungrouped.

## Overview structure

Either overview requires non-empty `layout.sections`. Each section has a unique `id`, non-empty `title`, and `mode`: `stack` (layers), `grid` (wrapping peers), `row` (parallel regions), or `note` (explanations). Non-notes have non-empty `items`: each exactly one `{ "nodeId": "..." }`, `{ "groupId": "..." }`, or nested section. Group references include real members and child groups. Every node is placed exactly once. IDs must not collide with nodes/groups. `detailOf` optionally names the overall component represented by a detail section. Sections describe presentation only; keep real ownership unchanged.

Optional section `text` contains paragraph strings and `source` uses the common anchor. A note requires non-empty text and no items. Nodes accept `overviewText` paragraph strings and `badges`: `{ "label": "JDK 17", "role": "version", "evidence": "document", "source": { ... } }`. Roles: `status`, `version`, `requirement`; evidence kinds and optional anchors follow common rules. Empty arrays are valid on nodes. Reference-image status/version/rules are document claims, not verified source.

Multiple architecture views require distinct `meta.viewId` on every architecture view; identities are globally unique, including legacy type IDs. Collections have 1–32 views; other types remain unique. Menu order follows type order, then input order, and displays titles.

## Minimal valid skeleton

```json
{
  "meta": { "title": "Platform integration", "diagramType": "architecture", "architectureView": "capabilities", "viewId": "platform-overview", "sourceRef": "Conceptual example", "locale": "en" },
  "nodes": [
    { "id": "platform", "label": "Platform", "kind": "system", "module": "platform", "overviewText": ["Shared application capabilities"], "badges": [] },
    { "id": "application", "label": "Application", "kind": "component", "module": "application", "overviewText": [], "badges": [] }
  ],
  "edges": [{ "id": "capabilities", "source": "platform", "target": "application", "kind": "provides", "label": "Shared capabilities", "evidence": "inference" }],
  "layout": { "sections": [
    { "id": "platform-layer", "title": "Platform", "mode": "stack", "items": [{ "nodeId": "platform" }] },
    { "id": "application-layer", "title": "Applications", "mode": "grid", "items": [{ "nodeId": "application" }] },
    { "id": "scope-note", "title": "Evidence scope", "mode": "note", "text": ["Conceptual structure, without source implementation claims."] }
  ] }
}
```

For relations, omit `architectureView` and `layout.sections`.

Generation computes all geometry. Unlock the Viewer to reorder peers within their current section/group; ownership cannot change by dragging. Details edit card titles/subtitles/body/badges and section titles/text. Apply relayouts; a failure keeps the form draft and last valid board. Cancel discards the draft. Save preserves complete structure/order; switching retains each view; reset affects only the current view. SVG names stay compatible.

## Frequent validation errors

Unknown kinds/evidence; missing groups/detail targets; duplicate IDs; missing/repeated node placement; incomplete geometry. Report blockers with scope coverage; never remove facts or reduce typography to pass.
