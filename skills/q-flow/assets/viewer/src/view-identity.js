// Legacy collections use their unique diagram type as identity. Repeated architecture views require authored IDs.
export const viewIdOf = graph => graph?.meta?.viewId ?? graph?.meta?.diagramType ?? 'architecture';
export const architectureViewOf = graph => graph?.meta?.architectureView ?? 'relations';
export const isArchitectureOverview = graph => (graph?.meta?.diagramType ?? 'architecture') === 'architecture' && architectureViewOf(graph) !== 'relations';
export const architectureViewLabels = { relations: 'Component relations', capabilities: 'Platform capabilities', engineering: 'Engineering layers' };
