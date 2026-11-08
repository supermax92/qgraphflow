// A view without an ID is known by its diagram type; repeated views of any type require authored IDs.
export const viewIdOf = graph => graph?.meta?.viewId ?? graph?.meta?.diagramType ?? 'architecture';

// One presentation per semantic type; the architecture type is drawn as component relations.
export const VIEW_TYPES = Object.freeze([
  { id: 'relations', type: 'architecture', label: 'Component relationship architecture' },
  { id: 'flowchart', type: 'flowchart', label: 'Flowchart' },
  { id: 'sequence', type: 'sequence', label: 'Sequence' },
  { id: 'er', type: 'er', label: 'ER diagram' },
  { id: 'deployment', type: 'deployment', label: 'Deployment' },
  { id: 'class', type: 'class', label: 'Class diagram' },
  { id: 'state', type: 'state', label: 'State diagram' },
  { id: 'usecase', type: 'usecase', label: 'Use cases' },
  { id: 'dataflow', type: 'dataflow', label: 'Data flow' }
]);
export const viewTypeOf = graph => (graph?.meta?.diagramType ?? 'architecture') === 'architecture' ? 'relations' : graph.meta.diagramType;
export const viewTypeLabel = graph => VIEW_TYPES.find(view => view.id === viewTypeOf(graph))?.label ?? graph?.meta?.diagramType ?? 'Component relationship architecture';
export const compareViews = (a, b) => {
  const rank = graph => { const index = VIEW_TYPES.findIndex(view => view.id === viewTypeOf(graph)); return index < 0 ? VIEW_TYPES.length : index; };
  return rank(a) - rank(b);
};
