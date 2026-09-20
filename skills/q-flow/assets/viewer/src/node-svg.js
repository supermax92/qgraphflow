import { getDiagram } from './diagrams/registry.js';
import { escapeXml, coreNode, paint } from './diagrams/drawing.js';
import { nodeAppearance } from './visual-style.js';

export function renderNode(node, type, offsetX = 0, offsetY = 0, palette, locale, moduleColors) {
  const definition = getDiagram(type);
  if (!definition) throw new Error(`Unsupported diagram type: ${type}`);
  const appearance = nodeAppearance(node, palette, moduleColors), { fill, stroke, ring } = appearance;
  const x = node.position.x + offsetX, y = node.position.y + offsetY;
  const content = definition.render({ ...node, appearance }, x, y, fill, stroke, palette, locale);
  // A soft ring behind the frame marks the business center or an explicit failure without touching the text.
  const halo = ring && !['actor', 'initial', 'final'].includes(node.kind) ? paint(definition.outline(node, x, y), { class: 'role-ring', fill: 'none', stroke: ring, 'stroke-width': 5 }) : '';
  const description = [node.label, node.subtitle,
    ...(node.fields ?? []).map(field => `${field.key ? field.key + ' ' : ''}${field.name}: ${field.type}${field.nullable === undefined ? '' : ` (nullable: ${field.nullable})`}`),
    ...(node.attributes ?? []), ...(node.methods ?? [])].filter(Boolean).join('\n');
  return `<g data-diagram-node-id="${escapeXml(node.id)}" class="node-drawing${coreNode(node) && !definition.compartments ? ' core-node' : ''}"><title>${escapeXml(description)}</title>${halo}${content}</g>`;
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
