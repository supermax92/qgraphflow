import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { applyMechanicalFixes, fixGraphFile, validateGraph } from './validate-graph.mjs';

const script = path.join(import.meta.dirname, 'validate-graph.mjs');
const example = () => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../../../examples/sequence-execution.graph.json'), 'utf8'));
const edge = (graph, id) => graph.edges.find(item => item.id === id);
const run = (file, ...args) => spawnSync(process.execPath, [script, file, ...args], { encoding: 'utf8' });
const temp = (t, graph) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-fix-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'graph.json');
  fs.writeFileSync(file, typeof graph === 'string' ? graph : `${JSON.stringify(graph, null, 2)}\n`);
  return file;
};

test('missing or duplicate orders are renumbered in authoring order and reported', () => {
  const graph = example();
  delete edge(graph, 'c3').order; edge(graph, 'r4').order = edge(graph, 'c4').order;
  const before = graph.edges.map(item => item.id);
  const { changes, blocked } = applyMechanicalFixes(graph);
  assert.deepEqual(graph.edges.map(item => item.order), graph.edges.map((_, i) => i + 1));
  assert.deepEqual([...graph.edges].sort((a, b) => a.order - b.order).map(item => item.id), before, 'relative order follows the array');
  assert.ok(changes.some(change => /edge c3\.order undefined → 3/.test(change)));
  assert.deepEqual(blocked, []);
  assert.deepEqual(validateGraph(graph, { inputOnly: true }), []);
});

test('valid unique orders with gaps are left untouched', () => {
  const graph = example();
  const orders = graph.edges.map(item => item.order);
  assert.deepEqual(applyMechanicalFixes(graph).changes, []);
  assert.deepEqual(graph.edges.map(item => item.order), orders);
});

test('opt, loop and par operands get ids; alt operands keep their optional ids', () => {
  const graph = example();
  const loop = graph.groups.find(group => group.kind === 'loop'), alt = graph.groups.find(group => group.kind === 'alt'), par = graph.groups.find(group => group.kind === 'par');
  // Children reference the loop operand by id, so renaming would break nesting: only add ids where none exist.
  delete par.operands[0].id; delete alt.operands[0].id;
  const { changes } = applyMechanicalFixes(graph);
  assert.equal(par.operands[0].id, 'op1');
  assert.equal(alt.operands[0].id, undefined, 'alt operands may stay anonymous');
  assert.equal(loop.operands[0].id, 'attempt');
  assert.ok(changes.some(change => /group parallel\.operands\[0\]\.id → op1/.test(change)));
});

test('replyTo is filled only for exactly one unanswered reversed call in the same scope', () => {
  const graph = example();
  delete edge(graph, 'r6').replyTo;
  let result = applyMechanicalFixes(graph);
  assert.equal(edge(graph, 'r6').replyTo, 'c6');
  assert.ok(result.changes.some(change => /edge r6\.replyTo → c6/.test(change)));
  // Two open calls from order to inventory in the same scope before one return: ambiguous, so it stays open and is reported.
  const ambiguous = example();
  delete edge(ambiguous, 'r3').replyTo;
  ambiguous.edges.push({ id: 'c3b', source: 'order', target: 'inventory', kind: 'sync', label: 'readStock() again', order: 7, evidence: 'source' });
  result = applyMechanicalFixes(ambiguous);
  assert.equal(edge(ambiguous, 'r3').replyTo, undefined);
  assert.ok(result.blocked.some(item => /edge r3\.replyTo not filled: 2 candidates/.test(item)), JSON.stringify(result.blocked));
  // No reversed call at all: reported, not invented.
  const orphan = example();
  delete edge(orphan, 'r1').replyTo; edge(orphan, 'r1').target = 'audit';
  result = applyMechanicalFixes(orphan);
  assert.equal(edge(orphan, 'r1').replyTo, undefined);
  assert.ok(result.blocked.some(item => /edge r1\.replyTo not filled: no unanswered reversed call/.test(item)));
});

test('facts are never touched: kinds, evidence, labels, fields and elements stay as authored', () => {
  const graph = example();
  delete edge(graph, 'c3').evidence; edge(graph, 'c4').kind = 'call'; delete edge(graph, 'c5').label;
  const snapshot = JSON.stringify({ nodes: graph.nodes, groups: graph.groups, executions: graph.executions, edges: graph.edges.map(({ order, ...rest }) => rest) });
  applyMechanicalFixes(graph);
  assert.equal(JSON.stringify({ nodes: graph.nodes, groups: graph.groups, executions: graph.executions, edges: graph.edges.map(({ order, ...rest }) => rest) }), snapshot);
  assert.equal(graph.nodes.length, 5); assert.equal(graph.edges.length, 12);
});

test('the CLI writes back only a graph that passes, and reports what it could and could not fix', t => {
  const broken = example();
  delete edge(broken, 'c3').order; delete edge(broken, 'r6').replyTo;
  const file = temp(t, broken);
  const fixed = run(file, '--input-only', '--fix');
  assert.equal(fixed.status, 0, fixed.stderr);
  assert.match(fixed.stderr, /fixed: edge r6\.replyTo → c6/); assert.match(fixed.stderr, /wrote .*graph\.json \(13 changes\)/);
  const written = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(edge(written, 'r6').replyTo, 'c6'); assert.deepEqual(validateGraph(written, { inputOnly: true }), []);
  assert.deepEqual(JSON.parse(fixed.stdout).semantic, { status: 'passed' });

  const hopeless = example();
  delete edge(hopeless, 'c3').order; edge(hopeless, 'c4').kind = 'bogus';
  const file2 = temp(t, hopeless); const original = fs.readFileSync(file2, 'utf8');
  const failed = run(file2, '--input-only', '--fix');
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /fixed: edge c3\.order undefined → 3/, 'the applicable fix is still listed');
  assert.match(failed.stderr, /Invalid graph after mechanical fixes \(file left unchanged\)/); assert.match(failed.stderr, /kind is unsupported/);
  assert.equal(fs.readFileSync(file2, 'utf8'), original, 'nothing written when errors remain');
});

test('fix is idempotent and a no-op on a valid file', t => {
  const file = temp(t, fs.readFileSync(path.join(import.meta.dirname, '../../../examples/sequence-execution.graph.json'), 'utf8'));
  const original = fs.readFileSync(file, 'utf8');
  const first = fixGraphFile(file, { inputOnly: true });
  assert.deepEqual(first, { changes: [], blocked: [], errors: [], written: false });
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  const broken = example(); delete edge(broken, 'c3').order;
  const file2 = temp(t, broken);
  fixGraphFile(file2, { inputOnly: true }); const once = fs.readFileSync(file2, 'utf8');
  fixGraphFile(file2, { inputOnly: true }); assert.equal(fs.readFileSync(file2, 'utf8'), once);
});

test('--help lists every option and --fix combines with --repo-root', t => {
  const help = run('--help');
  assert.equal(help.status, 0);
  for (const flag of ['--input-only', '--repo-root', '--fix', '--verbose', '--help']) assert.match(help.stdout, new RegExp(flag.replace(/-/g, '\\-')));
  const graph = example(); delete edge(graph, 'c3').order;
  const file = temp(t, graph);
  const result = run(file, '--input-only', '--fix', '--repo-root', path.dirname(file));
  assert.equal(result.status, 0, result.stderr);
});
