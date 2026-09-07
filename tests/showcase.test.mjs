import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { validateGraph } from '../skills/q-flow/scripts/validate-graph.mjs';
import { auditGraphLayout } from '../skills/q-flow/assets/viewer/src/edge-routing.js';

const root = path.resolve(import.meta.dirname, '..');
const locales = ['en', 'zh-CN', 'ja', 'ko', 'de', 'fr', 'es'];
const types = ['architecture', 'flowchart', 'sequence', 'er', 'deployment', 'class', 'state', 'usecase', 'dataflow'];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const collection = locale => JSON.parse(read(`examples/showcase/kafka.${locale}.graph.json`)).diagrams;
const topology = graph => ({
  nodes: graph.nodes.map(({ id, kind, source, position, size, fields, attributes, methods }) => ({ id, kind, source, position, size, fields, attributes, methods })),
  edges: graph.edges.map(({ id, source, target, kind, evidence, order, route }) => ({ id, source, target, kind, evidence, order, route })),
  playback: graph.playback
});

test('seven Kafka collections preserve all nine views and the same source evidence', () => {
  const english = collection('en');
  for (const locale of locales) {
    const graphs = collection(locale);
    assert.deepEqual(graphs.map(graph => graph.meta.diagramType), types, locale);
    graphs.forEach((graph, index) => {
      assert.equal(graph.meta.locale, locale);
      assert.deepEqual(validateGraph(graph), [], `${locale}: ${types[index]}`);
      assert.deepEqual(auditGraphLayout(graph).warnings, [], `${locale}: ${types[index]}`);
      assert.deepEqual(topology(graph), topology(english[index]), `${locale}: ${types[index]}`);
    });
  }
});

test('each README links to all languages and its own nine animated GIFs', () => {
  const documents = locales.map(locale => locale === 'en' ? 'README.md' : `docs/readme/README.${locale}.md`);
  documents.forEach((file, index) => {
    const markdown = read(file);
    const links = [...markdown.matchAll(/!?\[[^\]]*\]\(([^\s)]+)\)/g)].map(match => match[1]);
    const local = links.filter(link => !/^(https?:|#)/.test(link)).map(link => path.resolve(root, path.dirname(file), link));
    for (const target of local) assert.ok(fs.existsSync(target), `${file}: ${target}`);
    for (const document of documents) assert.ok(local.includes(path.join(root, document)), `${file}: ${document}`);
    const images = links.filter(link => link.endsWith('.gif'));
    assert.equal(images.length, 9, file);
    for (const type of types) {
      const url = `https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.${locales[index]}.${type}.gif`;
      assert.ok(images.includes(url), `${file}: ${type}`);
    }
  });
});

test('Git installations exclude showcase media from branch/tag history and new files', () => {
  const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
  assert.doesNotMatch(tracked, /\.(gif|mp4)$/m);
  // Codex stores local turn snapshots under refs/codex; normal Git pushes/clones do not include them.
  const history = execFileSync('git', ['rev-list', '--objects', '--branches', '--remotes', '--tags'], { cwd: root, encoding: 'utf8' });
  assert.doesNotMatch(history, /\.(gif|mp4)$/m);
});
