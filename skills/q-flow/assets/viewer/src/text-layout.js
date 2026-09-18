import { TYPOGRAPHY } from './visual-style.js';
import { LAYOUT_LIMITS, LAYOUT_TARGETS } from './layout-spacing.js';

// Conservative system-font widths keep server-rendered SVG and browser labels in the same bounds.
const textWidth = (value, fontSize) => [...value].reduce((width, character) => width + fontSize * (/[^\u0000-\u00ff]|[MWmw@%&]/.test(character) ? 1 : /[A-Z]/.test(character) ? .8 : 6.8 / 12), 0);

export function layoutText(value, maxWidth, fontSize = TYPOGRAPHY.body, lineHeight = fontSize * 1.5) {
  const content = String(value ?? '');
  if (!content) return { lines: [], width: 0, height: 0, lineHeight };
  const limit = Math.max(1, maxWidth);
  const lines = [];
  for (const paragraph of content.split(/\r?\n/)) {
    let line = '';
    let width = 0;
    for (const token of paragraph.match(/\s+|\S+/g) ?? []) {
      const tokenWidth = textWidth(token, fontSize);
      if (line && tokenWidth <= limit && width + tokenWidth > limit) {
        lines.push(line);
        line = '';
        width = 0;
      }
      for (const character of token) {
        const characterWidth = textWidth(character, fontSize);
        if (line && width + characterWidth > limit) {
          lines.push(line);
          line = '';
          width = 0;
        }
        line += character;
        width += characterWidth;
      }
    }
    lines.push(line);
  }
  return { lines, width: Math.ceil(Math.max(...lines.map(line => textWidth(line, fontSize)))), height: lines.length * lineHeight, lineHeight };
}

export function cardTextLayout(node) {
  const width = node.size.width - 30;
  const title = layoutText(node.label, width, TYPOGRAPHY.title, 26);
  const subtitle = layoutText(node.subtitle ?? '', width, TYPOGRAPHY.body, 24);
  return { title, subtitle, minHeight: 65 + title.height + subtitle.height };
}

export function edgeLabelLayout(value, maxWidth = LAYOUT_TARGETS.labelWidth) {
  const layout = layoutText(value, maxWidth);
  return { ...layout, width: layout.lines.length ? Math.max(24, layout.width + 12) : 0, height: layout.lines.length ? layout.height + 6 : 0 };
}

export function estimateLabelSize(value, maxWidth) {
  const { width, height } = edgeLabelLayout(value, maxWidth);
  return { width, height };
}

export function groupHeadingLayout(group) {
  const width = Math.min(LAYOUT_TARGETS.headingWidth, Math.max(1, (group.size?.width ?? Infinity) - 2 * LAYOUT_LIMITS.groupInset));
  // Reserve the same letter spacing as the SVG group heading, plus a font margin.
  const layout = layoutText(group.label, width, TYPOGRAPHY.small + 1.12, 22);
  return { ...layout, height: 12 + layout.height };
}
