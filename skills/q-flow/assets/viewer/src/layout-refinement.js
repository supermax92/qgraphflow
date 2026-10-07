import { affectedRouteIds } from './route-clearance.js';
import { compactCandidates } from './layout-compaction.js';
import { layoutWeights, LAYOUT_VERSION, currentLayout } from './layout-policy.js';
import { routeOrthogonal } from './orthogonal-routing.js';
import { auditLayoutQuality, requireDiagramQuality } from './layout-quality.js';
import { graphBounds, occupiedBox } from './edge-routing.js';
import { diagramTypeOf, getDiagram, canvasBudgetFor } from './diagrams/registry.js';
import { layoutTargets, layoutLimits } from './layout-spacing.js';
import { groupHeadingLayout } from './text-layout.js';
import { isArchitectureOverview } from './view-identity.js';
import { spreadParticipants } from './sequence-executions.js';
import { preservesTemplateOrder } from './layout-templates.js';

export const REFINE_BUDGET = 60;
export const MAX_LOCAL_SHIFT = 156;
const stable = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export function layoutMetrics(graph, audit = auditLayoutQuality(graph)) {
  const routes = [...audit.routes.values()], bounds = graphBounds(graph, audit.routes), count = Math.max(1, routes.length);
  const content = graph.nodes.reduce((sum, n) => { const b = occupiedBox(n, diagramTypeOf(graph)); return sum + b.width * b.height; }, 0), unit = Math.sqrt(content / Math.max(1, graph.nodes.length));
  const length = routes.reduce((sum, r) => sum + r.points.slice(1).reduce((s, p, i) => s + Math.abs(p.x - r.points[i].x) + Math.abs(p.y - r.points[i].y), 0), 0);
  const bends = routes.reduce((sum, r) => sum + Math.max(0, r.points.length - 2), 0), crossings = audit.crossings.reduce((sum, item) => sum + item.measured, 0);
  const canvas=canvasBudgetFor(diagramTypeOf(graph)),aspectRatio=bounds.width/Math.max(1,bounds.height),aspectPenalty=canvas?Math.abs(aspectRatio-canvas.width/canvas.height):0;
  return { errors: audit.errors.length, aspectRatio, aspectPenalty, area: bounds.width * bounds.height, length, bends, crossings, cost: bounds.width * bounds.height / content + length / (count * unit) + layoutWeights.bends * bends / count + layoutWeights.crossings * crossings / count };
}
const better = (a, b) => a.errors < b.errors || a.errors === b.errors && (a.cost < b.cost - .001 || Math.abs(a.cost-b.cost)<.001 && a.aspectPenalty < b.aspectPenalty - .001);

function scopeIds(graph, focusId) {
  if (!focusId) return new Set(graph.nodes.map(n => n.id));
  return new Set([focusId, ...graph.edges.filter(e => e.source === focusId || e.target === focusId).flatMap(e => [e.source, e.target])]);
}
function preservesOrder(before, after) {
  if (!preservesTemplateOrder(before, after)) return false;
  const sequence = getDiagram(diagramTypeOf(before)).sequence;
  const axis = sequence ? 'x' : before.layout?.direction === 'right' ? 'y' : 'x';
  for (const a of before.nodes) for (const b of before.nodes) {
    if (a.id >= b.id || a.groupId !== b.groupId || a.layout?.order === undefined || b.layout?.order === undefined) continue;
    const na = after.nodes.find(n => n.id === a.id), nb = after.nodes.find(n => n.id === b.id);
    if ((a.position[axis] - b.position[axis]) * (na.position[axis] - nb.position[axis]) < 0) return false;
  }
  if (['flowchart', 'state'].includes(diagramTypeOf(before))) for (const e of before.edges) {
    const a = before.nodes.find(n => n.id === e.source), b = before.nodes.find(n => n.id === e.target);
    if (a.id === b.id) continue;
    const na = after.nodes.find(n => n.id === a.id), nb = after.nodes.find(n => n.id === b.id);
    if (a.position.x === b.position.x && b.position.y > a.position.y && nb.position.y <= na.position.y) return false;
    if (b.position.x > a.position.x && b.position.y < a.position.y && (nb.position.x <= na.position.x || nb.position.y >= na.position.y)) return false;
  }
  if (sequence) {
    const ordered = [...before.nodes].sort((a, b) => a.position.x - b.position.x || stable(a, b));
    for (let i = 1; i < ordered.length; i++) if (after.nodes.find(n => n.id === ordered[i].id).position.x <= after.nodes.find(n => n.id === ordered[i - 1].id).position.x) return false;
  }
  return true;
}

// A wider participant header pushes every later participant right, then the message spans are restored (the same
// constraints compileSequence uses). Whatever stands at or right of a participant's old left edge moves with it, so a
// fragment frame spanning that cut stretches and the horizontal bound still applies.
function repairSequenceRow(input) {
  const graph = structuredClone(input), limits = layoutLimits(getDiagram('sequence'));
  const nodes = [...graph.nodes].sort((a, b) => a.position.x - b.position.x || stable(a, b)), cuts = nodes.map(node => node.position.x);
  for (let i = 1; i < nodes.length; i++) {
    const shift = nodes[i - 1].position.x + nodes[i - 1].size.width + limits.nodeGap - nodes[i].position.x;
    if (shift > 0) for (let j = i; j < nodes.length; j++) nodes[j].position.x += shift;
  }
  spreadParticipants(graph, nodes);
  const moved = nodes.map((node, i) => node.position.x - cuts[i]);
  if (moved.some(delta => delta > MAX_LOCAL_SHIFT)) return null;
  const follow = x => x + (moved[cuts.findLastIndex(cut => cut <= x)] ?? 0);
  for (const group of graph.groups ?? []) { const right = follow(group.position.x + group.size.width); group.position.x = follow(group.position.x); group.size.width = right - group.position.x; }
  for (const edge of graph.edges) {
    if (edge.route?.via) edge.route.via = edge.route.via.map(point => ({ ...point, x: follow(point.x) }));
    if (edge.route?.labelAt) edge.route.labelAt = { ...edge.route.labelAt, x: follow(edge.route.labelAt.x) };
  }
  return graph;
}

// Expanding edited text may consume both adjacent gaps. Repair that small collision chain
// together before routing; individual moves cannot pass the gate while another gap is invalid.
function repairEditedGaps(input, focusId, laneAxis) {
  const graph = structuredClone(input), type = diagramTypeOf(graph), diagram = getDiagram(type), limits = layoutLimits(diagram);
  if (diagram.sequence) return repairSequenceRow(input);
  const changed = new Set([focusId]), related = new Set([focusId]);
  for (let size = 0; size !== related.size;) { size = related.size; for (const edge of graph.edges) if (related.has(edge.source) || related.has(edge.target)) { related.add(edge.source); related.add(edge.target); } }
  for (let step = 0; step < graph.nodes.length * 2; step++) {
    let moved = false;
    for (const a of [...graph.nodes].sort(stable)) for (const b of graph.nodes) {
      if (a.id >= b.id || !changed.has(a.id) && !changed.has(b.id)) continue;
      const x = Math.max(a.position.x, b.position.x) - Math.min(a.position.x + a.size.width, b.position.x + b.size.width);
      const y = Math.max(a.position.y, b.position.y) - Math.min(a.position.y + a.size.height, b.position.y + b.size.height);
      if (Math.hypot(Math.max(0, x), Math.max(0, y)) >= limits.nodeGap) continue;
      const axis = laneAxis === 'x' || ['flowchart', 'state', 'class'].includes(type) ? 'y' : laneAxis === 'y' ? 'x' : x <= 0 ? 'y' : 'x';
      const dimension = axis === 'x' ? 'width' : 'height';
      const first = a.position[axis] <= b.position[axis] ? a : b, last = first === a ? b : a;
      const cut = last.position[axis], shift = first.position[axis] + first.size[dimension] + limits.nodeGap - cut;
      // Grow a row/column gap as a unit, so siblings and following bands keep their alignment.
      for (const item of graph.nodes.filter(node => node.groupId === last.groupId && (related.has(node.id) || Math.abs(node.position[axis] - cut) < .001) && node.position[axis] >= cut)) {
        item.position[axis] += shift;
        const origin = input.nodes.find(n => n.id === item.id).position;
        if (Math.abs(item.position[axis] - origin[axis]) > MAX_LOCAL_SHIFT) return null;
        changed.add(item.id);
      }
      moved = true;
    }
    if (!moved) break;
  }
  const groups = graph.groups ?? [], groupById = new Map(groups.map(group => [group.id, group]));
  const inside = (id, parent) => {
    for (let item = groupById.get(id), depth = 0; item && depth < groups.length; item = groupById.get(item.parentId), depth++) if (item.id === parent) return true;
    return false;
  };
  // A growing foreign card can reach a neighbouring ownership frame. Move that entire frame, with its members,
  // rather than leaving a member outside or changing ownership. This is bounded by the same operation origin.
  for (const node of graph.nodes.filter(item => changed.has(item.id))) for (const group of groups) {
    if (inside(node.groupId, group.id)) continue;
    const overlapX = Math.min(node.position.x + node.size.width, group.position.x + group.size.width) - Math.max(node.position.x, group.position.x);
    const overlapY = Math.min(node.position.y + node.size.height, group.position.y + group.size.height) - Math.max(node.position.y, group.position.y);
    if (overlapX <= 0 || overlapY <= 0) continue;
    const moves = ['x', 'y'].map(axis => {
      const dimension = axis === 'x' ? 'width' : 'height';
      const after = group.position[axis] + group.size[dimension] / 2 >= node.position[axis] + node.size[dimension] / 2;
      return { axis, delta: after ? node.position[axis] + node.size[dimension] + limits.nodeGap - group.position[axis] : node.position[axis] - limits.nodeGap - group.position[axis] - group.size[dimension] };
    }).sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
    const members = [...groups.filter(item => inside(item.id, group.id)), ...graph.nodes.filter(item => inside(item.groupId, group.id))];
    const movement = moves.find(({axis, delta}) => members.every(item => {
      const original = [...input.nodes, ...(input.groups ?? [])].find(old => old.id === item.id);
      return item.position[axis] + delta >= 0 && Math.abs(item.position[axis] + delta - original.position[axis]) <= MAX_LOCAL_SHIFT;
    }));
    if (!movement) return null;
    for (const item of members) { item.position[movement.axis] += movement.delta; if (graph.nodes.includes(item)) changed.add(item.id); }
  }
  expandOwnershipBounds(graph);
  return graph;
}

function expandOwnershipBounds(graph) {
  const limits = layoutLimits(getDiagram(diagramTypeOf(graph))), groups = graph.groups ?? [], done = new Set();
  const expand = group => {
    if (done.has(group.id)) return; done.add(group.id);
    const children = groups.filter(g => g.parentId === group.id); children.forEach(expand);
    const members = [...graph.nodes.filter(n => n.groupId === group.id), ...children];
    if (!members.length) return;
    const top = groupHeadingLayout(group).height + limits.groupHeadingGap, inset = limits.groupInset;
    const left = Math.max(0, Math.min(group.position.x, ...members.map(n => n.position.x - inset)));
    const upper = Math.max(0, Math.min(group.position.y, ...members.map(n => n.position.y - top)));
    const right = Math.max(group.position.x + group.size.width, ...members.map(n => n.position.x + n.size.width + inset));
    const lower = Math.max(group.position.y + group.size.height, ...members.map(n => n.position.y + n.size.height + inset));
    group.position = { x: left, y: upper }; group.size = { width: right - left, height: lower - upper };
  };
  groups.forEach(expand);
  return graph;
}

// Geometry only. Ranks, ownership, fields, evidence and sequence events stay authored.
export function refineDiagramLayout(input, { focusId = null, move = true, evaluations = REFINE_BUDGET, passes = 3, laneAxis = null, growBoundaries = false, global = false, edgeIds: requestedEdges = null } = {}) {
  laneAxis ??= /fold\d+c$/.test(input.layout?.strategy ?? '') ? 'x' : /fold\d+r?$/.test(input.layout?.strategy ?? '') ? 'y' : null;
  const origin = structuredClone(input), ids = scopeIds(origin, focusId), attempts = [];
  let best = structuredClone(input);
  if (growBoundaries) expandOwnershipBounds(best);
  if (growBoundaries && requestedEdges) requestedEdges = affectedRouteIds(origin, best, requestedEdges);
  const strictEdgeIds = requestedEdges ? new Set(requestedEdges) : focusId ? new Set(best.edges.filter(e => ids.has(e.source) || ids.has(e.target)).map(e => e.id)) : new Set(best.edges.map(e => e.id));
  let metrics = layoutMetrics(best, auditLayoutQuality(best, { strictEdgeIds })), routing, count = 0;
  const evaluate = (candidate, movedId = null, full = false) => {
    let edgeIds = !full && requestedEdges ? new Set(requestedEdges) : !full && focusId ? new Set(candidate.edges.filter(e => ids.has(e.source) || ids.has(e.target)).map(e => e.id)) : null;
    if (!global && !full) edgeIds = affectedRouteIds(best, candidate, edgeIds ?? strictEdgeIds);
    count++;
    try {
      if (global) {
        const audit = auditLayoutQuality(candidate), score = layoutMetrics(candidate,audit);
        // Empty-channel compression can preserve a legal path exactly. Keep that improvement before
        // searching new ports; otherwise repair only paths made invalid by the geometry change.
        if (!score.errors && better(score,metrics)) {
          attempts.push({errors:0,cost:score.cost,routing:{termination:'preserved-clear-paths'}});
          best=candidate; metrics=score; return true;
        }
        if (!score.errors && count>1) {
          edgeIds=affectedRouteIds(best,candidate);
          if(!edgeIds.size)return false;
        }
        if (score.errors) {
          const affected = new Set(audit.diagnostics.filter(d=>d.severity==='error').flatMap(d=>d.elementIds));
          edgeIds = new Set(candidate.edges.filter(e=>affected.has(e.id)).map(e=>e.id));
        }
      }
      const routed = routeOrthogonal(candidate, { passes: movedId || global && count > 1 ? 1 : passes, edgeIds, accept: requireDiagramQuality });
      const next = routed.graph, score = layoutMetrics(next, auditLayoutQuality(next, { strictEdgeIds: edgeIds ?? strictEdgeIds }));
      attempts.push({ errors: score.errors, cost: score.cost, routing: routed.report });
      if (better(score, metrics)) { for (const id of edgeIds ?? []) strictEdgeIds.add(id); best = next; metrics = score; routing = routed.report; return true; }
    } catch (error) { attempts.push({ reason: error.routingReason ?? 'quality', elementIds: error.elementIds ?? [], routing: error.routingReport }); }
    return false;
  };
  if (evaluations > 0) evaluate(best);
  if (move && focusId && metrics.errors && count < evaluations && !isArchitectureOverview(input)) {
    const repaired = repairEditedGaps(best, focusId, laneAxis);
    if (repaired && preservesOrder(origin, repaired)) evaluate(repaired);
  }
  if (global && move && !isArchitectureOverview(input) && diagramTypeOf(input) !== 'sequence') {
    let improved = true;
    while (improved && count < evaluations) {
      improved = false;
      for (const candidate of compactCandidates(best)) {
        if (count >= evaluations) break;
        // Global row/subtree permutations are constrained by authored ranks/order and the type quality gate.
        if (candidate.nodes.some(n => n.position.x < 0 || n.position.y < 0) || !['architecture', 'er'].includes(diagramTypeOf(input)) && !preservesOrder(origin,candidate)) continue;
        const checked = auditLayoutQuality(candidate);
        if (checked.diagnostics.some(d => d.severity === 'error' && (d.ruleId.startsWith('semantic.') || d.ruleId.startsWith('group.') || d.ruleId === 'spacing.nodes'))) continue;
        if (evaluate(candidate, null, true)) { improved = true; break; }
      }
    }
  }
  // Presentation grids are realigned by their section planner, never nudged across slots.
  if (move && !global && !isArchitectureOverview(input)) {
    const diagram = getDiagram(diagramTypeOf(input)), target = layoutTargets(diagram).nodeGap;
    let changed = true;
    while (changed && count < evaluations) {
      changed = false;
      const problems = new Set(auditLayoutQuality(best).diagnostics.filter(d => d.severity === 'error').flatMap(d => d.elementIds));
      const nodes = [...best.nodes].filter(n => ids.has(n.id)).sort((a, b) => Number(problems.has(b.id)) - Number(problems.has(a.id)) || stable(a, b));
      for (const node of nodes) {
        const neighbors = best.edges.filter(e => e.source === node.id || e.target === node.id).map(e => best.nodes.find(n => n.id === (e.source === node.id ? e.target : e.source))).filter(n => n.id !== node.id);
        const adjacent = neighbors.length ? neighbors : best.nodes.filter(n => n.id !== node.id && n.groupId === node.groupId);
        const here = node.position, anchor = origin.nodes.find(n => n.id === node.id).position, moves = [];
        for (const other of [...adjacent].sort(stable)) for (const axis of diagram.sequence ? ['x'] : laneAxis ? [laneAxis === 'x' ? 'y' : 'x'] : ['flowchart', 'state', 'class'].includes(diagramTypeOf(input)) ? ['y'] : ['x', 'y']) {
          const dimension = axis === 'x' ? 'width' : 'height', delta = other.position[axis] - here[axis];
          const desired = delta > 0 ? other.position[axis] - node.size[dimension] - target : other.position[axis] + other.size[dimension] + target;
          if (Math.abs(desired - here[axis]) > 1) moves.push({ axis, value: here[axis] + Math.sign(desired - here[axis]) * Math.min(32, Math.abs(desired - here[axis])) });
        }
        if (problems.size) for (const axis of diagram.sequence ? ['x'] : laneAxis ? [laneAxis === 'x' ? 'y' : 'x'] : ['flowchart', 'state', 'class'].includes(diagramTypeOf(input)) ? ['y'] : ['x', 'y']) for (const delta of [-32, 32]) moves.push({ axis, value: here[axis] + delta });
        const seen = new Set();
        for (const { axis, value } of moves) {
          if (count >= evaluations) break;
          const k = axis + ':' + value;
          if (seen.has(k) || value < 0 || Math.abs(value - anchor[axis]) > MAX_LOCAL_SHIFT) continue; seen.add(k);
          const candidate = structuredClone(best); candidate.nodes.find(n => n.id === node.id).position[axis] = value;
          if (!preservesOrder(origin, candidate)) continue;
          const checked = auditLayoutQuality(candidate);
          if (checked.diagnostics.some(d => d.severity === 'error' && (d.ruleId.startsWith('semantic.') || d.ruleId.startsWith('group.') || d.ruleId === 'spacing.nodes'))) continue;
          if (evaluate(candidate, node.id)) { changed = true; break; }
        }
        if (changed || count >= evaluations) break;
      }
    }
  }
  const report = { budget: evaluations, evaluations: count, termination: count >= evaluations ? 'evaluation-budget' : move ? 'no-improving-local-candidate' : 'routing-only', provenImpossible: false, routing, before: layoutMetrics(origin), after: metrics, attempts };
  try { requireDiagramQuality(best, { strictEdgeIds }); }
  catch (error) { throw Object.assign(error, { routingReport: { ...report, termination: 'no-valid-candidate' } }); }
  const movedNodeIds = best.nodes.filter(n => { const a = origin.nodes.find(o => o.id === n.id); return a.position.x !== n.position.x || a.position.y !== n.position.y; }).map(n => n.id);
  return { graph: best, movedNodeIds, report };
}

// When upgrading an older positioned graph, its valid corridors are a useful candidate too.
// The same finite refinement budget is shared across this seed and the fresh template/layered seed.
export function refineWithLegacySeed(fresh, input, options = {}) {
  const seeds=[fresh];
  if (!currentLayout(input) && diagramTypeOf(input)!=='sequence' && [...input.nodes,...(input.groups??[])].every(n=>n.position&&n.size)) {
    const legacy=structuredClone(input);legacy.layout={...legacy.layout,version:LAYOUT_VERSION,strategy:legacy.layout?.strategy??'legacy-refined'};
    seeds.push(legacy);
  }
  let remaining=options.evaluations??REFINE_BUDGET,best,last,used=0,selectedSeed=0;const reports=[];
  for (const [index,seed] of seeds.entries()) {
    const budget=Math.floor(remaining/(seeds.length-index));
    try {
      const result=refineDiagramLayout(seed,{...options,global:true,evaluations:budget});
      remaining-=result.report.evaluations;used+=result.report.evaluations;reports.push(result.report);
      if(!best||better(result.report.after,best.report.after)){best=result;selectedSeed=index;}
    } catch(error) {
      last=error;const count=error.routingReport?.evaluations??budget;remaining-=count;used+=count;reports.push(error.routingReport??{termination:'no-valid-candidate',evaluations:count});
    }
  }
  if(!best)throw Object.assign(last??new Error('No valid refinement candidate'),{routingReport:{budget:options.evaluations??REFINE_BUDGET,evaluations:used,termination:'no-valid-candidate',seeds:reports}});
  return {...best,report:{...best.report,budget:options.evaluations??REFINE_BUDGET,evaluations:used,selectedSeed,...(seeds.length>1?{seeds:reports}:{})}};
}
