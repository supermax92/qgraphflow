import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { compileGraphLayout } from './compile-layout.mjs';
import { compactCards } from '../assets/viewer/src/diagrams/registry.js';
import { requireDiagramQuality } from '../assets/viewer/src/layout-quality.js';
import { nudgeGraphLayout } from '../assets/viewer/src/layout-nudge.js';
import { fitCard, placed } from '../assets/viewer/src/session-graph.js';

const showcase = path.join(import.meta.dirname, '../../../examples/showcase');
async function architecture(name) {
  const input = JSON.parse(fs.readFileSync(path.join(showcase, name), 'utf8'));
  return (await compileGraphLayout(input.diagrams.find(graph => graph.meta.diagramType === 'architecture'))).graph;
}

// The page's text edit: the new label, then the card (and its boundaries) grown by fitCard.
function edited(graph, id, suffix) {
  const draft = { ...graph, nodes: graph.nodes.map(node => node.id === id ? { ...node, label: node.label + suffix } : node) };
  return placed(draft, fitCard(draft, id, !compactCards(graph)));
}

// Kafka's accumulator and replica have connections on both their top and bottom edges: a taller card cannot keep both stubs clear.
test('a short label added to any architecture card keeps the whole view valid', async () => {
  for (const [name, ids] of [['ecommerce.zh-CN.graph.json', null], ['kafka.zh-CN.graph.json', ['producer', 'sender', 'apis', 'log']]]) {
    const graph = await architecture(name);
    for (const { id } of graph.nodes.filter(node => !ids || ids.includes(node.id))) {
      const result = edited(graph, id, ' QA');
      assert.doesNotThrow(() => requireDiagramQuality(result), `${name}: ${id} + " QA"`);
      assert.ok(compactCards(result), `${name}: ${id} keeps the view on compact cards`);
    }
  }
});

test('only the card that needs more height grows, by the extra title line', async () => {
  const graph = await architecture('ecommerce.zh-CN.graph.json'), original = id => graph.nodes.find(node => node.id === id), result = edited(graph, 'checkout', ' QA');
  assert.deepEqual(result.nodes.filter(node => node.size.height !== original(node.id).size.height).map(node => node.id), ['checkout']);
  assert.equal(result.nodes.find(node => node.id === 'checkout').size.height - original('checkout').size.height, 26);
  assert.deepEqual(edited(graph, 'risk', ' QA').nodes.map(({ label, ...node }) => node), graph.nodes.map(({ label, ...node }) => node), 'a label that still fits changes no geometry');
});

test('a card whose connections leave its bottom grows upward and pulls its boundary along', async () => {
  const graph = await architecture('kafka.zh-CN.graph.json'), result = edited(graph, 'producer', ' QA');
  const before = graph.nodes.find(node => node.id === 'producer'), after = result.nodes.find(node => node.id === 'producer');
  assert.equal(after.position.y + after.size.height, before.position.y + before.size.height, 'the bottom edge, where its connection leaves, stays put');
  const owner = item => item.groups.find(group => group.id === 'producer-jvm'), group = owner(graph), grown = owner(result);
  assert.ok(grown.position.y < group.position.y && grown.size.height > group.size.height, 'the boundary grows to keep its clearance above the card');
  assert.doesNotThrow(() => requireDiagramQuality(result));
});

test('Arrange keeps the spacing the compact cards were laid out with', async () => {
  const graph = await architecture('ecommerce.zh-CN.graph.json'), result = nudgeGraphLayout(graph);
  assert.equal(result.rejected, undefined, JSON.stringify(result.rejected?.diagnostics.map(item => item.ruleId)));
  assert.deepEqual(result.movedNodeIds, [], 'a valid compact layout needs no spacing change');
});
