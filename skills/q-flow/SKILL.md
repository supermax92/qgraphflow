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

1. Choose `meta.diagramType` by intent: structure → `architecture`; decisions → `flowchart`; ordered calls → `sequence`; stored data → `er`; runtime placement → `deployment`; types → `class`; lifecycle → `state`; actors/capabilities → `usecase`; data movement → `dataflow`. Default to `architecture` when ambiguous. Use one graph unless the user explicitly requests multiple views; order a collection as architecture, flowchart, sequence, ER, deployment, class, state, use case, then data flow.
2. Read exactly two files: [graph-common.md](references/graph-common.md) and the matching type page in [references/types/](references/types/) (`types/<diagramType>.md`). Do not read `graph-schema.md`, `visual-contract.md`, `examples/`, `scripts/`, `assets/` or any test to learn rules: the two pages carry every rule the validator applies plus a minimal valid skeleton, and anything they leave open is settled by the validator's message, not by reading implementation.
3. Write the complete evidenced graph that answers the question, as facts without coordinates — layout is computed. Real names and full labels; `evidence` on every edge; `source` anchors on repository-backed nodes; `groupId` / `parentId` for real ownership only; `layout.rank`, `layout.order`, `primaryPath` or `participantOrder` only for an order the source already has. Mark the business center with the `business` kind or a `core` tag, never literal colors or invented kinds. In a collection, reuse the same non-empty `module` value for the same business module. Preserve ER keys/cardinalities, class members/multiplicities, sequence pairing/fragments/executions, state guards and architecture/deployment boundaries. Write the file once and complete; later corrections are edits to the reported fields.
4. Default output: `<repository-root>/docs/qgraphflow/<scope>-<diagram-type>/`, with a short kebab-case scope or `overview`. Honor user-selected directories, including legacy paths.

## Generate and verify

Resolve this skill directory from the loaded `SKILL.md`, not the client's working directory or a hard-coded installation path. Resolve references, scripts and assets relative to it. Use absolute paths for the input graph and output directory in the target repository; never write user outputs into the plugin installation or cache. Quote paths that may contain spaces.

Run from this skill directory (or invoke the scripts by their resolved absolute paths):

```bash
node scripts/validate-graph.mjs "<absolute-graph.json>" --input-only --repo-root "<absolute-repository-root>"
node scripts/generate-viewer.mjs "<absolute-graph.json>" "<absolute-output-directory>" --repo-root "<absolute-repository-root>"
node scripts/validate-graph.mjs "<absolute-output-directory>/graph.json" --repo-root "<absolute-repository-root>"
```

- Execute the scripts; do not read them, the bundled HTML, the Viewer source or tests. `--help` lists every option. A successful run prints one summary line; a failed run prints the failing elements with rule, measurement and remediation, and `--verbose` prints the full receipt when you need it.
- On failure, repair in this order: `node scripts/validate-graph.mjs "<graph.json>" --input-only --fix --repo-root "<root>"` (renumbers sequence `order`, fills operand ids and unambiguous `replyTo`, prints each change, writes back only when the graph then passes); then edit only the reported fields of the reported elements and rerun. Rewrite the whole file only when the diagram type or the split into views was wrong. Never delete supported facts, shrink text or use `--force` to pass a check.
- Composition warnings never fail the run; the input validation step prints them in full, the later two only count them in the receipt (`warnings: n`). Fix `module.missing` (an ordinary node without the module of the subsystem whose work it performs), `module.inconsistent` (the same component with different modules across views) and `flowchart.process-branch` (a non-decision that branches). `module.single-tone` asks whether the steps of a flow really are one subsystem's work — if they are, leave it. `module.slot-collision` is informational: eight colour slots repeat by design and the module label stays authoritative, so never rename a module for colour; `--module-slot <name>` only helps choose the name of a module you are introducing. A failing collection names every failing view in one run.
- If bounded layout still fails, report the blocking nodes and relationships and propose separate views with explicit coverage of the original model; never silently reduce the requested detail. Generation defaults to `--layout auto`; `--layout preserve` keeps existing geometry under the same gate.
- For repository-backed diagrams, pass the target repository root to both commands: they verify every node `source` against local UTF-8 files (existence, line range, no path escape) and report `sourceEvidence`. This checks the working tree, not the commit in `sourceRef` or whether code proves a relationship. Omitting `--repo-root` reports `skipped`, never verified evidence; say so when source files are unavailable. Conceptual diagrams need no root.
- Outputs are exactly `index.html` and `graph.json`, built from the prebuilt `assets/viewer-dist/index.html`; no Viewer rebuild or package installation. Use `--force` only with approval to replace the named outputs. A collection is one delivery: all views must pass before either output is replaced.
- Reply with: the two artifact paths, diagram type(s), evidence scope, the validation result (semantic, geometry, source evidence), unresolved inference or framework boundaries, and the line `Browser acceptance: not performed` unless the next section ran. Keep tool output to summaries or relevant errors; never paste full HTML or graph JSON.

## Acceptance on request

Ordinary graph delivery ends with the three commands above. Run the browser checks in [acceptance.md](references/acceptance.md) only when (a) the user asks to see or check the rendering, (b) the delivery includes Viewer changes, or (c) a receipt reports rendering diagnostics; read that file only then. Otherwise the reply carries `Browser acceptance: not performed`.

## Viewer maintenance

For Viewer changes or interaction audits, read [viewer-development.md](references/viewer-development.md), including its maintained visual/interaction contract. Changes to Viewer source, routing, schema behavior, or validation require the full nine-type browser matrix described there. Graph-only delivery uses the single-page check in [acceptance.md](references/acceptance.md).

Publishing the plugin or creating a remote repository requires separate user authorization.
