#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { validateGraphInput, verifySourceEvidence } from '../skills/q-flow/scripts/validate-graph.mjs';

const repo = process.argv[2];
if (!repo) throw new Error('Usage: node scripts/refresh-jeepay-fixtures.mjs <Jeepay repository root>');
const root = fs.realpathSync(repo), destination = path.resolve(import.meta.dirname, '../examples/jeepay');
const views = [
  ['capabilities', 'jeepay-platform-capability-architecture'],
  ['engineering', 'jeepay-engineering-layer-architecture'],
  ['relations', 'jeepay-component-relation-architecture'],
  ['flowchart', 'jeepay-unified-order-flowchart'],
  ['sequence', 'jeepay-unified-order-sequence'],
  ['er', 'jeepay-payment-er'],
  ['deployment', 'jeepay-compose-deployment'],
  ['class', 'jeepay-payment-class'],
  ['state', 'jeepay-pay-order-state'],
  ['usecase', 'jeepay-payment-usecase'],
  ['dataflow', 'jeepay-unified-order-dataflow']
];
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const withoutGeometry = value => Array.isArray(value) ? value.map(withoutGeometry) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([key]) => !['position', 'size', 'route'].includes(key)).map(([key, item]) => [key, withoutGeometry(item)])) : value;
const diagrams = views.map(([id, directory]) => {
  const graph = withoutGeometry(JSON.parse(fs.readFileSync(path.join(root, 'docs/qgraphflow', directory, 'graph.json'), 'utf8')));
  graph.meta.sourceRef = `jeequan/jeepay@${revision}`;
  graph.meta.viewId = `jeepay-${id}`;
  if (graph.layout) { delete graph.layout.version; delete graph.layout.strategy; }
  return graph;
});
const collection = { diagrams }, errors = validateGraphInput(collection, { inputOnly: true });
if (errors.length) throw new Error(errors.join('\n'));
const evidence = verifySourceEvidence(collection, root);
const files = [...new Set(diagrams.flatMap(graph => [...graph.nodes.map(node => node.source), ...graph.edges.map(edge => edge.site)].filter(Boolean).map(anchor => anchor.file)))].sort();
const manifest = {
  repository: 'jeequan/jeepay', revision,
  files: Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')])),
  views: diagrams.map(graph => ({ id: graph.meta.viewId, type: graph.meta.diagramType, architectureView: graph.meta.architectureView })),
  sourceEvidence: evidence
};
// Stage and validate the complete corpus before replacing any published input.
fs.mkdirSync(destination, { recursive: true });
for (const [id, graph] of diagrams.map((graph, index) => [views[index][0], graph])) {
  fs.writeFileSync(path.join(destination, `${id}.graph.json`), JSON.stringify(graph, null, 2) + '\n');
}
fs.writeFileSync(path.join(destination, 'collection.graph.json'), JSON.stringify(collection, null, 2) + '\n');
fs.writeFileSync(path.join(destination, 'source.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ views: diagrams.length, sourceFiles: files.length, revision, sourceEvidence: evidence }));
