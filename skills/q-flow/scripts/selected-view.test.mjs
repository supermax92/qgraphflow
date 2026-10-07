import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { compileGraphLayout } from './compile-layout.mjs';
import { jeepay, compiled } from '../../../tests/jeepay.mjs';
import { diagramSvgFiles } from '../assets/viewer/src/export-svg.js';

const generator = path.join(import.meta.dirname, 'generate-viewer.mjs');
const fixture = jeepay('relations');
const baseline = (await compileGraphLayout(fixture)).graph;

async function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-selected-view-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const input = { diagrams: ['first', 'second', 'third'].map((viewId, index) => {
    const graph = structuredClone(baseline), dx = 120 * (index + 1);
    graph.meta.viewId = viewId;
    graph.meta.title = `Edited ${viewId}`;
    for (const node of graph.nodes) node.position.x += dx;
    for (const edge of graph.edges) {
      for (const point of edge.route.via) point.x += dx;
      edge.route.labelAt.x += dx;
    }
    return graph;
  }) };
  for (const graph of input.diagrams) await compileGraphLayout(graph, { layout: 'preserve' });
  const file = path.join(dir, 'input.json'), output = path.join(dir, 'output');
  const write = () => fs.writeFileSync(file, JSON.stringify(input));
  write();
  const run = (...args) => spawnSync(process.execPath, [generator, file, output, ...args], { encoding: 'utf8' });
  return { input, file, output, write, run };
}

for (const selected of [['second'], ['first', 'third']]) test(`auto-layout selects ${selected.join(', ')} and preserves every other view`, async t => {
  const { input, output, run } = await setup(t);
  const result = run('--layout', 'auto', ...selected.flatMap(id => ['--view', id]));
  assert.equal(result.status, 0, result.stderr);
  const saved = JSON.parse(fs.readFileSync(path.join(output, 'graph.json')));
  const beforeSvgs = diagramSvgFiles(input), afterSvgs = diagramSvgFiles(saved);
  for (let i = 0; i < input.diagrams.length; i++) {
    const before = input.diagrams[i], after = saved.diagrams[i];
    assert.equal(after.meta.viewId, before.meta.viewId);
    if (selected.includes(before.meta.viewId)) {
      assert.notDeepEqual(after.nodes.map(n => n.position), before.nodes.map(n => n.position));
      assert.deepEqual(after.nodes.map(({ position, size, ...node }) => node), before.nodes.map(({ position, size, ...node }) => node));
    } else {
      assert.deepEqual(after, before);
      assert.deepEqual(afterSvgs[i], beforeSvgs[i]);
      assert.equal(fs.readFileSync(path.join(output, beforeSvgs[i].name), 'utf8'), beforeSvgs[i].svg);
    }
  }
});

test('an unknown selection, incompatible mode or invalid unselected view never replaces existing outputs', async t => {
  const { input, output, write, run } = await setup(t);
  const initial = run('--layout', 'preserve');
  assert.equal(initial.status, 0, initial.stderr);
  const contents = () => Object.fromEntries(fs.readdirSync(output).map(name => [name, fs.readFileSync(path.join(output, name))]));
  const before = contents();
  for (const [args, message] of [
    [['--view', 'missing'], /Unknown view: missing/],
    [['--view', 'second', '--layout', 'preserve'], /requires --layout auto/]
  ]) {
    const result = run('--force', ...args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, message);
    assert.deepEqual(contents(), before);
  }
  input.diagrams[0].nodes[1].position = { ...input.diagrams[0].nodes[0].position };
  write();
  const result = run('--force', '--view', 'second');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /overlap/);
  assert.deepEqual(contents(), before);
});

test('selecting a view never migrates ownership in an unselected legacy view', async t => {
  const { input, output, write, run } = await setup(t);
  // Simulate an older saved copy of the real Compose boundary, without inventing a new frame.
  input.diagrams[0] = (await compiled('deployment')).graph;
  input.diagrams[0].meta.viewId = 'first';
  for (const node of input.diagrams[0].nodes) delete node.groupId;
  write();
  const migrated = await compileGraphLayout(input.diagrams[0], { layout: 'preserve' });
  assert.ok(migrated.report.migration.length > 0);
  const result = run('--view', 'second');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unselected view first requires migration/);
  assert.equal(fs.existsSync(output), false);
});
