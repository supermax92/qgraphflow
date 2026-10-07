---
name: q-flow
description: Create, audit or refresh evidence-grounded interactive software diagrams from source, schemas, config, or requirements; deliver offline HTML, graph JSON and SVG.
argument-hint: "[module or flow] [what the diagram should answer]"
---

# Q flow

Offline HTML diagrams with SVG/PNG downloads.

## Intake

Resolve intent first: an audit is read-only, even if source drift is found. Read and validate without `--fix`; report findings without generation, edits or `--force`. Only an explicit update enters Refresh. Read all supplied material, combining source and documents when requested; distinguish implemented facts from documented intent. Existing graphs supply scope, type, granularity, views and directory; inherit these unless changed.

A request is ready when every requested view has a subject and question. Structure accepts a system, module or entity set; behaviour needs a flow or component, including one described in a document. For missing scope or output location, use [guided-intake.md](references/guided-intake.md). Ask only for missing information, usually in one or two rounds; continue if essential scope remains unclear. Use a structured question tool when available, otherwise numbered options. After asking, end the turn and wait for the reply; never assume an answer. Write no output files before the round completes.

For every ready request, apply [Granularity](references/graph-common.md#granularity) before Evidence, even when intake is skipped. Default unspecified preferences; then start without another confirmation.

## Evidence

- For repository evidence, follow [evidence-sources.md](references/evidence-sources.md): verify tool/index availability before reporting CodeGraph, otherwise trace directly. Documents use document evidence.
- Use source/tests for calls, DDL/mappings for ER, manifests for deployment, and accepted requirements plus implementation for business behavior.
- Preserve exact identifiers and file/line anchors. Separate repository facts, framework behavior, documents, and inference; omit unproven critical relationships and label other inference. Never put secrets or token values in graph data.
- Public examples and documentation must use independently authored fictional content or public sources. Never reuse private project names, paths, architecture, rules, versions, status or reference images; renaming them is insufficient. Remove affected generated copies when replacing private-derived examples. This does not restrict private diagrams explicitly requested for the user's own project.

## Author

Eleven templates: three architecture views (`meta.architectureView`: `capabilities`, `engineering`, `relations`) and eight other types below.

1. Choose `meta.diagramType` by intent: structure → `architecture`; decisions → `flowchart`; ordered calls → `sequence`; stored data → `er`; runtime placement → `deployment`; types → `class`; lifecycle → `state`; actors/capabilities → `usecase`; data movement → `dataflow`. Default to `architecture` when ambiguous. Architecture: platform capabilities / business integration → `capabilities`; engineering organization / component layers → `engineering`; component calls / dependencies → `relations`. Use one graph unless the user explicitly requests multiple views.
2. Each view uses [graph-common.md](references/graph-common.md) and its matching page in [references/types/](references/types/) (`types/<diagramType>.md`); reuse loaded references across views. Do not read `graph-schema.md`, `visual-contract.md`, `examples/`, `scripts/`, `assets/` or tests to learn rules. Use the type skeleton and validator messages for fields.
3. Write the evidenced graph at the chosen granularity, without coordinates. Record level/coverage in `meta.scope` and check every user requirement before layout. Apply the common rules for names, evidence, ownership, order and business centre. Across views reuse the same non-empty `module` value for the same business module. Preserve ER keys/cardinalities, class members/multiplicities, sequence pairing/fragments/executions, state guards and architecture/deployment boundaries required at this level. Write once; correct only reported fields.
4. Templates measure text and preserve order; routes use feasible outlines and independent labels. Never remove facts.
5. Default output: `<repository-root>/docs/qgraphflow/<scope>-<diagram-type>/`. Document-only work uses the current project root instead; without a suitable project or specified directory, ask only for the output location. Honor user-selected directories.

## Generate and verify

Resolve the skill directory from the loaded `SKILL.md`, not the client's working directory or a hard-coded installation path. Quote absolute paths in the target repository; never output into plugin caches.

Run from the skill directory:

```bash
node scripts/validate-graph.mjs "<absolute-graph.json>" --input-only --repo-root "<absolute-repository-root>"
node scripts/generate-viewer.mjs "<absolute-graph.json>" "<absolute-output-directory>" --repo-root "<absolute-repository-root>"
node scripts/validate-graph.mjs "<absolute-output-directory>/graph.json" --repo-root "<absolute-repository-root>"
```

- Execute the scripts; do not read them, the bundled HTML, the Viewer source or tests. `--help` lists every option. Failures report elements, rule, measurement and remediation; `--verbose` prints the receipt.
- On failure, run `node scripts/validate-graph.mjs "<graph.json>" --input-only --fix --repo-root "<root>"` first: it repairs sequence order, operand ids, unambiguous replies/callee bars and unique source/site symbols, prints changes and writes only a valid graph. Then edit only reported fields/elements and rerun. Rewrite the whole file only for a wrong type or view split. Never delete supported facts, shrink text or use `--force` to pass a check.
- Composition warnings never fail the run; input validation prints them, later commands count them (`warnings: n`). Fix `module.missing`, `module.inconsistent`, `flowchart.process-branch` (a non-decision branches) and `edge.site-missing`. For `module.single-tone`, keep one module if the flow really belongs to it; never rename a module for colour. `view.oversized` means over 4 screens at readable zoom: apply the common contract's view-splitting rules while preserving requested detail and graph count. A failing collection names every failing view.
- If bounded layout still fails, distinguish a search budget from proven impossibility, report the blocking nodes and relationships and propose separate views with explicit coverage of the original model; never silently reduce the requested detail. Generation defaults to `--layout auto`; `--layout preserve` keeps existing geometry under the same gate.
- For repository-backed diagrams, pass the target repository root to both commands: they verify every node `source` and edge `site` against local UTF-8 files (existence, line range, symbol, no path escape) and report `sourceEvidence` with its `relations` coverage. This checks the working tree, not the commit in `sourceRef` or whether code proves a relationship. Omitting `--repo-root` reports `skipped`, never verified evidence; say so when source files are unavailable. Conceptual diagrams need no root.
- Outputs are `index.html`, `graph.json` and one SVG per view (`diagram.svg`, or `diagram-<n>-<type>.svg` in a collection), built from the prebuilt viewer; no rebuild or install. Use `--force` only with approval to replace the named outputs. All collection views must pass before replacing output.
- Reply with artifact paths, types, granularity and coverage (`meta.scope`), semantic/geometry/source-relation results, `meta.notes`, unresolved evidence boundaries, and `Browser acceptance: not performed` unless the next section ran. Never paste full HTML or graph JSON.

## Acceptance on request

Ordinary graph delivery ends with the three commands above. Run the browser checks in [acceptance.md](references/acceptance.md) only when (a) the user asks to see or check the rendering, (b) the delivery includes Viewer changes, or (c) a receipt reports rendering diagnostics; read that file only then. Otherwise the reply carries `Browser acceptance: not performed`.

## Refresh an existing diagram

Read the supplied graph and collection metadata. Inherit type, scope, granularity, view count and directory. An explicit update approves `--force` for that directory; audit findings alone do not. Resolve only the requested views; ask if their identity is ambiguous.

Simplification uses verified facts in Author. Expansion returns to Evidence before Author. Preserve stable IDs; report gaps, aggregations, additions and exclusions. These changes authorize `--layout auto --force` for the requested views only. In a collection add `--view <view-id>` for each changed view; omit it only when all views need layout. Unselected views must pass preserve; never relayout them to clear a failure. Ordinary refresh preserves geometry:

```bash
node scripts/validate-graph.mjs "<dir>/graph.json" --input-only --fix --repo-root "<root>"
node scripts/generate-viewer.mjs "<dir>/graph.json" "<dir>" --layout preserve --force --repo-root "<root>"
```

Between the two, fix only anchors still reported: read just their files, edit just those `source` / `site` anchors or facts, and report a symbol you cannot place. Then validate the output as above. `preserve` keeps the user's moved positions and edited text; if it fails the gate, report the nodes and ask before `--layout auto`. Reply with the changed anchors and every artifact path. If a browser could only download `graph.json`, put it in `<dir>` and regenerate the page and SVGs.

## Viewer maintenance

For Viewer changes or interaction audits, read [viewer-development.md](references/viewer-development.md), including its maintained visual/interaction contract. Changes to Viewer source, routing, schema behavior, or validation require the full eleven-view browser matrix described there. Graph-only delivery uses the single-page check in [acceptance.md](references/acceptance.md).

Publishing the plugin or creating a remote repository requires separate user authorization.
