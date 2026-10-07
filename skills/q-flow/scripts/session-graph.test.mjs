import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { compileGraphLayout } from './compile-layout.mjs';
import { compactCards, cardText } from '../assets/viewer/src/diagrams/registry.js';
import { requireDiagramQuality } from '../assets/viewer/src/layout-quality.js';
import { nudgeGraphLayout } from '../assets/viewer/src/layout-nudge.js';
import { layoutLimits } from '../assets/viewer/src/layout-spacing.js';
import { groupHeadingLayout } from '../assets/viewer/src/text-layout.js';
import { getDiagram } from '../assets/viewer/src/diagrams/registry.js';
import { refineDiagramLayout } from '../assets/viewer/src/layout-refinement.js';
import { fitCard, placed } from '../assets/viewer/src/session-graph.js';
import { LAYOUT_VERSION } from '../assets/viewer/src/layout-policy.js';

const showcase = path.join(import.meta.dirname, '../../../examples/showcase');
async function architecture(name) {
  const input = JSON.parse(fs.readFileSync(path.join(showcase, name), 'utf8'));
  return (await compileGraphLayout(input.diagrams.find(graph => graph.meta.diagramType === 'architecture'))).graph;
}

// Card measurement alone is tested below; the page also reroutes and, if needed, repairs local gaps.
function edited(graph, id, suffix) {
  const draft = { ...graph, nodes: graph.nodes.map(node => node.id === id ? { ...node, label: node.label + suffix } : node) };
  return placed(draft, fitCard(draft, id, !compactCards(graph)));
}

// Kafka's accumulator and replica have connections on both their top and bottom edges: a taller card cannot keep both stubs clear.
test('a short label added to any architecture card keeps the whole view valid', async () => {
  for (const [name, ids] of [['ecommerce.zh-CN.graph.json', null], ['kafka.zh-CN.graph.json', ['producer', 'sender', 'apis', 'log']]]) {
    const graph = await architecture(name);
    for (const { id } of graph.nodes.filter(node => !ids || ids.includes(node.id))) {
      const fitted = edited(graph, id, ' QA');
      let result;
      try { result = refineDiagramLayout(fitted, { move: false, evaluations: 1, passes: 2 }).graph; }
      catch { result = refineDiagramLayout(fitted, { move: true, focusId: id, evaluations: 12, passes: 1 }).graph; }
      assert.doesNotThrow(() => requireDiagramQuality(result), `${name}: ${id} + " QA"`);
      assert.ok(compactCards(result), `${name}: ${id} keeps the view on compact cards`);
    }
  }
});

test('only the card that needs more height grows, by the extra title line', async () => {
  const graph = await architecture('ecommerce.zh-CN.graph.json'), original = id => graph.nodes.find(node => node.id === id);
  original('checkout').size.height = cardText(original('checkout'), 'architecture', graph.meta.locale).minHeight;
  const result = edited(graph, 'checkout', '\nQA');
  assert.deepEqual(result.nodes.filter(node => node.size.height !== original(node.id).size.height).map(node => node.id), ['checkout']);
  assert.equal(result.nodes.find(node => node.id === 'checkout').size.height - original('checkout').size.height, 26);
  original('risk').size.height = cardText({ ...original('risk'), label: original('risk').label + ' QA' }, 'architecture', graph.meta.locale).minHeight;
  assert.deepEqual(edited(graph, 'risk', ' QA').nodes.map(({ label, ...node }) => node), graph.nodes.map(({ label, ...node }) => node), 'a label that still fits changes no geometry');
});

test('a card whose connections leave its bottom grows upward and keeps boundary clearance', () => {
  const before = { id: 'producer', label: 'Producer', kind: 'component', groupId: 'producer-jvm', position: { x: 160, y: 160 }, size: { width: 320, height: 100 } };
  before.size.height = cardText(before, 'architecture', 'en').minHeight;
  const graph = { meta: { title: 'Edit growth', diagramType: 'architecture', sourceRef: 'conceptual:edit-growth' }, nodes: [before, { id: 'sink', label: 'Sink', kind: 'component', position: { x: 160, y: 500 }, size: { width: 320, height: 100 } }], groups: [{ id: 'producer-jvm', kind: 'ownership', label: 'Runtime', position: { x: 100, y: 70 }, size: { width: 440, height: 300 } }], edges: [{ id: 'send', source: 'producer', target: 'sink', kind: 'call', evidence: 'inference', route: { via: [{ x: 320, y: 160 + before.size.height + 12 }, { x: 320, y: 488 }] } }] };
  graph.layout = { version: LAYOUT_VERSION };
  graph.edges[0].route.via = [{ x: 320, y: 160 + before.size.height + 12 }, { x: 560, y: 160 + before.size.height + 12 }, { x: 560, y: 550 }, { x: 492, y: 550 }];
  requireDiagramQuality(graph);
  const result = edited(graph, 'producer', '\nQA'), after = result.nodes.find(node => node.id === 'producer');
  assert.equal(after.position.y + after.size.height, before.position.y + before.size.height, 'the bottom edge, where its connection leaves, stays put');
  const grown = result.groups.find(group => group.id === 'producer-jvm');
  assert.ok(after.position.y >= grown.position.y + groupHeadingLayout(grown).height + layoutLimits(getDiagram('architecture')).groupHeadingGap, 'the complete heading keeps its safety clearance');
  assert.doesNotThrow(() => requireDiagramQuality(result));
});

test('Arrange keeps the spacing the compact cards were laid out with', async () => {
  const graph = await architecture('ecommerce.zh-CN.graph.json'), result = nudgeGraphLayout(graph);
  assert.equal(result.rejected, undefined, JSON.stringify(result.rejected?.diagnostics.map(item => item.ruleId)));
  assert.deepEqual(result.movedNodeIds, [], 'a valid compact layout needs no spacing change');
});
