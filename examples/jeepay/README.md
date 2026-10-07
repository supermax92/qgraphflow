# Jeepay source corpus

The only business dataset used by CI, Pages and package smoke tests is the public [Jeepay repository](https://github.com/jeequan/jeepay). `source.json` records the exact revision and SHA-256 of every referenced source file. No Java source, credentials or developer machine paths are distributed here.

The collection contains eleven views: platform capabilities, engineering layers, component relationships, unified-order flowchart and sequence, payment ER, Compose deployment, payment classes, order states, API use cases and unified-order data flow. All inputs contain facts and source anchors; generated coordinates and routing snapshots are deliberately excluded.

CI checks out the revision declared in `source.json`, verifies every node source and relationship site, and computes fresh layouts. Assertions cover preserved facts, valid notation and geometry, export, saving, cancellation and selected-view isolation. They do not lock a particular diagram's dimensions, node count, crossing count, candidate count or solver strategy.

For local checks, select the source explicitly:

```bash
export JEEPAY_REPO_ROOT="<local Jeepay repository root>"
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
node skills/q-flow/scripts/generate-viewer.mjs examples/jeepay/collection.graph.json output/jeepay --repo-root "$JEEPAY_REPO_ROOT"
```

To refresh the corpus after reviewing updated Jeepay source and updating its eleven diagrams under `docs/qgraphflow/`, run:

```bash
node scripts/refresh-jeepay-fixtures.mjs "$JEEPAY_REPO_ROOT"
```

Review the changed facts, evidence and `source.json` together. No saved geometry baseline needs replacing. Schema tests may mutate a copy of a Jeepay graph to exercise invalid input; those mutations are never presented as repository facts. Pure geometry, text, notation and localization unit parameters are separate from the business corpus.
