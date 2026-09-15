import { getDiagram } from './diagrams/registry.js';
import { escapeXml, coreNode, paint } from './diagrams/drawing.js';
import { nodeAppearance } from './visual-style.js';

export function renderNode(node, type, offsetX = 0, offsetY = 0, palette, locale, moduleColors) {
  const definition = getDiagram(type);
  if (!definition) throw new Error(`Unsupported diagram type: ${type}`);
  const { fill, stroke, moduleColor } = nodeAppearance(node, palette, moduleColors);
  const content = definition.render(node, node.position.x + offsetX, node.position.y + offsetY, fill, stroke, palette, locale);
  const description = [node.label, node.subtitle,
    ...(node.fields ?? []).map(field => `${field.key ? field.key + ' ' : ''}${field.name}: ${field.type}${field.nullable === undefined ? '' : ` (nullable: ${field.nullable})`}`),
    ...(node.attributes ?? []), ...(node.methods ?? [])].filter(Boolean).join('\n');
  const stripe = moduleColor && !['actor', 'initial', 'final', 'decision', 'choice', 'usecase'].includes(node.kind)
    ? `<path class="module-accent" d="M${node.position.x + offsetX + 20} ${node.position.y + offsetY + 3}H${node.position.x + offsetX + node.size.width - 20}" fill="none" stroke="${moduleColor}" stroke-width="5" stroke-linecap="round"/>`
    : '';
  return `<g class="node-drawing${coreNode(node) && !definition.compartments ? ' core-node' : ''}"><title>${escapeXml(description)}</title>${content}${stripe}</g>`;
}

export function renderSelection(node, type) {
  const definition = getDiagram(type);
  return { markup: paint(definition.outline(node, 0, 0)), height: definition.selectionHeight?.(node) ?? node.size.height };
}

export function renderMiniMapNode(node, type, x, y, width, height, fill, stroke, strokeWidth) {
  const definition = getDiagram(type);
  const scaled = { ...node, position: { x, y }, size: { width, height } };
  return paint(definition.outline(scaled, x, y), { fill, stroke, 'stroke-width': strokeWidth });
}
