import { CARD, cardTag } from '../text-layout.js';
import { cardTextLayout, text, coreNode, dataKinds, paint } from './drawing.js';

export function genericCard(node, x, y, fill, stroke, palette, locale, outline, contentInset = 0, corner = 0) {
  if (node.classicCard) return classicCard(node, x, y, fill, stroke, palette, locale, outline, contentInset);
  const { title, subtitle, source, tag, contentHeight } = cardTextLayout({ ...node, size: { ...node.size, width: node.size.width - contentInset * 2 } }, locale, false, corner);
  // Baselines sit 20/17/14px below the top of their 26/24/20px lines.
  const left = x + contentInset, row = y + Math.max(0, (node.size.height - contentHeight) / 2) + CARD.pad, column = left + CARD.textX;
  const subtitleTop = row + title.height + (subtitle.height ? 4 : 0), sourceTop = subtitleTop + subtitle.height + (source.height ? 6 : 0);
  const titleText = title.lines.map((line, index) => text(column, row + 20 + index * title.lineHeight, line, 'title')).join('');
  const subtitleText = subtitle.lines.map((line, index) => text(column, subtitleTop + 17 + index * subtitle.lineHeight, line, 'body')).join('');
  const sourceText = source.lines.map((line, index) => text(column, sourceTop + 14 + index * source.lineHeight, line, 'meta')).join('');
  const plate = { x: left + CARD.pad, y: row + (CARD.titleLine - CARD.plate) / 2 }, tagX = x + node.size.width - contentInset - CARD.pad - tag.width - corner;
  return `<g filter="url(#node-shadow)">${frame(node, x, y, fill, stroke, outline)}${iconPlate(node, plate.x, plate.y, CARD.plate, palette)}<rect x="${tagX}" y="${row + 3}" width="${tag.width}" height="20" rx="6" fill="${palette.badge}"/>${text(tagX + tag.width / 2, row + 18, tag.text, 'stereotype', ' text-anchor="middle"')}${titleText}${subtitleText}${sourceText}</g>`;
}

const frame = (node, x, y, fill, stroke, outline) => paint(outline(node, x, y), { fill, stroke, 'stroke-width': node.appearance?.moduleColor || node.appearance?.ring ? 1.5 : 1 });

// The icon plate is the identity chip: solid module color with a white glyph. Without a module it stays a quiet plate
// whose glyph takes the role tone. Titles never change color.
function iconPlate(node, x, y, size, palette) {
  const chip = node.appearance?.chip;
  const tone = chip ? '#ffffff' : coreNode(node) ? palette.accent : dataKinds.has(node.kind) ? palette.data : node.kind === 'failure' ? palette.warn : palette.ink2;
  const inset = (size - 15) / 2;
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="7" fill="${chip ?? palette.badge}"/><svg x="${x + inset}" y="${y + inset}" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${tone}" stroke-width="${chip ? 1.75 : 1.5}">${cardIcon(node)}</svg>`;
}

const cardIcon = node => dataKinds.has(node.kind) ? '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>'
  : ['external', 'actor'].includes(node.kind) ? '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>'
  : ['security', 'config'].includes(node.kind) ? '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>'
  : '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h4"/>';

// The card drawn before compact cards, kept for views whose stored geometry predates them (see compactCards).
function classicCard(node, x, y, fill, stroke, palette, locale, outline, contentInset) {
  const { title, subtitle } = cardTextLayout({ ...node, size: { ...node.size, width: node.size.width - contentInset * 2 } }, locale, true);
  const titleText = title.lines.map((line, index) => text(x + 15 + contentInset, y + 68 + index * title.lineHeight, line, 'title')).join('');
  const subtitleText = subtitle.lines.map((line, index) => text(x + 15 + contentInset, y + 68 + title.height + index * subtitle.lineHeight, line, 'body')).join('');
  return `<g filter="url(#node-shadow)">${frame(node, x, y, fill, stroke, outline)}${iconPlate(node, x + 15 + contentInset, y + 13, 25, palette)}${text(x + 47 + contentInset, y + 29, cardTag(node, locale).text, 'stereotype')}${titleText}${subtitleText}</g>`;
}
