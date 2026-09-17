# Diagram composition

Use this reference for authoring graph data. Viewer implementation and interaction checks live in [viewer-development.md](viewer-development.md#viewer-visual-and-interaction-contract).

- Initial canvas budgets are 2400×1600 graph units for architecture / er / deployment / class / usecase / dataflow, 1600×2400 for flowchart / state, and content-adaptive for sequence. These are starting budgets, not minimum borders, export resolutions or aspect-ratio requirements. Preserve full text and type semantics; expand for spacing and routes, keep small graphs compact, and never shrink text or add empty padding to match a ratio. Aim for 96–160 units between nodes, full label width plus 48 for corridors, 24 around labels and 48 below group headings. Budgets alone do not rearrange existing geometry.
- Keep full text at 20/16/14px. Minimum clearances: nodes 96px; labels to nodes/labels 24px; labels to unrelated edges 6px; group heading 48px, other insets 32px; sibling groups 64px; parallel channels 24px; straight endpoint segments 12px, ER 28px. Readable point crossings, including nonplanar graphs, are allowed. Prefer fewer repeated crossings between the same pair and reject long collinear overlaps. Canvas ratios are informational; never remove relationships or shrink text to pass.
- `strict-v1`: generation defaults to `--layout auto` and accepts semantic inputs without positions or sizes. Declare real ownership with node `groupId` and group `parentId`; color `module` is not ownership. Optional node `layout.rank` / `layout.order`, graph `layout.primaryPath` / `layout.participantOrder` express existing order only. `--layout preserve` checks existing geometry without rearranging it. Ambiguous old containment requires an explicit author decision. `--input-only` checks semantics; source, geometry and browser rendering have separate statuses. `--force` only permits replacing outputs and never bypasses quality checks.
- Make the requested question answerable from the first reading view. Use one clear path, real component/responsibility names, and action/message/data names on edges. Keep boundaries behind nodes and labels clear of group headings.
- Emphasize the actual business center through a valid `business` kind or `core`/`business` tag. The Viewer supplies cool-neutral Slate surfaces, Iris core/interaction, Cyan data, and Orange decisions/failures. Keep ordinary components neutral; do not add color fields or invent a `core` kind.
- Color supplements labels and notation. A collection may reuse a non-empty `module` name across views so the Viewer can apply a stable, clearly visible full-node tint, outline, stripe, and ordinary-edge color; module color never replaces node shapes, labels, relationship symbols or evidence styles, and authors never provide literal colors. Framework/inference edges retain dashed evidence styling unless a diagram's notation determines its line style. Preserve exact protocols, multiplicities, guards, and source anchors.
- Size individual boxes and corridors for complete text; uniformly enlarging the layout cancels readability gains when fitted. Follow the dimensions, automatic lanes, endpoint clearances, and route-hint rules in [graph-schema.md](graph-schema.md#routing-and-spacing). Move nodes before adding route hints; no route may enter a node interior.
- On desktop, the Viewer fits the whole diagram on opening, reset, view switching and fullscreen entry. Mobile sequence diagrams (≤700px) start with a readable local view at zoom ≥.75; explicit fit always shows the whole drawing. Scale each complete authored node without hiding fields, members, subtitles or other text at lower zoom. Zoom, pan and the minimap reach detail. SVG/PNG exports cover the full diagram; graph data must retain complete content.
- Author from the requested domain's own evidence. Preview models, facts, and source paths are examples only.

## Notation by type

Read the row for the selected type; its legal kinds and required fields are in the schema.

| Type | Composition and routing |
| --- | --- |
| Architecture | Entry points → core responsibilities → collaborators; explicit ownership/runtime boundaries. Separate cross-layer fan-out and fan-in. |
| Flowchart | Pill start/end, processes, decision diamonds, I/O and subprocess shapes. Keep the main path top-to-bottom; give success and alternative branches separate left/right corridors and route feedback outside. |
| Sequence | Aligned participants/actors, lifelines, activation bars with nested executions, and numbered messages. Explicitly pair calls with dashed returns; nest `loop → alt` and `opt → par`. Keep self-messages outside lifelines and multiline labels clear of adjacent strokes; do not depict asynchronous callbacks as synchronous waits. |
| ER | Entity headers and complete PK/FK/UK fields, with cardinalities at both ends. Separate multiple relationships and reserve symbol clearance. |
| Deployment | Devices, nodes, containers and artifacts inside host/cluster/network boundaries. Show physical placement; keep cross-container labels clear. |
| Class | Name/stereotype, attributes and methods; separate inheritance triangles, composition/aggregation diamonds and multiplicities. |
| State | Initial dot, final double circle, states, choices and guarded transitions. Separate failure/cancellation paths, parallel transitions and self-loops. |
| Use case | Actors, elliptical capabilities and a system boundary. Distinguish actor associations from labeled `include`/`extend` links. |
| Data flow | External entities, processes and data stores. Name information on each directional flow and separate shared producer/consumer corridors. |

For a requested collection, author every view from the same verified domain vocabulary, use the canonical nine-type order, and validate the whole collection before generation. A failure in one view blocks delivery of the collection.

Nodes, routes, arrows and stroke widths scale together. Sequence screen dash periods have a 6 CSS px minimum to avoid low-DPI aliasing; baseline, mask and phase share this adjustment. Static SVG/PNG exports retain graph-unit notation.
