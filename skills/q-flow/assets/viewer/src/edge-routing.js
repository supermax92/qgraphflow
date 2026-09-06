import { TYPOGRAPHY } from './visual-style.js';
import { layoutText, cardTextLayout, estimateLabelSize } from './text-layout.js';
export { layoutText, cardTextLayout, estimateLabelSize } from './text-layout.js';
import { getDiagram } from './diagrams/registry.js';

export const ENDPOINT_STUB = 12;
export const ER_ENDPOINT_STUB = 28;
export const LANE_GAP = 24;
export { FLOW_SLANT } from './diagrams/flowchart.js';
import { FLOW_SLANT } from './diagrams/flowchart.js';

const isSlanted = node => node.kind === 'input' || node.kind === 'output';

function slantedSides(node, y) {
  const inset = node.size.width * FLOW_SLANT;
  const left = node.position.x + inset * (1 - (y - node.position.y) / node.size.height);
  return { left, right: left + node.size.width - inset };
}

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
  const items = [...(graph.groups ?? []), ...graph.nodes];
  const points = [...routes.values()].flatMap(route => [...route.points, { x: route.labelBox.x, y: route.labelBox.y }, { x: route.labelBox.x + route.labelBox.width, y: route.labelBox.y + route.labelBox.height }]);
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

function anchor(node, side, offset = 0) {
  const middle = center(node);
  if (isSlanted(node) && (side === 'left' || side === 'right')) {
    const y = middle.y + offset;
    return { x: slantedSides(node, y)[side], y };
  }
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

function waypointEndpoint(node, point, fallbackSide) {
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
  // ponytail: hinted diamonds use vertices; automatic fanout still uses rectangular side lanes.
  return { side, point: anchor(node, side, ['decision', 'choice'].includes(node.kind) ? 0 : offset) };
}

function routePointsWithWaypoints(start, end, sourceSide, targetSide, waypoints, stub = ENDPOINT_STUB) {
  const points = [start, outward(start, sourceSide, stub)];
  for (const waypoint of waypoints) appendOrthogonal(points, waypoint);
  appendOrthogonal(points, outward(end, targetSide, stub));
  points.push(end);
  return compact(points);
}

function routeBetween(source, target, sides, sourceOffset, targetOffset, stub = ENDPOINT_STUB) {
  const start = anchor(source, sides.sourceSide, sourceOffset);
  const end = anchor(target, sides.targetSide, targetOffset);
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

function routeSequenceEdge(edge, source, target, selfIndex, headerHeight) {
  const sourceX = center(source).x;
  const targetX = center(target).x;
  const y = Math.min(source.position.y, target.position.y) + headerHeight + 4 + edge.order * 54;
  const label = visibleEdgeLabel(edge, 'sequence');
  const available = source.id === target.id ? Infinity : Math.max(1, Math.abs(targetX - sourceX) - 32 - 12);
  const layout = layoutText(label, available);
  const labelSize = { width: Math.max(24, layout.width + 12), height: layout.height + 6 };
  if (source.id === target.id) {
    const extent = 48 + selfIndex * LANE_GAP;
    const start = { x: sourceX, y };
    const end = { x: sourceX, y: y + 30 };
    const points = edge.route?.via?.length
      ? routePointsWithWaypoints(start, end, 'right', 'right', edge.route.via)
      : [start, { x: sourceX + extent, y }, { x: sourceX + extent, y: y + 30 }, end];
    return { points, label, labelLines: layout.lines, labelSize, labelPoint: edge.route?.labelAt ?? { x: sourceX + extent + 8 + labelSize.width / 2, y: y + 15 }, sourceSide: 'right', targetSide: 'right' };
  }
  const points = edge.route?.via?.length
    ? routePointsWithWaypoints({ x: sourceX, y }, { x: targetX, y }, sourceX <= targetX ? 'right' : 'left', sourceX <= targetX ? 'left' : 'right', edge.route.via)
    : [{ x: sourceX, y }, { x: targetX, y }];
  return { points, label, labelLines: layout.lines, labelSize, labelPoint: edge.route?.labelAt ?? { x: (sourceX + targetX) / 2, y: y + 2 - labelSize.height / 2 }, sourceSide: sourceX <= targetX ? 'right' : 'left', targetSide: sourceX <= targetX ? 'left' : 'right' };
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
  const sequenceHeader = graph.nodes.some(node => node.kind === 'actor') ? TYPOGRAPHY.sequenceActorHeader : TYPOGRAPHY.sequenceHeader;
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
  const routes = new Map();
  for (const item of prepared) {
    let route;
    if (getDiagram(type).sequence) {
      const selfIndex = selfCounts.get(item.source.id) ?? 0;
      if (item.self) selfCounts.set(item.source.id, selfIndex + 1);
      route = routeSequenceEdge(item.edge, item.source, item.target, selfIndex, sequenceHeader);
    } else if (item.self) {
      const selfIndex = selfCounts.get(item.source.id) ?? 0;
      selfCounts.set(item.source.id, selfIndex + 1);
      const right = item.source.position.x + item.source.size.width;
      const middleY = center(item.source).y;
      const extent = 48 + selfIndex * LANE_GAP;
      const label = visibleEdgeLabel(item.edge, type);
      const labelSize = estimateLabelSize(label);
      const start = anchor(item.source, 'right', -16 - selfIndex * 12);
      const end = anchor(item.source, 'right', 16 + selfIndex * 12);
      route = {
        points: item.edge.route?.via?.length
          ? routePointsWithWaypoints(start, end, 'right', 'right', item.edge.route.via, stub)
          : [start, { x: right + extent, y: start.y }, { x: right + extent, y: end.y }, end],
        label,
        labelPoint: item.edge.route?.labelAt ?? { x: right + extent + 8 + labelSize.width / 2, y: middleY },
        sourceSide: 'right', targetSide: 'right'
      };
    } else {
      const waypoints = item.edge.route?.via;
      const sourceEndpoint = waypoints?.length && waypointEndpoint(item.source, waypoints[0], item.sourceSide);
      const targetEndpoint = waypoints?.length && waypointEndpoint(item.target, waypoints.at(-1), item.targetSide);
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
        : routeBetween(item.source, item.target, item, offsets.get(`${item.edge.id}:source`) ?? 0, offsets.get(`${item.edge.id}:target`) ?? 0, stub);
      const label = visibleEdgeLabel(item.edge, type);
      route = { points, label, labelPoint: item.edge.route?.labelAt ?? bestLabelPoint(points, estimateLabelSize(label), item.source, item.target), sourceSide, targetSide };
    }
    const labelSize = route.labelSize ?? estimateLabelSize(route.label);
    routes.set(item.edge.id, { ...route, labelLines: route.labelLines ?? layoutText(route.label, Infinity).lines, path: pathFromPoints(route.points), labelBox: { x: route.labelPoint.x - labelSize.width / 2, y: route.labelPoint.y - labelSize.height / 2, ...labelSize } });
  }
  return routes;
}

function boxesIntersect(a, b, margin = 0) {
  return a.x < b.x + b.width + margin
    && a.x + a.width > b.x - margin
    && a.y < b.y + b.height + margin
    && a.y + a.height > b.y - margin;
}

function occupiedBox(node, type) {
  if (!getDiagram(type).sequence) return { ...node.position, ...node.size };
  return { ...node.position, width: node.size.width, height: node.kind === 'actor' ? Math.min(node.size.height, TYPOGRAPHY.sequenceActorHeader) : Math.min(node.size.height, TYPOGRAPHY.sequenceHeader) };
}

function boxDistance(first, second) {
  const horizontal = Math.max(first.x - second.x - second.width, second.x - first.x - first.width, 0);
  const vertical = Math.max(first.y - second.y - second.height, second.y - first.y - first.height, 0);
  return Math.hypot(horizontal, vertical);
}

function pointOnNodeSide(point, node, side) {
  const { left, right } = isSlanted(node) ? slantedSides(node, point.y) : { left: node.position.x, right: node.position.x + node.size.width };
  const top = node.position.y;
  const bottom = top + node.size.height;
  if (side === 'left' || side === 'right') return Math.abs(point.x - (side === 'left' ? left : right)) < 1e-7 && point.y >= top && point.y <= bottom;
  return point.y === (side === 'top' ? top : bottom) && point.x >= left && point.x <= right;
}

function segmentCrossesBox(start, end, box) {
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

function segmentCrossesNode(start, end, node, type) {
  if (type !== 'flowchart' || !isSlanted(node)) return segmentCrossesBox(start, end, occupiedBox(node, type));
  const { x, y } = node.position;
  const { width, height } = node.size;
  if (start.y === end.y) {
    const { left, right } = slantedSides(node, start.y);
    return start.y > y && start.y < y + height
      && Math.max(Math.min(start.x, end.x), left) < Math.min(Math.max(start.x, end.x), right) - 1e-7;
  }
  if (start.x === end.x) {
    const inset = width * FLOW_SLANT;
    const top = Math.max(y, y + height * (x + inset - start.x) / inset);
    const bottom = Math.min(y + height, y + height * (x + width - start.x) / inset);
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

function segmentsCross(firstStart, firstEnd, secondStart, secondEnd) {
  const horizontal = firstStart.y === firstEnd.y;
  const otherHorizontal = secondStart.y === secondEnd.y;
  if (horizontal === otherHorizontal) return false;
  const [hStart, hEnd, vStart, vEnd] = horizontal
    ? [firstStart, firstEnd, secondStart, secondEnd]
    : [secondStart, secondEnd, firstStart, firstEnd];
  return vStart.x > Math.min(hStart.x, hEnd.x)
    && vStart.x < Math.max(hStart.x, hEnd.x)
    && hStart.y > Math.min(vStart.y, vEnd.y)
    && hStart.y < Math.max(vStart.y, vEnd.y);
}

export function auditGraphLayout(graph) {
  const type = graph.meta.diagramType ?? 'architecture';
  const routes = createEdgeRoutes(graph);
  const errors = [];
  const warnings = [];
  if (getDiagram(type).cardLayout) for (const node of graph.nodes) {
    if (node.size.height < 100) continue;
    const { minHeight } = cardTextLayout(node);
    if (node.size.height < minHeight) errors.push(`layout: node ${node.id} text needs at least ${minHeight}px height at 20/16px; enlarge the node and check its route clearance`);
  }
  for (let left = 0; left < graph.nodes.length; left += 1) {
    for (let right = left + 1; right < graph.nodes.length; right += 1) {
      const first = graph.nodes[left];
      const second = graph.nodes[right];
      const firstBox = occupiedBox(first, type);
      const secondBox = occupiedBox(second, type);
      if (boxesIntersect(firstBox, secondBox)) errors.push(`layout: nodes ${first.id} and ${second.id} overlap`);
      else {
        const distance = boxDistance(firstBox, secondBox);
        if (distance < 64) warnings.push(`nodes ${first.id} and ${second.id} are only ${Math.round(distance)}px apart`);
      }
    }
  }
  const labeledEdges = graph.edges.filter(edge => routes.get(edge.id).label);
  for (let left = 0; left < labeledEdges.length; left += 1) {
    for (let right = left + 1; right < labeledEdges.length; right += 1) {
      const first = labeledEdges[left];
      const second = labeledEdges[right];
      if (boxesIntersect(routes.get(first.id).labelBox, routes.get(second.id).labelBox)) errors.push(`layout: edge labels ${first.id} and ${second.id} overlap`);
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
      if (longest > ENDPOINT_STUB) errors.push(`layout: edges ${first.id} and ${second.id} share a route segment longer than ${ENDPOINT_STUB}px`);
      if (first.source !== second.source && first.source !== second.target && first.target !== second.source && first.target !== second.target) {
        const crossing = firstPoints.slice(1).some((point, firstIndex) => secondPoints.slice(1).some((otherPoint, secondIndex) => segmentsCross(firstPoints[firstIndex], point, secondPoints[secondIndex], otherPoint)));
        if (crossing) warnings.push(`edges ${first.id} and ${second.id} cross`);
      }
    }
  }
  for (const edge of graph.edges) {
    const route = routes.get(edge.id);
    const source = graph.nodes.find(node => node.id === edge.source);
    const target = graph.nodes.find(node => node.id === edge.target);
    if (!getDiagram(type).sequence && (!pointOnNodeSide(route.points[0], source, route.sourceSide) || !pointOnNodeSide(route.points.at(-1), target, route.targetSide))) {
      errors.push(`layout: edge ${edge.id} exceeds an endpoint side; enlarge the node or add route hints`);
    }
    if (getDiagram(type).cardinalities) {
      for (const [role, point, neighbor, side, cardinality, hint] of [
        ['source', route.points[0], route.points[1], route.sourceSide, edge.sourceCardinality, edge.route?.via?.[0]],
        ['target', route.points.at(-1), route.points.at(-2), route.targetSide, edge.targetCardinality, edge.route?.via?.at(-1)]
      ]) {
        const direction = outward(point, side, 1);
        const projection = other => (other.x - point.x) * (direction.x - point.x) + (other.y - point.y) * (direction.y - point.y);
        if (projection(neighbor) < ER_ENDPOINT_STUB || (hint && projection(hint) < ER_ENDPOINT_STUB)) {
          errors.push(`layout: ER edge ${edge.id} ${role} needs a ${ER_ENDPOINT_STUB}px outward straight segment; move the route hint or enlarge the gap`);
        }
        const mark = cardinalityMarks(cardinality, point, neighbor);
        for (const node of graph.nodes) {
          if (mark.bounds && boxesIntersect(mark.bounds, { ...node.position, ...node.size })) errors.push(`layout: ER edge ${edge.id} ${role} cardinality overlaps node ${node.id}`);
        }
      }
      if (route.points.slice(1, -1).some((point, index) => {
        const before = route.points[index];
        const after = route.points[index + 2];
        return before.x === point.x && point.x === after.x && (point.y - before.y) * (after.y - point.y) < 0
          || before.y === point.y && point.y === after.y && (point.x - before.x) * (after.x - point.x) < 0;
      })) errors.push(`layout: ER edge ${edge.id} reverses within its route; reserve ${ER_ENDPOINT_STUB}px endpoint segments or move the route hints`);
    }
    if (getDiagram(type).sequence && edge.source !== edge.target) {
      const available = Math.abs(center(source).x - center(target).x);
      const required = Math.max(160, route.labelBox.width + 32);
      if (available < required) errors.push(`layout: sequence edge ${edge.id} needs ${Math.ceil(required)}px between participants; found ${Math.round(available)}px`);
      if (route.labelBox.height > 54) errors.push(`layout: sequence edge ${edge.id} wrapped label needs ${route.labelBox.height}px height; enlarge participant spacing to fit the 54px message pitch`);
    }
    for (const node of graph.nodes) {
      for (let index = 1; index < route.points.length; index += 1) {
        if (segmentCrossesNode(route.points[index - 1], route.points[index], node, type)) {
          const kind = edge.source === edge.target && node.id === edge.source ? 'self-loop' : 'edge';
          errors.push(`layout: ${kind} ${edge.id} crosses node ${node.id}`);
          break;
        }
      }
    }
    if (!route.label) continue;
    for (const group of graph.groups ?? []) {
      const heading = { ...group.position, width: group.size.width, height: Math.min(36, group.size.height) };
      if (boxesIntersect(route.labelBox, heading)) errors.push(`layout: edge ${edge.id} label overlaps group ${group.id} heading`);
      const borders = groupBorders(group);
      if (borders.some(([start, end]) => segmentCrossesBox(start, end, route.labelBox))) errors.push(`layout: edge ${edge.id} label overlaps group ${group.id} boundary`);
    }
    for (const node of graph.nodes) {
      const nodeBox = occupiedBox(node, type);
      if (boxesIntersect(route.labelBox, nodeBox)) {
        errors.push(`layout: edge ${edge.id} label overlaps node ${node.id}`);
      } else if (boxDistance(route.labelBox, nodeBox) < 12) {
        warnings.push(`edge ${edge.id} label has less than 12px clearance from node ${node.id}`);
      }
    }
  }
  for (const edge of graph.edges) {
    const route = routes.get(edge.id);
    for (const group of graph.groups ?? []) {
      const heading = { ...group.position, width: group.size.width, height: Math.min(36, group.size.height) };
      const borders = groupBorders(group);
      for (let index = 1; index < route.points.length; index += 1) {
        const start = route.points[index - 1];
        const end = route.points[index];
        if (segmentCrossesBox(start, end, heading)) errors.push(`layout: edge ${edge.id} crosses group ${group.id} heading`);
        if (borders.some(([borderStart, borderEnd]) => sharedSegmentLength(start, end, borderStart, borderEnd) > ENDPOINT_STUB)) errors.push(`layout: edge ${edge.id} overlaps group ${group.id} boundary`);
      }
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], routes };
}
