import { TYPOGRAPHY } from './visual-style.js';

const textWidth = (value, fontSize) => [...value].reduce((width, character) => width + fontSize * (/[^\u0000-\u00ff]|[MW@%&]/.test(character) ? 1 : 6.8 / 12), 0);

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

export function estimateLabelSize(value) {
  const layout = layoutText(value, Infinity);
  return layout.lines.length ? { width: Math.max(24, layout.width + 12), height: layout.height + 6 } : { width: 0, height: 0 };
}

