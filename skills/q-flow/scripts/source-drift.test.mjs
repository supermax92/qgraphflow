import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { collection, repoRoot, source } from '../../../tests/jeepay.mjs';
import { mapLine, parseHunks } from './source-drift.mjs';
import { changesReport, fixGraphFile, stampSourceFiles, verifySourceEvidence } from './validate-graph.mjs';
import { driftedElements } from '../assets/viewer/src/source-changes.js';

const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });

// The Jeepay source files in a fresh repository, and the whole collection stamped against them.
function baseline(t, prepare) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-drift-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const file of Object.keys(source.files)) { const target = path.join(dir, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(repoRoot, file), target); }
  const graph = structuredClone(collection);
  prepare?.(dir, graph);
  git(dir, 'init', '-q'); git(dir, 'add', '-A'); git(dir, '-c', 'user.name=drift', '-c', 'user.email=drift@example.invalid', 'commit', '-qm', 'baseline');
  assert.ok(stampSourceFiles(graph, dir).length);
  return { dir, graph };
}
const view = (graph, id) => graph.diagrams.find(item => item.meta.viewId === `jeepay-${id}`);
const site = (graph, id, edgeId) => view(graph, id).edges.find(edge => edge.id === edgeId).site;
const editLine = (dir, file, line, change) => { const p = path.join(dir, file), lines = fs.readFileSync(p, 'utf8').split('\n'); lines[line - 1] = change(lines[line - 1]); fs.writeFileSync(p, lines.join('\n')); };
const insertAfter = (dir, file, line, text) => { const p = path.join(dir, file), lines = fs.readFileSync(p, 'utf8').split('\n'); lines.splice(line, 0, text); fs.writeFileSync(p, lines.join('\n')); };

test('line mapping follows insertions and deletions and stops at rewritten lines', () => {
  const hunks = parseHunks('@@ -10,0 +11,3 @@\n+a\n+b\n+c\n@@ -20 +23 @@\n-x\n+y\n@@ -30,2 +33,0 @@\n-p\n-q\n');
  assert.deepEqual(mapLine(hunks, 5), { line: 5 });
  assert.deepEqual(mapLine(hunks, 15), { line: 18 });
  assert.equal(mapLine(hunks, 20).hunk.newStart, 23);
  assert.deepEqual(mapLine(hunks, 25), { line: 28 });
  assert.ok(mapLine(hunks, 31).hunk);
  assert.deepEqual(mapLine(hunks, 40), { line: 41 });
});

test('a stamped Jeepay collection passes unchanged and records every anchored file', t => {
  const { dir, graph } = baseline(t);
  for (const item of graph.diagrams) for (const blob of Object.values(item.meta.sourceFiles)) assert.match(blob, /^[0-9a-f]{40}$/);
  const evidence = verifySourceEvidence(graph, dir);
  assert.equal(evidence.status, 'passed');
  assert.deepEqual(evidence.drift, { files: evidence.drift.files, realigned: 0, alarms: 0 });
});

test('lines that only moved pass and their anchors follow them', t => {
  const { dir, graph } = baseline(t), anchor = site(graph, 'sequence', 'm3'), old = anchor.lineStart;
  insertAfter(dir, anchor.file, 70, '    // housekeeping comment\n    // with no behaviour change\n');
  const evidence = verifySourceEvidence(graph, dir);
  assert.equal(evidence.status, 'passed');
  assert.ok(evidence.drift.realigned > 0);
  assert.equal(anchor.lineStart, old + 3);
});

test('a rewritten anchored line is reported with the elements it carries', t => {
  const { dir, graph } = baseline(t), anchor = site(graph, 'sequence', 'm3');
  editLine(dir, anchor.file, anchor.lineStart, line => line.replace('payOrderService.save(', 'payOrderService.saveOrder('));
  assert.throws(() => verifySourceEvidence(graph, dir), error => /Source drift: 1 change/.test(error.message) && /anchored line rewritten/.test(error.message) && /jeepay-sequence m3/.test(error.message) && /\+ payOrderService\.saveOrder\(payOrder\);/.test(error.message));
});

test('a changed number on an anchored line points at the text that still states the old value', t => {
  const { dir, graph } = baseline(t, (dir, graph) => {
    const anchor = site(graph, 'sequence', 'm4');
    editLine(dir, anchor.file, anchor.lineStart, line => `${line} // channel timeout 30`);
    view(graph, 'sequence').edges.find(edge => edge.id === 'm4').label += ' (timeout 30s)';
  });
  const anchor = site(graph, 'sequence', 'm4');
  editLine(dir, anchor.file, anchor.lineStart, line => line.replace('timeout 30', 'timeout 60'));
  assert.throws(() => verifySourceEvidence(graph, dir), error => /jeepay-sequence m4 label: ".*timeout 30s/.test(error.message));
});

test('removing the only call to a method reports it as unreachable', t => {
  const { dir, graph } = baseline(t), file = 'jeepay-payment/src/main/java/com/jeequan/jeepay/pay/service/PayOrderProcessService.java';
  const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n'), call = lines.findIndex(line => line.includes('this.updatePayOrderAutoDivision(payOrder);'));
  assert.ok(call > 0);
  lines.splice(call, 1); fs.writeFileSync(path.join(dir, file), lines.join('\n'));
  assert.throws(() => verifySourceEvidence(graph, dir), /call removed: updatePayOrderAutoDivision\(\) has no remaining caller/);
});

test('new code that touches a drawn component is reported when no anchor covers it', t => {
  const { dir, graph } = baseline(t), anchor = site(graph, 'sequence', 'm3');
  insertAfter(dir, anchor.file, anchor.lineStart, '            payOrderService.updateIng2Cancel(payOrder.getPayOrderId());');
  assert.throws(() => verifySourceEvidence(graph, dir), /new code not covered by the diagram[\s\S]*updateIng2Cancel/);
});

test('--fix realigns, renews the baseline and keeps the change as a worklist until the author clears it', t => {
  const { dir, graph } = baseline(t), anchor = site(graph, 'sequence', 'm3');
  insertAfter(dir, anchor.file, 70, '    // housekeeping comment');
  editLine(dir, anchor.file, anchor.lineStart + 1, line => line.replace('payOrderService.save(', 'payOrderService.saveOrder('));
  const file = path.join(dir, 'graph.json'); fs.writeFileSync(file, JSON.stringify(graph));
  const result = fixGraphFile(file, { inputOnly: true, repoRoot: dir });
  assert.deepEqual(result.errors, []); assert.equal(result.written, true); assert.equal(result.drift.length, 1);
  const fixed = JSON.parse(fs.readFileSync(file, 'utf8')), sequence = view(fixed, 'sequence');
  assert.equal(sequence.edges.find(edge => edge.id === 'm3').site.lineStart, anchor.lineStart + 1);
  assert.equal(sequence.meta.sourceDrift[0].file, anchor.file);
  assert.ok(sequence.meta.sourceDrift[0].elements.includes('m3'), 'the worklist names the element ids it touches');
  assert.ok(driftedElements(sequence).has('m3'), 'the Viewer marks the named elements');
  assert.equal(sequence.meta.sourceFiles[anchor.file], git(dir, 'hash-object', anchor.file).trim());
  assert.throws(() => verifySourceEvidence(fixed, dir), /Unresolved source drift/);
  assert.equal(verifySourceEvidence(structuredClone(fixed), dir, { pendingDrift: 'show' }).status, 'passed', 'generation shows listed items instead of failing');
  const pending = structuredClone(fixed);
  for (const item of fixed.diagrams) delete item.meta.sourceDrift;
  assert.equal(verifySourceEvidence(fixed, dir).status, 'passed');
  const other = site(pending, 'sequence', 'm1');
  editLine(dir, other.file, other.lineStart, line => `${line} // changed`);
  assert.throws(() => verifySourceEvidence(pending, dir, { pendingDrift: 'show' }), /Source drift: 1 change/, 'an unlisted change still fails generation');
});

test('graphs without a baseline keep the working-tree check unchanged', t => {
  const { dir } = baseline(t), graph = structuredClone(collection);
  const evidence = verifySourceEvidence(graph, dir);
  assert.equal(evidence.status, 'passed'); assert.equal(evidence.drift, undefined);
});

test('a baseline missing from the repository falls back to the working-tree check with a warning', t => {
  const { dir, graph } = baseline(t), warn = t.mock.method(console, 'warn', () => {});
  for (const item of graph.diagrams) for (const file of Object.keys(item.meta.sourceFiles)) item.meta.sourceFiles[file] = '0'.repeat(40);
  const anchor = site(graph, 'sequence', 'm3');
  insertAfter(dir, anchor.file, 70, '    // housekeeping comment');
  assert.equal(verifySourceEvidence(graph, dir).status, 'passed');
  assert.ok(warn.mock.calls.some(call => /fetch-depth: 0/.test(call.arguments[0])));
});

test('--changes reports each change with the readable elements it touches, or that nothing changed', t => {
  const { dir, graph } = baseline(t), anchor = site(graph, 'sequence', 'm3'), sequence = view(graph, 'sequence');
  assert.match(changesReport(graph, dir), /^No source changes affect /);
  editLine(dir, anchor.file, anchor.lineStart, line => line.replace('payOrderService.save(', 'payOrderService.saveOrder('));
  const edge = sequence.edges.find(item => item.id === 'm3'), label = id => sequence.nodes.find(node => node.id === id).label;
  const report = changesReport(graph, dir);
  assert.match(report, /^## Source changes affecting /);
  assert.ok(report.includes(`\`${anchor.file}:${anchor.lineStart}\``), report);
  assert.ok(report.includes(`${label(edge.source)} → ${label(edge.target)}`), report);
  assert.ok(report.includes('+ payOrderService.saveOrder(payOrder);'), report);
});

test('a removed call in a file the diagram does not anchor marks the element whose text names what only it did', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-drift-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'Orders.java'), 'public class Orders {\n    public void open() {}\n}\n');
  fs.writeFileSync(path.join(dir, 'Payments.java'), ['public class Payments {', '    public void confirm(Order order) {', '        notifyMerchant(order);', '        this.autoDivision(order);', '    }', '    private void autoDivision(Order order) {', '        mqSender.send(PayOrderDivisionMQ.build(order.getId()));', '    }', '    private void notifyMerchant(Order order) {}', '}', ''].join('\n'));
  const commit = message => { git(dir, 'add', '-A'); git(dir, '-c', 'user.name=drift', '-c', 'user.email=drift@example.invalid', 'commit', '-qm', message); };
  git(dir, 'init', '-q'); commit('baseline');
  const graph = { meta: { title: 'Order states', sourceRef: 'test', diagramType: 'state' },
    nodes: [{ id: 'open', label: 'Open', kind: 'state', source: { file: 'Orders.java', lineStart: 2, lineEnd: 2, symbol: 'open', kind: 'source' } },
      { id: 'paid', label: 'Paid', kind: 'state', facts: ['confirm sends PayOrderDivisionMQ'] }], edges: [] };
  stampSourceFiles(graph, dir);
  assert.equal(graph.meta.sourceCommit, git(dir, 'rev-parse', 'HEAD').trim());
  assert.equal(verifySourceEvidence(structuredClone(graph), dir).status, 'passed');
  editLine(dir, 'Payments.java', 4, () => '');
  commit('stop dividing');
  assert.throws(() => verifySourceEvidence(structuredClone(graph), dir), error => /call removed: autoDivision\(\) has no remaining caller/.test(error.message) && /paid facts/.test(error.message));
  assert.match(changesReport(graph, dir), /Payments\.java:4`\*\* call removed[\s\S]*Elements: `Paid`/);
  const unstamped = structuredClone(graph); delete unstamped.meta.sourceCommit;
  assert.equal(verifySourceEvidence(unstamped, dir).status, 'passed', 'without the commit only anchored files are compared');
});
