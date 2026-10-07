import { layoutText } from '../text-layout.js';
import { translate } from '../i18n.js';
import { text, fit, TYPOGRAPHY, kindLabels, rectangle, actor, paint, escapeXml } from './drawing.js';
import { mix } from '../visual-style.js';

const outline = (node, x, y) => node.kind === 'actor' ? actor(node, x, y) : rectangle(node, x, y, 7, sequenceHeaderHeight(node));
export function sequenceHeaderHeight(node) {
  const width = (node.size?.width ?? 280) - 28;
  const titles = layoutText(node.label, width, 20, 26).lines.length;
  const bodies = node.subtitle ? layoutText(node.subtitle, width, 16, 22).lines.length : 0;
  return (node.kind === 'actor' ? TYPOGRAPHY.sequenceActorHeader + (node.subtitle ? 22 : 0) : TYPOGRAPHY.sequenceHeader) + Math.max(0, titles - 1) * 26 + Math.max(0, bodies - 1) * 22;
}

function sequenceNode(node, x, y, fill, stroke, palette, locale) {
  const cx = x + node.size.width / 2;
  const actorNode = node.kind === 'actor';
  const header = sequenceHeaderHeight(node);
  const head = paint(outline(node, x, y), { fill, stroke, 'stroke-width': 1.5 });
  const titleLines = layoutText(node.label, node.size.width - 28, 20, 26).lines;
  const titleY = y + (actorNode ? 98 : node.subtitle ? 44 : 53);
  const label = (actorNode ? '' : text(cx, y + 20, translate(locale, kindLabels[node.kind] ?? node.kind), 'stereotype', ' text-anchor="middle"')) + titleLines.map((line, i) => text(cx, titleY + i * 26, line, 'participant-title', ' text-anchor="middle"')).join('');
  const subtitle = node.subtitle ? layoutText(node.subtitle, node.size.width - 28, 16, 22).lines.map((line, i) => text(cx, titleY + (titleLines.length - 1) * 26 + (actorNode ? 28 : 22) + i * 22, line, 'body', ' text-anchor="middle"')).join('') : '';
  const executions = (node.executionRects ?? []).map(item => `<rect class="sequence-execution" data-execution-id="${escapeXml(item.id)}" x="${x + item.x}" y="${y + item.y}" width="${item.width}" height="${item.height}" fill="${mix(item.color, palette.surface, .14)}" stroke="${item.color}" stroke-width="1.5"/>`).join('');
  return `<g><title>${escapeXml([node.label, node.subtitle].filter(Boolean).join(" · "))}</title><g class="sequence-head"><g class="${actorNode ? 'actor-figure' : 'participant-head'}">${head}</g>${label}${subtitle}</g><path class="lifeline" d="M ${cx} ${y + header}V ${y + node.size.height}" stroke="${palette.edge}" stroke-width="1" stroke-dasharray="4 6"/>${executions}</g>`;
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
