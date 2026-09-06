import { text, fit, TYPOGRAPHY, kindLabels, rectangle, actor, paint } from './drawing.js';

const outline = (node, x, y) => node.kind === 'actor' ? actor(node, x, y) : rectangle(node, x, y, 7, TYPOGRAPHY.sequenceHeader);

function sequenceNode(node, x, y, fill, stroke, palette) {
  const cx = x + node.size.width / 2;
  const actorNode = node.kind === 'actor';
  const header = actorNode ? TYPOGRAPHY.sequenceActorHeader : TYPOGRAPHY.sequenceHeader;
  const head = paint(outline(node, x, y), { fill, stroke, 'stroke-width': 1.5 });
  const label = actorNode
    ? text(cx, y + 98, fit(node.label, node.size.width - 12), 'participant-title', ` text-anchor="middle" style="fill:${palette.ink}"`)
    : text(cx, y + 25, kindLabels[node.kind] ?? node.kind, 'stereotype', ' text-anchor="middle"') + text(cx, y + 53, fit(node.label, node.size.width - 28), 'participant-title', ' text-anchor="middle"');
  return `<g><g class="${actorNode ? 'actor-figure' : 'participant-head'}">${head}</g>${label}<path class="lifeline" d="M ${cx} ${y + header}V ${y + node.size.height}" stroke="${palette.edge}" stroke-width="1" stroke-dasharray="4 6"/></g>`;
}

export default {
  dashedKinds: ['return'],
  id: 'sequence', label: '时序图',
  nodeKinds: ["actor", "participant", "external", "service", "database"],
  groupKinds: ["alt", "opt", "loop"],
  edgeKinds: ["sync", "async", "return"],
  render: sequenceNode, outline,
  sequence: true,
  selectionHeight: node => node.kind === 'actor' ? 78 : TYPOGRAPHY.sequenceHeader,
  edgeLabel: edge => `${String(edge.order).padStart(2, '0')} · ${edge.label ?? ''}`,
  validateEdge(edge, label, errors, { requireString, sequenceOrders }) {
    if (!Number.isInteger(edge?.order) || edge.order < 1) errors.push(`${label}.order must be a positive integer for sequence`);
    else if (sequenceOrders.has(edge.order)) errors.push(`${label}.order duplicates ${edge.order}`);
    else sequenceOrders.add(edge.order);
    requireString(edge?.label, `${label}.label`, errors);
  },
};
