import { translate } from '../i18n.js';
import { text, fit, TYPOGRAPHY, kindLabels, rectangle, actor, paint, mix, escapeXml } from './drawing.js';

const outline = (node, x, y) => node.kind === 'actor' ? actor(node, x, y) : rectangle(node, x, y, 7, TYPOGRAPHY.sequenceHeader);
export const sequenceHeaderHeight = node => node.kind === 'actor' ? TYPOGRAPHY.sequenceActorHeader + (node.subtitle ? 22 : 0) : TYPOGRAPHY.sequenceHeader;

function sequenceNode(node, x, y, fill, stroke, palette, locale) {
  const cx = x + node.size.width / 2;
  const actorNode = node.kind === 'actor';
  const header = sequenceHeaderHeight(node);
  const head = paint(outline(node, x, y), { fill, stroke, 'stroke-width': 1.5 });
  const label = actorNode
    ? text(cx, y + 98, fit(node.label, node.size.width - 12), 'participant-title', ` text-anchor="middle" style="fill:${palette.ink}"`)
    : text(cx, y + (node.subtitle ? 18 : 25), translate(locale, kindLabels[node.kind] ?? node.kind), 'stereotype', ' text-anchor="middle"') + text(cx, y + (node.subtitle ? 41 : 53), fit(node.label, node.size.width - 28), 'participant-title', ' text-anchor="middle"');
  const subtitle = node.subtitle ? text(cx, y + (actorNode ? 120 : 63), fit(node.subtitle, node.size.width - 28), 'body', ' text-anchor="middle"') : '';
  const executions = (node.executionRects ?? []).map(item => `<rect class="sequence-execution" data-execution-id="${escapeXml(item.id)}" x="${x + item.x}" y="${y + item.y}" width="${item.width}" height="${item.height}" fill="${mix(item.color, palette.surface, .14)}" stroke="${item.color}" stroke-width="1.5"/>`).join('');
  return `<g><g class="sequence-head"><g class="${actorNode ? 'actor-figure' : 'participant-head'}">${head}</g>${label}${subtitle}</g><path class="lifeline" d="M ${cx} ${y + header}V ${y + node.size.height}" stroke="${palette.edge}" stroke-width="1" stroke-dasharray="4 6"/>${executions}</g>`;
}

export default {
  dashedKinds: ['return'],
  markers: { async: { end: 'arrow-open' }, return: { end: 'arrow-open' } },
  id: 'sequence', label: 'Sequence',
  nodeKinds: ["actor", "participant", "external", "service", "database"],
  groupKinds: ["alt", "opt", "loop", "par"],
  edgeKinds: ["sync", "async", "return"],
  render: sequenceNode, outline,
  sequence: true,
  selectionHeight: sequenceHeaderHeight,
  edgeLabel: edge => `${String(edge.order).padStart(2, '0')} · ${edge.label ?? ''}`,
  validateEdge(edge, label, errors, { requireString, sequenceOrders }) {
    if (!Number.isInteger(edge?.order) || edge.order < 1) errors.push(`${label}.order must be a positive integer for sequence`);
    else if (sequenceOrders.has(edge.order)) errors.push(`${label}.order duplicates ${edge.order}`);
    else sequenceOrders.add(edge.order);
    requireString(edge?.label, `${label}.label`, errors);
  },
};
