import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { templateDraft, preservesTemplateOrder } from '../assets/viewer/src/layout-templates.js';
import { createEdgeRoutes } from '../assets/viewer/src/edge-routing.js';
import { routeOrthogonal } from '../assets/viewer/src/orthogonal-routing.js';
import { auditLayoutQuality, requireDiagramQuality } from '../assets/viewer/src/layout-quality.js';
import { compileGraphLayout } from './compile-layout.mjs';

const collection = JSON.parse(fs.readFileSync(new URL('../../../examples/eleven-templates/collection.graph.json', import.meta.url)));
const onRoute = route => route.points.slice(1).some((b, i) => {
  const a = route.points[i], p = route.labelPoint;
  return a.x === b.x && Math.abs(p.x - a.x) < .001 && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y)
    || a.y === b.y && Math.abs(p.y - a.y) < .001 && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x);
});

test('all eight relation templates produce labels on their own orthogonal paths', async () => {
  for (const input of collection.diagrams.filter(g => !['capabilities', 'engineering'].includes(g.meta.architectureView) && g.meta.diagramType !== 'sequence')) {
    const { graph } = await compileGraphLayout(input);
    requireDiagramQuality(graph);
    for (const [id, route] of createEdgeRoutes(graph)) {
      if (route.label) assert.ok(onRoute(route), `${input.meta.diagramType}:${id}`);
      assert.ok(route.points.slice(1).every((b, i) => b.x === route.points[i].x || b.y === route.points[i].y));
    }
    const edge = graph.edges.find(e => createEdgeRoutes(graph).get(e.id).label);
    if (edge) {
      edge.route.labelAt = { x: -1000, y: -1000 };
      assert.ok(auditLayoutQuality(graph).diagnostics.some(d => d.ruleId === 'label.on-route' && d.elementIds.includes(edge.id)));
    }
  }
});

test('mixed-size ER tables share row tops and column starts and refinement cannot stagger them', () => {
  const graph = structuredClone(collection.diagrams.find(g => g.meta.diagramType === 'er'));
  graph.nodes = Array.from({ length: 4 }, (_, i) => ({ ...structuredClone(graph.nodes[0]), id: `table-${i}`, label: `Table ${i}`, fields: graph.nodes[0].fields.slice(0, i + 1) }));
  graph.edges = []; delete graph.groups; delete graph.layout;
  const draft = templateDraft(graph); draft.layout.strategy = 'template-entity-matrix-0';
  const xs = new Set(draft.nodes.map(n => n.position.x)), ys = new Set(draft.nodes.map(n => n.position.y));
  assert.equal(xs.size, 2); assert.equal(ys.size, 2);
  const changed = structuredClone(draft); changed.nodes[0].position.y += 12;
  assert.equal(preservesTemplateOrder(draft, changed), false);
});

test('a long self-transition label stays on its bracket and is fully clear of the node', () => {
  const input = { meta: { title: 'Self transition', sourceRef: 'conceptual:self-transition', diagramType: 'state' }, layout: { version: 'templates-v3-aligned-inline-elkjs-0.11.0' }, nodes: [{ id: 'work', kind: 'state', label: 'Processing', position: { x: 300, y: 200 }, size: { width: 240, height: 120 } }], edges: [{ id: 'retry', source: 'work', target: 'work', kind: 'transition', label: 'retry after the complete response', evidence: 'inference' }] };
  const graph = routeOrthogonal(input, { accept: requireDiagramQuality }).graph;
  assert.ok(onRoute(createEdgeRoutes(graph).get('retry')));
});
