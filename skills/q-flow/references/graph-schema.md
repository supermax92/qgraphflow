# Graph JSON contract

`scripts/generate-viewer.mjs` accepts either one `Graph` or a graph collection. Older graphs without `meta.diagramType` remain valid and render as `architecture`.

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

Use one graph by default; a standalone page has no diagram-type menu. For a requested multi-diagram viewer, wrap 1–9 graphs in `diagrams`. Each graph must use a unique `meta.diagramType`; a three-column navigation grid follows the fixed order `architecture`, `flowchart`, `sequence`, `er`, `deployment`, `class`, `state`, `usecase`, `dataflow` regardless of input order. All nine types form a 3×3 menu.

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
- `meta.diagramType`: `architecture`, `flowchart`, `sequence`, `er`, `deployment`, `class`, `state`, `usecase`, or `dataflow`.
- `meta.locale`: optional Viewer language: `en`, `zh-CN` (default), `ja`, `ko`, `de`, `fr`, or `es`. This controls built-in interface and export labels; author titles, node labels, facts and relationship text in the desired language separately. Code identifiers and standard notation remain unchanged. In a collection, each diagram uses its own locale.
- IDs are unique non-empty strings. Every edge endpoint names a node.
- Every node and group has finite non-negative `position` and `size` values.
- Edge `evidence`: `source`, `code`, `config`, `schema`, `test`, `document`, `framework`, or `inference`.
- Edge `route` is optional. `via` contains graph-space waypoints and `labelAt` fixes the graph-space label center; omit both when automatic orthogonal routing is clear.
- Every `route.via` and `route.labelAt` coordinate must be a finite non-negative number. The router inserts orthogonal elbows between waypoints and keeps the first and last connection anchored to the current node positions.
- Optional node `source.kind` uses the same evidence values. `source.file` and `source.lineStart` identify the exact anchor.
- To emphasize the business center, use the existing `business` kind where supported, or include `core` or `business` in `tags` (matched case-insensitively). Keep the diagram's legal node kind; `core` is not a new kind or schema field.
- The warm-neutral visual system is a Viewer presentation rule. Color, typography, and core styling require no new graph fields. The order-fulfillment preview model is example content, not a default dataset or evidence source.

## Playback

A graph may specify ordered playback by listing existing edge IDs. Author this path for flowcharts, data-flow diagrams, and state progressions when the source supports an order. With no explicit path, sequence diagrams use message `order`; other diagrams provide a node-directory reading tour marked as not execution order. Step controls remain available for legacy inputs without `playback`; no inferred path is written back into graph data. Selecting pauses steps only, preserving the current step and completed record. Directed-edge motion has a separate switch, and reduced motion overrides it.

```json
{
  "playback": {
    "edgeIds": ["receive-request", "validate-order", "persist-order"]
  }
}
```

- `playback.edgeIds` must be a non-empty array of non-blank edge IDs from the same graph.
- Playback changes presentation only; it does not modify graph evidence or exported SVG/PNG styling.

## Routing and spacing

- Leave at least 64 graph pixels between node rectangles. A labeled corridor must fit the complete estimated label width plus 24 pixels.
- Size ordinary cards for 20px titles, 16px body/field/member/edge text, and 14px secondary text. Enlarge individual boxes and corridors for actual content; uniformly scaling the whole layout cancels the gain when fitted. These are authoring recommendations, not new validation minimums; old compact cards and specialized symbols remain compatible. The initial reading view has a 0.9 minimum zoom; explicit fit-all remains available.
- Parallel, fan-out, and fan-in relationships receive automatic 24-pixel lanes and may share at most 12 pixels near an endpoint; the longer ER symbol clearance is not permission to merge routes.
- A node side must be long enough to hold its automatic lanes; enlarge the node or provide route hints when validation reports endpoint-side overflow.
- For non-self hinted routes, the first/last waypoint determines each endpoint side and its projected border position. Keep a 28-pixel outward straight section for ER cardinality symbols and a 12-pixel section for other diagrams. Waypoints must stay outside all node interiors, including the endpoints.
- Self-loops default to a 48-by-32-pixel route outside the node's right edge. Use `route.via` or `route.labelAt` only when that area is occupied.
- Validation rejects node overlap, labels over nodes or labels, routes through any node interior (including their own endpoints), unsafe self-loops, and shared route segments longer than 12 pixels. Sequence messages retain their lifeline connections below participant headers. Tight spacing and crossings are warnings.
- Sequence participant centers must be at least `max(160, estimated message width + 32)` pixels apart.

## Diagram-specific notation

| `diagramType` | Node `kind` | Group `kind` | Edge `kind` |
| --- | --- | --- | --- |
| `architecture` | `external`, `config`, `framework`, `security`, `service`, `business`, `data`, `failure`, `system`, `component`, `database` | `runtime`, `security`, `ownership`, `external` | `request`, `call`, `data`, `success`, `failure`, `framework`, `optional`, `depends` |
| `flowchart` | `start`, `end`, `process`, `decision`, `input`, `output`, `subprocess` | none | `flow`, `yes`, `no`, `success`, `failure` |
| `sequence` | `actor`, `participant`, `external`, `service`, `database` | `alt`, `opt`, `loop` | `sync`, `async`, `return` |
| `er` | `entity` | none | `relationship` |
| `deployment` | `device`, `node`, `container`, `artifact`, `service`, `database`, `external` | `host`, `network`, `cluster`, `namespace` | `deploy`, `network`, `depends` |
| `class` | `class`, `interface`, `abstract` | none | `association`, `inheritance`, `implementation`, `composition`, `aggregation`, `dependency` |
| `state` | `initial`, `state`, `final`, `choice` | none | `transition` |
| `usecase` | `actor`, `usecase` | `system` | `association`, `include`, `extend` |
| `dataflow` | `external`, `process`, `dataStore` | `ownership`, `external` | `data` |

### Sequence

Sequence edges require a unique positive integer `order`. Participants should share a top alignment with 72px participant headers (108px for actor labels) and have enough height for all messages at the existing 54px order pitch. Labels show their order number and may wrap at 16px font size with 24px line height; allow their complete multiline bounds between consecutive messages and below participant headers. Widen participant gaps when labels would require more than two lines, or move frame boundaries when labels need more room. Groups with `alt`, `opt`, or `loop` surround the relevant message range; an independent asynchronous phase must not imply that the original synchronous request is still waiting.

```json
{ "id": "request", "source": "browser", "target": "api", "label": "POST /orders", "kind": "sync", "order": 1, "evidence": "source" }
```

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
