# Graph JSON: rules shared by every diagram type

Read this file plus `types/<diagramType>.md`. Together they are the complete authoring contract; do not read scripts, the bundled HTML, Viewer source or tests to learn rules. `graph-schema.md` is the maintainers' full reference.

## Shape

```json
{
  "meta": { "title": "…", "subtitle": "…", "sourceRef": "<repo>@<rev> or a document name", "scope": "…", "diagramType": "architecture", "locale": "zh-CN" },
  "groups": [{ "id": "g1", "label": "…", "kind": "<group kind>" }],
  "nodes": [{ "id": "n1", "label": "…", "kind": "<node kind>", "subtitle": "…", "groupId": "g1", "module": "order", "tags": ["core"], "facts": ["…"], "source": { "kind": "source", "file": "src/a.js", "lineStart": 10, "lineEnd": 24, "symbol": "createOrder" } }],
  "edges": [{ "id": "e1", "source": "n1", "target": "n2", "kind": "<edge kind>", "label": "…", "evidence": "source" }]
}
```

- Required: `meta.title`, `meta.sourceRef`, `meta.diagramType`, non-empty `nodes`, and `edges` (an array; it may be empty). `meta.locale`: `zh-CN` (default), `en`, `ru`, `pt`, `ja`, `de`, `es`.
- Write facts only: **no `position`, `size` or `route`** — layout is computed. Optional hints (`layout.rank` / `layout.order` on nodes, `layout.primaryPath` / `layout.participantOrder` on the graph) express an order that already exists in the source.
- IDs are unique non-empty strings; every edge endpoint names a node. Keep ids short and stable (`order-service`, `m3`).
- One graph per file by default. Only when the user asks for several views, wrap them as `{ "diagrams": [graph, graph] }`, each with a distinct `diagramType`.

## Nodes

- `kind` must be one of the type's node kinds (see the type file). No invented kinds, no colour fields.
- `label` is the real name from the source (class, route, table, service). `subtitle` is one line of responsibility. `facts` are short atomic statements; put uncertainty into the wording.
- `module`: the subsystem whose work the node performs (order, inventory, payment …). Reuse the exact same non-empty string for that subsystem across nodes and views; it drives card identity colours (chip, frame, faint wash, outgoing lines). It is not containment (`groupId` is). A node without `module` renders on the plain surface, so give every ordinary node one — steps, decisions, choices, start / end, and an external hub or broker that belongs to an evidenced channel; only `initial` / `final` and true outsiders (a caller, a debugger, an ops role) stay plain. Eight colour slots are hashed from the name, so two modules can share a colour (`module.slot-collision`): that is expected, the module label stays authoritative, and a module is never renamed for colour. When you introduce a new module name, `--module-slot <name>` shows its slot.
- `groupId` declares real containment in a `groups` entry; groups nest with `parentId`. Group `kind` must be one of the type's group kinds.
- The business centre: use the `business` kind where the type has one (architecture), otherwise add `"core"` to `tags`. Never invent a `core` kind.
- `fields` (ER, optional elsewhere): `[{ "name", "type", "key": "PK|FK|UK", "nullable": true|false }]`. `attributes` / `methods` (class): arrays of strings.

## Edges

- `kind` from the type's edge kinds. `label` names the action, message or data, not the kind.
- `evidence` (required): `source` (code you read), `code`, `config`, `schema`, `test`, `document`, `framework` (behaviour supplied by a framework, not visible in project code), `inference` (your deduction — label it, do not hide it).
- Omit relationships you cannot support. Do not add intermediate nodes to make notation look conventional.

## Source anchors

- `source.file` is repository-relative (no `..`, no absolute paths); `lineStart` / `lineEnd` are 1-based and inclusive; `symbol` is optional. The generator checks that the file exists and the range fits when `--repo-root` is passed.
- Anchor the node to where it is **defined** (class, function, table, service block), not to a call site. Edges carry no anchor of their own; their endpoint nodes do.
- Omit `source` for external actors, third-party systems and framework-owned runtime components. Never reuse an anchor from an example.
- Prefer one node per real component. Split by responsibility only when the source does.

## Composition

- The diagram must answer the question asked from the first reading view: one clear path, real component names, action / message / data names on edges. Choose the smallest set of nodes that still tells the truth; a large system is several views, not one huge graph.
- Groups are for real boundaries only. `module` is not decoration either: it states which business subsystem a node's work belongs to, and the same subsystem keeps the same name in every view.
- Full labels, never abbreviated to fit: the layout expands for text and wraps long labels.
- For a collection, reuse node ids and `module` values across views so the same component is recognisable everywhere.

## Delivery

Validate with `node scripts/validate-graph.mjs <graph.json> --input-only --repo-root <repo>` before generating; `SKILL.md` says how to repair errors and what the composition warnings mean. Errors name the element (`edge m7.order duplicates 7`, `node api unknown kind …`): fix that field with an edit; do not rewrite the whole file, do not delete facts to pass, do not bypass with `--force`.
