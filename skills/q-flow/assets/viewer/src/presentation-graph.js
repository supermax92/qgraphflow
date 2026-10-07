import { isArchitectureOverview } from './view-identity.js';

// Presentation categories do not change ownership or remove evidence from the saved model.
export function overviewCategoryMap(graph) {
  const categories = new Map(), groups = graph.groups ?? [];
  const groupNodes = (id, seen = new Set()) => {
    if (seen.has(id)) return [];
    const next = new Set([...seen, id]);
    return [...graph.nodes.filter(node => node.groupId === id).map(node => node.id), ...groups.filter(group => group.parentId === id).flatMap(group => groupNodes(group.id, next))];
  };
  const visit = section => {
    for (const item of section.items ?? []) {
      if (item.mode) visit(item);
      else for (const id of item.nodeId ? [item.nodeId] : groupNodes(item.groupId)) categories.set(id, section.id);
    }
  };
  (graph.layout?.sections ?? []).forEach(visit);
  return categories;
}
export function visibleEdges(graph) {
  if (!isArchitectureOverview(graph) || graph.layout?.overviewConnections === 'all') return graph.edges;
  const categories = overviewCategoryMap(graph);
  return graph.edges.filter(edge => categories.has(edge.source) && categories.get(edge.source) === categories.get(edge.target));
}
export const presentationGraph = graph => ({ ...graph, edges: visibleEdges(graph) });

// Reinstall routed visible edges in their original semantic order; hidden facts remain available in details and JSON.
export function mergePresentationEdges(graph, routed) {
  const byId = new Map(routed.edges.map(edge => [edge.id, edge]));
  return graph.edges.map(edge => byId.get(edge.id) ?? edge);
}
