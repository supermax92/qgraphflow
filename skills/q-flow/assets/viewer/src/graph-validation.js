import { SUPPORTED_LOCALES } from './i18n.js';
import { auditGraphLayout } from './edge-routing.js';
import { validateExecutions } from './sequence-executions.js';
import { validateOperands } from './sequence-fragments.js';
import { DIAGRAM_TYPES, getDiagram } from './diagrams/registry.js';
export { DIAGRAM_TYPES };

const EVIDENCE_KINDS = new Set(['source', 'code', 'config', 'schema', 'test', 'document', 'framework', 'inference']);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function requireString(value, label, errors) {
  if (typeof value !== 'string' || value.trim() === '') errors.push(`${label} must be a non-empty string`);
}

function optionalString(value, label, errors) {
  if (value !== undefined && typeof value !== 'string') errors.push(`${label} must be a string`);
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

export function diagramTypeOf(graph) {
  return graph?.meta?.diagramType ?? 'architecture';
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
  for (const key of ['subtitle', 'scope']) optionalString(graph.meta?.[key], `meta.${key}`, errors);
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
      requireString(node.source.file, `${label}.source.file`, errors);
      optionalString(node.source.symbol, `${label}.source.symbol`, errors);
      if (node.source.kind !== undefined && !EVIDENCE_KINDS.has(node.source.kind)) errors.push(`${label}.source.kind is unsupported`);
      if (!Number.isInteger(node.source.lineStart) || node.source.lineStart < 1) errors.push(`${label}.source.lineStart must be a positive integer`);
      if (node.source.lineEnd !== undefined && (!Number.isInteger(node.source.lineEnd) || (Number.isInteger(node.source.lineStart) && node.source.lineEnd < node.source.lineStart))) {
        errors.push(`${label}.source.lineEnd must be an integer at or after lineStart`);
      }
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
    rules.validateEdge?.(edge, label, errors, { requireString, sequenceOrders });
  }
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
      else for (const key of ['rank', 'order']) if (node.layout[key] !== undefined && (!Number.isInteger(node.layout[key]) || node.layout[key] < 0)) errors.push(`node ${node.id}.layout.${key} must be a non-negative integer`);
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
  else for (const key of ['primaryPath', 'participantOrder']) {
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

export function validateGraphInput(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ['graph must be an object'];
  if (!Object.hasOwn(input, 'diagrams')) return validateGraph(input, options);
  if (!Array.isArray(input.diagrams) || input.diagrams.length < 1 || input.diagrams.length > DIAGRAM_TYPES.length) {
    return [`diagrams must contain between 1 and ${DIAGRAM_TYPES.length} graphs`];
  }

  const errors = [];
  const types = new Set();
  input.diagrams.forEach((graph, index) => {
    const type = diagramTypeOf(graph);
    if (types.has(type)) errors.push(`diagrams[${index}].meta.diagramType duplicates ${type}`);
    types.add(type);
    errors.push(...validateGraph(graph, options).map(error => `diagrams[${index}].${error}`));
  });
  return errors;
}
