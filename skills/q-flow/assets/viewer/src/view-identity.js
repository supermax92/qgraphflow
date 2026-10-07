// Legacy collections use their unique diagram type as identity. Repeated architecture views require authored IDs.
export const viewIdOf = graph => graph?.meta?.viewId ?? graph?.meta?.diagramType ?? 'architecture';
export const architectureViewOf = graph => graph?.meta?.architectureView ?? 'relations';
export const isArchitectureOverview = graph => (graph?.meta?.diagramType ?? 'architecture') === 'architecture' && architectureViewOf(graph) !== 'relations';
export const architectureViewLabels = { relations: 'Component relationship architecture', capabilities: 'Platform capability architecture', engineering: 'Engineering layer architecture' };

// Presentation types are independent templates, while the nine semantic JSON types remain compatible.
export const VIEW_TYPES = Object.freeze([
  { id: 'capabilities', type: 'architecture', label: architectureViewLabels.capabilities },
  { id: 'engineering', type: 'architecture', label: architectureViewLabels.engineering },
  { id: 'relations', type: 'architecture', label: architectureViewLabels.relations },
  { id: 'flowchart', type: 'flowchart', label: 'Flowchart' },
  { id: 'sequence', type: 'sequence', label: 'Sequence' },
  { id: 'er', type: 'er', label: 'ER diagram' },
  { id: 'deployment', type: 'deployment', label: 'Deployment' },
  { id: 'class', type: 'class', label: 'Class diagram' },
  { id: 'state', type: 'state', label: 'State diagram' },
  { id: 'usecase', type: 'usecase', label: 'Use cases' },
  { id: 'dataflow', type: 'dataflow', label: 'Data flow' }
]);
export const viewTypeOf = graph => (graph?.meta?.diagramType ?? 'architecture') === 'architecture' ? architectureViewOf(graph) : graph.meta.diagramType;
export const viewTypeLabel = graph => VIEW_TYPES.find(view => view.id === viewTypeOf(graph))?.label ?? graph?.meta?.diagramType ?? architectureViewLabels.relations;
export const compareViews = (a, b) => {
  const rank = graph => { const index = VIEW_TYPES.findIndex(view => view.id === viewTypeOf(graph)); return index < 0 ? VIEW_TYPES.length : index; };
  return rank(a) - rank(b);
};
