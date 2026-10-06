import { hasOverviewContent, overviewCardLayout } from './architecture-overview.js';
import { getDiagram } from './diagrams/registry.js';
import { sequenceHeaderHeight } from './diagrams/sequence.js';
import { CARD, cardSourceText, cardTag, cardTextLayout, layoutText } from './text-layout.js';
import { TYPOGRAPHY } from './visual-style.js';
import { STATE_ACTIONS, STATE_ACTION_INSET, stateActivities } from './diagrams/state.js';

// System fonts vary: reserve width beyond the estimate, then verify actual glyphs in the browser.
const singleLineWidth = (text, font) => Math.ceil(layoutText(String(text ?? '').replace(/\r?\n/g, ' '), Infinity, font).width * 1.15);
const rounded = size => Object.fromEntries(Object.entries(size).map(([key, value]) => [key, Math.ceil(value)]));

export function minimumNodeSize(node, type, locale = 'en') {
  if (type === 'architecture' && hasOverviewContent(node)) return { width: 300, height: overviewCardLayout(node, node.size?.width ?? 300).minHeight };
  const diagram = getDiagram(type), title = singleLineWidth(node.label, TYPOGRAPHY.title), body = singleLineWidth(node.subtitle, TYPOGRAPHY.body);
  if (type === 'state' && ['initial', 'final'].includes(node.kind)) {
    if (!node.subtitle) return { width: 28, height: 28 };
    const width = Math.max(title, body);
    return rounded({ width: width + 50, height: Math.max(80, layoutText(node.label, width, TYPOGRAPHY.title, 29).height + 5 + layoutText(node.subtitle, width, TYPOGRAPHY.body, 23.2).height + 16) });
  }
  if (type === 'state' && STATE_ACTIONS.some(key => node.kind === 'state' && typeof node[key] === 'string' && node[key].trim())) {
    // Title compartment (at least 72) above the action compartment, whose height follows the width it wraps at.
    const width = Math.max(240, Math.min(480, Math.max(Math.max(title, body) + 60, ...STATE_ACTIONS.filter(key => node[key]).map(key => singleLineWidth(node[key], TYPOGRAPHY.small) + STATE_ACTION_INSET))));
    const heading = layoutText(node.label, width - 24, TYPOGRAPHY.title, 29), subtitle = layoutText(node.subtitle, width - 24, TYPOGRAPHY.body, 23.2);
    return rounded({ width, height: Math.max(72, heading.height + (subtitle.height ? 5 + subtitle.height : 0) + 16) + stateActivities({ ...node, size: { width, height: 0 } }).height });
  }
  if (diagram.sequence || node.kind === 'actor') return { width: Math.max(160, title + 28, body + 28), height: diagram.sequence ? sequenceHeaderHeight(node) + 48 : 104 + (node.subtitle ? 24 : 0) };
  if (diagram.cardinalities) {
    const fields = node.fields.map(field => {
      const name = singleLineWidth(field.name, TYPOGRAPHY.body), type = singleLineWidth(field.type, TYPOGRAPHY.body);
      return Math.max(name + type + 74, type / .55);
    });
    return rounded({ width: Math.max(240, title + 26, body + 60, ...fields), height: Math.max(TYPOGRAPHY.erHeader / .4, TYPOGRAPHY.erHeader + node.fields.length * TYPOGRAPHY.erRow) });
  }
  if (diagram.compartments) {
    const attributes = node.attributes ?? [], methods = node.methods ?? [];
    return rounded({ width: Math.max(240, title + 26, body + 26, ...[...attributes, ...methods].map(value => singleLineWidth(value, TYPOGRAPHY.body) + 26)),
      height: TYPOGRAPHY.classHeader + (node.subtitle ? 24 : 0) + (attributes.length ? attributes.length * TYPOGRAPHY.classRow + 13 : 30) + (methods.length ? methods.length * TYPOGRAPHY.classRow + 13 : 30) });
  }
  if (diagram.cardLayout) {
    // One-line title beside the plate and kind tag where the width cap allows; longer text wraps and the card grows taller.
    const corner = diagram.cardCorner?.(node) ?? 0;
    const needed = Math.max(title + cardTag(node, locale).width + CARD.tagGap + corner, body, singleLineWidth(cardSourceText(node), TYPOGRAPHY.small)) + CARD.textX + CARD.pad;
    // Outlines with slanted sides (hexagon, parallelogram, octagon) inset the text on both sides.
    const inset = diagram.contentInset?.({ ...node, size: { width: Math.min(CARD.maxWidth, needed + 56), height: 0 } }) ?? 0;
    const size = { width: Math.max(240, Math.min(CARD.maxWidth, needed + 2 * inset)), height: 0 };
    size.height = cardTextLayout({ ...node, size: { ...size, width: size.width - 2 * (diagram.contentInset?.({ ...node, size }) ?? 0) } }, locale, false, corner).minHeight;
    return rounded(size);
  }
  const size = { width: Math.max(240, Math.min(480, Math.max(title, body) + 60)), height: 100 };
  const textArea = diagram.textArea ?? (node => ({ width: node.size.width - 36, height: node.size.height - 20 }));
  // All supported safety regions grow monotonically with height. Bounded expansion also handles diamond/ellipse insets.
  for (let i = 0; i < 16; i++) {
    const area = textArea({ ...node, size });
    const titleText = layoutText(node.label, area.width, TYPOGRAPHY.title, 29), subtitle = layoutText(node.subtitle, area.width, TYPOGRAPHY.body, 23.2);
    const required = titleText.height + (subtitle.height ? 5 + subtitle.height : 0);
    if (area.height >= required) return rounded(size);
    size.height += Math.ceil((required - area.height) * 2 + 2);
  }
  throw new Error(`Cannot measure full text for ${type} node ${node.id}`);
}
