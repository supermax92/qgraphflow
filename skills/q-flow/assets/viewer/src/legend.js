import { translate } from './i18n.js';
import { getDiagram, isDashed } from './diagrams/registry.js';
import { nodeAppearance } from './visual-style.js';

export function graphLegend(graph, palette, moduleColors) {
  const definition = getDiagram(graph.meta.diagramType);
  const entries = new Map();
  for (const node of graph.nodes) {
    const appearance = nodeAppearance(node, palette, moduleColors);
    const shape = node.kind === 'actor' ? 'actor' : ['initial', 'final'].includes(node.kind) ? node.kind : definition.compartments ? 'compartment' : 'box';
    const id = `${appearance.role}-${shape}`;
    entries.set(id, { id, ...appearance, shape });
  }
  for (const module of [...new Set([...graph.nodes.map(node => node.module), ...graph.edges.map(edge => edge.module)].filter(Boolean))].sort()) {
    const tone = moduleColors?.get(module);
    if (tone) entries.set(`module-${module}`, { id: `module-${module}`, role: 'module', label: module, shape: 'module', fill: tone.chip, stroke: tone.accent });
  }
  if (graph.edges.some(edge => !isDashed(edge, graph.meta.diagramType))) entries.set('solid', { id: 'solid', label: 'Solid relation', shape: 'solid', stroke: palette.edge });
  if (graph.edges.some(edge => isDashed(edge, graph.meta.diagramType))) entries.set('dashed', { id: 'dashed', label: 'Dashed: notation / convention / inference', shape: 'dashed', stroke: palette.edge });
  if (definition.sequence) for (const [kind, label] of [['sync', 'Synchronous message'], ['async', 'Asynchronous message'], ['return', 'Return message']]) {
    if (graph.edges.some(edge => edge.kind === kind)) entries.set(kind, { id: kind, label, shape: kind, stroke: palette.edge });
  }
  if (definition.sequence && graph.executions?.length) entries.set('execution', { id: 'execution', label: 'Activation: execution interval; offset means nesting', shape: 'execution', fill: palette.accentSoft, stroke: palette.accent });
  if (definition.sequence && graph.edges.some(edge => edge.replyTo)) entries.set('pair', { id: 'pair', label: 'C ID: paired call and return share a color', shape: 'solid', stroke: palette.accent });
  if (definition.sequence && graph.groups?.some(group => group.kind === 'par')) entries.set('parallel', { id: 'parallel', label: 'par: concurrent branches; vertical position is not order', shape: 'dashed', stroke: palette.edge });
  return [...entries.values()].map(entry => ({ ...entry, label: translate(graph.meta.locale, entry.label) }));
}
