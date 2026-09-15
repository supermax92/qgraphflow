import { translate } from './i18n.js';
import { getDiagram, isDashed } from './diagrams/registry.js';
import { nodeAppearance } from './visual-style.js';

export function graphLegend(graph, palette, moduleColors) {
  const definition = getDiagram(graph.meta.diagramType);
  const entries = new Map();
  for (const node of graph.nodes) {
    const appearance = nodeAppearance(node, palette);
    const shape = node.kind === 'actor' ? 'actor' : ['initial', 'final'].includes(node.kind) ? node.kind : definition.compartments ? 'compartment' : 'box';
    const id = `${appearance.role}-${shape}`;
    entries.set(id, { id, ...appearance, shape });
  }
  for (const module of [...new Set([...graph.nodes.map(node => node.module), ...graph.edges.map(edge => edge.module)].filter(Boolean))].sort()) {
    const color = moduleColors?.get(module);
    if (color) entries.set(`module-${module}`, { id: `module-${module}`, role: 'module', label: module, shape: 'module', fill: color, stroke: color });
  }
  if (graph.edges.some(edge => !isDashed(edge, graph.meta.diagramType))) entries.set('solid', { id: 'solid', label: '实线关系', shape: 'solid', stroke: palette.edge });
  if (graph.edges.some(edge => isDashed(edge, graph.meta.diagramType))) entries.set('dashed', { id: 'dashed', label: '虚线：关系记法 / 框架约定 / 推断', shape: 'dashed', stroke: palette.edge });
  return [...entries.values()].map(entry => ({ ...entry, label: translate(graph.meta.locale, entry.label) }));
}
