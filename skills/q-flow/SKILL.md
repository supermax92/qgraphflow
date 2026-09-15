---
name: q-flow
description: Create or audit evidence-grounded interactive software diagrams from source, schemas, config, or requirements; deliver offline HTML and graph JSON.
argument-hint: "[module or flow] [what the diagram should answer]"
---

# Q flow

Generate an offline diagram artifact in the target repository, with SVG/PNG downloads in its Viewer.

## Intake

A request is ready when the invocation or the conversation names a subject (repository, module, flow, entity set or document) and the question the diagram must answer, at a matching level: a behaviour question (call order, decisions, data movement, lifecycle) needs one flow or component as its subject, so a repository- or module-level subject with such a question is not ready: find entry points with the file-name and annotation search in [guided-intake.md](references/guided-intake.md) (`rg -l`; do not open source files) and ask which flow. Diagram type, granularity, output directory, language and graph count have defaults and are never asked. When the request is ready, or the skill was triggered by a request already in the conversation, do not ask; start with Evidence.

When both are missing, run one guided round from [guided-intake.md](references/guided-intake.md) before Evidence: inventory the repository first so options name real modules, ask subject and intent in one message with a recommended option, and add a second round only for the cases it lists. When only one is missing, or the level does not match, ask for that one only. Use the client's structured question tool when one exists; otherwise number the options in plain text. After asking, end the turn and wait for the reply; never assume an answer. Write no output files before the round completes.

## Evidence

- Prefer one bounded CodeGraph query when its index is current. CodeGraph is optional; if missing or stale, use [evidence-sources.md](references/evidence-sources.md) for direct tracing and optional setup.
- Use source/tests for calls, DDL/mappings for ER, manifests for deployment, and accepted requirements plus implementation for business behavior.
- Preserve exact identifiers and file/line anchors. Separate repository facts, framework behavior, documents, and inference; omit unproven critical relationships and label other inference. Never put secrets or token values in graph data.

## Author

1. Choose `meta.diagramType` by intent: structure → `architecture`; decisions → `flowchart`; ordered calls → `sequence`; stored data → `er`; runtime placement → `deployment`; types → `class`; lifecycle → `state`; actors/capabilities → `usecase`; data movement → `dataflow`. Default to `architecture` when ambiguous. Use one graph unless the user explicitly requests multiple views; order a collection as architecture, flowchart, sequence, ER, deployment, class, state, use case, then data flow.
2. Read [graph-schema.md](references/graph-schema.md): common fields, routing, the selected kind-table row, and matching type-specific sections. Read [visual-contract.md](references/visual-contract.md) for composition. Skip unrelated types and development references.
3. Write the smallest evidenced graph that answers the question. Set node positions and sizes explicitly; retain complete labels and source facts. Use valid `business` kinds or `core`/`business` tags for the business center, never literal colors or invented kinds. Follow the schema's spacing and text-size guidance. In a collection, reuse one evidence vocabulary and the exact same non-empty `module` value for the same business module; keep type-specific notation complete, including ER keys/cardinalities, class attributes/methods, sequence direction/returns, state guards, and architecture/deployment boundaries.
4. Default output: `<repository-root>/docs/qgraphflow/<scope>-<diagram-type>/`, with a short kebab-case scope or `overview`. Honor user-selected directories, including legacy paths.

## Generate and verify

Resolve this skill directory from the loaded `SKILL.md`, not the client's working directory or a hard-coded installation path. Resolve references, scripts and assets relative to it. Use absolute paths for the input graph and output directory in the target repository; never write user outputs into the plugin installation or cache. Quote paths that may contain spaces.

Run from this skill directory (or invoke these scripts by their resolved absolute paths):

```bash
node scripts/validate-graph.mjs "<absolute-graph.json>" --repo-root "<absolute-repository-root>"
node scripts/generate-viewer.mjs "<absolute-graph.json>" "<absolute-output-directory>" --repo-root "<absolute-repository-root>"
```

- Layout errors block delivery. Resolve warnings where practical by moving nodes before adding route hints; report remaining limitations. Treat a collection as one delivery: validate the complete Graph JSON and inspect every requested diagram type before claiming success.
- For repository-backed diagrams, pass the target repository root to both commands. They verify every explicit node source against local UTF-8 files, reject missing files, out-of-range lines and paths escaping that root, and report `sourceEvidence`. This checks the current working tree, not the commit named in `sourceRef` or whether code proves a relationship. If source files are unavailable, disclose that limitation; omitting `--repo-root` reports `skipped`, never verified evidence. Source-free conceptual diagrams need no repository root.
- Reuse the prebuilt `assets/viewer-dist/index.html`. Ordinary graph generation needs no Viewer rebuild or package installation. Execute scripts without loading their implementation, the bundled HTML, or dependency trees into context; inspect only relevant code when diagnosing a concrete failure.
- Outputs are exactly `index.html` and `graph.json`. Use `--force` only with approval to replace the named outputs. Preview examples are not default data or evidence.
- Open the real generated page at 1440×900 and inspect one screenshot for first-screen readability, containment, and console errors. Repeat only after correcting an observed issue. Use browser tooling available in the current client; an automation HTTP server must close in the same process's `finally`. If no browser tool is available, report generation and graph validation separately and mark browser acceptance incomplete; do not claim visual or interaction checks passed.
- Return the two artifact paths, type(s), evidence scope, validation result and unresolved inference/framework boundaries. Keep tool output to summaries or relevant errors; do not paste full HTML or graph JSON into the reply unless requested.

## Viewer maintenance

For Viewer changes or interaction audits, read [viewer-development.md](references/viewer-development.md), including its maintained visual/interaction contract. Changes to Viewer source, routing, schema behavior, or validation require the full nine-type browser matrix described there. Graph-only delivery uses the single-page check above.

Publishing the plugin or creating a remote repository requires separate user authorization.
