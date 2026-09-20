import { getDiagram } from './diagrams/registry.js';
import { sequenceHeaderHeight } from './diagrams/sequence.js';
import { cardTextLayout, layoutText } from './text-layout.js';
import { TYPOGRAPHY, kindLabels } from './visual-style.js';
import { translate } from './i18n.js';

// System fonts vary: reserve width beyond the estimate, then verify actual glyphs in the browser.
const singleLineWidth = (text, font) => Math.ceil(layoutText(String(text ?? '').replace(/\r?\n/g, ' '), Infinity, font).width * 1.15);
const rounded = size => Object.fromEntries(Object.entries(size).map(([key, value]) => [key, Math.ceil(value)]));

export function minimumNodeSize(node, type, locale = 'en') {
  const diagram = getDiagram(type), title = singleLineWidth(node.label, TYPOGRAPHY.title), body = singleLineWidth(node.subtitle, TYPOGRAPHY.body);
  if (type === 'state' && ['initial', 'final'].includes(node.kind)) {
    if (!node.subtitle) return { width: 28, height: 28 };
    const width = Math.max(title, body);
    return rounded({ width: width + 50, height: Math.max(80, layoutText(node.label, width, TYPOGRAPHY.title, 29).height + 5 + layoutText(node.subtitle, width, TYPOGRAPHY.body, 23.2).height + 16) });
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
  const size = { width: Math.max(240, Math.min(480, Math.max(title, body) + 60)), height: 100 };
  if (diagram.cardLayout) {
    const inset = diagram.contentInset?.({ ...node, size }) ?? 0;
    size.width = Math.max(size.width, singleLineWidth(translate(locale, kindLabels[node.kind] ?? node.kind), TYPOGRAPHY.small) + 70 + 2 * inset);
    size.height = Math.max(100, cardTextLayout({ ...node, size: { ...size, width: size.width - 2 * (diagram.contentInset?.({ ...node, size }) ?? 0) } }).minHeight);
    return rounded(size);
  }
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

export function measureFragmentText(group) {
  return {
    heading: layoutText(group.label, Infinity, TYPOGRAPHY.small),
    operands: (group.operands ?? []).map(operand => ({
      heading: layoutText(operand.label ?? operand.guard, 640, TYPOGRAPHY.small),
      body: layoutText(operand.body, 640, TYPOGRAPHY.body)
    }))
  };
}
