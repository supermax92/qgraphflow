import { translate } from '../i18n.js';
import { cardTextLayout, text, fit, coreNode, dataKinds, kindLabels, nodeMetrics, rectangle, paint } from './drawing.js';

export function genericCard(node, x, y, fill, stroke, palette, locale) {
  const { compact } = nodeMetrics(node, 'architecture');
  const width = node.size.width - (compact ? 20 : 30);
  const { title, subtitle } = cardTextLayout(node);
  const titleText = title.lines.map((line, index) => text(x + 15, y + 68 + index * title.lineHeight, line, 'title')).join('');
  const subtitleText = subtitle.lines.map((line, index) => text(x + 15, y + 68 + title.height + index * subtitle.lineHeight, line, 'body')).join('');
  const core = coreNode(node);

  const tone = core ? palette.heroInk : dataKinds.has(node.kind) ? palette.data : palette.ink;
  const icon = dataKinds.has(node.kind) ? '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>'
    : ['external', 'actor'].includes(node.kind) ? '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>'
    : ['security', 'config'].includes(node.kind) ? '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>'
    : '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h4"/>';
  if (compact) return `<g>${paint(cardOutline(node, x, y), { fill, stroke })}<svg x="${x + 12}" y="${y + 10}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${tone}" stroke-width="1.5">${icon}</svg>${text(x + 33, y + 20, translate(locale, kindLabels[node.kind] ?? node.kind), 'stereotype', ' style="font-size:8px"')}${text(x + 10, y + 41, fit(node.label, width), 'compact-title')}${text(x + 10, y + 57, fit(node.subtitle ?? '', width), 'compact-body')}</g>`;
  const device = node.kind === 'device' ? `<rect x="${x + 3}" y="${y + 3}" width="${node.size.width}" height="${node.size.height}" rx="7" fill="${palette.rule}"/>` : '';
  const container = node.kind === 'container' ? `<path d="M${x + 7} ${y + 1}H${x + node.size.width - 7}" stroke="${palette.accent}" stroke-width="3"/>` : '';
  return `<g filter="url(#node-shadow)">${device}${paint(cardOutline(node, x, y), { fill, stroke, 'stroke-width': 1 })}${container}<rect x="${x + 15}" y="${y + 13}" width="25" height="25" rx="6" fill="${core ? palette.hero : palette.group}"/><svg x="${x + 20}" y="${y + 18}" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${tone}" stroke-width="1.5">${icon}</svg>${text(x + 47, y + 29, translate(locale, kindLabels[node.kind] ?? node.kind), 'stereotype')}${titleText}${subtitleText}</g>`;
}


export const cardOutline = (node, x, y) => rectangle(node, x, y, node.kind === 'artifact' ? 3 : ['device', 'container'].includes(node.kind) ? 7 : 10);
