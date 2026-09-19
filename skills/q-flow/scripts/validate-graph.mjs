#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { auditGraphLayout, graphBounds } from '../assets/viewer/src/edge-routing.js';
import { canvasBudgetFor } from '../assets/viewer/src/diagrams/registry.js';
import { ASPECT_BAND, ASPECT_SLACK, ratioExcess } from '../assets/viewer/src/layout-spacing.js';
import { diagramTypeOf, graphsOf, validateGraphInput } from '../assets/viewer/src/graph-validation.js';
import { requireDiagramQuality, qualityFailure } from '../assets/viewer/src/layout-quality.js';
export { DIAGRAM_TYPES, diagramTypeOf, graphsOf, validateGraph, validateGraphInput } from '../assets/viewer/src/graph-validation.js';

export function readAndValidateGraph(inputPath, options = {}) {
  const absolute = path.resolve(inputPath);
  const graph = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  const semantic = validateGraphInput(graph, { ...options, inputOnly: true });
  const errors = semantic.length ? semantic : validateGraphInput(graph, options);
  if (errors.length) {
    const phase = semantic.length ? 'semantic' : 'geometry';
    const diagnostics = errors.flatMap(message => {
      const index = message.match(/^diagrams\[(\d+)\]\./)?.[1];
      return qualityFailure(index === undefined ? graph : graph.diagrams[index], phase, message.replace(/^diagrams\[\d+\]\./, '')).diagnostics;
    });
    throw qualityFailure(graph, phase, `Invalid graph:\n- ${errors.join('\n- ')}`, diagnostics);
  }
  if (!options.inputOnly) for (const item of graphsOf(graph)) {
    requireDiagramQuality(item);
    for (const warning of auditGraphLayout(item).warnings) console.warn(`Layout warning: ${warning}`);
    for (const warning of layoutComposition(item).warnings) console.warn(`Composition warning (${diagramTypeOf(item)}): ${warning}`);
  }
  return graph;
}

export function layoutComposition(graph) {
  const { width, height } = graphBounds(graph);
  const canvasBudget = canvasBudgetFor(diagramTypeOf(graph));
  const targetRatio = canvasBudget ? canvasBudget.width / canvasBudget.height : null, aspectRatio = width / height;
  const fit = targetRatio === null ? null : Math.min(aspectRatio / targetRatio, targetRatio / aspectRatio);
  const singleRow = diagramTypeOf(graph) !== 'sequence' && graph.nodes.length >= 6
    && Math.max(...graph.nodes.map(node => node.position.y)) < Math.min(...graph.nodes.map(node => node.position.y + node.size.height));
  const warnings = [];
  if (singleRow) warnings.push('single-row layout: arrange semantic layers, branches or groups across multiple rows');
  // The band is informational here: a small graph may legitimately sit outside it, so it never warns.
  return { diagramType: diagramTypeOf(graph), canvasBudget, aspectRatio: Number(aspectRatio.toFixed(2)), targetRatio: targetRatio === null ? null : Number(targetRatio.toFixed(2)), fit: fit === null ? null : Number(fit.toFixed(2)),
    aspectBand: targetRatio === null ? null : ASPECT_BAND, bandSlack: targetRatio === null ? null : ASPECT_SLACK, withinBand: targetRatio === null ? null : +ratioExcess(aspectRatio).toFixed(2) <= ASPECT_SLACK, singleRow, warnings };
}

// Checks the explicitly selected working tree, not the revision named in sourceRef or the meaning of a claim.
export function verifySourceEvidence(input, repoRoot) {
  const anchors = graphsOf(input).flatMap((graph, graphIndex) => graph.nodes.flatMap((node, nodeIndex) => node.source
    ? [{ source: node.source, label: `diagrams[${graphIndex}].nodes[${nodeIndex}].source` }] : []));
  const summary = { scope: 'working-tree', references: anchors.length, checked: 0, files: 0 };
  if (repoRoot === undefined) {
    if (anchors.length) console.warn('Source evidence not verified: pass --repo-root <repository-directory> to check files and line ranges.');
    return { ...summary, status: anchors.length ? 'skipped' : 'not-applicable', ...(anchors.length ? { reason: 'repository-root-not-provided' } : {}) };
  }
  if (typeof repoRoot !== 'string' || !repoRoot.trim()) throw new Error('--repo-root must name a directory');
  const root = fs.realpathSync(repoRoot);
  if (!fs.statSync(root).isDirectory()) throw new Error('--repo-root must name a directory');
  const withinRoot = file => {
    const relative = path.relative(root, file);
    return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  };
  const files = new Map(), errors = [];
  for (const { source, label } of anchors) {
    try {
      if (path.isAbsolute(source.file) || path.win32.isAbsolute(source.file) || /[\\\0]/.test(source.file) || source.file.split('/').includes('..')) {
        throw new Error('path must be repository-relative without parent traversal');
      }
      const file = fs.realpathSync(path.resolve(root, source.file));
      if (!withinRoot(file)) throw new Error('path resolves outside --repo-root');
      if (!files.has(file)) {
        if (!fs.statSync(file).isFile()) throw new Error('path must name a regular file');
        const bytes = fs.readFileSync(file);
        if (bytes.includes(0)) throw new Error('source must be a UTF-8 text file');
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        const lines = text ? text.split(/\r\n|\n|\r/).length - Number(/[\r\n]$/.test(text)) : 0;
        files.set(file, lines);
      }
      const line = source.lineEnd ?? source.lineStart;
      if (line > files.get(file)) throw new Error(`line ${line} exceeds file length (${files.get(file)} lines)`);
    } catch (error) { errors.push(`${label} (${source.file}): ${error.code === 'ENOENT' ? 'file does not exist' : error.message}`); }
  }
  if (errors.length) throw new Error(`Invalid source evidence:\n- ${errors.join('\n- ')}`);
  return { ...summary, status: anchors.length ? 'passed' : 'not-applicable', checked: anchors.length, files: files.size };
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const { positionals, values } = parseArgs({ allowPositionals: true, options: { 'repo-root': { type: 'string' }, 'input-only': { type: 'boolean', default: false } } });
    if (positionals.length !== 1) throw new Error('Usage: node validate-graph.mjs <graph.json> [--input-only] [--repo-root <repository-directory>]');
    const graph = readAndValidateGraph(positionals[0], { inputOnly: values['input-only'] });
    const sourceEvidence = verifySourceEvidence(graph, values['repo-root']);
    const graphs = graphsOf(graph);
    const totals = {
      nodes: graphs.reduce((sum, item) => sum + item.nodes.length, 0),
      edges: graphs.reduce((sum, item) => sum + item.edges.length, 0),
      groups: graphs.reduce((sum, item) => sum + (item.groups?.length ?? 0), 0),
      semantic: { status: 'passed' },
      geometry: { status: values['input-only'] ? 'not-checked' : 'passed' },
      rendering: { status: 'not-checked' },
      diagnostics: values['input-only'] ? [] : graphs.flatMap(item => requireDiagramQuality(item).diagnostics),
      layoutComposition: values['input-only'] ? null : graphs.map(layoutComposition)
    };
    console.log(JSON.stringify(graphs.length === 1 && !Object.hasOwn(graph, 'diagrams')
      ? { valid: true, diagramType: diagramTypeOf(graphs[0]), ...totals, sourceEvidence }
      : { valid: true, diagramTypes: graphs.map(diagramTypeOf), diagrams: graphs.length, ...totals, sourceEvidence }));
  } catch (error) {
    console.error(error.message);
    if (error.phases) console.error(JSON.stringify({ ...error.phases, diagnostics: error.diagnostics }));
    process.exit(1);
  }
}
