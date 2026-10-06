# Architecture overviews

Accepted implementation scope, based on `d6e54dd`.

- Keep nine diagram types. Architecture has `relations` (legacy default), `capabilities` (platform and business integration), and `engineering` (project organization plus a component detail on one canvas).
- Generation chooses a template from the question or an explicit request. The Viewer selects already generated views; it does not convert templates.
- Collections contain up to 32 views. Repeated architecture views require unique `meta.viewId`; the other eight types remain unique. Legacy type identities and SVG filenames stay compatible. Menus group by the existing type order, retain input order within a type, and display titles.
- `layout.sections` describes stacks, wrapping grids, parallel regions and notes. Items reference existing nodes, real groups or nested sections. Every node is placed once. `detailOf` links a component detail to the overall component. `groupId` and `parentId` retain ownership semantics.
- Cards support full `overviewText` and editable badges for status, version and requirements, with existing evidence kinds and optional source anchors. Sections support titles, explanatory text and source anchors.
- `aggregates` points aggregator → member, `inherits` child → parent, `provides` provider → consumer, and `depends` dependent → dependency.
- Shared Node/browser layout measures full text before placing sections, cards and routes. Existing type, typography, palette, themes, quality gates and interactions remain. All content must survive page, SVG and PNG drawing; failures identify the content and never remove facts.
- Overview layouts start locked. Unlock permits reordering peers within their current section or group, with automatic alignment on release. Relationship views keep free dragging. Ownership cannot be changed by dragging.
- Details edit title, subtitle, body, badges, section title and explanations. Apply relayouts; cancel retains the original. Failed edits keep the form draft and last valid canvas. Save keeps complete sections, ordering and fields. Switching retains each view separately; reset affects only the current view. Existing invalid-draft and save-failure handling remains.
- Skill intent routing, schema/reference guidance, localized UI strings, English/Chinese examples, two conceptual reference fixtures and a separately source-checked multi-module fixture are delivered. Image versions/status/rules are document claims, not an audit of Dida source.
- Delivery uses a feature branch and PR, with data/identity, layout/drawing/editing, then skill/examples/acceptance commit boundaries. Rebuild Viewer and distribution artifacts.

## Acceptance

Record source evidence, structural/geometry checks, browser interaction evidence and packaged-artifact evidence separately.

- Data: legacy single view, nine-type collection, repeated same-template architecture views, duplicate identities, invalid references, missing/repeated placement, direction and source anchors.
- Layout/export: both templates, long Chinese/English identifiers and paragraphs, several badges, many cards, component detail and parallel notes. Full content, relations and bounds must remain.
- Interactions: locked/reordered peers, keyboard, composition-safe Enter, long-text editing, apply/cancel/repeated edits, view switching, current-view reset, save/reopen, cancelled/failed saves and invalid drafts. Native input-method operation requires explicit native evidence; synthetic composition events prove only the web event guard.
- Regression: nine original types and two overview templates; light/dark; 1440×900, 1920×1080, 390×844. Search, details, zoom, fullscreen, motion preferences, actual SVG/PNG downloads. Target repeated architecture views by view ID.
- Run all existing tests, Viewer build and standalone distribution smoke checks. Completion means generate/read/edit/save/export work for both templates, states remain independent, and legacy regressions pass.
