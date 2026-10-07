import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { VIEW_TYPES, compareViews, viewTypeOf, viewTypeLabel, viewIdOf } from '../assets/viewer/src/view-identity.js';
import { translate } from '../assets/viewer/src/i18n.js';
import { validateGraphInput } from './validate-graph.mjs';
import { compileGraphLayout } from './compile-layout.mjs';
import { requireDiagramQuality } from '../assets/viewer/src/layout-quality.js';
import { templateDraft, preservesTemplateOrder } from '../assets/viewer/src/layout-templates.js';
import { graphInputWithEdits } from '../assets/viewer/src/session-graph.js';
import { PALETTES, moduleColorMap } from '../assets/viewer/src/visual-style.js';

const collection = JSON.parse(fs.readFileSync(new URL('../../../examples/eleven-templates/collection.graph.json', import.meta.url)));
test('eleven presentation types preserve the legacy architecture protocol and stable independent drafts', () => {
  assert.equal(VIEW_TYPES.length, 11);
  assert.equal(viewTypeOf({ meta: { diagramType: 'architecture' } }), 'relations');
  assert.deepEqual(validateGraphInput(collection, { inputOnly: true }), []);
  const sorted = [...collection.diagrams].reverse().sort(compareViews);
  assert.deepEqual(sorted.map(viewTypeOf), VIEW_TYPES.map(view => view.id));
  assert.deepEqual(sorted.slice(0, 3).map(graph => translate('zh-CN', viewTypeLabel(graph))), ['平台能力架构图', '工程分层架构图', '组件关系架构图']);
  const edited = structuredClone(sorted[0]); edited.nodes[0].label += ' edited';
  const saved = graphInputWithEdits(collection, new Map([[viewIdOf(edited), edited]]), sorted[1]);
  assert.equal(saved.diagrams.find(graph => viewIdOf(graph) === viewIdOf(edited)).nodes[0].label, edited.nodes[0].label);
  for (const graph of collection.diagrams.filter(graph => viewIdOf(graph) !== viewIdOf(edited))) assert.deepEqual(saved.diagrams.find(item => viewIdOf(item) === viewIdOf(graph)), graph);
});

test('every template compiles complete content and reports a measured strategy without altering evidence', async () => {
  for (const input of collection.diagrams) {
    const { graph, report } = await compileGraphLayout(input);
    requireDiagramQuality(graph);
    assert.equal(report.semantics.preserved, true, viewTypeOf(input));
    assert.ok(report.template?.structure, viewTypeOf(input));
    assert.ok(report.template.applied || report.template.fallback === 'lower-normalized-cost', `${viewTypeOf(input)}: a template or a geometry-valid candidate with lower normalized cost`);
    assert.equal(graph.nodes.length, input.nodes.length);
    assert.equal(graph.edges.length, input.edges.length);
    if (viewTypeOf(graph) === 'class') for (const edge of graph.edges.filter(edge => ['implementation', 'inheritance'].includes(edge.kind))) {
      const parent = graph.nodes.find(node => node.id === edge.target), child = graph.nodes.find(node => node.id === edge.source);
      assert.ok(parent.position.y + parent.size.height <= child.position.y, 'The contract remains above its implementation.');
    }
    for (const node of input.nodes) {
      const generated = graph.nodes.find(item => item.id === node.id);
      for (const key of ['label', 'fields', 'methods', 'attributes', 'source', 'groupId']) assert.deepEqual(generated[key], node[key]);
    }
    assert.deepEqual((await compileGraphLayout(graph, { layout: 'preserve' })).graph, graph);
  }
});

test('actor-system template keeps actors outside real ownership and local rearrangement cannot invert columns', () => {
  const input = collection.diagrams.find(graph => viewTypeOf(graph) === 'usecase'), draft = templateDraft(input);
  draft.layout.strategy = 'template-actor-system-0';
  const actors = draft.nodes.filter(node => node.kind === 'actor'), cases = draft.nodes.filter(node => node.kind === 'usecase');
  assert.ok(actors.every(actor => cases.every(item => actor.position.x + actor.size.width < item.position.x)));
  const invalid = structuredClone(draft); invalid.nodes.find(node => node.id === actors[0].id).position.x = cases[0].position.x + cases[0].size.width + 100;
  // Real group membership stays unchanged even when the UI rejects the rearrangement.
  assert.deepEqual(invalid.nodes.map(node => node.groupId), draft.nodes.map(node => node.groupId));
  assert.equal(preservesTemplateOrder(draft, invalid), false);
  assert.equal(templateDraft({ ...input, layout: { direction: 'down' } }), null, 'An authored direction delegates to the pinned directional solver.');
});

test('the botanical palette keeps module identity stable when views switch or reorder', () => {
  for (const palette of Object.values(PALETTES)) {
    const forward = moduleColorMap(collection.diagrams, palette), backward = moduleColorMap([...collection.diagrams].reverse(), palette);
    assert.deepEqual([...forward], [...backward]);
    assert.equal(palette.moduleTones.length, 5);
    assert.equal(new Set(palette.sequenceTones).size, 8, 'paired message IDs retain eight distinct notation colors');
    for (const graph of collection.diagrams) for (const [module, tone] of moduleColorMap([graph], palette)) assert.deepEqual(tone, forward.get(module));
  }
});
