// A relations view may name components nearly everything depends on (configuration, data access). Edges into them are
// drawn as a tag on the source card instead of a line; the edges, their sites and details stay in the model.
const sharedOf = graph => (graph.meta?.diagramType ?? 'architecture') === 'architecture'
  && Array.isArray(graph.layout?.sharedDependencies) && graph.layout.sharedDependencies.length ? new Set(graph.layout.sharedDependencies) : null;
export const hasSharedDependencies = graph => Boolean(sharedOf(graph));
export function foldedEdges(graph) {
  const shared = sharedOf(graph);
  return shared ? graph.edges.filter(edge => shared.has(edge.target) && edge.source !== edge.target) : [];
}

export function visibleEdges(graph) {
  const shared = sharedOf(graph);
  return shared ? graph.edges.filter(edge => !shared.has(edge.target) || edge.source === edge.target) : graph.edges;
}

// The graph as drawn and laid out. With shared dependencies it also drops layout.sharedDependencies and gives each source
// card a display-only `dependencyTags` list, so presenting an already presented graph changes nothing.
export function presentationGraph(graph) {
  const shared = sharedOf(graph);
  if (!shared) return { ...graph, edges: visibleEdges(graph) };
  const labels = new Map(graph.nodes.map(node => [node.id, node.label])), tags = new Map();
  for (const edge of foldedEdges(graph)) tags.set(edge.source, [...new Set([...(tags.get(edge.source) ?? []), `→ ${labels.get(edge.target)}`])]);
  const { sharedDependencies, ...layout } = graph.layout;
  return { ...graph, layout, edges: visibleEdges(graph), nodes: graph.nodes.map(node => tags.has(node.id) ? { ...node, dependencyTags: tags.get(node.id) } : node) };
}

// Reinstall routed visible edges in their original semantic order; hidden facts remain available in details and JSON.
export function mergePresentationEdges(graph, routed) {
  const byId = new Map(routed.edges.map(edge => [edge.id, edge]));
  return graph.edges.map(edge => byId.get(edge.id) ?? edge);
}

// A laid-out presentation back as the authored model: every edge (folded ones without a route), nodes without their
// display tags, and the authored shared-dependency list.
export function restorePresentation(graph, laid) {
  const nodes = new Map(laid.nodes.map(node => [node.id, node])), edges = new Map(laid.edges.map(edge => [edge.id, edge]));
  return {
    ...laid,
    layout: { ...laid.layout, sharedDependencies: graph.layout.sharedDependencies },
    nodes: graph.nodes.map(node => { const { dependencyTags, ...placed } = nodes.get(node.id) ?? node; return placed; }),
    edges: graph.edges.map(edge => { if (edges.has(edge.id)) return edges.get(edge.id); const { route, ...folded } = edge; return folded; })
  };
}
