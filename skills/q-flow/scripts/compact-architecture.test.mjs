import test from 'node:test';
import assert from 'node:assert/strict';
import { createEdgeRoutes, graphBounds } from '../assets/viewer/src/edge-routing.js';
import { requireDiagramQuality } from '../assets/viewer/src/layout-quality.js';
import { compileGraphLayout } from './compile-layout.mjs';

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
