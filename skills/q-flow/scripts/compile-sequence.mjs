import { minimumNodeSize } from '../assets/viewer/src/layout-measure.js';
import { sequenceHeaderHeight } from '../assets/viewer/src/diagrams/sequence.js';
import { operandId, operandEdges, fragmentDepth, fragmentHeadingLayout } from '../assets/viewer/src/sequence-fragments.js';
import { createEdgeRoutes } from '../assets/viewer/src/edge-routing.js';
import { sequenceMessageLabel } from '../assets/viewer/src/sequence-executions.js';
import { edgeLabelLayout, layoutText } from '../assets/viewer/src/text-layout.js';
import { LAYOUT_LIMITS, LAYOUT_TARGETS } from '../assets/viewer/src/layout-spacing.js';

export function compileSequence(input, candidate) {
  const graph = structuredClone(input), groups = graph.groups ?? [], edges = new Map(graph.edges.map(edge => [edge.id, edge]));
  const ordered = graph.layout?.participantOrder ?? [...graph.nodes].sort((a, b) => (a.layout?.order ?? 0) - (b.layout?.order ?? 0) || (a.id < b.id ? -1 : 1)).map(node => node.id);
  const nodes = ordered.map(id => graph.nodes.find(node => node.id === id));
  const spacing = LAYOUT_TARGETS.nodeGap + candidate * 8, gap = LAYOUT_LIMITS.labelGap + candidate * 4;
  const guardText = (group, operand) => group.kind === 'par' ? operand.label : `${group.kind === 'loop' ? `${group.loop.min}..${group.loop.max} ` : ''}[${operand.guard}]`;
  const guardLayout = (group, operand) => layoutText(guardText(group, operand), LAYOUT_TARGETS.labelWidth, 14, 20);
  const bodyLayout = operand => layoutText(operand.body, LAYOUT_TARGETS.labelWidth, 16, 24);
  let x = 32;
  for (const node of nodes) {
    node.size = minimumNodeSize(node, 'sequence', graph.meta.locale); node.position = { x, y: 48 };
    x += node.size.width + spacing;
  }
  // Difference constraints on the message's actual span; moving the suffix keeps
  // unrelated neighboring gaps unchanged. Longer spans reuse existing space.
  const constraints = [...graph.edges].sort((a, b) => Math.abs(ordered.indexOf(a.source) - ordered.indexOf(a.target)) - Math.abs(ordered.indexOf(b.source) - ordered.indexOf(b.target)) || a.order - b.order);
  const selfCounts = new Map();
  for (const edge of constraints) {
    const left = Math.min(ordered.indexOf(edge.source), ordered.indexOf(edge.target));
    let right = Math.max(ordered.indexOf(edge.source), ordered.indexOf(edge.target));
    const label = edgeLabelLayout(sequenceMessageLabel(graph, edge));
    let required = label.width + 64;
    if (left === right) {
      const ordinal = selfCounts.get(edge.source) ?? 0; selfCounts.set(edge.source, ordinal + 1);
      right++; required += 48 + ordinal * 24;
      if (right === nodes.length) continue;
    }
    const center = node => node.position.x + node.size.width / 2;
    const extra = Math.max(0, required - (center(nodes[right]) - center(nodes[left])));
    for (let i = right; i < nodes.length; i++) nodes[i].position.x += extra;
  }
  // Provisional order-preserving times let the shared router measure actual
  // prefixes, activation offsets, wrapped labels and self calls.
  for (const edge of graph.edges) edge.route = { messageY: 200 + edge.order * 100 };
  const routes = createEdgeRoutes(graph);
  const owned = new Set(groups.flatMap(group => (group.operands ?? []).flatMap(operand => operand.edgeIds)));
  const range = group => (group.operands ?? []).flatMap((operand, i) => operandEdges(group, operand, i, groups)).map(id => edges.get(id).order);
  const eventOrder = event => event.edge ? event.edge.order : Math.min(Infinity, ...range(event.group));
  const sorted = events => events.sort((a, b) => eventOrder(a) - eventOrder(b) || ((a.edge ?? a.group).id < (b.edge ?? b.group).id ? -1 : 1));
  // Fragments enclose only their messages and children. A bounded local gutter
  // lets active lifelines continue beside complete, wrapped conditions.
  for (const group of [...groups].sort((a, b) => fragmentDepth(b, groups) - fragmentDepth(a, groups) || a.id.localeCompare(b.id))) {
    if (!group.operands) throw new Error(`Sequence group ${group.id} needs explicit operands before automatic layout`);
    const selected = group.operands.flatMap((operand, i) => operandEdges(group, operand, i, groups)).map(id => routes.get(id));
    const points = selected.flatMap(route => [...route.points, { x: route.labelBox.x }, { x: route.labelBox.x + route.labelBox.width }]);
    const children = groups.filter(child => child.parentId === group.id);
    const textWidth = Math.max(fragmentHeadingLayout({ ...group, size: undefined }).width + 16, ...group.operands.flatMap(operand => [guardLayout(group, operand).width, bodyLayout(operand).width]));
    const localLeft = (points.length ? Math.min(...points.map(point => point.x)) : nodes[0].position.x) - textWidth - 40;
    const frameLeft = Math.min(localLeft, ...children.map(child => child.position.x - 32));
    const right = Math.max(frameLeft + textWidth + 120, ...points.map(point => point.x + 32), ...children.map(child => child.position.x + child.size.width + 32));
    group.position = { x: frameLeft, y: 0 }; group.size = { width: Math.ceil(right - frameLeft), height: 0 };
  }
  function message(edge, cursor) {
    const label = routes.get(edge.id).labelBox, self = edge.source === edge.target;
    const y = Math.ceil(cursor + (self ? Math.max(16, label.height / 2 - 15) : label.height + 6));
    edge.route = { messageY: y };
    return y + (self ? Math.max(36, 15 + label.height / 2) : 6) + gap;
  }
  function eventsAt(events, cursor) {
    for (const event of sorted(events)) cursor = event.edge ? message(event.edge, cursor) : fragment(event.group, cursor);
    return cursor;
  }
  function fragment(group, top) {
    group.position.y = top;
    let cursor = top + Math.max(36, fragmentHeadingLayout(group).height + 20) + gap;
    for (const [i, operand] of group.operands.entries()) {
      cursor += guardLayout(group, operand).height + 16;
      if (operand.body) cursor += bodyLayout(operand).height + 16;
      const children = groups.filter(child => child.parentId === group.id && child.parentOperandId === operandId(operand, i));
      cursor = eventsAt([...operand.edgeIds.map(id => ({ edge: edges.get(id) })), ...children.map(group => ({ group }))], cursor);
      cursor += gap;
    }
    group.size.height = cursor - top + 16;
    return top + group.size.height + gap;
  }
  const bottom = eventsAt([...graph.edges.filter(edge => !owned.has(edge.id)).map(edge => ({ edge })), ...groups.filter(group => !group.parentId).map(group => ({ group }))], 48 + Math.max(...nodes.map(sequenceHeaderHeight)) + LAYOUT_LIMITS.labelGap);
  const messages = [...graph.edges].sort((a, b) => a.order - b.order);
  for (let i = 1; i < messages.length; i++) if (messages[i].route.messageY <= messages[i - 1].route.messageY) throw new Error(`Sequence fragment ranges interleave at ${messages[i].id}; retain message order and correct operand ownership`);
  const shift = Math.max(0, 32 - Math.min(...groups.map(group => group.position.x), ...nodes.map(node => node.position.x)));
  for (const item of [...nodes, ...groups]) item.position.x += shift;
  for (const node of graph.nodes) node.size.height = bottom + 32 - node.position.y;
  return graph;
}
