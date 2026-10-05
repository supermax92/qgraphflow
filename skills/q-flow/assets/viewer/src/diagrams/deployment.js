import { genericCard } from './card.js';
import { cylinder, polygonAnchor, rectAnchor, roundedRectAnchor, rectangle, HEXAGON, polygon } from './drawing.js';

const CUBE = [[0, .1], [.06, 0], [1, 0], [1, .9], [.94, 1], [0, 1]];

export function deploymentOutline(node, x, y) {
  const { width: w, height: h } = node.size;
  // Notation stays clear of the card text: the stand sits under the 14px bottom padding, and the stacked boxes, the folded
  // corner and the cube's side face keep the top-right corner, which cardCorner leaves free of the kind tag.
  if (node.kind === 'device') return [
    ['rect', { x: x + 16, y, width: w - 32, height: h, rx: 10 }],
    ['path', { d: `M${x + w / 2} ${y + h - 10}V${y + h - 5}M${x + w / 2 - 30} ${y + h - 5}H${x + w / 2 + 30}`, fill: 'none' }]
  ];
  if (node.kind === 'node') return [...polygon(node, x, y, CUBE), ['path', { d: `M${x} ${y + h * .1}L${x + w * .94} ${y + h * .1}L${x + w} ${y}M${x + w * .94} ${y + h * .1}V${y + h}`, fill: 'none' }]];
  if (node.kind === 'container') return [...rectangle(node, x, y, 10), ['rect', { x: x + w - 30, y: y + 13, width: 16, height: 11, rx: 2, fill: 'none' }], ['rect', { x: x + w - 34, y: y + 17, width: 16, height: 11, rx: 2, fill: 'none' }]];
  if (node.kind === 'artifact') return [['path', { d: `M${x} ${y}H${x + w - 28}L${x + w} ${y + 28}V${y + h}H${x}Z` }], ['path', { d: `M${x + w - 28} ${y}V${y + 28}H${x + w}`, fill: 'none' }]];
  if (node.kind === 'database') return cylinder(node, x, y);
  if (node.kind === 'external') return polygon(node, x, y, HEXAGON);
  if (node.kind === 'service') return rectangle(node, x, y, 16);
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

// Right-hand room the kind tag leaves for the notation in the top-right corner.
const cardCorner = node => ({ container: 24, artifact: 18, node: 20 })[node.kind] ?? 0;
const contentInset = node => node.kind === 'external' ? Math.min(28, node.size.width * .08) : ['device', 'database'].includes(node.kind) ? 12 : 0;

export default {
  id: 'deployment', label: 'Deployment',
  nodeKinds: ["device", "node", "container", "artifact", "service", "database", "external"],
  groupKinds: ["host", "network", "cluster", "namespace"],
  edgeKinds: ["deploy", "network", "depends"],
  render: (node, ...args) => genericCard(node, ...args, deploymentOutline, contentInset(node), cardCorner(node)), outline: deploymentOutline, anchor,
  cardLayout: true, contentInset, cardCorner,
};
