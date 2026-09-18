import { translate } from './i18n.js';
import { getDiagram, isDashed } from './diagrams/registry.js';
import { nodeAppearance } from './visual-style.js';

export function graphLegend(graph, palette, moduleColors) {
  const definition = getDiagram(graph.meta.diagramType);
  const entries = new Map();
  for (const node of graph.nodes) {
    const appearance = nodeAppearance(node, palette, moduleColors);
    // Module entries describe identity; do not advertise an unused role-colored outline.
    if (moduleColors?.has(node.module) && appearance.role !== 'warning' && !['actor', 'initial', 'final'].includes(node.kind)) continue;
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
  if (definition.sequence) for (const [kind, label] of [['sync', '同步消息'], ['async', '异步消息'], ['return', '返回消息']]) {
    if (graph.edges.some(edge => edge.kind === kind)) entries.set(kind, { id: kind, label, shape: kind, stroke: palette.edge });
  }
  if (definition.sequence && graph.executions?.length) entries.set('execution', { id: 'execution', label: '激活条：执行区间，错位表示嵌套', shape: 'execution', fill: palette.accentSoft, stroke: palette.accent });
  if (definition.sequence && graph.edges.some(edge => edge.replyTo)) entries.set('pair', { id: 'pair', label: 'C 编号：调用与返回配对，同组同色', shape: 'solid', stroke: palette.accent });
  if (definition.sequence && graph.groups?.some(group => group.kind === 'par')) entries.set('parallel', { id: 'parallel', label: 'par：分支并行，上下排列不代表先后', shape: 'dashed', stroke: palette.edge });
  return [...entries.values()].map(entry => ({ ...entry, label: translate(graph.meta.locale, entry.label) }));
}
