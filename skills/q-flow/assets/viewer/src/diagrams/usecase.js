import { text, fit, centeredTitle, actor, paint, actorAnchor, ellipseAnchor } from './drawing.js';

export const actorTop = node => Math.max(0, (node.size.height - 104 - (node.subtitle ? 24 : 0)) / 2);
const textArea = node => ({ width: node.size.width / Math.SQRT2 - 8, height: node.size.height / Math.SQRT2 - 8 });
const outline = (node, x, y) => node.kind === 'actor' ? actor(node, x, y + actorTop(node))
  : [['ellipse', { cx: x + node.size.width / 2, cy: y + node.size.height / 2, rx: node.size.width / 2, ry: node.size.height / 2 }]];
const anchor = (node, side, offset) => node.kind === 'actor' ? actorAnchor(node, side, offset, actorTop(node)) : ellipseAnchor(node, side, offset);
function usecaseNode(node, x, y, fill, stroke, palette) {
  const cx = x + node.size.width / 2;
  if (node.kind === 'actor') return `<g><g class="actor-figure">${paint(outline(node, x, y), { fill, stroke, 'stroke-width': 1.5 })}</g>${text(cx, y + actorTop(node) + 98, fit(node.label, node.size.width - 12), 'shape-title', ` text-anchor="middle" style="fill:${palette.ink}"`)}${node.subtitle ? text(cx, y + actorTop(node) + 122, fit(node.subtitle, node.size.width - 12), 'body', ' text-anchor="middle"') : ''}</g>`;
  const area = textArea(node);
  return `<g class="shape-label">${paint(outline(node, x, y), { fill, stroke, 'stroke-width': 1.2 })}${centeredTitle(cx, y + node.size.height / 2, node.label, area.width, area.height, node.subtitle)}</g>`;
}

export default {
  dashedKinds: ['include', 'extend'],
  id: 'usecase', label: '用例图',
  nodeKinds: ["actor", "usecase"],
  groupKinds: ["system"],
  edgeKinds: ["association", "include", "extend"],
  render: usecaseNode, outline, anchor, textArea, undirected: ['association'],
  markers: { include: { end: 'arrow-open' }, extend: { end: 'arrow-open' } },
  edgeLabel: edge => {
    const stereotype = { include: '«include»', extend: '«extend»' }[edge.kind];
    if (!stereotype) return edge.label ?? '';
    return edge.label && edge.label !== edge.kind ? `${stereotype} · ${edge.label}` : stereotype;
  },
};
