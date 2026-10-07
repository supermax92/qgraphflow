import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { root, collectionPath, repoRoot, compiled, collection } from './jeepay.mjs';
import { diagramSvgFiles } from '../skills/q-flow/assets/viewer/src/export-svg.js';
import { graphInputWithEdits, pageWithGraph } from '../skills/q-flow/assets/viewer/src/session-graph.js';

const run = (...args) => spawnSync(process.execPath, [path.join(root, 'bin/qgraphflow.mjs'), ...args], { encoding: 'utf8', timeout: 120_000 });
const temporary = t => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-jeepay-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; };
const contents = dir => Object.fromEntries(fs.readdirSync(dir).sort().map(name => [name, fs.readFileSync(path.join(dir, name))]));

test('Jeepay CLI validates sources and generates all eleven views from facts', t => {
  const dir = temporary(t), output = path.join(dir, 'output');
  const validation = run('validate', collectionPath, '--input-only', '--repo-root', repoRoot);
  assert.equal(validation.status, 0, validation.stderr);
  assert.equal(JSON.parse(validation.stdout).sourceEvidence.status, 'passed');
  const generated = run('generate', collectionPath, output, '--repo-root', repoRoot);
  assert.equal(generated.status, 0, generated.stderr);
  const saved = JSON.parse(fs.readFileSync(path.join(output, 'graph.json'), 'utf8'));
  assert.equal(saved.diagrams.length, collection.diagrams.length);
  const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  assert.equal(pageWithGraph(html, saved), html);
  for (const { name, svg } of diagramSvgFiles(saved)) assert.equal(fs.readFileSync(path.join(output, name), 'utf8'), svg);
  const checked = run('validate', path.join(output, 'graph.json'), '--repo-root', repoRoot);
  assert.equal(checked.status, 0, checked.stderr);
  assert.equal(JSON.parse(checked.stdout).sourceEvidence.status, 'passed');
  const before = contents(output);
  assert.equal(run('generate', collectionPath, output, '--repo-root', repoRoot).status, 1);
  assert.deepEqual(contents(output), before);
});

test('Jeepay failed validation preserves existing output, even with --force', async t => {
  const dir = temporary(t), output = path.join(dir, 'output'), file = path.join(dir, 'input.json');
  fs.mkdirSync(output); fs.writeFileSync(path.join(output, 'index.html'), 'accepted page');
  fs.writeFileSync(path.join(output, 'graph.json'), 'accepted graph');
  const input = (await compiled('relations')).graph;
  input.nodes[1].position = { ...input.nodes[0].position };
  fs.writeFileSync(file, JSON.stringify(input));
  const before = contents(output), result = run('generate', file, output, '--layout', 'preserve', '--force', '--repo-root', repoRoot);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /overlap/);
  assert.deepEqual(contents(output), before);
});

test('Jeepay collection edits isolate views and retain fields, sources and all relationships', async () => {
  const input = { diagrams: [(await compiled('capabilities')).graph, (await compiled('engineering')).graph, (await compiled('er')).graph] };
  const before = structuredClone(input), edited = structuredClone(input.diagrams[0]);
  edited.nodes[0].overviewText.push('CI edit');
  const saved = graphInputWithEdits(input, new Map([[edited.meta.viewId, edited]]), input.diagrams[1]);
  assert.deepEqual(saved.diagrams[0], edited);
  assert.deepEqual(saved.diagrams.slice(1), input.diagrams.slice(1));
  assert.deepEqual(input, before);
});
