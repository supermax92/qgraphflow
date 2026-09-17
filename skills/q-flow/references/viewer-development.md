# Viewer development and maintenance

Modules are composed at build time: after source changes and a build, the generator embeds every feature in standalone HTML. There is no runtime plugin download or hot loading. Ordinary graph generation still outputs only `index.html` and `graph.json`.

## Change entry points

Source paths below are relative to `assets/viewer/src/`.

| Goal | Entry point | Scope |
| --- | --- | --- |
| Add a diagram type | `diagrams/<type>.js`, `diagrams/registry.js` | Names, order, legal kinds, type-specific validation, rendering, outlines and relationship policy |
| Change theme, font sizes or line heights | `visual-style.js`, `radix-colors.js` | Radix scales, theme variables, semantic colors, core recognition and dimensions shared by page and export |
| Change node shapes or internal layout | Matching `diagrams/<type>.js`; shared cards use `diagrams/card.js` | Both page and SVG/PNG nodes |
| Change shared SVG typography and primitives | `diagrams/drawing.js` | `svgStyles()`, escaping and shared primitives; scoped on the page and reused in export |
| Change toolbar, details or responsive shell | `ViewerShell.jsx`, `styles.css` | Page shell; no second HTML/CSS implementation of node content |
| Change canvas glow effects | `effects.css`, imported by `main.jsx` after `styles.css` | Role, selection and flow glow, dark vignette; palette variables only, removable as one file and disabled with reduced transparency or higher contrast |
| Change selection or search | `features/useSelection.js`, `search.js` | Shared selection, feedback, keyboard and dismissal; search ranking is independently testable |
| Change directional edge motion | `features/useViewerController.js`, `features/usePresentation.js`, `DiagramCanvas.jsx`, `styles.css` | Direction-only animation controlled by its switch and reduced-motion preference; dashed sequence baselines, masks and selection strokes travel together while retaining gaps |
| Change the reading legend | `ViewerShell.jsx`, `styles.css`; content from `legend.js`, `visual-style.js` | Floating legend popover from actual categories and line styles; retain original symbols, shared `nodeAppearance` colors and core priority |
| Change panels and focus | `features/usePanels.js` | Mobile mutual exclusion, visibility and focus return; preserve panel preference on view switches |
| Change canvas fullscreen | `features/useFullscreen.js`, `features/useSelection.js` | Native fullscreen, failure notices and focus return; selection in fullscreen does not open an external Inspector, Escape exits fullscreen first |
| Change dragging, viewport, lock or spacing | `features/useGraphLayout.js`, `layout-nudge.js` | Current positions and layout operations; D3 remains a bounded nudge |
| Change presentation state | `features/usePresentation.js` | Project selection and search into nodes and edges without a second state owner |
| Change downloads | `features/download.js`, `export-svg.js` | Static SVG from current coordinates; PNG rasterized from that SVG |
| Change routing or layout checks | `edge-routing.js`, `text-layout.js` | Paths, label wrapping and measurement shared by page, exports and validation |

`main.jsx` owns loading, view switches, theme and per-view edit drafts. `features/useViewerController.js` combines capabilities and coordinates save/reset operations; `ViewerShell.jsx` binds the UI. Extend the relevant module first. Create a new Hook only for independent state and lifecycle.

## Add a diagram type

1. Add a module in `diagrams/` with a default-exported definition.
2. Import it in `diagrams/registry.js` and add it to `DIAGRAMS`. Registry order is collection menu order; standalone graphs still have no type menu.
3. Update `graph-schema.md`, `visual-contract.md` and the authoring instructions in SKILL so the author knows the type. Registering a type need not change the data structure.
4. Build the template, generate examples and verify type-specific nodes, relationships and browser interactions.

Reuse existing rules and primitives. A card view inheriting every architecture rule needs only `{ ...architecture, id: 'new-view', label: 'New view' }` and registration. An independent type commonly contains:

```js
export default {
  id: 'new-view', label: 'New view',
  nodeKinds: ['component'], groupKinds: [], edgeKinds: ['call'],
  outline, // (node, x, y) => [[SVG tag name, geometry attributes], ...]
  render,  // (node, x, y, fill, stroke, palette) => SVG string
};
```

`render` paints the body with `paint(outline(node, x, y), { fill, stroke })` and text with `text` / `centeredTitle`. Module code is trusted; graph data is not. Never concatenate input into SVG tags, attributes or text without shared escaping.

Add optional hooks only when needed:

- `validateNode`, `validateEdge`: append constraints after common validation; reuse supplied `requireString`, `validateStringArray`, etc. Each validation creates a fresh sequence-order set.
- `edgeLabel`, `undirected`, `dashedKinds`, `markers`: relationship labels, direction, notation-specific dashes beyond evidence styles and existing UML markers.
- `cardLayout`, `compartments`, `sequence`, `cardinalities`, `endpointStub`, `selectionHeight`: existing card checks, core compartments, lifelines, ER endpoints and selection-height rules.

Rectangular cards can reuse current rules. Entirely different routing, connection points or UML symbols still require shared routing or drawing extensions; registration cannot infer unknown geometry. Add names and `nodeAppearance` classification in `visual-style.js` for new semantic kinds. Retain the Radix MIT notice from `radix-colors.js` in generated HTML and exported SVG.

## Shared rendering constraints

`DiagramCanvas.jsx` and `export-svg.js` both call `renderNode()` in `node-svg.js`. The page inserts SVG into React Flow nodes; export passes a canvas offset to the same renderer. `SelectionOutline.jsx` calls `renderSelection()` and reuses the type's `outline`, changing only stroke, opacity and shadow.

Separate positions, content and transient interaction: dragging changes current coordinates; selection changes neither coordinates nor shapes. Exports receive only the current graph and theme, never selection or animation state. Boundaries, React Flow marker adaptation and page controls still have host-specific rendering. Shared node content does not mean identical page DOM and export SVG.

## Build and regression

Run in the skill directory with existing dependencies and browser tooling:

```bash
npm --prefix assets/viewer run build
node --test scripts/*.test.mjs
node scripts/generate-viewer.mjs /tmp/graph.json /tmp/new-viewer
node scripts/browser-interactions.mjs /tmp/new-viewer /tmp/new-viewer-check
```

The lower-left fullscreen button puts the canvas into native fullscreen; the floating panels and top toolbar stay outside. After the dimensions change, fit the current graph once without changing selection or layout. Keep the current viewport when exiting. The target icon fits the drawing; the four-corner icon toggles fullscreen. Regenerate previously created HTML to include new features. When fullscreen is unsupported, mark the control unavailable; announce request failures in the canvas status region.

Fullscreen acceptance uses real browser APIs. `QA_HEADED=1` opens a browser window for fullscreen, Escape and focus checks:

```bash
QA_HEADED=1 QA_ONLY_EXTRAS=1 QA_EXTRAS=fullscreen,fullscreen-errors \
node scripts/browser-interactions.mjs /tmp/new-viewer /tmp/fullscreen-check
```

The browser script covers every supplied type at three sizes, in light and dark themes, with interactions. Use a nine-type collection for the full matrix. `QA_FIXTURE_DIR` adds special-shape fixtures. The script needs adjacent source modules and cannot be copied as a standalone script.

Details follow the user's selection: `useSelection` owns selection and `useViewerController` derives `inspectedNode`; the quick-look card and Inspector in `ViewerShell` consume it. There is no autoplay, step-by-step reading or flow orchestration. The legend is in a floating button at the canvas's top left; `.inspector-facts` remains the last details section. `DiagramCanvas`'s `has-flow` and `styles.css` control static-layer contrast during edge motion; selection must not fill the moving dash gaps.

```bash
QA_ONLY_EXTRAS=1 QA_EXTRAS=flow-contrast,inspector-sync \
node scripts/browser-interactions.mjs /tmp/new-viewer /tmp/new-viewer-sync-check
```

`diagram-modules.test.mjs` adds a tenth test type in a temporary copy, changes only that copy's module and registry, and performs validation, build and generation. The product still supports nine types. Set `MODULE_TEST_OUTPUT=/tmp/new-module-check` to retain the copy and use its `skills/q-flow/scripts/browser-interactions.mjs` to check `page/`. The copy preserves repository hierarchy and root third-party notices to verify actual build dependencies. The directory must not already exist.

Rebuild `assets/viewer-dist/index.html` after Viewer changes. After installation, check the actual cache and generate acceptance output with the installed version in a new session. Existing standalone HTML embeds old code and must be regenerated.

## QGraphFlow naming and migration

| Identifier | Old | New |
| --- | --- | --- |
| Product | CodeGraph Flow | QGraphFlow |
| Plugin ID | `codegraph-flow` | `qgraphflow` |
| Skill directory and invocation | `create-interactive-codegraph` / `$create-interactive-codegraph` | `q-flow` / `$q-flow` |
| Skill display name | CodeGraph Flow｜交互式软件图 | Q flow |
| Private Viewer package | `codegraph-flow-viewer` | `qgraphflow-viewer` |
| Default delivery directory | `docs/codegraph-flow/<scope>-<diagram-type>/` | `docs/qgraphflow/<scope>-<diagram-type>/` |

The package keeps only the new skill entry, without old aliases. Its scope remains nine software diagram types. Renaming MapSprig / QMindFlow is outside this migration.

From the repository root, use the new paths:

```bash
node skills/q-flow/scripts/validate-graph.mjs /tmp/graph.json
node skills/q-flow/scripts/generate-viewer.mjs /tmp/graph.json docs/qgraphflow/example-architecture
```

The default directory is a skill delivery convention; the generator still requires an explicit output directory. User-chosen legacy directories, including `docs/codegraph-flow/`, remain usable. Replacing existing output still requires `--force`. Old `graph.json` files need no rewrite; authored legacy names in titles, sources, nodes and evidence are preserved. Old HTML remains usable offline but shows its embedded old branding; regenerate from its original JSON to update it.

`CodeGraph`, `codegraph`, `@colbymchenry/codegraph` and `.codegraph/` belong to the external analysis tool and are unchanged. Internal `__CODEGRAPH_FLOW_DATA__`, `codegraph-*` SVG identifiers and test temporary-directory prefixes are also preserved.

### Local installation and updates

Installation, update, removal and verification status for Codex, Claude Code, Qoder and Cursor live in the [client installation guide](../../../docs/clients.md). Repository edits do not refresh installed plugins automatically. Verify the actual source and version during installation or migration, use client management controls, and preserve user diagrams and other plugin configuration.

## Viewer visual and interaction contract

Read this section only for Viewer maintenance or interaction audits. Graph authoring uses [visual-contract.md](visual-contract.md).

### Shared presentation

- Use the canvas-first React Flow shell: the canvas fills the window and runs under one 52px material toolbar (navigation toggle, view menu for collections, title and subtitle, search with a results popover, a `···` menu with export / reset / layout-lock switch / spacing / appearance, and the Inspector toggle). There is no board header, footer or brand block; the product name appears only in the document title. Graph navigation and the node Inspector are floating panels that slide in from their own edge and start collapsed at every width; clicking a node shows a quick-look card beside it (type, name, responsibility, source anchor, up to four tags, `View details`) instead of opening the Inspector. Let the diagram carry the strongest visual emphasis.
- Appearance follows the system `prefers-color-scheme` by default and updates live; the `···` menu offers a `System / Light / Dark` segmented control whose manual choice wins in both directions. Theme changes preserve viewport, search, selection, layout lock, and panel state.
- Use Radix Colors (MIT) as the shared palette: Slate for cool-neutral surfaces, Iris for core components and interactions, Cyan for data, and Orange for decisions/failures. Keep copyright and license notices in distributed source, standalone HTML, and SVG; no runtime CDN or component-library dependency is required.
- Emphasize an actual business center with the existing `business` kind or a case-insensitive `core`/`business` tag. Use Iris 3 fill, Iris 8 border, and Iris 12 text; ER/class nodes apply it to their header with neutral member rows. Core emphasis takes precedence over data/warning classification. Initial/final state symbols retain their solid-dot/double-circle notation. Do not add a `core` kind or literal color fields to the data format.
- Page, node drawings, MiniMap, Inspector dots, legends, and exports reuse `visual-style.js`. Ordinary cards use Slate 2; the light canvas is Slate 1 (`#fcfcfd`, near-white), the same step-1 rule as dark mode. Use corresponding dark scales rather than applying light colors unchanged in dark mode.
- Chrome colors (toolbar, panels, Inspector, canvas controls) are expressed through tokens that `styles.css` derives from the palette variables with `color-mix`: four label levels (`--label`, `--label-2/3/4`), one separator (`--sep`), a three-step fill scale (`--fill`, `--fill-2/3`) and three materials (`--material-thick`, `--material`, `--material-thin`), so dark mode only overrides the material base and shadows. Chrome text uses the 11 / 12 / 13 / 15 / 20 px scale while node SVG typography keeps `TYPOGRAPHY` / `--font-*`; every control has a `:active` press state and the shared `:focus-visible` ring; panels separate with a .5px hairline plus one shadow layer, and `1px solid` stays on canvas glyphs only. Besides `prefers-reduced-motion`, the chrome responds to `prefers-reduced-transparency` (materials become opaque `--panel`, no blur) and `prefers-contrast: more` (separators and secondary text take the label color; floating layers get a 1px outline).

| Role | Radix scale / step |
| --- | --- |
| Page / ordinary surface | Slate 1 / Slate 2 |
| Main / secondary text | Slate 12 / Slate 11 |
| Core fill / border / text | Iris 3 / Iris 8 / Iris 12 |
| Interaction / directed motion | Iris 11 |
| Data fill / border / accent | Cyan 3 / Cyan 8 / Cyan 11 |
| Warning fill / border / accent | Orange 3 / Orange 8 / Orange 11 |
| Subtle border / ordinary edge | Slate 6 / Slate 9 |

- In light mode, a node without `module` keeps its role fill; a node with `module` uses that module's full-card tint, outline and top stripe. The reviewed ecommerce mapping is 渠道 `#6b7280`、结算 `#5753d7`、价格 `#8b5cf6`、库存 `#0f8f83`、风控 `#c26a17`、支付 `#2474d2`、订单 `#348052`、履约 `#b14b7d`. Color is intentionally prominent but never replaces labels, shapes, cardinality, line style, or stereotypes. Preserve the node's module fill during selection.
- Build the reading legend from categories and line styles actually present. Apply the same core-priority and semantic appearance rules as the drawing; omit unused categories and use the current theme.
- Open the reading legend from the `Legend` floating button at the canvas's top-left as a popover that also holds the `Edge animation` switch when directed relationships exist. Keep each original symbol before its label, including its shape, theme colors and solid/dashed line style, as plain inline text that wraps within the popover. The button yields to the right of an open navigation panel; pan/zoom leaves its position and text size unchanged, and Escape or an outside click closes the popover.
- Directed relationships show one clearly visible moving dash overlay from source to target by default; undirected relationships remain static. Preserve the solid/dashed evidence baseline beneath the overlay. For sequence messages the baseline stays opaque and the 3.2-graph-unit overlay has no glow. Dashed returns / framework / inference messages move the baseline, its same-route `5 5` mask and selection strokes together: the dashes travel from source to target while gaps stay clear at each animation phase. Brightness changes within fixed dash positions are not sufficient. User selection keeps motion running. Switching sequence flow off or reducing motion removes the overlay and stops the baseline's dash phase.
- Hover and selection emphasis use outlines and shadows without scaling node geometry or replacing semantic fills and borders. User selection adds one shared 760ms outline/glow rebound to the node and its direct incident edges, then retains static emphasis; only stroke width, opacity, and shadow animate.
- `effects.css` is a separate screen-only effect layer loaded after `styles.css`. In dark mode it adds a `filter: drop-shadow` glow along the SVG `.node-surface` in the node's module color when present, otherwise its role color, an accent glow for hover / selected, a wider selection halo (node 14px at .5; non-sequence incident edges 14px at .3 so a selected moving dash keeps ≥ 60% of its reference contrast), a thicker glowing non-sequence `.edge-flow`, and a 10% accent radial vignette from the top of the canvas. Sequence incident edges retain the restrained 9px / .16 / 2px-blur halo and clear no-glow flow so request/return notation remains primary. Light mode uses the same module color for a soft tinted shadow and keeps the canvas flat. The layer only references palette tokens, never a card `box-shadow` (sequence lifelines must keep `boxShadow === 'none'`), and never touches exports. `prefers-reduced-transparency: reduce` or `prefers-contrast: more` switches decorative filters off without changing sequence baseline opacity or dashes.
- Honor reduced-motion preferences by disabling relationship and selection motion, and applying view changes without animation.
- SVG and PNG downloads use the current theme, notation, typography hierarchy, and shared orthogonal paths. They exclude temporary selection and search highlights; visible labels and symbols must remain within their shapes after export; SVG descriptions preserve the complete authored text.

### Interaction

- A standalone graph has no view menu. A requested graph collection exposes its diagram types in the toolbar view menu (`role=menu` with `menuitemradio` items) in canonical order, the current item checked and each item showing its relationship count. Switching retains each graph's saved text and positions, clears search and the previous selection, uses the default overview/local reading rule below, and applies that graph's initial core selection.
- There is no automatic playback, step control, reading tour, current step, or completed-step state. Ignore legacy `playback` metadata. Directional edge motion remains independent and never claims to show runtime order.
- Initially select the first explicitly marked core node, if any, with static emphasis on it and its direct incident edges. Do not pulse for this initialization; graph switching follows the same rule. Without a core marker, leave selection empty.
- Selecting a node shows its quick-look card and highlights its direct incoming/outgoing edges together; include a self-loop once and do not traverse further or dim unrelated relationships. Reuse the current routed path for edge emphasis without adding arrowheads or changing arrow sizes. Preserve evidence dashes, ER cardinality, and UML symbols.
- Match selection outlines to the actual shape: cards, diamonds, parallelograms, ellipses, and state circles. In sequence diagrams emphasize only participant headers or actor figures, never the full lifeline box. After the 760ms rebound, retain static emphasis; selecting another node replaces the whole highlighted set, and selecting the same node replays once.
- Node clicks and drag start select a node and show its quick look; directory/search and Enter/Space open its Inspector. Selection leaves directed edges flowing. Apply selection feedback and detail positioning once per operation; dragging does not recenter the viewport or move focus away from its target.
- Clear selection with a canvas click, detail close, or Escape. Search dims non-matching nodes without changing topology.
- The Inspector retains the selected node and all its facts, fields, nullability, attributes, methods, source anchors and tags until the user changes or clears selection. It never advances automatically or steals focus.
- Directed flow must remain visibly distinguishable while its node is selected. Static emphasis must not fill the moving dash gaps with an opaque same-color line. Validate all incident directed edges, not only the first edge or animationPlayState. Reduced motion and the independent flow switch retain priority.
- Search ignores case and surrounding whitespace. Rank exact names, name prefixes, name substrings, subtitle/tags, then facts/fields/attributes/methods; preserve original order within ties and take eight results after sorting.
- Layout is locked by default. An explicit control enables dragging; downloads use the current node positions.
- The `Arrange` action uses bounded D3 nudging after unlocking layout. With a selection it moves that node and its one-hop neighbors; without a selection it moves all nodes. It targets 65px rectangle clearance while staying close to authored positions, keeps contained nodes inside their smallest boundary, and only moves sequence participants horizontally. It is spacing cleanup, not a fresh topology or full automatic layout.
- Initial canvas budgets are 2400×1600 graph units for architecture / er / deployment / class / usecase / dataflow, 1600×2400 for flowchart / state, and content-adaptive for sequence. These are starting budgets, not minimum borders, export resolutions or aspect-ratio requirements. Preserve full text and type semantics; expand for spacing and routes, keep small graphs compact, and never shrink text or add empty padding to match a ratio. Aim for 96–160 units between nodes, full label width plus 48 for corridors, 24 around labels and 48 below group headings. Budgets alone do not rearrange existing geometry.
- If a boundary cannot fit the preferred header/padding within the 156px movement limit, retain the node's authored position and report remaining layout issues. Unrelated nodes retain their exact coordinates, including fractions. Every operation refreshes the status message and its 4.5s display timer, even when the text repeats.
- Spacing cleanup never changes graph evidence, edge route hints, groups, selection, viewport, panels, or theme. `Reset` restores authored `graph.json` positions and the reading view, clears search, selection, and old operation messages, and restores the default edge-flow switch. Keep the current theme, panel visibility, and layout lock; announce the completed reset in the existing status region.
- Pan, zoom, fit view, reset, SVG download, and PNG download remain available.
- `Save Graph JSON` saves all views' current text and positions in the original single-graph or collection shape, preserving metadata, source anchors, and structured fields. Use a native save picker where supported and a JSON download otherwise. Cancellation or write failure preserves edits; reset affects only the current graph and is included in the next save. Reload still uses embedded data; reopen saved edits by regenerating from the saved JSON. Browser regression must cover switching away and back, reset isolation, JSON download, and regeneration from that JSON.
- Keyboard selection and panel dismissal preserve graph topology; Backspace and Delete do not remove nodes from this Viewer.
- Desktop opening, resetting, switching views and entering fullscreen fit the whole diagram. Sequence diagrams at ≤700px instead start at zoom .75 around the first core participant (or first participant), with its head below the toolbar. Explicit `Fit canvas` always shows the whole graph at every width. Fit bounds include nodes, groups, routes, labels and ER symbols; exports always use these full bounds.
- Every overview fit subtracts toolbar and floating-panel chrome using `readingPadding()`; each open desktop side panel occupies 304px + 24px, closed sides reserve 24px. The bottom boundary clears measured visible controls by 12px. Padding uses `px` strings, not numeric ratios. Panels outside fullscreen and full-width mobile panels do not reduce the reading rectangle.
- Opening navigation or Inspector pans only as needed to reveal the selected node, or sequence participant head/message label, without changing zoom. An already visible or absent selection does not move. Mobile panels do not trigger reveal. Closing panels preserves the current viewport, including user navigation.
- Directory, search and participant Enter/Space locate ordinary nodes as before. Sequence locate uses `max(currentZoom, .75)` (maximum 2), anchors the visible head near the top of the final reading rectangle, and issues one viewport target. On mobile it prepares the canvas seen after closing the mutually exclusive panel. Clicking or starting a drag does not locate. `occupiedBox()` uses the shared 72px participant / 108px actor head; an actor subtitle adds 22px, without changing the authored lifeline end.
- All programmatic viewport moves (fit, locate, reveal) share `cubic-bezier(.32,.72,0,1)` at 320–420ms; panels enter and exit with a critically damped spring (`visualDuration .36`, `bounce 0`). Reduced motion sets both to zero duration, so panels appear at their resting position with no painted travel.
- Zoom and fit scale the complete authored node as one unit. No zoom level hides subtitles, fields, attributes, methods, stereotypes, or other authored node text; fullscreen fit follows the same rule. Centered shape text wraps inside the available rectangle, with narrower areas for diamonds, ellipses, pills and slanted shapes. Shared width estimates reserve space for uppercase identifiers and wide Latin letters. Boundary titles reserve space for fragment notation. The `text-bounds` browser check covers every supported node kind, long fields and members, boundary titles, uppercase edge labels, and all three zoom levels, and fails if any non-empty authored node text has computed opacity zero.
- Quick look tries right → left → below → above using its actual size. Ordinary graphs retain minimum-overlap fallback. Sequence cards additionally avoid message labels, stroke/arrow bands and branch guards. If no safe candidate fits, hand the same selection to the existing Inspector and pan without shrinking; never place a covering card. Card and Inspector share one editor draft and save validation, including across resize/fallback.
- Long quick-look content wraps and scrolls. Fullscreen detail handoff exits fullscreen before opening Inspector. A rejected exit preserves selection and reports failure; safe cards stay usable, while unsafe sequence cards remain hidden and the fullscreen exit control provides retry.
- The legend button and zoom controls move to 328px from the left while the navigation panel is open; the minimap moves to 328px from the right while the Inspector is open (`.workspace.nav-open / .drawer-open`); at 700px and below they stay put.
- SVG and PNG exports contain the complete diagram rather than only the current viewport.

### Responsive layout

- At every width both floating panels start collapsed and open as 304px overlays (toolbar bottom + 12px to window bottom − 12px) without a backdrop, so the canvas stays pannable beside them. Escape closes an open popover first, then the panel holding focus (returning focus to its toolbar toggle), then the selection. Do not remove evidence access at an intermediate breakpoint.
- At 700px and below, a panel is the window width minus 24px, opening one closes the other, the minimap is hidden. Selecting a search result opens its details and closes the navigation panel.
- Keep mobile actions reachable, retain a visible canvas beside an open panel, and prevent horizontal page overflow at 390px. The Inspector still shows complete text and scrolls vertically.

### Evidence display

- Keep node identity, fields, attributes, methods, source anchors and tags first in the Inspector, then a separate final facts section from the same selected node. Show `Evidence facts` with a source or `Node notes` without one. Omit this section when there are no facts or no inspected node. It scrolls with the Inspector content.
- Direct source, configuration, schema, test, or document evidence uses a solid baseline unless the relationship notation requires a dashed line, such as a return, dependency, or implementation.
- Framework behavior and inference retain a dashed baseline, except synchronous sequence messages, which stay solid. Keep evidence in metadata/details and preserve each relationship's notation during flow.
- The detail drawer says `Evidence` rather than claiming every anchor is source code.
- Facts, subtitles, fields, methods, source symbols, and tags wrap long tokens within the Inspector. Preserve complete text and allow only vertical scrolling.

### Browser acceptance

- Run the full browser matrix only when Viewer source, edge routing, graph schema, or validation behavior changed. Cover all nine diagram types at 1440×900, 1920×1080, and 390×844 in light and dark themes; check default directed flow, absence of playback controls, stable manual selection with still-moving edges, the independent flow switch, dynamic semantic legends, pan/zoom, ranked search, linked node/edge emphasis without geometry changes or duplicate pulses, complete Inspector wrapping, layout lock and spacing-result feedback, reset, SVG/PNG download without transient effects, keyboard use, reduced motion, and horizontal overflow. Check each type's own notation and core emphasis. Standalone pages have no diagram-type menu; requested collections use a vertical view menu. At 700px and below both panels start collapsed, remain accessible, and open mutually exclusively.
- Open downloaded images to check complete labels, notation, uncropped boundaries, and theme parity. Reuse installed browser tooling and close temporary HTTP servers in `finally`.

### Sequence rendering and interaction

- Full lifelines remain in routing/export bounds, but transparent columns and lifelines never intercept pointers. Visible heads and message label buttons are the interactive targets; labels, lines and Enter/Space share one selection entry point.
- Sequence labels retain all text and clear message strokes by at least 6 graph units. Explicit label positions remain authoritative and are validated. Invalid edits retain the old graph and editable draft. Self-call labels use the actual routed extent.
- Participant subtitles appear in shared SVG drawing, with bounded ellipsis and full text in details/descriptions. Sync uses a filled arrow, async an open V, return an open V plus dashes; sync remains solid independently of evidence. Legend and exports reflect actual kinds.
- `sequence-fragments.js` validates and lays out explicit alt/opt/loop/par operands for page/export. Legacy alt frames visibly disclose missing conditions and emit warnings. Never infer operands from message names.
- A single native media-query subscription owns live reduced-motion state. Remove sequence flow overlays and disable/explain the switch while reduced; restore the user's previous flow choice when cleared, without resetting graph, selection, panels or viewport.

### Sequence execution and motion checks

`sequence-executions.js` owns explicit pairs, endpoint intervals and nesting; routing, participant drawing, exports and bounds consume the same geometry. `sequence-fragments.js` owns operand ancestry, text and collision checks. Fragment text is drawn above lifelines with an opaque text background; titles avoid execution bars. Pair IDs have a group-colored underline with readable neutral text. New validator imports must be included in `package.json` files.

Nodes, routes, arrows and stroke widths scale together. Sequence screen dash periods have a 6 CSS px minimum to avoid low-DPI aliasing; baseline, mask and phase share this adjustment. Static SVG/PNG exports retain graph-unit notation. Sequence motion uses a 3.2-unit stroke over a 1.6-unit baseline; other directed edges use 2.8 units. Both `styles.css` and the later `effects.css` participate. The graph collection owns the user's flow choice so switching diagrams preserves it. Keep live reduced-motion behavior. Sync uses a solid baseline independently of evidence; non-sequence notation and undirected kinds remain unchanged. Default include/extend labels sit beside their path so short use-case relationships remain visible; explicit label positions still win.

Run `node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs`, build the Viewer, generate the sample and use `QA_ONLY_EXTRAS=1 QA_EXTRAS=motion-matrix node skills/q-flow/scripts/browser-interactions.mjs GENERATED REPORT` for actual screenshot profiles and video. Nine types × two themes × three viewports give 54 cases. Check default and selected overview plus readable local paths for every actual line kind, opposite directions and self messages. ER is a static control. A CSS clock or structure validation does not prove perceptible movement. Preserve historical media recording hashes; write a new report.

Use `QA_EXTRAS=motion-preferences` for user flow choice, live reduced motion, diagram switching, high contrast and reduced transparency. `QA_TYPES` and `QA_WIDTHS` narrow matrix retries. Frame sampling excludes labels, overlaid edges and bends; correlate the changing ink across 0/70/140 ms and retain the actual images for review.

### Landscape composition and proportional motion acceptance

Initial canvas budgets are 2400×1600 graph units for architecture / er / deployment / class / usecase / dataflow, 1600×2400 for flowchart / state, and content-adaptive for sequence. These are starting budgets, not minimum borders, export resolutions or aspect-ratio requirements. Preserve full text and type semantics; expand for spacing and routes, keep small graphs compact, and never shrink text or add empty padding to match a ratio. Aim for 96–160 units between nodes, full label width plus 48 for corridors, 24 around labels and 48 below group headings. Budgets alone do not rearrange existing geometry.

Generation and validation share `layoutComposition.canvasBudget`. Sequence reports `canvasBudget`, `targetRatio` and `fit` as null. Other ratios are informational and never trigger an aspect-ratio warning. Actual content bounds still control fit and SVG/PNG dimensions; reporting the budget does not perform automatic layout or certify readability.

Nodes, routes, arrows and stroke widths scale together. Sequence screen dash periods have a 6 CSS px minimum to avoid low-DPI aliasing; baseline, mask and phase share this adjustment. Static SVG/PNG exports retain graph-unit notation.

## strict-v1

`strict-v1`: generation defaults to `--layout auto` and accepts semantic inputs without positions or sizes. Declare real ownership with node `groupId` and group `parentId`; color `module` is not ownership. Optional node `layout.rank` / `layout.order`, graph `layout.primaryPath` / `layout.participantOrder` express existing order only. `--layout preserve` checks existing geometry without rearranging it. Ambiguous old containment requires an explicit author decision. `--input-only` checks semantics; source, geometry and browser rendering have separate statuses. `--force` only permits replacing outputs and never bypasses quality checks.

Keep full text at 20/16/14px. Minimum clearances: nodes 96px; labels to nodes/labels 24px; labels to unrelated edges 6px; group heading 48px, other insets 32px; sibling groups 64px; parallel channels 24px; straight endpoint segments 12px, ER 28px. Readable point crossings, including nonplanar graphs, are allowed. Prefer fewer repeated crossings between the same pair and reject long collinear overlaps. Canvas ratios are informational; never remove relationships or shrink text to pass.

Sequence `order` retains semantic order; generated `route.messageY` supplies the actual vertical coordinate. Legacy routes without it keep the 54px fallback. Automatic layout requires explicit fragment operands and never invents conditions. Participant subtitles, guards and bodies must be complete. Invalid geometry remains an editable/saveable JSON draft; SVG/PNG export checks the current snapshot and actual glyph bounds after fonts load. PNG rejects blank encoding or sizes above 32767px / 64 million pixels, without reducing resolution.

```bash
node scripts/validate-graph.mjs graph.json --input-only
node scripts/generate-viewer.mjs graph.json output-directory --layout auto
node scripts/validate-graph.mjs output-directory/graph.json
```
