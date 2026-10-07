import { layoutWeights } from './layout-policy.js';
import { clearanceProbe, clearanceLimits } from './route-clearance.js';
import { diagramTypeOf, getDiagram } from './diagrams/registry.js';
import { createEdgeRoutes, nodeAnchor, occupiedBox, routingBounds, segmentCrossesNode, segmentCrossesBox, groupHeadingBoxes, groupBorders, sharedSegmentLength, visibleEdgeLabel, routeCrossings } from './edge-routing.js';
import { overviewSections, sectionTextBoxes } from './architecture-overview.js';
import { isArchitectureOverview } from './view-identity.js';
import { estimateLabelSize } from './text-layout.js';
import { layoutLimits } from './layout-spacing.js';

export const ROUTING_BUDGET = 60000;
const sides = ['top', 'right', 'bottom', 'left'];
const vector = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const box = item => ({ ...item.position, ...item.size });
const labelBorderBoxes = graph => (graph.groups ?? []).flatMap(group => {
  const r = box(group);
  return [{ x: r.x, y: r.y, width: r.width, height: 1 }, { x: r.x, y: r.y + r.height, width: r.width, height: 1 },
    { x: r.x, y: r.y, width: 1, height: r.height }, { x: r.x + r.width, y: r.y, width: 1, height: r.height }];
});
const expand = (r, p) => ({ x: r.x - p, y: r.y - p, width: r.width + p * 2, height: r.height + p * 2 });
const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const parts = points => points.slice(1).map((b, i) => [points[i], b]);
const key = p => p.x + ',' + p.y;
const stable = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

// Same evaluation order in Node and the browser; no wall-clock scoring.
class Heap {
  items = [];
  less(a, b) { return a.priority < b.priority || a.priority === b.priority && a.serial < b.serial; }
  push(value) { const a = this.items; a.push(value); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (!this.less(a[i], a[p])) break; [a[i], a[p]] = [a[p], a[i]]; i = p; } }
  pop() { const a = this.items, first = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let j = i, l = i * 2 + 1; for (const n of [l, l + 1]) if (n < a.length && this.less(a[n], a[j])) j = n; if (j === i) break; [a[i], a[j]] = [a[j], a[i]]; i = j; } } return first; }
}

export function simplifyPath(points) {
  const result = [];
  for (const p of points) if (!result.length || distance(p, result.at(-1))) result.push(p);
  for (let i = 1; i < result.length - 1;) {
    const [a, b, c] = result.slice(i - 1, i + 2);
    if ((a.x === b.x && b.x === c.x && (b.y - a.y) * (c.y - b.y) >= 0) || (a.y === b.y && b.y === c.y && (b.x - a.x) * (c.x - b.x) >= 0)) result.splice(i, 1);
    else i++;
  }
  return result;
}

// Replace stair steps/backtracks only when the whole replacement passes the caller's endpoint,
// label, obstacle and other-route checks. The bounded search also handles equal-endpoint Z detours.
export function simplifyCorridor(points, score, budget = 32) {
  let best = simplifyPath(points), cost = score(best), evaluations = 0;
  let improved = true;
  while (improved && evaluations < budget) {
    improved = false;
    search: for (let i = 1; i < best.length - 2; i++) for (let j = best.length - 2; j > i + 1; j--) {
      const a = best[i], b = best[j];
      for (const via of [[{x:b.x,y:a.y}], [{x:a.x,y:b.y}]]) {
        if (evaluations++ >= budget) break search;
        const candidate = simplifyPath([...best.slice(0,i+1), ...via, ...best.slice(j)]), next = score(candidate);
        if (next < cost - .001) { best = candidate; cost = next; improved = true; break search; }
      }
    }
  }
  return best;
}

export function routingLimits(graph) {
  const limits = { ...layoutLimits(getDiagram(diagramTypeOf(graph))), preferredClearance: clearanceLimits(graph).preferred };
  const unit = Math.sqrt(graph.nodes.reduce((sum, n) => { const r=occupiedBox(n,diagramTypeOf(graph)); return sum+r.width*r.height; }, 0) / Math.max(1, graph.nodes.length));
  const crossingCost = layoutWeights.crossings * unit, bendCost = layoutWeights.bends * unit;
  return isArchitectureOverview(graph) ? { ...limits, labelGap: 6, parallelGap: 8, nodeGap: 14, crossingCost, bendCost } : { ...limits, crossingCost, bendCost };
}

function ports(node, other, side, type, limits, graph, edge) {
  const horizontal = side === 'top' || side === 'bottom';
  const axis = horizontal ? 'x' : 'y', extent = horizontal ? 'width' : 'height', outline = routingBounds(node, type);
  const nodeMiddle = node.position[axis] + node.size[extent] / 2, middle = outline[axis] + outline[extent] / 2;
  const limit = Math.max(0, outline[extent] / 2 - 20);
  const projected = other.position[horizontal ? 'x' : 'y'] + other.size[horizontal ? 'width' : 'height'] / 2 - middle;
  const peers = graph.edges.filter(e => e.source === node.id || e.target === node.id).map(e => { const target=graph.nodes.find(n=>n.id===(e.source===node.id?e.target:e.source)); return {edge:e, target}; }).filter(p=>p.target.id!==node.id);
  peers.sort((a,b)=>a.target.position[axis]+a.target.size[extent]/2-b.target.position[axis]-b.target.size[extent]/2||stable(a.edge,b.edge));
  const ordinal=peers.findIndex(p=>p.edge.id===edge?.id), allocated=ordinal<0?0:(ordinal-(peers.length-1)/2)*limits.parallelGap;
  const offsets = ['decision', 'choice'].includes(node.kind) ? [0] : [allocated, Math.max(-limit, Math.min(limit, projected)), 0, -limits.parallelGap, limits.parallelGap, -limit * .6, limit * .6];
  return [...new Set(offsets.map(o => Math.max(-limit, Math.min(limit, o))))].map(offset => {
    return portAt(node,side,offset + middle - nodeMiddle,type,limits);
  });
}

function portAt(node,side,offset,type,limits) {
    const point = nodeAnchor(node, side, offset, type), [dx, dy] = vector[side], r = box(node);
    // Get outside the whole text box, even for a cylinder, actor or inset symbol.
    const reach = type === 'usecase' && node.kind === 'actor' ? limits.endpoint : Math.max(getDiagram(type).endpointStub ?? limits.endpoint, side === 'left' ? point.x - r.x + 1 : side === 'right' ? r.x + r.width - point.x + 1 : side === 'top' ? point.y - r.y + 1 : r.y + r.height - point.y + 1);
    return { point, side, stub: { x: point.x + dx * reach, y: point.y + dy * reach } };
}

// Rank the actual outlines, rather than the centres of bounding rectangles.
export function nearestPortPairs(source, target, graph, sourceSide = null, edge = null) {
  const type = diagramTypeOf(graph), limits = routingLimits(graph);
  const pairs = [];
  for (const a of sourceSide ? [sourceSide] : sides) for (const b of sides) {
    const starts = ports(source, target, a, type, limits, graph, edge), ends = ports(target, source, b, type, limits, graph, edge);
    // Project actual outline ports onto the facing outline, including inset symbols and actor arms.
    // Centre projections alone can leave a one-unit stair even though a straight connection exists.
    if ((a==='left'||a==='right') === (b==='left'||b==='right')) {
      const axis=a==='left'||a==='right'?'y':'x',extent=axis==='x'?'width':'height';
      const align=(node,side,ports,opposite)=>{
        const bounds=routingBounds(node,type),middle=node.position[axis]+node.size[extent]/2;
        for(const peer of opposite.slice(0,3)) {
          const coordinate=peer.point[axis];if(coordinate<bounds[axis]+20||coordinate>bounds[axis]+bounds[extent]-20)continue;
          const port=portAt(node,side,coordinate-middle,type,limits);
          if(!ports.some(p=>distance(p.point,port.point)<.001))ports.push(port);
        }
      };
      const originals=[...starts];align(source,a,starts,ends);align(target,b,ends,originals);
    }
    const nearest = Math.min(...starts.flatMap(s => ends.map(t => distance(s.point, t.point))));
    const sameAxis = (a==='left'||a==='right') === (b==='left'||b==='right');
    const direct = sameAxis && a !== b && starts.some(s=>ends.some(t=>(s.point.x===t.point.x||s.point.y===t.point.y) && (t.point.x-s.point.x)*vector[a][0]+(t.point.y-s.point.y)*vector[a][1]>0));
    const minimumBends = direct ? 0 : sameAxis ? 2 : 1;
    pairs.push({ sourceSide: a, targetSide: b, starts, ends, nearest, minimumBends, sourceId: source.id, targetId: target.id });
  }
  return pairs.sort((a, b) => a.nearest+a.minimumBends*limits.bendCost-b.nearest-b.minimumBends*limits.bendCost || a.nearest - b.nearest || sides.indexOf(a.sourceSide) - sides.indexOf(b.sourceSide) || sides.indexOf(a.targetSide) - sides.indexOf(b.targetSide));
}

function lineConflict(a, b, c, d, gap) {
  const h = a.y === b.y, k = c.y === d.y;
  if (h === k) {
    const axis = h ? 'x' : 'y', across = h ? 'y' : 'x';
    return Math.abs(a[across] - c[across]) + .001 < gap && Math.min(Math.max(a[axis], b[axis]), Math.max(c[axis], d[axis])) - Math.max(Math.min(a[axis], b[axis]), Math.min(c[axis], d[axis])) > .001 ? Infinity : 0;
  }
  const [left, right, top, bottom] = h ? [a, b, c, d] : [c, d, a, b];
  return top.x >= Math.min(left.x, right.x) && top.x <= Math.max(left.x, right.x) && left.y >= Math.min(top.y, bottom.y) && left.y <= Math.max(top.y, bottom.y) ? 1 : 0;
}

// Use the audit's unique intersection points, including intersections at bends. Coincident
// terminal anchors are the only shared points exempted from the crossing score.
function pathCrossings(a, b) {
  const edge = points => ({ source: key(points[0]), target: key(points.at(-1)) });
  return routeCrossings(edge(a), a, edge(b), b).length;
}

// segmentCrossesNode rebuilds a node's outline on every call, yet most grid segments miss its band outright. The same
// band test runs first; nodes with an extra text area (state symbols) always take the full check.
function nodeProbe(graph, type) {
  const entries = graph.nodes.map(node => ({ node, r: routingBounds(node, type), always: type === 'usecase' && node.kind === 'actor' || type === 'state' && ['initial', 'final'].includes(node.kind) && node.subtitle }));
  return (a, b) => entries.some(({ node, r, always }) => {
    if (!always && (a.y === b.y ? a.y <= r.y || a.y >= r.y + r.height : a.x === b.x && (a.x <= r.x || a.x >= r.x + r.width))) return false;
    return segmentCrossesNode(a, b, node, type);
  });
}

// Adds a segment's crossings × crossingCost to `cost`, or returns Infinity on a shared lane. Segments farther than the
// lane gap from a route's bounds cannot conflict, so only near ones reach lineConflict; the sum keeps its order.
export function priorCost(previous, limits) {
  const gap = limits.parallelGap, entries = previous.flatMap((points, index) => parts(points).map(([c, d]) => ({ index, c, d, l: Math.min(c.x, d.x) - gap, r: Math.max(c.x, d.x) + gap, t: Math.min(c.y, d.y) - gap, b: Math.max(c.y, d.y) + gap })));
  return (a, b, cost, countCrossings = true) => {
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    const crossings = new Map();
    for (const { index, c, d, l, r, t, b: bottom } of entries) {
      if (x1 < l || x0 > r || y1 < t || y0 > bottom) continue;
      const conflict = lineConflict(a, b, c, d, gap);
      if (conflict === Infinity) {
        const shared = sharedSegmentLength(a, b, c, d);
        const commonTerminal = previous.some(points => [points[0], points.at(-1)].some(point => (point.x === a.x && point.y === a.y || point.x === b.x && point.y === b.y) && (point.x === c.x && point.y === c.y || point.x === d.x && point.y === d.y)));
        if (shared > 0 && shared <= limits.endpoint + .001 && commonTerminal) continue;
        return Infinity;
      }
      if (countCrossings && conflict) {
        const point = a.y === b.y ? { x: c.x, y: a.y } : { x: a.x, y: c.y };
        const endpoint = distance(point,a)<.001 || distance(point,b)<.001;
        if (endpoint && [previous[index][0],previous[index].at(-1)].some(p=>distance(p,point)<.001)) continue;
        // Adjacent grid steps share half of a vertex intersection; bends in the prior path
        // contribute only once. This is a lower bound on the final unique-crossing score.
        crossings.set(index+':'+key(point), endpoint ? .5 : 1);
      }
    }
    return cost + [...crossings.values()].reduce((sum,value)=>sum+value,0) * limits.crossingCost;
  };
}

function corridor(pair, graph, obstacles, previous, limits, budget, label, ceiling = Infinity) {
  const starts = pair.starts, ends = pair.ends, type = diagramTypeOf(graph), labelSize = estimateLabelSize(label);
  const labelNodes = graph.nodes.map(n => occupiedBox(n, type)), labelLines = previous.flatMap(parts);
  const labelObstacles = [...obstacles, ...labelBorderBoxes(graph)];
  const borders = (graph.groups ?? []).flatMap(groupBorders), crossesNode = nodeProbe(graph, type), conflictWith = priorCost(previous, limits);
  const lacksClearance = clearanceProbe(graph, pair.sourceId, pair.targetId, starts.map(p=>p.point), ends.map(p=>p.point));
  const overlapsBoundary = (a, b) => lacksClearance(a,b) || borders.some(([c, d]) => sharedSegmentLength(a, b, c, d) > limits.endpoint);
  // Crossing costs only add, so a path whose length and bends already reach `ceiling` cannot win and is not checked.
  const clearCost = (points, ceiling = Infinity) => {
    if (points.length < 2 || points.some(p => p.x < 0 || p.y < 0)) return Infinity;
    const first = points[0], second = points[1], last = points.at(-1), penultimate = points.at(-2);
    const outward = (a,b,side) => (b.x-a.x)*vector[side][0]+(b.y-a.y)*vector[side][1] > 0;
    if (!outward(first,second,pair.sourceSide) || !outward(last,penultimate,pair.targetSide)) return Infinity;
    if (points.length > 2 && (distance(first,second) < limits.endpoint || distance(last,penultimate) < limits.endpoint)) return Infinity;
    let cost = parts(points).reduce((sum, [a, b]) => sum + distance(a, b), 0) + Math.max(0, points.length - 2) * limits.bendCost;
    if (cost >= ceiling) return Infinity;
    for (const [a, b] of parts(points)) {
      if (crossesNode(a, b) || obstacles.some(r => segmentCrossesBox(a, b, r)) || overlapsBoundary(a, b)) return Infinity;
      cost = conflictWith(a, b, cost, false);
      if (cost === Infinity) return Infinity;
    }
    cost += previous.reduce((sum, prior) => sum + pathCrossings(points, prior), 0) * limits.crossingCost;
    if (label && !inlineLabelCandidates(points, labelSize, labelNodes, labelObstacles, labelLines, limits).length) return Infinity;
    return cost;
  };
  const extent = [...graph.nodes.map(n => occupiedBox(n, type)), ...(graph.groups ?? []).map(box), ...obstacles, ...previous.flat().map(p => ({ ...p, width: 0, height: 0 }))];
  const xGap = Math.max(limits.preferredClearance, labelSize.width / 2 + limits.labelGap + 4), yGap = Math.max(limits.preferredClearance, labelSize.height / 2 + limits.labelGap + 4);
  const left = Math.min(...extent.map(r => r.x)) - xGap, right = Math.max(...extent.map(r => r.x + r.width)) + xGap;
  const top = Math.min(...extent.map(r => r.y)) - yGap, bottom = Math.max(...extent.map(r => r.y + r.height)) + yGap;
  let fast;
  for (const start of starts) for (const end of ends) {
    const a = start.stub, b = end.stub;
    const candidates = [
      [a, { x: b.x, y: a.y }, b], [a, { x: a.x, y: b.y }, b],
      [a, { x: (a.x + b.x) / 2, y: a.y }, { x: (a.x + b.x) / 2, y: b.y }, b],
      [a, { x: a.x, y: (a.y + b.y) / 2 }, { x: b.x, y: (a.y + b.y) / 2 }, b],
      ...[left, right].map(x => [a, { x, y: a.y }, { x, y: b.y }, b]),
      ...[top, bottom].map(y => [a, { x: a.x, y }, { x: b.x, y }, b])
    ];
    if ((start.point.x === end.point.x || start.point.y === end.point.y) && distance(start.point, end.point) >= (getDiagram(type).endpointStub ?? limits.endpoint)) {
      const middle = { x: (start.point.x + end.point.x) / 2, y: (start.point.y + end.point.y) / 2 };
      // Collinear facing anchors need no overlapping stubs in a narrow grid gap.
      if (vector[start.side][0] * (end.point.x - start.point.x) + vector[start.side][1] * (end.point.y - start.point.y) > 0
        && vector[end.side][0] * (start.point.x - end.point.x) + vector[end.side][1] * (start.point.y - end.point.y) > 0) candidates.push([middle]);
    }
    for (const via of candidates) {
      const points = simplifyPath([start.point, ...via, end.point]), cost = clearCost(points, Math.min(ceiling, fast?.cost ?? Infinity));
      if (Number.isFinite(cost) && (!fast || cost < fast.cost)) fast = { cost, points, via: simplifyPath(via), sourceSide: start.side, targetSide: end.side };
    }
  }
  // Clear short corridors need no visibility-grid search. Crossed or blocked corridors still search alternatives.
  if (fast && fast.cost <= pair.nearest + pair.minimumBends * limits.bendCost + .001) return fast;
  if (budget.remaining <= 0) return fast ?? null;
  const boxes = graph.nodes.map(n => occupiedBox(n, type));
  const xs = new Set([...starts, ...ends].map(p => p.stub.x)), ys = new Set([...starts, ...ends].map(p => p.stub.y));
  for (const r of [...boxes, ...obstacles, ...previous.flatMap(p => parts(p).map(([a, b]) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) })))]) {
    xs.add(r.x - limits.preferredClearance); xs.add(r.x + r.width + limits.preferredClearance);
    ys.add(r.y - limits.preferredClearance); ys.add(r.y + r.height + limits.preferredClearance);
  }
  const xValues = [...xs].sort((a, b) => a - b), yValues = [...ys].sort((a, b) => a - b), nx = xValues.length;
  const position = id => ({ x: xValues[id % nx], y: yValues[Math.floor(id / nx)] });
  const pointId = p => yValues.indexOf(p.y) * nx + xValues.indexOf(p.x);
  const cache = new Map();
  const segmentCost = (a, b) => {
    const ka = key(a), kb = key(b), k = ka < kb ? ka + ':' + kb : kb + ':' + ka;
    if (cache.has(k)) return cache.get(k);
    let cost = Infinity;
    if (!crossesNode(a, b) && !obstacles.some(r => segmentCrossesBox(a, b, r)) && !overlapsBoundary(a, b)) cost = conflictWith(a, b, distance(a, b));
    cache.set(k, cost); return cost;
  };
  const heuristic = p => Math.min(...ends.map(end => distance(p, end.stub)));
  const heap = new Heap(), visited = new Map(), endMap = new Map(); let serial = 0;
  for (const end of ends) { const id = pointId(end.stub); if (!endMap.has(id)) endMap.set(id, []); endMap.get(id).push(end); }
  for (const start of starts) {
    if (obstacles.some(r => segmentCrossesBox(start.point, start.stub, r)) || !Number.isFinite(segmentCost(start.point, start.stub))) continue;
    const id = pointId(start.stub), direction = ['left', 'right'].includes(start.side) ? 0 : 1;
    const cost = distance(start.point, start.stub);
    const item = { id, direction, cost, priority: cost + heuristic(start.stub), start, serial: serial++ };
    const k = id * 2 + direction;
    if (!visited.has(k) || visited.get(k).cost > item.cost) { visited.set(k, item); heap.push(item); }
  }
  let localVisits = 0;
  while (heap.items.length && budget.remaining > 0 && localVisits++ < 4000) {
    budget.remaining--;
    const here = heap.pop(); if (visited.get(here.id * 2 + here.direction) !== here) continue;
    if (here.priority >= Math.min(ceiling, fast?.cost ?? Infinity)) break;
    const p = position(here.id);
    for (const end of endMap.get(here.id) ?? []) {
      if (!Number.isFinite(segmentCost(end.stub, end.point))) continue;
      const path = []; for (let h = here; h; h = h.before) path.push(position(h.id)); path.reverse();
      const complete = simplifyCorridor([here.start.point, ...path, end.point], clearCost);
      if (label && !inlineLabelCandidates(complete, labelSize, labelNodes, labelObstacles, labelLines, limits).length) continue;
      const cost = clearCost(complete);
      if (!Number.isFinite(cost)) continue;
      if (fast && fast.cost <= cost) return fast;
      return { points: complete, via: complete.length > 2 ? complete.slice(1,-1) : [here.start.stub, end.stub], sourceSide: here.start.side, targetSide: end.side, cost };
    }
    const x = here.id % nx, y = Math.floor(here.id / nx);
    for (const [xx, yy] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (xx < 0 || yy < 0 || xx >= nx || yy >= yValues.length) continue;
      const id = yy * nx + xx, q = position(id), step = segmentCost(p, q);
      if (!Number.isFinite(step)) continue;
      const direction = x === xx ? 1 : 0, cost = here.cost + step + (direction === here.direction ? 0 : limits.bendCost), k = id * 2 + direction;
      if (visited.has(k) && visited.get(k).cost <= cost) continue;
      const item = { id, direction, cost, priority: cost + heuristic(q), before: here, start: here.start, serial: serial++ }; visited.set(k, item); heap.push(item);
    }
  }
  return fast ?? null;
}

// Search only along an edge's own straight segments, with complete text and endpoint clearance.
function inlineLabelCandidates(points, size, nodeBoxes, textObstacles, otherParts, limits) {
  const candidates = [];
  for (const [index, [a, b]] of parts(points).entries()) {
    const horizontal = a.y === b.y, axis = horizontal ? 'x' : 'y', extent = horizontal ? 'width' : 'height';
    const half = size[extent] / 2, lower = Math.min(a[axis], b[axis]) + half + 4, upper = Math.max(a[axis], b[axis]) - half - 4;
    if (lower > upper) continue;
    const middle = (a[axis] + b[axis]) / 2;
    const positions = [...new Set([middle, lower, upper, ...[...nodeBoxes, ...textObstacles].flatMap(r => [
      r[axis] - half - limits.labelGap - .01, r[axis] + r[extent] + half + limits.labelGap + .01
    ]), ...otherParts.flatMap(([c, d]) => [
      Math.min(c[axis], d[axis]) - half - limits.labelEdgeGap - .01,
      Math.max(c[axis], d[axis]) + half + limits.labelEdgeGap + .01
    ])])].filter(value => value >= lower && value <= upper);
    for (const value of positions) {
      const point = { ...a, [axis]: value };
      if (point.x < 0 || point.y < 0) continue;
      const r = { x: point.x - size.width / 2, y: point.y - size.height / 2, ...size };
      if ([...nodeBoxes, ...textObstacles].some(o => overlap(r, expand(o, limits.labelGap)))) continue;
      if (otherParts.some(([c, d]) => segmentCrossesBox(c, d, expand(r, limits.labelEdgeGap)))) continue;
      if ([points[0], points.at(-1)].some(tip => overlap(r, { x: tip.x - 12, y: tip.y - 12, width: 24, height: 24 }))) continue;
      candidates.push({ point, r, score: Math.abs(value - middle) + index * .001 });
    }
  }
  return candidates.sort((a, b) => a.score - b.score);
}

export function placeEdgeLabels(graph, edgeIds = null) {
  const type = diagramTypeOf(graph), limits = routingLimits(graph), routes = createEdgeRoutes(graph);
  const labels = edgeIds ? [...routes].filter(([id]) => !edgeIds.has(id)).flatMap(([, r]) => r.label ? [r.labelBox] : []) : [];
  const borders = labelBorderBoxes(graph);
  const headings = [...borders, ...(graph.groups ?? []).flatMap(groupHeadingBoxes), ...overviewSections(graph).flatMap(sectionTextBoxes)];
  const nodeBoxes = graph.nodes.map(n => occupiedBox(n, type));
  for (const edge of [...graph.edges].filter(e => !edgeIds || edgeIds.has(e.id)).sort(stable)) {
    const route = routes.get(edge.id); if (!route.label) continue;
    const otherParts = [...routes].filter(([id]) => id !== edge.id).flatMap(([, other]) => parts(other.points));
    const best = inlineLabelCandidates(route.points, estimateLabelSize(route.label), nodeBoxes, [...headings, ...labels], otherParts, limits)[0];
    if (!best) throw Object.assign(new Error('No clear label position for ' + edge.id), { elementIds: [edge.id, edge.source, edge.target], routingReason: 'label-space' });
    edge.route = { ...edge.route, labelAt: best.point }; labels.push(best.r);
  }
  return graph;
}

function selfCorridor(node, graph, obstacles, previous, limits, ordinal, edge, sideOffset = 0) {
  const type = diagramTypeOf(graph), label = estimateLabelSize(visibleEdgeLabel(edge, type, graph.meta.locale));
  for (const [sideIndex, side] of ['right', 'bottom', 'left', 'top'].entries()) {
    if (sideIndex < sideOffset) continue;
    const horizontal = ['left', 'right'].includes(side), span = horizontal ? node.size.height : node.size.width;
    const offset = Math.min(span / 2 - 12, Math.max(24, (horizontal ? label.height : label.width) / 2 + 8));
    const a = nodeAnchor(node, side, -offset, type), b = nodeAnchor(node, side, offset, type), [dx, dy] = vector[side];
    const reach = Math.max(48, (horizontal ? label.width : label.height) / 2 + limits.labelGap + 8) + ordinal * limits.parallelGap;
    const points = [a, { x: a.x + dx * reach, y: a.y + dy * reach }, { x: b.x + dx * reach, y: b.y + dy * reach }, b];
    const lacksClearance = clearanceProbe(graph,node.id,node.id,[a],[b]);
    if (parts(points).some(([c, d]) => lacksClearance(c,d) || graph.nodes.some(n => n.id !== node.id && segmentCrossesNode(c, d, n, type)) || obstacles.some(r => segmentCrossesBox(c, d, r)) || previous.flatMap(parts).some(([e, f]) => lineConflict(c, d, e, f, limits.parallelGap) === Infinity))) continue;
    return { via: points.slice(1, -1), sideIndex };
  }
  return null;
}

function routingCost(graph) {
  const limits = routingLimits(graph);
  const routes = [...createEdgeRoutes(graph).values()], length = routes.reduce((sum, r) => sum + parts(r.points).reduce((s, [a, b]) => s + distance(a, b), 0), 0);
  let crossings = 0;
  for (let i = 0; i < routes.length; i++) for (const other of routes.slice(i + 1)) crossings += pathCrossings(routes[i].points, other.points);
  return length + routes.reduce((sum, r) => sum + Math.max(0, r.points.length - 2) * limits.bendCost, 0) + crossings * limits.crossingCost;
}

export function routeOrthogonal(input, { passes = 3, accept = null, edgeIds = null, searchBudget = null } = {}) {
  const type = diagramTypeOf(input);
  // Sequence messages have fixed time/order, activation endpoints and fragment scopes.
  if (getDiagram(type).sequence) {
    const graph = structuredClone(input), routes = createEdgeRoutes(graph), heads = graph.nodes.map(n => occupiedBox(n, type));
    const firstLabel = Math.min(Infinity, ...[...routes.values()].filter(r => r.label).map(r => r.labelBox.y));
    const shift = Math.max(0, Math.max(...heads.map(r => r.y + r.height)) + layoutLimits(getDiagram(type)).labelGap - firstLabel);
    if (shift) {
      for (const edge of graph.edges) {
        edge.route = { ...edge.route, messageY: routes.get(edge.id).points[0].y + shift };
        if (edge.route.via) edge.route.via = edge.route.via.map(p => ({ ...p, y: p.y + shift }));
        if (edge.route.labelAt) edge.route.labelAt = { ...edge.route.labelAt, y: edge.route.labelAt.y + shift };
      }
      for (const group of graph.groups ?? []) group.position.y += shift;
      for (const node of graph.nodes) node.size.height += shift;
    }
    if (accept) accept(graph);
    return { graph, report: { strategy: 'sequence-span-constraints', evaluations: 1, headerClearanceShift: shift, termination: 'notation-specific' } };
  }
  const limits = routingLimits(input), initial = createEdgeRoutes(input);
  const frozen = edgeIds ? [...initial].filter(([id]) => !edgeIds.has(id)).map(([, r]) => r) : [];
  const headings = [...frozen.filter(r => r.label).map(r => expand(r.labelBox, limits.labelEdgeGap)), ...(input.groups ?? []).flatMap(groupHeadingBoxes), ...overviewSections(input).flatMap(sectionTextBoxes)].map(r => expand(r, 8));
  const primary = input.layout?.primaryPath ?? [];
  const span = edge => {
    const a = input.nodes.find(n => n.id === edge.source), b = input.nodes.find(n => n.id === edge.target);
    return Math.abs(a.position.x + a.size.width / 2 - b.position.x - b.size.width / 2) + Math.abs(a.position.y + a.size.height / 2 - b.position.y - b.size.height / 2);
  };
  const ordered = [...input.edges].filter(e => !edgeIds || edgeIds.has(e.id)).sort((a, b) => {
    const main = e => primary.some((id, i) => id === e.source && primary[i + 1] === e.target);
    const constrained = e => ['decision', 'choice'].includes(input.nodes.find(n => n.id === e.source)?.kind);
    return Number(main(b)) - Number(main(a)) || Number(constrained(b)) - Number(constrained(a)) || span(a) - span(b) || stable(a, b);
  });
  let best, last; const attempts = [];
  const budgetLimit = ROUTING_BUDGET * Math.min(4, Math.max(1, Math.ceil(ordered.length / 16)));
  // An already legal route is also a candidate. This prevents a greedy retry from losing a
  // narrow but valid labelled corridor and gives the final pass a stable starting geometry.
  if (accept) try {
    accept(input, { strictEdgeIds: new Set(ordered.map(edge => edge.id)) });
    best = { graph: structuredClone(input), cost: routingCost(input), pass: 'preserved' };
  } catch { /* Search must repair the invalid input. */ }
  for (let pass = 0; pass < passes; pass++) {
    const pairOffsets = new Map(), budget = searchBudget ?? { remaining: budgetLimit };
    // Revisit ports against all other completed paths, not just the earlier greedy paths.
    // This uses the third pass's existing grid budget and one stable sweep, never extra retries.
    if (pass === 2 && best) {
      const routes = createEdgeRoutes(best.graph), complexity = edge => {
        const route = routes.get(edge.id);
        const crossings = [...routes].filter(([id]) => id !== edge.id).reduce((sum, [,other]) => sum + pathCrossings(route.points, other.points), 0);
        return crossings * layoutWeights.crossings + Math.max(0, route.points.length - 2) * layoutWeights.bends;
      };
      const revisit = [...ordered].sort((a,b) => complexity(b) - complexity(a) || stable(a,b));
      for (const [index, edge] of revisit.entries()) {
        if (budget.remaining <= 0) break;
        const quota = Math.ceil(budget.remaining / (revisit.length - index)), edgeBudget = { remaining: quota };
        try {
          const result = routeOrthogonal(best.graph, { passes: 1, accept, edgeIds: new Set([edge.id]), searchBudget: edgeBudget });
          const cost = routingCost(result.graph);
          attempts.push({ pass, edgeId: edge.id, cost, visited: quota - edgeBudget.remaining });
          if (cost < best.cost - .001) best = { graph: result.graph, cost, pass };
        } catch (error) { attempts.push({ pass, edgeId: edge.id, reason: error.routingReason ?? 'quality', visited: quota - edgeBudget.remaining }); }
        budget.remaining -= quota - edgeBudget.remaining;
      }
      break;
    }
    let order = pass === 0 ? ordered : pass === 1 ? [...ordered].reverse() : [...ordered].sort(stable);
    for (let retry = 0; retry < 16; retry++) {
    const graph = structuredClone(input), previous = frozen.map(r => r.points), fallbacks = [], selectedPairs = new Map();
    const selectedLabels = [], completed = new Set(edgeIds ? [...initial.keys()].filter(id => !edgeIds.has(id)) : []);
    const labelEdge = edge => {
      completed.add(edge.id);
      placeEdgeLabels({ ...graph, edges: graph.edges.filter(item => completed.has(item.id)) }, new Set([edge.id]));
      const route = createEdgeRoutes(graph).get(edge.id);
      if (route.label) selectedLabels.push(expand(route.labelBox, limits.labelEdgeGap));
      previous.push(route.points);
    };
    try {
      for (const item of order) {
        const edge = graph.edges.find(e => e.id === item.id), source = graph.nodes.find(n => n.id === edge.source), target = graph.nodes.find(n => n.id === edge.target);
        if (source === target) {
          const ordinal = [...graph.edges].filter(e => e.source === source.id && e.target === source.id).sort(stable).findIndex(e => e.id === edge.id);
          const loop = selfCorridor(source, graph, [...headings, ...selectedLabels], previous, limits, ordinal, edge, pairOffsets.get(edge.id) ?? 0);
          if (!loop) throw Object.assign(new Error('No clear self corridor for ' + edge.id), { elementIds: [edge.id], routingReason: 'corridor-space' });
          selectedPairs.set(edge.id, loop.sideIndex);
          edge.route = { via: loop.via }; labelEdge(edge); continue;
        }
        const sourceSide = ['decision', 'choice'].includes(source.kind) && graph.edges.filter(e => e.source === source.id && e.target !== source.id).length >= 2 ? initial.get(edge.id).sourceSide : null;
        const pairs = nearestPortPairs(source, target, graph, sourceSide, edge); let chosen, chosenIndex;
        for (let i = pairOffsets.get(edge.id) ?? 0; i < pairs.length; i++) {
          if (chosen && pairs[i].nearest + pairs[i].minimumBends * limits.bendCost >= chosen.cost - .001) continue;
          const route = corridor(pairs[i], graph, [...headings, ...selectedLabels], previous, limits, budget, visibleEdgeLabel(edge, type, graph.meta.locale), chosen?.cost);
          if (route) {
            const cost = r => r.cost;
            if (!chosen || cost(route) < cost(chosen)) { chosen = route; chosenIndex = i; }
            if (cost(chosen) <= (pairs[i + 1] ? pairs[i+1].nearest+pairs[i+1].minimumBends*limits.bendCost : Infinity) || budget.remaining <= 0) break;
          }
        }
        if (!chosen) throw Object.assign(new Error('No clear orthogonal corridor for ' + edge.id), { elementIds: [edge.id, edge.source, edge.target], routingReason: budget.remaining <= 0 ? 'evaluation-budget' : 'corridor-space' });
        selectedPairs.set(edge.id, chosenIndex);
        if (chosenIndex) fallbacks.push({ edgeId: edge.id, nearest: pairs[0].nearest, selected: pairs[chosenIndex].nearest, reason: 'minimum-cost-clear-corridor' });
        edge.route = { ...edge.route, via: chosen.via }; delete edge.route.labelAt;
        labelEdge(edge);
      }
      if (accept) accept(graph, { strictEdgeIds: new Set(order.map(edge => edge.id)) });
      const cost = routingCost(graph); attempts.push({ pass, cost, fallbacks, visited: budgetLimit - budget.remaining });
      if (!best || cost < best.cost) best = { graph, cost, pass };
      if (!graph.edges.length || passes === 1) break;
    } catch (error) {
      last = error; attempts.push({ pass, retry, reason: error.routingReason ?? 'quality', elementIds: error.elementIds ?? [], visited: budgetLimit - budget.remaining });
      if (error.routingReason === 'corridor-space' && budget.remaining > 0) {
        const id = error.elementIds[0], index = order.findIndex(edge => edge.id === id);
        if (index > 0) { order = [order[index], ...order.slice(0, index), ...order.slice(index + 1)]; continue; }
      }
      if (error.routingReason === 'label-space') {
        const id = error.elementIds[0]; pairOffsets.set(id, (selectedPairs.get(id) ?? pairOffsets.get(id) ?? 0) + 1);
        if (budget.remaining > 0) continue;
      }
    }
    break;
    }
  }
  if (!best) throw Object.assign(last ?? new Error('No routing candidate'), { routingReport: { attempts, termination: 'no-valid-candidate', provenImpossible: false } });
  return { graph: best.graph, report: { strategy: 'nearest-outline-orthogonal', budget: budgetLimit, evaluations: attempts.length, selected: best.pass, attempts, termination: 'bounded-search', provenImpossible: false } };
}
