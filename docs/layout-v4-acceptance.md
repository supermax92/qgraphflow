# Layout v4 acceptance

The local implementation of [the layout contract](layout-v4-contract.md) passed the following checks. Public fixtures are independently designed fictional examples. The existing uncommitted changes were retained; no dependency, commit, push or release was added.

| Check | Result | Evidence |
| --- | --- | --- |
| Complete repository suite | 301 passed, 0 failed | [Test log](../output/playwright/routing-v4/delivery-tests.log) |
| Latest routing correction | 25 affected tests passed again | [Routing log](../output/playwright/routing-v4/delivery-routing-tests.log) |
| Production Viewer build | Passed | [Build log](../output/playwright/routing-v4/delivery-build.log) |
| Eleven views, two desktop sizes, both themes | 44 / 44 passed | [Browser matrix](../output/playwright/routing-v4/delivery-matrix/browser-interactions-report.json) |
| Actual SVG and PNG downloads | 88 files; path, notation and decoding checks passed | [Exports](../output/playwright/routing-v4/delivery-matrix/exports/) |
| Editing and persistence | 42 / 42 final cases passed | [Combined acceptance record](../output/playwright/routing-v4/delivery-acceptance.json) |

The desktop matrix covers 1440×900 and 1920×1080, light and dark themes, three architecture views, flowchart, sequence, ER, deployment, class, state, use case and data flow. Page geometry remains unchanged by fitting and exporting. Full exports were also visually reviewed in both themes for all eleven views, with page screenshots checked at both sizes.

The interaction checks cover real offline Worker cancellation, stale-result protection, failure recovery with editable drafts, manual placement and ownership, cross-view switching, save cancellation/open/write/close failures, saved-file reopening, overview text and badge edits, explicit keyboard ordering and exports. Source regressions additionally cover queued success/failure after reset, legacy geometry preservation and selective clearance enforcement after local edits.

The first overview interaction run still expected additional badge height to trigger global rearrangement. The script now verifies the approved local-edit behavior: insufficient space retains the complete draft and accepted canvas; an edit that fits can save. All eight corrected overview cases passed. The [initial interaction log](../output/playwright/routing-v4/delivery-interactions/browser-interactions-report.json) and [overview rerun](../output/playwright/routing-v4/delivery-overviews/browser-interactions-report.json) remain available, and the combined record replaces only those eight superseded assertions.

Safety violations block new output. Complexity warnings remain advisory, and a bounded search does not establish global optimality or prove a route impossible. Evidence and generated previews under `output/` are local ignored artifacts. No unresolved failure remains in the final acceptance cases above.
