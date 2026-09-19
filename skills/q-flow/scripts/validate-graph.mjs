#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { auditGraphLayout, graphBounds } from '../assets/viewer/src/edge-routing.js';
import { canvasBudgetFor } from '../assets/viewer/src/diagrams/registry.js';
import { ASPECT_BAND, ASPECT_SLACK, ratioExcess } from '../assets/viewer/src/layout-spacing.js';
import { diagramTypeOf, graphsOf, moduleSlotName, reviewComposition, validateGraphInput } from '../assets/viewer/src/graph-validation.js';
import { requireDiagramQuality, qualityFailure } from '../assets/viewer/src/layout-quality.js';
import { operandScopes } from '../assets/viewer/src/sequence-fragments.js';
export { DIAGRAM_TYPES, diagramTypeOf, graphsOf, moduleSlotName, reviewComposition, validateGraph, validateGraphInput } from '../assets/viewer/src/graph-validation.js';

const USAGE = `Usage: node validate-graph.mjs <graph.json> [options]
  --input-only          check semantics only (no geometry); use before generating
  --repo-root <dir>     verify every node source.file / line range against this working tree
  --fix                 repair mechanical sequence errors in place (order numbering, opt/loop/par operand ids,
                        unambiguous replyTo); prints each change; writes back only when the graph then passes
  --verbose             print the full receipt (layout composition, diagnostics) instead of one summary line
  --module-slot <name>  print the colour slot a module name hashes to (repeatable; no graph needed) — for choosing
                        the name of a module you are introducing; never rename an existing module for colour
  -h, --help            this text
Success prints one JSON line; failure prints the failing elements with rule, measurement and remediation.
Composition warnings never fail the run; --input-only prints them in full, later steps only count them in the
receipt. Fix module.missing, module.inconsistent and flowchart.process-branch; module.single-tone asks whether the
steps really are one subsystem's work; module.slot-collision is informational (slots repeat by design).`;

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

// Warnings only. The full lines print once per delivery — during input validation, where the author repairs the
// graph; generation and output validation see the same facts again and carry only the count in their receipt.
export function printCompositionReview(graph, { print = true } = {}) {
  const warnings = reviewComposition(graph);
  if (print) for (const warning of warnings) console.warn(`Composition warning (${warning.diagramType}) ${warning.ruleId}: ${warning.message} — ${warning.remediation}`);
  return warnings;
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

// Mechanical repairs only: numbering, operand ids and unambiguous reply pairing. Facts (kinds, evidence, labels,
// fields, anchors) and the set of elements are never touched; every change is reported so the author can veto it.
export function applyMechanicalFixes(input) {
  const changes = [], blocked = [];
  for (const [index, graph] of graphsOf(input).entries()) {
    if (graph?.meta?.diagramType !== 'sequence' || !Array.isArray(graph.edges) || !Array.isArray(graph.nodes)) continue;
    const prefix = Object.hasOwn(input, 'diagrams') ? `diagrams[${index}].` : '';
    const edges = graph.edges.filter(edge => edge && typeof edge === 'object');
    // 1. order: renumber in authoring order when any value is missing, invalid or duplicated.
    const orders = edges.map(edge => edge.order);
    const valid = value => Number.isInteger(value) && value > 0;
    if (orders.some(value => !valid(value)) || new Set(orders).size !== orders.length) {
      edges.forEach((edge, i) => { if (edge.order !== i + 1) { changes.push(`${prefix}edge ${edge.id}.order ${JSON.stringify(edge.order)} → ${i + 1}`); edge.order = i + 1; } });
    }
    // 2. operand ids for opt / loop / par.
    for (const group of graph.groups ?? []) {
      if (!group || group.kind === 'alt' || !Array.isArray(group.operands)) continue;
      group.operands.forEach((operand, i) => {
        if (operand && typeof operand === 'object' && operand.id === undefined) { operand.id = `op${i + 1}`; changes.push(`${prefix}group ${group.id}.operands[${i}].id → op${i + 1}`); }
      });
    }
    // 3. replyTo: exactly one earlier, unanswered, reversed call in the same operand scope.
    const scopes = operandScopes(graph);
    const answered = new Set(edges.map(edge => edge.replyTo).filter(Boolean));
    for (const edge of edges.filter(edge => edge.kind === 'return' && edge.replyTo === undefined)) {
      const candidates = edges.filter(call => ['sync', 'async'].includes(call.kind) && valid(call.order) && call.order < edge.order && call.source === edge.target && call.target === edge.source && !answered.has(call.id) && (scopes.get(call.id) ?? '') === (scopes.get(edge.id) ?? ''));
      if (candidates.length === 1) { edge.replyTo = candidates[0].id; answered.add(candidates[0].id); changes.push(`${prefix}edge ${edge.id}.replyTo → ${candidates[0].id}`); }
      else blocked.push(`${prefix}edge ${edge.id}.replyTo not filled: ${candidates.length ? `${candidates.length} candidates (${candidates.map(call => call.id).join(', ')})` : 'no unanswered reversed call before it'}`);
    }
  }
  return { changes, blocked };
}

// Fix in memory, judge with the ordinary validator, write back only a graph that then passes.
export function fixGraphFile(inputPath, options = {}) {
  const absolute = path.resolve(inputPath);
  const original = fs.readFileSync(absolute, 'utf8');
  const graph = JSON.parse(original);
  const { changes, blocked } = applyMechanicalFixes(graph);
  const errors = validateGraphInput(graph, { ...options, inputOnly: true });
  if (errors.length) return { changes, blocked, errors, written: false };
  const text = `${JSON.stringify(graph, null, 2)}\n`;
  const written = changes.length > 0 && text !== original;
  if (written) fs.writeFileSync(absolute, text);
  return { changes, blocked, errors: [], written };
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
    const { positionals, values } = parseArgs({ allowPositionals: true, options: { 'repo-root': { type: 'string' }, 'input-only': { type: 'boolean', default: false }, fix: { type: 'boolean', default: false }, verbose: { type: 'boolean', default: false }, 'module-slot': { type: 'string', multiple: true }, help: { type: 'boolean', short: 'h', default: false } } });
    if (values.help) { console.log(USAGE); process.exit(0); }
    if (values['module-slot']?.length) {
      for (const name of values['module-slot']) console.log(`${name} → ${moduleSlotName(name)}`);
      if (!positionals.length) process.exit(0);
    }
    if (positionals.length !== 1) throw new Error(USAGE);
    if (values.fix) {
      const result = fixGraphFile(positionals[0], { inputOnly: values['input-only'] });
      for (const change of result.changes) console.error(`fixed: ${change}`);
      for (const item of result.blocked) console.error(`not fixed: ${item}`);
      if (result.errors.length) throw new Error(`Invalid graph after mechanical fixes (file left unchanged):\n- ${result.errors.join('\n- ')}`);
      if (result.written) console.error(`wrote ${path.resolve(positionals[0])} (${result.changes.length} change${result.changes.length === 1 ? '' : 's'})`);
    }
    const graph = readAndValidateGraph(positionals[0], { inputOnly: values['input-only'] });
    const sourceEvidence = verifySourceEvidence(graph, values['repo-root']);
    const warnings = printCompositionReview(graph, { print: values['input-only'] });
    const graphs = graphsOf(graph);
    const totals = {
      nodes: graphs.reduce((sum, item) => sum + item.nodes.length, 0),
      edges: graphs.reduce((sum, item) => sum + item.edges.length, 0),
      groups: graphs.reduce((sum, item) => sum + (item.groups?.length ?? 0), 0),
      semantic: { status: 'passed' },
      geometry: { status: values['input-only'] ? 'not-checked' : 'passed' },
      rendering: { status: 'not-checked' },
      ...(warnings.length ? { warnings: warnings.length } : {}),
      // Informational diagnostics and composition figures only on request; a passing graph reads as one line.
      ...(values.verbose ? { diagnostics: values['input-only'] ? [] : graphs.flatMap(item => requireDiagramQuality(item).diagnostics), layoutComposition: values['input-only'] ? null : graphs.map(layoutComposition) } : {})
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
