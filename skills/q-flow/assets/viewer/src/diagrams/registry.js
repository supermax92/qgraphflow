import { hasOverviewContent, overviewCardLayout } from '../architecture-overview.js';
import architecture from './architecture.js';
import flowchart from './flowchart.js';
import sequence from './sequence.js';
import er from './er.js';
import deployment from './deployment.js';
import classDiagram from './class.js';
import state from './state.js';
import usecase from './usecase.js';
import dataflow from './dataflow.js';
import { cardTextLayout } from '../text-layout.js';

// Add a diagram module here; navigation, validation, drawing and exports use this same list.
export const DIAGRAMS = [architecture, flowchart, sequence, er, deployment, classDiagram, state, usecase, dataflow];
export const DIAGRAM_TYPES = DIAGRAMS.map(diagram => diagram.id);
export const diagramLabels = Object.fromEntries(DIAGRAMS.map(diagram => [diagram.id, diagram.label]));
const byId = new Map(DIAGRAMS.map(diagram => [diagram.id, diagram]));
if (byId.size !== DIAGRAMS.length) throw new Error('Duplicate diagram type');
export const diagramTypeOf = graph => graph?.meta?.diagramType ?? 'architecture';
export const getDiagram = (type = 'architecture') => byId.get(type);
// Starting space budgets only; content bounds still determine the actual canvas and exports.
export const canvasBudgetFor = type => getDiagram(type).sequence ? null
  : ['flowchart', 'state'].includes(type) ? { width: 1600, height: 2400 } : { width: 2400, height: 1600 };
// Card text inside the inset margins of the node's outline.
export const cardText = (node, type, locale, classic = false) => type === 'architecture' && hasOverviewContent(node) ? overviewCardLayout(node) : cardTextLayout({ ...node, size: { ...node.size, width: node.size.width - 2 * (getDiagram(type).contentInset?.(node) ?? 0) } }, locale, classic, getDiagram(type).cardCorner?.(node));
// A view uses compact cards when every card fits them; geometry stored before compact cards keeps the classic cards until it
// is laid out again, so preserved layouts stay valid and one view never mixes the two.
export const compactCards = graph => {
  const type = diagramTypeOf(graph);
  return !getDiagram(type).cardLayout || graph.nodes.every(node => !node.size || node.size.height >= cardText(node, type, graph.meta?.locale).minHeight);
};
export const hasArrow = (edge, type) => !(getDiagram(type).undirected ?? []).includes(edge.kind);
export const isDashed = (edge, type) => !(type === 'sequence' && edge.kind === 'sync') && (['framework', 'inference'].includes(edge.evidence) || (getDiagram(type).dashedKinds ?? []).includes(edge.kind));

// Diagrams whose labels carry roles (a state transition's trigger, guard and effect) name the palette color of each role.
export const labelRoleColors = (type, palette) => Object.fromEntries(Object.entries(getDiagram(type)?.labelRoleColors ?? {}).map(([role, key]) => [role, palette[key]]));

export const edgeMarkers = (edge, type) => ({ start: null, end: hasArrow(edge, type) ? 'arrow' : null, ...getDiagram(type).markers?.[edge.kind] });
