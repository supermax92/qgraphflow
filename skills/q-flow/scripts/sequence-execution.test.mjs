import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateGraph, validateGraphInput } from './validate-graph.mjs';
import { validateExecutions, sequenceExecutions, sequencePairs } from '../assets/viewer/src/sequence-executions.js';
import { validateOperands, sequenceFragment, intersects } from '../assets/viewer/src/sequence-fragments.js';
import { createEdgeRoutes, graphBounds } from '../assets/viewer/src/edge-routing.js';
import { createDiagramSvg } from '../assets/viewer/src/export-svg.js';
import { PALETTES, sequenceGroupColor, edgeColor } from '../assets/viewer/src/visual-style.js';
import { currentGraphFromFlow, graphInputWithEdits } from '../assets/viewer/src/session-graph.js';
import { isDashed } from '../assets/viewer/src/diagrams/registry.js';

const fixture = () => JSON.parse(fs.readFileSync(new URL('../../../examples/sequence-execution.graph.json', import.meta.url)));

test('fragments with and without operands share crossing checks and the final heading obstacle', () => {
  const graph = {
    meta: { title: 'Fragment regression', sourceRef: 'Conceptual test fixture', diagramType: 'sequence' },
    nodes: [100, 700].map((x, i) => ({ id: i ? 'b' : 'a', label: i ? 'B' : 'A', kind: 'participant', position: { x, y: 0 }, size: { width: 120, height: 900 } })),
    edges: [1, 2, 3, 4].map(n => ({ id: `e${n}`, source: 'a', target: 'b', label: `m${n}`, kind: 'sync', order: n * 2, evidence: 'test', route: { messageY: [200, 292, 400, 508][n - 1] } })),
    groups: [
      { id: 'first', label: 'First', kind: 'alt', position: { x: 60, y: 120 }, size: { width: 760, height: 210 }, operands: [{ guard: 'p', edgeIds: ['e1'] }, { guard: 'else', edgeIds: ['e2'] }] },
      { id: 'second', label: 'Second', kind: 'alt', position: { x: 60, y: 310 }, size: { width: 760, height: 230 }, operands: [{ guard: 'q', edgeIds: ['e3'] }, { guard: 'else', edgeIds: ['e4'] }] }
    ]
  };
  for (const legacy of [false, true]) {
    const crossing = structuredClone(graph);
    if (legacy) crossing.groups.forEach(group => delete group.operands);
    assert.match(validateGraph(crossing).join('\n'), /groups first and second cross without nesting/);
    crossing.groups[0].size.height = 180;
    assert.deepEqual(validateGraph(crossing), [], 'Disjoint frames remain valid.');
  }
  graph.groups = [{ ...graph.groups[0], label: 'First branch', position: { x: 60, y: 210 }, size: { width: 760, height: 230 }, operands: [{ guard: 'p', edgeIds: ['e2'] }, { guard: 'else', edgeIds: ['e3'] }] }];
  graph.executions = [{ id: 'a-work', participantId: 'a', start: { edgeId: 'e1', at: 'send' }, end: { edgeId: 'e4', at: 'send' } }];
  for (const legacy of [false, true]) {
    const candidate = structuredClone(graph);
    if (legacy) delete candidate.groups[0].operands;
    assert.deepEqual(validateGraph(candidate), []);
    const fragment = sequenceFragment(candidate.groups[0], createEdgeRoutes(candidate), 'en', candidate.groups, sequenceExecutions(candidate));
    assert.ok(fragment.heading.x > candidate.groups[0].position.x + 16, 'The execution moves the heading.');
    assert.ok(fragment.guards.every(guard => !intersects(guard, fragment.heading)), 'Guards avoid the relocated heading.');
  }
});

test('complete conceptual sequence has six explicit pairs, six executions and both nested fragments', () => {
  const graph = fixture();
  assert.equal(graph.nodes.length, 5);
  assert.equal(graph.edges.length, 12);
  assert.equal(graph.executions.length, 6);
  assert.equal(new Set([...sequencePairs(graph).values()].map(pair => pair.callId)).size, 6);
  assert.deepEqual(validateGraph(graph), []);
  assert.equal(graph.groups.find(group => group.kind === 'alt').parentId, 'retry');
  assert.equal(graph.groups.find(group => group.kind === 'par').parentId, 'optional');
  assert.ok(graph.edges.every(edge => edge.evidence === 'inference'));
  assert.ok(graph.edges.filter(edge => edge.kind === 'sync').every(edge => !isDashed(edge, 'sequence')));
  assert.ok(graph.edges.filter(edge => edge.kind === 'return').every(edge => isDashed(edge, 'sequence')));
});

test('invalid pairing and execution input fails with actionable IDs', () => {
  const cases = [
    [g => g.edges.find(e => e.id === 'r1').replyTo = 'missing', /edge r1.replyTo missing/],
    [g => g.edges.find(e => e.id === 'r1').replyTo = 'r2', /edge r1.replyTo r2/],
    [g => g.edges.find(e => e.id === 'r1').order = 1, /r1.*precede/],
    [g => g.edges.find(e => e.id === 'r1').source = 'risk', /r1.*reversed/],
    [g => g.edges.push({ ...g.edges.find(e => e.id === 'r1'), id: 'duplicate', order: 40 }), /duplicate.*duplicate return/],
    [g => g.edges.find(e => e.id === 'c1').replyTo = 'c3', /c1.*from a return/],
    [g => g.executions.push({ ...g.executions[0] }), /exec-1.*duplicate/],
    [g => g.executions[0].start.edgeId = 'missing', /exec-1.start.*missing/],
    [g => g.executions[0].start.at = 'other', /exec-1.start.*endpoint/],
    [g => g.executions[0].participantId = 'risk', /exec-1.start.*belong/],
    [g => g.executions[0].end = g.executions[0].start, /exec-1.*precede/],
    [g => g.executions[1].parentId = 'missing', /exec-2.*parent missing/],
    [g => g.executions[0].parentId = 'exec-2', /exec-1.*cycle/],
    [g => g.executions[1].parentId = 'exec-3', /exec-2.*another participant/],
    [g => g.executions[0].end = { edgeId: 'r3', at: 'receive' }, /exec-2.*exceeds parent/],
    [g => delete g.executions[1].parentId, /exec-1 and exec-2.*overlap/],
    [g => g.executions = {}, /executions must be an array/],
    [g => g.executions.push(null), /execution must be an object/]
  ];
  for (const [mutate, expected] of cases) { const graph = fixture(); mutate(graph); assert.match(validateExecutions(graph).join('\n'), expected); }
  const async = fixture(); async.edges.find(edge => edge.id === 'c6').kind = 'async';
  assert.deepEqual(validateGraph(async), []);
});

test('nested operands validate ownership, guards, repetition, scope and malformed input', () => {
  const cases = [
    [g => g.groups[0].loop.min = -1, /retry.loop/],
    [g => g.groups[0].loop.max = 0, /retry.loop/],
    [g => delete g.groups[0].operands[0].guard, /retry.*guard/],
    [g => g.groups[0].operands[0].id = '', /retry.*id/],
    [g => g.groups[1].operands[0].guard = 'else', /outcome.*else/],
    [g => g.groups[1].parentOperandId = 'missing', /outcome.*parent operand/],
    [g => { g.groups[0].parentId = 'outcome'; g.groups[0].parentOperandId = 'busy'; }, /retry.*cycle/],
    [g => g.groups[3].operands[1].edgeIds.push('c5'), /parallel.*duplicate edge c5/],
    [g => g.groups[3].operands[1].edgeIds.push('missing'), /parallel.*unknown edge missing/],
    [g => g.groups[3].operands[1].label = '', /parallel.*label/],
    [g => g.groups[1].operands[0].body = '<script>', null],
    [g => g.groups[1].operands[0].body = '', /outcome.*body/],
    [g => delete g.groups[1].operands[0].body, /outcome.*array/],
    [g => g.groups[1].operands[0] = null, /outcome.*object/],
    [g => g.groups[3].operands[1].id = 'risk', /parallel.*duplicate operand/]
  ];
  for (const [mutate, expected] of cases) { const graph = fixture(); mutate(graph); const errors = validateOperands(graph); if (expected) assert.match(errors.join('\n'), expected); else assert.deepEqual(errors, []); }
  const cross = fixture(); cross.groups[3].operands[0].edgeIds = ['c5']; cross.groups[3].operands[1].edgeIds.unshift('r5');
  assert.match(validateGraph(cross).join('\n'), /r5.*same operand scope/);
  const unlimited = fixture(); unlimited.groups[0].loop.max = '*'; assert.deepEqual(validateGraph(unlimited), []);
});

test('shared geometry binds nested self send and receive to different execution edges', () => {
  const graph = fixture(), routes = createEdgeRoutes(graph);
  const executions = sequenceExecutions(graph), main = executions[0], inner = executions[1];
  const callY = graph.edges.find(edge => edge.id === 'c2').route.messageY, returnY = graph.edges.find(edge => edge.id === 'r2').route.messageY;
  assert.deepEqual(routes.get('c2').points[0], { x: main.x + main.width, y: callY });
  assert.deepEqual(routes.get('c2').points.at(-1), { x: inner.x + inner.width, y: callY + 30 });
  assert.deepEqual(routes.get('r2').points[0], { x: inner.x + inner.width, y: returnY });
  assert.deepEqual(routes.get('r2').points.at(-1), { x: main.x + main.width, y: returnY + 30 });
  assert.equal(inner.y + inner.height, returnY);
  const receiver = graph.nodes.find(node => node.id === graph.edges.find(edge => edge.id === 'c3').target);
  const side = receiver.position.x + receiver.size.width / 2 < inner.x ? inner.x : inner.x + inner.width;
  assert.equal(routes.get('c3').points[0].x, side);
  assert.equal(routes.get('r3').points.at(-1).x, side);
  assert.match(routes.get('c1').label, /^C1 ·/);
  assert.match(routes.get('r1').label, /^↩ C1 ·/);
  for (const group of graph.groups) {
    const fragment = sequenceFragment(group, routes, graph.meta.locale, graph.groups, executions);
    assert.deepEqual(fragment.errors, []);
    assert.equal(fragment.guards.length, group.operands.length);
  }
  assert.equal(sequenceFragment(graph.groups[1], routes, 'zh-CN', graph.groups, executions).bodies.length, 2);
  const outside = fixture(); outside.groups[1].position.x = 20; assert.match(validateGraph(outside).join('\n'), /outcome.*exceeds parent retry|retry.*child outcome/);
  const crossing = fixture(); crossing.groups[2].position.y = 1000; assert.match(validateGraph(crossing).join('\n'), /cross without nesting/);
  const crowded = fixture(); crowded.groups[1].size.height = 50; assert.match(validateGraph(crowded).join('\n'), /outcome.*no room/);
  const bounds = graphBounds(graph); assert.ok(bounds.y + bounds.height >= main.y + main.height);
});

test('group colors and explicit metadata survive edits, themes and static export', () => {
  const graph = fixture(), before = structuredClone(graph);
  const edited = currentGraphFromFlow(graph, graph.nodes.map(node => ({ ...node, type: 'diagram', position: { ...node.position, x: node.position.x + 10 }, data: { ...node, label: node.label + ' A' } })), graph.edges.map(edge => ({ id: edge.id, data: { ...edge, label: '短标签' } })));
  const roundTrip = JSON.parse(JSON.stringify(graphInputWithEdits(graph, new Map(), edited)));
  assert.deepEqual(roundTrip.executions, graph.executions); assert.deepEqual(roundTrip.groups, graph.groups);
  assert.deepEqual(roundTrip.edges.map(edge => edge.replyTo), graph.edges.map(edge => edge.replyTo));
  assert.deepEqual(graph, before);
  for (const palette of Object.values(PALETTES)) {
    const pairs = sequencePairs(graph), colors = new Set();
    for (let index = 0; index < 8; index++) colors.add(sequenceGroupColor({ index }, palette));
    assert.equal(colors.size, 8); assert.equal(sequenceGroupColor({ index: 8 }, palette), sequenceGroupColor({ index: 0 }, palette));
    for (const edge of graph.edges.filter(edge => edge.replyTo)) assert.equal(sequenceGroupColor(pairs.get(edge.id), palette), sequenceGroupColor(pairs.get(edge.replyTo), palette));
    assert.deepEqual([...sequencePairs(roundTrip)], [...pairs]);
    assert.equal(edgeColor({ kind: 'failure' }, {}, palette), palette.warn);
  }
  for (const theme of ['light', 'dark']) {
    const svg = createDiagramSvg(graph, theme);
    assert.equal((svg.match(/class="sequence-execution"/g) ?? []).length, 6);
    assert.match(svg, /↩ C6/); assert.match(svg, /1\.\.3/); assert.match(svg, /reserved ← true/);
    assert.match(svg, /Radix Colors/); assert.doesNotMatch(svg, /edge-flow|selection-feedback/);
    const unsafe = fixture(); unsafe.groups[1].operands[0].body = '<script>alert(1)</script>';
    const escaped = createDiagramSvg(unsafe, theme); assert.doesNotMatch(escaped, /<script>/); assert.match(escaped, /&lt;script&gt;/);
  }
  const old = fixture(); delete old.executions; old.edges.forEach(edge => delete edge.replyTo); old.groups = [];
  assert.deepEqual(validateGraph(old), []); assert.equal(sequencePairs(old).size, 0);
});

test('the CLI asks for the callee bar of every answered sync call; the Viewer, legacy graphs and async pairs do not', () => {
  const graph = fixture(); graph.executions = graph.executions.filter(bar => bar.id !== 'exec-6');
  assert.deepEqual(validateGraph(graph), [], 'The Viewer still renders a graph without that bar.');
  assert.deepEqual(validateGraphInput(graph), ['edge c6 sync call answered by r6 needs an execution on audit from c6 receive to r6 send; --fix adds it']);
  graph.edges.find(edge => edge.id === 'c6').kind = 'async';
  assert.deepEqual(validateGraphInput(graph), [], 'An async caller does not wait, so its pair needs no bar.');
  const old = fixture(); delete old.executions; old.edges.forEach(edge => delete edge.replyTo); old.groups = [];
  assert.deepEqual(validateGraphInput(old), [], 'Legacy graphs without replyTo are not asked for bars.');
});

test('two answered calls to one callee that interleave are not asked for bars no nesting could draw', () => {
  const graph = { meta: { title: 'Interleave', sourceRef: 'test', diagramType: 'sequence' },
    nodes: ['a', 'b', 'c'].map(id => ({ id, label: id, kind: 'service' })),
    edges: [
      { id: 'c1', source: 'a', target: 'b', kind: 'sync', label: 'first()', order: 1, evidence: 'test' },
      { id: 'c2', source: 'c', target: 'b', kind: 'sync', label: 'second()', order: 2, evidence: 'test' },
      { id: 'r1', source: 'b', target: 'a', kind: 'return', label: 'ok', order: 3, replyTo: 'c1', evidence: 'test' },
      { id: 'r2', source: 'b', target: 'c', kind: 'return', label: 'ok', order: 4, replyTo: 'c2', evidence: 'test' }] };
  assert.deepEqual(validateGraphInput(graph, { inputOnly: true }), []);
  graph.edges[2].order = 5; // r1 now closes after r2, so c2 nests inside c1
  assert.equal(validateGraphInput(graph, { inputOnly: true }).length, 2, 'nested calls are asked for both bars');
});

test('messages without route.messageY (or without a route) are stacked by order and the quality gate names the gap', () => {
  for (const strip of [edge => { delete edge.route; }, edge => { edge.route = {}; }]) {
    const graph = fixture(); graph.edges.forEach(strip);
    const routes = createEdgeRoutes(graph);   // used to throw "Cannot read properties of undefined (reading 'messageY')"
    const ys = [...graph.edges].sort((a, b) => a.order - b.order).map(edge => routes.get(edge.id).points[0].y);
    assert.ok(ys.every(Number.isFinite), 'every message gets a finite position');
    assert.ok(ys.every((y, i) => !i || y > ys[i - 1]), 'in message order');
    assert.match(validateGraph(graph).join('\n'), /route\.messageY is required for a positioned sequence message/);
  }
});

test('pair numbers follow message order even when call ids sort differently as strings', () => {
  const graph = { meta: { title: 'Pairs', sourceRef: 'test', diagramType: 'sequence' },
    nodes: [{ id: 'a', label: 'A', kind: 'actor' }, { id: 'b', label: 'B', kind: 'service' }],
    edges: [
      { id: 'm2', source: 'a', target: 'b', kind: 'sync', label: 'first()', order: 1, evidence: 'source' },
      { id: 'm3', source: 'b', target: 'a', kind: 'return', label: 'ok', order: 2, replyTo: 'm2', evidence: 'source' },
      { id: 'm12', source: 'a', target: 'b', kind: 'sync', label: 'second()', order: 3, evidence: 'source' },
      { id: 'm13', source: 'b', target: 'a', kind: 'return', label: 'ok', order: 4, replyTo: 'm12', evidence: 'source' }
    ] };
  const pairs = sequencePairs(graph);
  assert.equal(pairs.get('m2').label, 'C1'); assert.equal(pairs.get('m3').label, '↩ C1');
  assert.equal(pairs.get('m12').label, 'C2'); assert.equal(pairs.get('m13').label, '↩ C2');
});
