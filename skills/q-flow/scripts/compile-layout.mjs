import { Worker } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { validateGraph, diagramTypeOf } from './validate-graph.mjs';
import { getDiagram, canvasBudgetFor } from '../assets/viewer/src/diagrams/registry.js';
import { stateSymbolX } from '../assets/viewer/src/diagrams/state.js';
import { minimumNodeSize } from '../assets/viewer/src/layout-measure.js';
import { graphBounds, occupiedBox, visibleEdgeLabel, estimateLabelSize, groupHeadingBoxes, segmentCrossesBox, createEdgeRoutes } from '../assets/viewer/src/edge-routing.js';
import { groupHeadingLayout } from '../assets/viewer/src/text-layout.js';
import { ASPECT_BAND, ASPECT_SLACK, LAYOUT_LIMITS, LAYOUT_TARGETS, ratioExcess } from '../assets/viewer/src/layout-spacing.js';
import { auditLayoutQuality, qualityFailure, requireDiagramQuality } from '../assets/viewer/src/layout-quality.js';
import { compileSequence } from './compile-sequence.mjs';

export const LAYOUT_VERSION = 'adaptive-v2-elkjs-0.11.0';
export const CANDIDATE_COUNT = 6;
export const LAYOUT_TIMEOUT_MS = 30_000;
// A layered result whose width/height ratio leaves the band [1/ASPECT_BAND, ASPECT_BAND] by more than ASPECT_SLACK is folded:
// a top-down layout into columns when too tall, a left-to-right one into rows when too wide. The fewest segments that bring
// the shape back within the slack win, so the graph's own shape decides between landscape and portrait. Ranked layouts and
// branching state charts never fold.
export { ASPECT_BAND, ASPECT_SLACK };
export const FOLD_MAX = 5;
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
  const spacing = LAYOUT_TARGETS.layerGap + [0, 16, 48][candidate % 3];
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
    'elk.spacing.nodeNode': String(LAYOUT_TARGETS.nodeGap), 'elk.spacing.componentComponent': String(LAYOUT_TARGETS.nodeGap), 'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing),
    'elk.spacing.portPort': '24',
    'elk.spacing.edgeEdge': String(portGap), 'elk.layered.spacing.edgeEdgeBetweenLayers': String(portGap),
    'elk.spacing.edgeNode': String(Math.max(LAYOUT_TARGETS.edgeNodeGap, diagram.endpointStub ?? 12)), 'elk.layered.spacing.edgeNodeBetweenLayers': String(Math.max(LAYOUT_TARGETS.edgeNodeGap, diagram.endpointStub ?? 12)), 'elk.spacing.edgeLabel': String(LAYOUT_LIMITS.labelGap), 'elk.spacing.labelNode': String(LAYOUT_LIMITS.labelGap),
    'elk.padding': '[top=32,left=32,bottom=32,right=32]',
    ...(graph.nodes.some(node => node.layout?.rank !== undefined) ? { 'elk.partitioning.activate': 'true' } : {})
  };
  const root = { id: '$root', layoutOptions: options, children: [], edges: [] };
  const groups = new Map(stable(graph.groups ?? []).map(group => {
    const heading = groupHeadingLayout({ ...group, size: undefined });
    return [group.id, { id: `g:${group.id}`, children: [], layoutOptions: { ...options,
      'elk.padding': `[top=${heading.height + LAYOUT_LIMITS.groupHeadingGap},left=32,bottom=32,right=32]`,
      'elk.nodeSize.constraints': 'MINIMUM_SIZE', 'elk.nodeSize.minimum': `(${heading.width + 64},0)` } }];
  }));
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
      // Labels sit on their own line: ELK routes the edge through the label and reserves its size in the layer gap.
      labels: label ? [{ text: label, ...size, layoutOptions: { 'elk.edgeLabels.placement': 'CENTER', 'elk.edgeLabels.inline': 'true' } }] : [] });
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
  return { root, reversed, stub: diagram.endpointStub ?? 12, portGap };
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
    const via = [stubPoint(points[0], points[1], prepared.stub), ...points.slice(1, -1), stubPoint(points.at(-1), points.at(-2), prepared.stub)];
    const label = edge.labels?.[0];
    target.route = { via, ...(label ? { labelAt: { x: round(origin.x + label.x + label.width / 2), y: round(origin.y + label.y + label.height / 2) } } : {}) };
  }
  if (edges.length !== output.edges.length) throw new Error('ELK did not return every semantic edge');
  bypassHeadings(output, prepared.portGap);
  return output;
}

const stubPoint = (a, b, length) => { const distance = Math.hypot(b.x - a.x, b.y - a.y); return { x: round(a.x + (b.x - a.x) / distance * length), y: round(a.y + (b.y - a.y) / distance * length) }; };

// Routes can enter a boundary through its title. Bypass only that local title band on edges that carry waypoints;
// leave all nodes and ownership boundaries in place and run the full route audit afterwards.
function bypassHeadings(output, portGap) {
  for (const group of stable(output.groups ?? [])) {
    const heading = groupHeadingBoxes(group)[0]; let channel = 0;
    for (const edge of stable(output.edges)) {
      if (!edge.route?.via) continue;
      const points = edge.route.via, via = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[i + 1]; via.push(a);
        if (!b || a.x !== b.x || !segmentCrossesBox(a, b, heading)) continue;
        const margin = LAYOUT_LIMITS.labelGap, x = heading.x + heading.width + margin + channel++ * portGap;
        const top = Math.max(Math.min(a.y, b.y), heading.y - margin), bottom = Math.min(Math.max(a.y, b.y), heading.y + heading.height + margin);
        const [enter, leave] = a.y < b.y ? [top, bottom] : [bottom, top];
        via.push({ x: a.x, y: enter }, { x, y: enter }, { x, y: leave }, { x: a.x, y: leave });
      }
      edge.route.via = via;
    }
  }
}

// How far a layout's width/height ratio sits outside the accepted band, as a factor ≥ 1; 1 means inside the band.
export function aspectExcess(graph, routes) {
  if (getDiagram(diagramTypeOf(graph)).sequence) return 1;
  const bounds = graphBounds(graph, routes);
  return ratioExcess(bounds.width / Math.max(1, bounds.height));
}

// Layers of a layered ELK result, read back from the geometry: nodes whose extents overlap along the layer axis share a layer.
function layersOf(graph, down) {
  const along = down ? 'y' : 'x', extent = down ? 'height' : 'width', across = down ? 'x' : 'y';
  const layers = [];
  for (const node of [...graph.nodes].sort((a, b) => a.position[along] - b.position[along] || a.id.localeCompare(b.id))) {
    const current = layers.at(-1);
    if (current && node.position[along] < current.end) { current.nodes.push(node); current.end = Math.max(current.end, node.position[along] + node.size[extent]); }
    else layers.push({ nodes: [node], end: node.position[along] + node.size[extent] });
  }
  for (const layer of layers) layer.nodes.sort((a, b) => a.position[across] - b.position[across] || a.id.localeCompare(b.id));
  return layers.map(layer => layer.nodes);
}

// Layer indices where the set of top-level boundaries changes; rows prefer to break there.
function groupBoundaries(layers, graph) {
  const topGroup = node => { let id = node.groupId; const groups = graph.groups ?? []; for (;;) { const parent = groups.find(group => group.id === id)?.parentId; if (!parent) return id ?? null; id = parent; } };
  const signature = layer => [...new Set(layer.map(topGroup))].sort().join('|');
  return new Set(layers.slice(1).map((layer, i) => signature(layer) !== signature(layers[i]) ? i + 1 : null).filter(Boolean));
}

// Cut positions for `count` segments: even splits of the layer sequence, snapped to a top-level group boundary when one lies
// next to them and moved off a decision layer's branches so branch corridors stay together.
function segmentBreaks(layers, count, graph) {
  const boundaries = groupBoundaries(layers, graph), breaks = [];
  const avoid = new Set(layers.flatMap((layer, i) => layer.some(node => ['decision', 'choice'].includes(node.kind)) ? [i + 1] : []));
  for (let segment = 1; segment < count; segment++) {
    const even = Math.round(segment * layers.length / count);
    const usable = position => position > (breaks.at(-1) ?? 0) && position < layers.length && !avoid.has(position);
    const position = [even, even - 1, even + 1].find(item => boundaries.has(item) && usable(item)) ?? [even, even + 1, even - 1].find(usable);
    if (position !== undefined) breaks.push(position);
  }
  return breaks;
}

// A state chart folds only as a plain chain: apart from self transitions every state has at most one incoming and one
// outgoing transition, so no branch or loop has to cross a cut.
function stateChain(graph) {
  const edges = graph.edges.filter(edge => edge.source !== edge.target);
  return graph.nodes.every(node => edges.filter(edge => edge.source === node.id).length <= 1 && edges.filter(edge => edge.target === node.id).length <= 1);
}

// Fold a layered result by cutting its layer sequence into segments of consecutive layers placed side by side with aligned
// starts: a top-down layout becomes columns that each keep reading downward, a left-to-right layout becomes rows that each
// keep reading rightward. Geometry and ELK routes inside a segment are kept. An edge across a cut runs through the channel
// between the segments, or through the corridors before and after all segments when a neighbour stands in its way.
// Boundaries whose members end up in several segments are rebuilt around them and must not cover foreign nodes.
function foldSegments(graph, layers, breaks, { spacing, portGap }, down) {
  const [M, C, mExtent, cExtent] = down ? ['y', 'x', 'height', 'width'] : ['x', 'y', 'width', 'height'];
  const output = structuredClone(graph), type = diagramTypeOf(graph), byId = new Map(output.nodes.map(node => [node.id, node]));
  const routes = createEdgeRoutes(graph), ranges = [0, ...breaks, layers.length];
  const segments = ranges.slice(1).map((end, s) => layers.slice(ranges[s], end).flat().map(node => node.id));
  const segmentOf = new Map(segments.flatMap((ids, s) => ids.map(id => [id, s])));
  const groups = output.groups ?? [], errors = [];
  const subtree = id => { const ids = new Set([id]); for (const group of stable(groups)) if (ids.has(group.parentId)) ids.add(group.id); return ids; };
  const members = new Map(groups.map(group => [group.id, output.nodes.filter(node => subtree(group.id).has(node.groupId))]));
  const spread = new Map(groups.map(group => [group.id, new Set(members.get(group.id).map(node => segmentOf.get(node.id)))]));
  const internal = edge => segmentOf.get(edge.source) === segmentOf.get(edge.target);
  const start = (item, axis) => item.position[axis], end = (item, axis, extent) => item.position[axis] + item.size[extent];
  // A segment's extent covers its nodes, the boundaries that stay inside it and the routes and labels of its inner edges.
  const extents = segments.map((ids, s) => {
    const boxes = [...ids.map(id => box(byId.get(id))), ...groups.filter(group => spread.get(group.id).size === 1 && spread.get(group.id).has(s) && group.position && group.size).map(box)];
    for (const edge of output.edges.filter(edge => internal(edge) && segmentOf.get(edge.source) === s)) {
      const route = routes.get(edge.id);
      boxes.push(...route.points.map(point => ({ ...point, width: 0, height: 0 })));
      if (route.label) boxes.push(route.labelBox);
    }
    const x = Math.min(...boxes.map(item => item.x)), y = Math.min(...boxes.map(item => item.y));
    return { x, y, width: Math.max(...boxes.map(item => item.x + item.width)) - x, height: Math.max(...boxes.map(item => item.y + item.height)) - y };
  });
  // A boundary spread over several segments is rebuilt around its members further down; reserve its heading room before its
  // first segment and its inset after its last one now, so the channel between them stays clear of its border.
  const room = group => groupHeadingLayout({ ...group, size: undefined }).height + LAYOUT_LIMITS.groupHeadingGap
    + Math.max(0, ...groups.filter(child => child.parentId === group.id && spread.get(child.id).size > 1).map(room));
  for (const group of groups.filter(group => spread.get(group.id).size > 1)) {
    const first = extents[Math.min(...spread.get(group.id))], last = extents[Math.max(...spread.get(group.id))];
    first[C] -= room(group); first[cExtent] += room(group); last[cExtent] += LAYOUT_LIMITS.groupInset;
  }
  // Crossing edges take the channel right after the earlier of their two segments; lanes there are spaced for their labels.
  const crossing = stable(output.edges.filter(edge => !internal(edge)));
  const gapOf = edge => Math.min(segmentOf.get(edge.source), segmentOf.get(edge.target));
  const lanes = segments.slice(1).map(() => []), labelSpan = segments.slice(1).map(() => 0);
  for (const edge of crossing) { lanes[gapOf(edge)].push(edge.id); labelSpan[gapOf(edge)] = Math.max(labelSpan[gapOf(edge)], estimateLabelSize(visibleEdgeLabel(edge, type))[cExtent]); }
  // A channel keeps label clearance from both segments and leaves every endpoint its straight stub.
  const margin = Math.max(LAYOUT_LIMITS.labelGap, (getDiagram(type).endpointStub ?? LAYOUT_LIMITS.endpoint) + LAYOUT_LIMITS.labelEdgeGap);
  const step = g => LAYOUT_LIMITS.parallelGap + labelSpan[g];
  const gapWidth = g => Math.max(spacing, 2 * margin + (lanes[g].length - 1) * step(g) + labelSpan[g]);
  const placed = segments.reduce((acc, ids, s) => [...acc, s ? acc[s - 1] + extents[s - 1][cExtent] + gapWidth(s - 1) : 0], []);
  const delta = segments.map((ids, s) => ({ [C]: placed[s] - extents[s][C], [M]: -extents[s][M] }));
  const shift = (point, d) => ({ x: round(point.x + d.x), y: round(point.y + d.y) });
  for (const node of output.nodes) node.position = shift(node.position, delta[segmentOf.get(node.id)]);
  for (const edge of output.edges) {
    if (!internal(edge)) { delete edge.route; continue; }
    const d = delta[segmentOf.get(edge.source)];
    if (edge.route?.via) edge.route.via = edge.route.via.map(point => shift(point, d));
    if (edge.route?.labelAt) edge.route.labelAt = shift(edge.route.labelAt, d);
  }
  // A boundary inside one segment moves with it; a boundary spread over several is rebuilt around its members and children.
  const inset = LAYOUT_LIMITS.groupInset, done = new Set();
  const place = group => {
    if (done.has(group.id)) return; done.add(group.id);
    const children = groups.filter(child => child.parentId === group.id); children.forEach(place);
    if (spread.get(group.id).size <= 1) { if (group.position) group.position = shift(group.position, delta[[...spread.get(group.id)][0] ?? 0]); return; }
    const heading = groupHeadingLayout({ ...group, size: undefined }), boxes = [...members.get(group.id).map(box), ...children.filter(child => child.position && child.size).map(box)];
    const x = Math.min(...boxes.map(item => item.x)) - inset, y = Math.min(...boxes.map(item => item.y)) - heading.height - LAYOUT_LIMITS.groupHeadingGap;
    const width = Math.max(heading.width + 64, Math.max(...boxes.map(item => item.x + item.width)) + inset - x), height = Math.max(...boxes.map(item => item.y + item.height)) + inset - y;
    group.position = { x: round(x), y: round(y) }; group.size = { width: round(width), height: round(height) };
  };
  stable(groups).forEach(place);
  for (const group of groups.filter(group => spread.get(group.id).size > 1)) {
    for (const node of output.nodes) if (!members.get(group.id).includes(node) && intersects(box(group), box(node))) errors.push(`fold: boundary ${group.id} would cover ${node.id}`);
    for (const other of groups) if (other.id !== group.id && (other.parentId ?? null) === (group.parentId ?? null) && intersects(box(group), box(other))) errors.push(`fold: boundaries ${group.id} and ${other.id} would overlap`);
  }
  if (errors.length) return { graph: output, errors };
  // A crossing edge leaves and enters sideways straight into the channel when neither a neighbour nor a boundary heading
  // stands in the way, else through the corridor before or after all segments; decisions always leave sideways so their
  // branch corridors stay apart.
  const far = Math.max(...extents.map(extent => extent[mExtent])), corridor = 2 * LAYOUT_LIMITS.labelGap;
  const headings = groups.filter(group => group.position && group.size).flatMap(group => groupHeadingBoxes(group));
  const overlaps = (a, b, axis, extent) => start(a, axis) < end(b, axis, extent) && start(b, axis) < end(a, axis, extent);
  const neighbours = (node, axis, after) => segments[segmentOf.get(node.id)].map(id => byId.get(id))
    .filter(other => other !== node && overlaps(other, node, axis === M ? C : M, axis === M ? cExtent : mExtent) && (after ? start(other, axis) > start(node, axis) : start(other, axis) < start(node, axis)));
  const open = (a, b) => !headings.some(heading => segmentCrossesBox(a, b, heading));
  // Several crossing edges at one node spread their anchors along its side so no two share an initial segment.
  const shared = new Map(output.nodes.map(node => [node.id, crossing.filter(edge => edge.source === node.id || edge.target === node.id).map(edge => edge.id)]));
  const lane = (node, edge) => (shared.get(node.id).indexOf(edge.id) - (shared.get(node.id).length - 1) / 2) * LAYOUT_LIMITS.parallelGap;
  const point = (c, m) => ({ [C]: c, [M]: m });
  crossing.forEach((edge, i) => {
    const source = byId.get(edge.source), target = byId.get(edge.target), g = gapOf(edge), forward = segmentOf.get(edge.target) > segmentOf.get(edge.source);
    const centre = (node, axis, extent) => start(node, axis) + node.size[extent] / 2 + lane(node, edge);
    const channel = placed[g] + extents[g][cExtent] + margin + labelSpan[g] / 2 + lanes[g].indexOf(edge.id) * step(g);
    // The corridor after a segment hugs that segment when the channel is next to it; a run past other segments uses the far end.
    const adjacent = Math.abs(segmentOf.get(edge.target) - segmentOf.get(edge.source)) === 1;
    const corridorAt = (where, node) => where === 'after' ? (adjacent ? extents[segmentOf.get(node.id)][mExtent] : far) + corridor + i * LAYOUT_LIMITS.parallelGap : -corridor - i * LAYOUT_LIMITS.parallelGap;
    // The straight run between a node and its first waypoint must meet no neighbour and cross no heading.
    const sideRun = (node, towards) => open(point(towards ? end(node, C, cExtent) : start(node, C), centre(node, M, mExtent)), point(channel, centre(node, M, mExtent)));
    const endRun = (node, where) => open(point(centre(node, C, cExtent), where === 'after' ? end(node, M, mExtent) : start(node, M)), point(centre(node, C, cExtent), corridorAt(where, node)));
    const passage = (node, towards, sideways) => sideways && sideRun(node, towards) ? 'side'
      : !neighbours(node, M, true).length && endRun(node, 'after') ? 'after' : !neighbours(node, M, false).length && endRun(node, 'before') ? 'before' : 'side';
    const exit = passage(source, forward, ['decision', 'choice'].includes(source.kind) || !neighbours(source, C, forward).length);
    const entry = passage(target, !forward, !neighbours(target, C, !forward).length);
    const via = exit === 'side' ? [point(channel, centre(source, M, mExtent))] : [point(centre(source, C, cExtent), corridorAt(exit, source)), point(channel, corridorAt(exit, source))];
    via.push(...(entry === 'side' ? [point(channel, centre(target, M, mExtent))] : [point(channel, corridorAt(entry, target)), point(centre(target, C, cExtent), corridorAt(entry, target))]));
    const from = via[exit === 'side' ? 0 : 1][M], to = via[exit === 'side' ? 1 : 2][M];
    edge.route = { via: via.map(item => ({ x: round(item.x), y: round(item.y) })), ...(visibleEdgeLabel(edge, type) && from !== to ? { labelAt: { x: round(point(channel, (from + to) / 2).x), y: round(point(channel, (from + to) / 2).y) } } : {}) };
  });
  // Keep the ELK canvas padding around nodes, boundaries and the new corridors.
  const everything = [...output.nodes.map(box), ...groups.filter(group => group.position && group.size).map(box), ...output.edges.flatMap(edge => (edge.route?.via ?? []).map(item => ({ ...item, width: 0, height: 0 })))];
  const offset = { x: 32 - Math.min(...everything.map(item => item.x)), y: 32 - Math.min(...everything.map(item => item.y)) };
  for (const item of [...output.nodes, ...groups.filter(group => group.position && group.size)]) item.position = shift(item.position, offset);
  for (const edge of output.edges) {
    if (edge.route?.via) edge.route.via = edge.route.via.map(item => shift(item, offset));
    if (edge.route?.labelAt) edge.route.labelAt = shift(edge.route.labelAt, offset);
  }
  if (groups.length) bypassHeadings(output, portGap);
  return { graph: output, errors };
}

function foldedVariants(graph, options) {
  const type = diagramTypeOf(graph);
  if (graph.nodes.some(node => node.layout?.rank !== undefined) || type === 'state' && !stateChain(graph)) return [];
  const down = !['er', 'deployment', 'dataflow', 'usecase'].includes(type), bounds = graphBounds(graph);
  // Cutting shortens the layer sequence: a top-down layout folds only when too tall, a left-to-right one only when too wide.
  if (down ? bounds.width >= bounds.height : bounds.height >= bounds.width) return [];
  const layers = layersOf(graph, down);
  if (layers.length < 3) return [];
  const variants = [];
  for (let count = 2; count <= Math.min(FOLD_MAX, layers.length); count++) {
    const breaks = segmentBreaks(layers, count, graph);
    if (breaks.length !== count - 1 || variants.some(variant => variant.breaks.join() === breaks.join())) continue;
    variants.push({ axis: down ? 'columns' : 'rows', count, breaks, ...foldSegments(graph, layers, breaks, options, down) });
  }
  return variants;
}

function candidateScore(graph, audit, index) {
  const bounds = graphBounds(graph, audit.routes), budget = canvasBudgetFor(diagramTypeOf(graph));
  const routes = [...audit.routes.values()];
  const length = routes.reduce((sum, route) => sum + route.points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point.x - route.points[i].x, point.y - route.points[i].y), 0), 0);
  const area = graph.nodes.reduce((sum, node) => { const box = occupiedBox(node, diagramTypeOf(graph)); return sum + box.width * box.height; }, 0);
  const count = Math.max(1, routes.length), unit = Math.sqrt(area / graph.nodes.length);
  const crossings = audit.crossings.reduce((sum, item) => sum + item.measured + 2 * item.repeated, 0);
  const bends = routes.reduce((sum, route) => sum + route.points.length - 2, 0);
  // Normalize by content, so a small routing improvement cannot justify unlimited whitespace.
  const cost = bounds.width * bounds.height / area + length / (count * unit) + .25 * bends / count + 4 * crossings / count;
  // Shapes within the band's slack tie and compete on compactness; beyond it, the shape nearer the band wins first. The
  // type's budget ratio only breaks ties towards its preferred orientation.
  const excess = +aspectExcess(graph, audit.routes).toFixed(2), shape = excess <= ASPECT_SLACK ? 1 : excess;
  return [audit.errors.length, shape, round(cost), budget ? Math.abs(bounds.width / bounds.height - budget.width / budget.height) : 0, index];
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
        const layered = sequence ? compileSequence(graph, index) : applyElk(graph, result, prepared);
        const evaluate = (candidate, errors = []) => {
          let audit = auditLayoutQuality(candidate);
          if (errors.length) audit = { ...audit, errors: [...errors, ...audit.errors] };
          // ELK can put a label at a legal point crossing. Slide only that label along its own nearest segment.
          if (!sequence) for (const id of [...new Set(audit.diagnostics.filter(item => item.ruleId === 'spacing.label-edge').map(item => item.elementIds[0]))].sort()) {
            const edge = candidate.edges.find(item => item.id === id), route = audit.routes.get(id), origin = edge.route?.labelAt;
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
          return { graph: candidate, errors: audit.errors, diagnostics: audit.diagnostics, score: candidateScore(candidate, audit, index), crossings: audit.crossings, excess: +aspectExcess(candidate, audit.routes).toFixed(2) };
        };
        const unfolded = { ...evaluate(layered), fold: 0, axis: null };
        // Fold only a shape beyond the band's slack; the unfolded result stays available as the fallback.
        const variants = !sequence && unfolded.excess > ASPECT_SLACK
          ? foldedVariants(layered, { spacing: LAYOUT_TARGETS.layerGap + [0, 16, 48][index % 3], stub: prepared.stub, portGap: prepared.portGap }).map(variant => ({ ...evaluate(variant.graph, variant.errors), fold: variant.count, axis: variant.axis })) : [];
        if (performance.now() - started > timeout) { expired = true; throw new Error(`Layout exceeded ${timeout}ms for ${diagramTypeOf(graph)}`); }
        // Folding exists to fix the shape: the fewest rows or columns that pass the quality gate within the fold slack of the
        // band win; a fold the gate rejects is skipped for the next one, and otherwise the nearest valid shape competes with
        // the unfolded result.
        const valid = variants.filter(variant => !variant.errors.length);
        const fold = valid.find(variant => variant.excess <= ASPECT_SLACK) ?? valid.sort((a, b) => a.excess - b.excess || compare(a, b))[0];
        const chosen = fold && compare(fold, unfolded) < 0 ? fold : unfolded;
        candidates.push({ index, ...chosen, folds: variants.map(variant => ({ axis: variant.axis, count: variant.fold, errors: variant.errors, excess: variant.excess, score: variant.score })) });
      } catch (error) {
        if (expired) throw error;
        candidates.push({ index, errors: [error.message], diagnostics: qualityFailure(graph, 'geometry', error.message).diagnostics, score: [Infinity, 0, 0, 0, 0, 0, 0, index] });
      }
    }
    candidates.sort(compare);
    const best = candidates[0];
    if (best.errors.length) throw Object.assign(qualityFailure(graph, 'geometry', `No valid layout candidate for ${diagramTypeOf(graph)}:\n- ${best.errors.join('\n- ')}`, best.diagnostics), { diagnosticGraph: best.graph, candidates: candidates.map(({ graph, ...item }) => item) });
    best.graph.layout = { ...best.graph.layout, version: LAYOUT_VERSION, strategy: `${sequence ? 'sequence' : 'layered'}-${best.index}${best.fold ? `-fold${best.fold}${best.axis === 'columns' ? 'c' : ''}` : ''}` };
    return { graph: best.graph, report: { version: LAYOUT_VERSION, mode: layout, candidateCount: CANDIDATE_COUNT, timeoutMs: timeout, selected: best.index, migration, semantics: semanticReport(best.graph), candidates: candidates.map(({ graph, ...item }) => item) } };
  } catch (error) { throw error.phases ? error : qualityFailure(graph, 'geometry', error.message); }
  finally { clearTimeout(timer); await worker.terminate(); }
}
