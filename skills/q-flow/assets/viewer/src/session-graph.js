import { cardText, diagramTypeOf, getDiagram } from './diagrams/registry.js';
import { layoutLimits } from './layout-spacing.js';
import { requireDiagramQuality } from './layout-quality.js';
import { groupHeadingLayout } from './text-layout.js';

// The generator embeds the graph as escaped JSON inside this script element; saving from the page rewrites the same
// element, so the saved page reopens with its edits and the generator and the page never disagree about the encoding.
const DATA_ELEMENT = /(<script\b[^>]*\bid="graph-data"[^>]*>)([\s\S]*?)(<\/script>)/;
export const safeJson = graph => JSON.stringify(graph).replaceAll('&', '\\u0026').replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');

export function pageWithGraph(html, graph) {
  if (!DATA_ELEMENT.test(html)) throw new Error('page has no graph-data element');
  return html.replace(DATA_ELEMENT, (match, open, data, close) => `${open}${safeJson(graph)}${close}`);
}

export function graphInputWithEdits(input, drafts, currentGraph) {
  const edited = graph => diagramTypeOf(graph) === diagramTypeOf(currentGraph) ? currentGraph : drafts.get(diagramTypeOf(graph)) ?? graph;
  return Array.isArray(input.diagrams) ? { ...input, diagrams: input.diagrams.map(edited) } : currentGraph;
}

export function currentGraphFromFlow(graph, nodes, edges) {
  const nodeState = new Map(nodes.filter(node => node.type === 'diagram').map(node => [node.id, node]));
  const groupState = new Map(nodes.filter(node => node.type === 'boundary').map(node => [node.id, node]));
  const edgeState = new Map(edges.map(edge => [edge.id, edge]));
  return {
    ...graph,
    nodes: graph.nodes.map(node => {
      const current = nodeState.get(node.id);
      if (!current) return node;
      const text = { label: current.data.label };
      if (Object.hasOwn(current.data, 'subtitle')) text.subtitle = current.data.subtitle;
      return { ...node, ...text, position: current.position, size: current.data.size };
    }),
    ...(graph.groups && { groups: graph.groups.map(group => {
      const current = groupState.get(group.id);
      return current ? { ...group, position: current.position, size: current.data.size } : group;
    }) }),
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

// The graph with the boxes (id -> { position, size }) of nodes and groups put in place.
export function placed(graph, boxes) {
  const place = item => boxes.has(item.id) ? { ...item, ...boxes.get(item.id) } : item;
  return { ...graph, nodes: graph.nodes.map(place), ...(graph.groups && { groups: graph.groups.map(place) }) };
}

// A card keeps all of its text. When an edit leaves it too short it grows by the missing height around its centre, else
// upward, else downward (a connection leaving its top or bottom edge needs the stub there clear), whichever the quality gate
// accepts first, and the boundaries that own it grow just enough to keep their clearance. If none is accepted the centred
// growth stays and the gate names what is left; Arrange only moves cards. `classic` is the card style the view already draws
// (compactCards of the graph before the edit). Returns id -> { position, size } for every box that changed.
export function fitCard(graph, id, classic) {
  const type = diagramTypeOf(graph), diagram = getDiagram(type), node = graph.nodes.find(item => item.id === id);
  const grow = diagram.cardLayout ? cardText(node, type, graph.meta.locale, classic).minHeight - node.size.height : 0;
  if (grow <= 0) return new Map();
  const { groupInset, groupHeadingGap } = layoutLimits(diagram), groups = new Map((graph.groups ?? []).map(group => [group.id, group]));
  // `above` is the share of the extra height that goes over the card's top edge; each boundary then takes in its member's box.
  const growth = above => {
    let box = { position: { x: node.position.x, y: Math.max(0, node.position.y - grow * above) }, size: { width: node.size.width, height: node.size.height + grow } };
    const boxes = new Map([[id, box]]);
    for (let group = groups.get(node.groupId), depth = 0; group && depth < groups.size; group = groups.get(group.parentId), depth++) {
      const { position, size } = group, top = groupHeadingLayout(group).height + groupHeadingGap;
      const left = Math.max(0, Math.min(position.x, box.position.x - groupInset)), upper = Math.max(0, Math.min(position.y, box.position.y - top));
      const right = Math.max(position.x + size.width, box.position.x + box.size.width + groupInset), lower = Math.max(position.y + size.height, box.position.y + box.size.height + groupInset);
      boxes.set(group.id, box = { position: { x: left, y: upper }, size: { width: right - left, height: lower - upper } });
    }
    return boxes;
  };
  const accepted = boxes => { try { requireDiagramQuality(placed(graph, boxes)); return true; } catch { return false; } };
  const options = [.5, 1, 0].map(growth);
  return options.find(accepted) ?? options[0];
}
