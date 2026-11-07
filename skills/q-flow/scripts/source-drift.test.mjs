import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { collection, repoRoot, source } from '../../../tests/jeepay.mjs';
import { mapLine, parseHunks } from './source-drift.mjs';
import { fixGraphFile, stampSourceFiles, verifySourceEvidence } from './validate-graph.mjs';

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
  assert.equal(sequence.meta.sourceFiles[anchor.file], git(dir, 'hash-object', anchor.file).trim());
  assert.throws(() => verifySourceEvidence(fixed, dir), /Unresolved source drift/);
  for (const item of fixed.diagrams) delete item.meta.sourceDrift;
  assert.equal(verifySourceEvidence(fixed, dir).status, 'passed');
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
