# Diagram composition

Use this reference for authoring graph data. Viewer implementation and interaction checks live in [viewer-development.md](viewer-development.md#viewer-visual-and-interaction-contract).

- Initial canvas budgets are 2400×1600 graph units for architecture / er / deployment / class / usecase / dataflow, 1600×2400 for flowchart / state, and content-adaptive for sequence. These are starting budgets, not minimum borders, export resolutions or aspect-ratio requirements. Preserve full text and type semantics; expand for spacing and routes, keep small graphs compact, and never shrink text or add empty padding to match a ratio. Start with 64 units between peers and 80–96 between layers; expand only the affected label/port corridor. Keep 24 around labels and below measured group headings, with 32 at group sides. Wrap complete long labels instead of spreading every node; sequence messages constrain their own participant span and measured row height. Budgets alone do not rearrange existing geometry.
- Keep full text at 20/16/14px. Minimum clearances: nodes 48px; labels to nodes/labels 24px; labels to unrelated edges 6px; below measured group heading 24px, other insets 32px; sibling groups 48px; parallel channels 24px; straight endpoint segments 12px, ER 28px. Readable point crossings, including nonplanar graphs, are allowed. Prefer fewer repeated crossings between the same pair and reject long collinear overlaps. Canvas ratios are informational; never remove relationships or shrink text to pass.
- `adaptive-v2`: generation defaults to `--layout auto` and accepts semantic inputs without positions or sizes. Declare real ownership with node `groupId` and group `parentId`; color `module` is not ownership. Optional node `layout.rank` / `layout.order`, graph `layout.primaryPath` / `layout.participantOrder` express existing order only. `--layout preserve` checks existing geometry without rearranging it. Ambiguous old containment requires an explicit author decision. `--input-only` checks semantics; source, geometry and browser rendering have separate statuses. `--force` only permits replacing outputs and never bypasses quality checks.
- Make the requested question answerable from the first reading view. Use one clear path, real component/responsibility names, and action/message/data names on edges. Keep boundaries behind nodes and labels clear of group headings.
- Emphasize the actual business center through a valid `business` kind or `core`/`business` tag. The Viewer supplies cool-neutral Slate surfaces, Iris core/interaction, Cyan data, and Orange explicit failures. Give ordinary cards a low-saturation identity or semantic tint; do not add color fields or invent a `core` kind.
- Color supplements labels and notation. A collection may reuse a non-empty `module` name across views so the Viewer can apply a stable pale card fill, outline, small stripe, and ordinary-edge color; module color never replaces node shapes, labels, relationship symbols or evidence styles, and authors never provide literal colors. Framework/inference edges retain dashed evidence styling unless a diagram's notation determines its line style. Preserve exact protocols, multiplicities, guards, and source anchors.
- Size individual boxes and corridors for complete text; uniformly enlarging the layout cancels readability gains when fitted. Follow the dimensions, automatic lanes, endpoint clearances, and route-hint rules in [graph-schema.md](graph-schema.md#routing-and-spacing). Move nodes before adding route hints; no route may enter a node interior.
- On desktop, the Viewer fits the whole diagram on opening, reset, view switching and fullscreen entry. Mobile sequence diagrams (≤700px) start with a readable local view at zoom ≥.75; explicit fit always shows the whole drawing. Scale each complete authored node without hiding fields, members, subtitles or other text at lower zoom. Zoom, pan and the minimap reach detail. SVG/PNG exports cover the full diagram; graph data must retain complete content.
- Author from the requested domain's own evidence. Preview models, facts, and source paths are examples only.

## Color rules for all nine types

- Large system, deployment and sequence boundaries use borderless, very pale gauze fills from a separate region palette. Adjacent siblings in reading order and directly nested boundaries differ; each small header accent shares its fill hue at higher saturation. Nested fills do not accumulate; labels and `alt`/`opt`/`loop`/`par` remain the source of meaning. Ordinary cards retain low-saturation fills so neighboring domains are easier to distinguish; ER/class headers are tinted while dense field/member rows stay neutral. Do not recolor nodes merely because they connect: shared module identity and call/return pairs must remain consistent.
- Reuse the exact `module` name for the same evidenced domain across views. Its name selects a stable theme slot, independent of view order or unrelated module additions/removals. Eight identity slots can repeat; names, shapes and line notation remain mandatory. Aim for 4–6 meaningful categories in one reading region rather than inventing a module for every node. This is authoring guidance, not a node or palette limit.
- Keep identity, explicit failure and interaction separate. A failure outline/edge wins over module color; its small module stripe may still identify ownership. Selection adds a temporary outline without changing semantic color. Decision diamonds, `alt`, FK references, negative guards and terminal states are not automatically failures or successes.
- Use discrete colors for categories. Do not imply magnitude, security levels, trust zones or data classifications with a gradient unless the source and schema explicitly model that meaning. Do not add literal color fields.
- Use theme-specific tones and shared page/export styling. Normal diagram text must reach 4.5:1 and meaningful strokes 3:1 against their actual rendered surface; opacity matters. Keep group fills distinct from card fills and retain at least 3:1 edge contrast on them; saturated large-area fills and permanent colored glows are excluded. Nine region tones may repeat in larger diagrams; labels retain meaning. Color never substitutes for readable names, PK/FK, multiplicities, guards, dash patterns, arrow shapes or call IDs; inspect grayscale readability as well.

| Type | Color emphasis |
| --- | --- |
| Architecture | Pale domain/module card fill, stripe and outline; actual business center has a small Iris icon and stronger title. |
| Flowchart | Pale module/semantic process and decision fills; explicit failure paths only use the failure accent. |
| Sequence | Same color and C number for each call/return pair and its execution; borderless gauze fragments, distinct neighboring/nested fills and matching header accents. |
| ER | Pale domain headers with an outline/stripe, neutral field rows, readable PK/FK/UK text; FK is a reference, not a warning. |
| Deployment | Pale module fills on components and small boundary accents; do not infer environment or trust from a color. |
| Class | Pale package/module headers with an outline/stripe, neutral members; retain relationship symbols. |
| State | Pale state bodies and explicit transition meaning; preserve initial/final notation without inferring success. |
| Use case | Evidenced capability domains share identity; system boundary uses a borderless pale region fill. |
| Data flow | Evidenced domain identity on processes and stores; preserve named data flows and directions. |

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
