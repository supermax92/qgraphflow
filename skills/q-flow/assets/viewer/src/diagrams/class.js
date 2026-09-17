import { text, fit, TYPOGRAPHY, coreNode, nodeMetrics, rectangle, paint } from './drawing.js';
import { estimateLabelSize } from '../text-layout.js';

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
  return `<g filter="url(#node-shadow)">${paint(outline(node, x, y), { fill: palette.surface2, stroke, 'stroke-width': 1 })}<path d="M${x + 9} ${y}H${x + node.size.width - 9}Q${x + node.size.width} ${y} ${x + node.size.width} ${y + 9}V${attrY}H${x}V${y + 9}Q${x} ${y} ${x + 9} ${y}Z" fill="${fill}"/><rect x="${x + 1}" y="${methodY}" width="${node.size.width - 2}" height="${Math.max(0, node.size.height - header - attributeHeight - 1)}" fill="${palette.group}"/>${stereotype ? text(x + 13, y + 24, stereotype, 'stereotype', ` style="fill:${core ? palette.heroInk : palette.accent}"`) : ''}${text(x + 13, y + (stereotype ? 50 : TYPOGRAPHY.classHeader / 2 + 7), fit(node.label, textWidth), 'shape-title', core ? ` style="fill:${palette.heroInk}"` : '')}${node.subtitle ? text(x + 13, y + header - 10, fit(node.subtitle, textWidth), 'body') : ''}<path d="M${x} ${attrY}H${x + node.size.width}M${x} ${methodY}H${x + node.size.width}" stroke="${palette.rule}"/>${attrText}${methodText}</g>`;
}


export default {
  dashedKinds: ['implementation', 'dependency'],
  id: 'class', label: '类图',
  nodeKinds: ["class", "interface", "abstract"],
  groupKinds: [],
  edgeKinds: ["association", "inheritance", "implementation", "composition", "aggregation", "dependency"],
  render: classNode, outline, compartments: true,
  undirected: ['association', 'composition', 'aggregation'],
  markers: { inheritance: { end: 'triangle' }, implementation: { end: 'triangle' }, composition: { start: 'diamond-filled' }, aggregation: { start: 'diamond-open' }, dependency: { end: 'arrow-open' } },
  edgeLabel: edge => edge.label ?? (['composition', 'aggregation', 'inheritance', 'implementation'].includes(edge.kind) ? edge.kind : ''),
  validateEdge(edge, label, errors) {
    for (const role of ['source', 'target']) {
      const value = edge[`${role}Multiplicity`];
      if (value === undefined) continue;
      const range = typeof value === 'string' && /^(\d+)(?:\.\.(\d+|\*))?$/.exec(value);
      if (value !== '*' && (!range || range[2] && range[2] !== '*' && Number(range[2]) < Number(range[1]))) errors.push(`${label}.${role}Multiplicity must be *, a non-negative integer, or an ascending range`);
      if (['inheritance', 'implementation', 'dependency'].includes(edge.kind)) errors.push(`${label}.${role}Multiplicity is only supported on associations, aggregation and composition`);
    }
  },
  endpointLabels(edge, points) {
    return ['source', 'target'].flatMap(role => {
      const label = edge[`${role}Multiplicity`];
      if (label === undefined) return [];
      const point = role === 'source' ? points[0] : points.at(-1), neighbor = role === 'source' ? points[1] : points.at(-2), size = estimateLabelSize(label);
      const horizontal = point.y === neighbor.y, direction = Math.sign(horizontal ? neighbor.x - point.x : neighbor.y - point.y);
      const center = horizontal ? { x: point.x + direction * (24 + size.width / 2), y: point.y - 6 - size.height / 2 }
        : { x: point.x + 6 + size.width / 2, y: point.y + direction * (24 + size.height / 2) };
      return [{ role, label, labelPoint: center, labelBox: { x: center.x - size.width / 2, y: center.y - size.height / 2, ...size } }];
    });
  },
};
