import { minimumNodeSize } from '../assets/viewer/src/layout-measure.js';
import { sequenceHeaderHeight } from '../assets/viewer/src/diagrams/sequence.js';
import { operandId, operandEdges, fragmentDepth, fragmentHeadingWidth } from '../assets/viewer/src/sequence-fragments.js';
import { visibleEdgeLabel, estimateLabelSize } from '../assets/viewer/src/edge-routing.js';
import { layoutText } from '../assets/viewer/src/text-layout.js';

export function compileSequence(input, candidate) {
  const graph = structuredClone(input), groups = graph.groups ?? [], edges = new Map(graph.edges.map(edge => [edge.id, edge]));
  const ordered = graph.layout?.participantOrder ?? [...graph.nodes].sort((a, b) => (a.layout?.order ?? 0) - (b.layout?.order ?? 0) || (a.id < b.id ? -1 : 1)).map(node => node.id);
  const nodes = ordered.map(id => graph.nodes.find(node => node.id === id)), depth = Math.max(0, ...groups.map(group => fragmentDepth(group, groups)));
  const guardText = (group, operand) => group.kind === 'par' ? operand.label : `${group.kind === 'loop' ? `${group.loop.min}..${group.loop.max} ` : ''}[${operand.guard}]`;
  const guardWidth = Math.max(0, ...groups.flatMap(group => (group.operands ?? []).flatMap(operand => [layoutText(guardText(group, operand), Infinity, 14).width, layoutText(operand.body, Infinity, 16).width])));
  const headingWidth = Math.max(0, ...groups.map(fragmentHeadingWidth));
  const gutter = Math.ceil(Math.max(guardWidth * 1.15, headingWidth)) + depth * 32 + 96, spacing = 96 + candidate * 24;
  const labelWidths = graph.edges.map(edge => estimateLabelSize(visibleEdgeLabel(edge, 'sequence')).width);
  const messageWidth = Math.max(0, ...labelWidths) + 112;
  let x = 32 + gutter;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]; node.size = minimumNodeSize(node, 'sequence', graph.meta.locale); node.position = { x, y: 48 };
    if (i + 1 < nodes.length) {
      const next = minimumNodeSize(nodes[i + 1], 'sequence', graph.meta.locale);
      x += Math.max(node.size.width + spacing, messageWidth + node.size.width / 2 - next.width / 2);
    }
  }
  const right = Math.max(...nodes.map(node => node.position.x + node.size.width)) + messageWidth + 64;
  const frameWidth = Math.ceil(right - 32);
  const owned = new Set(groups.flatMap(group => (group.operands ?? []).flatMap(operand => operand.edgeIds)));
  const range = group => (group.operands ?? []).flatMap((operand, i) => operandEdges(group, operand, i, groups)).map(id => edges.get(id).order);
  const eventOrder = event => event.edge ? event.edge.order : Math.min(Infinity, ...range(event.group));
  const sorted = events => events.sort((a, b) => eventOrder(a) - eventOrder(b) || ((a.edge ?? a.group).id < (b.edge ?? b.group).id ? -1 : 1));
  const gap = 24 + candidate * 8;
  function message(edge, cursor) {
    const label = estimateLabelSize(visibleEdgeLabel(edge, 'sequence'));
    const self = edge.source === edge.target, y = Math.ceil(cursor + (self ? label.height / 2 + 16 : label.height + 12));
    edge.route = { messageY: y };
    return y + (self ? Math.max(36, label.height / 2 + 16) : 6) + gap;
  }
  function eventsAt(events, cursor) {
    for (const event of sorted(events)) cursor = event.edge ? message(event.edge, cursor) : fragment(event.group, cursor);
    return cursor;
  }
  function fragment(group, top) {
    if (!group.operands) throw new Error(`Sequence group ${group.id} needs explicit operands before automatic layout`);
    const nesting = fragmentDepth(group, groups);
    group.position = { x: 32 + nesting * 32, y: top };
    group.size = { width: frameWidth - nesting * 64, height: 0 };
    let cursor = top + 84;
    for (const [i, operand] of group.operands.entries()) {
      cursor += layoutText(guardText(group, operand), Infinity, 14, 20).height + 16;
      const children = groups.filter(child => child.parentId === group.id && child.parentOperandId === operandId(operand, i));
      const events = [...operand.edgeIds.map(id => ({ edge: edges.get(id) })), ...children.map(group => ({ group }))];
      cursor = eventsAt(events, cursor);
      if (operand.body) cursor += layoutText(operand.body, Infinity, 16, 24).height + 16;
      cursor += 64 + gap;
    }
    group.size.height = cursor - top + 32;
    return top + group.size.height + 64;
  }
  const bottom = eventsAt([...graph.edges.filter(edge => !owned.has(edge.id)).map(edge => ({ edge })), ...groups.filter(group => !group.parentId).map(group => ({ group }))], 48 + Math.max(...nodes.map(sequenceHeaderHeight)) + 64);
  const messages = [...graph.edges].sort((a, b) => a.order - b.order);
  for (let i = 1; i < messages.length; i++) if (messages[i].route.messageY <= messages[i - 1].route.messageY) throw new Error(`Sequence fragment ranges interleave at ${messages[i].id}; retain message order and correct operand ownership`);
  for (const node of graph.nodes) node.size.height = bottom + 64 - node.position.y;
  return graph;
}
