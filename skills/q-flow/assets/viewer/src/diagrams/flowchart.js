import { centeredTitle, rectangle, diamond, paint, polygonAnchor, rectAnchor, roundedRectAnchor } from './drawing.js';

export const FLOW_SLANT = .12;
const outline = (node, x, y) => {
  if (node.kind === 'decision') return diamond(node, x, y);
  if (['input', 'output'].includes(node.kind)) return [['polygon', { points: `${x + node.size.width * FLOW_SLANT},${y} ${x + node.size.width},${y} ${x + node.size.width * (1 - FLOW_SLANT)},${y + node.size.height} ${x},${y + node.size.height}` }]];
  return rectangle(node, x, y, ['start', 'end'].includes(node.kind) ? node.size.height / 2 : 10);
};
const anchor = (node, side, offset) => {
  if (node.kind === 'decision') return polygonAnchor(node, side, offset, [[.5, 0], [1, .5], [.5, 1], [0, .5]]);
  if (['input', 'output'].includes(node.kind)) return polygonAnchor(node, side, offset, [[FLOW_SLANT, 0], [1, 0], [1 - FLOW_SLANT, 1], [0, 1]]);
  if (['start', 'end'].includes(node.kind)) return roundedRectAnchor(node, side, offset, node.size.height / 2);
  return rectAnchor(node, side, offset);
};

function flowNode(node, x, y, fill, stroke) {
  const { width: w, height: h } = node.size;
  const inset = ['input', 'output'].includes(node.kind) ? w * FLOW_SLANT + 12 : ['start', 'end'].includes(node.kind) ? Math.min(h / 2, w / 4) : 18;
  const textWidth = node.kind === 'decision' ? w / 2 - 8 : w - inset * 2;
  const textHeight = node.kind === 'decision' ? h / 2 - 8 : h - 12;
  const label = centeredTitle(x + w / 2, y + h / 2, node.label, textWidth, textHeight, node.subtitle);
  const inner = node.kind === 'subprocess' ? `<path d="M ${x + 11} ${y}V ${y + h}M ${x + w - 11} ${y}V ${y + h}" stroke="${stroke}"/>` : '';
  return `<g class="shape-label">${paint(outline(node, x, y), { fill, stroke, 'stroke-width': 1.2 })}${inner}${label}</g>`;
}


export default {
  id: 'flowchart', label: '流程图',
  nodeKinds: ["start", "end", "process", "decision", "input", "output", "subprocess"],
  groupKinds: [],
  edgeKinds: ["flow", "yes", "no", "success", "failure"],
  render: flowNode, outline, anchor,
  edgeLabel: edge => edge.label ?? ({ yes: '是', no: '否' }[edge.kind] ?? ''),
};
