import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compileGraphLayout, shapeRank } from './compile-layout.mjs';
import { layoutComposition } from './validate-graph.mjs';
import { auditLayoutQuality } from '../assets/viewer/src/layout-quality.js';

const input = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../../tests/fixtures/edge-crossings.graph.json'), 'utf8'));
const fixture = type => structuredClone(input.diagrams.find(graph => graph.meta.diagramType === type));
const crossings = graph => auditLayoutQuality(graph).crossings.reduce((sum, item) => sum + item.measured, 0);
const geometry = ({ graph }) => ({ nodes: graph.nodes.map(({ id, position, size }) => ({ id, position, size })).sort((a, b) => a.id.localeCompare(b.id)), edges: graph.edges.map(({ id, route }) => ({ id, route })).sort((a, b) => a.id.localeCompare(b.id)) });

// Each fixture is planar and its edges are authored in an order that puts relations across each other when ports, decision and
// actor sides, node order and fold lanes simply follow it: the ER ports of one entity, two long state transitions, two fold
// lanes of a data-flow strip, an actor edge through an extend line.
for (const type of ['er', 'state', 'dataflow', 'usecase']) {
  test(`${type}: relations that can avoid each other do not cross`, async () => {
    const result = await compileGraphLayout(fixture(type));
    assert.equal(crossings(result.graph), 0, type);
    assert.deepEqual(auditLayoutQuality(result.graph).errors, []);
    assert.equal(result.report.candidates.length, 6, 'the receipt still lists one entry per candidate');
    assert.ok(result.report.candidates.some(item => item.refined), 'a candidate came from the crossing search');
  });
}

test('a full 3x3 mesh keeps the crossings its topology forces and loses no relation', async () => {
  const graph = fixture('deployment'), result = await compileGraphLayout(graph);
  assert.equal(result.graph.edges.length, graph.edges.length);
  // K3,3 drawn between two columns needs 9 crossings; the search must reach that floor, not stop above it.
  assert.equal(crossings(result.graph), 9);
  assert.deepEqual(auditLayoutQuality(result.graph).errors, []);
});

test('the search is deterministic and ignores input order', async () => {
  const graph = fixture('state'), reversed = structuredClone(graph);
  for (const key of ['nodes', 'edges']) reversed[key].reverse();
  const first = await compileGraphLayout(graph);
  assert.deepEqual(geometry(first), geometry(await compileGraphLayout(graph)), 'repeat');
  assert.deepEqual(geometry(first), geometry(await compileGraphLayout(reversed)), 'permutation');
});

test('nothing is refined when no relation crosses', async () => {
  const graph = fixture('er');
  graph.edges = graph.edges.filter(edge => edge.id === graph.edges[0].id);
  graph.nodes = graph.nodes.filter(node => [graph.edges[0].source, graph.edges[0].target].includes(node.id));
  const result = await compileGraphLayout(graph);
  assert.equal(crossings(result.graph), 0);
  assert.ok(result.report.candidates.every(item => !item.refined), 'nothing to refine when no relation crosses');
});

test('with equal crossings a shape inside the aspect band wins before compactness', async () => {
  const kafka = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../../examples/showcase/kafka.en.graph.json'), 'utf8'));
  const view = structuredClone(kafka.diagrams.find(graph => graph.meta.diagramType === 'architecture'));
  delete view.layout;
  for (const item of [...view.nodes, ...(view.groups ?? [])]) { delete item.position; delete item.size; }
  for (const edge of view.edges) delete edge.route;
  const { graph } = await compileGraphLayout(view);
  assert.equal(crossings(graph), 0);
  assert.ok(layoutComposition(graph).withinBand, `ratio ${layoutComposition(graph).aspectRatio} leaves the band although an in-band candidate has no crossings either`);
});

test('a long strip outranks crossings only by a whole shape step', () => {
  assert.equal(shapeRank(1.2), 1, 'inside the tie every shape ranks the same');
  assert.equal(shapeRank(1.52), shapeRank(1.64), 'a marginally better strip does not beat a crossing');
  assert.ok(shapeRank(2.2) > shapeRank(1.6), 'a clearly better shape still wins');
});

// A slow or busy machine must neither change a layout nor fail it: the search ends on its evaluation budget, and the timeout
// only guards one solve against a hang. The fake clock tells every read after the first that two minutes have passed.
test('the layout does not depend on the clock', async () => {
  const real = performance.now;
  for (const type of ['state', 'er']) {
    const view = fixture(type), expected = geometry(await compileGraphLayout(structuredClone(view)));
    let reads = 0;
    performance.now = () => real.call(performance) + (reads++ ? 120_000 : 0);
    try { assert.deepEqual(geometry(await compileGraphLayout(structuredClone(view))), expected, `${type}: layout under a clock that reads past the limit`); }
    finally { performance.now = real; }
  }
});
