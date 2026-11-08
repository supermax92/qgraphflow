// Structural comparison of two versions of a graph input (generate-viewer --compare): per view, matched by viewIdOf, the
// node, edge and group ids added, changed or removed, and whether the view's title, scope or notes changed. Geometry and
// anchor line numbers are not content, so a refresh that only moved or realigned them changes nothing here.
import { viewIdOf } from './view-identity.js';

const VOLATILE = new Set(['position', 'size', 'route', 'layout', 'lineStart', 'lineEnd']);
const content = value => JSON.stringify(value ?? null, (key, item) => VOLATILE.has(key) ? undefined : item);
const viewsOf = input => Array.isArray(input?.diagrams) ? input.diagrams : input ? [input] : [];
const KINDS = ['nodes', 'edges', 'groups'];

// A readable name for an element: a node's or group's label, or "source → target: label" for an edge.
export function elementName(graph, id) {
  const label = nodeId => graph.nodes.find(node => node.id === nodeId)?.label ?? nodeId;
  const edge = (graph.edges ?? []).find(item => item.id === id);
  if (edge) return `${label(edge.source)} → ${label(edge.target)}${edge.label ? `: ${edge.label}` : ''}`;
  return graph.nodes.find(node => node.id === id)?.label ?? (graph.groups ?? []).find(group => group.id === id)?.label ?? id;
}

export function compareGraphs(before, after) {
  const old = new Map(viewsOf(before).map(graph => [viewIdOf(graph), graph]));
  const views = Object.fromEntries(viewsOf(after).map(graph => {
    const previous = old.get(viewIdOf(graph)) ?? { meta: {}, nodes: [], edges: [], groups: [] };
    const diff = { added: [], changed: [], removed: [], meta: ['title', 'scope', 'notes'].some(key => content(previous.meta?.[key]) !== content(graph.meta?.[key])) };
    for (const kind of KINDS) {
      const was = new Map((previous[kind] ?? []).map(item => [item.id, item])), now = new Set((graph[kind] ?? []).map(item => item.id));
      for (const item of graph[kind] ?? []) if (!was.has(item.id)) diff.added.push(item.id); else if (content(was.get(item.id)) !== content(item)) diff.changed.push(item.id);
      for (const id of was.keys()) if (!now.has(id)) diff.removed.push({ id, label: elementName(previous, id) });
    }
    return [viewIdOf(graph), diff];
  }));
  const removedViews = [...old.keys()].filter(id => !Object.hasOwn(views, id));
  return { views, ...(removedViews.length ? { removedViews } : {}) };
}

// The page reads the comparison once at start (main.jsx); views and their elements look it up by view id.
let comparison = null;
export const setComparison = value => { comparison = value; };
export const comparisonOf = graph => comparison?.views?.[viewIdOf(graph)] ?? null;
export const updateCount = diff => diff ? diff.added.length + diff.changed.length + diff.removed.length + (diff.meta ? 1 : 0) : 0;
