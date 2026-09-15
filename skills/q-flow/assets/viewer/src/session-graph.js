export function graphInputWithEdits(input, drafts, currentGraph) {
  const typeOf = graph => graph.meta.diagramType ?? 'architecture';
  const edited = graph => typeOf(graph) === typeOf(currentGraph) ? currentGraph : drafts.get(typeOf(graph)) ?? graph;
  return Array.isArray(input.diagrams) ? { ...input, diagrams: input.diagrams.map(edited) } : currentGraph;
}

export function currentGraphFromFlow(graph, nodes, edges) {
  const nodeState = new Map(nodes.filter(node => node.type === 'diagram').map(node => [node.id, node]));
  const edgeState = new Map(edges.map(edge => [edge.id, edge]));
  return {
    ...graph,
    nodes: graph.nodes.map(node => {
      const current = nodeState.get(node.id);
      if (!current) return node;
      const text = { label: current.data.label };
      if (Object.hasOwn(current.data, 'subtitle')) text.subtitle = current.data.subtitle;
      return { ...node, ...text, position: current.position };
    }),
    edges: graph.edges.map(edge => {
      const current = edgeState.get(edge.id);
      return current && Object.hasOwn(current.data, 'label') ? { ...edge, label: current.data.label } : edge;
    })
  };
}

export function constrainNodeChanges(changes, nodes, diagramType) {
  if (diagramType !== 'sequence') return changes;
  const positions = new Map(nodes.map(node => [node.id, node.position]));
  return changes.map(change => change.type === 'position' && change.position && positions.has(change.id)
    ? { ...change, position: { ...change.position, y: positions.get(change.id).y } }
    : change);
}
