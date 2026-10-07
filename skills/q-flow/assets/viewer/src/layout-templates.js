import { deploymentTierOf } from './layout-semantics.js';
import { viewTypeOf } from './view-identity.js';
import { diagramTypeOf, getDiagram } from './diagrams/registry.js';
import { minimumNodeSize } from './layout-measure.js';
import { layoutLimits, layoutTargets, layeredDirections } from './layout-spacing.js';
import { groupHeadingLayout, estimateLabelSize } from './text-layout.js';
import { visibleEdgeLabel } from './edge-routing.js';

const stable = (a, b) => (a.layout?.order ?? 0) - (b.layout?.order ?? 0) || a.id.localeCompare(b.id, 'en');
const kinds = item => item.members.map(node => node.kind);
const has = (item, values) => kinds(item).some(kind => values.includes(kind));
const degree = (item, edges) => edges.filter(edge => item.ids.has(edge.source) || item.ids.has(edge.target)).length;

// Strongly connected components stay together. Cycles never create unbounded ranks, and array order is not a hint.
function layers(items, edges) {
  const owner = new Map(items.flatMap((item, index) => [...item.ids].map(id => [id, index])));
  const next = items.map(() => new Set());
  for (const edge of edges) { const a = owner.get(edge.source), b = owner.get(edge.target); if (a !== undefined && b !== undefined && a !== b) next[a].add(b); }
  let clock = 0;
  const index = new Map(), low = new Map(), stack = [], active = new Set(), components = [];
  function visit(id) {
    index.set(id, clock); low.set(id, clock++); stack.push(id); active.add(id);
    for (const target of next[id]) {
      if (!index.has(target)) { visit(target); low.set(id, Math.min(low.get(id), low.get(target))); }
      else if (active.has(target)) low.set(id, Math.min(low.get(id), index.get(target)));
    }
    if (low.get(id) === index.get(id)) { const part = []; let member; do { member = stack.pop(); active.delete(member); part.push(member); } while (member !== id); components.push(part); }
  }
  items.forEach((_, i) => { if (!index.has(i)) visit(i); });
  const component = new Map(components.flatMap((part, i) => part.map(id => [id, i]))), rank = new Map();
  function depth(id) {
    if (rank.has(id)) return rank.get(id);
    const parents = new Set();
    next.forEach((targets, source) => { if (component.get(source) !== id && [...targets].some(target => component.get(target) === id)) parents.add(component.get(source)); });
    const value = parents.size ? Math.max(...[...parents].map(depth)) + 1 : 0; rank.set(id, value); return value;
  }
  const rows = [];
  items.forEach((item, i) => { const r = depth(component.get(i)); (rows[r] ??= []).push(item); });
  return rows.filter(Boolean).map(row => row.sort(stable));
}

function grid(items, ratio = 1.45) {
  if (!items.length) return [];
  if (items.length <= 2) return [items];
  const average = key => items.reduce((sum, item) => sum + item.size[key], 0) / items.length;
  const columns = Math.max(1, Math.min(items.length, Math.round(Math.sqrt(items.length * average('height') * ratio / average('width')))));
  return Array.from({ length: Math.ceil(items.length / columns) }, (_, i) => items.slice(i * columns, (i + 1) * columns));
}

function components(items, graph) {
  const rows = layers(items, graph.edges);
  if (rows.length === 1 && items.length > 5) return grid(rows[0]);
  return rows.map(row => row.sort((a, b) => String(a.members[0]?.module ?? '').localeCompare(String(b.members[0]?.module ?? '')) || stable(a, b)));
}
// Feedback relationships are routed around the spine; they do not collapse its steps into one rank.
function forwardEdges(graph) {
  const seen = new Set(), active = new Set(), feedback = new Set();
  const next = id => graph.edges.filter(edge => edge.source === id).sort(stable);
  function visit(id) {
    if (seen.has(id)) return;
    seen.add(id); active.add(id);
    for (const edge of next(id)) { if (active.has(edge.target)) feedback.add(edge.id); else visit(edge.target); }
    active.delete(id);
  }
  const first = graph.layout?.primaryPath ?? graph.nodes.filter(node => ['initial', 'start'].includes(node.kind)).map(node => node.id);
  [...first, ...[...graph.nodes].sort(stable).map(node => node.id)].forEach(visit);
  return graph.edges.filter(edge => !feedback.has(edge.id));
}
function workflow(items, graph) {
  const path = graph.layout?.primaryPath ?? [];
  const rows = layers(items, forwardEdges(graph));
  if (rows.length === 1 && items.length > 5) return grid(rows[0]);
  return rows.map(row => row.sort((a, b) => {
    const inPath = item => item.members.some(node => path.includes(node.id));
    return Number(inPath(b)) - Number(inPath(a)) || stable(a, b);
  }));
}
function entities(items, graph) {
  // Put the most connected table first, then its neighbours; all fields determine actual cell dimensions.
  const remaining = [...items].sort((a, b) => degree(b, graph.edges) - degree(a, graph.edges) || stable(a, b)), ordered = [];
  while (remaining.length) {
    const at = ordered.length ? remaining.findIndex(item => graph.edges.some(edge =>
      item.ids.has(edge.source) && ordered.at(-1).ids.has(edge.target) || item.ids.has(edge.target) && ordered.at(-1).ids.has(edge.source))) : 0;
    ordered.push(...remaining.splice(Math.max(0, at), 1));
  }
  return grid(ordered);
}
function deployment(items, graph) {
  // Peers share a runtime tier; dependencies order peers without mixing data with applications.
  const tiers = new Map();
  for (const item of items) { const tier = Math.min(...item.members.map(deploymentTierOf)); tiers.set(tier, [...(tiers.get(tier) ?? []), item]); }
  return [...tiers].sort(([a], [b]) => a - b).flatMap(([, peers]) => layers(peers, graph.edges));
}
function classes(items, graph) {
  const hierarchy = graph.edges.filter(edge => ['inheritance', 'implementation'].includes(edge.kind)).map(edge => ({ source: edge.target, target: edge.source }));
  const contracts = items.filter(item => hierarchy.some(edge => item.ids.has(edge.source) || item.ids.has(edge.target)));
  const domain = items.filter(item => !contracts.includes(item));
  // Keep each contract above its implementations, with associated domain classes beside that hierarchy.
  const left = layers(contracts, hierarchy), right = layers(domain, graph.edges);
  const contractBottom = Math.max(-1, ...left.map((row, i) => row.some(item => has(item, ['abstract', 'interface'])) ? i : -1));
  const domainStart = contractBottom + 1;
  return Array.from({ length: Math.max(left.length, domainStart + right.length) }, (_, i) => [...(left[i] ?? []), ...(right[i - domainStart] ?? [])]);
}
function lifecycle(items, graph) {
  const initial = items.filter(item => has(item, ['initial'])), final = items.filter(item => has(item, ['final']));
  const states = items.filter(item => !initial.includes(item) && !final.includes(item));
  return [initial, ...layers(states, forwardEdges(graph)), final].filter(row => row.length);
}
function usecases(items, graph, variant = 0) {
  const actors = items.filter(item => has(item, ['actor'])), subjects = items.filter(item => !actors.includes(item));
  // At system scope, actors occupy a separate column outside the real boundary. Inside, use cases form a compact matrix.
  return actors.length ? [actors.sort(stable), subjects.sort(stable)].filter(row => row.length) : variant >= 2 ? subjects.sort(stable).map(item => [item]) : entities(subjects, graph);
}
function dataflow(items, graph) {
  const stores = items.filter(item => has(item, ['dataStore']));
  const work = items.filter(item => !stores.includes(item));
  // A store mediates data between writers and readers, but is not an extra processing stage.
  const mediated = stores.flatMap(store => graph.edges.filter(edge => store.ids.has(edge.target)).flatMap(write => graph.edges.filter(edge => store.ids.has(edge.source) && edge.target !== write.source).map(read => ({ source: write.source, target: read.target }))));
  const stages = layers(work, [...graph.edges, ...mediated]);
  const stageOf = new Map(stages.flatMap((row, i) => row.flatMap(item => [...item.ids].map(id => [id, i]))));
  for (const store of stores.sort(stable)) {
    const adjacent = graph.edges.filter(edge => store.ids.has(edge.source) || store.ids.has(edge.target)).map(edge => stageOf.get(store.ids.has(edge.source) ? edge.target : edge.source)).filter(i => i !== undefined).sort((a, b) => a - b);
    const at = adjacent.length ? adjacent[Math.floor(adjacent.length / 2)] : Math.max(0, stages.length - 1);
    (stages[at] ??= []).push(store);
  }
  return stages;
}

export const LAYOUT_TEMPLATES = Object.freeze({
  capabilities: { structure: 'capability-bands', existing: 'overview' },
  engineering: { structure: 'engineering-layers', existing: 'overview' },
  relations: { structure: 'component-clusters', arrange: components },
  flowchart: { structure: 'workflow-spine', arrange: workflow },
  sequence: { structure: 'lifelines', existing: 'sequence' },
  er: { structure: 'entity-matrix', arrange: entities },
  deployment: { structure: 'runtime-tiers', arrange: deployment },
  class: { structure: 'contract-hierarchy', arrange: classes },
  state: { structure: 'lifecycle-branches', arrange: lifecycle },
  usecase: { structure: 'actor-system', arrange: usecases },
  dataflow: { structure: 'process-store', arrange: dataflow }
});
export const templateOf = graph => LAYOUT_TEMPLATES[viewTypeOf(graph)];

// A measured template supplies positions only. Routing and acceptance are the same as for ELK and browser edits.
// No virtual groups, rank hints, inferred relationships or shortened text are persisted into the semantic model.
export function templateDraft(input, variant = 0) {
  const template = templateOf(input);
  if (!template?.arrange || (viewTypeOf(input) !== 'deployment' && input.layout?.direction && !input.layout?.version && !input.layout?.strategy?.startsWith('template-'))) return null;
  const linear = input.edges.length === input.nodes.length - 1 && input.nodes.every(node => input.edges.filter(edge => edge.source === node.id).length <= 1 && input.edges.filter(edge => edge.target === node.id).length <= 1);
  if (linear && !['flowchart', 'class', 'state', 'deployment', 'dataflow', 'usecase'].includes(viewTypeOf(input))) return null;
  const graph = structuredClone(input), type = diagramTypeOf(graph), diagram = getDiagram(type), limits = layoutLimits(diagram), target = layoutTargets(diagram);
  graph.nodes.forEach(node => { node.size = minimumNodeSize(node, type, graph.meta.locale); });
  graph.edges.forEach(edge => { delete edge.route; });
  const allGroups = graph.groups ?? [];
  const mixedTierBoundaries = type === 'deployment' && allGroups.length && allGroups.every(group => !group.parentId && group.layout?.order === undefined)
    && graph.nodes.every(node => node.layout?.rank === undefined && node.layout?.order === undefined)
    && allGroups.some(group => new Set(graph.nodes.filter(node => node.groupId === group.id).map(deploymentTierOf)).size > 1);
  function compose(parentId) {
    const children = allGroups.filter(group => group.parentId === parentId).sort(stable).map(group => {
      const body = compose(group.id), heading = groupHeadingLayout({ ...group, size: undefined });
      const pad = limits.groupInset;
      group.size = { width: Math.max(heading.width + 2 * pad, body.width + 2 * pad), height: 0 };
      const top = groupHeadingLayout(group).height + limits.groupHeadingGap;
      group.size.height = top + body.height + pad;
      return { ...group, members: body.members, ids: new Set(body.members.map(node => node.id)), children: body.items, inset: { x: pad, y: top }, original: group };
    });
    const nodes = graph.nodes.filter(node => node.groupId === parentId).sort(stable).map(node => ({ ...node, members: [node], ids: new Set([node.id]), original: node }));
    const items = [...children, ...nodes].sort(stable);
    const ranked = items.length > 0 && items.every(item => item.members.length && item.members.every(node => node.layout?.rank !== undefined && node.layout.rank === item.members[0].layout.rank));
    let rows = template.arrange(items, graph, variant);
    if (parentId === undefined && mixedTierBoundaries) rows = [items];
    if (ranked) {
      const ranks = new Map();
      for (const item of items) { const rank = item.members[0].layout.rank; ranks.set(rank, [...(ranks.get(rank) ?? []), item]); }
      rows = [...ranks].sort(([a], [b]) => a - b).map(([, row]) => row.sort(stable));
    }
    if (variant >= 2) {
      // Barycentric sweeps align siblings with their neighbours without changing bands or authored order.
      const owner = new Map(items.flatMap(item => [...item.ids].map(id => [id, item])));
      for (let sweep = 0; sweep < 4; sweep++) {
        const positions = new Map(rows.flatMap(row => row.map((item, i) => [item.id, (i + .5) / row.length])));
        for (const row of (sweep % 2 ? [...rows].reverse() : rows)) {
          if (row.some(item => item.layout?.order !== undefined)) continue;
          const score = item => {
            const peers = graph.edges.flatMap(edge => {
              const a = owner.get(edge.source), b = owner.get(edge.target);
              return a === item && b && !row.includes(b) ? [b] : b === item && a && !row.includes(a) ? [a] : [];
            });
            return peers.length ? peers.reduce((sum, peer) => sum + positions.get(peer.id), 0) / peers.length : positions.get(item.id);
          };
          row.sort((a, b) => score(a) - score(b) || stable(a, b));
        }
      }
    }
    const sideways = type === 'architecture' && (input.layout?.direction ?? layeredDirections(type)[0]) === 'right' || type === 'dataflow' || type === 'usecase' && items.some(item => has(item, ['actor'])) || ranked && (input.layout?.direction ?? layeredDirections(type)[0]) === 'right';
    const along = sideways ? 'x' : 'y', across = sideways ? 'y' : 'x', height = sideways ? 'width' : 'height', width = sideways ? 'height' : 'width';
    // Shared column tracks and row baselines are measured once for the whole ownership scope.
    const columnWidths = Array.from({ length: Math.max(0, ...rows.map(row => row.length)) }, (_, column) => Math.max(0, ...rows.map(row => row[column]?.size[width] ?? 0)));
    const lateral = graph.edges.filter(edge => rows.some(row => row.some(item => item.ids.has(edge.source)) && row.some(item => item.ids.has(edge.target)) && !row.some(item => item.ids.has(edge.source) && item.ids.has(edge.target))));
    const widestLabel = Math.max(0, ...lateral.map(edge => estimateLabelSize(visibleEdgeLabel(edge, type, graph.meta.locale))[width]));
    const gap = Math.max(target.nodeGap, Math.min(widestLabel + 2 * limits.labelGap, 240)) + variant * 24;
    const tracks = columnWidths.map((_, column) => columnWidths.slice(0, column).reduce((sum, size) => sum + size + gap, 0));
    const extent = columnWidths.reduce((sum, size) => sum + size, 0) + Math.max(0, columnWidths.length - 1) * gap;
    let cursor = 0;
    for (const row of rows) {
      const ids = new Set(row.flatMap(item => [...item.ids]));
      const labels = graph.edges.filter(edge => ids.has(edge.source) || ids.has(edge.target)).map(edge => estimateLabelSize(visibleEdgeLabel(edge, type, graph.meta.locale)));
      const multiplicities = type === 'class' && graph.edges.some(edge => (ids.has(edge.source) || ids.has(edge.target)) && (edge.sourceMultiplicity !== undefined || edge.targetMultiplicity !== undefined));
      const corridor = Math.max(type === 'flowchart' ? 64 : target.layerGap, multiplicities ? 176 : type === 'usecase' && sideways ? Math.max(160, graph.edges.length * 24) : 0, ...labels.map(label => label[height] + 2 * limits.labelGap)) + variant * 24;
      const rowHeight = Math.max(0, ...row.map(item => item.size[height]));
      const centred = ['flowchart', 'state', 'usecase', 'dataflow'].includes(type);
      row.forEach((item, column) => {
        item.position = {
          [along]: cursor + (centred ? (rowHeight - item.size[height]) / 2 : 0),
          [across]: (type === 'architecture' ? row.slice(0,column).reduce((sum,peer)=>sum+peer.size[width]+gap,0) : tracks[column]) + (centred ? (columnWidths[column] - item.size[width]) / 2 : 0)
        };
      });
      if (row.length === 1 && ['flowchart', 'class', 'state'].includes(type)) row[0].position[across] = (extent - row[0].size[width]) / 2;
      cursor += rowHeight + corridor;
    }
    if (type === 'flowchart' && graph.layout?.primaryPath?.length) {
      const path = new Set(graph.layout.primaryPath), primary = items.filter(item => item.members.some(node => path.has(node.id)));
      const spineWidth = Math.max(0, ...primary.map(item => item.size.width));
      for (const row of rows) {
        let branchX = spineWidth + target.nodeGap;
        for (const item of row) {
          if (primary.includes(item)) item.position.x = (spineWidth - item.size.width) / 2;
          else { item.position.x = branchX; branchX += item.size.width + target.nodeGap; }
        }
      }
    }
    const size = { width: Math.max(0, ...items.map(item => item.position.x + item.size.width)), height: Math.max(0, ...items.map(item => item.position.y + item.size.height)) };
    return { ...size, items, members: items.flatMap(item => item.members) };
  }
  function place(items, origin) {
    for (const item of items) {
      const position = { x: origin.x + item.position.x, y: origin.y + item.position.y };
      item.original.position = position;
      if (item.children) place(item.children, { x: position.x + item.inset.x, y: position.y + item.inset.y });
    }
  }
  const body = compose(undefined);
  // External return corridors may extend above/left of the first node. The export bounds crop this origin.
  const margin = Math.max(64, ...graph.edges.map(edge => estimateLabelSize(visibleEdgeLabel(edge, type, graph.meta.locale)).width + 64));
  place(body.items, { x: margin, y: margin });
  if (mixedTierBoundaries) {
    const bands = new Map();
    for (const node of graph.nodes) {
      const tier = deploymentTierOf(node), owners = bands.get(tier) ?? new Map(), owner = node.groupId ?? '$root';
      owners.set(owner, [...(owners.get(owner) ?? []), node]); bands.set(tier, owners);
    }
    const heading = Math.max(...allGroups.map(group => groupHeadingLayout(group).height + limits.groupHeadingGap));
    const gap = Math.max(heading + target.nodeGap, target.layerGap, ...graph.edges.map(edge => estimateLabelSize(visibleEdgeLabel(edge, type, graph.meta.locale)).height + 2 * limits.labelGap)) + variant * 24;
    let y = margin + heading;
    for (const [, owners] of [...bands].sort(([a], [b]) => a - b)) {
      let height = 0;
      for (const nodes of owners.values()) {
        const top = Math.min(...nodes.map(node => node.position.y));
        height = Math.max(height, ...nodes.map(node => node.position.y + node.size.height - top));
        for (const node of nodes) node.position.y += y - top;
      }
      y += height + gap;
    }
    for (const group of allGroups) {
      const members = graph.nodes.filter(node => node.groupId === group.id);
      if (!members.length) continue;
      group.position.y = Math.min(...members.map(node => node.position.y)) - groupHeadingLayout(group).height - limits.groupHeadingGap;
      group.size.height = Math.max(...members.map(node => node.position.y + node.size.height)) + limits.groupInset - group.position.y;
    }
  }
  if (type === 'architecture' && variant >= 2) {
    const axis = graph.layout?.direction === 'right' ? 'y' : 'x', cross = axis === 'x' ? 'y' : 'x';
    const extent = axis === 'x' ? 'width' : 'height';
    const rows = new Map();
    for (const node of [...graph.nodes].sort(stable)) { const key = `${node.groupId}:${node.position[cross]}:${node.size[extent]}`; rows.set(key,[...(rows.get(key)??[]),node]); }
    for (let sweep=0;sweep<2;sweep++) {
      const positions=new Map(graph.nodes.map(node=>[node.id,node.position[axis]+node.size[extent]/2]));
      for (const [,row] of [...rows].sort(([a],[b])=>a.localeCompare(b))) {
      if(row.length<2 || row.some(node=>node.layout?.order!==undefined))continue;
      const slots=row.map(node=>node.position[axis]).sort((a,b)=>a-b);
      const score=node=>{ const peers=graph.edges.filter(e=>e.source===node.id||e.target===node.id).map(e=>graph.nodes.find(n=>n.id===(e.source===node.id?e.target:e.source))).filter(n=>n.groupId!==node.groupId);
        return peers.length?peers.reduce((sum,n)=>sum+positions.get(n.id),0)/peers.length:positions.get(node.id); };
      const scores=new Map(row.map(node=>[node.id,score(node)])); row.sort((a,b)=>scores.get(a.id)-scores.get(b.id)||stable(a,b));
      row.forEach((node,i)=>{node.position[axis]=slots[i];});
      }
    }
  }
  if (type === 'usecase') {
    const actors = graph.nodes.filter(node => node.kind === 'actor');
    for (const actor of actors) {
      const cases = graph.edges.filter(edge => edge.source === actor.id || edge.target === actor.id).map(edge => graph.nodes.find(node => node.id === (edge.source === actor.id ? edge.target : edge.source))).filter(node => node.kind === 'usecase');
      if (cases.length) actor.position.y = cases.reduce((sum, node) => sum + node.position.y + node.size.height / 2, 0) / cases.length - actor.size.height / 2;
    }
    actors.sort((a, b) => a.position.y - b.position.y || stable(a, b));
    for (let i = 1; i < actors.length; i++) actors[i].position.y = Math.max(actors[i].position.y, actors[i - 1].position.y + actors[i - 1].size.height + target.nodeGap);
  }
  graph.layout = { ...graph.layout, direction: type === 'usecase' ? 'right' : type === 'architecture' ? input.layout?.direction ?? layeredDirections(type)[0] : layeredDirections(type)[0] };
  // Seed decision alternatives on opposite outlines; the orthogonal router preserves these semantic exits.
  for (const node of graph.nodes.filter(node => ['decision', 'choice'].includes(node.kind))) {
    const targetX = edge => { const target = graph.nodes.find(item => item.id === edge.target); return target.position.x + target.size.width / 2; };
    const branches = graph.edges.filter(edge => edge.source === node.id && edge.target !== node.id).sort((a, b) => targetX(a) - targetX(b) || stable(a, b));
    branches.forEach((edge, index) => {
      const x = node.position.x + (index % 2 ? node.size.width + 12 : -12), y = node.position.y + node.size.height / 2;
      edge.route = { via: [{ x, y }] };
    });
  }
  return graph;
}

// Editing may move a node locally, but must not invert the relative bands/columns of a generated template.
export function preservesTemplateOrder(before, after) {
  if (diagramTypeOf(before) !== 'sequence') for (const a of before.nodes) for (const b of before.nodes) {
    if (a.id >= b.id || a.groupId !== b.groupId) continue;
    const na = after.nodes.find(node => node.id === a.id), nb = after.nodes.find(node => node.id === b.id);
    for (const [axis, dimension] of [['x', 'width'], ['y', 'height']]) for (const fraction of [0, .5]) {
      const delta = (left, right) => left.position[axis] + fraction * left.size[dimension] - right.position[axis] - fraction * right.size[dimension];
      if (Math.abs(delta(a, b)) < .001 && Math.abs(delta(na, nb)) > .001) return false;
    }
  }
  if (!before.layout?.strategy?.startsWith('template-')) return true;
  const type = viewTypeOf(before), next = new Map(after.nodes.map(node => [node.id, node]));
  const axis = ['usecase', 'dataflow'].includes(type) ? 'x' : 'y', extent = axis === 'x' ? 'width' : 'height';
  for (const a of before.nodes) for (const b of before.nodes) {
    if (type === 'deployment' && a.id !== b.id && a.groupId === b.groupId && a.position.y === b.position.y && next.get(a.id).position.y !== next.get(b.id).position.y) return false;
    if (a.id === b.id || a.groupId !== b.groupId && !(type === 'usecase' && (a.kind === 'actor' || b.kind === 'actor'))) continue;
    if (a.position[axis] + a.size[extent] <= b.position[axis] && next.get(a.id).position[axis] + next.get(a.id).size[extent] > next.get(b.id).position[axis]) return false;
  }
  return true;
}
