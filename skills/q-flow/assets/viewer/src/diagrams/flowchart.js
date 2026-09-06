import { text, layoutText, TYPOGRAPHY, rectangle, diamond, paint } from './drawing.js';

export const FLOW_SLANT = .12;
const outline = (node, x, y) => {
  if (node.kind === 'decision') return diamond(node, x, y);
  if (['input', 'output'].includes(node.kind)) return [['polygon', { points: `${x + node.size.width * FLOW_SLANT},${y} ${x + node.size.width},${y} ${x + node.size.width * (1 - FLOW_SLANT)},${y + node.size.height} ${x},${y + node.size.height}` }]];
  return rectangle(node, x, y, ['start', 'end'].includes(node.kind) ? node.size.height / 2 : 10);
};

function flowNode(node, x, y, fill, stroke) {
  const { width: w, height: h } = node.size;
  const titleLayout = layoutText(node.label, w - 36, TYPOGRAPHY.title, 29);
  const subtitleLayout = layoutText(node.subtitle ?? '', w - 36, TYPOGRAPHY.body, 23.2);
  const height = titleLayout.height + (subtitleLayout.lines.length ? 5 + subtitleLayout.height : 0);
  const top = y + (h - height) / 2;
  const label = titleLayout.lines.map((line, index) => text(x + w / 2, top + 22 + index * titleLayout.lineHeight, line, 'shape-title', ' text-anchor="middle"')).join('')
    + subtitleLayout.lines.map((line, index) => text(x + w / 2, top + titleLayout.height + 5 + 18 + index * subtitleLayout.lineHeight, line, 'body', ' text-anchor="middle"')).join('');
  const inner = node.kind === 'subprocess' ? `<path d="M ${x + 11} ${y}V ${y + h}M ${x + w - 11} ${y}V ${y + h}" stroke="${stroke}"/>` : '';
  return `<g class="shape-label">${paint(outline(node, x, y), { fill, stroke, 'stroke-width': 1.2 })}${inner}${label}</g>`;
}


export default {
  id: 'flowchart', label: '流程图',
  flowPlayback: true,
  nodeKinds: ["start", "end", "process", "decision", "input", "output", "subprocess"],
  groupKinds: [],
  edgeKinds: ["flow", "yes", "no", "success", "failure"],
  render: flowNode, outline,
  edgeLabel: edge => edge.label ?? ({ yes: '是', no: '否' }[edge.kind] ?? ''),
};
