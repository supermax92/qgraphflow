#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { diagramTypeOf, graphsOf, readAndValidateGraph, verifySourceEvidence, layoutComposition } from './validate-graph.mjs';
import { compileGraphLayout } from './compile-layout.mjs';
import { requireDiagramQuality } from '../assets/viewer/src/layout-quality.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const shellPath = path.resolve(scriptDir, '../assets/viewer-dist/index.html');
const OUTPUTS = ['index.html', 'graph.json'];
const LEGACY_OUTPUT = 'snapshot.svg';

function safeJson(graph) {
  return JSON.stringify(graph).replaceAll('&', '\\u0026').replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
}

export function writeOutputPair(outputDir, contents) {
  fs.mkdirSync(outputDir, { recursive: true });
  const staging = fs.mkdtempSync(path.join(outputDir, '.qgraphflow-')), backedUp = [], installed = [];
  let keepBackup = false;
  try {
    for (const name of OUTPUTS) fs.writeFileSync(path.join(staging, name), contents[name]);
    for (const name of [...OUTPUTS, LEGACY_OUTPUT]) if (fs.existsSync(path.join(outputDir, name))) {
      fs.renameSync(path.join(outputDir, name), path.join(staging, `${name}.backup`)); backedUp.push(name);
    }
    for (const name of OUTPUTS) { fs.renameSync(path.join(staging, name), path.join(outputDir, name)); installed.push(name); }
  } catch (error) {
    const rollbackErrors = [];
    for (const name of installed) try { fs.unlinkSync(path.join(outputDir, name)); } catch (failure) { rollbackErrors.push(failure); }
    for (const name of backedUp) try { fs.renameSync(path.join(staging, `${name}.backup`), path.join(outputDir, name)); } catch (failure) { rollbackErrors.push(failure); }
    if (rollbackErrors.length) { keepBackup = true; throw new AggregateError([error, ...rollbackErrors], `Output rollback failed; original backups retained in ${staging}`); }
    throw error;
  } finally { if (!keepBackup) fs.rmSync(staging, { recursive: true, force: true }); }
}

async function main() {
  const { positionals: positional, values } = parseArgs({ allowPositionals: true, options: { force: { type: 'boolean' }, 'repo-root': { type: 'string' }, layout: { type: 'string', default: 'auto' } } });
  const force = values.force;
  if (positional.length !== 2) {
    console.error('Usage: node generate-viewer.mjs <graph.json> <output-directory> [--layout auto|preserve] [--repo-root <repository-directory>] [--force]');
    process.exit(2);
  }

  const [inputPath, outputArg] = positional;
  const outputDir = path.resolve(outputArg);
  if (outputDir === path.parse(outputDir).root || outputDir === os.homedir()) throw new Error('Refusing broad output directory');
  const input = readAndValidateGraph(inputPath, { inputOnly: true });
  const sourceEvidence = verifySourceEvidence(input, values['repo-root']);
  if (!fs.existsSync(shellPath)) throw new Error(`Viewer shell missing: ${shellPath}`);

  const inputAbsolute = path.resolve(inputPath);
  const existing = OUTPUTS.filter(name => {
    const outputPath = path.join(outputDir, name);
    return fs.existsSync(outputPath) && path.resolve(outputPath) !== inputAbsolute;
  });
  if (existing.length && !force) throw new Error(`Refusing to overwrite: ${existing.join(', ')}; rerun with --force after approval`);
  const legacyPath = path.join(outputDir, LEGACY_OUTPUT);
  if (fs.existsSync(legacyPath) && !force) throw new Error(`Refusing to remove legacy ${LEGACY_OUTPUT}; rerun with --force after approval`);
  const shell = fs.readFileSync(shellPath, 'utf8');
  if (!shell.includes('__CODEGRAPH_FLOW_DATA__')) throw new Error('Viewer shell data marker is missing');
  const compiled = [];
  for (const item of graphsOf(input)) compiled.push(await compileGraphLayout(item, { layout: values.layout }));
  const quality = compiled.map(item => requireDiagramQuality(item.graph));
  const graph = Array.isArray(input.diagrams) ? { ...input, diagrams: compiled.map(item => item.graph) } : compiled[0].graph;
  writeOutputPair(outputDir, { 'index.html': shell.replace('__CODEGRAPH_FLOW_DATA__', () => safeJson(graph)), 'graph.json': `${JSON.stringify(graph, null, 2)}\n` });
  const graphs = graphsOf(graph);
  const totals = {
    nodes: graphs.reduce((sum, item) => sum + item.nodes.length, 0),
    edges: graphs.reduce((sum, item) => sum + item.edges.length, 0),
    layoutComposition: graphs.map(layoutComposition),
    layout: compiled.map(item => item.report), quality
  };
  console.log(JSON.stringify(graphs.length === 1 && !Object.hasOwn(graph, 'diagrams')
    ? { generated: true, diagramType: diagramTypeOf(graphs[0]), outputDir, files: OUTPUTS, ...totals, sourceEvidence }
    : { generated: true, diagramTypes: graphs.map(diagramTypeOf), diagrams: graphs.length, outputDir, files: OUTPUTS, ...totals, sourceEvidence }));
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) try {
  await main();
} catch (error) {
  console.error(error.message);
  if (error.phases || error.candidates) console.error(JSON.stringify({ ...error.phases, diagnostics: error.diagnostics, candidates: error.candidates }));
  process.exit(1);
}
