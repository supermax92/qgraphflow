import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { compileGraphLayout } from './compile-layout.mjs';
import { validateGraphInput } from '../assets/viewer/src/graph-validation.js';
import { createDiagramSvg } from '../assets/viewer/src/export-svg.js';
import { auditLayoutQuality } from '../assets/viewer/src/layout-quality.js';

const nested = (position, repetitions) => {
  const active = { id: 'accept', guard: 'valid', edgeIds: [] };
  const empty = { id: 'reject', guard: 'invalid', body: 'Reject invalid input. '.repeat(repetitions), edgeIds: [] };
  return {
    meta: { title: 'Nested empty branch', sourceRef: 'Conceptual regression', diagramType: 'sequence', locale: 'en' },
    nodes: ['a', 'b'].map(id => ({ id, label: id, kind: 'participant', module: 'flow' })),
    edges: [{ id: 'call', source: 'a', target: 'b', kind: 'sync', order: 1, label: 'Request', evidence: 'inference' }],
    groups: [
      { id: 'outer', kind: 'alt', label: 'Validation', operands: position === 'first' ? [empty, active] : [active, empty] },
      { id: 'inner', kind: 'opt', label: 'Dispatch', parentId: 'outer', parentOperandId: 'accept', operands: [{ id: 'send', guard: 'ready', edgeIds: ['call'] }] }
    ]
  };
};

for (const position of ['first', 'last']) for (const repetitions of [1, 12]) test(`nested sequence retains a ${position} message-free branch with body length ${repetitions}`, async () => {
  const input = nested(position, repetitions);
  assert.deepEqual(validateGraphInput(input, { inputOnly: true }), []);
  const { graph, report } = await compileGraphLayout(input);
  assert.deepEqual(auditLayoutQuality(graph).errors, []);
  assert.equal(report.semantics.preserved, true);
  assert.deepEqual(graph.groups.map(group => group.operands), input.groups.map(group => group.operands));
  assert.match(createDiagramSvg(graph), /Reject invalid input/);
});

test('source-grounded detailed sequence keeps all calls and nested failure branches through generation', async () => {
  const input = JSON.parse(fs.readFileSync(new URL('../../../tests/fixtures/guided-intake/detailed-sequence.graph.json', import.meta.url)));
  assert.deepEqual(validateGraphInput(input, { inputOnly: true }), []);
  const { graph, report } = await compileGraphLayout(input);
  assert.deepEqual(auditLayoutQuality(graph).errors, []);
  assert.equal(report.semantics.preserved, true);
  assert.deepEqual(graph.edges.map(({ route, ...edge }) => edge), input.edges);
  assert.deepEqual(graph.groups.map(group => group.operands), input.groups.map(group => group.operands));
  assert.deepEqual(graph.executions, input.executions);
  for (const theme of ['light', 'dark']) assert.match(createDiagramSvg(graph, theme), /operand-separator/);
});

test('consecutive message-free operands between nested branches retain asymmetric text', async () => {
  const input = nested('first', 1);
  input.groups[0].operands.push(
    { id: 'skip', guard: 'skipped', body: 'No downstream calls are required. '.repeat(12), edgeIds: [] },
    { id: 'cancel', guard: 'cancelled', body: 'End this attempt.', edgeIds: [] },
    { id: 'retry', guard: 'retry permitted', edgeIds: [] }
  );
  input.edges.push({ ...input.edges[0], id: 'retry-call', order: 2, label: 'Retry' });
  input.groups.push({ ...input.groups[1], id: 'retry-inner', parentOperandId: 'retry', operands: [{ id: 'retry-send', guard: 'ready', edgeIds: ['retry-call'] }] });
  assert.deepEqual(validateGraphInput(input, { inputOnly: true }), []);
  const { graph, report } = await compileGraphLayout(input);
  assert.equal(report.semantics.preserved, true);
  assert.deepEqual(auditLayoutQuality(graph).errors, []);
  assert.deepEqual(graph.groups.map(group => group.operands), input.groups.map(group => group.operands));
});
