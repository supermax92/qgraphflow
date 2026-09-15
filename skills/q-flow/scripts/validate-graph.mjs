#!/usr/bin/env node

import fs from 'node:fs';
import { SUPPORTED_LOCALES } from '../assets/viewer/src/i18n.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { auditGraphLayout } from '../assets/viewer/src/edge-routing.js';

import { DIAGRAM_TYPES, getDiagram } from '../assets/viewer/src/diagrams/registry.js';
export { DIAGRAM_TYPES };

const EVIDENCE_KINDS = new Set(['source', 'code', 'config', 'schema', 'test', 'document', 'framework', 'inference']);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function requireString(value, label, errors) {
  if (typeof value !== 'string' || value.trim() === '') errors.push(`${label} must be a non-empty string`);
}

function optionalString(value, label, errors) {
  if (value !== undefined && typeof value !== 'string') errors.push(`${label} must be a string`);
}

function requireBox(item, label, errors) {
  for (const [group, keys] of [['position', ['x', 'y']], ['size', ['width', 'height']]]) {
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

export function validateGraph(graph) {
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
    requireBox(node ?? {}, label, errors);
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
    requireBox(group ?? {}, label, errors);
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
      }
    }
    rules.validateEdge?.(edge, label, errors, { requireString, sequenceOrders });
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { positionals, values } = parseArgs({ allowPositionals: true, options: { 'repo-root': { type: 'string' } } });
    if (positionals.length !== 1) throw new Error('Usage: node validate-graph.mjs <graph.json> [--repo-root <repository-directory>]');
    const graph = readAndValidateGraph(positionals[0]);
    const sourceEvidence = verifySourceEvidence(graph, values['repo-root']);
    const graphs = graphsOf(graph);
    const totals = {
      nodes: graphs.reduce((sum, item) => sum + item.nodes.length, 0),
      edges: graphs.reduce((sum, item) => sum + item.edges.length, 0),
      groups: graphs.reduce((sum, item) => sum + (item.groups?.length ?? 0), 0)
    };
    console.log(JSON.stringify(graphs.length === 1 && !Object.hasOwn(graph, 'diagrams')
      ? { valid: true, diagramType: diagramTypeOf(graphs[0]), ...totals, sourceEvidence }
      : { valid: true, diagramTypes: graphs.map(diagramTypeOf), diagrams: graphs.length, ...totals, sourceEvidence }));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
