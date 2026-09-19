import { genericCard } from './card.js';
import { polygonAnchor, rectAnchor, roundedRectAnchor, rectangle } from './drawing.js';

const HEXAGON = [[.08, 0], [.92, 0], [1, .5], [.92, 1], [.08, 1], [0, .5]];
const OCTAGON = [[.06, 0], [.94, 0], [1, .16], [1, .84], [.94, 1], [.06, 1], [0, .84], [0, .16]];
const SLANT = [[.08, 0], [1, 0], [.92, 1], [0, 1]];
const polygon = (node, x, y, points) => [['polygon', { points: points.map(([px, py]) => `${x + px * node.size.width},${y + py * node.size.height}`).join(' ') }]];

export function architectureOutline(node, x, y) {
  const { width: w, height: h } = node.size;
  if (node.kind === 'external') return polygon(node, x, y, HEXAGON);
  if (node.kind === 'security') return rectangle(node, x, y, 22);
  if (node.kind === 'failure') return polygon(node, x, y, OCTAGON);
  if (node.kind === 'config') return polygon(node, x, y, SLANT);
  if (node.kind === 'business') return rectangle(node, x, y, Math.min(28, h / 2));
  const base = rectangle(node, x, y, ['service', 'component'].includes(node.kind) ? 16 : 10);
  if (node.kind === 'data') return [...base, ['path', { d: `M${x + 16} ${y}V${y + h}M${x + w - 16} ${y}V${y + h}`, fill: 'none' }]];
  if (node.kind === 'database') return [
    ['path', { d: `M${x + 12} ${y + 18}Q${x + 12} ${y + 2} ${x + w / 2} ${y + 2}T${x + w - 12} ${y + 18}V${y + h - 18}Q${x + w - 12} ${y + h - 2} ${x + w / 2} ${y + h - 2}T${x + 12} ${y + h - 18}Z` }],
    ['ellipse', { cx: x + w / 2, cy: y + 18, rx: w / 2 - 12, ry: 16, fill: 'none' }]
  ];
  if (node.kind === 'framework') return [...base, ['path', { d: `M${x + 16} ${y + 24}H${x + w - 16}M${x + 16} ${y + h - 24}H${x + w - 16}`, fill: 'none', 'stroke-dasharray': '7 5' }]];
  return base;
}

const anchor = (node, side, offset) => {
  if (node.kind === 'external') return polygonAnchor(node, side, offset, HEXAGON);
  if (node.kind === 'security') return roundedRectAnchor(node, side, offset, 22);
  if (node.kind === 'failure') return polygonAnchor(node, side, offset, OCTAGON);
  if (node.kind === 'config') return polygonAnchor(node, side, offset, SLANT);
  if (node.kind === 'business') return roundedRectAnchor(node, side, offset, Math.min(28, node.size.height / 2));
  if (node.kind === 'database') return rectAnchor(node, side, offset, { left: 12, right: 12, top: 2, bottom: 2 });
  return rectAnchor(node, side, offset);
};

const contentInset = node => ['external', 'config', 'failure'].includes(node.kind) ? Math.min(28, node.size.width * .08) : 0;

export default {
  dashedKinds: ['framework', 'optional'],
  id: 'architecture', label: '架构图',
  nodeKinds: ["external", "config", "framework", "security", "service", "business", "data", "failure", "system", "component", "database"],
  groupKinds: ["runtime", "security", "ownership", "external"],
  edgeKinds: ["request", "call", "data", "success", "failure", "framework", "optional", "depends"],
  render: (node, ...args) => genericCard(node, ...args, architectureOutline, contentInset(node)), outline: architectureOutline, anchor,
  cardLayout: true, contentInset,
};
