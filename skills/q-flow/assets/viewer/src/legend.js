import { translate } from './i18n.js';
import { getDiagram, isDashed } from './diagrams/registry.js';
import { nodeAppearance } from './visual-style.js';

export function graphLegend(graph, palette) {
  const definition = getDiagram(graph.meta.diagramType);
  const entries = new Map();
  for (const node of graph.nodes) {
    const appearance = nodeAppearance(node, palette);
    const shape = node.kind === 'actor' ? 'actor' : ['initial', 'final'].includes(node.kind) ? node.kind : definition.compartments ? 'compartment' : 'box';
    const id = `${appearance.role}-${shape}`;
    entries.set(id, { id, ...appearance, shape });
  }
  if (graph.edges.some(edge => !isDashed(edge, graph.meta.diagramType))) entries.set('solid', { id: 'solid', label: '实线关系', shape: 'solid', stroke: palette.edge });
  if (graph.edges.some(edge => isDashed(edge, graph.meta.diagramType))) entries.set('dashed', { id: 'dashed', label: '虚线：关系记法 / 框架约定 / 推断', shape: 'dashed', stroke: palette.edge });
  return [...entries.values()].map(entry => ({ ...entry, label: translate(graph.meta.locale, entry.label) }));
}
