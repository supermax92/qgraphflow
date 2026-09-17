import { createEdgeRoutes, graphBounds, pathFromPoints, layoutText, cardinalityMarks } from './edge-routing.js';
import { getDiagram, edgeMarkers, isDashed } from './diagrams/registry.js';
import { renderNode } from './node-svg.js';
import { text, fit, mix, escapeXml, svgStyles } from './diagrams/drawing.js';
import { PALETTES, dataKinds, edgeColor, sequenceGroupColor, TYPOGRAPHY } from './visual-style.js';
import { RADIX_COLORS_NOTICE } from './radix-colors.js';
import { sequencePairs, sequenceExecutions } from './sequence-executions.js';
import { sequenceFragment, renderFragment, fragmentDepth } from './sequence-fragments.js';
import { requireDiagramQuality } from './layout-quality.js';
export { cardinalityMarks } from './edge-routing.js';

function diagramType(graph) {
  return graph.meta.diagramType ?? 'architecture';
}

function groupColors(kind, palette) {
  if (['external', 'alt'].includes(kind)) return [mix(palette.warnSoft, palette.surface, .62), mix(palette.warn, palette.rule, .23)];
  if (kind === 'opt') return [palette.accentSoft, palette.rule];
  return [palette.group, palette.rule];
}

function edgeMarker(edge, type, target, moduleColors, source, pair) {
  const { end } = edgeMarkers(edge, type);
  if (!end) return '';
  if (end !== 'arrow') return ` marker-end="url(#${end})"`;
  const marker = pair ? 'arrow-module' : edge.kind === 'failure' ? 'arrow-warn' : edge.kind === 'success' ? 'arrow-ok' : moduleColors?.has(edge.module ?? source?.module ?? target?.module) ? 'arrow-module' : dataKinds.has(target?.kind) ? 'arrow-data' : 'arrow';
  return ` marker-end="url(#${marker})"`;
}

function edgeStartMarker(edge, type) {
  const { start } = edgeMarkers(edge, type);
  return start ? ` marker-start="url(#${start})"` : '';
}

function renderGroup(group, offsetX, offsetY, palette, fragment) {
  const x = group.position.x + offsetX;
  const y = group.position.y + offsetY;
  const [fill, stroke] = groupColors(group.kind, palette);
  const label = fit(group.label, fragment?.heading?.width ?? group.size.width - (['alt', 'opt', 'loop', 'par'].includes(group.kind) ? 88 : 32));
  return `<g data-diagram-group-id="${escapeXml(group.id)}"><title>${escapeXml(group.label)}</title><rect x="${x}" y="${y}" width="${group.size.width}" height="${group.size.height}" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="1"${group.kind === 'external' ? ' stroke-dasharray="6 6"' : ''}/>${text(fragment?.heading ? fragment.heading.x + offsetX : x + 16, y + 23, label, 'group')}${['alt', 'opt', 'loop', 'par'].includes(group.kind) ? text(x + group.size.width - 16, y + 25, group.kind, 'group-kind', ' text-anchor="end"') : ''}</g>`;
}

function renderEdge(edge, route, type, offsetX, offsetY, palette, target, moduleColors, source, pair) {
  const stroke = edgeColor(edge, target, palette, moduleColors, source, pair);
  const dash = isDashed(edge, type) ? ' stroke-dasharray="7 6"' : '';
  const label = route.label;
  const labelX = route.labelPoint.x + offsetX;
  const labelY = route.labelPoint.y + offsetY;
  const labelSize = route.labelBox;
  const pairLine = pair ? `<path d="M${labelX - layoutText(route.labelLines[0], Infinity).width / 2} ${labelY - labelSize.height / 2 + 3 + TYPOGRAPHY.body + 3}h${layoutText(pair.label, Infinity).width}" stroke="${stroke}" stroke-width="2"/>` : '';
  const background = label ? `<rect x="${labelX - labelSize.width / 2}" y="${labelY - labelSize.height / 2}" width="${labelSize.width}" height="${labelSize.height}" rx="4" class="edge-bg"/>` : '';
  const cardinalities = getDiagram(type).cardinalities ? [
    cardinalityMarks(edge.sourceCardinality, route.points[0], route.points[1]),
    cardinalityMarks(edge.targetCardinality, route.points.at(-1), route.points.at(-2))
  ].map((mark, index) => `<g data-cardinality-endpoint="${index ? 'target' : 'source'}" transform="translate(${offsetX} ${offsetY})" fill="none" stroke="${palette.accent}" stroke-width="1.5"><path d="${mark.path}"/>${mark.circle ? `<circle cx="${mark.circle.cx}" cy="${mark.circle.cy}" r="${mark.circle.r}" fill="${palette.surface}"/>` : ''}</g>`).join('') : '';
  const multiplicities = (route.endpointLabels ?? []).map(item => `<g class="edge-multiplicity" data-endpoint="${item.role}"><rect x="${item.labelBox.x + offsetX}" y="${item.labelBox.y + offsetY}" width="${item.labelBox.width}" height="${item.labelBox.height}" rx="4" class="edge-bg"/>${text(item.labelPoint.x + offsetX, item.labelBox.y + offsetY + 3 + TYPOGRAPHY.body, item.label, 'edge', ' text-anchor="middle"')}</g>`).join('');
  return `<g data-diagram-edge-id="${escapeXml(edge.id)}"><path d="${pathFromPoints(route.points, offsetX, offsetY)}" fill="none" stroke="${stroke}" stroke-width="1.5"${dash}${edgeMarker(edge, type, target, moduleColors, source, pair)}${edgeStartMarker(edge, type)}/>${cardinalities}${background}${pairLine}${label ? route.labelLines.map((line, index) => text(labelX, labelY - labelSize.height / 2 + 3 + TYPOGRAPHY.body + index * TYPOGRAPHY.edgeLineHeight, line, 'edge', ' text-anchor="middle"')).join('') : ''}${multiplicities}</g>`;
}

export function createDiagramSvg(graph, theme = 'light', moduleColors) {
  requireDiagramQuality(graph);
  const palette = PALETTES[theme] ?? PALETTES.light;
  const type = diagramType(graph);
  const routes = createEdgeRoutes(graph);
  const pairs = sequencePairs(graph), executions = sequenceExecutions(graph);
  const nodeById = new Map(graph.nodes.map(node => [node.id, node]));
  const bounds = graphBounds(graph, routes);
  const margin = 64;
  const width = bounds.width + margin * 2;
  const titleLayout = layoutText(graph.meta.title, width - margin * 2, 24);
  const subtitleLayout = layoutText(graph.meta.subtitle ?? '', width - margin * 2, TYPOGRAPHY.small);
  const subtitleY = 66 + Math.max(0, titleLayout.lines.length - 1) * titleLayout.lineHeight;
  const header = Math.max(88, subtitleLayout.lines.length ? subtitleY + (subtitleLayout.lines.length - 1) * subtitleLayout.lineHeight + 22 : 43 + Math.max(0, titleLayout.lines.length - 1) * titleLayout.lineHeight + 24);
  const height = bounds.height + margin * 2 + header;
  const offsetX = margin - bounds.x;
  const offsetY = margin + header - bounds.y;
  const fragments = new Map((graph.groups ?? []).map(group => [group.id, type === 'sequence' ? sequenceFragment(group, routes, graph.meta.locale, graph.groups ?? [], executions) : null]));
  const groups = [...(graph.groups ?? [])].sort((a, b) => fragmentDepth(a, graph.groups ?? []) - fragmentDepth(b, graph.groups ?? [])).map(group => renderGroup(group, offsetX, offsetY, palette, fragments.get(group.id)) + (type === 'sequence' ? renderFragment({ ...fragments.get(group.id), guards: [], bodies: [] }, group, offsetX, offsetY, palette.ink3, palette.surface) : '')).join('');
  const fragmentText = type === 'sequence' ? (graph.groups ?? []).map(group => renderFragment({ ...fragments.get(group.id), separators: [] }, group, offsetX, offsetY, palette.ink3, palette.surface)).join('') : '';

  const edges = graph.edges.map(edge => renderEdge(edge, routes.get(edge.id), type, offsetX, offsetY, palette, nodeById.get(edge.target), moduleColors, nodeById.get(edge.source), pairs.get(edge.id))).join('');
  const nodes = graph.nodes.map(node => renderNode({ ...node, executionRects: executions.filter(item => item.participantId === node.id).map(item => ({ ...item, x: item.x - node.position.x, y: item.y - node.position.y, color: sequenceGroupColor(pairs.get(item.start.edgeId), palette) ?? palette.edge })) }, type, offsetX, offsetY, palette, graph.meta.locale, moduleColors)).join('');
  const boardX = 24;
  const boardY = header;
  const boardWidth = width - 48;
  const boardHeight = height - header - 24;

  return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Radix Colors\n${RADIX_COLORS_NOTICE}-->\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-graph-offset-x="${offsetX}" data-graph-offset-y="${offsetY}" role="img" aria-labelledby="title desc"><title id="title">${escapeXml(graph.meta.title)}</title><desc id="desc">${escapeXml(type)} diagram for ${escapeXml(graph.meta.sourceRef)}</desc><defs><filter id="node-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="${palette.ink}" flood-opacity=".045"/></filter><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${palette.edge}"/></marker><marker id="arrow-module" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker><marker id="arrow-warn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${palette.warn}"/></marker><marker id="arrow-ok" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${palette.accent}"/></marker><marker id="arrow-data" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${palette.data}"/></marker><marker id="arrow-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L9 5L1 9" fill="none" stroke="context-stroke" stroke-width="1.5"/></marker><marker id="triangle" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M1 1L11 6L1 11Z" fill="${palette.surface}" stroke="${palette.edge}"/></marker><marker id="diamond-filled" viewBox="0 0 14 10" refX="1" refY="5" markerWidth="12" markerHeight="10" orient="auto"><path d="M1 5L7 1L13 5L7 9Z" fill="${palette.edge}"/></marker><marker id="diamond-open" viewBox="0 0 14 10" refX="1" refY="5" markerWidth="12" markerHeight="10" orient="auto"><path d="M1 5L7 1L13 5L7 9Z" fill="${palette.surface}" stroke="${palette.edge}"/></marker><style>${svgStyles(palette)}</style></defs><rect width="100%" height="100%" fill="${palette.paper}"/><rect x="${boardX}" y="${boardY}" width="${boardWidth}" height="${boardHeight}" rx="16" fill="${palette.surface}" stroke="${palette.rule}"/>${titleLayout.lines.map((line, index) => text(margin, 43 + index * titleLayout.lineHeight, line, 'heading')).join('')}${subtitleLayout.lines.map((line, index) => text(margin, subtitleY + index * subtitleLayout.lineHeight, line, 'meta')).join('')}${groups}${type === 'sequence' ? nodes + edges : edges + nodes}${fragmentText}</svg>\n`;
}
