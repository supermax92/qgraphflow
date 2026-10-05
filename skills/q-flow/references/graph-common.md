# Graph JSON: rules shared by every diagram type

Read this file plus `types/<diagramType>.md`. Together they are the complete authoring contract. `graph-schema.md` is the maintainers' full reference.

## Shape

```json
{
  "meta": { "title": "…", "subtitle": "…", "sourceRef": "<repo>@<rev> or a document name", "scope": "…", "diagramType": "architecture", "locale": "zh-CN", "notes": ["…"] },
  "groups": [{ "id": "g1", "label": "…", "kind": "<group kind>" }],
  "nodes": [{ "id": "n1", "label": "…", "kind": "<node kind>", "subtitle": "…", "groupId": "g1", "module": "order", "tags": ["core"], "facts": ["…"], "source": { "kind": "source", "file": "src/a.js", "lineStart": 10, "lineEnd": 24, "symbol": "createOrder" } }],
  "edges": [{ "id": "e1", "source": "n1", "target": "n2", "kind": "<edge kind>", "label": "…", "evidence": "source", "site": { "file": "src/b.js", "lineStart": 31, "symbol": "reserve" } }]
}
```

- Required: `meta.title`, `meta.sourceRef`, `meta.diagramType`, non-empty `nodes`, and `edges` (an array; it may be empty). `meta.locale` is the user's language: `zh-CN` (default), `en`, `ru`, `pt`, `ja`, `de`, `es`.
- `meta.locale` only translates the Viewer's interface. Write every readable text yourself in that language — title, subtitle, scope, `notes`, `facts`, edge labels (relationship verbs, branch words), guards; the type pages' English sample text is a placeholder. Identifiers (class, table, field, method, route, config key, literal value) and standard notation (cardinalities, `«include»`, `alt` / `loop`) stay verbatim.
- Write facts only: **no `position`, `size` or `route`** — layout is computed. Optional hints (`layout.rank` / `layout.order` on nodes, `layout.primaryPath` / `layout.participantOrder` on the graph) express an order that already exists in the source.
- IDs are unique non-empty strings; every edge endpoint names a node. Keep ids short and stable.
- One graph per file by default. Only when the user asks for several views, wrap them as `{ "diagrams": [graph, graph] }`, each with a distinct `diagramType`.

## Nodes

- `kind` must be one of the type's node kinds (see the type file). No invented kinds, no colour fields.
- `label` is the real name from the source (class, route, table, service). `subtitle` is one line of responsibility. `facts` are short atomic statements; put uncertainty into the wording.
- `module`: the subsystem whose work the node performs (order, inventory, payment …). Reuse the exact same non-empty string for that subsystem across nodes and views; it drives card identity colours. It is not containment (`groupId` is). A node without `module` renders on the plain surface, so give every ordinary node one — steps, decisions, choices, start / end, and an external hub or broker that belongs to an evidenced channel; only `initial` / `final` and true outsiders (a caller, a debugger, an ops role) stay plain. Colours hash into eight slots, so two modules may share one: the module label stays authoritative and a module is never renamed for colour.
- `groupId` declares real containment in a `groups` entry; groups nest with `parentId`. Group `kind` must be one of the type's group kinds.
- The business centre: use the `business` kind where the type has one (architecture), otherwise add `"core"` to `tags`. Never invent a `core` kind.

## Edges

- `kind` from the type's edge kinds. `label` names the action, message or data, not the kind.
- `evidence` (required): `source` (code you read), `code`, `config`, `schema`, `test`, `document`, `framework` (behaviour supplied by a framework, not visible in project code), `inference` (your deduction — label it, do not hide it).
- Omit relationships you cannot support. Do not add intermediate nodes to make notation look conventional.

## Source anchors

- `source.file` is repository-relative (no `..`, no absolute paths); `lineStart` / `lineEnd` are 1-based and inclusive; `symbol` is optional. With `--repo-root` the file must exist and the range fit. A node `source` and an edge `site` share this shape and these checks.
- `symbol` is the name exactly as written at the anchor (`OrderService.createOrder`, `orders`), never a description. With `--repo-root`, its last segment must appear as a whole word inside the range, so a moved, renamed or deleted line fails validation; `--fix` re-anchors a name found once in its file.
- Anchor a node to where it is **defined** (class, function, table, service block). Anchor an edge's `site` to the line that makes it hold: the call, write, foreign key, `extends` clause or state assignment, `symbol` naming the target. Every edge with `source`, `code`, `config`, `schema` or `test` evidence gets one; a sequence `return` follows its call, and `framework`, `document` and `inference` edges need none. Once one edge has a `site`, a missing one draws `edge.site-missing`.
- Omit `source` for external actors, third-party systems and framework-owned runtime components. Never reuse an anchor from an example.
- Prefer one node per real component. Split by responsibility only when the source does.

## Composition

- The diagram must answer the question asked from the first reading view: one clear path, real component names, action / message / data names on edges. Choose the smallest set of nodes that still tells the truth; a large system is several views, not one huge graph.
- Groups are for real boundaries only.
- `meta.notes` (optional, max 6 items of 120 characters): what a reader must see before opening a node and the picture cannot draw — a defect or risk found, code that contradicts its docs, a claim you could not verify, scope left out. One sentence each, naming the identifier; never repeat a drawn edge. Shown as the "Key points" card and under the SVG.
- Full labels, never abbreviated to fit: the layout expands for text and wraps long labels.
- For a collection, reuse node ids and `module` values across views so a component stays recognisable.

## Delivery

Validate with `node scripts/validate-graph.mjs <graph.json> --input-only --repo-root <repo>` before generating; `SKILL.md` covers repair and warnings.
