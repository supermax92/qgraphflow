import { Worker } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { validateGraph, diagramTypeOf } from './validate-graph.mjs';
import { getDiagram, canvasBudgetFor } from '../assets/viewer/src/diagrams/registry.js';
import { stateSymbolX } from '../assets/viewer/src/diagrams/state.js';
import { minimumNodeSize } from '../assets/viewer/src/layout-measure.js';
import { graphBounds, visibleEdgeLabel, estimateLabelSize } from '../assets/viewer/src/edge-routing.js';
import { auditLayoutQuality, qualityFailure, requireDiagramQuality } from '../assets/viewer/src/layout-quality.js';
import { compileSequence } from './compile-sequence.mjs';

export const LAYOUT_VERSION = 'strict-v1-elkjs-0.11.0';
export const CANDIDATE_COUNT = 6;
export const LAYOUT_TIMEOUT_MS = 30_000;
const stable = items => [...items].sort((a, b) => (a.layout?.rank ?? 0) - (b.layout?.rank ?? 0) || (a.layout?.order ?? 0) - (b.layout?.order ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const round = value => +value.toFixed(3);
const box = item => ({ ...item.position, ...item.size });
const contains = (a, b) => a.x <= b.x && a.y <= b.y && a.x + a.width >= b.x + b.width && a.y + a.height >= b.y + b.height;
const intersects = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

function semanticDigest(graph, migration = []) {
  const model = structuredClone(graph);
  for (const key of ['nodes', 'edges', 'groups', 'executions']) if (model[key]) model[key].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const item of [...model.nodes, ...(model.groups ?? [])]) { delete item.position; delete item.size; }
  for (const edge of model.edges) delete edge.route;
  for (const item of migration) delete [...model.nodes, ...(model.groups ?? [])].find(element => element.id === item.elementId)[item.field];
  if (model.layout) { delete model.layout.version; delete model.layout.strategy; if (!Object.keys(model.layout).length) delete model.layout; }
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  return createHash('sha256').update(JSON.stringify(canonical(model))).digest('hex');
}

export function migrateOwnership(graph) {
  const migrated = [], groups = graph.groups ?? [];
  if (getDiagram(diagramTypeOf(graph)).sequence) return migrated;
  const infer = item => {
    if (!item.position || !item.size) return undefined;
    const candidates = groups.filter(group => group.id !== item.id && group.position && group.size && intersects(box(group), box(item)));
    const containers = candidates.filter(group => contains(box(group), box(item)));
    const parents = containers.filter(group => !containers.some(other => group !== other && contains(box(group), box(other))));
    // Child groups contained by this group are not ambiguous parents.
    if (candidates.some(group => !containers.includes(group) && !contains(box(item), box(group))) || parents.length > 1
      || containers.some(group => contains(box(item), box(group)))) throw new Error(`Ambiguous legacy containment for ${item.id}; specify groupId/parentId explicitly`);
    return parents[0]?.id;
  };
  for (const [items, key] of [[groups, 'parentId'], [graph.nodes, 'groupId']]) for (const item of items) {
    if (item[key] !== undefined) continue;
    const id = infer(item);
    if (id) { item[key] = id; migrated.push({ elementId: item.id, field: key, value: id, basis: 'unique-geometric-containment' }); }
  }
  return migrated;
}

function elkInput(graph, candidate) {
  const type = diagramTypeOf(graph), diagram = getDiagram(type), down = !['er', 'deployment', 'dataflow', 'usecase'].includes(type);
  const spacing = 128 + (candidate % 3) * 64;
  const portGap = candidate < 3 ? 24 : 48;
  const feedback = new Set();
  if (['flowchart', 'state'].includes(type)) {
    const seen = new Set(), active = new Set();
    const visit = id => {
      if (seen.has(id)) return;
      seen.add(id); active.add(id);
      for (const edge of stable(graph.edges.filter(edge => edge.source === id))) {
        if (active.has(edge.target)) feedback.add(edge.id);
        else visit(edge.target);
      }
      active.delete(id);
    };
    for (const node of [...stable(graph.nodes.filter(node => ['start', 'initial'].includes(node.kind))), ...stable(graph.nodes)]) visit(node.id);
  }
  const options = {
    'elk.algorithm': 'layered', 'elk.direction': down ? 'DOWN' : 'RIGHT', 'elk.randomSeed': String(candidate < 3 ? 17 : 29),
    // Without edges or declared layers, pack independent peers instead of forcing one layer.
    'elk.edgeRouting': 'ORTHOGONAL', 'elk.hierarchyHandling': !graph.edges.length && !graph.groups?.length && !graph.nodes.some(node => node.layout?.rank !== undefined || type === 'state' && ['initial', 'final'].includes(node.kind)) ? 'SEPARATE_CHILDREN' : 'INCLUDE_CHILDREN',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP', 'elk.layered.mergeEdges': 'false',
    'elk.layered.feedbackEdges': String(['flowchart', 'state'].includes(type)),
    'elk.spacing.nodeNode': '112', 'elk.spacing.componentComponent': '112', 'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing),
    'elk.spacing.portPort': '24',
    'elk.spacing.edgeEdge': String(portGap), 'elk.layered.spacing.edgeEdgeBetweenLayers': String(portGap),
    'elk.spacing.edgeNode': '48', 'elk.layered.spacing.edgeNodeBetweenLayers': '48', 'elk.spacing.edgeLabel': '24', 'elk.spacing.labelNode': '24',
    'elk.padding': '[top=100,left=32,bottom=32,right=32]',
    ...(graph.nodes.some(node => node.layout?.rank !== undefined) ? { 'elk.partitioning.activate': 'true' } : {})
  };
  const root = { id: '$root', layoutOptions: options, children: [], edges: [] };
  const groups = new Map(stable(graph.groups ?? []).map(group => [group.id, { id: `g:${group.id}`, children: [], layoutOptions: { ...options, 'elk.padding': `[top=100,left=${Math.ceil(estimateLabelSize(group.label).width + 44)},bottom=32,right=32]` } }]));
  const nodes = new Map(stable(graph.nodes).map(node => [node.id, { id: `n:${node.id}`, ...minimumNodeSize(node, type, graph.meta.locale), ports: [], layoutOptions: { 'elk.portConstraints': 'FIXED_POS', ...(node.layout?.rank === undefined ? {} : { 'elk.partitioning.partition': String(node.layout.rank) }) } }]));
  if (type === 'state') for (const node of graph.nodes) {
    if (node.kind === 'initial' || node.kind === 'final') nodes.get(node.id).layoutOptions['elk.layered.layering.layerConstraint'] = node.kind === 'initial' ? 'FIRST_SEPARATE' : 'LAST_SEPARATE';
    if (node.kind === 'initial') for (const edge of graph.edges.filter(edge => edge.source === node.id)) {
      if (graph.nodes.find(item => item.id === edge.target).kind === 'state') nodes.get(edge.target).layoutOptions['elk.layered.layering.layerConstraint'] = 'FIRST';
    }
  }
  const portRoles = new Map(), reversed = new Set();
  const actorPorts = new Map();
  for (const edge of stable(graph.edges)) {
    const reverse = type === 'class' && ['inheritance', 'implementation'].includes(edge.kind);
    if (reverse) reversed.add(edge.id);
    const roles = reverse ? ['target', 'source'] : ['source', 'target'];
    const ports = roles.map((role, i) => {
      let side = edge.source === edge.target ? 'EAST' : down ? i ? 'NORTH' : 'SOUTH' : i ? 'WEST' : 'EAST';
      if (type === 'usecase' && graph.nodes.find(node => node.id === edge[role]).kind === 'actor') {
        const index = actorPorts.get(edge[role]) ?? 0;
        side = graph.edges.filter(item => item.source === edge[role] || item.target === edge[role]).length === 1 ? 'EAST' : ['NORTH', 'EAST', 'SOUTH', 'WEST'][index % 4];
        actorPorts.set(edge[role], index + 1);
      }
      if (role === 'source' && ['flowchart', 'state'].includes(type) && ['decision', 'choice'].includes(graph.nodes.find(node => node.id === edge.source).kind)) {
        const branches = stable(graph.edges.filter(item => item.source === edge.source && item.target !== edge.source));
        if (branches.length >= 2) side = ['WEST', 'EAST', 'SOUTH'][branches.findIndex(item => item.id === edge.id) % 3];
      }
      const port = { id: `p:${edge.id}:${role}`, width: 0, height: 0, layoutOptions: { 'elk.port.side': side } };
      nodes.get(edge[role]).ports.push(port); portRoles.set(port.id, { side, edge, role }); return port.id;
    });
    const label = visibleEdgeLabel(edge, type), size = estimateLabelSize(label);
    root.edges.push({ id: `e:${edge.id}`, sources: [ports[0]], targets: [ports[1]],
      layoutOptions: { 'elk.layered.priority.direction': String(feedback.has(edge.id) ? 1 : 100) },
      labels: label ? [{ text: label, ...size, layoutOptions: { 'elk.edgeLabels.placement': 'CENTER' } }] : [] });
  }
  for (const node of nodes.values()) {
    for (const side of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
      const count = node.ports.filter(port => portRoles.get(port.id).side === side).length, dimension = ['NORTH', 'SOUTH'].includes(side) ? 'width' : 'height';
      if (count) node[dimension] = Math.max(node[dimension], (count - 1) * portGap + 64);
    }
    for (const side of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
    const ports = node.ports.filter(port => portRoles.get(port.id).side === side), horizontal = ['NORTH', 'SOUTH'].includes(side);
    const dimension = horizontal ? 'width' : 'height';
    ports.forEach((port, i) => {
      const original = graph.nodes.find(item => `n:${item.id}` === node.id);
      const middle = horizontal && type === 'state' && ['initial', 'final'].includes(original.kind) ? stateSymbolX({ ...original, size: node }) : node[dimension] / 2;
      const offset = middle + (i - (ports.length - 1) / 2) * portGap;
      port.x = horizontal ? offset : side === 'WEST' ? 0 : node.width;
      port.y = horizontal ? side === 'NORTH' ? 0 : node.height : offset;
    });
    }
  }
  for (const group of stable(graph.groups ?? [])) (groups.get(group.parentId) ?? root).children.push(groups.get(group.id));
  for (const node of stable(graph.nodes)) (groups.get(node.groupId) ?? root).children.push(nodes.get(node.id));
  return { root, reversed, stub: diagram.endpointStub ?? 12 };
}

function applyElk(graph, result, prepared) {
  const output = structuredClone(graph), nodes = new Map(output.nodes.map(node => [`n:${node.id}`, node])), groups = new Map((output.groups ?? []).map(group => [`g:${group.id}`, group]));
  const origins = new Map(), edges = [];
  function visit(item, offset = { x: 0, y: 0 }) {
    const origin = { x: round(offset.x + (item.x ?? 0)), y: round(offset.y + (item.y ?? 0)) };
    origins.set(item.id, origin);
    const target = nodes.get(item.id) ?? groups.get(item.id);
    if (target) { target.position = origin; target.size = { width: round(item.width), height: round(item.height) }; }
    for (const edge of item.edges ?? []) edges.push({ edge, owner: item.id });
    for (const child of item.children ?? []) visit(child, origin);
  }
  visit(result);
  const edgeMap = new Map(output.edges.map(edge => [`e:${edge.id}`, edge]));
  for (const { edge, owner } of edges) {
    const target = edgeMap.get(edge.id), origin = origins.get(edge.container ?? owner);
    if (!target || edge.sections?.length !== 1) throw new Error(`Unsupported ELK route sections for ${edge.id}`);
    const section = edge.sections[0], points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map(point => ({ x: round(point.x + origin.x), y: round(point.y + origin.y) }));
    if (prepared.reversed.has(target.id)) points.reverse();
    const stub = (a, b) => { const length = Math.hypot(b.x - a.x, b.y - a.y); return { x: round(a.x + (b.x - a.x) / length * prepared.stub), y: round(a.y + (b.y - a.y) / length * prepared.stub) }; };
    const via = [stub(points[0], points[1]), ...points.slice(1, -1), stub(points.at(-1), points.at(-2))];
    const label = edge.labels?.[0];
    target.route = { via, ...(label ? { labelAt: { x: round(origin.x + label.x + label.width / 2), y: round(origin.y + label.y + label.height / 2) } } : {}) };
  }
  if (edges.length !== output.edges.length) throw new Error('ELK did not return every semantic edge');
  return output;
}

function candidateScore(graph, audit, index) {
  const bounds = graphBounds(graph, audit.routes), budget = canvasBudgetFor(diagramTypeOf(graph));
  const routes = [...audit.routes.values()];
  const length = routes.reduce((sum, route) => sum + route.points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point.x - route.points[i].x, point.y - route.points[i].y), 0), 0);
  return [audit.errors.length, audit.crossings.reduce((sum, item) => sum + item.repeated, 0), audit.crossings.reduce((sum, item) => sum + item.measured, 0), routes.reduce((sum, route) => sum + route.points.length - 2, 0), round(length), round(bounds.width * bounds.height), budget ? Math.abs(bounds.width / bounds.height - budget.width / budget.height) : 0, index];
}
const compare = (a, b) => { for (let i = 0; i < a.score.length; i++) if (a.score[i] !== b.score[i]) return a.score[i] - b.score[i]; return 0; };

export async function compileGraphLayout(input, { layout = 'auto', timeoutMs = LAYOUT_TIMEOUT_MS } = {}) {
  if (!['auto', 'preserve'].includes(layout)) throw new Error('layout must be auto or preserve');
  const errors = validateGraph(input, { inputOnly: true });
  if (errors.length) throw qualityFailure(input, 'semantic', `Invalid semantic input:\n- ${errors.join('\n- ')}`);
  const graph = structuredClone(input);
  let migration;
  try { migration = migrateOwnership(graph); }
  catch (error) { throw qualityFailure(graph, 'semantic', error.message); }
  const semanticInput = semanticDigest(input);
  const semanticReport = output => {
    const semanticOutput = semanticDigest(output, migration);
    if (semanticInput !== semanticOutput) throw new Error('Layout changed semantic facts; refusing output');
    return { inputSha256: semanticInput, outputSha256: semanticOutput, preserved: true };
  };
  const ownershipErrors = validateGraph(graph, { inputOnly: true });
  if (ownershipErrors.length) throw qualityFailure(graph, 'semantic', ownershipErrors.join('\n'));
  if (layout === 'preserve') {
    requireDiagramQuality(graph);
    return { graph, report: { version: LAYOUT_VERSION, mode: layout, migration, semantics: semanticReport(graph) } };
  }
  const sequence = getDiagram(diagramTypeOf(graph)).sequence, started = performance.now();
  const worker = new Worker(new URL('../assets/layout-dist/worker.mjs', import.meta.url), { execArgv: [] });
  let pending, expired = false;
  const fail = error => pending?.reject(error);
  worker.on('error', fail);
  worker.on('exit', code => { if (code !== 0) fail(new Error(`Layout worker exited (${code})`)); });
  worker.on('message', message => message.error ? fail(new Error(message.error)) : pending?.resolve(message.graph));
  const timeout = Math.min(LAYOUT_TIMEOUT_MS, Math.max(1, timeoutMs));
  const timer = setTimeout(() => { expired = true; fail(new Error(`Layout exceeded ${timeout}ms for ${diagramTypeOf(graph)}`)); worker.terminate(); }, timeout);
  const candidates = [];
  try {
    for (let index = 0; index < CANDIDATE_COUNT; index++) {
      const prepared = sequence ? null : elkInput(graph, index);
      try {
        const result = sequence ? null : await new Promise((resolve, reject) => { pending = { resolve, reject }; worker.postMessage(prepared.root); });
        const candidate = sequence ? compileSequence(graph, index) : applyElk(graph, result, prepared);
        let audit = auditLayoutQuality(candidate);
        // ELK can put a label at a legal point crossing. Slide only that label along its own nearest segment.
        if (!sequence) for (const id of [...new Set(audit.diagnostics.filter(item => item.ruleId === 'spacing.label-edge').map(item => item.elementIds[0]))].sort()) {
          const edge = candidate.edges.find(item => item.id === id), route = audit.routes.get(id), origin = edge.route.labelAt;
          if (!origin) continue;
          const segment = route.points.slice(1).map((b, i) => {
            const a = route.points[i], x = Math.max(Math.min(a.x, b.x), Math.min(Math.max(a.x, b.x), origin.x)), y = Math.max(Math.min(a.y, b.y), Math.min(Math.max(a.y, b.y), origin.y));
            return { a, b, distance: Math.hypot(x - origin.x, y - origin.y) };
          }).sort((a, b) => a.distance - b.distance)[0];
          const axis = segment.a.x === segment.b.x ? 'y' : 'x', step = (axis === 'y' ? route.labelBox.height : route.labelBox.width) + 24;
          let best = origin;
          for (const offset of [-1, 1, -2, 2]) {
            const point = { ...origin, [axis]: round(origin[axis] + step * offset) };
            if (point[axis] < Math.min(segment.a[axis], segment.b[axis]) + step / 2 || point[axis] > Math.max(segment.a[axis], segment.b[axis]) - step / 2) continue;
            edge.route.labelAt = point;
            const checked = auditLayoutQuality(candidate);
            if (checked.errors.length < audit.errors.length) { best = point; audit = checked; }
          }
          edge.route.labelAt = best;
        }
        if (performance.now() - started > timeout) { expired = true; throw new Error(`Layout exceeded ${timeout}ms for ${diagramTypeOf(graph)}`); }
        candidates.push({ index, graph: candidate, errors: audit.errors, diagnostics: audit.diagnostics, score: candidateScore(candidate, audit, index), crossings: audit.crossings });
      } catch (error) {
        if (expired) throw error;
        candidates.push({ index, errors: [error.message], diagnostics: qualityFailure(graph, 'geometry', error.message).diagnostics, score: [Infinity, 0, 0, 0, 0, 0, 0, index] });
      }
    }
    candidates.sort(compare);
    const best = candidates[0];
    if (best.errors.length) throw Object.assign(qualityFailure(graph, 'geometry', `No valid layout candidate for ${diagramTypeOf(graph)}:\n- ${best.errors.join('\n- ')}`, best.diagnostics), { diagnosticGraph: best.graph, candidates: candidates.map(({ graph, ...item }) => item) });
    best.graph.layout = { ...best.graph.layout, version: LAYOUT_VERSION, strategy: `${sequence ? 'sequence' : 'layered'}-${best.index}` };
    return { graph: best.graph, report: { version: LAYOUT_VERSION, mode: layout, candidateCount: CANDIDATE_COUNT, timeoutMs: timeout, selected: best.index, migration, semantics: semanticReport(best.graph), candidates: candidates.map(({ graph, ...item }) => item) } };
  } catch (error) { throw error.phases ? error : qualityFailure(graph, 'geometry', error.message); }
  finally { clearTimeout(timer); await worker.terminate(); }
}
