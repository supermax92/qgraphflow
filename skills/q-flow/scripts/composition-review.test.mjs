import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { reviewComposition, validateGraphInput } from './validate-graph.mjs';
import { compileViews } from './generate-viewer.mjs';

const script = path.join(import.meta.dirname, 'validate-graph.mjs');
const skillDir = path.join(import.meta.dirname, '..');
const meta = diagramType => ({ title: 't', sourceRef: 'r', diagramType });
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
const temp = (t, graph) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-review-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'graph.json');
  fs.writeFileSync(file, `${JSON.stringify(graph, null, 2)}\n`);
  return file;
};
const rules = warnings => warnings.map(warning => warning.ruleId);

const flowchart = (module, count = 6) => {
  const nodes = [{ id: 'start', label: 'start', kind: 'start', module }];
  for (let i = 1; i < count - 1; i++) nodes.push({ id: `p${i}`, label: `step ${i}`, kind: 'process', module });
  nodes.push({ id: 'end', label: 'end', kind: 'end', module });
  const edges = nodes.slice(1).map((node, i) => ({ id: `f${i}`, source: nodes[i].id, target: node.id, kind: 'flow', evidence: 'source' }));
  return { meta: meta('flowchart'), nodes, edges };
};

test('edge.site-missing starts once a graph records a site and spares inference, framework and returns', () => {
  const graph = JSON.parse(fs.readFileSync(path.join(skillDir, '../../examples/sequence-execution.graph.json'), 'utf8'));
  const set = (id, change) => Object.assign(graph.edges.find(edge => edge.id === id), change);
  for (const id of ['c1', 'c3', 'r3']) set(id, { evidence: 'source' });
  set('c4', { evidence: 'framework' });
  assert.deepEqual(rules(reviewComposition(graph)), [], 'no site anywhere: the graph predates the field');
  set('c1', { site: { file: 'a.js', lineStart: 1 } });
  const [warning, ...rest] = reviewComposition(graph);
  assert.deepEqual([warning.ruleId, warning.severity, warning.elementIds, rest], ['edge.site-missing', 'warning', ['c3'], []]);
  assert.match(warning.message, /edge c3 has repository evidence but no site, while 1 other edge records one/);
  set('c3', { site: { file: 'a.js', lineStart: 2 } });
  assert.deepEqual(reviewComposition(graph), []);
});

test('a collection that uses no module identity anywhere gets no composition warning', () => {
  const showcase = JSON.parse(fs.readFileSync(path.join(skillDir, '../../examples/showcase/kafka.en.graph.json'), 'utf8'));
  assert.deepEqual(validateGraphInput(showcase, { inputOnly: true }), []);
  assert.deepEqual(reviewComposition(showcase), []);
  assert.deepEqual(reviewComposition({ ...flowchart(undefined, 8), nodes: flowchart(undefined, 8).nodes.map(({ module, ...node }) => node) }), []);
});

test('an invalid graph is not reviewed: errors stay with the validator', () => {
  assert.deepEqual(reviewComposition({ meta: meta('architecture'), nodes: [], edges: [] }), []);
});

test('module.missing names ordinary nodes without a module once the collection uses modules; outsiders and initial/final stay silent', () => {
  const graph = { meta: meta('architecture'), nodes: [
    { id: 'svc', label: 'OrderService', kind: 'service', module: 'order' },
    { id: 'repo', label: 'OrderRepository', kind: 'data' },
    { id: 'client', label: 'Web client', kind: 'external' }
  ], edges: [{ id: 'e1', source: 'svc', target: 'repo', kind: 'data', evidence: 'source' }] };
  const warnings = reviewComposition(graph);
  assert.deepEqual(rules(warnings), ['module.missing']);
  assert.deepEqual(warnings[0].elementIds, ['repo']);
  assert.equal(warnings[0].severity, 'warning');
  assert.equal(warnings[0].diagramType, 'architecture');
  assert.match(warnings[0].message, /plain surface/);
  const state = { meta: meta('state'), nodes: [
    { id: 'i', label: 'start', kind: 'initial' }, { id: 'a', label: 'created', kind: 'state', module: 'order' }, { id: 'f', label: 'done', kind: 'final' }
  ], edges: [{ id: 's0', source: 'i', target: 'a', kind: 'transition', label: 'new', evidence: 'source' }, { id: 's1', source: 'a', target: 'f', kind: 'transition', label: 'close', evidence: 'source' }] };
  assert.deepEqual(reviewComposition(state), []);
});

test('module.inconsistent flags the same label carrying a module in one view but none or another in a second view', () => {
  const collection = { diagrams: [
    { meta: meta('architecture'), nodes: [{ id: 'k', label: 'Kafka', kind: 'external', module: 'pigeon' }, { id: 'a', label: 'A', kind: 'service', module: 'core' }],
      edges: [{ id: 'e', source: 'a', target: 'k', kind: 'call', evidence: 'source' }] },
    { meta: meta('sequence'), nodes: [{ id: 'c', label: 'caller', kind: 'actor' }, { id: 'k', label: 'Kafka', kind: 'external' }, { id: 'a', label: 'A', kind: 'service', module: 'other' }],
      edges: [{ id: 'm1', source: 'c', target: 'a', kind: 'sync', label: 'x', order: 1, evidence: 'source' }, { id: 'm2', source: 'a', target: 'k', kind: 'async', label: 'y', order: 2, evidence: 'source' }] }
  ] };
  assert.deepEqual(validateGraphInput(collection, { inputOnly: true }), []);
  const warnings = reviewComposition(collection);
  const inconsistent = warnings.filter(warning => warning.ruleId === 'module.inconsistent');
  assert.deepEqual(inconsistent.map(warning => `${warning.diagramType}:${warning.elementIds.join(',')}`).sort(), ['architecture:a', 'sequence:a', 'sequence:k']);
  assert.match(inconsistent.find(warning => warning.elementIds[0] === 'k').message, /has no module here but "pigeon" in architecture/);
  assert.ok(warnings.every(warning => warning.ruleId !== 'module.missing'), 'an outsider without a module is not "missing"');
});

test('module.single-tone fires for a flowchart or data flow painted in one module, not for a state chart', () => {
  const single = reviewComposition(flowchart('core', 6));
  assert.deepEqual(rules(single), ['module.single-tone']);
  assert.equal(single[0].elementIds.length, 6);
  assert.match(single[0].remediation, /one subsystem's work/);
  assert.deepEqual(rules(reviewComposition(flowchart('core', 5))), [], 'small flows are left alone');
  const mixed = flowchart('core', 6); mixed.nodes[2].module = 'redis';
  assert.deepEqual(rules(reviewComposition(mixed)), []);
  const nodes = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => ({ id, label: id, kind: 'state', module: 'one' }));
  const state = { meta: meta('state'), nodes: [{ id: 'i', label: 'start', kind: 'initial' }, ...nodes],
    edges: [{ id: 's0', source: 'i', target: 'a', kind: 'transition', label: 'new', evidence: 'source' }, ...nodes.slice(1).map((node, i) => ({ id: `s${i + 1}`, source: nodes[i].id, target: node.id, kind: 'transition', label: 'next', evidence: 'source' }))] };
  assert.deepEqual(rules(reviewComposition(state)), []);
});

test('flowchart.process-branch flags a non-decision with two outgoing edges', () => {
  const graph = flowchart('a', 6); graph.nodes[1].module = 'b';
  graph.edges.push({ id: 'extra', source: 'p1', target: 'end', kind: 'flow', evidence: 'source' });
  const warnings = reviewComposition(graph);
  assert.deepEqual(rules(warnings), ['flowchart.process-branch']);
  assert.deepEqual(warnings[0].elementIds, ['p1']);
  assert.match(warnings[0].message, /only a decision branches/);
});

test('the validator CLI prints composition warnings to stderr, counts them in the receipt and still exits 0', t => {
  const file = temp(t, flowchart('core', 6));
  const result = run(file, '--input-only');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Composition warning \(flowchart\) module\.single-tone:/);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.valid, true);
  assert.equal(receipt.warnings, 1);
  const clean = run(temp(t, { ...flowchart('core', 6), nodes: flowchart('core', 6).nodes.map((node, i) => ({ ...node, module: i % 2 ? 'core' : 'redis' })) }), '--input-only');
  assert.equal(clean.status, 0, clean.stderr);
  assert.doesNotMatch(clean.stderr, /Composition warning/);
  assert.equal(JSON.parse(clean.stdout).warnings, undefined, 'a clean receipt stays as it was');
  // Generation and the output check see the same facts again: they count, they do not repeat the lines.
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-warn-once-'));
  t.after(() => fs.rmSync(output, { recursive: true, force: true }));
  const generated = spawnSync(process.execPath, [path.join(skillDir, 'scripts/generate-viewer.mjs'), file, output, '--force'], { encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stderr);
  assert.doesNotMatch(generated.stderr, /Composition warning/);
  assert.equal(JSON.parse(generated.stdout).warnings, 1);
  const checked = run(path.join(output, 'graph.json'));
  assert.equal(checked.status, 0, checked.stderr);
  assert.doesNotMatch(checked.stderr, /Composition warning/);
  assert.equal(JSON.parse(checked.stdout).warnings, 1);
});

const longSequence = (participants = 10, messages = 60) => ({
  meta: meta('sequence'),
  nodes: Array.from({ length: participants }, (_, i) => ({ id: `p${i}`, label: `Service ${i}`, kind: 'service' })),
  edges: Array.from({ length: messages }, (_, i) => ({ id: `m${i}`, source: `p${i % (participants - 1)}`, target: `p${i % (participants - 1) + 1}`, kind: 'async', label: `event ${i}`, order: i + 1, evidence: 'source' }))
});

test('a view that needs many screens at the readable zoom is flagged once, by generation', t => {
  const generate = (graph, ...extra) => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-oversized-'));
    t.after(() => fs.rmSync(output, { recursive: true, force: true }));
    return { output, result: spawnSync(process.execPath, [path.join(skillDir, 'scripts/generate-viewer.mjs'), temp(t, graph), output, '--force', ...extra], { encoding: 'utf8' }) };
  };
  const input = run(temp(t, longSequence()), '--input-only');
  assert.equal(input.status, 0, input.stderr);
  assert.doesNotMatch(input.stderr, /view\.oversized/, 'a graph without positions cannot be measured');
  const { output, result } = generate(longSequence());
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr.match(/view\.oversized/g)?.length, 1, 'generation prints it once');
  assert.match(result.stderr, /Composition warning \(sequence\) view\.oversized: the view spans \d+×\d+ units, about \d+\.\d screens/);
  assert.equal(JSON.parse(result.stdout).warnings, 1);
  const checked = run(path.join(output, 'graph.json'));
  assert.equal(checked.status, 0, checked.stderr);
  assert.doesNotMatch(checked.stderr, /view\.oversized/, 'the output check only counts it');
  assert.equal(JSON.parse(checked.stdout).warnings, 1);
  const small = generate(longSequence(4, 8));
  assert.equal(small.result.status, 0, small.result.stderr);
  assert.doesNotMatch(small.result.stderr, /view\.oversized/);
  assert.equal(JSON.parse(small.result.stdout).warnings, undefined, 'a view that reads in a few screens stays clean');
});

test('compileViews compiles every view before failing and names each failing view once', async () => {
  const views = ['architecture', 'class', 'state'].map(type => ({ meta: meta(type), nodes: [], edges: [] }));
  const failing = new Set(['class', 'state']);
  const compile = async graph => {
    if (!failing.has(graph.meta.diagramType)) return { graph };
    throw Object.assign(new Error(`No valid layout candidate for ${graph.meta.diagramType}:\n- spacing.labels: a, b`), {
      phases: { semantic: { status: 'passed' }, geometry: { status: 'failed' }, rendering: { status: 'not-checked' } },
      diagnostics: [{ ruleId: 'spacing.labels', diagramType: graph.meta.diagramType }], candidates: [{ index: 0 }]
    });
  };
  await assert.rejects(compileViews(views, compile), error => {
    assert.match(error.message, /No valid layout candidate for class/);
    assert.match(error.message, /No valid layout candidate for state/);
    assert.deepEqual(error.failedViews, ['class', 'state']);
    assert.deepEqual(error.diagnostics.map(item => item.diagramType), ['class', 'state']);
    assert.deepEqual(Object.keys(error.candidates), ['class', 'state']);
    assert.equal(error.phases.geometry.status, 'failed');
    return true;
  });
  failing.delete('state');
  await assert.rejects(compileViews(views, compile), error => error.failedViews === undefined && /class/.test(error.message) && Array.isArray(error.candidates));
  failing.clear();
  assert.deepEqual((await compileViews(views, compile)).map(item => item.graph.meta.diagramType), ['architecture', 'class', 'state']);
});

test('the authoring pages and the skill carry the card-identity rules the review enforces', () => {
  const read = file => fs.readFileSync(path.join(skillDir, file), 'utf8');
  assert.match(read('references/graph-common.md'), /without `module` renders on the plain surface/);
  assert.match(read('references/types/flowchart.md'), /subsystem whose work the step performs/);
  assert.match(read('references/types/flowchart.md'), /module\.single-tone/);
  assert.match(read('references/types/flowchart.md'), /only a `decision` branches/);
  assert.match(read('references/types/state.md'), /`choice` takes the module/);
  assert.match(read('SKILL.md'), /never rename a module for colour/);
  assert.match(read('references/graph-common.md'), /never renamed for colour/);
});
