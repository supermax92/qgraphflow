import { currentLayout, alignedLayout, tieredLayout } from './layout-policy.js';
import { clearanceLimits, nodeClearance, boundaryClearance } from './route-clearance.js';
import { deploymentTierOf } from './layout-semantics.js';
import { presentationGraph } from './presentation-graph.js';
import { isArchitectureOverview } from './view-identity.js';
import { overviewGeometryErrors, overviewSections } from './architecture-overview.js';
import { auditGraphLayout, boxDistance, occupiedBox, graphBounds, segmentCrossesBox } from './edge-routing.js';
import { cardText, compactCards, diagramTypeOf, getDiagram } from './diagrams/registry.js';
import { layoutText, groupHeadingLayout } from './text-layout.js';
import { layeredDown, layoutLimits } from './layout-spacing.js';
import { minimumNodeSize } from './layout-measure.js';
import { validateGraph } from './graph-validation.js';

const bounds = item => ({ ...item.position, ...item.size });
const contains = (a, b) => b.x >= a.x && b.y >= a.y && b.x + b.width <= a.x + a.width && b.y + b.height <= a.y + a.height;
const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const segments = route => route.points.slice(1).map((end, i) => [route.points[i], end]);

export function qualityFailure(graph, phase, message, diagnostics = []) {
  if (!diagnostics.length) diagnostics = (String(message).includes('\n- ') ? String(message).split('\n- ').slice(1) : [String(message)]).map(detail => {
    const elements = ['nodes', 'edges', 'groups'].flatMap(key => (Array.isArray(graph?.[key]) ? graph[key] : []).filter((item, index) => item && typeof item === 'object' && (
      detail.includes(`${key}[${index}]`) || new RegExp(`(^|[^\\w.-])${String(item.id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\w.-])`).test(detail))));
    for (const edge of elements.filter(item => item.source && item.target)) elements.push(...(graph.nodes ?? []).filter(node => node.id === edge.source || node.id === edge.target));
    elements.push(...overviewSections(graph ?? {}).filter(item => String(detail).includes(item.id)));
    return { ruleId: `${phase}.invalid`, severity: 'error', diagramType: diagramTypeOf(graph),
      elementIds: elements.map(item => item.id), measured: detail, required: `Valid ${phase} content and complete notation`,
      bounds: elements.filter(item => item.position && item.size).map(item => ({ ...item.position, ...item.size })),
      remediation: phase === 'semantic' ? 'Correct the reported input field or reference before layout.' : 'Correct the identified content or geometry and retry without removing semantic facts.' };
  });
  return Object.assign(new Error(String(message)), { diagnostics, phases: {
    semantic: { status: phase === 'semantic' ? 'failed' : 'passed' },
    geometry: { status: phase === 'semantic' ? 'not-checked' : phase === 'geometry' ? 'failed' : 'passed' },
    rendering: { status: phase === 'rendering' ? 'failed' : 'not-checked' }
  } });
}

export function requireDiagramQuality(graph, options = {}) {
  const semantic = validateGraph(graph, { inputOnly: true });
  const geometry = semantic.length ? [] : validateGraph(graph, { audit: false });
  const audit = semantic.length || geometry.length ? null : auditLayoutQuality(graph, options);
  const errors = [...semantic, ...geometry, ...(audit?.errors ?? [])];
  const phases = { semantic: { status: semantic.length ? 'failed' : 'passed' }, geometry: { status: semantic.length ? 'not-checked' : errors.length ? 'failed' : 'passed' }, rendering: { status: 'not-checked' } };
  if (errors.length) throw qualityFailure(graph, semantic.length ? 'semantic' : 'geometry', `Diagram quality failed:\n- ${errors.join('\n- ')}`, audit?.diagnostics ?? []);
  return { ...phases, diagnostics: audit.diagnostics };
}

export function auditLayoutQuality(graph, { strictEdgeIds = null } = {}) {
  graph = presentationGraph(graph);
  const legacy = auditGraphLayout(graph), type = diagramTypeOf(graph), diagram = getDiagram(type), limits = isArchitectureOverview(graph) ? { ...layoutLimits(diagram), nodeGap: 14, labelGap: 6, parallelGap: 8, groupInset: 22, groupHeadingGap: 14 } : layoutLimits(diagram);
  const diagnostics = [...legacy.diagnostics, ...legacy.crossings];
  const issue = (ruleId, ids, measured, required, boxes, remediation) => diagnostics.push({ ruleId, severity: 'error', diagramType: type, elementIds: ids, measured, required, bounds: boxes, remediation });
  const nodeBoxes = new Map(graph.nodes.map(node => [node.id, occupiedBox(node, type)]));
  const nodeById = new Map(graph.nodes.map(node => [node.id, node]));
  if (!diagram.sequence) {
    const ranked = graph.nodes.flatMap(first => graph.nodes.filter(second => first.layout?.rank !== undefined && second.layout?.rank !== undefined && first.layout.rank < second.layout.rank).map(second => [first, second]));
    let primaryPath = graph.layout?.primaryPath ?? [];
    if (type === 'flowchart' && !primaryPath.length && graph.edges.length === graph.nodes.length - 1) {
      const next = new Map(graph.nodes.map(node => [node.id, graph.edges.filter(edge => edge.source === node.id)]));
      const starts = graph.nodes.filter(node => !graph.edges.some(edge => edge.target === node.id));
      if (starts.length === 1 && [...next.values()].every(edges => edges.length <= 1)) {
        const path = [], seen = new Set();
        for (let id = starts[0].id; id && !seen.has(id); id = next.get(id)[0]?.target) { path.push(id); seen.add(id); }
        // Only a complete simple chain has an unambiguous main path; never guess among branches or cycles.
        if (path.length === graph.nodes.length) primaryPath = path;
      }
    }
    const primary = ['flowchart', 'state'].includes(type) ? primaryPath.slice(1).map((id, i) => [nodeById.get(primaryPath[i]), nodeById.get(id)]) : [];
    const decisions = ['flowchart', 'state'].includes(type) ? graph.nodes.filter(node => ['decision', 'choice'].includes(node.kind)).map(node => {
      const branches = graph.edges.filter(edge => edge.source === node.id && edge.target !== node.id);
      return { node, branches, sides: new Set(branches.map(edge => legacy.routes.get(edge.id).sourceSide)) };
    }).filter(item => item.branches.length >= 2) : [];
    const vertical = layeredDown(type, graph.layout);
    const coordinate = vertical ? 'y' : 'x', dimension = vertical ? 'height' : 'width';
    // A layout folded into top-down columns continues at the top of the next column: a successor that sits entirely to the
    // right of its predecessor keeps the notation's reading direction; a path or hierarchy step must also start higher.
    const continues = (earlier, later, higher) => later.position.x - earlier.position.x - earlier.size.width + .001 >= limits.nodeGap && (!higher || later.position.y < earlier.position.y);
    for (const [first, second] of ranked) {
      const distance = second.position[coordinate] - first.position[coordinate] - first.size[dimension];
      if (distance + .001 < limits.nodeGap) issue('semantic.rank', [first.id, second.id], distance, limits.nodeGap, [nodeBoxes.get(first.id), nodeBoxes.get(second.id)], 'Keep declared ranks in separate layers along the reading direction.');
    }
    if (vertical && graph.nodes.length > 5 && Math.max(...graph.nodes.map(node => node.position.y)) < Math.min(...graph.nodes.map(node => node.position.y + node.size.height))) issue('semantic.single-row', graph.nodes.map(node => node.id), 1, 'multiple rows', [...nodeBoxes.values()], 'Arrange responsibility layers or wrap peer nodes; tiny y offsets do not create another row.');
    if (type === 'deployment' && (tieredLayout(graph) || graph.layout?.strategy?.startsWith('template-runtime-tiers') || graph.nodes.some(node => node.layout?.tier))) for (const parent of graph.nodes) for (const child of graph.nodes) {
      if (deploymentTierOf(parent) >= deploymentTierOf(child)) continue;
      const distance = child.position.y - parent.position.y - parent.size.height;
      if (distance + .001 < limits.nodeGap) issue('semantic.deployment-tier', [parent.id, child.id], distance, limits.nodeGap, [nodeBoxes.get(parent.id), nodeBoxes.get(child.id)], 'Keep external, application, infrastructure and data tiers from top to bottom.');
    }
    if (type === 'class') for (const edge of graph.edges.filter(edge => ['inheritance', 'implementation'].includes(edge.kind))) {
      const child = nodeById.get(edge.source), parent = nodeById.get(edge.target), distance = child.position.y - parent.position.y - parent.size.height;
      if (distance + .001 < limits.nodeGap) issue('semantic.class-hierarchy', [edge.id, parent.id, child.id], distance, limits.nodeGap, [nodeBoxes.get(parent.id), nodeBoxes.get(child.id)], 'Place the parent class or interface above its child or implementation.');
    }
    if (type === 'state') for (const symbol of graph.nodes.filter(node => ['initial', 'final'].includes(node.kind))) {
      for (const state of graph.nodes.filter(node => !['initial', 'final'].includes(node.kind))) {
        const distance = symbol.kind === 'initial' ? state.position.y - symbol.position.y - symbol.size.height : symbol.position.y - state.position.y - state.size.height;
        if (distance + .001 < limits.nodeGap) issue('semantic.state-endpoint', [symbol.id, state.id], distance, limits.nodeGap, [nodeBoxes.get(symbol.id), nodeBoxes.get(state.id)], 'Keep initial symbols above the lifecycle and final symbols below it.');
      }
    }
    for (const [source, target] of primary) {
      const distance = target.position[coordinate] - source.position[coordinate] - source.size[dimension];
      if (distance + .001 < limits.nodeGap && (graph.layout?.strategy?.startsWith('template-') || !continues(source, target, true))) issue('semantic.primary-path', [source.id, target.id], distance, limits.nodeGap, [nodeBoxes.get(source.id), nodeBoxes.get(target.id)], 'Keep the declared or unambiguous main path directed downwards; a column fold continues it at the top of the next column.');
    }
    for (const { node, branches, sides } of decisions) {
      if (!['left', 'right'].every(side => sides.has(side))) issue('semantic.branch-sides', [node.id, ...branches.map(edge => edge.id)], [...sides], ['left', 'right'], [nodeBoxes.get(node.id)], 'Give alternatives separate left and right corridors while retaining their real targets and merges.');
    }
  }
  const classicCard = !compactCards(graph);
  for (let i = 0; i < graph.nodes.length; i++) {
    const node = graph.nodes[i], rect = nodeBoxes.get(node.id), minimum = minimumNodeSize(node, type, graph.meta.locale);
    if (diagram.cardLayout) {
      const required = cardText(node, type, graph.meta.locale, classicCard).minHeight;
      if (node.size.height < required) issue('text.node-height', [node.id], node.size.height, required, [rect], 'Increase height to keep full title and subtitle at 20/16px.');
    } else if (diagram.textArea && node.kind !== 'actor' && !['initial', 'final'].includes(node.kind)) {
      const area = diagram.textArea(node), title = layoutText(node.label, area.width, 20, 29), body = layoutText(node.subtitle, area.width, 16, 23.2), required = title.height + (body.height ? body.height + 5 : 0);
      if (area.width <= 0 || area.height < required) issue('text.shape-safe-area', [node.id], area, { width: 1, height: required }, [rect], 'Enlarge the shape safety region to contain all text.');
    } else if (node.size.width < minimum.width || node.size.height < minimum.height) issue('text.node-size', [node.id], node.size, minimum, [rect], 'Increase dimensions for complete headers, members and fields.');
    for (const other of graph.nodes.slice(i + 1)) {
      const otherBox = nodeBoxes.get(other.id), distance = boxDistance(rect, otherBox);
      if (distance + .001 < limits.nodeGap) issue('spacing.nodes', [node.id, other.id], distance, limits.nodeGap, [rect, otherBox], 'Separate the visible node outlines.');
    }
  }
  const labels = graph.edges.flatMap(edge => {
    const route = legacy.routes.get(edge.id);
    return [...(route.label ? [{ id: edge.id, box: route.labelBox }] : []), ...(route.endpointLabels ?? []).map(label => ({ id: edge.id, role: label.role, box: label.labelBox }))];
  });
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    for (const [id, rect] of nodeBoxes) {
      const distance = boxDistance(label.box, rect);
      if (distance + .001 < limits.labelGap) issue('spacing.label-node', [label.id, id], distance, limits.labelGap, [label.box, rect], 'Move the label away from the node.');
    }
    for (const other of labels.slice(i + 1)) {
      const distance = boxDistance(label.box, other.box);
      if (distance + .001 < limits.labelGap) issue('spacing.labels', [label.id, other.id], distance, limits.labelGap, [label.box, other.box], 'Separate complete label bounds.');
    }
    const margin = limits.labelEdgeGap;
    for (const edge of graph.edges) if (edge.id !== label.id) {
      const expanded = { x: label.box.x - margin, y: label.box.y - margin, width: label.box.width + 2 * margin, height: label.box.height + 2 * margin };
      if (segments(legacy.routes.get(edge.id)).some(([a, b]) => segmentCrossesBox(a, b, expanded))) issue('spacing.label-edge', [label.id, edge.id], '<6', margin, [label.box], 'Reserve a clear label area away from other relations.');
    }
  }
  for (let i = 0; i < graph.edges.length; i++) {
    const edge = graph.edges[i], route = legacy.routes.get(edge.id), parts = segments(route);
    if (!diagram.sequence && alignedLayout(graph) && route.label) {
      const point = route.labelPoint;
      const distance = Math.min(...parts.map(([a, b]) => Math.hypot(point.x - Math.max(Math.min(a.x, b.x), Math.min(Math.max(a.x, b.x), point.x)), point.y - Math.max(Math.min(a.y, b.y), Math.min(Math.max(a.y, b.y), point.y)))));
      if (distance > .001) issue('label.on-route', [edge.id], distance, 0, [route.labelBox], 'Keep the relationship label centred on its own straight segment.');
    }
    if (!diagram.sequence) for (const [point, neighbor, hint] of [[route.points[0], route.points[1], edge.route?.via?.[0]], [route.points.at(-1), route.points.at(-2), edge.route?.via?.at(-1)]]) {
      const distance = Math.hypot(point.x - neighbor.x, point.y - neighbor.y), required = diagram.endpointStub ?? limits.endpoint;
      // A monotone direct segment has no turn at its guide; a bent path must still reserve the authored first-turn clearance.
      const projection = hint && distance ? ((hint.x - point.x) * (neighbor.x - point.x) + (hint.y - point.y) * (neighbor.y - point.y)) / distance : distance;
      const length = route.points.length === 2 && projection >= 0 ? distance : Math.min(distance, projection);
      if (length + .001 < required) issue('route.endpoint-stub', [edge.id], length, required, [{ ...point, width: 0, height: 0 }], 'Reserve a straight outward segment for the endpoint symbol.');
    }
    for (const other of graph.edges.slice(i + 1)) {
      const otherRoute = legacy.routes.get(other.id), found = [];
      for (const [a, b] of parts) for (const [c, d] of segments(otherRoute)) {
        const horizontal = a.y === b.y;
        if (horizontal !== (c.y === d.y)) continue;
        const axis = horizontal ? 'x' : 'y', across = horizontal ? 'y' : 'x';
        const shared = Math.min(Math.max(a[axis], b[axis]), Math.max(c[axis], d[axis])) - Math.max(Math.min(a[axis], b[axis]), Math.min(c[axis], d[axis]));
        const separation = Math.abs(a[across] - c[across]);
        if (shared <= .001 || separation + .001 >= limits.parallelGap) continue;
        const terminals = (e, r) => [{ id: e.source, point: r.points[0] }, { id: e.target, point: r.points.at(-1) }];
        const initialShared = separation < .001 && shared <= limits.endpoint && terminals(edge, route).some(left => terminals(other, otherRoute).some(right => left.id === right.id && left.point.x === right.point.x && left.point.y === right.point.y && (left.point === a || left.point === b) && (right.point === c || right.point === d)));
        if (!initialShared) found.push({ x: Math.min(a.x, b.x, c.x, d.x), y: Math.min(a.y, b.y, c.y, d.y), width: Math.max(a.x, b.x, c.x, d.x) - Math.min(a.x, b.x, c.x, d.x), height: Math.max(a.y, b.y, c.y, d.y) - Math.min(a.y, b.y, c.y, d.y), separation, shared });
      }
      if (found.length) issue('route.parallel-channels', [edge.id, other.id], Math.min(...found.map(item => item.separation)), limits.parallelGap, found, `Separate parallel channels; only the initial ${limits.endpoint}px at one common port may overlap.`);
    }
  }
  if (!diagram.sequence) {
    const groups = graph.groups ?? [], byId = new Map(groups.map(group => [group.id, group]));
    const belongs = (node, group) => { let id = node.groupId; const seen = new Set(); while (id && !seen.has(id)) { if (id === group.id) return true; seen.add(id); id = byId.get(id)?.parentId; } return false; };
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i], rect = bounds(group), inset = limits.groupInset, top = groupHeadingLayout(group).height + limits.groupHeadingGap;
      const inner = { x: rect.x + inset, y: rect.y + top, width: rect.width - 2 * inset, height: rect.height - top - inset };
      const members = [...graph.nodes.filter(node => node.groupId === group.id), ...groups.filter(child => child.parentId === group.id)];
      for (const member of members) if (!contains(inner, bounds(member))) issue('group.member-inset', [group.id, member.id], bounds(member), inner, [rect, bounds(member)], 'Expand the owning boundary to preserve heading and side clearance.');
      for (const node of graph.nodes) if (!belongs(node, group) && overlap(rect, nodeBoxes.get(node.id))) issue('group.unowned-node', [group.id, node.id], node.groupId ?? null, 'outside', [rect, nodeBoxes.get(node.id)], 'Keep nodes outside boundaries they do not belong to.');
      for (const other of groups.slice(i + 1)) if (group.parentId === other.parentId && boxDistance(rect, bounds(other)) + .001 < limits.groupGap) issue('group.sibling-gap', [group.id, other.id], boxDistance(rect, bounds(other)), limits.groupGap, [rect, bounds(other)], 'Separate sibling boundaries.');
    }
  }
  const routeMetrics = [];
  if (!diagram.sequence) {
    const clearance = clearanceLimits(graph), probes = graph.nodes.map(node => ({ node, probe: nodeClearance(node, type) }));
    for (const edge of graph.edges) {
      const route = legacy.routes.get(edge.id), parts = segments(route), strict = currentLayout(graph) || strictEdgeIds?.has(edge.id);
      const report = (ruleId, ids, measured, required, boxes, remediation, hard = true) => diagnostics.push({ ruleId, severity: hard && strict ? 'error' : 'warning', diagramType: type, elementIds: ids, measured, required, bounds: boxes, remediation });
      let minimum = Infinity, hugging = 0;
      for (const {node,probe} of probes) {
        const distances = parts.flatMap(([a,b], index) => (node.id === edge.source && index === 0 || node.id === edge.target && index === parts.length-1) ? [] : [probe(a,b)]);
        const distance = Math.min(...distances); minimum = Math.min(minimum,distance);
        if (distance + .001 < clearance.node) report('route.node-clearance',[edge.id,node.id],distance,clearance.node,[nodeBoxes.get(node.id)],'Arrange this relation with clear space around the visible component.');
      }
      for (const group of graph.groups ?? []) {
        const near = parts.map(([a,b])=>boundaryClearance(a,b,group)).filter(item=>item.distance+.001<clearance.boundary);
        hugging += near.reduce((sum,item)=>sum+item.length,0);
        if (near.length) report('route.boundary-clearance',[edge.id,group.id],Math.min(...near.map(item=>item.distance)),clearance.boundary,[bounds(group)],'Cross the boundary perpendicularly or leave a clear parallel channel.');
      }
      const length = parts.reduce((sum,[a,b])=>sum+Math.abs(a.x-b.x)+Math.abs(a.y-b.y),0), start=route.points[0], end=route.points.at(-1);
      const direct=Math.abs(start.x-end.x)+Math.abs(start.y-end.y), bends=Math.max(0,route.points.length-2), detour=direct ? length/direct : null;
      const shortSegments=parts.slice(1,-1).filter(([a,b])=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)<clearance.node-.001).length;
      routeMetrics.push({edgeId:edge.id,length,bends,detour,minimumClearance:Number.isFinite(minimum)?minimum:null,boundaryHugging:hugging,shortSegments});
      if (bends>4 || shortSegments || edge.source!==edge.target && detour>1.8) report('route.complexity',[edge.id],{bends,shortSegments,detour},{bends:4,shortSegments:0,detour:1.8},[{x:Math.min(...route.points.map(p=>p.x)),y:Math.min(...route.points.map(p=>p.y)),width:Math.max(...route.points.map(p=>p.x))-Math.min(...route.points.map(p=>p.x)),height:Math.max(...route.points.map(p=>p.y))-Math.min(...route.points.map(p=>p.y))}],'Try a simpler corridor or arrange nearby components; necessary detours remain supported.',false);
    }
  }
  // Existing shape/fragment/marker checks stay blocking; new rules carry structured locations above.
  for (const detail of overviewGeometryErrors(graph, legacy.routes)) { const elements = overviewSections(graph).filter(item => detail.includes(item.id)); issue('overview.section', elements.map(item => item.id), detail, 'Complete section text and contained items', elements.map(bounds), 'Expand and re-layout the identified section without removing facts.'); }
  const errors = [...diagnostics.filter(item => item.severity === 'error').map(item => `${item.ruleId}: ${item.elementIds.join(', ')} (${JSON.stringify(item.measured)}; required ${JSON.stringify(item.required)})`)];
  return { ...legacy, errors, diagnostics, routeMetrics, bounds: graphBounds(graph, legacy.routes) };
}
