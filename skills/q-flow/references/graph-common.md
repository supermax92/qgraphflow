# Graph JSON: rules shared by every diagram type

Read this and `types/<diagramType>.md` for authoring; `graph-schema.md` is for maintainers.

## Granularity

Before Evidence, honor the user's scope, depth, required facts, node budget and view count. Minimal styling does not reduce content; "minimal styling, every call" keeps every requested call.

- **Default system overview:** for system/repository architecture, use business modules (monolith) or services (distributed), one level below the system, plus relevant callers, external systems and shared infrastructure. Aim for **8–12 visible nodes**; **over 15** prompts review of real domain boundaries or a proposed split. Soft targets only: never pad small systems or drop necessary nodes.
- **Minimal:** use the fewest elements that answer the question. Aggregate real modules/responsibilities only; retain required dependencies, boundaries, decisions and outcomes. Put supporting explanation in `facts`. State aggregation/exclusions in `meta.scope`; never turn an indirect path into a direct-call claim. An explicit success-path-only request may exclude failure paths.
- **Detailed:** follow the requested depth; if unspecified, expand relevant units one level beyond the default. Include in-scope branches, errors, retries, guards, calls, fields or members as the type requires. Overview/type size suggestions do not cap detail. Requested topology must be visible, not only in `facts` or notes.

Other defaults: module → components/classes; flow → steps/functions; entity set → tables. Preserve type semantics: sequence nodes are lifelines, calls are messages. Keep peers at comparable levels; show broader context as boundaries/external participants. Record level, coverage and exclusions in `meta.scope`. If a strict user limit conflicts with required coverage, explain the tradeoff; never silently omit facts or invent aggregation.

Default to one graph; overview plus detail requests multiple views. Propose splits at real boundaries; honor explicit single-view requests. Repeated architecture needs unique `meta.viewId`; repeated other types need separate outputs. Together, views cover all requested facts with stable IDs and boundary handoffs.

Before layout, map every explicit requirement to visible elements and evidence. Minimal: every element serves the question. Detailed: audit coverage at the requested depth. Report evidence gaps. Simplify during scoped authoring; never remove chosen facts to pass layout/validation.

## Shape

- Required: `meta.title`, `meta.sourceRef`, `meta.diagramType`, non-empty `nodes`, and an `edges` array (may be empty). Optional `groups` hold boundaries. Collections: `{ "diagrams": [graph, graph] }`, 1–32 views.
- `meta.locale`: user's language, `zh-CN` (default), `en`, `ru`, `pt`, `ja`, `de`, `es`. It translates only the UI: author all prose, labels and guards in that language. Keep identifiers, literal values and standard notation verbatim; samples are placeholders.
- Facts only: **no `position`, `size` or `route`**. Node `layout.rank` / `layout.order`, graph `layout.primaryPath` / `layout.participantOrder` express existing source order only.
- IDs are unique, stable and non-empty; edge `source` / `target` name nodes.

## Nodes

- `kind`: from the type page; no invented kinds or colour fields. `label`: real source name; `subtitle`: responsibility; `facts`: short atomic statements with uncertainty explicit.
- `module`: subsystem doing the work, consistently named across views. Assign every ordinary node, including steps/start/end and evidenced hubs/brokers; only `initial` / `final` and true outsiders may stay plain. Colours hash into five slots; modules are never renamed for colour. A node without `module` renders on the plain surface. Module is not ownership.
- `groupId` names a real containing group; groups nest via `parentId` and use the type's group kinds. One node per component at the chosen level; split responsibilities only when source does.
- Business centre: `business` kind where supported, otherwise `"core"` in `tags`, never a `core` kind.

## Edges

- `kind`: from the type page. `label`: action, message or data.
- Required `evidence`: `source` (read code), `code`, `config`, `schema`, `test`, `document`, `framework` (framework-owned behaviour), `inference` (explicitly labelled deduction).
- Omit unsupported relationships; add no intermediate nodes just for conventional notation.

## Source anchors

- Node `source` / edge `site`: `{ "file": "src/a.js", "lineStart": 10, "lineEnd": 24, "symbol": "createOrder" }`. Node source also has `kind` (`source`, `config`, etc.). Files are repository-relative, without `..`; lines are 1-based, inclusive. With `--repo-root`, files must exist and ranges fit.
- Optional `symbol` is an exact identifier, not prose; its last segment must occur as a whole word in the range. `--fix` re-anchors it only if unique in the file.
- Anchor nodes at definitions, edges at the call/write/key/inheritance/state assignment establishing the relation; edge symbol names the target. `source`, `code`, `config`, `schema`, `test` edges require `site`; sequence returns follow their calls. `framework`, `document`, `inference` need none. Missing sites produce `edge.site-missing` once any site exists.
- External actors, third-party systems and framework runtime nodes need no `source`. Never copy example anchors.

## Composition

- First view answers the question with real names and labelled relationships.
- `meta.notes`: at most 6 strings of 120 characters, for risks, doc/code contradictions, unverified claims or exclusions the reader must see first. Name identifiers; avoid repeating drawn edges. Shown in "Key points" and below SVG.
- Templates measure full text and use compact structure, outline ports, orthogonal routes and independent labels. Preserve order, alternatives, hierarchy, cardinalities and ownership. Bounded search cannot prove crossings unavoidable.

## Delivery

Validate with `node scripts/validate-graph.mjs <graph.json> --input-only --repo-root <repo>` before generating; `SKILL.md` covers repair and warnings.
