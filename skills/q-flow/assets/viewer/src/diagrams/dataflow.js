import { centeredTitle, rectangle, paint, rectAnchor, roundedRectAnchor } from './drawing.js';

const outline = (node, x, y) => rectangle(node, x, y, node.kind === 'dataStore' ? 4 : node.kind === 'process' ? 24 : 10);
function dataflowNode(node, x, y, fill, stroke) {
  const inner = node.kind === 'dataStore' ? `<path d="M ${x + 11} ${y}V ${y + node.size.height}M ${x + node.size.width - 12} ${y}V ${y + node.size.height}" stroke="${stroke}"/>` : '';
  return `<g class="shape-label">${paint(outline(node, x, y), { fill, stroke, 'stroke-width': 1.2 })}${inner}${centeredTitle(x + node.size.width / 2, y + node.size.height / 2, node.label, node.size.width - 32, node.size.height - 20)}</g>`;
}

export default {
  id: 'dataflow', label: '数据流图',
  nodeKinds: ["external", "process", "dataStore"],
  groupKinds: ["ownership", "external"],
  edgeKinds: ["data"],
  render: dataflowNode, outline,
  anchor: (node, side, offset) => node.kind === 'process' ? roundedRectAnchor(node, side, offset, 24) : rectAnchor(node, side, offset),
};
