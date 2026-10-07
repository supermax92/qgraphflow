# architecture

Read with `graph-common.md`. Architecture offers three views:

- `meta.architectureView: "relations"` (default): 组件关系架构图 — calls and dependencies.
- `capabilities`: 平台能力架构图 — platform foundation, capabilities, business integration and rules.
- `engineering`: 工程分层架构图 — project organization and one component's internal layers, with parallel support.

| Node `kind` | Group `kind` | Edge `kind` |
| --- | --- | --- |
| `external`, `config`, `framework`, `security`, `service`, `business`, `data`, `failure`, `system`, `component`, `database` | `runtime`, `security`, `ownership`, `external` | `request`, `call`, `data`, `success`, `failure`, `framework`, `optional`, `depends`, `aggregates`, `inherits`, `provides` |

## Components and evidence

Use `business` for one or two business centres, `service` for entry points, `component` for internal modules, `data` for repositories/caches/queues as code, `database` for stores, `external` for systems outside the repo (no `source`), `security` for filters/auth, `config` for configuration, `framework` for framework-owned pieces, `failure` for explicit failure handling and `system` for a subsystem shown as one box.

`label` names the component at the chosen level; `subtitle` states its responsibility. Use exact class/route/table/package names when relevant; supporting detail goes in `facts` or overview body. Keep conceptual scope explicit; names/config do not prove status or runtime compatibility.

Edges follow calls/data: `request` HTTP/RPC, `call` in-process/service calls, `data` reads/writes, `success`/`failure` outcome branches, `framework` wiring, `optional` conditional paths. Label with the operation, usually up to 3 words; put details in `facts`. `site` anchors the call, construction or config that establishes repository evidence.

Direction is fixed: `aggregates` aggregator → member; `inherits` child → parent; `provides` provider → consumer; `depends` dependent → dependency. These are not runtime calls. Never reverse them to match the drawing's reading direction or delete them to simplify layout.

`groupId` / `parentId` encode real ownership: `runtime` process/JVM/container, `ownership` module/team, `security` trust zone, `external` outside systems. Draw an area-wide filter as a security boundary, not edges to every component. Nodes may be ungrouped.

## Overview structure

Either overview requires non-empty `layout.sections`. Each section has a unique `id`, non-empty `title`, and `mode`: `stack` (layers), `grid` (wrapping peers), `row` (parallel regions), or `note` (explanations). Non-notes have non-empty `items`: each exactly one `{ "nodeId": "..." }`, `{ "groupId": "..." }`, or nested section. Group references include real members and child groups. Every node is placed exactly once. IDs must not collide with nodes/groups. `detailOf` optionally names the overall component represented by a detail section. Sections describe presentation only; keep real ownership unchanged.

Optional section `text` contains paragraph strings and `source` uses the common anchor. A note requires non-empty text and no items. Nodes accept `overviewText` paragraph strings and `badges`: `{ "label": "JDK 17", "role": "version", "evidence": "document", "source": { ... } }`. Roles: `status`, `version`, `requirement`; evidence kinds and optional anchors follow common rules. Empty arrays are valid on nodes. Reference-image status/version/rules are document claims, not verified source.

Repeated architecture views require distinct `meta.viewId`; all identities must be unique, including legacy type IDs. Collections have 1–32 views; other types stay unique. Menus show capabilities/engineering/relations as independent architecture types, adding titles for repeated templates.

Use reference bands/cards/badges. Section `tone` / node `overviewTone`: `white`, `subtle`, `blue`, `green`, `lavender`, `plain`; section `frame`: `solid`, `dashed`, `none`; grid `columns`: 1–16; row `weights`: positive numbers per item (detail/support `[2,1]`); node `overviewAccent`: boolean stripe. Use tones and grids to clarify each fictional or public model. Style is not evidence.

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
    { "id": "platform-layer", "title": "Platform", "mode": "stack", "tone": "blue", "items": [{ "nodeId": "platform" }] },
    { "id": "application-layer", "title": "Applications", "mode": "grid", "tone": "green", "items": [{ "nodeId": "application" }] },
    { "id": "scope-note", "title": "Evidence scope", "mode": "note", "text": ["Conceptual structure, without source implementation claims."] }
  ] }
}
```

For relations, omit `architectureView` and `layout.sections`.

Generation measures full text. Unlock to reorder peers within the same section/group. Details edit body/badges/sections; apply relayouts, failure keeps the draft/valid canvas, cancel discards. Save keeps order/style; switch keeps each view; reset affects only the current view.

## Frequent validation errors

Reject unknown kinds/evidence, missing references/geometry and duplicate/missing placements. Report blockers; never drop facts or shrink text.

`layout.overviewConnections`: `within-category` (default) or `all`; categories are deepest sections. Page/export hide cross-category edges by default, retaining JSON/details. To show required cross-category dependencies, use `all` or relations.
