import { text, fit, centeredTitle, actor, paint } from './drawing.js';

const actorTop = node => Math.max(0, (node.size.height - 104) / 2);
const outline = (node, x, y) => node.kind === 'actor' ? actor(node, x, y + actorTop(node))
  : [['ellipse', { cx: x + node.size.width / 2, cy: y + node.size.height / 2, rx: node.size.width / 2, ry: node.size.height / 2 }]];
function usecaseNode(node, x, y, fill, stroke, palette) {
  const cx = x + node.size.width / 2;
  if (node.kind === 'actor') return `<g><g class="actor-figure">${paint(outline(node, x, y), { fill, stroke, 'stroke-width': 1.5 })}</g>${text(cx, y + actorTop(node) + 98, fit(node.label, node.size.width - 12), 'shape-title', ` text-anchor="middle" style="fill:${palette.ink}"`)}</g>`;
  return `<g class="shape-label">${paint(outline(node, x, y), { fill, stroke, 'stroke-width': 1.2 })}${centeredTitle(cx, y + node.size.height / 2, node.label, node.size.width - 32)}</g>`;
}

export default {
  dashedKinds: ['include', 'extend'],
  id: 'usecase', label: '用例图',
  nodeKinds: ["actor", "usecase"],
  groupKinds: ["system"],
  edgeKinds: ["association", "include", "extend"],
  render: usecaseNode, outline, undirected: ['association'],
  edgeLabel: edge => edge.label ?? ({ include: '«include»', extend: '«extend»' }[edge.kind] ?? ''),
};
