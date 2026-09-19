import { TYPOGRAPHY } from './visual-style.js';
import { layoutText, cardTextLayout, estimateLabelSize, edgeLabelLayout, groupHeadingLayout } from './text-layout.js';
import { LAYOUT_LIMITS, LAYOUT_TARGETS } from './layout-spacing.js';
export { layoutText, cardTextLayout, estimateLabelSize } from './text-layout.js';
import { getDiagram } from './diagrams/registry.js';
import { sequenceHeaderHeight } from './diagrams/sequence.js';
import { actorTop } from './diagrams/usecase.js';
import { stateSymbolX } from './diagrams/state.js';
import { sequencePairs, sequenceExecutions, sequenceEndpointY, executionAt, sequenceMessageLabel } from './sequence-executions.js';
import { sequenceFragment, fragmentHeadingLayout, intersects, segmentBoxes, operandScopes } from './sequence-fragments.js';

export const ENDPOINT_STUB = 12;
export const ER_ENDPOINT_STUB = 28;
export const LANE_GAP = 24;
export { FLOW_SLANT } from './diagrams/flowchart.js';

const center = node => ({
  x: node.position.x + node.size.width / 2,
  y: node.position.y + node.size.height / 2
});

export const visibleEdgeLabel = (edge, type) => getDiagram(type)?.edgeLabel?.(edge) ?? edge.label ?? '';

export function cardinalityMarks(cardinality, point, neighbor) {
  const length = Math.hypot(neighbor.x - point.x, neighbor.y - point.y);
  if (!length) return { path: '' };
  const vx = (neighbor.x - point.x) / length;
  const vy = (neighbor.y - point.y) / length;
  const at = (forward, across = 0) => ({ x: point.x + vx * forward - vy * across, y: point.y + vy * forward + vx * across });
  const bar = forward => [at(forward, -6), at(forward, 6)];
  const value = String(cardinality).trim();
  const many = /[*n]/i.test(value);
  const optional = value.startsWith('0') || value === '*';
  const segments = many ? [[at(0, -6), at(12)], [at(0, 6), at(12)], [point, at(12)]] : [bar(8)];
  if (!optional) segments.push(bar(many ? 21 : 14));
  const path = segments.map(([start, end]) => `M${start.x} ${start.y}L${end.x} ${end.y}`).join('');
  const center = at(23);
  const circle = optional ? { cx: center.x, cy: center.y, r: 4 } : undefined;
  const points = segments.flat();
  if (circle) points.push({ x: center.x - 4, y: center.y - 4 }, { x: center.x + 4, y: center.y + 4 });
  const minX = Math.min(...points.map(item => item.x));
  const minY = Math.min(...points.map(item => item.y));
  const bounds = { x: minX, y: minY, width: Math.max(...points.map(item => item.x)) - minX, height: Math.max(...points.map(item => item.y)) - minY };
  return { path, ...(circle ? { circle } : {}), bounds };
}

export function graphBounds(graph, routes = createEdgeRoutes(graph)) {
  const items = [...(graph.groups ?? []), ...graph.nodes, ...sequenceExecutions(graph).map(item => ({ position: { x: item.x, y: item.y }, size: { width: item.width, height: item.height } }))];
  const points = [...routes.values()].flatMap(route => [...route.points, { x: route.labelBox.x, y: route.labelBox.y }, { x: route.labelBox.x + route.labelBox.width, y: route.labelBox.y + route.labelBox.height }]);
  for (const route of routes.values()) for (const label of route.endpointLabels ?? []) points.push({ x: label.labelBox.x, y: label.labelBox.y }, { x: label.labelBox.x + label.labelBox.width, y: label.labelBox.y + label.labelBox.height });
  if (getDiagram(graph.meta?.diagramType).cardinalities) for (const edge of graph.edges) {
    const route = routes.get(edge.id);
    for (const mark of [cardinalityMarks(edge.sourceCardinality, route.points[0], route.points[1]), cardinalityMarks(edge.targetCardinality, route.points.at(-1), route.points.at(-2))]) {
      if (mark.bounds) points.push({ x: mark.bounds.x, y: mark.bounds.y }, { x: mark.bounds.x + mark.bounds.width, y: mark.bounds.y + mark.bounds.height });
    }
  }
  const x = Math.min(...items.map(item => item.position.x), ...points.map(point => point.x));
  const y = Math.min(...items.map(item => item.position.y), ...points.map(point => point.y));
  const right = Math.max(...items.map(item => item.position.x + item.size.width), ...points.map(point => point.x));
  const bottom = Math.max(...items.map(item => item.position.y + item.size.height), ...points.map(point => point.y));
  return { x, y, width: right - x, height: bottom - y };
}

function anchor(node, side, offset = 0, type = 'architecture') {
  const custom = getDiagram(type)?.anchor;
  if (custom) return custom(node, side, offset);
  const middle = center(node);
  if (side === 'left') return { x: node.position.x, y: middle.y + offset };
  if (side === 'right') return { x: node.position.x + node.size.width, y: middle.y + offset };
  if (side === 'top') return { x: middle.x + offset, y: node.position.y };
  return { x: middle.x + offset, y: node.position.y + node.size.height };
}

function outward(point, side, distance = ENDPOINT_STUB) {
  if (side === 'left') return { x: point.x - distance, y: point.y };
  if (side === 'right') return { x: point.x + distance, y: point.y };
  if (side === 'top') return { x: point.x, y: point.y - distance };
  return { x: point.x, y: point.y + distance };
}

function compact(points) {
  const result = [];
  for (const point of points) {
    const previous = result.at(-1);
    if (!previous || previous.x !== point.x || previous.y !== point.y) result.push(point);
  }
  for (let index = 1; index < result.length - 1;) {
    const [before, current, after] = result.slice(index - 1, index + 2);
    const vertical = before.x === current.x && current.x === after.x && (current.y - before.y) * (after.y - current.y) >= 0;
    const horizontal = before.y === current.y && current.y === after.y && (current.x - before.x) * (after.x - current.x) >= 0;
    if (vertical || horizontal) result.splice(index, 1);
    else index += 1;
  }
  return result;
}

function appendOrthogonal(points, point) {
  const previous = points.at(-1);
  if (previous.x !== point.x && previous.y !== point.y) points.push({ x: point.x, y: previous.y });
  points.push(point);
}

function longestSegmentMidpoint(points) {
  let longest = { length: -1, point: points[0] };
  for (let index = 1; index < points.length; index += 1) {
    const before = points[index - 1];
    const after = points[index];
    const length = Math.abs(after.x - before.x) + Math.abs(after.y - before.y);
    if (length > longest.length) longest = { length, point: { x: (before.x + after.x) / 2, y: (before.y + after.y) / 2 } };
  }
  return longest.point;
}

// Every label sits on its own line, centred on the segment with the most clearance from both endpoints.
function bestLabelPoint(points, labelSize, source, target) {
  let best = { clearance: -1, length: -1, point: longestSegmentMidpoint(points) };
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const point = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const box = { x: point.x - labelSize.width / 2, y: point.y - labelSize.height / 2, ...labelSize };
    const clearance = Math.min(boxDistance(box, { ...source.position, ...source.size }), boxDistance(box, { ...target.position, ...target.size }));
    const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
    if (clearance > best.clearance || (clearance === best.clearance && length > best.length)) best = { clearance, length, point };
  }
  return best.point;
}

function sidesFor(source, target) {
  const sourceCenter = center(source);
  const targetCenter = center(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  if (Math.abs(dy) > Math.abs(dx)) return {
    orientation: 'vertical',
    sourceSide: dy >= 0 ? 'bottom' : 'top',
    targetSide: dy >= 0 ? 'top' : 'bottom'
  };
  return {
    orientation: 'horizontal',
    sourceSide: dx >= 0 ? 'right' : 'left',
    targetSide: dx >= 0 ? 'left' : 'right'
  };
}

function waypointEndpoint(node, point, fallbackSide, type) {
  const { x, y } = node.position;
  const { width, height } = node.size;
  const dx = Math.max(x - point.x, 0, point.x - x - width);
  const dy = Math.max(y - point.y, 0, point.y - y - height);
  const side = dx === 0 && dy === 0 ? fallbackSide
    : dx > dy ? (point.x < x ? 'left' : 'right') : (point.y < y ? 'top' : 'bottom');
  const horizontal = side === 'left' || side === 'right';
  const middle = center(node);
  const limit = Math.max(0, (horizontal ? height : width) / 2 - ENDPOINT_STUB);
  const offset = Math.max(-limit, Math.min(limit, horizontal ? point.y - middle.y : point.x - middle.x));
  return { side, point: anchor(node, side, ['decision', 'choice'].includes(node.kind) ? 0 : offset, type) };
}

function routePointsWithWaypoints(start, end, sourceSide, targetSide, waypoints, stub = ENDPOINT_STUB) {
  const points = [start, outward(start, sourceSide, stub)];
  // A shaped endpoint can sit inside its layout box. Turn at the real stub before joining its allocated channel.
  if (['left', 'right'].includes(sourceSide) && waypoints.length && points[1].y !== waypoints[0].y) points.push({ x: points[1].x, y: waypoints[0].y });
  for (const waypoint of waypoints) appendOrthogonal(points, waypoint);
  appendOrthogonal(points, outward(end, targetSide, stub));
  points.push(end);
  return compact(points);
}

function routeBetween(source, target, sides, sourceOffset, targetOffset, stub = ENDPOINT_STUB, type = 'architecture') {
  const start = anchor(source, sides.sourceSide, sourceOffset, type);
  const end = anchor(target, sides.targetSide, targetOffset, type);
  const sourceStub = outward(start, sides.sourceSide, stub);
  const targetStub = outward(end, sides.targetSide, stub);
  const channelOffset = sourceOffset || targetOffset;
  if (sides.orientation === 'horizontal') {
    const middle = (sourceStub.x + targetStub.x) / 2 + channelOffset;
    return compact([start, sourceStub, { x: middle, y: sourceStub.y }, { x: middle, y: targetStub.y }, targetStub, end]);
  }
  const middle = (sourceStub.y + targetStub.y) / 2 + channelOffset;
  return compact([start, sourceStub, { x: sourceStub.x, y: middle }, { x: targetStub.x, y: middle }, targetStub, end]);
}

export function pathFromPoints(points, offsetX = 0, offsetY = 0) {
  if (!points.length) return '';
  const shifted = points.map(point => ({ x: point.x + offsetX, y: point.y + offsetY }));
  return shifted.slice(1).reduce((path, point, index) => {
    const previous = shifted[index];
    if (previous.y === point.y) return `${path} H ${point.x}`;
    if (previous.x === point.x) return `${path} V ${point.y}`;
    return `${path} L ${point.x} ${point.y}`;
  }, `M ${shifted[0].x} ${shifted[0].y}`);
}

function routeSequenceEdge(edge, source, target, selfIndex, context) {
  const { graph, executions, scopes, pairs } = context;
  const y = sequenceEndpointY(graph, edge, 'send');
  const endY = sequenceEndpointY(graph, edge, 'receive');
  const sourceExecution = executionAt(executions, source.id, edge, 'send', y, scopes.get(edge.id));
  const targetExecution = executionAt(executions, target.id, edge, 'receive', endY, scopes.get(edge.id));
  const forward = source.id === target.id || center(source).x <= center(target).x;
  const sourceX = sourceExecution ? sourceExecution.x + (forward ? sourceExecution.width : 0) : center(source).x;
  const targetX = targetExecution ? targetExecution.x + (source.id === target.id || !forward ? targetExecution.width : 0) : center(target).x;
  const label = sequenceMessageLabel(graph, edge, pairs, scopes);
  const available = source.id === target.id ? LAYOUT_TARGETS.labelWidth : Math.min(LAYOUT_TARGETS.labelWidth, Math.max(1, Math.abs(targetX - sourceX) - 32 - 12));
  const layout = edgeLabelLayout(label, available);
  const labelSize = { width: layout.width, height: layout.height };
  if (source.id === target.id) {
    const extent = 48 + selfIndex * LANE_GAP;
    const start = { x: sourceX, y };
    const end = { x: targetX, y: endY };
    const points = edge.route?.via?.length
      ? routePointsWithWaypoints(start, end, 'right', 'right', edge.route.via)
      : [start, { x: sourceX + extent, y }, { x: sourceX + extent, y: y + 30 }, end];
    return { points, label, labelLines: layout.lines, labelSize, labelPoint: edge.route?.labelAt ?? { x: Math.max(...points.map(p => p.x)) + 8 + labelSize.width / 2, y: y + 15 }, sourceSide: 'right', targetSide: 'right' };
  }
  const points = edge.route?.via?.length
    ? routePointsWithWaypoints({ x: sourceX, y }, { x: targetX, y }, sourceX <= targetX ? 'right' : 'left', sourceX <= targetX ? 'left' : 'right', edge.route.via)
    : [{ x: sourceX, y }, { x: targetX, y }];
  return { points, label, labelLines: layout.lines, labelSize, labelPoint: edge.route?.labelAt ?? { x: (sourceX + targetX) / 2, y: y - 6 - labelSize.height / 2 }, sourceSide: sourceX <= targetX ? 'right' : 'left', targetSide: sourceX <= targetX ? 'left' : 'right' };
}

export function createEdgeRoutes(graph) {
  const type = graph.meta.diagramType ?? 'architecture';
  const stub = getDiagram(type).endpointStub ?? ENDPOINT_STUB;
  const nodeById = new Map(graph.nodes.map(node => [node.id, node]));
  const prepared = graph.edges.map(edge => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    return { edge, source, target, self: source.id === target.id, ...sidesFor(source, target) };
  });
  const sequenceContext = type === 'sequence' ? { graph, executions: sequenceExecutions(graph), scopes: operandScopes(graph), pairs: sequencePairs(graph) } : null;
  const endpointBuckets = new Map();
  for (const item of prepared.filter(item => !getDiagram(type).sequence && !item.self && !item.edge.route?.via?.length)) {
    for (const [role, node, side, opposite] of [
      ['source', item.source, item.sourceSide, item.target],
      ['target', item.target, item.targetSide, item.source]
    ]) {
      const key = `${node.id}:${side}`;
      const coordinate = item.orientation === 'horizontal' ? center(opposite).y : center(opposite).x;
      if (!endpointBuckets.has(key)) endpointBuckets.set(key, []);
      endpointBuckets.get(key).push({ id: item.edge.id, role, coordinate });
    }
  }
  const offsets = new Map();
  for (const bucket of endpointBuckets.values()) {
    bucket.sort((a, b) => a.coordinate - b.coordinate || a.id.localeCompare(b.id) || a.role.localeCompare(b.role));
    bucket.forEach((item, index) => offsets.set(`${item.id}:${item.role}`, (index - (bucket.length - 1) / 2) * LANE_GAP));
  }
  const selfCounts = new Map();
  const selfOrdinals = new Map();
  for (const item of prepared.filter(item => item.self).sort((a, b) => (a.edge.order ?? 0) - (b.edge.order ?? 0) || (a.edge.id < b.edge.id ? -1 : 1))) {
    const ordinal = selfCounts.get(item.source.id) ?? 0;
    selfOrdinals.set(item.edge.id, ordinal); selfCounts.set(item.source.id, ordinal + 1);
  }
  const routes = new Map();
  for (const item of prepared) {
    let route;
    if (getDiagram(type).sequence) {
      const selfIndex = selfOrdinals.get(item.edge.id) ?? 0;
      route = routeSequenceEdge(item.edge, item.source, item.target, selfIndex, sequenceContext);
    } else if (item.self) {
      const selfIndex = selfOrdinals.get(item.edge.id);
      const right = item.source.position.x + item.source.size.width;
      const middleY = center(item.source).y;
      const extent = 48 + selfIndex * LANE_GAP;
      const label = visibleEdgeLabel(item.edge, type);
      const labelSize = estimateLabelSize(label);
      const waypoints = item.edge.route?.via;
      const sourceEndpoint = waypoints?.length && waypointEndpoint(item.source, waypoints[0], 'right', type);
      const targetEndpoint = waypoints?.length && waypointEndpoint(item.target, waypoints.at(-1), 'right', type);
      const sourceSide = sourceEndpoint ? sourceEndpoint.side : 'right', targetSide = targetEndpoint ? targetEndpoint.side : 'right';
      const start = sourceEndpoint ? sourceEndpoint.point : anchor(item.source, 'right', -16 - selfIndex * 12, type);
      const end = targetEndpoint ? targetEndpoint.point : anchor(item.source, 'right', 16 + selfIndex * 12, type);
      route = {
        points: item.edge.route?.via?.length
          ? routePointsWithWaypoints(start, end, sourceSide, targetSide, item.edge.route.via, stub)
          : [start, { x: right + extent, y: start.y }, { x: right + extent, y: end.y }, end],
        label,
        labelPoint: item.edge.route?.labelAt ?? { x: right + extent + 8 + labelSize.width / 2, y: middleY },
        sourceSide, targetSide
      };
    } else {
      const waypoints = item.edge.route?.via;
      const sourceEndpoint = waypoints?.length && waypointEndpoint(item.source, waypoints[0], item.sourceSide, type);
      const targetEndpoint = waypoints?.length && waypointEndpoint(item.target, waypoints.at(-1), item.targetSide, type);
      const sourceSide = sourceEndpoint ? sourceEndpoint.side : item.sourceSide;
      const targetSide = targetEndpoint ? targetEndpoint.side : item.targetSide;
      const routedWaypoints = waypoints ? [...waypoints] : [];
      if (sourceEndpoint && ['decision', 'choice'].includes(item.source.kind) && ['left', 'right'].includes(sourceSide)) {
        routedWaypoints.unshift({ x: outward(sourceEndpoint.point, sourceSide, stub).x, y: waypoints[0].y });
      }
      if (targetEndpoint && ['decision', 'choice'].includes(item.target.kind) && ['top', 'bottom'].includes(targetSide)) {
        routedWaypoints.push({ x: waypoints.at(-1).x, y: outward(targetEndpoint.point, targetSide, stub).y });
      }
      const points = item.edge.route?.via?.length
        ? routePointsWithWaypoints(sourceEndpoint.point, targetEndpoint.point, sourceSide, targetSide, routedWaypoints, stub)
        : routeBetween(item.source, item.target, item, offsets.get(`${item.edge.id}:source`) ?? 0, offsets.get(`${item.edge.id}:target`) ?? 0, stub, type);
      const label = visibleEdgeLabel(item.edge, type);
      route = { points, label, labelPoint: item.edge.route?.labelAt ?? bestLabelPoint(points, estimateLabelSize(label), item.source, item.target), sourceSide, targetSide };
    }
    const labelSize = route.labelSize ?? estimateLabelSize(route.label);
    routes.set(item.edge.id, { ...route, endpointLabels: getDiagram(type).endpointLabels?.(item.edge, route.points) ?? [], labelLines: route.labelLines ?? edgeLabelLayout(route.label).lines, path: pathFromPoints(route.points), labelBox: { x: route.labelPoint.x - labelSize.width / 2, y: route.labelPoint.y - labelSize.height / 2, ...labelSize } });
  }
  return routes;
}

function boxesIntersect(a, b, margin = 0) {
  return a.x < b.x + b.width + margin
    && a.x + a.width > b.x - margin
    && a.y < b.y + b.height + margin
    && a.y + a.height > b.y - margin;
}

export function occupiedBox(node, type) {
  if (!getDiagram(type).sequence) return { ...node.position, ...node.size };
  return { ...node.position, width: node.size.width, height: Math.min(node.size.height, sequenceHeaderHeight(node)) };
}

export function boxDistance(first, second) {
  const horizontal = Math.max(first.x - second.x - second.width, second.x - first.x - first.width, 0);
  const vertical = Math.max(first.y - second.y - second.height, second.y - first.y - first.height, 0);
  return Math.hypot(horizontal, vertical);
}

function pointOnNodeSide(point, node, side, type) {
  const bounds = routingBounds(node, type);
  if ((side === 'left' || side === 'right') && (point.y < bounds.y || point.y > bounds.y + bounds.height)) return false;
  if ((side === 'top' || side === 'bottom') && (point.x < bounds.x || point.x > bounds.x + bounds.width)) return false;
  const middle = center(node);
  const offset = side === 'left' || side === 'right' ? point.y - middle.y : point.x - middle.x;
  const expected = anchor(node, side, offset, type);
  return Math.hypot(point.x - expected.x, point.y - expected.y) < 1e-7;
}

export function segmentCrossesBox(start, end, box) {
  if (start.y === end.y) {
    return start.y > box.y && start.y < box.y + box.height
      && Math.max(Math.min(start.x, end.x), box.x) < Math.min(Math.max(start.x, end.x), box.x + box.width);
  }
  if (start.x === end.x) {
    return start.x > box.x && start.x < box.x + box.width
      && Math.max(Math.min(start.y, end.y), box.y) < Math.min(Math.max(start.y, end.y), box.y + box.height);
  }
  return false;
}

function routingBounds(node, type) {
  if (type === 'state' && ['initial', 'final'].includes(node.kind)) {
    const radius = node.kind === 'initial' ? 12 : 13, middle = center(node);
    return { x: node.position.x + stateSymbolX(node) - radius, y: middle.y - radius, width: radius * 2, height: radius * 2 };
  }
  if (type === 'usecase' && node.kind === 'actor') {
    const top = actorTop(node), middle = center(node);
    return { x: middle.x - 20, y: node.position.y + top + 2, width: 40, height: 74 };
  }
  if (type === 'deployment' && node.kind === 'device') return { x: node.position.x + 16, y: node.position.y, width: node.size.width - 32, height: node.size.height };
  if (['architecture', 'deployment'].includes(type) && node.kind === 'database') return { x: node.position.x + 12, y: node.position.y + 2, width: node.size.width - 24, height: node.size.height - 4 };
  return occupiedBox(node, type);
}

function segmentCrossesNode(start, end, node, type) {
  if (type === 'state' && ['initial', 'final'].includes(node.kind) && node.subtitle) {
    const area = getDiagram(type).textArea(node);
    if (segmentCrossesBox(start, end, { ...area, x: node.position.x + area.x, y: node.position.y + area.y })) return true;
  }
  const bounds = routingBounds(node, type);
  if (type === 'sequence') return segmentCrossesBox(start, end, bounds);
  if (type === 'usecase' && node.kind === 'actor') return segmentCrossesBox(start, end, bounds);
  const middle = center(node);
  if (start.y === end.y) {
    if (start.y <= bounds.y || start.y >= bounds.y + bounds.height) return false;
    const offset = start.y - middle.y;
    const left = anchor(node, 'left', offset, type).x, right = anchor(node, 'right', offset, type).x;
    return Math.max(Math.min(start.x, end.x), left) < Math.min(Math.max(start.x, end.x), right) - 1e-7;
  }
  if (start.x === end.x) {
    if (start.x <= bounds.x || start.x >= bounds.x + bounds.width) return false;
    const offset = start.x - middle.x;
    const top = anchor(node, 'top', offset, type).y, bottom = anchor(node, 'bottom', offset, type).y;
    return Math.max(Math.min(start.y, end.y), top) < Math.min(Math.max(start.y, end.y), bottom) - 1e-7;
  }
  return false;
}

function groupBorders(group) {
  const left = group.position.x;
  const right = left + group.size.width;
  const top = group.position.y;
  const bottom = top + group.size.height;
  return [
    [{ x: left, y: top }, { x: right, y: top }],
    [{ x: right, y: top }, { x: right, y: bottom }],
    [{ x: left, y: bottom }, { x: right, y: bottom }],
    [{ x: left, y: top }, { x: left, y: bottom }]
  ];
}

export function groupHeadingBoxes(group) {
  const fragment = ['alt', 'opt', 'loop', 'par'].includes(group.kind), heading = groupHeadingLayout(group);
  const fragmentHeading = fragment ? fragmentHeadingLayout(group) : null;
  const height = Math.min(fragment ? Math.max(36, fragmentHeading.height + 20) : heading.height, group.size.height);
  const labelWidth = Math.min(group.size.width, (fragment ? fragmentHeading.width : heading.width) + 32);
  const boxes = [{ x: group.position.x, y: group.position.y, width: labelWidth, height }];
  if (['alt', 'opt', 'loop'].includes(group.kind)) boxes.push({ x: group.position.x + group.size.width - 52, y: group.position.y, width: 52, height });
  return boxes;
}

function sharedSegmentLength(firstStart, firstEnd, secondStart, secondEnd) {
  if (firstStart.y === firstEnd.y && secondStart.y === secondEnd.y && firstStart.y === secondStart.y) {
    return Math.max(0, Math.min(Math.max(firstStart.x, firstEnd.x), Math.max(secondStart.x, secondEnd.x))
      - Math.max(Math.min(firstStart.x, firstEnd.x), Math.min(secondStart.x, secondEnd.x)));
  }
  if (firstStart.x === firstEnd.x && secondStart.x === secondEnd.x && firstStart.x === secondStart.x) {
    return Math.max(0, Math.min(Math.max(firstStart.y, firstEnd.y), Math.max(secondStart.y, secondEnd.y))
      - Math.max(Math.min(firstStart.y, firstEnd.y), Math.min(secondStart.y, secondEnd.y)));
  }
  return 0;
}

export function routeCrossings(first, firstPoints, second, secondPoints) {
  const points = new Map();
  const ends = (edge, route) => [{ id: edge.source, point: route[0] }, { id: edge.target, point: route.at(-1) }];
  const samePoint = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < .001;
  for (let i = 1; i < firstPoints.length; i++) for (let j = 1; j < secondPoints.length; j++) {
    const a = firstPoints[i - 1], b = firstPoints[i], c = secondPoints[j - 1], d = secondPoints[j];
    const dx = b.x - a.x, dy = b.y - a.y, ex = d.x - c.x, ey = d.y - c.y, det = dx * ey - dy * ex;
    if (Math.abs(det) < 1e-8) continue; // Collinear overlap is a separate hard rule.
    const t = ((c.x - a.x) * ey - (c.y - a.y) * ex) / det, u = ((c.x - a.x) * dy - (c.y - a.y) * dx) / det;
    if (t < 0 || t > 1 || u < 0 || u > 1) continue;
    const point = { x: +(a.x + t * dx).toFixed(3), y: +(a.y + t * dy).toFixed(3) };
    if (ends(first, firstPoints).some(left => ends(second, secondPoints).some(right => left.id === right.id && samePoint(left.point, point) && samePoint(right.point, point)))) continue;
    points.set(`${point.x},${point.y}`, point);
  }
  return [...points.values()].sort((a, b) => a.x - b.x || a.y - b.y);
}

export function auditGraphLayout(graph) {
  const type = graph.meta.diagramType ?? 'architecture';
  const crossings = [];
  const routes = createEdgeRoutes(graph);
  const errors = [];
  const warnings = [], diagnostics = [];
  const elements = new Map([...graph.nodes, ...(graph.groups ?? []), ...sequenceExecutions(graph)].map(item => [item.id, item]));
  const fail = (ruleId, elementIds, message) => {
    errors.push(message);
    const bounds = elementIds.flatMap(id => {
      const item = elements.get(id);
      if (item) return [item.position ? { ...item.position, ...item.size } : { x: item.x, y: item.y, width: item.width, height: item.height }];
      const route = routes.get(id);
      return route ? route.points.map(point => ({ ...point, width: 0, height: 0 })) : [];
    });
    diagnostics.push({ ruleId, severity: 'error', diagramType: type, elementIds, bounds, measured: message, required: 'clear full-size geometry', remediation: message.includes(';') ? message.split(';').slice(1).join(';').trim() : 'Adjust the identified elements while preserving the complete model.' });
  };
  if (type === 'sequence') {
    for (const node of graph.nodes) if (node.size.height < sequenceHeaderHeight(node)) fail('sequence.header', [node.id], `layout: sequence node ${node.id} is shorter than its visible header`);
    for (const group of graph.groups ?? []) {
      const fragment = sequenceFragment(group, routes, graph.meta.locale, graph.groups ?? [], sequenceExecutions(graph));
      for (const message of fragment.errors) fail('sequence.fragment', [group.id], message);
      warnings.push(...fragment.warnings);
    }
    const executions = sequenceExecutions(graph);
    for (const edge of graph.edges) {
      const route = routes.get(edge.id);
      for (const execution of executions) if (intersects(route.labelBox, execution, 2)) fail('sequence.label-execution', [edge.id, execution.id], `layout: edge ${edge.id} label overlaps execution ${execution.id}`);
      for (const other of graph.edges) {
        if (segmentBoxes(routes.get(other.id)).some(box => intersects(route.labelBox, box))) fail('sequence.message-clearance', [edge.id, other.id], `layout: sequence edge ${edge.id} label needs 6px clearance from message ${other.id}; shorten the label or adjust participant spacing/route hints`);
      }
      if (route.points.some(p => p.y > Math.min(...[edge.source, edge.target].map(id => { const n = graph.nodes.find(n => n.id === id); return n.position.y + n.size.height; })))) fail('sequence.lifeline', [edge.id, edge.source, edge.target], `layout: sequence edge ${edge.id} exceeds its participant lifeline`);
    }
  }
  if (getDiagram(type).cardLayout) for (const node of graph.nodes) {
    if (node.size.height < 100) continue;
    const { minHeight } = cardTextLayout(node);
    if (node.size.height < minHeight) fail('text.card-height', [node.id], `layout: node ${node.id} text needs at least ${minHeight}px height at 20/16px; enlarge the node and check its route clearance`);
  }
  for (let left = 0; left < graph.nodes.length; left += 1) {
    for (let right = left + 1; right < graph.nodes.length; right += 1) {
      const first = graph.nodes[left];
      const second = graph.nodes[right];
      const firstBox = occupiedBox(first, type);
      const secondBox = occupiedBox(second, type);
      if (boxesIntersect(firstBox, secondBox)) fail('shape.node-overlap', [first.id, second.id], `layout: nodes ${first.id} and ${second.id} overlap`);
      else {
        const distance = boxDistance(firstBox, secondBox);
        if (distance < LAYOUT_LIMITS.nodeGap) warnings.push(`nodes ${first.id} and ${second.id} are only ${Math.round(distance)}px apart`);
      }
    }
  }
  const labeledEdges = graph.edges.filter(edge => routes.get(edge.id).label);
  for (let left = 0; left < labeledEdges.length; left += 1) {
    for (let right = left + 1; right < labeledEdges.length; right += 1) {
      const first = labeledEdges[left];
      const second = labeledEdges[right];
      if (boxesIntersect(routes.get(first.id).labelBox, routes.get(second.id).labelBox)) fail('label.overlap', [first.id, second.id], `layout: edge labels ${first.id} and ${second.id} overlap`);
    }
  }
  for (let left = 0; left < graph.edges.length; left += 1) {
    for (let right = left + 1; right < graph.edges.length; right += 1) {
      const first = graph.edges[left];
      const second = graph.edges[right];
      const firstPoints = routes.get(first.id).points;
      const secondPoints = routes.get(second.id).points;
      let longest = 0;
      for (let firstIndex = 1; firstIndex < firstPoints.length; firstIndex += 1) {
        for (let secondIndex = 1; secondIndex < secondPoints.length; secondIndex += 1) {
          longest = Math.max(longest, sharedSegmentLength(firstPoints[firstIndex - 1], firstPoints[firstIndex], secondPoints[secondIndex - 1], secondPoints[secondIndex]));
        }
      }
      if (longest > ENDPOINT_STUB) fail('route.shared-segment', [first.id, second.id], `layout: edges ${first.id} and ${second.id} share a route segment longer than ${ENDPOINT_STUB}px`);
      const points = routeCrossings(first, firstPoints, second, secondPoints);
      if (points.length) {
        crossings.push({ ruleId: 'route.point-crossing', severity: 'info', diagramType: type, elementIds: [first.id, second.id].sort(), measured: points.length, required: null, bounds: points.map(point => ({ ...point, width: 0, height: 0 })), repeated: Math.max(0, points.length - 1), remediation: 'Keep each relation traceable; prefer fewer repeated crossings without overlapping channels.' });
      }
    }
  }
  for (const edge of graph.edges) {
    const route = routes.get(edge.id);
    const source = graph.nodes.find(node => node.id === edge.source);
    const target = graph.nodes.find(node => node.id === edge.target);
    if (!getDiagram(type).sequence && (!pointOnNodeSide(route.points[0], source, route.sourceSide, type) || !pointOnNodeSide(route.points.at(-1), target, route.targetSide, type))) {
      fail('route.anchor', [edge.id, edge.source, edge.target], `layout: edge ${edge.id} exceeds an endpoint side; enlarge the node or add route hints`);
    }
    if (getDiagram(type).cardinalities) {
      for (const [role, point, neighbor, side, cardinality, hint] of [
        ['source', route.points[0], route.points[1], route.sourceSide, edge.sourceCardinality, edge.route?.via?.[0]],
        ['target', route.points.at(-1), route.points.at(-2), route.targetSide, edge.targetCardinality, edge.route?.via?.at(-1)]
      ]) {
        const direction = outward(point, side, 1);
        const projection = other => (other.x - point.x) * (direction.x - point.x) + (other.y - point.y) * (direction.y - point.y);
        if (projection(neighbor) < ER_ENDPOINT_STUB || (hint && projection(hint) < ER_ENDPOINT_STUB)) {
          fail('route.er-stub', [edge.id], `layout: ER edge ${edge.id} ${role} needs a ${ER_ENDPOINT_STUB}px outward straight segment; move the route hint or enlarge the gap`);
        }
        const mark = cardinalityMarks(cardinality, point, neighbor);
        for (const node of graph.nodes) {
          if (mark.bounds && boxesIntersect(mark.bounds, { ...node.position, ...node.size })) fail('marker.er-node', [edge.id, node.id], `layout: ER edge ${edge.id} ${role} cardinality overlaps node ${node.id}`);
        }
      }
      if (route.points.slice(1, -1).some((point, index) => {
        const before = route.points[index];
        const after = route.points[index + 2];
        return before.x === point.x && point.x === after.x && (point.y - before.y) * (after.y - point.y) < 0
          || before.y === point.y && point.y === after.y && (point.x - before.x) * (after.x - point.x) < 0;
      })) fail('route.er-reversal', [edge.id], `layout: ER edge ${edge.id} reverses within its route; reserve ${ER_ENDPOINT_STUB}px endpoint segments or move the route hints`);
    }
    if (getDiagram(type).sequence && edge.source !== edge.target) {
      const available = Math.abs(center(source).x - center(target).x);
      const required = Math.max(160, route.labelBox.width + 32);
      if (available < required) fail('sequence.participant-gap', [edge.id, edge.source, edge.target], `layout: sequence edge ${edge.id} needs ${Math.ceil(required)}px between participants; found ${Math.round(available)}px`);
      if (edge.route?.messageY === undefined && route.labelBox.height > 54) fail('sequence.legacy-pitch', [edge.id], `layout: sequence edge ${edge.id} wrapped label needs ${route.labelBox.height}px height; enlarge participant spacing to fit the 54px message pitch`);
    }
    for (const node of graph.nodes) {
      for (let index = 1; index < route.points.length; index += 1) {
        if (node.id === edge.source && index === 1 || node.id === edge.target && index === route.points.length - 1) continue;
        if (segmentCrossesNode(route.points[index - 1], route.points[index], node, type)) {
          const kind = edge.source === edge.target && node.id === edge.source ? 'self-loop' : 'edge';
          fail('route.node-obstacle', [edge.id, node.id], `layout: ${kind} ${edge.id} crosses node ${node.id}`);
          break;
        }
      }
    }
    if (!route.label) continue;
    for (const group of graph.groups ?? []) {
      if (groupHeadingBoxes(group).some(heading => boxesIntersect(route.labelBox, heading))) fail('label.group-heading', [edge.id, group.id], `layout: edge ${edge.id} label overlaps group ${group.id} heading`);
      const borders = groupBorders(group);
      if (borders.some(([start, end]) => segmentCrossesBox(start, end, route.labelBox))) fail('label.group-boundary', [edge.id, group.id], `layout: edge ${edge.id} label overlaps group ${group.id} boundary`);
    }
    for (const node of graph.nodes) {
      const nodeBox = routingBounds(node, type);
      if (boxesIntersect(route.labelBox, nodeBox)) {
        fail('label.node', [edge.id, node.id], `layout: edge ${edge.id} label overlaps node ${node.id}`);
      } else if (boxDistance(route.labelBox, nodeBox) < 12) {
        warnings.push(`edge ${edge.id} label has less than 12px clearance from node ${node.id}`);
      }
    }
  }
  for (const edge of graph.edges) {
    const route = routes.get(edge.id);
    for (const group of graph.groups ?? []) {
      const borders = groupBorders(group);
      for (let index = 1; index < route.points.length; index += 1) {
        const start = route.points[index - 1];
        const end = route.points[index];
        if (groupHeadingBoxes(group).some(heading => segmentCrossesBox(start, end, heading))) fail('route.group-heading', [edge.id, group.id], `layout: edge ${edge.id} crosses group ${group.id} heading`);
        if (borders.some(([borderStart, borderEnd]) => sharedSegmentLength(start, end, borderStart, borderEnd) > ENDPOINT_STUB)) fail('route.group-boundary', [edge.id, group.id], `layout: edge ${edge.id} overlaps group ${group.id} boundary`);
      }
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], routes, crossings, diagnostics };
}
