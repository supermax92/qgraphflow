import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { collection, source, repoRoot, jeepay, compiled, facts } from './jeepay.mjs';
import { validateGraphInput, verifySourceEvidence } from '../skills/q-flow/scripts/validate-graph.mjs';
import { compileGraphLayout } from '../skills/q-flow/scripts/compile-layout.mjs';
import { requireDiagramQuality } from '../skills/q-flow/assets/viewer/src/layout-quality.js';
import { createDiagramSvg } from '../skills/q-flow/assets/viewer/src/export-svg.js';
import { PALETTES } from '../skills/q-flow/assets/viewer/src/visual-style.js';

test('Jeepay is the single coordinate-free corpus, with all eleven distinct templates', () => {
  assert.deepEqual(collection.diagrams.map(g => g.meta.architectureView ?? g.meta.diagramType),
    ['capabilities', 'engineering', 'relations', 'flowchart', 'sequence', 'er', 'deployment', 'class', 'state', 'usecase', 'dataflow']);
  assert.deepEqual(validateGraphInput(collection, { inputOnly: true }), []);
  assert.doesNotMatch(JSON.stringify(collection), /"(?:position|size|route)":/);
  for (const graph of collection.diagrams) assert.equal(graph.meta.sourceRef, `${source.repository}@${source.revision}`);
});

test('every Jeepay source file and relationship site matches the selected real checkout', () => {
  assert.ok(fs.existsSync(repoRoot), 'Set JEEPAY_REPO_ROOT to the Jeepay source repository, or run the CI source checkout step.');
  for (const [file, hash] of Object.entries(source.files)) {
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(repoRoot, file))).digest('hex'), hash, file);
  }
  const receipt = verifySourceEvidence(collection, repoRoot);
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.checked, receipt.references);
  assert.equal(receipt.relations.sited, receipt.relations.eligible);
  assert.ok(receipt.relations.eligible > 0);
});

for (const view of source.views) {
  const id = view.id.replace('jeepay-', '');
  test(`Jeepay ${id}: fresh layout preserves every fact, passes quality and exports both themes`, async () => {
    const input = jeepay(id), before = structuredClone(input), { graph, report } = await compiled(id);
    assert.deepEqual(input, before);
    assert.equal(report.semantics?.preserved, true);
    assert.deepEqual(facts(graph), facts(input));
    assert.doesNotThrow(() => requireDiagramQuality(graph));
    assert.deepEqual((await compileGraphLayout(graph, { layout: 'preserve' })).graph, graph);
    for (const theme of Object.keys(PALETTES)) {
      const svg = createDiagramSvg(graph, theme);
      assert.match(svg, /<svg\b/);
      assert.doesNotMatch(svg, /(?:NaN|Infinity)/);
      assert.ok(svg.includes('</svg>'));
    }
  });
}

test('Jeepay layout is repeatable from facts, without a saved geometry golden', async () => {
  for (const id of ['relations', 'state', 'er']) {
    const before = (await compiled(id)).graph;
    const after = (await compileGraphLayout(jeepay(id))).graph;
    assert.deepEqual(after, before);
  }
});

test('malformed copies of actual Jeepay input fail the semantic gate', () => {
  for (const mutate of [g => { g.nodes[0].kind = 'invalid'; }, g => { g.edges[0].target = 'missing'; },
    g => { g.nodes[0].source.lineStart = 0; }, g => { g.nodes.push(structuredClone(g.nodes[0])); }]) {
    const input = jeepay('relations'); mutate(input);
    assert.ok(validateGraphInput(input, { inputOnly: true }).length > 0);
  }
});
