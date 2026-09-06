import { centeredTitle, rectangle, diamond, paint } from './drawing.js';

const outline = (node, x, y) => {
  if (['initial', 'final'].includes(node.kind)) return [['circle', { cx: x + node.size.width / 2, cy: y + node.size.height / 2, r: node.kind === 'initial' ? 12 : 13 }]];
  return node.kind === 'choice' ? diamond(node, x, y) : rectangle(node, x, y, 12);
};
function stateNode(node, x, y, fill, stroke, palette) {
  const cx = x + node.size.width / 2, cy = y + node.size.height / 2;
  if (node.kind === 'initial') return `<g class="state-dot">${paint(outline(node, x, y), { fill, stroke })}</g>`;
  if (node.kind === 'final') return `<g class="state-dot">${paint(outline(node, x, y), { fill, stroke, 'stroke-width': 1 })}<circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="${stroke}" stroke-width="2"/></g>`;
  return `<g class="shape-label">${paint(outline(node, x, y), { fill, stroke, 'stroke-width': 1.2 })}${centeredTitle(cx, cy, node.label, node.size.width - (node.kind === 'choice' ? 36 : 18))}</g>`;
}

export default {
  id: 'state', label: '状态图',
  flowPlayback: true,
  nodeKinds: ["initial", "state", "final", "choice"],
  groupKinds: [],
  edgeKinds: ["transition"],
  render: stateNode, outline,
  edgeLabel: edge => [edge.label, edge.guard ? `[${edge.guard}]` : '', edge.action ? `/ ${edge.action}` : ''].filter(Boolean).join(' '),
  validateEdge(edge, label, errors) {
    for (const field of ['guard', 'action']) if (edge?.[field] !== undefined && typeof edge[field] !== 'string') errors.push(`${label}.${field} must be a string`);
  },
};
