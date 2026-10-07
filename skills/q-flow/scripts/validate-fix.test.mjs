import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { jeepay, repoRoot, source, facts } from '../../../tests/jeepay.mjs';
import { applyMechanicalFixes, applyAnchorFixes, fixGraphFile, validateGraph, verifySourceEvidence } from './validate-graph.mjs';

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
