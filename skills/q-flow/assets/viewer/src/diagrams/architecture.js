import { hasOverviewContent, overviewCardSvg } from '../architecture-overview.js';
import { genericCard } from './card.js';
import { cylinder, polygonAnchor, rectAnchor, roundedRectAnchor, rectangle, HEXAGON, polygon } from './drawing.js';

const OCTAGON = [[.06, 0], [.94, 0], [1, .16], [1, .84], [.94, 1], [.06, 1], [0, .84], [0, .16]];
const SLANT = [[.08, 0], [1, 0], [.92, 1], [0, 1]];

export function architectureOutline(node, x, y) {
  const { width: w, height: h } = node.size;
  if (hasOverviewContent(node)) return rectangle(node, x, y, 16);
  if (node.kind === 'external') return polygon(node, x, y, HEXAGON);
  if (node.kind === 'security') return rectangle(node, x, y, 22);
  if (node.kind === 'failure') return polygon(node, x, y, OCTAGON);
  if (node.kind === 'config') return polygon(node, x, y, SLANT);
  if (node.kind === 'business') return rectangle(node, x, y, Math.min(28, h / 2));
  const base = rectangle(node, x, y, ['service', 'component'].includes(node.kind) ? 16 : 10);
  // Notation stays in the card margins: the icon plate starts 14px in, text 48px in, and the content block is centred
  // vertically with 14px above and below.
  if (node.kind === 'data') return [...base, ['path', { d: `M${x + 10} ${y}V${y + h}M${x + w - 10} ${y}V${y + h}`, fill: 'none' }]];
  if (node.kind === 'database') return cylinder(node, x, y);
  if (node.kind === 'framework') return [...base, ['path', { d: `M${x + 16} ${y + 6}H${x + w - 16}M${x + 16} ${y + h - 6}H${x + w - 16}`, fill: 'none', 'stroke-dasharray': '7 5' }]];
  return base;
}

const anchor = (node, side, offset) => {
  if (hasOverviewContent(node)) return roundedRectAnchor(node, side, offset, 16);
  if (node.kind === 'external') return polygonAnchor(node, side, offset, HEXAGON);
  if (node.kind === 'security') return roundedRectAnchor(node, side, offset, 22);
  if (node.kind === 'failure') return polygonAnchor(node, side, offset, OCTAGON);
  if (node.kind === 'config') return polygonAnchor(node, side, offset, SLANT);
  if (node.kind === 'business') return roundedRectAnchor(node, side, offset, Math.min(28, node.size.height / 2));
  if (node.kind === 'database') return rectAnchor(node, side, offset, { left: 12, right: 12, top: 2, bottom: 2 });
  return rectAnchor(node, side, offset);
};

const contentInset = node => ['external', 'config', 'failure'].includes(node.kind) ? Math.min(28, node.size.width * .08) : node.kind === 'database' ? 12 : 0;

export default {
  dashedKinds: ['framework', 'optional'],
  id: 'architecture', label: 'Architecture',
  nodeKinds: ["external", "config", "framework", "security", "service", "business", "data", "failure", "system", "component", "database"],
  groupKinds: ["runtime", "security", "ownership", "external"],
  edgeKinds: ["request", "call", "data", "success", "failure", "framework", "optional", "depends", "aggregates", "inherits", "provides"],
  render: (node, x, y, fill, stroke, palette, locale) => hasOverviewContent(node) ? overviewCardSvg(node, x, y, palette, fill, stroke) : genericCard(node, x, y, fill, stroke, palette, locale, architectureOutline, contentInset(node)), outline: architectureOutline, anchor,
  cardLayout: true, contentInset,
};
