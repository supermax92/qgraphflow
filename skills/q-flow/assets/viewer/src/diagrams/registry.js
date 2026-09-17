import architecture from './architecture.js';
import flowchart from './flowchart.js';
import sequence from './sequence.js';
import er from './er.js';
import deployment from './deployment.js';
import classDiagram from './class.js';
import state from './state.js';
import usecase from './usecase.js';
import dataflow from './dataflow.js';

// Add a diagram module here; navigation, validation, drawing and exports use this same list.
export const DIAGRAMS = [architecture, flowchart, sequence, er, deployment, classDiagram, state, usecase, dataflow];
export const DIAGRAM_TYPES = DIAGRAMS.map(diagram => diagram.id);
export const diagramLabels = Object.fromEntries(DIAGRAMS.map(diagram => [diagram.id, diagram.label]));
const byId = new Map(DIAGRAMS.map(diagram => [diagram.id, diagram]));
if (byId.size !== DIAGRAMS.length) throw new Error('Duplicate diagram type');
export const getDiagram = (type = 'architecture') => byId.get(type);
// Starting space budgets only; content bounds still determine the actual canvas and exports.
export const canvasBudgetFor = type => getDiagram(type).sequence ? null
  : ['flowchart', 'state'].includes(type) ? { width: 1600, height: 2400 } : { width: 2400, height: 1600 };
export const hasArrow = (edge, type) => !(getDiagram(type).undirected ?? []).includes(edge.kind);
export const isDashed = (edge, type) => !(type === 'sequence' && edge.kind === 'sync') && (['framework', 'inference'].includes(edge.evidence) || (getDiagram(type).dashedKinds ?? []).includes(edge.kind));

export const edgeMarkers = (edge, type) => ({ start: null, end: hasArrow(edge, type) ? 'arrow' : null, ...getDiagram(type).markers?.[edge.kind] });
