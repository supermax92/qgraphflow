# Compact semantic layout and orthogonal routing

Shared entry points: `orthogonal-routing.js` for outline ports, corridors and labels; `layout-refinement.js` for bounded geometry refinement. `compile-layout.mjs` supplies measured ELK/sequence candidates; `architecture-overview.js` supplies measured section grids. The browser runs the same solver in an inline offline Worker, keeps controls responsive, and cancels pending work on reset/view disposal. Local moves freeze unaffected paths and labels; a growing card may displace an adjacent ownership frame together with its members within the movement bound. Page, SVG and PNG consume the same saved `via` and `labelAt`.

## Eight steps

1. Measure full titles, body, badges, notes, labels and notation before placement.
2. Keep categories, flow, explicit ranks/order, ownership, hierarchy and section membership.
3. Measure shared column tracks and row baselines, preserve existing alignment during local refinement, and reserve local connector space without breaking the grid.
4. Rank actual outline side pairs and separate incident ports. Use a next-nearest feasible pair when the nearest corridor or its label space is blocked.
5. Use horizontal/vertical routes, short clear paths and fewer turns.
6. Resolve obstacles jointly: ports, paths, labels, permitted local moves and section-local gaps. Reroute after movement.
7. Compare canonical/reversed/rotated edge priorities; earlier lines are not permanently protected. Separate parallel relations; retain traceable crossings when bounded alternatives do not improve the result.
8. Reclaim excess space and accept the whole candidate only after the quality gate passes. Its thresholds are unchanged; the endpoint-stub rule measures a straight route by its real length rather than by its authored guide point.

## Seven constraints

- Hard: complete facts, directed semantics, ownership, required notation, clear text, valid endpoints and orthogonal routing geometry. Soft: area, route length, bends, crossings and movement.
- Nearest means actual outline distance; an obstacle-free straight route is Manhattan shortest. Multi-relation results are bounded heuristics, not proofs of global optimality.
- Safety, reading and local corridor spacing are distinct. Overview grids retain the reference spacing; only identified sections/band corridors expand.
- For the eight non-sequence relation views, labels stay centred on their own straight segment, with complete measured bounds. Slide along that segment, reserve a wider gap or reroute when space is insufficient; never move a label off its line. Sequence message labels retain their notation-specific placement.
- Priority/rip-up passes are deterministic by explicit primary flow, constrained branch and stable edge ID, independent of raw edge-array order.
- At most 60 local layout evaluations, 156 units of movement from the operation origin, and 60,000–240,000 visibility-state visits per priority pass, scaled by edge count; each corridor uses at most 4,000 visits. Node generation keeps the existing 30-second ELK hang guard. Exhaustion reports `provenImpossible: false`, attempted alternatives, reason and affected IDs; retain the best quality-valid candidate.
- Self relations, cycles, reverse directions, multiple relations and disconnected peers remain complete and individually traceable.

## Type boundaries and editing

Architecture, deployment, ER, class, dataflow and usecase retain their actual outline anchors and relationship markers. Flowchart/state keep distinct decision-side corridors, declared main paths and lifecycle endpoints. New state self-transitions use orthogonal brackets with inline labels; preserved older layouts retain their stored arc notation. Sequence uses measured participant-span and event-row constraints: preserve message order, reply pairing, activation endpoints, fragment scopes and horizontal message notation; local moves are horizontal only. A widened participant header shifts every later participant, fragment frame and saved x-coordinate right (at most 156 units) and restores message spans with the same constraints the generator uses.

Overview card drags reorder peers without reparenting. Other drags keep the user's positions, expand real ownership frames as needed and reroute; Arrange may compact selected/one-hop peers or the full view within bounds. Full text changes grow the measured element first. Apply installs a complete checked candidate atomically; failure retains the inspector draft and last valid canvas. Collections remain keyed by `viewId`. Cancel, reset and save failure preserve existing per-view behavior. Preserve-mode generation does not recompute authored routes.

## Examples

Chinese: “绘制订单支付流程图，保留成功与失败分支；组件间距适中，最近边正交连接，长关系说明完整显示。”
English: “Draw the deployment diagram for checkout, payment and the database. Keep runtime boundaries, compact related nodes, and route from the nearest feasible outlines without clipping labels.”

For architecture use the same evidenced system in all three views: calls/dependencies, reusable platform capabilities, and source-proven project/internal layers. Reference pictures supply styling only, never new runtime or Maven facts.

## Validation

Run all Node tests, rebuild the offline Viewer, regenerate all nine types plus both overview templates, and run the two-theme/three-viewport browser matrix by view ID. Exercise editing, movement, failure rollback, repeated views, persistence, real SVG/PNG downloads and an isolated packaged CLI. Record semantic, geometry, browser and package evidence separately. Browser composition events do not attest native OS input-method candidate UI.

## Dedicated layout templates

The generator measures complete content before choosing positions. Eleven presentation templates share the same routing, geometry checks, browser editing and exports. Platform capabilities use section matrices; engineering uses layers with parallel support; component relations cluster related components within real ownership; flowcharts use a main spine and side branches; sequence uses participant spans and event rows; ER uses related-entity matrices; deployment uses runtime tiers inside actual boundaries; class uses contract hierarchies; state uses lifecycle branches; use cases place actors outside the system; data flow separates processing and storage.

Template placement never creates ownership, relationships or evidence. Authored ranks and direction remain authoritative. Dense inputs keep a quality-valid layered candidate when templates add crossings, worsen the aspect band, fail validation or cost more than 25% extra in normalized area/routing; `--verbose` reports the template, attempts and fallback. No supported facts are removed. Small layouts use their content bounds rather than a fixed canvas. The fixed botanical palette supports light/dark themes and stable module colors across views; it introduces no authored color field.
