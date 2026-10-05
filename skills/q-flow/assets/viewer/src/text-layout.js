import { TYPOGRAPHY, kindLabels } from './visual-style.js';
import { translate } from './i18n.js';
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

// Component card: the icon plate, the title and the kind tag share the first row; the subtitle and the source anchor (file
// name and lines) follow in the same text column. The whole block is centred vertically in a taller card.
export const CARD = Object.freeze({ pad: 14, plate: 24, textX: 48, tagGap: 8, tagPad: 8, titleLine: 26, subtitleLine: 24, sourceLine: 20, minHeight: 64, maxWidth: 360 });
// The card shows where a component is defined (file name and first line); the quick look and Inspector give the full path and range.
export const cardSourceText = node => node.source?.file ? `${node.source.file.split('/').at(-1)}:${node.source.lineStart}` : '';
// A source line never wraps: a file name too long for the column keeps its start and end around an ellipsis.
function oneLine(value, width, fontSize) {
  const colon = value.lastIndexOf(':'), name = value.slice(0, colon), line = value.slice(colon);
  for (let keep = name.length - 1; textWidth(value, fontSize) > width && keep > 4; keep--) value = `${name.slice(0, Math.ceil(keep / 2))}…${name.slice(name.length - Math.floor(keep / 2))}${line}`;
  return value;
}
export const cardTag = (node, locale) => {
  const value = translate(locale, kindLabels[node.kind] ?? node.kind);
  // The stereotype style adds .6px letter spacing.
  return { text: value, width: Math.ceil(textWidth(value, TYPOGRAPHY.small) + value.length * .6) + 2 * CARD.tagPad };
};

// classic: the card drawn before compact cards (kind row above a full-width title, no source line). Views whose stored
// geometry predates compact cards keep it; see compactCards.
// corner: extra room right of the kind tag for notation drawn in the card's top-right corner.
export function cardTextLayout(node, locale, classic = false, corner = 0) {
  if (classic) {
    const title = layoutText(node.label, node.size.width - 30, TYPOGRAPHY.title, 26), subtitle = layoutText(node.subtitle ?? '', node.size.width - 30, TYPOGRAPHY.body, 24);
    return { title, subtitle, minHeight: Math.max(100, 65 + title.height + subtitle.height) };
  }
  const tag = cardTag(node, locale), column = node.size.width - CARD.textX - CARD.pad;
  const title = layoutText(node.label, column - tag.width - CARD.tagGap - corner, TYPOGRAPHY.title, CARD.titleLine);
  const subtitle = layoutText(node.subtitle ?? '', column, TYPOGRAPHY.body, CARD.subtitleLine);
  const source = layoutText(oneLine(cardSourceText(node), column, TYPOGRAPHY.small), column, TYPOGRAPHY.small, CARD.sourceLine);
  const contentHeight = CARD.pad + title.height + (subtitle.height ? 4 + subtitle.height : 0) + (source.height ? 6 + source.height : 0) + CARD.pad;
  return { title, subtitle, source, tag, contentHeight, minHeight: Math.max(CARD.minHeight, contentHeight) };
}

export function edgeLabelLayout(value, maxWidth = LAYOUT_TARGETS.labelWidth) {
  const layout = layoutText(value, maxWidth);
  return { ...layout, width: layout.lines.length ? Math.max(24, layout.width + 12) : 0, height: layout.lines.length ? layout.height + 6 : 0 };
}

// Each character of the joined label keeps the role of its part (the space between two parts keeps the role it follows);
// the wrapped lines are cut along those roles. Paragraph breaks inside a part are not drawn, so they are skipped between
// lines. Null when the lines do not spell the label.
export function labelRunsByLine(lines, parts) {
  const label = parts.map(part => part.text).join(' ');
  const roles = parts.flatMap((part, index) => [...(index ? [parts[index - 1].role] : []), ...Array.from({ length: part.text.length }, () => part.role)]);
  let offset = 0;
  const runsByLine = lines.map(line => {
    while (label[offset] === '\r' || label[offset] === '\n') offset++;
    if (!label.startsWith(line, offset)) return null;
    const runs = [];
    for (let i = 0; i < line.length; i++) {
      const role = roles[offset + i];
      if (runs.at(-1)?.role === role) runs.at(-1).text += line[i]; else runs.push({ text: line[i], role });
    }
    offset += line.length;
    return runs;
  });
  while (label[offset] === '\r' || label[offset] === '\n') offset++;
  return offset === label.length && runsByLine.every(Boolean) ? runsByLine : null;
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
