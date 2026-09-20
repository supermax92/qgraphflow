#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { diagramTypeOf, graphsOf, printCompositionReview, readAndValidateGraph, verifySourceEvidence, layoutComposition } from './validate-graph.mjs';
import { compileGraphLayout } from './compile-layout.mjs';
import { requireDiagramQuality } from '../assets/viewer/src/layout-quality.js';
import { pageWithGraph } from '../assets/viewer/src/session-graph.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const shellPath = path.resolve(scriptDir, '../assets/viewer-dist/index.html');
const OUTPUTS = ['index.html', 'graph.json'];
const LEGACY_OUTPUT = 'snapshot.svg';

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

// Every view is compiled before anything is judged, so one run names every failing view instead of the first one only.
// A single failure is rethrown untouched; several are combined, their diagnostics concatenated and candidates keyed by type.
export async function compileViews(graphs, compile) {
  const compiled = [], failures = [];
  for (const graph of graphs) {
    try { compiled.push(await compile(graph)); } catch (error) { failures.push({ graph, error }); }
  }
  if (failures.length === 1) throw failures[0].error;
  if (failures.length) {
    const phase = failures.some(({ error }) => error.phases?.semantic?.status === 'failed') ? 'semantic' : 'geometry';
    throw Object.assign(new Error(failures.map(({ error }) => error.message).join('\n\n')), {
      phases: { semantic: { status: phase === 'semantic' ? 'failed' : 'passed' }, geometry: { status: phase === 'semantic' ? 'not-checked' : 'failed' }, rendering: { status: 'not-checked' } },
      diagnostics: failures.flatMap(({ error }) => error.diagnostics ?? []),
      candidates: Object.fromEntries(failures.filter(({ error }) => error.candidates).map(({ graph, error }) => [diagramTypeOf(graph), error.candidates])),
      failedViews: failures.map(({ graph }) => diagramTypeOf(graph))
    });
  }
  return compiled;
}

const USAGE = `Usage: node generate-viewer.mjs <graph.json> <output-directory> [options]
  --repo-root <dir>     verify every node source.file / line range against this working tree
  --layout auto|preserve  auto (default) computes positions; preserve keeps authored geometry under the same gate
  --force               replace an existing index.html / graph.json in the output directory (needs approval)
  --verbose             print the full receipt (layout candidates, folds, diagnostics) instead of one summary line
  -h, --help            this text
Writes exactly index.html and graph.json. Success prints one JSON line; failure prints the failing elements with
rule, measurement and remediation.`;

async function main() {
  const { positionals: positional, values } = parseArgs({ allowPositionals: true, options: { force: { type: 'boolean' }, 'repo-root': { type: 'string' }, layout: { type: 'string', default: 'auto' }, verbose: { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h', default: false } } });
  const force = values.force;
  if (values.help) { console.log(USAGE); process.exit(0); }
  if (positional.length !== 2) {
    console.error(USAGE);
    process.exit(2);
  }

  const [inputPath, outputArg] = positional;
  const outputDir = path.resolve(outputArg);
  if (outputDir === path.parse(outputDir).root || outputDir === os.homedir()) throw new Error('Refusing broad output directory');
  const input = readAndValidateGraph(inputPath, { inputOnly: true });
  const sourceEvidence = verifySourceEvidence(input, values['repo-root']);
  const warnings = printCompositionReview(input, { print: false }); // already printed by the input validation step
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
  const compiled = await compileViews(graphsOf(input), item => compileGraphLayout(item, { layout: values.layout }));
  const quality = compiled.map(item => requireDiagramQuality(item.graph));
  const graph = Array.isArray(input.diagrams) ? { ...input, diagrams: compiled.map(item => item.graph) } : compiled[0].graph;
  writeOutputPair(outputDir, { 'index.html': pageWithGraph(shell, graph), 'graph.json': `${JSON.stringify(graph, null, 2)}\n` });
  const graphs = graphsOf(graph);
  // One line on success: what was made and whether each gate passed. Candidates, folds and diagnostics stay out of the
  // model's context unless asked for with --verbose; failures still print their diagnostics through the catch below.
  const status = key => quality.every(item => item[key]?.status === 'passed') ? 'passed' : quality.some(item => item[key]?.status === 'failed') ? 'failed' : quality[0]?.[key]?.status ?? 'not-checked';
  const summary = {
    nodes: graphs.reduce((sum, item) => sum + item.nodes.length, 0),
    edges: graphs.reduce((sum, item) => sum + item.edges.length, 0),
    groups: graphs.reduce((sum, item) => sum + (item.groups?.length ?? 0), 0),
    semantic: { status: status('semantic') }, geometry: { status: status('geometry') }, rendering: { status: status('rendering') },
    ...(warnings.length ? { warnings: warnings.length } : {})
  };
  const detail = values.verbose ? { layoutComposition: graphs.map(layoutComposition), layout: compiled.map(item => item.report), quality } : {};
  console.log(JSON.stringify(graphs.length === 1 && !Object.hasOwn(graph, 'diagrams')
    ? { generated: true, diagramType: diagramTypeOf(graphs[0]), outputDir, files: OUTPUTS, ...summary, ...detail, sourceEvidence }
    : { generated: true, diagramTypes: graphs.map(diagramTypeOf), diagrams: graphs.length, outputDir, files: OUTPUTS, ...summary, ...detail, sourceEvidence }));
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) try {
  await main();
} catch (error) {
  console.error(error.message);
  if (error.phases || error.candidates) console.error(JSON.stringify({ ...error.phases, ...(error.failedViews ? { failedViews: error.failedViews } : {}), diagnostics: error.diagnostics, candidates: error.candidates }));
  process.exit(1);
}
