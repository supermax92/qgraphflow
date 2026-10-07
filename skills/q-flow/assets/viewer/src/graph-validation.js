import { isArchitectureOverview } from './view-identity.js';
import { DEPLOYMENT_TIERS } from './layout-semantics.js';
import { SUPPORTED_LOCALES } from './i18n.js';
import { auditGraphLayout, graphBounds } from './edge-routing.js';
import { MAX_SCREENS, OVERVIEW_AREA, READABLE_ZOOM, layeredDirections } from './layout-spacing.js';
import { missingCallExecutions, validateExecutions } from './sequence-executions.js';
import { validateOperands } from './sequence-fragments.js';
import { viewIdOf } from './view-identity.js';
import { validateOverview } from './architecture-overview.js';
import { DIAGRAM_TYPES, diagramTypeOf, getDiagram } from './diagrams/registry.js';

const EVIDENCE_KINDS = new Set(['source', 'code', 'config', 'schema', 'test', 'document', 'framework', 'inference']);
export const MAX_NOTES = 6, MAX_NOTE_LENGTH = 120;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function requireString(value, label, errors) {
  if (typeof value !== 'string' || value.trim() === '') errors.push(`${label} must be a non-empty string`);
}

function optionalString(value, label, errors) {
  if (value !== undefined && typeof value !== 'string') errors.push(`${label} must be a string`);
}

// A node `source` and an edge `site` share one anchor shape, so one check and one --repo-root verification serve both.
function validateAnchor(anchor, label, errors) {
  requireString(anchor.file, `${label}.file`, errors);
  optionalString(anchor.symbol, `${label}.symbol`, errors);
  if (!Number.isInteger(anchor.lineStart) || anchor.lineStart < 1) errors.push(`${label}.lineStart must be a positive integer`);
  if (anchor.lineEnd !== undefined && (!Number.isInteger(anchor.lineEnd) || (Number.isInteger(anchor.lineStart) && anchor.lineEnd < anchor.lineStart))) {
    errors.push(`${label}.lineEnd must be an integer at or after lineStart`);
  }
}

function requireBox(item, label, errors, inputOnly = false) {
  for (const [group, keys] of [['position', ['x', 'y']], ['size', ['width', 'height']]]) {
    if (inputOnly && item[group] === undefined) continue;
    if (!isObject(item[group])) {
      errors.push(`${label}.${group} is required`);
      continue;
    }
    for (const key of keys) {
      const value = item[group][key];
      if (!Number.isFinite(value) || value < 0) errors.push(`${label}.${group}.${key} must be a non-negative finite number`);
    }
  }
}

function requirePoint(point, label, errors) {
  if (!point || typeof point !== 'object' || Array.isArray(point)) {
    errors.push(`${label} must be an object`);
    return;
  }
  for (const key of ['x', 'y']) {
    if (!Number.isFinite(point[key]) || point[key] < 0) errors.push(`${label}.${key} must be a non-negative finite number`);
  }
}

function validateStringArray(value, label, errors) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.trim() === '')) {
    errors.push(`${label} must be an array of non-empty strings`);
  }
}

// meta.notes: the findings a reader must see before opening any node; the Viewer and the SVG both draw them.
function validateNotes(notes, errors) {
  validateStringArray(notes, 'meta.notes', errors);
  if (!Array.isArray(notes)) return;
  if (notes.length > MAX_NOTES) errors.push(`meta.notes must have at most ${MAX_NOTES} items`);
  notes.forEach((note, index) => { if (typeof note === 'string' && [...note].length > MAX_NOTE_LENGTH) errors.push(`meta.notes[${index}] exceeds ${MAX_NOTE_LENGTH} characters`); });
}

export function graphsOf(input) {
  return input && typeof input === 'object' && !Array.isArray(input) && Array.isArray(input.diagrams)
    ? input.diagrams
    : [input];
}

export function validateGraph(graph, { inputOnly = false, audit = true } = {}) {
  const errors = [];
  if (!isObject(graph)) return ['graph must be an object'];

  if (!isObject(graph.meta)) errors.push('meta must be an object');
  requireString(graph.meta?.title, 'meta.title', errors);
  requireString(graph.meta?.sourceRef, 'meta.sourceRef', errors);
  if (graph.meta?.viewId !== undefined) requireString(graph.meta.viewId, 'meta.viewId', errors);
  if (graph.meta?.architectureView !== undefined && ((graph.meta.diagramType ?? 'architecture') !== 'architecture' || !['relations', 'capabilities', 'engineering'].includes(graph.meta.architectureView))) errors.push('meta.architectureView is unsupported');
  for (const key of ['subtitle', 'scope']) optionalString(graph.meta?.[key], `meta.${key}`, errors);
  validateNotes(graph.meta?.notes, errors);
  if (graph.meta?.locale !== undefined && !SUPPORTED_LOCALES.includes(graph.meta.locale)) errors.push('meta.locale is unsupported');
  const diagramType = diagramTypeOf(graph);
  if (!DIAGRAM_TYPES.includes(diagramType)) errors.push('meta.diagramType is unsupported');
  const rules = getDiagram(diagramType) ?? getDiagram('architecture');
  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) errors.push('nodes must be a non-empty array');
  if (!Array.isArray(graph.edges)) errors.push('edges must be an array');
  if (graph.groups !== undefined && !Array.isArray(graph.groups)) errors.push('groups must be an array when provided');
  if (errors.length) return errors;

  const ids = new Set();
  const nodeIds = new Set();
  for (const [index, node] of (graph.nodes ?? []).entries()) {
    const label = `nodes[${index}]`;
    if (!isObject(node)) { errors.push(`${label} must be an object`); continue; }
    requireString(node?.id, `${label}.id`, errors);
    requireString(node?.label, `${label}.label`, errors);
    optionalString(node.subtitle, `${label}.subtitle`, errors);
    if (node.module !== undefined) requireString(node.module, `${label}.module`, errors);
    if (!rules.nodeKinds.includes(node?.kind)) errors.push(`${label}.kind is unsupported for ${diagramType}`);
    requireBox(node ?? {}, label, errors, inputOnly);
    if (typeof node.id === 'string' && ids.has(node.id)) errors.push(`${label}.id duplicates ${node.id}`);
    ids.add(node?.id);
    nodeIds.add(node?.id);
    if (node.source !== undefined && !isObject(node.source)) errors.push(`${label}.source must be an object`);
    else if (node.source) {
      validateAnchor(node.source, `${label}.source`, errors);
      if (node.source.kind !== undefined && !EVIDENCE_KINDS.has(node.source.kind)) errors.push(`${label}.source.kind is unsupported`);
    }
    for (const key of ['facts', 'tags', 'attributes', 'methods']) validateStringArray(node[key], `${label}.${key}`, errors);
    if (node.fields !== undefined) {
      if (!Array.isArray(node.fields)) errors.push(`${label}.fields must be an array`);
      else for (const [index, field] of node.fields.entries()) {
        const prefix = `${label}.fields[${index}]`;
        if (!isObject(field)) { errors.push(`${prefix} must be an object`); continue; }
        requireString(field.name, `${prefix}.name`, errors);
        requireString(field.type, `${prefix}.type`, errors);
        if (field.key !== undefined && !['PK', 'FK', 'UK'].includes(field.key)) errors.push(`${prefix}.key is unsupported`);
        if (field.nullable !== undefined && typeof field.nullable !== 'boolean') errors.push(`${prefix}.nullable must be boolean`);
      }
    }
    rules.validateNode?.(node, label, errors, { requireString, validateStringArray });
  }

  for (const [index, group] of (graph.groups ?? []).entries()) {
    const label = `groups[${index}]`;
    if (!isObject(group)) { errors.push(`${label} must be an object`); continue; }
    requireString(group?.id, `${label}.id`, errors);
    requireString(group?.label, `${label}.label`, errors);
    if (!rules.groupKinds.includes(group?.kind)) errors.push(`${label}.kind is unsupported for ${diagramType}`);
    requireBox(group ?? {}, label, errors, inputOnly);
    if (typeof group.id === 'string' && ids.has(group.id)) errors.push(`${label}.id duplicates ${group.id}`);
    ids.add(group?.id);
  }

  const edgeIds = new Set();
  const sequenceOrders = new Set();
  for (const [index, edge] of (graph.edges ?? []).entries()) {
    const label = `edges[${index}]`;
    if (!isObject(edge)) { errors.push(`${label} must be an object`); continue; }
    requireString(edge?.id, `${label}.id`, errors);
    optionalString(edge.label, `${label}.label`, errors);
    if (edge.module !== undefined) requireString(edge.module, `${label}.module`, errors);
    requireString(edge?.source, `${label}.source`, errors);
    requireString(edge?.target, `${label}.target`, errors);
    if (!rules.edgeKinds.includes(edge?.kind)) errors.push(`${label}.kind is unsupported for ${diagramType}`);
    if (!EVIDENCE_KINDS.has(edge?.evidence)) errors.push(`${label}.evidence is unsupported`);
    if (edge.site !== undefined && !isObject(edge.site)) errors.push(`${label}.site must be an object`);
    else if (edge.site) validateAnchor(edge.site, `${label}.site`, errors);
    if (typeof edge.id === 'string' && edgeIds.has(edge.id)) errors.push(`${label}.id duplicates ${edge.id}`);
    edgeIds.add(edge?.id);
    if (typeof edge.source === 'string' && !nodeIds.has(edge.source)) errors.push(`${label}.source does not name a node: ${edge.source}`);
    if (typeof edge.target === 'string' && !nodeIds.has(edge.target)) errors.push(`${label}.target does not name a node: ${edge.target}`);
    if (edge?.route !== undefined) {
      if (!edge.route || typeof edge.route !== 'object' || Array.isArray(edge.route)) {
        errors.push(`${label}.route must be an object`);
      } else {
        if (edge.route.via !== undefined) {
          if (!Array.isArray(edge.route.via)) errors.push(`${label}.route.via must be an array`);
          else edge.route.via.forEach((point, pointIndex) => requirePoint(point, `${label}.route.via[${pointIndex}]`, errors));
        }
        if (edge.route.labelAt !== undefined) requirePoint(edge.route.labelAt, `${label}.route.labelAt`, errors);
        if (edge.route.messageY !== undefined && (diagramType !== 'sequence' || !Number.isFinite(edge.route.messageY) || edge.route.messageY < 0)) errors.push(`${label}.route.messageY must be a non-negative finite number for sequence`);
      }
    }
    if (diagramType === 'sequence' && !inputOnly && edge.route?.messageY === undefined) errors.push(`${label}.route.messageY is required for a positioned sequence message; regenerate with --layout auto`);
    rules.validateEdge?.(edge, label, errors, { requireString, sequenceOrders });
  }
  if (errors.length === 0) errors.push(...validateOverview(graph, { inputOnly, validateAnchor, evidenceKinds: EVIDENCE_KINDS }));
  if (errors.length === 0) errors.push(...validateLayoutSemantics(graph));
  if (errors.length === 0) errors.push(...validateOperands(graph));
  if (errors.length === 0) errors.push(...validateExecutions(graph, { inputOnly }));
  if (errors.length === 0 && !inputOnly && audit) errors.push(...auditGraphLayout(graph).errors);
  return errors;
}

function validateLayoutSemantics(graph) {
  const errors = [], type = diagramTypeOf(graph), sequence = type === 'sequence';
  const nodes = new Map(graph.nodes.map(node => [node.id, node])), groups = new Map((graph.groups ?? []).map(group => [group.id, group]));
  for (const node of graph.nodes) {
    if (node.groupId !== undefined) {
      if (sequence) errors.push(`node ${node.id}.groupId is not supported for sequence participants`);
      else if (typeof node.groupId !== 'string' || !groups.has(node.groupId)) errors.push(`node ${node.id}.groupId does not name a group: ${String(node.groupId)}`);
      else if (type === 'usecase' && node.kind === 'actor') errors.push(`node ${node.id}.groupId places an actor inside a system boundary`);
    }
    if (node.layout !== undefined) {
      if (!isObject(node.layout)) errors.push(`node ${node.id}.layout must be an object`);
      else if (node.layout.tier !== undefined && (type !== 'deployment' || !DEPLOYMENT_TIERS.includes(node.layout.tier))) errors.push(`node ${node.id}.layout.tier requires deployment and one of ${DEPLOYMENT_TIERS.join(', ')}`);
      if (isObject(node.layout)) for (const key of ['rank', 'order']) if (node.layout[key] !== undefined && (!Number.isInteger(node.layout[key]) || node.layout[key] < 0)) errors.push(`node ${node.id}.layout.${key} must be a non-negative integer`);
    }
  }
  if (!sequence) for (const group of groups.values()) {
    if (group.parentId === undefined) continue;
    if (typeof group.parentId !== 'string' || !groups.has(group.parentId)) errors.push(`group ${group.id}.parentId does not name a group: ${String(group.parentId)}`);
    const seen = new Set([group.id]); let parent = groups.get(group.parentId);
    while (parent) {
      if (seen.has(parent.id)) { errors.push(`group ${group.id}.parentId contains a cycle at ${parent.id}`); break; }
      seen.add(parent.id); parent = groups.get(parent.parentId);
    }
  }
  if (graph.layout !== undefined && !isObject(graph.layout)) errors.push('layout must be an object');
  else if (graph.layout?.direction !== undefined && !layeredDirections(type).includes(graph.layout.direction)) errors.push(`layout.direction must be one of ${layeredDirections(type).join(', ')} for ${type}`);
  if (graph.layout?.overviewConnections !== undefined && (!isArchitectureOverview(graph) || !['within-category', 'all'].includes(graph.layout.overviewConnections))) errors.push('layout.overviewConnections requires an architecture overview and within-category or all');
  if (isObject(graph.layout)) for (const key of ['primaryPath', 'participantOrder']) {
    const list = graph.layout?.[key];
    if (list === undefined) continue;
    if (!Array.isArray(list) || !list.length || list.some(id => typeof id !== 'string' || !nodes.has(id)) || new Set(list).size !== list.length) {
      errors.push(`layout.${key} must be a non-empty list of distinct node IDs`); continue;
    }
    if (key === 'participantOrder') {
      if (!sequence || list.length !== nodes.size) errors.push('layout.participantOrder must be a complete permutation of sequence participants');
      const ordered = list.map(id => nodes.get(id).layout?.order).filter(value => value !== undefined);
      if (ordered.some((value, i) => i && value <= ordered[i - 1])) errors.push('layout.participantOrder conflicts with node.layout.order');
    } else {
      if (sequence) errors.push('layout.primaryPath is not supported for sequence; use participantOrder');
      for (let i = 1; i < list.length; i++) {
        if (!graph.edges.some(edge => edge.source === list[i - 1] && edge.target === list[i])) errors.push(`layout.primaryPath has no directed edge from ${list[i - 1]} to ${list[i]}`);
        const before = nodes.get(list[i - 1]).layout?.rank, after = nodes.get(list[i]).layout?.rank;
        if (before !== undefined && after !== undefined && before >= after) errors.push(`layout.primaryPath conflicts with node.layout.rank at ${list[i]}`);
      }
    }
  }
  if (sequence && new Set(graph.nodes.map(node => node.layout?.rank).filter(value => value !== undefined)).size > 1) errors.push('sequence participants must share one layout.rank');
  for (const edge of graph.edges) {
    const source = nodes.get(edge.source), target = nodes.get(edge.target);
    if (type === 'class' && ['inheritance', 'implementation'].includes(edge.kind)) {
      if (edge.kind === 'implementation' && target.kind !== 'interface') errors.push(`edge ${edge.id} implementation target must be an interface`);
      if (source.layout?.rank !== undefined && target.layout?.rank !== undefined && target.layout.rank >= source.layout.rank) errors.push(`edge ${edge.id} layout.rank must place parent/interface ${target.id} above ${source.id}`);
    }
    if (type === 'usecase' && ['include', 'extend'].includes(edge.kind) && (source.kind !== 'usecase' || target.kind !== 'usecase')) errors.push(`edge ${edge.id} ${edge.kind} endpoints must both be use cases`);
  }
  return errors;
}

// The CLI's entry point (validate, generate, --fix). On top of what the Viewer renders, it asks for the callee bar of
// every answered sync call, so pages generated earlier still open while new and refreshed graphs carry their bars.
export function validateGraphInput(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ['graph must be an object'];
  const authored = graph => { const errors = validateGraph(graph, options); return errors.length ? errors : missingCallExecutions(graph); };
  if (!Object.hasOwn(input, 'diagrams')) return authored(input);
  if (!Array.isArray(input.diagrams) || input.diagrams.length < 1 || input.diagrams.length > 32) {
    return [`diagrams must contain between 1 and 32 graphs`];
  }

  const errors = [];
  const types = new Set(), viewIds = new Set();
  const architectureCount = input.diagrams.filter(graph => diagramTypeOf(graph) === 'architecture').length;
  input.diagrams.forEach((graph, index) => {
    const type = diagramTypeOf(graph);
    if (types.has(type) && type !== 'architecture') errors.push(`diagrams[${index}].meta.diagramType duplicates ${type}`);
    if (type === 'architecture' && architectureCount > 1 && !graph?.meta?.viewId) errors.push(`diagrams[${index}].meta.viewId is required for repeated architecture views`);
    const viewId = viewIdOf(graph);
    if (viewIds.has(viewId)) errors.push(`diagrams[${index}].meta.viewId duplicates ${viewId}`);
    viewIds.add(viewId);
    types.add(type);
    errors.push(...authored(graph).map(error => `diagrams[${index}].${error}`));
  });
  return errors;
}

// Advisory review of an authored graph or collection: warnings, never errors, so every graph that validated before
// still validates. It reads the card-identity contract back to the author: a node without `module` renders on the
// plain surface, one module for a whole flow deserves a second look, and only a decision branches in a flowchart.
// Outsiders (`external`, `actor`, `device`) may stay plain; what is flagged for them is inconsistency across views.
const PLAIN_KINDS = new Set(['initial', 'final']);
const OUTSIDER_KINDS = new Set(['external', 'actor', 'device']);
const moduleOf = item => (typeof item?.module === 'string' && item.module.trim() ? item.module : undefined);
// A relationship backed by repository material records the line that makes it hold; a sequence return follows its call.
const SITE_EVIDENCE = new Set(['source', 'code', 'config', 'schema', 'test']);
export const needsSite = edge => SITE_EVIDENCE.has(edge.evidence) && edge.kind !== 'return';

export function reviewComposition(input) {
  if (validateGraphInput(input, { inputOnly: true }).length) return [];
  const graphs = graphsOf(input), warnings = [];
  const members = graph => [...graph.nodes, ...graph.edges];
  const modules = new Set(graphs.flatMap(graph => members(graph).map(moduleOf).filter(Boolean)));
  // The same label across views is the same component: its module must be present everywhere and be the same one.
  const byLabel = new Map();
  for (const graph of graphs) for (const node of graph.nodes) if (typeof node.label === 'string' && !PLAIN_KINDS.has(node.kind)) {
    byLabel.set(node.label, [...(byLabel.get(node.label) ?? []), { diagramType: diagramTypeOf(graph), viewId: viewIdOf(graph), id: node.id, module: moduleOf(node) }]);
  }
  for (const graph of graphs) {
    const diagramType = diagramTypeOf(graph);
    const warn = (ruleId, elementIds, message, remediation) => warnings.push({ ruleId, severity: 'warning', diagramType, elementIds, message, remediation });
    if (modules.size) {
      const plain = graph.nodes.filter(node => !PLAIN_KINDS.has(node.kind) && !OUTSIDER_KINDS.has(node.kind) && !moduleOf(node));
      if (plain.length) warn('module.missing', plain.map(node => node.id),
        `${plain.length === 1 ? 'node' : 'nodes'} ${plain.map(node => node.id).join(', ')} ${plain.length === 1 ? 'has' : 'have'} no module and render${plain.length === 1 ? 's' : ''} on the plain surface without identity`,
        'Give every ordinary node the module of the subsystem whose work it performs (a step: the subsystem that does the work; an external hub or broker: its channel); leave only true outsiders plain.');
      for (const node of graph.nodes) {
        const elsewhere = (byLabel.get(node.label) ?? []).filter(item => item.viewId !== viewIdOf(graph) && item.module && item.module !== moduleOf(node));
        if (!elsewhere.length || PLAIN_KINDS.has(node.kind)) continue;
        const other = elsewhere[0];
        warn('module.inconsistent', [node.id], `node ${node.id} "${node.label}" ${moduleOf(node) ? `carries module "${moduleOf(node)}"` : 'has no module'} here but "${other.module}" in ${other.diagramType}`,
          'The same component keeps the same module in every view of a collection; copy the module name or make the labels differ when they are different things.');
      }
    }
    const washed = graph.nodes.filter(moduleOf);
    if (['flowchart', 'dataflow'].includes(diagramType) && washed.length >= 6 && new Set(washed.map(moduleOf)).size === 1) {
      warn('module.single-tone', washed.map(node => node.id),
        `${diagramType} gives all ${washed.length} nodes the module "${moduleOf(washed[0])}", so the wash tells the reader nothing`,
        'Check whether the steps really are one subsystem\'s work: a step performed by another subsystem (a store, a cache layer, a queue) takes that subsystem\'s module, start and end take the caller. If everything truly belongs to one subsystem, leave it.');
    }
    // Advisory only once the graph has started recording sites, so a graph authored without them stays quiet.
    const sited = graph.edges.filter(edge => edge.site), unsited = graph.edges.filter(edge => needsSite(edge) && !edge.site);
    if (sited.length && unsited.length) warn('edge.site-missing', unsited.map(edge => edge.id),
      `${unsited.length === 1 ? 'edge' : 'edges'} ${unsited.map(edge => edge.id).join(', ')} ${unsited.length === 1 ? 'has' : 'have'} repository evidence but no site, while ${sited.length} other ${sited.length === 1 ? 'edge records' : 'edges record'} one`,
      'Add the line that makes the relationship hold (the call, write, foreign key or extends clause) as site, or mark the edge inference.');
    if (diagramType === 'flowchart') {
      const outgoing = new Map();
      for (const edge of graph.edges) outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
      for (const node of graph.nodes) if (node.kind !== 'decision' && (outgoing.get(node.id) ?? 0) > 1) {
        warn('flowchart.process-branch', [node.id], `node ${node.id} (${node.kind}) has ${outgoing.get(node.id)} outgoing edges; only a decision branches`,
          'Insert a decision that asks the actual condition, or merge the paths into one.');
      }
    }
  }
  return warnings;
}

// Advisory that needs laid-out geometry, so a graph without positions reports nothing: at the readable zoom a reader sees
// one OVERVIEW_AREA at a time, and a view that needs more than MAX_SCREENS of them is read by scrolling, not by looking.
export function overviewWarnings(input) {
  if (validateGraphInput(input, { inputOnly: true }).length) return [];
  const warnings = [];
  for (const graph of graphsOf(input)) {
    if (!graph.nodes.length || !graph.nodes.every(node => node.position && node.size)) continue;
    const { width, height } = graphBounds(graph), across = width * READABLE_ZOOM / OVERVIEW_AREA.width, down = height * READABLE_ZOOM / OVERVIEW_AREA.height;
    if (across * down <= MAX_SCREENS) continue;
    warnings.push({ ruleId: 'view.oversized', severity: 'warning', diagramType: diagramTypeOf(graph), elementIds: [],
      message: `the view spans ${Math.round(width)}×${Math.round(height)} units, about ${(across * down).toFixed(1)} screens (${across.toFixed(1)} wide × ${down.toFixed(1)} tall) at the readable zoom ${READABLE_ZOOM}`,
      remediation: 'Split it by phase or sub-flow into separate views that together cover the whole model, never dropping facts; keep one view only when the user asked for it.' });
  }
  return warnings;
}
