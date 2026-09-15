import { text, fit, TYPOGRAPHY, coreNode, nodeMetrics, rectangle, paint } from './drawing.js';

const outline = (node, x, y) => rectangle(node, x, y, 9);

function classNode(node, x, y, fill, stroke, palette) {
  const attributes = node.attributes ?? [];
  const methods = node.methods ?? [];
  const { classHeaderHeight: header, classRowHeight: rowHeight } = nodeMetrics(node, 'class');
  const attributeHeight = attributes.length ? attributes.length * rowHeight + 13 : 30;
  const attrY = y + header;
  const methodY = attrY + attributeHeight;
  const core = coreNode(node);
  const stereotype = node.kind === 'interface' ? '«interface»' : node.kind === 'abstract' ? '«abstract»' : '';
  const textWidth = node.size.width - 26;
  const attrText = attributes.map((item, index) => text(x + 13, attrY + 6 + rowHeight / 2 + TYPOGRAPHY.body * .35 + index * rowHeight, fit(item, textWidth), 'member')).join('');
  const methodText = methods.map((item, index) => text(x + 13, methodY + 6 + rowHeight / 2 + TYPOGRAPHY.body * .35 + index * rowHeight, fit(item, textWidth), 'member')).join('');
  return `<g filter="url(#node-shadow)">${paint(outline(node, x, y), { fill: palette.surface2, stroke, 'stroke-width': 1 })}<path d="M${x + 9} ${y}H${x + node.size.width - 9}Q${x + node.size.width} ${y} ${x + node.size.width} ${y + 9}V${attrY}H${x}V${y + 9}Q${x} ${y} ${x + 9} ${y}Z" fill="${fill}"/><rect x="${x + 1}" y="${methodY}" width="${node.size.width - 2}" height="${Math.max(0, node.size.height - header - attributeHeight - 1)}" fill="${palette.group}"/>${stereotype ? text(x + 13, y + 24, stereotype, 'stereotype', ` style="fill:${core ? palette.heroInk : palette.accent}"`) : ''}${text(x + 13, y + (stereotype ? 50 : header / 2 + 7), fit(node.label, textWidth), 'shape-title', core ? ` style="fill:${palette.heroInk}"` : '')}<path d="M${x} ${attrY}H${x + node.size.width}M${x} ${methodY}H${x + node.size.width}" stroke="${palette.rule}"/>${attrText}${methodText}</g>`;
}


export default {
  dashedKinds: ['implementation', 'dependency'],
  id: 'class', label: '类图',
  nodeKinds: ["class", "interface", "abstract"],
  groupKinds: [],
  edgeKinds: ["association", "inheritance", "implementation", "composition", "aggregation", "dependency"],
  render: classNode, outline, compartments: true,
  undirected: ['association', 'composition', 'aggregation'],
  markers: { inheritance: { end: 'triangle' }, implementation: { end: 'triangle' }, composition: { start: 'diamond-filled' }, aggregation: { start: 'diamond-open' } },
  edgeLabel: edge => edge.label ?? (['composition', 'aggregation', 'inheritance', 'implementation'].includes(edge.kind) ? edge.kind : ''),
};
