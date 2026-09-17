import { genericCard } from './card.js';
import { polygonAnchor, rectAnchor, roundedRectAnchor, rectangle } from './drawing.js';

const HEXAGON = [[.08, 0], [.92, 0], [1, .5], [.92, 1], [.08, 1], [0, .5]];
const CUBE = [[0, .1], [.06, 0], [1, 0], [1, .9], [.94, 1], [0, 1]];
const polygon = (node, x, y, points) => [['polygon', { points: points.map(([px, py]) => `${x + px * node.size.width},${y + py * node.size.height}`).join(' ') }]];

export function deploymentOutline(node, x, y) {
  const { width: w, height: h } = node.size;
  if (node.kind === 'device') return [
    ['rect', { x: x + 16, y, width: w - 32, height: h, rx: 10 }],
    ['path', { d: `M${x + w / 2} ${y + h - 16}V${y + h - 7}M${x + w / 2 - 30} ${y + h - 7}H${x + w / 2 + 30}`, fill: 'none' }]
  ];
  if (node.kind === 'node') return [...polygon(node, x, y, CUBE), ['path', { d: `M${x} ${y + h * .1}L${x + w * .94} ${y + h * .1}L${x + w} ${y}M${x + w * .94} ${y + h * .1}V${y + h}`, fill: 'none' }]];
  if (node.kind === 'container') return [...rectangle(node, x, y, 10), ['rect', { x: x + 14, y: y + 16, width: 16, height: 11, rx: 2, fill: 'none' }], ['rect', { x: x + 10, y: y + 20, width: 16, height: 11, rx: 2, fill: 'none' }]];
  if (node.kind === 'artifact') return [['path', { d: `M${x} ${y}H${x + w - 28}L${x + w} ${y + 28}V${y + h}H${x}Z` }], ['path', { d: `M${x + w - 28} ${y}V${y + 28}H${x + w}`, fill: 'none' }]];
  if (node.kind === 'database') return [
    ['path', { d: `M${x + 12} ${y + 18}Q${x + 12} ${y + 2} ${x + w / 2} ${y + 2}T${x + w - 12} ${y + 18}V${y + h - 18}Q${x + w - 12} ${y + h - 2} ${x + w / 2} ${y + h - 2}T${x + 12} ${y + h - 18}Z` }],
    ['ellipse', { cx: x + w / 2, cy: y + 18, rx: w / 2 - 12, ry: 16, fill: 'none' }]
  ];
  if (node.kind === 'external') return polygon(node, x, y, HEXAGON);
  if (node.kind === 'service') return [...rectangle(node, x, y, 16), ['path', { d: `M${x} ${y + 36}h12M${x + w - 12} ${y + h - 36}h12`, fill: 'none' }]];
  return rectangle(node, x, y, 10);
}

const anchor = (node, side, offset) => {
  if (node.kind === 'device') return rectAnchor(node, side, offset, { left: 16, right: 16, top: 0, bottom: 0 });
  if (node.kind === 'node') return polygonAnchor(node, side, offset, CUBE);
  if (node.kind === 'database') return rectAnchor(node, side, offset, { left: 12, right: 12, top: 2, bottom: 2 });
  if (node.kind === 'external') return polygonAnchor(node, side, offset, HEXAGON);
  if (node.kind === 'service') return roundedRectAnchor(node, side, offset, 16);
  return rectAnchor(node, side, offset);
};

const contentInset = node => node.kind === 'external' ? Math.min(28, node.size.width * .08) : node.kind === 'device' ? 12 : 0;

export default {
  id: 'deployment', label: '部署图',
  nodeKinds: ["device", "node", "container", "artifact", "service", "database", "external"],
  groupKinds: ["host", "network", "cluster", "namespace"],
  edgeKinds: ["deploy", "network", "depends"],
  render: (node, ...args) => genericCard(node, ...args, deploymentOutline, contentInset(node)), outline: deploymentOutline, anchor,
  cardLayout: true, contentInset,
};
