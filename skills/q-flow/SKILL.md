---
name: q-flow
description: Create or audit evidence-grounded interactive software diagrams from source, schemas, config, or requirements; deliver offline HTML and graph JSON.
argument-hint: "[module or flow] [what the diagram should answer]"
---

# Q flow

Generate an offline diagram artifact in the target repository, with SVG/PNG downloads in its Viewer.

## Intake

A request is ready when the invocation or the conversation names a subject (repository, module, flow, entity set or document) and the question the diagram must answer, at a matching level: a behaviour question (call order, decisions, data movement, lifecycle) needs one flow or component as its subject, so a repository- or module-level subject with such a question is not ready: find entry points with the file-name and annotation search in [guided-intake.md](references/guided-intake.md) (`rg -l`; do not open source files) and ask which flow. Diagram type, granularity, output directory, language and graph count have defaults and are never asked. Start Evidence without another question only when the invocation and conversation together provide a ready request.

When both are missing, run one guided round from [guided-intake.md](references/guided-intake.md) before Evidence: inventory the repository first so options name real modules, ask subject and intent in one message with a recommended option, and add a second round only for the cases it lists. When only one is missing, or the level does not match, ask for that one only. Use the client's structured question tool when one exists; otherwise number the options in plain text. After asking, end the turn and wait for the reply; never assume an answer. Write no output files before the round completes.

## Evidence

- Prefer one bounded CodeGraph query when its index is current. CodeGraph is optional; if missing or stale, use [evidence-sources.md](references/evidence-sources.md) for direct tracing and optional setup.
- Use source/tests for calls, DDL/mappings for ER, manifests for deployment, and accepted requirements plus implementation for business behavior.
- Preserve exact identifiers and file/line anchors. Separate repository facts, framework behavior, documents, and inference; omit unproven critical relationships and label other inference. Never put secrets or token values in graph data.

## Author

**Layout priority: readable content, clear spacing and the diagram’s reading direction.** Initial canvas budgets are 2400×1600 graph units for architecture / er / deployment / class / usecase / dataflow, 1600×2400 for flowchart / state, and content-adaptive for sequence. These are starting budgets, not minimum borders, export resolutions or aspect-ratio requirements. Preserve full text and type semantics; expand for spacing and routes, keep small graphs compact, and never shrink text or add empty padding to match a ratio. Start with 64 units between peers and 80–96 between layers; expand only the affected label/port corridor. Keep 24 around labels and below measured group headings, with 32 at group sides. Wrap complete long labels instead of spreading every node; sequence messages constrain their own participant span and measured row height. Budgets alone do not rearrange existing geometry.

Flowchart main paths must run top-to-bottom, with left/right branch corridors and outside feedback routes. Apply this rule to auto, preserve and image exports; omitting optional `primaryPath` must not let an unambiguous horizontal chain pass.

1. Choose `meta.diagramType` by intent: structure → `architecture`; decisions → `flowchart`; ordered calls → `sequence`; stored data → `er`; runtime placement → `deployment`; types → `class`; lifecycle → `state`; actors/capabilities → `usecase`; data movement → `dataflow`. Default to `architecture` when ambiguous. Use one graph unless the user explicitly requests multiple views; order a collection as architecture, flowchart, sequence, ER, deployment, class, state, use case, then data flow.
2. Read [graph-schema.md](references/graph-schema.md): common fields, routing, the selected kind-table row, and matching type-specific sections. Read [visual-contract.md](references/visual-contract.md) for composition. Skip unrelated types and development references.
3. Write the complete evidenced graph that answers the question. Automatic layout accepts nodes without coordinates; declare real ownership with `groupId` / `parentId`, and use `layout.rank`, `layout.order`, `primaryPath` or `participantOrder` when supported by the model. There is no fixed node-count cap. Retain complete labels, relations and source facts. Use valid `business` kinds or `core`/`business` tags for the business center, never literal colors or invented kinds. In a collection, reuse the same non-empty `module` value for the same business module; color does not declare ownership. Apply the shared [color rules](references/visual-contract.md#color-rules-for-all-nine-types): low-saturation tinted cards, borderless gauze-filled large boundaries, restrained identity accents and explicit failure semantics; adjacent/nested regions use distinct pale fills and matching saturated header accents without breaking same-module or call/return identity. Preserve ER keys/cardinalities, class members/multiplicities, sequence pairing/fragments, state guards and architecture/deployment boundaries.
   For every newly authored sequence, model evidenced execution intervals in `executions`, including `parentId` for nested work on the same participant, and declare known returns with `replyTo`. A paired request/reply alone does not render an activation bar. Do not omit these fields merely because legacy inputs validate without them. Use operand IDs and `parentId`/`parentOperandId` for evidenced `loop → alt` or `opt → par`; do not add loops or parallel work solely to demonstrate notation. Read the sequence section of `references/graph-schema.md`. Never infer pairing or guards from labels; `par` vertical order is layout, not causality. Call groups receive automatic colors, including returns and nested activations.
4. Default output: `<repository-root>/docs/qgraphflow/<scope>-<diagram-type>/`, with a short kebab-case scope or `overview`. Honor user-selected directories, including legacy paths.

## Generate and verify

Resolve this skill directory from the loaded `SKILL.md`, not the client's working directory or a hard-coded installation path. Resolve references, scripts and assets relative to it. Use absolute paths for the input graph and output directory in the target repository; never write user outputs into the plugin installation or cache. Quote paths that may contain spaces.

Run from this skill directory (or invoke these scripts by their resolved absolute paths):

```bash
node scripts/validate-graph.mjs "<absolute-graph.json>" --input-only --repo-root "<absolute-repository-root>"
node scripts/generate-viewer.mjs "<absolute-graph.json>" "<absolute-output-directory>" --repo-root "<absolute-repository-root>"
node scripts/validate-graph.mjs "<absolute-output-directory>/graph.json" --repo-root "<absolute-repository-root>"
```

- Review spacing, type-specific composition and proportional edge motion before accepting the deliverable. Nodes, routes, arrows and stroke widths scale together. Sequence screen dash periods have a 6 CSS px minimum to avoid low-DPI aliasing; baseline, mask and phase share this adjustment. Static SVG/PNG exports retain graph-unit notation.
- Generation defaults to `--layout auto`; `--layout preserve` keeps geometry and applies the same strict gate. Readable point crossings are allowed, including nonplanar graphs. Prefer fewer repeated crossings; reject long shared segments and parallel channels closer than 24px. Keep at least 48px between nodes, 24px between labels and nodes/labels, 6px from unrelated lines, 32px inside boundaries and 48px between sibling groups. Do not shrink text, delete facts or use `--force` to bypass checks. A collection is one delivery: all views must pass before either output is replaced. Source, semantic, geometry and browser rendering evidence are separate.
- If bounded layout fails, report the blocking nodes and relationships and propose separate views with explicit coverage of the original model; never silently reduce the requested detail.
- SVG/PNG exports check current geometry and actual browser glyph bounds after fonts load. Invalid layout remains an editable JSON draft; inspect the reported elements or reset before exporting. PNG rejects blank/failed encoding and dimensions above 32767px or 64 million pixels, without reducing resolution. SVG is assessed independently.
- For repository-backed diagrams, pass the target repository root to both commands. They verify every explicit node source against local UTF-8 files, reject missing files, out-of-range lines and paths escaping that root, and report `sourceEvidence`. This checks the current working tree, not the commit named in `sourceRef` or whether code proves a relationship. If source files are unavailable, disclose that limitation; omitting `--repo-root` reports `skipped`, never verified evidence. Source-free conceptual diagrams need no repository root.
- Reuse the prebuilt `assets/viewer-dist/index.html`. Ordinary graph generation needs no Viewer rebuild or package installation. Execute scripts without loading their implementation, the bundled HTML, or dependency trees into context; inspect only relevant code when diagnosing a concrete failure.
- Outputs are exactly `index.html` and `graph.json`. Use `--force` only with approval to replace the named outputs. Preview examples are not default data or evidence.
- For a collection, inspect every requested diagram type. Open the real generated page at 1440×900 and inspect one screenshot per view for first-screen readability, containment, and console errors. Repeat only after correcting an observed issue. Use browser tooling available in the current client; an automation HTTP server must close in the same process's `finally`. If no browser tool is available, report generation and graph validation separately and mark browser acceptance incomplete; do not claim visual or interaction checks passed.
- For sequence delivery, check the rendered activation bars and nesting, matching call/return colors and IDs, evidenced fragment nesting, solid sync/open async/dashed return notation, and visible flow that preserves those line types. Check static exports for the same bars, pairing and fragments. A valid graph without execution data does not satisfy an activation-bar request.
- Return the two artifact paths, type(s), evidence scope, validation result and unresolved inference/framework boundaries. Keep tool output to summaries or relevant errors; do not paste full HTML or graph JSON into the reply unless requested.

## Viewer maintenance

For Viewer changes or interaction audits, read [viewer-development.md](references/viewer-development.md), including its maintained visual/interaction contract. Changes to Viewer source, routing, schema behavior, or validation require the full nine-type browser matrix described there. Graph-only delivery uses the single-page check above.

Publishing the plugin or creating a remote repository requires separate user authorization.
