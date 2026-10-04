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

test('--fix adds the callee bar of each answered sync call, nested like the hand-drawn ones', t => {
  const expected = example().executions, graph = example();
  delete graph.executions;
  const file = temp(t, graph), result = fixGraphFile(file, { inputOnly: true });
  assert.deepEqual(result.errors, []); assert.ok(result.written);
  const bars = JSON.parse(fs.readFileSync(file, 'utf8')).executions;
  const shape = list => list.map(bar => [bar.participantId, bar.start.edgeId, bar.start.at, bar.end.edgeId, bar.end.at, list.find(item => item.id === bar.parentId)?.start.edgeId ?? null]).sort((a, b) => a.join().localeCompare(b.join()));
  assert.deepEqual(shape(bars), shape(expected), 'same anchors and the same nesting as the authored example');
  assert.ok(result.changes.some(change => /execution x-c2 on order from c2 receive to r2 send inside x-c1/.test(change)), result.changes.join('\n'));
});

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

// A repository after an edit: createOrder now starts on line 30 of a 50-line file, and the schema names `orders` on
// three separate lines.
const drifted = t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-drift-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const text = (count, lines) => Array.from({ length: count }, (_, i) => lines[i + 1] ?? `// ${i + 1}`).join('\n') + '\n';
  fs.mkdirSync(path.join(dir, 'src')); fs.mkdirSync(path.join(dir, 'db'));
  fs.writeFileSync(path.join(dir, 'src/order-service.js'), text(50, { 11: '  // reorder the orders queue', 30: '  async createOrder(input) {' }));
  fs.writeFileSync(path.join(dir, 'db/schema.sql'), text(45, { 18: 'CREATE TABLE orders (', 29: '  order_id BIGINT REFERENCES orders(id),', 39: 'CREATE INDEX orders_by_user ON orders (user_id);' }));
  return dir;
};
const anchored = (...anchors) => {
  const graph = example();
  anchors.forEach((source, index) => { graph.nodes[index].source = { kind: 'source', ...source }; });
  return graph;
};

test('a symbol must stay inside its recorded lines; qualified names use their last segment, partial words do not count', t => {
  const repo = drifted(t);
  const file = temp(t, anchored(
    { file: 'src/order-service.js', lineStart: 30, lineEnd: 44, symbol: 'OrderService.createOrder' },
    { file: 'src/order-service.js', lineStart: 30, symbol: 'createOrder()' },
    { file: 'db/schema.sql', lineStart: 18, lineEnd: 24, symbol: 'orders' },
    { file: 'db/schema.sql', lineStart: 39, symbol: 'GET /orders' },
    { file: 'db/schema.sql', lineStart: 1, lineEnd: 45 }
  ));
  let result = run(file, '--input-only', '--repo-root', repo);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).sourceEvidence, { scope: 'working-tree', status: 'passed', references: 5, checked: 5, files: 2, symbols: 4 });
  result = run(file, '--input-only');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).sourceEvidence, { scope: 'working-tree', status: 'skipped', references: 5, checked: 0, files: 0, reason: 'repository-root-not-provided' });
  for (const [source, expected] of [
    [{ lineStart: 10, lineEnd: 24, symbol: 'createOrder' }, /symbol "createOrder" is not in lines 10-24; found at line 30; run --fix to re-anchor a unique match/],
    [{ lineStart: 10, lineEnd: 12, symbol: 'order' }, /symbol "order" is not in lines 10-12; not found in the file/],
    [{ lineStart: 30, symbol: 'OrderService.cancelOrder' }, /symbol "cancelOrder" is not in line 30; not found in the file/]
  ]) {
    result = run(temp(t, anchored({ file: 'src/order-service.js', ...source })), '--input-only', '--repo-root', repo);
    assert.equal(result.status, 1, source.symbol);
    assert.match(result.stderr, /diagrams\[0\]\.nodes\[0\]\.source \(src\/order-service\.js\): /);
    assert.match(result.stderr, expected);
  }
  // A small move that stays inside the recorded lines is not drift.
  result = run(temp(t, anchored({ file: 'src/order-service.js', lineStart: 27, lineEnd: 41, symbol: 'createOrder' })), '--input-only', '--repo-root', repo);
  assert.equal(result.status, 0, result.stderr);
});

test('--fix re-anchors a symbol found once in its file, keeps the span, never touches other fields, and is idempotent', t => {
  const repo = drifted(t);
  const graph = anchored(
    { file: 'src/order-service.js', lineStart: 10, lineEnd: 24, symbol: 'OrderService.createOrder' },
    { file: 'src/order-service.js', lineStart: 10, symbol: 'createOrder' },
    { file: 'src/order-service.js', lineStart: 2, lineEnd: 26, symbol: 'createOrder' }
  );
  const file = temp(t, graph);
  let result = run(file, '--input-only', '--fix');
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /fixed:/, 'without --repo-root no source is read and no anchor moves');
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), graph);
  result = run(file, '--input-only', '--fix', '--repo-root', repo);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /fixed: node client\.source\.lineStart 10 → 30, lineEnd 24 → 44/);
  assert.match(result.stderr, /fixed: node order\.source\.lineStart 10 → 30\n/);
  assert.match(result.stderr, /fixed: node inventory\.source\.lineStart 2 → 30, lineEnd 26 → 50/, 'the shifted end stops at the last line');
  assert.doesNotMatch(result.stderr, /regenerate/, 'an input graph has no page to regenerate');
  const written = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(written.nodes.slice(0, 3).map(node => node.source), [
    { kind: 'source', file: 'src/order-service.js', lineStart: 30, lineEnd: 44, symbol: 'OrderService.createOrder' },
    { kind: 'source', file: 'src/order-service.js', lineStart: 30, symbol: 'createOrder' },
    { kind: 'source', file: 'src/order-service.js', lineStart: 30, lineEnd: 50, symbol: 'createOrder' }
  ]);
  assert.deepEqual({ ...written, nodes: written.nodes.map(({ source, ...node }) => node) }, { ...graph, nodes: graph.nodes.map(({ source, ...node }) => node) });
  assert.equal(JSON.parse(result.stdout).sourceEvidence.status, 'passed');
  const once = fs.readFileSync(file, 'utf8');
  result = run(file, '--input-only', '--fix', '--repo-root', repo);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /fixed:|wrote/);
  assert.equal(fs.readFileSync(file, 'utf8'), once);
});

test('an ambiguous symbol is left alone and its source evidence blocks the write of the other fixes', t => {
  const repo = drifted(t);
  const graph = anchored({ file: 'db/schema.sql', lineStart: 20, lineEnd: 22, symbol: 'orders' });
  delete edge(graph, 'c3').order;
  const file = temp(t, graph), original = fs.readFileSync(file, 'utf8');
  const result = run(file, '--input-only', '--fix', '--repo-root', repo);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /fixed: edge c3\.order undefined → 3/, 'the applicable fix is still listed');
  assert.match(result.stderr, /not fixed: node client\.source not re-anchored: "orders" found at lines 18, 29, 39/);
  assert.match(result.stderr, /Invalid graph after mechanical fixes \(file left unchanged\)/);
  assert.match(result.stderr, /symbol "orders" is not in lines 20-22; found at lines 18, 29, 39/);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
});

test('without --input-only, --fix judges geometry too: a draft that still overlaps is listed but not written', t => {
  const repo = drifted(t), anchor = { file: 'src/order-service.js', lineStart: 10, lineEnd: 24, symbol: 'createOrder' };
  let result = run(temp(t, anchored(anchor)), '--fix', '--repo-root', repo);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /fixed: node client\.source\.lineStart 10 → 30, lineEnd 24 → 44/);
  const draft = anchored(anchor);
  draft.nodes[1].position = { ...draft.nodes[0].position };
  const file = temp(t, draft), original = fs.readFileSync(file, 'utf8');
  result = run(file, '--fix', '--repo-root', repo);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /fixed: node client\.source\.lineStart 10 → 30/, 'the applicable fix is still listed');
  assert.match(result.stderr, /Invalid graph after mechanical fixes \(file left unchanged\):\n- .*overlap/);
  assert.doesNotMatch(result.stderr, /^(wrote|regenerate)/m);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
});

test('a re-anchored collection moves every copy of an anchor alike and asks to regenerate its page and SVGs', t => {
  const repo = drifted(t), source = { file: 'src/order-service.js', lineStart: 10, lineEnd: 24, symbol: 'createOrder' };
  const sequence = anchored(source);
  const architecture = { meta: { title: 'Orders', sourceRef: 'test@local', diagramType: 'architecture' }, nodes: [
    { id: 'client', label: 'Client', kind: 'external' }, { id: 'order', label: 'Order service', kind: 'service', source: { kind: 'source', ...source } }
  ], edges: [{ id: 'create', source: 'client', target: 'order', kind: 'call', label: 'createOrder', evidence: 'source' }] };
  const file = temp(t, { diagrams: [architecture, sequence] });
  fs.writeFileSync(path.join(path.dirname(file), 'index.html'), '<html></html>');
  const result = run(file, '--input-only', '--fix', '--repo-root', repo);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /fixed: diagrams\[0\]\.node order\.source\.lineStart 10 → 30, lineEnd 24 → 44/);
  assert.match(result.stderr, /fixed: diagrams\[1\]\.node client\.source\.lineStart 10 → 30, lineEnd 24 → 44/);
  const written = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(written.diagrams[0].nodes[1].source, written.diagrams[1].nodes[0].source);
  assert.match(result.stderr, /regenerate the page and SVGs: node ".*generate-viewer\.mjs" ".*graph\.json" ".*" --layout preserve --force --repo-root ".*"/);
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
