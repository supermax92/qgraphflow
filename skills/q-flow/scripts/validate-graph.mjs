#!/usr/bin/env node

import { elementName } from '../assets/viewer/src/graph-diff.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { auditGraphLayout, graphBounds } from '../assets/viewer/src/edge-routing.js';
import { canvasBudgetFor, diagramTypeOf } from '../assets/viewer/src/diagrams/registry.js';
import { ASPECT_BAND, ASPECT_SLACK, ratioExcess } from '../assets/viewer/src/layout-spacing.js';
import { graphsOf, needsSite, overviewWarnings, reviewComposition, validateGraphInput } from '../assets/viewer/src/graph-validation.js';
import { requireDiagramQuality, qualityFailure } from '../assets/viewer/src/layout-quality.js';
import { operandScopes } from '../assets/viewer/src/sequence-fragments.js';
import { callsMissingExecutions } from '../assets/viewer/src/sequence-executions.js';
import { detectDrift, driftItems, fingerprintFiles, formatDrift, headCommit, viewAlarms } from './source-drift.mjs';
export { DIAGRAM_TYPES, diagramTypeOf } from '../assets/viewer/src/diagrams/registry.js';
export { graphsOf, reviewComposition, validateGraph, validateGraphInput } from '../assets/viewer/src/graph-validation.js';

const USAGE = `Usage: node validate-graph.mjs <graph.json> [options]
  --input-only          check semantics only (no geometry); use before generating
  --repo-root <dir>     verify every node source and edge site (file, line range, symbol) against this working tree;
                        with meta.sourceFiles, lines that only moved pass and changed code is reported as source drift
  --fix                 repair mechanical errors in place (sequence order numbering, opt/loop/par operand ids,
                        unambiguous replyTo, the callee activation bar of each answered sync call; with --repo-root,
                        anchors follow moved lines, source drift is listed in meta.sourceDrift and meta.sourceFiles is
                        renewed); prints each change; writes back only when the graph then passes
  --changes <file.md>   with --repo-root, write the source changes that touch the diagram as Markdown for a pull request
                        comment (per view: the elements, file:line, the change, the old and new code); the exit code is
                        unchanged, so validation still fails while they remain
  --verbose             print the full receipt (layout composition, diagnostics) instead of one summary line
  -h, --help            this text
Success prints one JSON line; failure prints the failing elements with rule, measurement and remediation.
Composition warnings never fail the run; --input-only prints them in full, later steps only count them in the
receipt. Fix module.missing, module.inconsistent and flowchart.process-branch; module.single-tone asks whether the
steps really are one subsystem's work. view.oversized (a view needing over 4 screens at the readable zoom) needs the
laid-out graph: generate-viewer.mjs prints it, output validation only counts it.`;

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
const printWarnings = warnings => {
  for (const warning of warnings) console.warn(`Composition warning (${warning.diagramType}) ${warning.ruleId}: ${warning.message} — ${warning.remediation}`);
  return warnings;
};
export function printCompositionReview(graph, { print = true } = {}) {
  const warnings = reviewComposition(graph);
  return print ? printWarnings(warnings) : warnings;
}

// The size advisory needs the laid-out graph: generation prints it once, the output check only counts it.
export function printViewReview(graph, { print = false } = {}) {
  const warnings = overviewWarnings(graph);
  return print ? printWarnings(warnings) : warnings;
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

// Mechanical repairs only: numbering, operand ids, unambiguous reply pairing and the activation bar a paired sync call
// requires (its anchors follow from the pair). Facts (kinds, evidence, labels, fields, anchors) are never touched and no
// other element is added; every change is reported so the author can veto it.
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
    // 4. executions: an answered sync call gets its callee bar (call receive → reply send), nested in the innermost bar of
    // that participant around it. Longer calls go first, so a bar added inside them finds its parent.
    if (edges.length === graph.edges.length && (graph.executions === undefined || Array.isArray(graph.executions) && graph.executions.every(bar => bar && typeof bar === 'object'))) {
      const bars = graph.executions ?? [], byId = new Map(edges.map(edge => [edge.id, edge]));
      const point = anchor => { const edge = byId.get(anchor?.edgeId); return edge ? edge.order * 2 + Number(anchor.at === 'receive' && edge.source === edge.target) : NaN; };
      const missing = callsMissingExecutions(graph).sort((a, b) => (b.reply.order - b.call.order) - (a.reply.order - a.call.order) || a.call.order - b.call.order);
      for (const { call, reply } of missing) {
        let id = `x-${call.id}`;
        for (let n = 2; bars.some(bar => bar.id === id); n++) id = `x-${call.id}-${n}`;
        const bar = { id, participantId: call.target, start: { edgeId: call.id, at: 'receive' }, end: { edgeId: reply.id, at: 'send' } };
        const from = point(bar.start), to = point(bar.end);
        const parent = bars.filter(other => other.participantId === call.target && point(other.start) <= from && to <= point(other.end) && (point(other.start) < from || to < point(other.end)))
          .sort((a, b) => (point(a.end) - point(a.start)) - (point(b.end) - point(b.start)))[0];
        if (parent) bar.parentId = parent.id;
        bars.push(bar);
        changes.push(`${prefix}execution ${id} on ${call.target} from ${call.id} receive to ${reply.id} send${parent ? ` inside ${parent.id}` : ''}`);
      }
      if (bars.length && graph.executions === undefined) graph.executions = bars;
    }
  }
  return { changes, blocked };
}

// Fix in memory, then judge with every check the run makes without --fix (geometry and the quality gate unless
// --input-only, source evidence under a repository root), and write back only a graph that passes all of them.
// The capability and engineering overviews were removed: an overview view becomes a component relations view. Each
// section becomes an ownership group (nested sections nest, note sections join meta.notes), overviewText leads the node's
// facts, and the overview geometry is dropped so the next generation lays the view out again (--layout auto): such a
// graph is judged as input only, since its geometry no longer exists.
export function migrateOverviews(input) {
  const changes = [];
  let relayout = false;
  graphsOf(input).forEach((graph, index) => {
    const prefix = Object.hasOwn(input, 'diagrams') ? `diagrams[${index}].` : '';
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    for (const node of nodes) {
      if (Array.isArray(node.overviewText)) { node.facts = [...node.overviewText, ...(Array.isArray(node.facts) ? node.facts : [])]; changes.push(`${prefix}node ${node.id}.overviewText → facts`); }
      if (node.overviewText !== undefined || node.overviewTone !== undefined || node.overviewAccent !== undefined) { delete node.overviewText; delete node.overviewTone; delete node.overviewAccent; }
    }
    const view = graph?.meta?.architectureView;
    if (!['capabilities', 'engineering'].includes(view) && graph?.layout?.sections === undefined) return;
    const byId = new Map(nodes.map(node => [node.id, node])), groups = graph.groups ??= [];
    const walk = (section, parentId) => {
      if (!section || typeof section !== 'object') return;
      if (section.mode === 'note') { if (Array.isArray(section.text)) graph.meta.notes = [...(graph.meta.notes ?? []), ...section.text].slice(0, 6); return; }
      groups.push({ id: section.id, kind: 'ownership', label: section.title ?? section.id, ...(parentId ? { parentId } : {}) });
      for (const item of Array.isArray(section.items) ? section.items : []) {
        if (item?.nodeId !== undefined) { const node = byId.get(item.nodeId); if (node && node.groupId === undefined) node.groupId = section.id; }
        else if (item?.groupId !== undefined) { const group = groups.find(entry => entry.id === item.groupId); if (group && group.parentId === undefined) group.parentId = section.id; }
        else walk(item, section.id);
      }
    };
    for (const section of Array.isArray(graph.layout?.sections) ? graph.layout.sections : []) walk(section);
    delete graph.meta.architectureView;
    if (graph.layout) { delete graph.layout.sections; delete graph.layout.overviewConnections; delete graph.layout.version; delete graph.layout.strategy; }
    for (const item of [...nodes, ...groups]) { delete item.position; delete item.size; }
    for (const edge of Array.isArray(graph.edges) ? graph.edges : []) delete edge.route;
    relayout = true;
    changes.push(`${prefix}${view ?? 'overview'} view → component relations view (sections → ownership groups); regenerate it with --layout auto`);
  });
  return { changes, relayout };
}

export function fixGraphFile(inputPath, { repoRoot, ...options } = {}) {
  const absolute = path.resolve(inputPath);
  const original = fs.readFileSync(absolute, 'utf8');
  const graph = JSON.parse(original);
  const migrated = migrateOverviews(graph), mechanical = applyMechanicalFixes(graph), anchors = repoRoot === undefined ? { changes: [], blocked: [], drift: [], exempt: new Set() } : applyAnchorFixes(graph, repoRoot);
  if (migrated.relayout) options = { ...options, inputOnly: true };
  const changes = [...migrated.changes, ...mechanical.changes, ...anchors.changes], blocked = [...mechanical.blocked, ...anchors.blocked];
  let errors = validateGraphInput(graph, { ...options, inputOnly: true });
  if (!errors.length && !options.inputOnly) errors = validateGraphInput(graph, options);
  if (!errors.length && !options.inputOnly) for (const [index, item] of graphsOf(graph).entries()) {
    const prefix = Object.hasOwn(graph, 'diagrams') ? `diagrams[${index}].` : '';
    try { requireDiagramQuality(item); } catch (error) { errors.push(...error.message.split('\n- ').slice(1).map(message => prefix + message)); }
  }
  // The listed drift is the author's work, not a reason to keep the realigned anchors and fresh baseline unwritten.
  if (!errors.length && repoRoot !== undefined) {
    try { verifySourceEvidence(graph, repoRoot, { pendingDrift: 'allow', exempt: anchors.exempt }); } catch (error) { errors = error.message.split('\n- ').slice(1); }
  }
  if (errors.length) return { changes, blocked, errors, written: false, drift: anchors.drift, relayout: migrated.relayout };
  if (repoRoot !== undefined) changes.push(...stampSourceFiles(graph, repoRoot));
  const text = `${JSON.stringify(graph, null, 2)}\n`;
  const written = changes.length > 0 && text !== original;
  if (written) fs.writeFileSync(absolute, text);
  return { changes, blocked, errors: [], written, drift: anchors.drift, relayout: migrated.relayout };
}

// Every node, edge and badge anchor, with the view and element that own it.
export function sourceAnchors(input) {
  return graphsOf(input).flatMap((graph, graphIndex) => {
    const view = graph?.meta?.viewId ?? graph?.meta?.diagramType ?? `view ${graphIndex + 1}`;
    return [
      ...graph.nodes.flatMap((node, nodeIndex) => (node.badges ?? []).flatMap((badge, i) => badge.source ? [{ source: badge.source, label: `diagrams[${graphIndex}].nodes[${nodeIndex}].badges[${i}].source`, graphIndex, id: node.id, element: `${view} ${node.id} badge` }] : [])),
      ...graph.nodes.flatMap((node, nodeIndex) => node.source ? [{ source: node.source, label: `diagrams[${graphIndex}].nodes[${nodeIndex}].source`, graphIndex, id: node.id, element: `${view} ${node.id}` }] : []),
      ...(graph.edges ?? []).flatMap((edge, edgeIndex) => edge.site ? [{ source: edge.site, label: `diagrams[${graphIndex}].edges[${edgeIndex}].site`, graphIndex, id: edge.id, element: `${view} ${edge.id}` }] : [])];
  });
}

// Records the content each view's anchors now point at (git blob hashes, nothing written to the repository), so a
// later check can tell lines that moved from code that changed. Outside a git work tree nothing is recorded.
export function stampSourceFiles(input, repoRoot) {
  const changes = [];
  graphsOf(input).forEach((graph, graphIndex) => {
    const files = [...new Set(sourceAnchors(graph).map(({ source }) => source.file))].sort();
    const stamp = fingerprintFiles(repoRoot, files), commit = stamp && headCommit(repoRoot);
    if (!stamp || JSON.stringify(stamp) === JSON.stringify(graph.meta.sourceFiles) && (!commit || commit === graph.meta.sourceCommit)) return;
    graph.meta.sourceFiles = stamp;
    if (commit) graph.meta.sourceCommit = commit;
    changes.push(`${Object.hasOwn(input, 'diagrams') ? `diagrams[${graphIndex}].` : ''}meta.sourceFiles → ${files.length} file${files.length === 1 ? '' : 's'}`);
  });
  return changes;
}

// With a baseline (meta.sourceFiles) anchors follow the diff to their new lines and every change the diagram must
// reflect goes to meta.sourceDrift; the rewritten anchors it names are exempt until the author updates them.
// Without one, a drifted node source or edge site whose symbol occurs exactly once in its file is re-anchored; the
// range moves with it and keeps its span. Several matches need a judgement about which one is the definition, so they are only reported.
export function applyAnchorFixes(input, repoRoot) {
  const changes = [], blocked = [], { read } = sourceReader(repoRoot), graphs = graphsOf(input), all = sourceAnchors(input);
  const drift = detectDrift(graphs, { repoRoot, anchors: all, read, term: symbolTerm });
  const moved = new Set(), exempt = new Set();
  if (drift) {
    for (const { source, label } of all) {
      const to = drift.moves.get(source);
      if (!to) continue;
      moved.add(source);
      if (to.lineStart === source.lineStart && (to.lineEnd ?? source.lineEnd) === source.lineEnd) continue;
      changes.push(`${label}.lineStart ${source.lineStart} → ${to.lineStart}${to.lineEnd === undefined ? '' : `, lineEnd ${source.lineEnd} → ${to.lineEnd}`}`);
      source.lineStart = to.lineStart;
      if (to.lineEnd !== undefined) source.lineEnd = to.lineEnd;
    }
    for (const item of drift.alarms) for (const anchor of all) if (item.anchors.some(text => text === anchor.element || text.startsWith(`${anchor.element} (`))) exempt.add(anchor.label);
    if (drift.alarms.length) {
      // Each view keeps the items that name one of its elements, or that touch a file it anchors.
      graphs.forEach((graph, graphIndex) => {
        const files = new Set(all.filter(anchor => anchor.graphIndex === graphIndex).map(({ source }) => source.file));
        const own = driftItems(viewAlarms(drift.alarms, graphIndex, files), graphIndex);
        if (!own.length) return;
        graph.meta.sourceDrift = [...(graph.meta.sourceDrift ?? []), ...own];
        changes.push(`${Object.hasOwn(input, 'diagrams') ? `diagrams[${graphIndex}].` : ''}meta.sourceDrift + ${own.length} item${own.length === 1 ? '' : 's'}`);
      });
    }
    for (const file of drift.unchecked) blocked.push(`source drift not checked for ${file}: baseline not in this repository (fetch full history, e.g. fetch-depth: 0)`);
  }
  for (const [index, graph] of graphs.entries()) {
    const prefix = Object.hasOwn(input, 'diagrams') ? `diagrams[${index}].` : '';
    for (const [kind, key, items] of [['node', 'source', graph?.nodes], ['edge', 'site', graph?.edges]]) for (const item of Array.isArray(items) ? items : []) {
      const anchor = item?.[key];
      if (typeof anchor?.symbol !== 'string' || !Number.isInteger(anchor.lineStart) || moved.has(anchor)) continue;
      let lines;
      try { lines = read(anchor.file); } catch { continue; } // reported by the source evidence check
      const term = symbolTerm(anchor.symbol), found = term ? symbolLines(lines, term) : [];
      if (found.some(line => line >= anchor.lineStart && line <= (anchor.lineEnd ?? anchor.lineStart))) continue;
      if (found.length !== 1) { blocked.push(`${prefix}${kind} ${item.id}.${key} not re-anchored: "${term ?? anchor.symbol}" ${foundAt(found)}`); continue; }
      const lineEnd = anchor.lineEnd === undefined ? undefined : Math.min(lines.length, found[0] + anchor.lineEnd - anchor.lineStart);
      changes.push(`${prefix}${kind} ${item.id}.${key}.lineStart ${anchor.lineStart} → ${found[0]}${lineEnd === undefined ? '' : `, lineEnd ${anchor.lineEnd} → ${lineEnd}`}`);
      anchor.lineStart = found[0];
      if (lineEnd !== undefined) anchor.lineEnd = lineEnd;
    }
  }
  return { changes, blocked, drift: drift?.alarms ?? [], exempt };
}

// Markdown for a pull request comment: per view, every listed (meta.sourceDrift) or newly detected source change with
// the readable names of the elements it touches, file:line, the change and the old and new code.
export function changesReport(input, repoRoot) {
  const graphs = graphsOf(input), anchors = sourceAnchors(input), { read } = sourceReader(repoRoot);
  const live = detectDrift(graphs, { repoRoot, anchors, read, term: symbolTerm })?.alarms ?? [];
  const title = input.meta?.title ?? graphs[0]?.meta?.title ?? 'diagram';
  const sections = graphs.flatMap((graph, graphIndex) => {
    const files = new Set(anchors.filter(anchor => anchor.graphIndex === graphIndex).map(({ source }) => source.file));
    const items = [...(Array.isArray(graph.meta?.sourceDrift) ? graph.meta.sourceDrift : []), ...driftItems(viewAlarms(live, graphIndex, files), graphIndex)];
    if (!items.length) return [];
    const name = id => elementName(graph, id);
    const tick = text => `\`${String(text).replaceAll('`', "'").replace(/\s+/g, ' ')}\``;
    return [`### ${graph.meta.title ?? graph.meta.viewId ?? diagramTypeOf(graph)}${graph.meta.viewId ? ` (${tick(graph.meta.viewId)})` : ''}`, '',
      ...items.flatMap(item => [`- **${tick(`${item.file}:${item.line}`)}** ${item.change}`,
        ...(item.elements?.length ? [`  - Elements: ${item.elements.map(id => tick(name(id))).join(', ')}`] : []),
        ...(item.removed?.length || item.added?.length ? ['  ```diff', ...(item.removed ?? []).map(line => `  - ${line}`), ...(item.added ?? []).map(line => `  + ${line}`), '  ```'] : [])]), ''];
  });
  return sections.length ? [`## Source changes affecting ${title}`, '', ...sections].join('\n') : `No source changes affect ${title}.\n`;
}

// ponytail: a whole-word text match on the symbol's last segment, not a definition parser. A mention left inside the
// range (a comment, a call) still passes after the definition moved; add per-language definition rules if that bites.
const symbolTerm = symbol => symbol.split(/[^\p{L}\p{N}_$]+/u).filter(Boolean).at(-1);
const symbolLines = (lines, term) => {
  const word = new RegExp(`(?<![\\p{L}\\p{N}_$])${term.replaceAll('$', '\\$')}(?![\\p{L}\\p{N}_$])`, 'u');
  return lines.flatMap((line, index) => word.test(line) ? [index + 1] : []);
};
const foundAt = lines => lines.length ? `found at line${lines.length > 1 ? 's' : ''} ${lines.slice(0, 5).join(', ')}${lines.length > 5 ? ` and ${lines.length - 5} more` : ''}` : 'not found in the file';

// Reads repository files once each: repository-relative paths only, no escape through symlinks, UTF-8 text only.
function sourceReader(repoRoot) {
  if (typeof repoRoot !== 'string' || !repoRoot.trim()) throw new Error('--repo-root must name a directory');
  const root = fs.realpathSync(repoRoot);
  if (!fs.statSync(root).isDirectory()) throw new Error('--repo-root must name a directory');
  const files = new Map();
  const read = name => {
    if (path.isAbsolute(name) || path.win32.isAbsolute(name) || /[\\\0]/.test(name) || name.split('/').includes('..')) {
      throw new Error('path must be repository-relative without parent traversal');
    }
    const file = fs.realpathSync(path.resolve(root, name)), relative = path.relative(root, file);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('path resolves outside --repo-root');
    if (!files.has(file)) {
      if (!fs.statSync(file).isFile()) throw new Error('path must name a regular file');
      const bytes = fs.readFileSync(file);
      if (bytes.includes(0)) throw new Error('source must be a UTF-8 text file');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const lines = text ? text.split(/\r\n|\n|\r/) : [];
      if (/[\r\n]$/.test(text)) lines.pop();
      files.set(file, lines);
    }
    return files.get(file);
  };
  return { read, files };
}

// Checks the explicitly selected working tree, not the revision named in sourceRef or the meaning of a claim.
// `relations` counts the edges that should record a site, so a delivery can say how much of the diagram is traceable.
// With meta.sourceFiles, anchors first follow the lines they moved with (in memory; generation writes them out) and
// changed code fails as source drift; unresolved meta.sourceDrift items fail until the author removes them.
// pendingDrift: 'fail' (validation), 'show' (generation: listed items pass and their elements skip the line check, so the
// Viewer can mark them; unlisted drift still fails) or 'allow' (--fix, which lists the drift itself).
export function verifySourceEvidence(input, repoRoot, { pendingDrift = 'fail', exempt = new Set() } = {}) {
  const graphs = graphsOf(input), edges = graphs.flatMap(graph => graph.edges ?? []);
  const anchors = sourceAnchors(input);
  const pending = graphs.flatMap((graph, index) => (Array.isArray(graph.meta?.sourceDrift) ? graph.meta.sourceDrift : []).map(item => `diagrams[${index}].meta.sourceDrift: ${item?.file ?? '?'} line ${item?.line ?? '?'} — ${item?.change ?? ''}`));
  if (pending.length && pendingDrift === 'fail') throw new Error(`Unresolved source drift: update the elements each item names to match the current code, then delete the item:\n- ${pending.join('\n- ')}`);
  const summary = { scope: 'working-tree', references: anchors.length, checked: 0, files: 0,
    relations: { sited: edges.filter(edge => needsSite(edge) && edge.site).length, eligible: edges.filter(needsSite).length } };
  if (repoRoot === undefined) {
    if (anchors.length) console.warn('Source evidence not verified: pass --repo-root <repository-directory> to check files, line ranges and symbols.');
    return { ...summary, status: anchors.length ? 'skipped' : 'not-applicable', ...(anchors.length ? { reason: 'repository-root-not-provided' } : {}) };
  }
  const { read, files } = sourceReader(repoRoot), errors = [];
  const drift = pendingDrift === 'allow' ? null : detectDrift(graphs, { repoRoot, anchors, read, term: symbolTerm });
  const listed = pendingDrift === 'show' ? new Set(anchors.filter(({ graphIndex, id }) => (graphs[graphIndex].meta?.sourceDrift ?? []).some(item => item?.elements?.includes(id))).map(({ label }) => label)) : new Set();
  if (drift) {
    for (const file of drift.unchecked) console.warn(`Source drift not checked for ${file}: its baseline is not in this repository (fetch full history, e.g. actions/checkout fetch-depth: 0); checking the working tree only.`);
    if (drift.alarms.length) throw new Error(`Source drift: ${drift.alarms.length} change${drift.alarms.length === 1 ? '' : 's'} since this diagram's meta.sourceFiles baseline${drift.realigned ? ` (${drift.realigned} anchors only moved and follow their lines)` : ''}. Run validate --fix --repo-root to realign and list them in meta.sourceDrift, then update the named elements.\n${formatDrift(drift.alarms)}`);
    for (const { source } of anchors) { const to = drift.moves.get(source); if (to) { source.lineStart = to.lineStart; if (to.lineEnd !== undefined) source.lineEnd = to.lineEnd; } }
  }
  let symbols = 0;
  for (const { source, label } of anchors) {
    if (exempt.has(label) || listed.has(label)) continue;
    try {
      const lines = read(source.file), end = source.lineEnd ?? source.lineStart;
      if (end > lines.length) throw new Error(`line ${end} exceeds file length (${lines.length} lines)`);
      if (typeof source.symbol !== 'string') continue;
      symbols++;
      const term = symbolTerm(source.symbol);
      if (!term) throw new Error(`symbol ${JSON.stringify(source.symbol)} has no name to check`);
      const found = symbolLines(lines, term);
      if (!found.some(line => line >= source.lineStart && line <= end)) {
        throw new Error(`symbol "${term}" is not in line${end === source.lineStart ? ` ${end}` : `s ${source.lineStart}-${end}`}; ${foundAt(found)}; run --fix to re-anchor a unique match`);
      }
    } catch (error) { errors.push(`${label} (${source.file}): ${error.code === 'ENOENT' ? 'file does not exist' : error.message}`); }
  }
  if (errors.length) throw new Error(`Invalid source evidence:\n- ${errors.join('\n- ')}`);
  return { ...summary, status: anchors.length ? 'passed' : 'not-applicable', checked: anchors.length, files: files.size, symbols,
    ...(drift ? { drift: { files: drift.files, realigned: drift.realigned, alarms: 0 } } : {}) };
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const { positionals, values } = parseArgs({ allowPositionals: true, options: { 'repo-root': { type: 'string' }, changes: { type: 'string' }, 'input-only': { type: 'boolean', default: false }, fix: { type: 'boolean', default: false }, verbose: { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h', default: false } } });
    if (values.help) { console.log(USAGE); process.exit(0); }
    if (positionals.length !== 1) throw new Error(USAGE);
    let inputOnly = values['input-only'];
    if (values.fix) {
      const result = fixGraphFile(positionals[0], { inputOnly: values['input-only'], repoRoot: values['repo-root'] });
      for (const change of result.changes) console.error(`fixed: ${change}`);
      for (const item of result.blocked) console.error(`not fixed: ${item}`);
      if (result.drift.length) console.error(`source drift listed in meta.sourceDrift (update these elements, then delete each item):\n${formatDrift(result.drift)}`);
      if (result.errors.length) throw new Error(`Invalid graph after mechanical fixes (file left unchanged):\n- ${result.errors.join('\n- ')}`);
      const file = path.resolve(positionals[0]), directory = path.dirname(file);
      if (result.written) console.error(`wrote ${file} (${result.changes.length} change${result.changes.length === 1 ? '' : 's'})`);
      // A migrated overview has no geometry left: judge it as input and lay it out again.
      if (result.relayout) {
        inputOnly = true;
        console.error(`lay the converted view out again: node "${path.join(import.meta.dirname, 'generate-viewer.mjs')}" "${file}" <output-directory> --layout auto --force`);
      }
      // A generated page and its SVGs still embed the old data: regenerate them from the fixed file, keeping the layout.
      else if (result.written && fs.existsSync(path.join(directory, 'index.html'))) {
        console.error(`regenerate the page and SVGs: node "${path.join(import.meta.dirname, 'generate-viewer.mjs')}" "${file}" "${directory}" --layout preserve --force${values['repo-root'] === undefined ? '' : ` --repo-root "${path.resolve(values['repo-root'])}"`}`);
      }
    }
    if (values.changes !== undefined) {
      if (values['repo-root'] === undefined) throw new Error('--changes needs --repo-root');
      fs.writeFileSync(values.changes, changesReport(JSON.parse(fs.readFileSync(positionals[0], 'utf8')), values['repo-root']));
      console.error(`wrote ${path.resolve(values.changes)}`);
    }
    const graph = readAndValidateGraph(positionals[0], { inputOnly });
    const sourceEvidence = verifySourceEvidence(graph, values['repo-root']);
    const warnings = [...printCompositionReview(graph, { print: inputOnly }), ...(inputOnly ? [] : printViewReview(graph))];
    const graphs = graphsOf(graph);
    const totals = {
      nodes: graphs.reduce((sum, item) => sum + item.nodes.length, 0),
      edges: graphs.reduce((sum, item) => sum + item.edges.length, 0),
      groups: graphs.reduce((sum, item) => sum + (item.groups?.length ?? 0), 0),
      semantic: { status: 'passed' },
      geometry: { status: inputOnly ? 'not-checked' : 'passed' },
      rendering: { status: 'not-checked' },
      ...(warnings.length ? { warnings: warnings.length } : {}),
      // Informational diagnostics and composition figures only on request; a passing graph reads as one line.
      ...(values.verbose ? { diagnostics: inputOnly ? [] : graphs.flatMap(item => requireDiagramQuality(item).diagnostics), layoutComposition: inputOnly ? null : graphs.map(layoutComposition) } : {})
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
