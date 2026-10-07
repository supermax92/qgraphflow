import test from 'node:test';
import assert from 'node:assert/strict';
import { routeOverview, sectionTextBoxes, overviewGeometryErrors } from '../assets/viewer/src/architecture-overview.js';
import { createEdgeRoutes, graphBounds } from '../assets/viewer/src/edge-routing.js';
import { requireDiagramQuality } from '../assets/viewer/src/layout-quality.js';
import { compileGraphLayout } from './compile-layout.mjs';

test('overview routes use the clear part of a heading band while protecting every title and body line', () => {
  const graph = { meta: { title: 'Measured headings', diagramType: 'architecture', architectureView: 'engineering', sourceRef: 'conceptual:headings' },
    nodes: ['source', 'target'].map((id, i) => ({ id, label: id, kind: 'component', overviewText: ['完整正文'], position: { x: 700, y: 160 + i * 260 }, size: { width: 240, height: 96 } })),
    edges: [{ id: 'dependency', source: 'source', target: 'target', kind: 'depends', label: '依赖', evidence: 'inference' }],
    layout: { sections: [0, 1].map(i => ({ id: `section-${i}`, title: '职责层', text: ['层内说明'], mode: 'grid', items: [{ nodeId: i ? 'target' : 'source' }], position: { x: 42, y: 42 + i * 260 }, size: { width: 1000, height: 260 } })) } };
  graph.layout.overviewConnections = 'all';
  routeOverview(graph); requireDiagramQuality(graph);
  const route = createEdgeRoutes(graph).get('dependency');
  assert.equal(new Set(route.points.map(point => point.x)).size, 1, 'Clear aligned cards need no side detour around a full-width heading band');
  assert.equal(route.points.at(-1).y - route.points[0].y, 164);
  for (const section of graph.layout.sections) {
    const boxes = sectionTextBoxes(section); assert.equal(boxes.length, 2); assert.ok(boxes.every(box => box.width < 150));
  }
  const bad = new Map([['dependency', { points: [{ x: 80, y: 302 }, { x: 80, y: 420 }], label: '' }]]);
  assert.match(overviewGeometryErrors(graph, bad).join('\n'), /crosses section section-1 text/);
});

test('a branching component graph stays compact with full labels, safe routes and stable semantics', async () => {
  const graph = { meta: { title: 'Branching service', diagramType: 'architecture', sourceRef: 'conceptual:branching' },
    nodes: ['caller', 'orders', 'payments', 'inventory', 'storage', 'events'].map(id => ({ id, label: id, kind: 'service', module: id })),
    edges: [['caller', 'orders'], ['orders', 'payments'], ['orders', 'inventory'], ['orders', 'storage'], ['payments', 'events'], ['events', 'inventory'], ['inventory', 'storage']].map(([source, target], i) => ({ id: `edge-${i}`, source, target, kind: 'request', label: ['提交请求', '创建支付', '预占库存', '保存订单', '发布事件', '消费事件', '更新库存'][i], evidence: 'inference' })) };
  const { graph: output, report } = await compileGraphLayout(graph);
  requireDiagramQuality(output); assert.equal(report.semantics.preserved, true);
  assert.deepEqual(output.edges.map(({ id, source, target, label }) => [id, source, target, label]), graph.edges.map(({ id, source, target, label }) => [id, source, target, label]));
  const bounds = graphBounds(output), nodeArea = output.nodes.reduce((sum, node) => sum + node.size.width * node.size.height, 0);
  assert.ok(bounds.width * bounds.height / nodeArea < 4.5, 'Connector labels must not force mostly empty rows');
  const rebuilt = await compileGraphLayout(output); assert.deepEqual(rebuilt.graph.nodes, output.nodes); assert.deepEqual(rebuilt.graph.edges, output.edges);
});
