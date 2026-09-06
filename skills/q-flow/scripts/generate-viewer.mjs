#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagramTypeOf, graphsOf, readAndValidateGraph } from './validate-graph.mjs';
import { playbackPlan } from '../assets/viewer/src/playback.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const shellPath = path.resolve(scriptDir, '../assets/viewer-dist/index.html');
const OUTPUTS = ['index.html', 'graph.json'];
const LEGACY_OUTPUT = 'snapshot.svg';

function safeJson(graph) {
  return JSON.stringify(graph).replaceAll('&', '\\u0026').replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
}

function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const positional = args.filter(arg => arg !== '--force');
  if (positional.length !== 2) {
    console.error('Usage: node generate-viewer.mjs <graph.json> <output-directory> [--force]');
    process.exit(2);
  }

  const [inputPath, outputArg] = positional;
  const outputDir = path.resolve(outputArg);
  if (outputDir === path.parse(outputDir).root || outputDir === os.homedir()) throw new Error('Refusing broad output directory');
  const graph = readAndValidateGraph(inputPath);
  for (const diagram of graphsOf(graph)) {
    const plan = playbackPlan(diagram);
    if (plan.mode === 'reading') console.warn(`Playback notice: ${diagram.meta.title}: ${plan.description}`);
  }
  if (!fs.existsSync(shellPath)) throw new Error(`Viewer shell missing: ${shellPath}`);

  const inputAbsolute = path.resolve(inputPath);
  const existing = OUTPUTS.filter(name => {
    const outputPath = path.join(outputDir, name);
    return fs.existsSync(outputPath) && path.resolve(outputPath) !== inputAbsolute;
  });
  if (existing.length && !force) throw new Error(`Refusing to overwrite: ${existing.join(', ')}; rerun with --force after approval`);
  const legacyPath = path.join(outputDir, LEGACY_OUTPUT);
  if (fs.existsSync(legacyPath) && !force) throw new Error(`Refusing to remove legacy ${LEGACY_OUTPUT}; rerun with --force after approval`);
  fs.mkdirSync(outputDir, { recursive: true });
  if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);

  const shell = fs.readFileSync(shellPath, 'utf8');
  if (!shell.includes('__CODEGRAPH_FLOW_DATA__')) throw new Error('Viewer shell data marker is missing');
  fs.writeFileSync(path.join(outputDir, 'index.html'), shell.replace('__CODEGRAPH_FLOW_DATA__', safeJson(graph)));
  fs.writeFileSync(path.join(outputDir, 'graph.json'), `${JSON.stringify(graph, null, 2)}\n`);
  const graphs = graphsOf(graph);
  const totals = {
    nodes: graphs.reduce((sum, item) => sum + item.nodes.length, 0),
    edges: graphs.reduce((sum, item) => sum + item.edges.length, 0)
  };
  console.log(JSON.stringify(graphs.length === 1 && !Object.hasOwn(graph, 'diagrams')
    ? { generated: true, diagramType: diagramTypeOf(graphs[0]), outputDir, files: OUTPUTS, ...totals }
    : { generated: true, diagramTypes: graphs.map(diagramTypeOf), diagrams: graphs.length, outputDir, files: OUTPUTS, ...totals }));
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
