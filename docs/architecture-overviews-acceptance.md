# Architecture overview acceptance

Recorded on 2026-10-06. Implementation base: `d6e54dd`; tested implementation: `c516ff0`. Branch: `codex/architecture-overviews`. The accompanying [receipt](architecture-overviews-evidence.json) records report summaries and artifact hashes.

Both overview templates generate, render, edit, reorder, save, reopen and export successfully. The nine existing diagram types pass their browser matrix. Native macOS Chinese input-method interaction remains pending, so delivery uses a draft PR.

## Source and data evidence

- The original nine diagram types remain. Architecture selects `relations`, `capabilities` or `engineering`. Legacy identities and SVG filenames remain compatible; repeated architecture views use unique `meta.viewId` values. Collections permit up to 32 views.
- `skills/q-flow/scripts/architecture-overview.test.mjs` covers identity collisions, same-template coexistence, invalid/cyclic references, complete and unique node placement, real ownership, relationship directions, preservation through save, diagnostic isolation, long text/badges/notes, nested groups and parallel regions.
- The two Dida reference fixtures in `examples/architecture-overviews/` contain document evidence from `reference.md`. Their versions, implementation status and rules are conceptual claims from the supplied images.
- `source-project.graph.json` is independently anchored to four actual POM files: eight anchors and four source-supported relationships. `mvn -o -f examples/architecture-overviews/source-project/pom.xml validate` completed successfully for all four reactor projects. This verifies the Maven model at the validate phase; it does not establish runtime integration.
- Full test command: `node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs`. Result: **235 passed, 0 failed, 0 skipped**. Local log: `output/acceptance/unit-delivery.log`.

## Layout and drawing evidence

The generator and Viewer use the same overview measurement, section layout, routing, card and section SVG functions. Tests check full text and badge preservation, growth for long paragraphs and parallel grids, section/card boundaries, note and heading collisions, relation paths, export quality failures and preservation of the previous valid canvas after a failed edit.

Viewer build command: `npm --prefix skills/q-flow/assets/viewer run build`; successful. Generated previews:

- `output/demos/architecture-overviews/index.html`: both supplied-image concepts on one page, 34 nodes and 8 relationships.
- `output/demos/source-project/index.html`: separately source-backed four-module example.

Browser checks compare page card markup with shared export rendering, check content bounds and relationship visibility, download actual SVG/PNG files, and inspect SVG content and PNG geometry. Final report exports contain 32 overview files and 36 legacy files; those counts include SVG and PNG separately.

## Browser interaction evidence

Environment: macOS arm64, Node v22.23.2, Chrome 154.0.8037.98. Both themes and all three viewports (`1440×900`, `1920×1080`, `390×844`) are covered.

| Scope | Passed | Local evidence |
| --- | --- | --- |
| Nine original diagram types × two themes × three sizes | 54/54 | `output/acceptance/nine-types-delivery/browser-interactions-report.json` |
| Two overview templates × two themes × three sizes | 12/12 | `output/acceptance/overview-delivery/browser-interactions-report.json` |
| Overview editing, ordering and persistence at all matrix sizes/themes | 12/12 | Same overview-delivery report; screenshots, traces and downloads accompany it |
| Motion preferences for both templates and themes | 4/4 | `output/acceptance/overview-complete/browser-interactions-report.json`, entries ending in `motion-preferences` |

The final matrix and editing runs use the `c516ff0` Viewer. The four motion-preference cases were run before its relation-edit preservation fix; that fix changes only overview edge-edit draft handling. The final matrix repeats movement, zoom and export checks on the delivered Viewer.

Covered operations include search, details, zoom, fullscreen, locking, peer drag ordering and arrow-key ordering, body/badge/section edits, apply/cancel, repeated edits, an applied relationship label surviving subsequent reordering, cross-view state isolation (including repeated templates), current-view reset, save/reopen, cancelled saves and picker/open/write/close failures. Invalid overview edits retain the edit form and previous valid canvas. Target selection uses view IDs.

Composition events and Enter while `isComposing` are tested in the browser. An attempt to exercise the native Chinese input method reached the native Chrome page, but the computer-control pipe closed and could not restart. **System input-method candidate selection, commitment and keyboard behavior are not yet verified.** This is the remaining acceptance item.

Reproduce the overview run by generating the collection and copying the generated directory to an immutable input directory before browser QA (the save/reopen cases intentionally edit their served files):

```sh
node bin/qgraphflow.mjs generate examples/architecture-overviews/collection.graph.json output/demos/architecture-overviews --repo-root .
QA_EXTRAS=overview CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node skills/q-flow/scripts/browser-interactions.mjs INPUT_SNAPSHOT output/acceptance/overview-delivery
```

## Distribution evidence

`node scripts/package.mjs output/distribution/delivery` rebuilt the TGZ and plugin ZIP using the rebuilt Viewer. Version remains `0.0.6` for these local test artifacts; no registry publication was performed.

The TGZ was unpacked into `/private/tmp/qgf-installed-delivery/package`. With `/private/tmp` as the working directory, its installed CLI generated both the overview collection and source-project fixture using the unpacked package as `--repo-root`. All three SVGs and both generated HTML pages were byte-identical to their workspace-generated counterparts. This checks the packaged CLI and assets independently of the checkout.

| Artifact | SHA-256 |
| --- | --- |
| `skills/q-flow/assets/viewer-dist/index.html` | `3fc8f9decc5e6dc592d898a4461f0ba9959ee4945c81f7cf019f0112e5603a4a` |
| `output/distribution/delivery/qgraphflow-0.0.6.tgz` | `8bd41a1eef9bfc0a9343add4d1162664424d4c41ddbc8951435c41a1daa5742b` |
| `output/distribution/delivery/qgraphflow-0.0.6.zip` | `9de782df8185cc5e2b490d4c2644cb984058a7515c22eb1fbf3131e7811c955e` |

## Review and delivery

Independent standards and specification reviews found premature layout during ordering, note/card collision acceptance, no-op drops changing order, one untranslated section label, and applied relationship text being lost after reordering. The implementation and targeted tests were corrected; follow-up reviews confirmed those findings resolved.

Implementation commits follow data/identity, layout/drawing/editing, and skill/examples/acceptance boundaries, followed by focused review fixes. Browser interaction evidence, structural tests, source anchors and packaged-artifact checks above are separate claims. Native input-method acceptance must be completed before treating the entire requested acceptance plan as finished.
