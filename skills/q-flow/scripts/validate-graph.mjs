#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditGraphLayout } from '../assets/viewer/src/edge-routing.js';

import { DIAGRAM_TYPES, getDiagram } from '../assets/viewer/src/diagrams/registry.js';
export { DIAGRAM_TYPES };

const EVIDENCE_KINDS = new Set(['source', 'code', 'config', 'schema', 'test', 'document', 'framework', 'inference']);

function requireString(value, label, errors) {
  if (typeof value !== 'string' || value.trim() === '') errors.push(`${label} must be a non-empty string`);
}

function requireBox(item, label, errors) {
  for (const [group, keys] of [['position', ['x', 'y']], ['size', ['width', 'height']]]) {
    if (!item[group] || typeof item[group] !== 'object') {
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

export function validateGraph(graph) {
  const errors = [];
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) return ['graph must be an object'];

  requireString(graph.meta?.title, 'meta.title', errors);
  requireString(graph.meta?.sourceRef, 'meta.sourceRef', errors);
  const diagramType = diagramTypeOf(graph);
  if (!DIAGRAM_TYPES.includes(diagramType)) errors.push('meta.diagramType is unsupported');
  const rules = getDiagram(diagramType) ?? getDiagram('architecture');
  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) errors.push('nodes must be a non-empty array');
  if (!Array.isArray(graph.edges)) errors.push('edges must be an array');
  if (graph.groups !== undefined && !Array.isArray(graph.groups)) errors.push('groups must be an array when provided');

  const ids = new Set();
  const nodeIds = new Set();
  for (const [index, node] of (graph.nodes ?? []).entries()) {
    const label = `nodes[${index}]`;
    requireString(node?.id, `${label}.id`, errors);
    requireString(node?.label, `${label}.label`, errors);
    if (!rules.nodeKinds.includes(node?.kind)) errors.push(`${label}.kind is unsupported for ${diagramType}`);
    requireBox(node ?? {}, label, errors);
    if (ids.has(node?.id)) errors.push(`${label}.id duplicates ${node.id}`);
    ids.add(node?.id);
    nodeIds.add(node?.id);
    if (node?.source) {
      requireString(node.source.file, `${label}.source.file`, errors);
      if (node.source.kind !== undefined && !EVIDENCE_KINDS.has(node.source.kind)) errors.push(`${label}.source.kind is unsupported`);
      if (!Number.isInteger(node.source.lineStart) || node.source.lineStart < 1) errors.push(`${label}.source.lineStart must be a positive integer`);
      if (node.source.lineEnd !== undefined && (!Number.isInteger(node.source.lineEnd) || node.source.lineEnd < node.source.lineStart)) {
        errors.push(`${label}.source.lineEnd must be an integer at or after lineStart`);
      }
    }
    validateStringArray(node?.facts, `${label}.facts`, errors);
    validateStringArray(node?.tags, `${label}.tags`, errors);
    rules.validateNode?.(node, label, errors, { requireString, validateStringArray });
  }

  for (const [index, group] of (graph.groups ?? []).entries()) {
    const label = `groups[${index}]`;
    requireString(group?.id, `${label}.id`, errors);
    requireString(group?.label, `${label}.label`, errors);
    if (!rules.groupKinds.includes(group?.kind)) errors.push(`${label}.kind is unsupported for ${diagramType}`);
    requireBox(group ?? {}, label, errors);
    if (ids.has(group?.id)) errors.push(`${label}.id duplicates ${group.id}`);
    ids.add(group?.id);
  }

  const edgeIds = new Set();
  const sequenceOrders = new Set();
  for (const [index, edge] of (graph.edges ?? []).entries()) {
    const label = `edges[${index}]`;
    requireString(edge?.id, `${label}.id`, errors);
    requireString(edge?.source, `${label}.source`, errors);
    requireString(edge?.target, `${label}.target`, errors);
    if (!rules.edgeKinds.includes(edge?.kind)) errors.push(`${label}.kind is unsupported for ${diagramType}`);
    if (!EVIDENCE_KINDS.has(edge?.evidence)) errors.push(`${label}.evidence is unsupported`);
    if (edgeIds.has(edge?.id)) errors.push(`${label}.id duplicates ${edge.id}`);
    edgeIds.add(edge?.id);
    if (!nodeIds.has(edge?.source)) errors.push(`${label}.source does not name a node: ${edge?.source}`);
    if (!nodeIds.has(edge?.target)) errors.push(`${label}.target does not name a node: ${edge?.target}`);
    if (edge?.route !== undefined) {
      if (!edge.route || typeof edge.route !== 'object' || Array.isArray(edge.route)) {
        errors.push(`${label}.route must be an object`);
      } else {
        if (edge.route.via !== undefined) {
          if (!Array.isArray(edge.route.via)) errors.push(`${label}.route.via must be an array`);
          else edge.route.via.forEach((point, pointIndex) => requirePoint(point, `${label}.route.via[${pointIndex}]`, errors));
        }
        if (edge.route.labelAt !== undefined) requirePoint(edge.route.labelAt, `${label}.route.labelAt`, errors);
      }
    }
    rules.validateEdge?.(edge, label, errors, { requireString, sequenceOrders });
  }
  if (graph.playback !== undefined) {
    if (!graph.playback || typeof graph.playback !== 'object' || Array.isArray(graph.playback)) {
      errors.push('playback must be an object');
    } else if (!Array.isArray(graph.playback.edgeIds) || graph.playback.edgeIds.length === 0) {
      errors.push('playback.edgeIds must be a non-empty array');
    } else {
      graph.playback.edgeIds.forEach((edgeId, index) => {
        if (typeof edgeId !== 'string' || edgeId.trim() === '') errors.push(`playback.edgeIds[${index}] must be a non-empty string`);
        else if (!edgeIds.has(edgeId)) errors.push(`playback.edgeIds[${index}] does not name an edge: ${edgeId}`);
      });
    }
  }
  if (errors.length === 0) errors.push(...auditGraphLayout(graph).errors);
  return errors;
}

export function validateGraphInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ['graph must be an object'];
  if (!Object.hasOwn(input, 'diagrams')) return validateGraph(input);
  if (!Array.isArray(input.diagrams) || input.diagrams.length < 1 || input.diagrams.length > DIAGRAM_TYPES.length) {
    return [`diagrams must contain between 1 and ${DIAGRAM_TYPES.length} graphs`];
  }

  const errors = [];
  const types = new Set();
  input.diagrams.forEach((graph, index) => {
    const type = diagramTypeOf(graph);
    if (types.has(type)) errors.push(`diagrams[${index}].meta.diagramType duplicates ${type}`);
    types.add(type);
    errors.push(...validateGraph(graph).map(error => `diagrams[${index}].${error}`));
  });
  return errors;
}

export function readAndValidateGraph(inputPath) {
  const absolute = path.resolve(inputPath);
  const graph = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  const errors = validateGraphInput(graph);
  if (errors.length) throw new Error(`Invalid graph:\n- ${errors.join('\n- ')}`);
  for (const item of graphsOf(graph)) {
    for (const warning of auditGraphLayout(item).warnings) console.warn(`Layout warning: ${warning}`);
  }
  return graph;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {
    console.error('Usage: node validate-graph.mjs <graph.json>');
    process.exit(2);
  }
  try {
    const graph = readAndValidateGraph(process.argv[2]);
    const graphs = graphsOf(graph);
    const totals = {
      nodes: graphs.reduce((sum, item) => sum + item.nodes.length, 0),
      edges: graphs.reduce((sum, item) => sum + item.edges.length, 0),
      groups: graphs.reduce((sum, item) => sum + (item.groups?.length ?? 0), 0)
    };
    console.log(JSON.stringify(graphs.length === 1 && !Object.hasOwn(graph, 'diagrams')
      ? { valid: true, diagramType: diagramTypeOf(graphs[0]), ...totals }
      : { valid: true, diagramTypes: graphs.map(diagramTypeOf), diagrams: graphs.length, ...totals }));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
