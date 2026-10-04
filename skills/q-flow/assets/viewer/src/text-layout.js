import { TYPOGRAPHY } from './visual-style.js';
import { LAYOUT_LIMITS, LAYOUT_TARGETS } from './layout-spacing.js';

// Conservative system-font widths keep server-rendered SVG and browser labels in the same bounds.
const textWidth = (value, fontSize) => [...value].reduce((width, character) => width + fontSize * (/[^\u0000-\u00ff]|[MWmw@%&]/.test(character) ? 1 : /[A-Z]/.test(character) ? .8 : 6.8 / 12), 0);

// A token (text between spaces) that fits on a line is never cut, so text without over-long tokens wraps exactly as it
// always did. A token longer than the line is cut where it reads best instead of at the first character that overflows:
// between CJK characters, then at an identifier's own separators (`_ . / - = ,` and camelCase humps), and only then
// anywhere. Closing punctuation never starts a line and opening punctuation never ends one; the neighbour travels along.
const CJK_CHARACTER = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\u3000-\\u303f\\uff00-\\uffef';
const CJK = new RegExp(`[${CJK_CHARACTER}]`, 'u');
const PIECES = new RegExp(`[${CJK_CHARACTER}]|[^${CJK_CHARACTER}]+`, 'gu');
const SEPARATORS = /(?<=[_./\\\-=,;:|&)>\]}])|(?<=[a-z0-9])(?=[A-Z])/u;
const NO_LINE_START = new Set([...'，。、．；：！？）］｝〕】》〉」』”’…']);
const NO_LINE_END = new Set([...'（［｛〔【《〈「『“‘']);
const canBreak = (before, after) => !NO_LINE_END.has([...before].at(-1)) && !NO_LINE_START.has([...after][0]);

function cutPieces(token, fontSize, limit) {
  const pieces = [];
  for (const run of token.match(PIECES)) {
    if (CJK.test(run) || textWidth(run, fontSize) <= limit) pieces.push(run);
    else for (const part of run.split(SEPARATORS)) pieces.push(...(textWidth(part, fontSize) <= limit ? [part] : part));
  }
  return pieces;
}

export function layoutText(value, maxWidth, fontSize = TYPOGRAPHY.body, lineHeight = fontSize * 1.5) {
  const content = String(value ?? '');
  if (!content) return { lines: [], width: 0, height: 0, lineHeight };
  const limit = Math.max(1, maxWidth);
  const lines = [];
  for (const paragraph of content.split(/\r?\n/)) {
    let line = '';
    let width = 0;
    let cuts = []; // offsets in `line` where a token or piece starts: the places a kinsoku carry may cut
    const wrap = () => {
      lines.push(line);
      line = '';
      width = 0;
      cuts = [];
    };
    for (const token of paragraph.match(/\s+|\S+/g) ?? []) {
      const tokenWidth = textWidth(token, fontSize);
      if (line && tokenWidth <= limit && width + tokenWidth > limit) wrap();
      cuts.push(line.length);
      if (tokenWidth <= limit || /^\s/.test(token)) {
        for (const character of token) {
          const characterWidth = textWidth(character, fontSize);
          if (line && width + characterWidth > limit) wrap();
          line += character;
          width += characterWidth;
        }
        continue;
      }
      for (const piece of cutPieces(token, fontSize, limit)) {
        const pieceWidth = textWidth(piece, fontSize);
        if (line && width + pieceWidth > limit) {
          if (canBreak(line, piece)) wrap();
          else {
            let k = cuts.length - 1;
            while (k >= 0 && !(cuts[k] > 0 && canBreak(line.slice(0, cuts[k]), line.slice(cuts[k])))) k--;
            if (k >= 0) {
              const offset = cuts[k];
              lines.push(line.slice(0, offset));
              line = line.slice(offset);
              width = textWidth(line, fontSize);
              cuts = cuts.slice(k).map(cut => cut - offset);
            }
          }
        }
        cuts.push(line.length);
        line += piece;
        width += pieceWidth;
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

// Each character of the joined label keeps the role of its part (the space between two parts keeps the role it follows);
// the wrapped lines are cut along those roles. Null when the lines do not spell the label (multi-paragraph text).
export function labelRunsByLine(lines, parts) {
  if (lines.join('') !== parts.map(part => part.text).join(' ')) return null;
  const roles = parts.flatMap((part, index) => [...(index ? [parts[index - 1].role] : []), ...Array.from({ length: part.text.length }, () => part.role)]);
  let offset = 0;
  return lines.map(line => {
    const runs = [];
    for (let i = 0; i < line.length; i++) {
      const role = roles[offset + i];
      if (runs.at(-1)?.role === role) runs.at(-1).text += line[i]; else runs.push({ text: line[i], role });
    }
    offset += line.length;
    return runs;
  });
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
