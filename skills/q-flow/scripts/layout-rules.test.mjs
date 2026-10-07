import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compileGraphLayout } from './compile-layout.mjs';
import { validateGraph } from '../assets/viewer/src/graph-validation.js';
import { visibleEdges, overviewCategoryMap } from '../assets/viewer/src/presentation-graph.js';
import { createDiagramSvg } from '../assets/viewer/src/export-svg.js';
import { currentGraphFromFlow } from '../assets/viewer/src/session-graph.js';
import { deploymentTierOf } from '../assets/viewer/src/layout-semantics.js';
import { templateDraft } from '../assets/viewer/src/layout-templates.js';
import { auditLayoutQuality } from '../assets/viewer/src/layout-quality.js';
const collection = JSON.parse(fs.readFileSync(new URL('../../../examples/eleven-templates/collection.graph.json', import.meta.url)));
const view = type => structuredClone(collection.diagrams.find(graph => graph.meta.diagramType === type));

test('overview projection preserves hidden evidence through flow state, preserve layout and SVG', async () => {
  const input = JSON.parse(fs.readFileSync(new URL('../../../examples/architecture-overviews/engineering.zh-CN.graph.json', import.meta.url))), categories = overviewCategoryMap(input);
  const a = input.nodes[0], b = input.nodes.find(node => categories.get(node.id) !== categories.get(a.id));
  const edge = { ...input.edges[0], id: 'cross-category', source: a.id, target: b.id }; input.edges.push(edge);
  const { graph } = await compileGraphLayout(input);
  assert.ok(!visibleEdges(graph).some(item => item.id === edge.id));
  assert.deepEqual(graph.edges.find(item => item.id === edge.id), edge);
  assert.equal(currentGraphFromFlow(graph, [], []).edges.length, input.edges.length);
  for (const edge of visibleEdges(graph)) assert.ok(createDiagramSvg(graph).includes(`data-diagram-edge-id="${edge.id}"`));
  assert.ok(!createDiagramSvg(graph).includes(`data-diagram-edge-id="${edge.id}"`));
  assert.deepEqual((await compileGraphLayout(graph, { layout: 'preserve' })).graph, graph);
  assert.equal(visibleEdges({ ...graph, layout: { ...graph.layout, overviewConnections: 'all' } }).length, input.edges.length);
  graph.layout.overviewConnections = 'invalid'; assert.ok(validateGraph(graph, { inputOnly: true }).some(error => error.includes('overviewConnections')));
});

test('deployment tier is optional but rejects invalid values and arranges data below runtime', async () => {
  const input = view('deployment');
  input.nodes.forEach(node => { node.layout = { tier: node.kind === 'database' ? 'data' : 'application' }; });
  const { graph } = await compileGraphLayout(input);
  for (const a of graph.nodes) for (const b of graph.nodes) if (deploymentTierOf(a) < deploymentTierOf(b)) assert.ok(a.position.y + a.size.height < b.position.y);
  const inverted = structuredClone(graph); inverted.layout.strategy = 'layered-0';
  const data = inverted.nodes.find(node => deploymentTierOf(node) === 3); data.position.y = 0;
  assert.ok(auditLayoutQuality(inverted).diagnostics.some(item => item.ruleId === 'semantic.deployment-tier'), 'generic fallback must also respect declared tiers');
  input.nodes[0].layout.tier = 'datta'; assert.ok(validateGraph(input, { inputOnly: true }).some(error => error.includes('tier')));
});

test('class hierarchy cannot continue sideways below a contract', async () => {
  const { graph } = await compileGraphLayout(view('class'));
  const edge = graph.edges.find(edge => ['implementation', 'inheritance'].includes(edge.kind));
  const parent = graph.nodes.find(node => node.id === edge.target), child = graph.nodes.find(node => node.id === edge.source);
  child.position = { x: parent.position.x + parent.size.width + 200, y: parent.position.y - child.size.height - 200 };
  assert.ok(auditLayoutQuality(graph).diagnostics.some(item => item.ruleId === 'semantic.class-hierarchy'));
});

test('dataflow uses its actual horizontal processing direction and puts stores beside connected work', () => {
  const graph = templateDraft(view('dataflow'));
  assert.equal(graph.layout.direction, 'right');
  for (const store of graph.nodes.filter(node => node.kind === 'dataStore')) {
    const neighbours = graph.edges.filter(edge => edge.source === store.id || edge.target === store.id).map(edge => graph.nodes.find(node => node.id === (edge.source === store.id ? edge.target : edge.source)));
    assert.ok(neighbours.some(node => node.position.x === store.position.x));
  }
});
