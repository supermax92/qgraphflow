import { getDiagram } from './diagrams/registry.js';
import { escapeXml, coreNode, paint } from './diagrams/drawing.js';
import { nodeAppearance } from './visual-style.js';

export function renderNode(node, type, offsetX = 0, offsetY = 0, palette) {
  const definition = getDiagram(type);
  if (!definition) throw new Error(`Unsupported diagram type: ${type}`);
  const { fill, stroke } = nodeAppearance(node, palette);
  const content = definition.render(node, node.position.x + offsetX, node.position.y + offsetY, fill, stroke, palette);
  const description = [node.label, node.subtitle,
    ...(node.fields ?? []).map(field => `${field.key ? field.key + ' ' : ''}${field.name}: ${field.type}${field.nullable === undefined ? '' : ` (nullable: ${field.nullable})`}`),
    ...(node.attributes ?? []), ...(node.methods ?? [])].filter(Boolean).join('\n');
  return `<g class="node-drawing${coreNode(node) && !definition.compartments ? ' core-node' : ''}"><title>${escapeXml(description)}</title>${content}</g>`;
}

export function renderSelection(node, type) {
  const definition = getDiagram(type);
  return { markup: paint(definition.outline(node, 0, 0)), height: definition.selectionHeight?.(node) ?? node.size.height };
}
