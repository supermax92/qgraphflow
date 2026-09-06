import { cardTextLayout, layoutText } from '../text-layout.js';
import { TYPOGRAPHY, isCore as coreNode, dataKinds, kindLabels, nodeMetrics } from '../visual-style.js';
export { cardTextLayout, layoutText, TYPOGRAPHY, coreNode, dataKinds, kindLabels, nodeMetrics };

export function escapeXml(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}


export function fit(value, width) {
  return { value: String(value ?? ''), width };
}


export function text(x, y, value, className, extra = '') {
  const fitted = value && typeof value === 'object' && 'width' in value;
  const fontSize = Number(extra.match(/font-size:([\d.]+)px/)?.[1]) || {
    title: TYPOGRAPHY.title, 'shape-title': TYPOGRAPHY.title, 'participant-title': TYPOGRAPHY.title,
    body: TYPOGRAPHY.body, 'field-name': TYPOGRAPHY.body, 'field-type': TYPOGRAPHY.small,
    member: TYPOGRAPHY.body, 'entity-title': TYPOGRAPHY.title, 'compact-title': 14, 'compact-body': 10
  }[className] || TYPOGRAPHY.small;
  let content = fitted ? value.value : value;
  if (fitted && layoutText(content, Infinity, fontSize).width > value.width) {
    const available = Math.max(0, value.width - layoutText('…', Infinity, fontSize).width);
    content = available ? (layoutText(content, available, fontSize).lines[0] ?? '') + '…' : '…';
  }
  return `<text x="${x}" y="${y}" class="${className}"${extra}>${escapeXml(content)}</text>`;
}


export function centeredTitle(cx, cy, value, width) {
  const layout = layoutText(value, width, TYPOGRAPHY.title, TYPOGRAPHY.title * 1.45);
  return layout.lines.map((line, index) => text(cx, cy - (layout.lines.length - 1) * layout.lineHeight / 2 + TYPOGRAPHY.title * .35 + index * layout.lineHeight, line, 'shape-title', ' text-anchor="middle"')).join('');
}


export function mix(first, second, ratio) {
  const rgb = hex => hex.slice(1).match(/../g).map(value => parseInt(value, 16));
  const b = rgb(second);
  return '#' + rgb(first).map((value, index) => Math.round(value * ratio + b[index] * (1 - ratio)).toString(16).padStart(2, '0')).join('');
}


// Geometry is declared once by each diagram and painted by both node rendering and selection.
export function paint(outline, attributes = {}) {
  return outline.map(([tag, geometry]) => `<${tag}${Object.entries({ ...geometry, ...(Object.keys(attributes).length ? { class: 'node-surface' } : {}), ...attributes, ...(geometry.fill === undefined ? {} : { fill: geometry.fill }) }).map(([key, value]) => ` ${key}="${escapeXml(value)}"`).join('')}/>`).join('');
}
export const rectangle = (node, x, y, radius = 10, height = node.size.height) => [['rect', { x, y, width: node.size.width, height, rx: radius }]];
export const diamond = (node, x, y) => [['polygon', { points: `${x + node.size.width / 2},${y} ${x + node.size.width},${y + node.size.height / 2} ${x + node.size.width / 2},${y + node.size.height} ${x},${y + node.size.height / 2}` }]];
export const actor = (node, x, y) => {
  const cx = x + node.size.width / 2;
  return [['circle', { cx, cy: y + 13, r: 11 }], ['path', { d: `M${cx} ${y + 24}v29M${cx - 20} ${y + 35}h40M${cx} ${y + 53}l-17 23M${cx} ${y + 53}l17 23`, fill: 'none' }]];
};

export function svgStyles(palette, scope = '') {
  return `${scope}.heading{font:650 24px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink};letter-spacing:-.5px}
${scope}.meta{font:400 ${TYPOGRAPHY.small}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink3}}
${scope}.group{font:650 ${TYPOGRAPHY.small}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink2};letter-spacing:.4px}
${scope}.group-kind,${scope}.stereotype{font:600 ${TYPOGRAPHY.small}px ui-monospace,monospace;fill:${palette.ink3};letter-spacing:.7px}
${scope}.title,${scope}.participant-title{font:650 ${TYPOGRAPHY.title}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink}}
${scope}.shape-title{font:650 ${TYPOGRAPHY.title}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink}}
${scope}.body{font:400 ${TYPOGRAPHY.body}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink2}}
${scope}.edge,${scope}.cardinality{font:500 ${TYPOGRAPHY.body}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink2}}
${scope}.edge-bg{fill:${palette.surface};stroke:none}
${scope}.field-key{font:700 ${TYPOGRAPHY.small}px ui-monospace,monospace;fill:${palette.accent}}
${scope}.field-name{font:500 ${TYPOGRAPHY.body}px ui-monospace,monospace;fill:${palette.ink2}}
${scope}.compact-title{font:650 14px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink}}
${scope}.compact-body{font:400 10px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink2}}
${scope}.core-node .compact-title,${scope}.core-node .compact-body{fill:${palette.heroInk}}
${scope}.entity-title{font:650 ${TYPOGRAPHY.title}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink}}
${scope}.entity-meta{font:500 ${TYPOGRAPHY.small}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.data}}
${scope}.member{font:500 ${TYPOGRAPHY.body}px ui-monospace,monospace;fill:${palette.ink2}}
${scope}.field-type{font:400 ${TYPOGRAPHY.small}px ui-monospace,monospace;fill:${palette.ink3}}
${scope}.core-node .title,${scope}.core-node .shape-title,${scope}.core-node .participant-title{fill:${palette.heroInk}}
${scope}.core-node .body,${scope}.core-node .stereotype{fill:${palette.heroInk};opacity:.76}`;
}
