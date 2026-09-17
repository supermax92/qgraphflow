import { getDiagram } from './diagrams/registry.js';
import { forceSimulation, forceX, forceY } from 'd3-force';
import { LAYOUT_LIMITS, requireDiagramQuality } from './layout-quality.js';

const CLEARANCE = LAYOUT_LIMITS.nodeGap + 1;
const MAX_SHIFT = 156;
const GROUP_HEADER = LAYOUT_LIMITS.groupHeadingGap;
const GROUP_PADDING = LAYOUT_LIMITS.groupInset;
const TICKS = 160;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function movableIds(graph, focusId) {
  if (!focusId) return new Set(graph.nodes.map(node => node.id));
  const ids = new Set([focusId]);
  for (const edge of graph.edges) {
    if (edge.source === focusId) ids.add(edge.target);
    if (edge.target === focusId) ids.add(edge.source);
  }
  return ids;
}

function containingGroup(node, groups) {
  if (node.groupId) return groups.find(group => group.id === node.groupId);
  const matches = groups.filter(group => node.position.x >= group.position.x
    && node.position.y >= group.position.y
    && node.position.x + node.size.width <= group.position.x + group.size.width
    && node.position.y + node.size.height <= group.position.y + group.size.height);
  return matches.sort((left, right) => left.size.width * left.size.height - right.size.width * right.size.height)[0];
}

function groupBounds(node, group, sequence) {
  if (!group) return null;
  const halfWidth = node.size.width / 2;
  const halfHeight = node.size.height / 2;
  const anchorX = node.position.x + halfWidth, anchorY = node.position.y + halfHeight;
  const minimumX = Math.max(group.position.x + GROUP_PADDING + halfWidth, anchorX - MAX_SHIFT);
  const maximumX = Math.min(group.position.x + group.size.width - GROUP_PADDING - halfWidth, anchorX + MAX_SHIFT);
  const minimumY = Math.max(group.position.y + Math.min(GROUP_HEADER, group.size.height) + GROUP_PADDING + halfHeight, anchorY - (sequence ? 0 : MAX_SHIFT));
  const maximumY = Math.min(group.position.y + group.size.height - GROUP_PADDING - halfHeight, anchorY + (sequence ? 0 : MAX_SHIFT));
  return { minimumX, maximumX, minimumY, maximumY };
}

function rectangleCollision(sequence) {
  let nodes = [];
  const force = () => {
    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
        const left = nodes[leftIndex];
        const right = nodes[rightIndex];
        if (!left.movable && !right.movable) continue;
        const dx = left.x + left.vx - right.x - right.vx;
        const dy = left.y + left.vy - right.y - right.vy;
        const overlapX = (left.width + right.width) / 2 + CLEARANCE - Math.abs(dx);
        const overlapY = (left.height + right.height) / 2 + CLEARANCE - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        const axis = sequence || overlapX <= overlapY ? 'x' : 'y';
        const delta = (axis === 'x' ? overlapX : overlapY) * 0.9;
        const directionValue = axis === 'x' ? dx : dy;
        const direction = directionValue === 0 ? (left.id < right.id ? -1 : 1) : Math.sign(directionValue);
        const leftShare = left.movable ? (right.movable ? 0.5 : 1) : 0;
        const rightShare = right.movable ? (left.movable ? 0.5 : 1) : 0;
        if (axis === 'x') {
          left.vx += direction * delta * leftShare;
          right.vx -= direction * delta * rightShare;
        } else {
          left.vy += direction * delta * leftShare;
          right.vy -= direction * delta * rightShare;
        }
      }
    }
  };
  force.initialize = value => { nodes = value; };
  return force;
}

export function nudgeGraphLayout(graph, focusId = null) {
  const sequence = getDiagram(graph.meta.diagramType).sequence;
  const movable = movableIds(graph, focusId);
  const simulationNodes = graph.nodes.map(node => {
    const anchorX = node.position.x + node.size.width / 2;
    const anchorY = node.position.y + node.size.height / 2;
    const bounds = groupBounds(node, containingGroup(node, graph.groups ?? []), sequence);
    // An infeasible inset freezes the node; it never removes its containing boundary.
    const canMove = movable.has(node.id) && (!bounds || (bounds.minimumX <= bounds.maximumX && bounds.minimumY <= bounds.maximumY));
    return {
      id: node.id,
      width: node.size.width,
      height: node.size.height,
      anchorX,
      anchorY,
      x: anchorX,
      y: anchorY,
      vx: 0,
      vy: 0,
      movable: canMove,
      bounds,
      fx: canMove ? undefined : anchorX,
      fy: canMove ? undefined : anchorY
    };
  });

  const simulation = forceSimulation(simulationNodes)
    .velocityDecay(0.42)
    .force('anchor-x', forceX(node => node.anchorX).strength(0.16))
    .force('anchor-y', forceY(node => node.anchorY).strength(sequence ? 1 : 0.16))
    .force('rectangles', rectangleCollision(sequence))
    .stop();

  for (let tick = 0; tick < TICKS; tick += 1) {
    simulation.tick();
    for (const node of simulationNodes) {
      if (!node.movable) continue;
      node.x = clamp(node.x, node.anchorX - MAX_SHIFT, node.anchorX + MAX_SHIFT);
      node.y = sequence ? node.anchorY : clamp(node.y, node.anchorY - MAX_SHIFT, node.anchorY + MAX_SHIFT);
      node.x = Math.max(node.width / 2, node.x);
      node.y = Math.max(node.height / 2, node.y);
      if (node.bounds) {
        node.x = clamp(node.x, node.bounds.minimumX, node.bounds.maximumX);
        node.y = clamp(node.y, node.bounds.minimumY, node.bounds.maximumY);
      }
    }
  }
  simulation.stop();

  const byId = new Map(simulationNodes.map(node => [node.id, node]));
  const movedNodeIds = [];
  const nodes = graph.nodes.map(node => {
    const simulated = byId.get(node.id);
    if (!simulated.movable) return node;
    const position = {
      x: clamp(Math.round(simulated.x - node.size.width / 2), Math.max(0, node.position.x - MAX_SHIFT), node.position.x + MAX_SHIFT),
      y: sequence ? node.position.y : clamp(Math.round(simulated.y - node.size.height / 2), Math.max(0, node.position.y - MAX_SHIFT), node.position.y + MAX_SHIFT)
    };
    if (simulated.bounds) {
      position.x = clamp(position.x, simulated.bounds.minimumX - node.size.width / 2, simulated.bounds.maximumX - node.size.width / 2);
      if (!sequence) position.y = clamp(position.y, simulated.bounds.minimumY - node.size.height / 2, simulated.bounds.maximumY - node.size.height / 2);
    }
    if (position.x !== node.position.x || position.y !== node.position.y) movedNodeIds.push(node.id);
    return { ...node, position };
  });
  const candidate = { ...graph, nodes };
  try { requireDiagramQuality(candidate); }
  catch (error) { return { graph, movedNodeIds: [], rejected: { message: error.message, diagnostics: error.diagnostics ?? [] } }; }
  return { graph: candidate, movedNodeIds };
}
