import { centeredTitle, rectangle, paint, rectAnchor, roundedRectAnchor } from './drawing.js';

const outline = (node, x, y) => node.kind === 'dataStore'
  ? [['path', { d: `M${x + node.size.width} ${y}H${x}V${y + node.size.height}H${x + node.size.width}M${x + 12} ${y}V${y + node.size.height}` }]]
  : rectangle(node, x, y, node.kind === 'process' ? 24 : 10);
const textArea = node => ({ width: node.size.width - 32, height: node.size.height - 20 });
function dataflowNode(node, x, y, fill, stroke) {
  const area = textArea(node);
  return `<g class="shape-label">${paint(outline(node, x, y), { fill, stroke, 'stroke-width': 1.2 })}${centeredTitle(x + node.size.width / 2, y + node.size.height / 2, node.label, area.width, area.height, node.subtitle)}</g>`;
}

export default {
  id: 'dataflow', label: 'Data flow',
  nodeKinds: ["external", "process", "dataStore"],
  groupKinds: ["ownership", "external"],
  edgeKinds: ["data"],
  render: dataflowNode, outline, textArea,
  anchor: (node, side, offset) => node.kind === 'process' ? roundedRectAnchor(node, side, offset, 24) : rectAnchor(node, side, offset),
};
