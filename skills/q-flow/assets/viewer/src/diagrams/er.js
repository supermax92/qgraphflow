import { text, fit, mix, layoutText, TYPOGRAPHY, coreNode, nodeMetrics, rectangle, paint } from './drawing.js';

const outline = (node, x, y) => rectangle(node, x, y, 9);

function erNode(node, x, y, fill, stroke, palette) {
  const { erHeaderHeight: header, erRowHeight: rowHeight, erFontSize: fontSize } = nodeMetrics(node, 'er');
  const core = coreNode(node);
  const rows = node.fields.map((field, index) => {
    const rowY = y + header + index * rowHeight;
    const baseline = rowY + rowHeight / 2 + fontSize * .35;
    const typeWidth = Math.min(node.size.width * .55, layoutText(field.type, Infinity, Math.min(TYPOGRAPHY.small, fontSize)).width);
    return `${field.key === 'FK' ? `<rect x="${x + 1}" y="${rowY}" width="${node.size.width - 2}" height="${rowHeight}" fill="${mix(palette.warnSoft, palette.surface2, .48)}"/>` : ''}${index ? `<path d="M${x} ${rowY}H${x + node.size.width}" stroke="${palette.ruleSoft}"/>` : ''}${field.key ? text(x + 10, baseline - 1, field.key, 'field-key', ` style="fill:${field.key === 'FK' ? palette.warn : palette.data}"`) : ''}${text(x + 45, baseline, fit(field.name, Math.max(1, node.size.width - 62 - typeWidth)), 'field-name', ` style="font-size:${fontSize}px"`)}${text(x + node.size.width - 10, baseline - 1, fit(field.type, typeWidth), 'field-type', ` text-anchor="end" style="font-size:${Math.min(TYPOGRAPHY.small, fontSize)}px"`)}`;
  }).join('');
  return `<g filter="url(#node-shadow)">${paint(outline(node, x, y), { fill: palette.surface2, stroke, 'stroke-width': 1 })}<path d="M${x + 9} ${y}H${x + node.size.width - 9}Q${x + node.size.width} ${y} ${x + node.size.width} ${y + 9}V${y + header}H${x}V${y + 9}Q${x} ${y} ${x + 9} ${y}Z" fill="${fill}"/><path d="M${x} ${y + header}H${x + node.size.width}" stroke="${palette.rule}"/>${text(x + 13, y + header * .43, fit(node.label, node.size.width - 26), 'entity-title', ` style="font-size:${Math.min(TYPOGRAPHY.title, header * .38)}px;fill:${core ? palette.heroInk : palette.ink}"`)}${text(x + 13, y + header * .78, node.subtitle ?? '实体', 'entity-meta', ` style="font-size:${Math.min(TYPOGRAPHY.small, header * .22)}px;fill:${core ? palette.heroInk : palette.data}"`)}${text(x + node.size.width - 13, y + header * .78, String(node.fields.length).padStart(2, '0'), 'entity-meta', ` text-anchor="end" style="font-size:${Math.min(TYPOGRAPHY.small, header * .22)}px;fill:${core ? palette.heroInk : palette.data}"`)}${rows}</g>`;
}


export default {
  id: 'er', label: 'ER 图',
  nodeKinds: ["entity"],
  groupKinds: [],
  edgeKinds: ["relationship"],
  render: erNode, outline,
  compartments: true, cardinalities: true, endpointStub: 28,
  undirected: ['relationship'],
  validateNode(node, label, errors, { requireString }) {
    if (!Array.isArray(node?.fields) || node.fields.length === 0) errors.push(`${label}.fields must be a non-empty array for er`);
    else for (const [index, field] of node.fields.entries()) {
      const prefix = `${label}.fields[${index}]`;
      requireString(field?.name, `${prefix}.name`, errors);
      requireString(field?.type, `${prefix}.type`, errors);
      if (field?.key !== undefined && !['PK', 'FK', 'UK'].includes(field.key)) errors.push(`${prefix}.key is unsupported`);
      if (field?.nullable !== undefined && typeof field.nullable !== 'boolean') errors.push(`${prefix}.nullable must be boolean`);
    }
  },
  validateEdge(edge, label, errors) {
    for (const field of ['sourceCardinality', 'targetCardinality']) if (!['1', '0..1', '*', '1..*', '0..*'].includes(edge?.[field])) errors.push(`${label}.${field} is unsupported`);
  },
};
