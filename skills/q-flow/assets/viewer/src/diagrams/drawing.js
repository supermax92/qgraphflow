import { cardTextLayout, layoutText, groupHeadingLayout } from '../text-layout.js';
import { TYPOGRAPHY, isCore as coreNode, dataKinds, kindLabels, nodeMetrics } from '../visual-style.js';
export { cardTextLayout, layoutText, TYPOGRAPHY, coreNode, dataKinds, kindLabels, nodeMetrics };

export function groupHeadingSvg(group, x = 0, y = 0) {
  return groupHeadingLayout(group).lines.map((line, i) => text(x + 16, y + 26 + i * 22, line, 'group')).join('');
}

export function groupFrameSvg(group, appearance, x = 0, y = 0) {
  const radius = ['loop', 'par'].includes(group.kind) ? 5 : 14;
  return `<rect class="boundary-frame" x="${x}" y="${y}" width="${group.size.width}" height="${group.size.height}" rx="${radius}" fill="${appearance.fill}" stroke="${appearance.stroke}" stroke-width="1"/>`;
}

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
    body: TYPOGRAPHY.body, 'field-name': TYPOGRAPHY.body, 'field-type': TYPOGRAPHY.body,
    member: TYPOGRAPHY.body, 'entity-title': TYPOGRAPHY.title, 'compact-title': 14, 'compact-body': 10
  }[className] || TYPOGRAPHY.small;
  let content = fitted ? value.value : value;
  if (fitted && layoutText(content, Infinity, fontSize).width > value.width) {
    const available = Math.max(0, value.width - layoutText('…', Infinity, fontSize).width);
    content = available ? (layoutText(content, available, fontSize).lines[0] ?? '') + '…' : '…';
  }
  return `<text x="${x}" y="${y}" class="${className}"${extra}>${escapeXml(content)}</text>`;
}


export function centeredTitle(cx, cy, value, width, height = Infinity, subtitle = '') {
  if (width <= 0 || height <= 0) return '';
  const title = layoutText(value, width, TYPOGRAPHY.title, 29);
  const body = layoutText(subtitle, width, TYPOGRAPHY.body, 23.2);
  const titleCount = Math.min(title.lines.length, Math.max(1, Math.floor(height / title.lineHeight)));
  const bodyCount = Math.min(body.lines.length, Math.max(0, Math.floor((height - titleCount * title.lineHeight - 5) / body.lineHeight)));
  const usedHeight = titleCount * title.lineHeight + (bodyCount ? 5 + bodyCount * body.lineHeight : 0);
  const top = cy - usedHeight / 2;
  const lines = (layout, count, y, className) => layout.lines.slice(0, count).map((line, index) =>
    text(cx, y + index * layout.lineHeight, line + (index === count - 1 && count < layout.lines.length ? '…' : ''), className, ' text-anchor="middle"')).join('');
  const markup = lines(title, titleCount, top + 22, 'shape-title')
    + lines(body, bodyCount, top + titleCount * title.lineHeight + 5 + 18, 'body');
  // Legacy tiny symbols may be shorter than one title line; only their text is scaled to the available height.
  const scale = Math.min(1, height / usedHeight);
  return scale < 1 ? `<g transform="translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})">${markup}</g>` : markup;
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

const nodeCenter = node => ({ x: node.position.x + node.size.width / 2, y: node.position.y + node.size.height / 2 });
export function rectAnchor(node, side, offset = 0, inset = 0) {
  const middle = nodeCenter(node);
  const values = typeof inset === 'number' ? { left: inset, right: inset, top: inset, bottom: inset } : { left: 0, right: 0, top: 0, bottom: 0, ...inset };
  if (side === 'left' || side === 'right') return {
    x: node.position.x + (side === 'left' ? values.left : node.size.width - values.right),
    y: middle.y + offset
  };
  return {
    x: middle.x + offset,
    y: node.position.y + (side === 'top' ? values.top : node.size.height - values.bottom)
  };
}

export function roundedRectAnchor(node, side, offset = 0, radius = 10) {
  const { x, y } = node.position, { width, height } = node.size;
  const middle = nodeCenter(node), r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (side === 'left' || side === 'right') {
    const py = middle.y + offset;
    if (py < y || py > y + height) return rectAnchor(node, side, offset);
    const circleY = py < y + r ? y + r : py > y + height - r ? y + height - r : py;
    const curve = Math.sqrt(Math.max(0, r * r - (py - circleY) ** 2));
    return { x: side === 'left' ? x + r - curve : x + width - r + curve, y: py };
  }
  const px = middle.x + offset;
  if (px < x || px > x + width) return rectAnchor(node, side, offset);
  const circleX = px < x + r ? x + r : px > x + width - r ? x + width - r : px;
  const curve = Math.sqrt(Math.max(0, r * r - (px - circleX) ** 2));
  return { x: px, y: side === 'top' ? y + r - curve : y + height - r + curve };
}

export function ellipseAnchor(node, side, offset = 0, insetX = 0, insetY = 0) {
  const middle = nodeCenter(node), rx = Math.max(1, node.size.width / 2 - insetX), ry = Math.max(1, node.size.height / 2 - insetY);
  if (side === 'left' || side === 'right') {
    const py = middle.y + offset;
    if (Math.abs(offset) > ry) return rectAnchor(node, side, offset);
    const dx = rx * Math.sqrt(Math.max(0, 1 - ((py - middle.y) / ry) ** 2));
    return { x: middle.x + (side === 'left' ? -dx : dx), y: py };
  }
  const px = middle.x + offset;
  if (Math.abs(offset) > rx) return rectAnchor(node, side, offset);
  const dy = ry * Math.sqrt(Math.max(0, 1 - ((px - middle.x) / rx) ** 2));
  return { x: px, y: middle.y + (side === 'top' ? -dy : dy) };
}

export function polygonAnchor(node, side, offset = 0, normalizedPoints) {
  const points = normalizedPoints.map(([px, py]) => ({ x: node.position.x + px * node.size.width, y: node.position.y + py * node.size.height }));
  const middle = nodeCenter(node);
  const horizontal = side === 'left' || side === 'right';
  const fixed = horizontal ? middle.y + offset : middle.x + offset;
  const hits = [];
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index], b = points[(index + 1) % points.length];
    const first = horizontal ? a.y : a.x, second = horizontal ? b.y : b.x;
    if (fixed < Math.min(first, second) || fixed > Math.max(first, second) || first === second) continue;
    const ratio = (fixed - first) / (second - first);
    hits.push((horizontal ? a.x : a.y) + ratio * ((horizontal ? b.x : b.y) - (horizontal ? a.x : a.y)));
  }
  if (!hits.length) return rectAnchor(node, side, offset);
  const value = side === 'left' || side === 'top' ? Math.min(...hits) : Math.max(...hits);
  return horizontal ? { x: value, y: fixed } : { x: fixed, y: value };
}

export function actorAnchor(node, side, offset = 0, top = 0) {
  const cx = node.position.x + node.size.width / 2, y = node.position.y + top;
  if (side === 'left') return { x: cx - 20, y: y + 35 };
  if (side === 'right') return { x: cx + 20, y: y + 35 };
  if (side === 'top') return { x: cx, y: y + 2 };
  return { x: cx + Math.sign(offset || 1) * Math.min(17, Math.abs(offset)), y: y + 76 };
}

export function svgStyles(palette, scope = '') {
  return `${scope}.heading{font:650 24px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink};letter-spacing:-.5px}
${scope}.meta{font:400 ${TYPOGRAPHY.small}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink3}}
${scope}.group{font:650 ${TYPOGRAPHY.small}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink2};letter-spacing:.4px}
${scope}[data-diagram-group-id]>.group{fill:${palette.ink2}}
${scope}.group-kind{font:600 ${TYPOGRAPHY.small}px ui-monospace,monospace;fill:${palette.ink2};letter-spacing:.7px}
${scope}.stereotype{font:600 ${TYPOGRAPHY.small}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink3};letter-spacing:.6px}
${scope}.title,${scope}.participant-title{font:650 ${TYPOGRAPHY.title}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink}}
${scope}.shape-title{font:650 ${TYPOGRAPHY.title}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink}}
${scope}.body{font:400 ${TYPOGRAPHY.body}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink2}}
${scope}.edge,${scope}.cardinality{font:500 ${TYPOGRAPHY.body}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink2}}
${scope}.edge-bg{fill:${palette.surface};stroke:none}
${scope}.field-key{font:700 ${TYPOGRAPHY.small}px ui-monospace,monospace;fill:${palette.accent}}
${scope}.field-name{font:500 ${TYPOGRAPHY.body}px ui-monospace,monospace;fill:${palette.ink2}}
${scope}.compact-title{font:650 14px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink}}
${scope}.compact-body{font:400 10px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink2}}
${scope}.entity-title{font:650 ${TYPOGRAPHY.title}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink}}
${scope}.entity-meta{font:500 ${TYPOGRAPHY.small}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;fill:${palette.ink2}}
${scope}.member{font:500 ${TYPOGRAPHY.body}px ui-monospace,monospace;fill:${palette.ink2}}
${scope}.field-type{font:400 ${TYPOGRAPHY.body}px ui-monospace,monospace;fill:${palette.ink3}}
`;
}
