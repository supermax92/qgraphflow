# Diagram composition

[English](visual-contract.md) · [简体中文](../../../docs/references/zh-CN/visual-contract.md) · [Русский](../../../docs/references/ru/visual-contract.md) · [Português](../../../docs/references/pt/visual-contract.md) · [日本語](../../../docs/references/ja/visual-contract.md) · [Deutsch](../../../docs/references/de/visual-contract.md) · [Español](../../../docs/references/es/visual-contract.md)

Use this reference for authoring graph data. Viewer implementation and interaction checks live in [viewer-development.md](viewer-development.md#viewer-visual-and-interaction-contract).

- Make the requested question answerable from the first reading view. Use one clear path, real component/responsibility names, and action/message/data names on edges. Keep boundaries behind nodes and labels clear of group headings.
- Emphasize the actual business center through a valid `business` kind or `core`/`business` tag. The Viewer supplies cool-neutral Slate surfaces, Iris core/interaction, Cyan data, and Orange decisions/failures. Keep ordinary components neutral; do not add color fields or invent a `core` kind.
- Color supplements labels and notation. A collection may reuse a non-empty `module` name across views so the Viewer can apply a stable, clearly visible full-node tint, outline, stripe, and ordinary-edge color; module color never replaces node shapes, labels, relationship symbols or evidence styles, and authors never provide literal colors. Framework/inference edges retain dashed evidence styling unless a diagram's notation determines its line style. Preserve exact protocols, multiplicities, guards, and source anchors.
- Size individual boxes and corridors for complete text; uniformly enlarging the layout cancels readability gains when fitted. Follow the dimensions, automatic lanes, endpoint clearances, and route-hint rules in [graph-schema.md](graph-schema.md#routing-and-spacing). Move nodes before adding route hints; no route may enter a node interior.
- The Viewer fits the whole diagram whenever it opens, resets, switches views, or enters fullscreen; it scales the complete authored drawing and never hides fields, members, subtitles, or other node text at lower zoom. Zoom, pan and the minimap reach detail. The Viewer uses full-diagram SVG/PNG export; graph data must retain complete content.
- Author from the requested domain's own evidence. Preview models, facts, and source paths are examples only.

## Notation by type

Read the row for the selected type; its legal kinds and required fields are in the schema.

| Type | Composition and routing |
| --- | --- |
| Architecture | Entry points → core responsibilities → collaborators; explicit ownership/runtime boundaries. Separate cross-layer fan-out and fan-in. |
| Flowchart | Pill start/end, processes, decision diamonds, I/O and subprocess shapes. Give success and alternative branches separate corridors. |
| Sequence | Aligned participants/actors, lifelines, numbered messages, dashed returns and `alt`/`opt`/`loop` frames. Keep self-messages outside lifelines and multiline labels clear of adjacent lanes; do not depict asynchronous callbacks as synchronous waits. |
| ER | Entity headers and complete PK/FK/UK fields, with cardinalities at both ends. Separate multiple relationships and reserve symbol clearance. |
| Deployment | Devices, nodes, containers and artifacts inside host/cluster/network boundaries. Show physical placement; keep cross-container labels clear. |
| Class | Name/stereotype, attributes and methods; separate inheritance triangles, composition/aggregation diamonds and multiplicities. |
| State | Initial dot, final double circle, states, choices and guarded transitions. Separate failure/cancellation paths, parallel transitions and self-loops. |
| Use case | Actors, elliptical capabilities and a system boundary. Distinguish actor associations from labeled `include`/`extend` links. |
| Data flow | External entities, processes and data stores. Name information on each directional flow and separate shared producer/consumer corridors. |

For a requested collection, author every view from the same verified domain vocabulary, use the canonical nine-type order, and validate the whole collection before generation. A failure in one view blocks delivery of the collection.
