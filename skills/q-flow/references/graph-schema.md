# Graph JSON contract

`scripts/generate-viewer.mjs` accepts either one `Graph` or a graph collection. Older graphs without `meta.diagramType` remain valid and render as `architecture`.
`strict-v1`: generation defaults to `--layout auto` and accepts semantic inputs without positions or sizes. Declare real ownership with node `groupId` and group `parentId`; color `module` is not ownership. Optional node `layout.rank` / `layout.order`, graph `layout.primaryPath` / `layout.participantOrder` express existing order only. `--layout preserve` checks existing geometry without rearranging it. Ambiguous old containment requires an explicit author decision. `--input-only` checks semantics; source, geometry and browser rendering have separate statuses. `--force` only permits replacing outputs and never bypasses quality checks.

Flowchart main paths must run top-to-bottom, with left/right branches and outside feedback routes. Auto, strict preservation and image exports apply the same rule. Optional `primaryPath` declares the main order; an unambiguous simple chain is checked even without it. Horizontal main paths are rejected regardless of node count; side branches and feedback edges may still run sideways or upwards.


```json
{
  "meta": {
    "title": "Required title",
    "diagramType": "architecture",
    "subtitle": "Optional supporting line",
    "sourceRef": "Branch, commit, document version, or evidence scope",
    "scope": "Verified evidence scope",
    "generatedAt": "ISO-8601 timestamp"
  },
  "groups": [
    {
      "id": "runtime-boundary",
      "label": "Consumer application JVM",
      "kind": "runtime",
      "position": { "x": 40, "y": 80 },
      "size": { "width": 1440, "height": 620 }
    }
  ],
  "nodes": [
    {
      "id": "jwt-decoder",
      "label": "NimbusJwtDecoder",
      "subtitle": "Verify and decode JWT",
      "module": "Identity",
      "kind": "security",
      "position": { "x": 720, "y": 220 },
      "size": { "width": 220, "height": 120 },
      "source": {
        "kind": "source",
        "file": "module/src/main/java/example/Config.java",
        "lineStart": 111,
        "lineEnd": 130,
        "symbol": "jwtDecoder"
      },
      "facts": ["Built from issuer-uri"],
      "tags": ["JWT", "Spring Security"]
    }
  ],
  "edges": [
    {
      "id": "decode-token",
      "source": "bearer-filter",
      "target": "jwt-decoder",
      "label": "decode and verify",
      "module": "Identity",
      "kind": "call",
      "evidence": "framework",
      "route": {
        "via": [{ "x": 640, "y": 180 }],
        "labelAt": { "x": 640, "y": 156 }
      }
    }
  ]
}
```

Use one graph by default; a standalone page has no diagram-type menu. For a requested multi-diagram viewer, wrap 1–9 graphs in `diagrams`. Each graph must use a unique `meta.diagramType`; the toolbar view menu follows the fixed order `architecture`, `flowchart`, `sequence`, `er`, `deployment`, `class`, `state`, `usecase`, `dataflow` regardless of input order. The view menu lists the requested types vertically.

```json
{
  "diagrams": [
    { "meta": { "title": "System", "diagramType": "architecture", "sourceRef": "main" }, "nodes": [], "edges": [] },
    { "meta": { "title": "Request", "diagramType": "sequence", "sourceRef": "main" }, "nodes": [], "edges": [] }
  ]
}
```

The abbreviated graphs above show only the wrapper; every graph still follows the complete contract and requires non-empty nodes.

## Common fields

- Required: `meta.title`, `meta.sourceRef`, non-empty `nodes`, and `edges`.
- `meta`, nodes, edges, groups and source anchors are objects; `nodes`, `edges`, and optional `groups` are arrays of objects. Invalid containers are rejected before layout or output generation.
- Optional `meta.subtitle`, `meta.scope`, node `subtitle`, `source.symbol`, and edge `label` are strings. Optional node and edge `module` values are non-empty strings: reuse the exact same value for the same business module across every graph in a collection; do not store literal colors. Node `facts`, `tags`, `attributes`, and `methods` are arrays of non-empty strings. These rules apply to every diagram type.
- Optional node `fields` is an array of objects with non-empty string `name` and `type`, optional `key` (`PK`, `FK`, `UK`) and boolean `nullable`; ER requires at least one field. Other types can expose these fields in search and details.
- `meta.diagramType`: `architecture`, `flowchart`, `sequence`, `er`, `deployment`, `class`, `state`, `usecase`, or `dataflow`.
- `meta.locale`: optional Viewer language: `en`, `zh-CN` (default), `ru`, `pt`, `ja`, `de`, or `es`; `ko` and `fr` remain supported for existing graphs. This controls built-in interface and export labels; author titles, node labels, facts and relationship text in the desired language separately. Code identifiers and standard notation remain unchanged. In a collection, each diagram uses its own locale.
- IDs are unique non-empty strings. Every edge endpoint names a node.
- In compiled output or `--layout preserve`, every node and group requires finite non-negative `position` and positive `size`; semantic `auto` input may omit them.
- Class associations, aggregation and composition may declare `sourceMultiplicity` / `targetMultiplicity`: `*`, a non-negative integer, or an ascending range such as `0..1` or `1..*`. Inheritance, implementation and dependency reject these fields. `dataflow` preserves declared data flows between real components, including direct external-to-store, store-to-store and external-to-external flows. Gane–Sarson-inspired symbols distinguish external entities, processes and stores; this is not strict process-only DFD modeling. Do not invent intermediate processes or reclassify components to satisfy notation.
- Edge `evidence`: `source`, `code`, `config`, `schema`, `test`, `document`, `framework`, or `inference`.
- Edge `route` is optional. `via` contains graph-space waypoints and `labelAt` fixes the graph-space label center; omit both when automatic orthogonal routing is clear.
- Every `route.via` and `route.labelAt` coordinate must be a finite non-negative number. The router inserts orthogonal elbows between waypoints and keeps the first and last connection anchored to the current node positions.
- Optional node `source.kind` uses the same evidence values. `source.file` and `source.lineStart` identify the exact anchor.
- With `--repo-root <directory>`, validation and generation read every node's `source.file` as repository-relative UTF-8 text and check the inclusive line range. Absolute paths, parent traversal, directories, binary files and symlinks escaping the root are rejected. Repeated references share one file read. Without the root, receipts explicitly mark existing source anchors `skipped`; without anchors they report `not-applicable`. These checks cover the local working tree, not `sourceRef` revision identity, symbol resolution or claim correctness.
- To emphasize the business center, use the existing `business` kind where supported, or include `core` or `business` in `tags` (matched case-insensitively). Keep the diagram's legal node kind; `core` is not a new kind or schema field.
- The cool-neutral visual system is a Viewer presentation rule. Color, typography, and core styling require no new graph fields. The order-fulfillment preview model is example content, not a default dataset or evidence source.

Legacy `playback` metadata is ignored. The Viewer has no automatic or stepped playback; directed-edge motion is a separate visual cue and does not imply execution order.

## Saving Viewer edits

Switching diagram types retains each graph's saved text and positions within the open page. Reset restores only the active graph's embedded original content. **Save Graph JSON** saves the entire collection (or the original single-graph shape), including edits in other views, metadata and source anchors. Supporting browsers let the user choose a `.json` file to write; other browsers download `graph.json`. Cancelling or failing a save keeps all page edits.

Reloading the HTML still starts from its embedded data. Keep the saved JSON and regenerate into a new output directory to reopen the edited model permanently. Saving does not bypass validation: manually edited labels or positions can still need layout corrections before regeneration. The browser does not reverify source anchors; rerun both CLI commands with `--repo-root` for source-backed delivery.

## Routing and spacing

- Initial canvas budgets are 2400×1600 graph units for architecture / er / deployment / class / usecase / dataflow, 1600×2400 for flowchart / state, and content-adaptive for sequence. These are starting budgets, not minimum borders, export resolutions or aspect-ratio requirements. Preserve full text and type semantics; expand for spacing and routes, keep small graphs compact, and never shrink text or add empty padding to match a ratio. Aim for 96–160 units between nodes, full label width plus 48 for corridors, 24 around labels and 48 below group headings. Budgets alone do not rearrange existing geometry.
- Full-size text is required for generation and image export. Legacy compact geometry remains readable as a JSON draft and may require recompilation.
- Parallel, fan-out, and fan-in relationships receive automatic 24-pixel lanes and may share at most 12 pixels near an endpoint; the longer ER symbol clearance is not permission to merge routes.
- A node side must be long enough to hold its automatic lanes; enlarge the node or provide route hints when validation reports endpoint-side overflow.
- For non-self hinted routes, the first/last waypoint determines each endpoint side and its projected border position. Keep a 28-pixel outward straight section for ER cardinality symbols and a 12-pixel section for other diagrams. Waypoints must stay outside all node interiors, including the endpoints.
- Self-loops default to a 48-by-32-pixel route outside the node's right edge. Use `route.via` or `route.labelAt` only when that area is occupied.
- Keep full text at 20/16/14px. Minimum clearances: nodes 96px; labels to nodes/labels 24px; labels to unrelated edges 6px; group heading 48px, other insets 32px; sibling groups 64px; parallel channels 24px; straight endpoint segments 12px, ER 28px. Readable point crossings, including nonplanar graphs, are allowed. Prefer fewer repeated crossings between the same pair and reject long collinear overlaps. Canvas ratios are informational; never remove relationships or shrink text to pass.
- Sequence participant centers must be at least `max(160, estimated message width + 32)` pixels apart.

## Diagram-specific notation

| `diagramType` | Node `kind` | Group `kind` | Edge `kind` |
| --- | --- | --- | --- |
| `architecture` | `external`, `config`, `framework`, `security`, `service`, `business`, `data`, `failure`, `system`, `component`, `database` | `runtime`, `security`, `ownership`, `external` | `request`, `call`, `data`, `success`, `failure`, `framework`, `optional`, `depends` |
| `flowchart` | `start`, `end`, `process`, `decision`, `input`, `output`, `subprocess` | none | `flow`, `yes`, `no`, `success`, `failure` |
| `sequence` | `actor`, `participant`, `external`, `service`, `database` | `alt`, `opt`, `loop`, `par` | `sync`, `async`, `return` |
| `er` | `entity` | none | `relationship` |
| `deployment` | `device`, `node`, `container`, `artifact`, `service`, `database`, `external` | `host`, `network`, `cluster`, `namespace` | `deploy`, `network`, `depends` |
| `class` | `class`, `interface`, `abstract` | none | `association`, `inheritance`, `implementation`, `composition`, `aggregation`, `dependency` |
| `state` | `initial`, `state`, `final`, `choice` | none | `transition` |
| `usecase` | `actor`, `usecase` | `system` | `association`, `include`, `extend` |
| `dataflow` | `external`, `process`, `dataStore` | `ownership`, `external` | `data` |

### Sequence

Sequence `order` retains semantic order; generated `route.messageY` supplies the actual vertical coordinate. Legacy routes without it keep the 54px fallback. Automatic layout requires explicit fragment operands and never invents conditions. Participant subtitles, guards and bodies must be complete. Invalid geometry remains an editable/saveable JSON draft; SVG/PNG export checks the current snapshot and actual glyph bounds after fonts load. PNG rejects blank encoding or sizes above 32767px / 64 million pixels, without reducing resolution.

```json
{ "id": "request", "source": "browser", "target": "api", "label": "POST /orders", "kind": "sync", "order": 1, "evidence": "source" }
```


Sequence `alt` optionally accepts `operands`: `[{"guard":"SignalR","edgeIds":["m10"]},{"guard":"HTTP","edgeIds":["m11","m12"]}]`. If supplied, at least two branches are required, with nonempty guards and valid, unique message IDs in ordered, non-interleaving order ranges. No visually enclosed message may be omitted. Guards are escaped text, never code. Page/export share guard and separator geometry; insufficient space is an error, not an implicit frame expansion. Legacy alt without operands remains loadable/saveable and visibly reports unspecified branch conditions with a validation warning. Text/position edits preserve operands.

Sync has a filled arrow, async an open V, return an open V plus dashes; Sync stays solid; framework/inference evidence can still dash async messages, while returns remain dashed. Participant subtitles are drawn directly, in full; legacy drafts may retain ellipsis but cannot pass strict export. Actor heads are 130px with a subtitle, otherwise108px; ordinary heads stay72px. Authored lifeline ends and message order remain unchanged. Desktop defaults show overview; directory/search/keyboard locate and mobile (≤700px) defaults use local views at zoom≥.75. Explicit fit always shows the whole diagram.

### ER

Every entity requires a non-empty `fields` array. Field `key` may be `PK`, `FK`, or `UK`. A relationship requires both endpoint cardinalities: `1`, `0..1`, `*`, `1..*`, or `0..*`.

Size an entity for a 72px header, approximately 32px per field, and bottom padding. Grow its key/name/type columns for 16px field names and 14px types and key badges, especially with long identifiers. Leave 28px of straight route outside each entity for cardinality symbols; the cardinality values in the JSON remain unchanged.

```json
{
  "id": "orders",
  "label": "orders",
  "kind": "entity",
  "fields": [
    { "name": "id", "type": "bigint", "key": "PK", "nullable": false },
    { "name": "user_id", "type": "bigint", "key": "FK", "nullable": false }
  ],
  "position": { "x": 80, "y": 120 },
  "size": { "width": 260, "height": 170 }
}
```

```json
{ "id": "user-orders", "source": "users", "target": "orders", "kind": "relationship", "sourceCardinality": "1", "targetCardinality": "0..*", "evidence": "schema" }
```

### Class

Class nodes may contain string arrays `attributes` and `methods`. Interface and abstract names are rendered with their stereotype. Allow a 68px header, 28px member rows at 16px font size, and both compartments' padding; grow width and height to fit the name, stereotype, and all members without clipping or shrinking. Inheritance/implementation and composition/aggregation use their own triangle and diamond markers without changing the existing edge kinds.

### State

Transition edges may contain `guard` and `action`. The visible label is assembled as `label [guard] / action`.

### Source anchors

Use `source` only when the node maps to a precise repository or supplied-document location. Omit it for external actors and framework-owned runtime components. Keep `facts` short and atomic, and put uncertainty in the wording as well as the evidence kind.

For an explicitly requested conceptual example, describe the relevant business model in `facts`, label inferred relationships as `inference`, and name that scope in metadata. Do not fabricate source paths or reuse preview-document anchors for another graph. Normal generation still writes exactly `index.html` and `graph.json`.

### Execution, pairing and nested fragments

See `examples/sequence-execution.graph.json` for the complete conceptual example (five participants, six call/return pairs, six executions). These optional fields require a Viewer built with sequence execution support; older input remains valid.

A return declares `"replyTo": "call-id"`. It must reference an earlier sync/async call with reversed endpoints, in the same operand path, with at most one explicit return per call. Merge alternative outcomes before that return. Unpaired legacy messages stay legal. Paired labels display `C1` / `↩ C1` independently of editable text. Call and return share a color; nested calls form separate groups. Eight group colors are reused deterministically per theme; larger graphs retain unique pair IDs even when colors repeat. Node module colors are independent.

```json
"executions": [{
  "id": "risk-work",
  "participantId": "risk",
  "start": { "edgeId": "check", "at": "receive" },
  "end": { "edgeId": "checked", "at": "send" }
}]
```

Each execution uses message `send`/`receive` endpoints belonging to its participant, start before end. Optional `parentId` declares a same-participant enclosing execution. Siblings cannot overlap. Self-calls connect outer send to inner receive; self-returns end the inner bar at send, not receive. Bars are derived from routes and are not separately draggable.

Structured fragments use `operands: [{id, edgeIds, guard?, label?, body?}]`:

- `alt`: at least two guarded operands; optional `else` occurs once, last.
- `opt`: one guarded operand.
- `loop`: one guarded operand plus `loop: {min, max}`; non-negative integer min, max ≥ min or `"*"`. The condition is displayed, never evaluated.
- `par`: at least two labeled operands, separated visibly and joined at the frame end. Message order is local to each branch; vertical branch order is not runtime order.

A child group specifies `parentId` and `parentOperandId`. For example, a loop operand `{id:"attempt", guard:"attempt < 3", edgeIds:["call","reply"]}` owns an alt group via `{parentId:"retry", parentOperandId:"attempt"}`. An opt operand `{id:"reserved", guard:"reserved", edgeIds:[]}` can own a par group in the same way. List a message directly in only one operand; parents inherit child membership. An empty `edgeIds` array requires non-empty plain-text `body` or a child fragment. Guards and body text are escaped, not executable. Reserve authored frame space for titles, guards, text-only branches, message labels and nested frames; validation rejects cycles, crossing frames, incorrect ownership and collisions.

Legacy alt without operand IDs and old unstructured opt/loop remain readable and save without forced migration. Missing conditions are never invented. Sync messages use a solid baseline even for conceptual/inference evidence; evidence remains in metadata and details. Return messages keep dashed open arrows. JSON editing/download, SVG and PNG preserve the same execution bounds, pairing, fragments and group colors; exports remain static.
