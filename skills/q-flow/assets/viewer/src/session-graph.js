// The generator embeds the graph as escaped JSON inside this script element; saving from the page rewrites the same
// element, so the saved page reopens with its edits and the generator and the page never disagree about the encoding.
const DATA_ELEMENT = /(<script\b[^>]*\bid="graph-data"[^>]*>)([\s\S]*?)(<\/script>)/;
export const safeJson = graph => JSON.stringify(graph).replaceAll('&', '\\u0026').replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');

export function pageWithGraph(html, graph) {
  if (!DATA_ELEMENT.test(html)) throw new Error('page has no graph-data element');
  return html.replace(DATA_ELEMENT, (match, open, data, close) => `${open}${safeJson(graph)}${close}`);
}

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
