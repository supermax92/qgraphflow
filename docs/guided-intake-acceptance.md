# Guided intake acceptance

The reusable cases in `tests/fixtures/guided-intake-scenarios.json` exercise input routing, clarification, requested views, granularity and evidence selection. They are behavioral evaluation inputs, not automated assertions about model behavior.

## Replay

Create a separate temporary fixture directory for each independent conversation. From the repository root:

```bash
node --input-type=module <<'JS'
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const fixture = JSON.parse(fs.readFileSync('tests/fixtures/guided-intake-scenarios.json', 'utf8'));
const scenarioRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-intake-'));
for (const [relative, content] of Object.entries(fixture.files)) {
  const destination = path.join(scenarioRoot, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
}
for (const [name, relative] of Object.entries(fixture.graphFixtures)) {
  fs.copyFileSync(path.join('tests/fixtures', relative), path.join(scenarioRoot, `${name}.graph.json`));
}
console.log(scenarioRoot);
JS
```

Load the current skill in an independent context with that directory as the target. Give the evaluator only the case's user turns, interface capabilities and raw material; keep `checks` hidden until grading. Deliver subsequent turns only after an actual response. Replace `{output}` with a fresh directory inside the fixture and `{diagram}` with an existing generated diagram directory. Existing-diagram cases start from the durable `existing.graph.json` copied above. Generate it with `--repo-root <scenarioRoot>` into `<scenarioRoot>/diagram`, then preserve the entire directory before evaluation. The selected-view case starts from `existingCollection.graph.json`; generate with `--layout preserve --repo-root <scenarioRoot>`. It contains two distinct view IDs and deliberately displaced geometry in `unchanged-copy`.

The durable detailed, minimal-all-calls and multi-view graphs preserve the original failing inputs. Generate them against the materialized source files without dropping messages or fragments. `sequence-empty-branches.test.mjs` also reduces the containment failure to two participants and tests first, last and consecutive message-free operands. `selected-view.test.mjs` checks unchanged graphs/SVGs, multiple selections, invalid selections, failed preserve gates and legacy ownership migrations.

For document-only cases, use a separate directory containing only the supplied requirements, with no project root. For `document-output`, provide the pasted text without an output directory. For CodeGraph cases, expose controlled unavailable or stale tool/index states and record whether they are simulated or actual. Never modify a real user's index or client configuration for an evaluation.

The fixture's `toolFixtures.staleCodeGraph` can be written to executable `bin/codegraph` under its module-based project, with an empty `.codegraph/` and that `bin` first on `PATH`. Its `codegraph-calls.jsonl` records attempted commands. Write `toolFixtures.structuredQuestion` to `structured-question.cjs` in the temporary run directory and invoke it with question JSON on stdin; it records `structured-question.json` and returns `waiting_for_reply`. These are simulated transports, not client integrations.

Record actual questions, responses, source/document reads, tool outcomes and artifact paths. Check outputs with the skill's input, generation and output-validation commands. Compare source call sites, requested view identities, coverage and retained IDs; valid JSON alone does not establish correct behavior. A mocked structured-question interface checks the adapter contract, not a client's real UI.

## Acceptance criteria

- Every explicit view survives clarification; duplicate non-architecture types use separate outputs.
- Clarification stops only when essential scope is ready or a grounded choice is delegated; unresolved questions create no diagram files.
- Documents and existing graphs supply known context without an unrelated repository questionnaire.
- Expansion reads new evidence before adding detail; simplification preserves established meaning and surviving IDs.
- Capability, engineering and dependency questions select the corresponding architecture views without an extra type-selection round.
- CodeGraph is reported as used only after a current-index preflight and successful query; document-only work makes document claims.
- Default overviews do not pad small systems; minimal styling preserves all explicitly requested calls and error handling.
- Numbered and structured questioning are evaluated separately. Unexecuted cases remain explicitly unverified.

## Initial run before follow-up fixes

Results and limitations are recorded below after execution. No result here implies acceptance in Claude Code, Qoder, WorkBuddy, Cursor or TRAE.

### Source and package checks

On 2026-10-07, `node --test tests/skill-contract.test.mjs tests/plugin-package.test.mjs` passed 14/14 checks. After the final English-only granularity wording change, the nine skill-contract checks passed again. Relative links, fixture JSON, source call coverage, retained IDs and `git diff --check` were checked separately. The entrypoint is 10,169 bytes against its 10,240-byte budget; the common reference is 6,069 bytes against 6,144.

The generic `quick_validate.py` checker could not run because its Python environment lacks PyYAML. No dependency was installed. Existing repository tests covered frontmatter, reference links, documentation skeletons and packaging; they do not replace behavioral evaluation.

### Behavioral results

Nine evaluator contexts were isolated from the implementation conversation and expected answers. They used separate temporary fixture directories. Follow-up user replies were delivered after actual responses. Raw exchanges, tool records, receipts and generated artifacts were retained in the local temporary run `qgraphflow-intake-mee81uwu`; the paths below are relative to that run. Counts describe observed outcomes, not a deterministic model benchmark.

| Scenario | Observed result | Evidence |
| --- | --- | --- |
| Bare invocation, numbered text | Asked subject and question using the real orders/payments/inventory modules and one recommendation per question; no diagram output before a reply. | `dialogue-transcript.md` |
| Bare invocation, structured interface | The simulated adapter recorded two questions, four options each and one recommendation each; returned `waiting_for_reply`; no diagram files. Native client UI remains unverified. | `structured-question.json`, `structured-transcript.md` |
| Package selected after the second round | Asked for a specific checkout flow in the third response rather than inventing one. | `dialogue-transcript.md` |
| Multiple requested views | A later request for both architecture and sequence retained both in the authored collection: 9 nodes, 15 edges, 24/24 anchors, 9/9 relation sites. Generation was blocked by nested sequence geometry. The separate initial multi-view prompt was not executed after the evaluator thread limit was reached. | `dialogue/output/input.json`, `dialogue-transcript.md` |
| Document supplied without a question | Read the requirements and asked only what the diagram should explain, offering dependency, capability, engineering and flow questions. | `document-question-transcript.md` |
| Document supplied without a project/output directory | Asked only for the output destination; did not request a repository, a new document or a diagram type. Generation was intentionally not continued without an answer. | `document-intake-transcript.md` |
| Delegated choice | After "You decide", selected the recommended component-relations view without another confirmation and generated 8 nodes/7 edges; 14 document anchors passed. The observed conversation began from supplied requirements rather than the fixture's bare-command variant. | `document-only/docs/qgraphflow/intake-shop-architecture/`, `document-question-transcript.md` |
| Three architecture questions | Generated capabilities, engineering and relations with distinct view IDs: 19 nodes, 16 edges, 35 document anchors. All edges use document evidence. No implementation verification was claimed. | `documents/output/`, `documents-transcript.md` |
| Default overview | Generated a three-module overview with three cross-module relationships; did not pad to the soft 8-12 target. Semantic, geometry and six source-anchor checks passed. | `stale-index/output/`, `stale-transcript.md` |
| Minimal overview | Generated three real modules and three cross-module dependencies, retaining compensation and recording aggregation. Semantic, geometry and six source-anchor checks passed. | `stale-index-retry/output/`, `index-preflight-transcript.md` |
| Detailed and minimal styling with all calls | Both inputs contain the same six call sites, paired returns and failure fragments. Each passes semantics and 18/18 source anchors, including 6/6 call relations. Neither generated HTML/SVG because nested sequence geometry failed. | `granularity/detailed/graph.json`, `granularity/minimal-style/graph.json`, `granularity-transcript.md` |
| Expand existing diagram | Read new source before adding provider and failure details; expanded 4 nodes/4 edges to 7/10. All original node and edge IDs survived. Generated in the same directory; semantics, geometry and 17 anchors passed. | `refresh/.bookkeeping/expanded-graph.json`, `refresh-transcript.md` |
| Simplify existing diagram | Reduced the expanded diagram to three modules/three cross-module relationships. Surviving IDs, reserve/charge/release dependencies and compensation caveats remained; helpers were aggregated into their owning modules. All three artifacts and six anchors passed. | `refresh/output/`, `refresh-transcript.md` |
| CodeGraph unavailable | The first mock CLI failed at startup because its CommonJS code ran in an ES-module fixture. The evaluator accurately reported failed preflight and used direct tracing. This proves the failed-tool fallback only, not stale-index detection. | `stale-transcript.md` |
| CodeGraph stale | A corrected simulated CLI returned stale status. Its call log contains exactly one `status`, with no query, installation or refresh. The evaluator used direct tracing and generated a valid minimal overview. | `stale-index-retry/codegraph-calls.jsonl`, `index-preflight-transcript.md` |

The implementation agent independently revalidated the generated document collection, expanded and simplified architecture models, default/minimal overviews and the preserved sequence inputs. It also compared exact call sites and original/surviving IDs rather than relying solely on evaluator summaries.

### Observed exchange excerpts

- Bare invocation: "Which part should the diagram cover?" and "What should the diagram answer?"
- User: "Show the order module call sequence." Assistant: "The order module has two groups of entry points. Which should we narrow down?"
- User: "The checkout package." Assistant: "Which checkout operation should I trace?"
- User then selected the create-order flow and explicitly added a system overview. Both view types remained in the input collection.
- Document-only input with no project/output: "What absolute output directory should I use for the order-placement flowchart?"
- Document with missing question: "What should the diagram explain about Intake Shop from requirements.md?"
- Stale-index result: "CodeGraph reported a stale index; I used direct tracing without querying, retrying, or refreshing it."

### Initial generation blockers

The first document overview generation encountered `text.node-height`; preserving the existing subtitle/facts in supported `overviewText` resolved the error without deleting facts. All three views then passed generation and output validation.

The multi-view and detailed/minimal-style sequence exercises exposed `sequence.fragment` containment failures for nested validation, persistence and compensation fragments. Semantic and source checks passed; the documented `--fix` made no changes; bounded generation still failed. The evaluators retained all requested facts and view counts, reported the blockers and proposed a split without performing it. At that stage, no layout-engine code was changed and these cases were not complete diagram deliveries. The follow-up below fixes and replays them.

At the end of that initial run, the exact standalone multi-view prompt and bare-command delegated-choice variant were unverified. Both were executed in the follow-up below. Structured questioning and stale-index status used explicit simulated transports. No native-client interactive acceptance, browser rendering acceptance, runtime business integration, publication or installed-copy update was performed.


## Follow-up fixes and replay

The follow-up changes keep audits read-only, make mixed source/document routing mandatory, and constrain collection updates to the requested view IDs. `generate-viewer.mjs --view <view-id>` repeats for multiple targets; unselected views must pass preserve without migration. Invalid selections, invalid preserved geometry or required migration stop before any output replacement.

Nested sequence fragments now allocate message-free operand boundaries from adjacent content and measured text instead of dividing the entire parent frame evenly. The original detailed model retains six participants, twelve messages, six fragments and six execution bars. Browser glyph measurement also exposed a one-pixel overlap between a participant's type label and title when a subtitle was present. Moving that title and subtitle down three pixels preserves the text, header size and graph facts; SVG/PNG export now passes for the original model.

### Behavioral evidence

Two new evaluator contexts received only the current skill, raw fictional fixture and actual user turns. They were independent of the implementation conversation and grading criteria. After those conversations, the same evaluators handled the three additional scenarios in separate fixture directories; these later cases reused evaluator context and are not described as fresh conversations. A thread limit prevented additional fresh evaluators. No native client integration is implied.

| Scenario | Actual result | Durable record |
| --- | --- | --- |
| Initial multi-view request | Asked only which order flow to trace; after the reply, generated architecture plus sequence with 24/24 anchors and 9/9 eligible relation sites. | [Exchange and commands](guided-intake-evidence/multiple-transcript.md) |
| Bare invocation, then “You decide” | Asked subject/question, then selected the recommended whole-project dependency view without another confirmation; generated three modules and three calls with six valid anchors. | [Exchange and commands](guided-intake-evidence/delegated-transcript.md) |
| Read-only audit | Read source, reported scope/provenance gaps and optional additions; ran validation without repair or generation. HTML, JSON and SVG SHA-256 hashes are unchanged. | [Audit](guided-intake-evidence/audit-transcript.md) |
| Complete mixed-evidence request | Read requirements and implementation; generated seven source-backed relationships and one visibly documented-only storefront relationship. Fifteen anchors passed. | [Mixed evidence](guided-intake-evidence/mixed-transcript.md) |
| Expand one collection view | Expanded `order-service` from four nodes/four edges to eight/eight using new evidence and `--view order-service`. The other complete graph and SVG hash are unchanged; 24 anchors passed. | [Selected view](guided-intake-evidence/selected-transcript.md) |
| Original failed inputs | Detailed, minimal styling with all calls, and multi-view models all pass input, generation and output validation without deleting facts. | [Command receipts](guided-intake-evidence/generation-receipts.json) |

[Artifact comparisons](guided-intake-evidence/artifact-comparisons.json) were independently checked by the implementation agent. Transcript paths use `{run}` for the isolated temporary root and `{repository}` for this checkout. The source fixtures, original failure models and existing-diagram baselines are retained in this working tree under `tests/fixtures/guided-intake/`; no private material is used. These records preserve observed behavior, not a promise that every model or client behaves identically.

### Final verification

- Full regression suite: `node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs` passed **276/276**.
- Skill contract and package suite: **14/14** passed separately, including packaged generator/viewer checks.
- Rebuilt the layout worker and Viewer. The existing dependency symlink makes Vite's default config cache unwritable from this worktree; `--configLoader runner` avoids writing into that dependency directory. The isolated module-extension test now uses the same loader.
- Standard eleven-template browser matrix: **66/66** passed, with 44 successful SVG/PNG downloads. Original detailed sequence: **6/6** passed, with four successful downloads. All use 1440x900, 1920x1080 and 768x1024 in light/dark themes. Actual cases, export hashes and parity results are retained in [browser results](guided-intake-evidence/browser-results.json).
- The original English generated SVG and the browser-test locale both have a two-pixel type/title gap and three-pixel title/subtitle gap in Chrome; see [glyph measurements](guided-intake-evidence/glyph-measurements.json).
- 30 local documentation links, fixture JSON, document skeletons, source call-site equality, retained IDs and `git diff --check` passed. No code comments were added. Main skill size is 10,230/10,240 bytes; common rules are 6,121/6,144; architecture is 6,117/6,144; sequence is 6,137/6,144.

[Test receipts](guided-intake-evidence/test-results.json) record the commands, counts and final source/bundle hashes.

The standard browser matrix uses the existing harness's Chinese UI locale; authored graph text and topology are unchanged. An initial attempt with English UI stopped at Chinese control selectors, so it was not accepted. The original English SVG was separately opened in Chrome for actual glyph measurement.

The optional `sequence-reading` stress helper was also attempted. Its narrow-screen assertion requires a full participant header to fit between both open side panels, and its long-label case assumes the edit must create a layout error. Those assumptions do not hold for this large fixture: the available panel gap is narrower than a readable header, and the enlarged model remains valid. Its [recorded failures](guided-intake-evidence/optional-stress-results.json) retain the original export failures as superseded by the final checks. That optional helper is not reported as passed; its results are separate from the required matrix and real export checks. Native application acceptance in Claude Code, Qoder, WorkBuddy, Cursor and TRAE remains unverified. No publication, installation update, commit or push was performed.
