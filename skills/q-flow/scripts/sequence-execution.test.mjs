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
