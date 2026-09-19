import { centeredTitle, rectangle, diamond, paint, ellipseAnchor, polygonAnchor, rectAnchor } from './drawing.js';

export const stateSymbolX = node => node.subtitle ? 14 : node.size.width / 2;
const outline = (node, x, y) => {
  if (['initial', 'final'].includes(node.kind)) return [['circle', { cx: x + stateSymbolX(node), cy: y + node.size.height / 2, r: node.kind === 'initial' ? 12 : 13 }]];
  return node.kind === 'choice' ? diamond(node, x, y) : rectangle(node, x, y, 12);
};
const anchor = (node, side, offset) => {
  if (['initial', 'final'].includes(node.kind)) {
    const radius = node.kind === 'initial' ? 12 : 13;
    const shift = stateSymbolX(node) - node.size.width / 2;
    const circle = { ...node, position: { ...node.position, x: node.position.x + shift } };
    return ellipseAnchor(circle, side, offset - (['top', 'bottom'].includes(side) ? shift : 0), node.size.width / 2 - radius, node.size.height / 2 - radius);
  }
  return node.kind === 'choice' ? polygonAnchor(node, side, offset, [[.5, 0], [1, .5], [.5, 1], [0, .5]]) : rectAnchor(node, side, offset);
};
const textArea = node => ['initial', 'final'].includes(node.kind) && node.subtitle
  ? { x: 42, y: 8, width: node.size.width - 50, height: node.size.height - 16 }
  : { width: node.kind === 'choice' ? node.size.width / 2 - 8 : node.size.width - 24, height: node.kind === 'choice' ? node.size.height / 2 - 8 : node.size.height - 16 };
function stateNode(node, x, y, fill, stroke, palette) {
  const cx = x + node.size.width / 2, cy = y + node.size.height / 2;
  if (['initial', 'final'].includes(node.kind)) {
    const area = textArea(node), final = node.kind === 'final';
    return `<g class="state-dot">${paint(outline(node, x, y), { fill: final ? palette.surface : stroke, stroke, 'stroke-width': 1 })}${final ? `<circle cx="${x + stateSymbolX(node)}" cy="${cy}" r="8" fill="${stroke}"/>` : ''}</g>${node.subtitle ? centeredTitle(x + area.x + area.width / 2, cy, node.label, area.width, area.height, node.subtitle) : ''}`;
  }
  const area = textArea(node);
  return `<g class="shape-label">${paint(outline(node, x, y), { fill, stroke, 'stroke-width': 1.2 })}${centeredTitle(cx, cy, node.label, area.width, area.height, node.subtitle)}</g>`;
}

export default {
  id: 'state', label: 'State diagram',
  nodeKinds: ["initial", "state", "final", "choice"],
  groupKinds: [],
  edgeKinds: ["transition"],
  render: stateNode, outline, anchor, textArea,
  edgeLabel: edge => [edge.label, edge.guard ? `[${edge.guard}]` : '', edge.action ? `/ ${edge.action}` : ''].filter(Boolean).join(' '),
  validateEdge(edge, label, errors) {
    for (const field of ['guard', 'action']) if (edge?.[field] !== undefined && typeof edge[field] !== 'string') errors.push(`${label}.${field} must be a string`);
  },
};
