import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { jeepay, repoRoot, source, facts } from '../../../tests/jeepay.mjs';
import { applyMechanicalFixes, applyAnchorFixes, fixGraphFile, validateGraph, verifySourceEvidence } from './validate-graph.mjs';
import { compileGraphLayout } from './compile-layout.mjs';

const temp = t => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-jeepay-fix-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; };
const write = (dir, graph) => { const file = path.join(dir, 'graph.json'); fs.writeFileSync(file, JSON.stringify(graph)); return file; };

test('Jeepay mechanical fixing is idempotent and retains every business fact', () => {
  const graph = jeepay('sequence'), before = structuredClone(graph);
  assert.deepEqual(applyMechanicalFixes(graph).blocked, []);
  assert.deepEqual(facts(graph), facts(before));
  assert.deepEqual(applyMechanicalFixes(graph).changes, []);
});

test('Jeepay missing message order is repaired without deleting or reordering messages', () => {
  const graph = jeepay('sequence'), ids = graph.edges.map(edge => edge.id);
  delete graph.edges[0].order;
  const result = applyMechanicalFixes(graph);
  assert.ok(result.changes.length);
  assert.deepEqual(graph.edges.map(edge => edge.id), ids);
  assert.deepEqual(validateGraph(graph, { inputOnly: true }), []);
});

test('Jeepay unambiguous replies and execution bars can be rebuilt from the actual calls', () => {
  const graph = jeepay('sequence'), reply = graph.edges.find(edge => edge.kind === 'return');
  const callId = reply.replyTo;
  delete reply.replyTo; delete graph.executions;
  const result = applyMechanicalFixes(graph);
  assert.equal(reply.replyTo, callId);
  assert.ok(graph.executions.length);
  assert.deepEqual(result.blocked, []);
  assert.deepEqual(validateGraph(graph, { inputOnly: true }), []);
});

test('Jeepay invalid input never overwrites its file during --fix', t => {
  const graph = jeepay('relations'); graph.nodes[0].kind = 'invalid';
  const file = write(temp(t), graph), before = fs.readFileSync(file);
  const result = fixGraphFile(file, { inputOnly: true, repoRoot });
  assert.ok(result.errors.length); assert.equal(result.written, false);
  assert.deepEqual(fs.readFileSync(file), before);
});

function movedSource(t) {
  const dir = temp(t);
  for (const file of Object.keys(source.files)) { const target = path.join(dir, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(repoRoot, file), target); }
  const graph = jeepay('relations'), node = graph.nodes.find(node => node.id === 'unified');
  node.source.symbol = 'UnifiedOrderController';
  verifySourceEvidence(graph, dir);
  const file = path.join(dir, node.source.file), before = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, '// CI source drift\n'.repeat(12) + before);
  return { dir, graph, node };
}

test('actual Jeepay source drift fails, and a unique symbol re-anchors without changing facts', t => {
  const { dir, graph, node } = movedSource(t), old = node.source.lineStart, before = facts(graph);
  assert.throws(() => verifySourceEvidence(graph, dir), /UnifiedOrderController/);
  const fixed = applyAnchorFixes(graph, dir);
  assert.deepEqual(fixed.blocked, []);
  assert.equal(node.source.lineStart, old + 12);
  assert.equal(verifySourceEvidence(graph, dir).status, 'passed');
  before.nodes.find(node => node.id === 'unified').source = structuredClone(node.source);
  assert.deepEqual(facts(graph), before);
  assert.deepEqual(applyAnchorFixes(graph, dir).changes, []);
});

test('removed Jeepay symbols block fixing and preserve the input', t => {
  const { dir, graph, node } = movedSource(t), java = path.join(dir, node.source.file);
  fs.writeFileSync(java, fs.readFileSync(java, 'utf8').replaceAll('UnifiedOrderController', 'RemovedController'));
  const file = write(dir, graph), before = fs.readFileSync(file);
  const fixed = fixGraphFile(file, { inputOnly: true, repoRoot: dir });
  assert.equal(fixed.written, false); assert.ok(fixed.errors.length);
  assert.deepEqual(fs.readFileSync(file), before);
});

test('A removed capabilities overview is migrated by --fix into a component relations view that generates', async t => {
  // The shape the removed overviews had: sections instead of groups, overviewText on cards, fixed geometry.
  const graph = jeepay('relations'), [first, second, third] = graph.nodes;
  graph.meta.architectureView = 'capabilities';
  first.overviewText = ['校验商户签名后选择支付方式'];
  first.overviewTone = 'blue';
  graph.nodes.forEach((node, index) => { node.position = { x: index * 300, y: 0 }; node.size = { width: 240, height: 120 }; });
  graph.layout = { ...graph.layout, version: 4, strategy: 'overview', overviewConnections: [], sections: [
    { id: 'entry', title: '能力入口', mode: 'grid', items: [{ nodeId: first.id }, { id: 'entry-core', title: '核心处理', mode: 'row', items: [{ nodeId: second.id }] }] },
    { id: 'support', title: '支撑', mode: 'row', items: [{ nodeId: third.id }] },
    { id: 'tips', mode: 'note', text: ['渠道接入状态未验证'] },
  ] };
  assert.ok(validateGraph(graph, { inputOnly: true }).some(error => /architectureView "capabilities" was removed: run validate --fix/.test(error)));

  const file = write(temp(t), graph), result = fixGraphFile(file);
  assert.deepEqual(result.errors, []); assert.equal(result.written, true);
  assert.ok(result.changes.some(change => change.startsWith('capabilities view → component relations view')));
  const fixed = JSON.parse(fs.readFileSync(file, 'utf8')), byId = id => fixed.nodes.find(node => node.id === id);
  assert.equal(fixed.meta.architectureView, undefined); assert.equal(fixed.layout.sections, undefined); assert.equal(fixed.layout.overviewConnections, undefined);
  assert.deepEqual(fixed.groups, [{ id: 'entry', kind: 'ownership', label: '能力入口' }, { id: 'entry-core', kind: 'ownership', label: '核心处理', parentId: 'entry' }, { id: 'support', kind: 'ownership', label: '支撑' }]);
  assert.deepEqual([byId(first.id).groupId, byId(second.id).groupId, byId(third.id).groupId], ['entry', 'entry-core', 'support']);
  assert.equal(byId(first.id).facts[0], '校验商户签名后选择支付方式'); assert.equal(byId(first.id).overviewText, undefined); assert.equal(byId(first.id).overviewTone, undefined);
  assert.ok(fixed.meta.notes.includes('渠道接入状态未验证'));
  assert.ok(fixed.nodes.every(node => node.position === undefined && node.size === undefined));

  const { graph: output } = await compileGraphLayout(fixed);
  assert.deepEqual(validateGraph(output), []);
  assert.deepEqual(fixGraphFile(write(temp(t), output)).changes, [], 'A migrated view is a plain component relations view.');
});
