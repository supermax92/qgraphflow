import { operandScopes } from './sequence-fragments.js';
import { edgeLabelLayout } from './text-layout.js';

// Pair numbers follow the calls' message order (C1 is the first call that gets a reply), not their id spelling.
export function sequencePairs(graph) {
  if (graph.meta.diagramType !== 'sequence') return new Map();
  const orderOf = new Map(graph.edges.map(edge => [edge.id, edge.order]));
  const calls = [...new Set(graph.edges.map(edge => edge.replyTo).filter(Boolean))].sort((a, b) => (orderOf.get(a) ?? Infinity) - (orderOf.get(b) ?? Infinity) || (a < b ? -1 : a > b ? 1 : 0));
  const indices = new Map(calls.map((id, index) => [id, index]));
  return new Map(graph.edges.filter(edge => indices.has(edge.replyTo ?? edge.id)).map(edge => {
    const callId = edge.replyTo ?? edge.id, index = indices.get(callId);
    return [edge.id, { callId, index, label: `${edge.replyTo ? '↩ ' : ''}C${index + 1}` }];
  }));
}

export function sequenceMessageLabel(graph, edge, pairs = sequencePairs(graph), scopes = operandScopes(graph)) {
  const pair = pairs.get(edge.id);
  const parallel = (graph.groups ?? []).some(group => group.kind === 'par' && (scopes.get(edge.id) ?? '').split('/').some(segment => segment.startsWith(encodeURIComponent(group.id) + ':')));
  return pair ? `${pair.label} · ${edge.label ?? ''}` : parallel ? edge.label ?? '' : `${String(edge.order).padStart(2, '0')} · ${edge.label ?? ''}`;
}

// Difference constraints on each message's actual span; moving the suffix keeps unrelated neighboring gaps unchanged.
// It only widens, so it lays out a fresh row and repairs a placed one alike. `nodes` stand left to right.
export function spreadParticipants(graph, nodes) {
  const index = id => nodes.findIndex(node => node.id === id);
  const constraints = [...graph.edges].sort((a, b) => Math.abs(index(a.source) - index(a.target)) - Math.abs(index(b.source) - index(b.target)) || a.order - b.order);
  const selfCounts = new Map();
  for (const edge of constraints) {
    const left = Math.min(index(edge.source), index(edge.target));
    let right = Math.max(index(edge.source), index(edge.target));
    let required = edgeLabelLayout(sequenceMessageLabel(graph, edge)).width + 64;
    if (left === right) {
      const ordinal = selfCounts.get(edge.source) ?? 0; selfCounts.set(edge.source, ordinal + 1);
      right++; required += 48 + ordinal * 24;
      if (right === nodes.length) continue;
    }
    const center = node => node.position.x + node.size.width / 2;
    const extra = Math.max(0, required - (center(nodes[right]) - center(nodes[left])));
    for (let i = right; i < nodes.length; i++) nodes[i].position.x += extra;
  }
}

// Hand-edited or legacy data may lack route.messageY, or the whole route. Such a message is stacked by order below the
// default headers so the page still opens; the layout check reports the missing coordinate and --layout auto writes it.
const FALLBACK_TOP = 140, FALLBACK_STEP = 54;
export const sequenceEndpointY = (edge, at) => (edge.route?.messageY ?? FALLBACK_TOP + edge.order * FALLBACK_STEP) + (at === 'receive' && edge.source === edge.target ? 30 : 0);

export function validateExecutions(graph, { inputOnly = false } = {}) {
  const errors = [], edges = new Map(graph.edges.map(edge => [edge.id, edge]));
  const sequence = graph.meta.diagramType === 'sequence';
  if (!sequence) {
    if (graph.executions !== undefined || graph.edges.some(edge => edge.replyTo !== undefined)) errors.push('executions and replyTo are only supported for sequence');
    return errors;
  }
  if (!inputOnly) {
    const ordered = [...graph.edges].sort((a, b) => a.order - b.order);
    for (let i = 1; i < ordered.length; i++) if (sequenceEndpointY(ordered[i], 'send') <= sequenceEndpointY(ordered[i - 1], 'send')) errors.push(`edge ${ordered[i].id}.route.messageY must preserve message order after ${ordered[i - 1].id}`);
  }
  const scopes = operandScopes(graph), returned = new Set();
  for (const edge of graph.edges) {
    if (edge.replyTo === undefined) continue;
    const call = edges.get(edge.replyTo), prefix = `edge ${edge.id}.replyTo ${String(edge.replyTo)}`;
    if (edge.kind !== 'return' || typeof edge.replyTo !== 'string' || !call || !['sync', 'async'].includes(call.kind)) errors.push(`${prefix} must reference a sync or async call from a return`);
    else {
      if (call.order >= edge.order) errors.push(`${prefix} must precede its return`);
      if (call.source !== edge.target || call.target !== edge.source) errors.push(`${prefix} endpoints must be reversed`);
      if (scopes.get(call.id) !== scopes.get(edge.id)) errors.push(`${prefix} must stay in the same operand scope`);
    }
    if (returned.has(edge.replyTo)) errors.push(`${prefix} has a duplicate return`);
    returned.add(edge.replyTo);
  }
  if (graph.executions === undefined) return errors;
  if (!Array.isArray(graph.executions)) return [...errors, 'executions must be an array'];
  const ids = new Map(), intervals = new Map(), anchors = new Map();
  for (const execution of graph.executions) {
    if (!execution || typeof execution !== 'object' || Array.isArray(execution)) { errors.push('execution must be an object'); continue; }
    const prefix = `execution ${String(execution.id)}`;
    if (typeof execution.id !== 'string' || !execution.id.trim()) errors.push(`${prefix} needs a non-empty id`);
    if (ids.has(execution.id)) errors.push(`${prefix} duplicate id`);
    ids.set(execution.id, execution);
    if (!graph.nodes.some(node => node.id === execution.participantId)) errors.push(`${prefix} unknown participant ${String(execution.participantId)}`);
    const ys = [];
    for (const role of ['start', 'end']) {
      const endpoint = execution[role], edge = edges.get(endpoint?.edgeId);
      if (!edge || !['send', 'receive'].includes(endpoint?.at)) { errors.push(`${prefix}.${role} invalid endpoint ${String(endpoint?.edgeId)}`); continue; }
      if (edge[endpoint.at === 'send' ? 'source' : 'target'] !== execution.participantId) errors.push(`${prefix}.${role} endpoint ${edge.id} does not belong to participant ${execution.participantId}`);
      // Semantic ordering must not depend on coordinates or legacy message spacing.
      ys.push(inputOnly ? edge.order * 2 + Number(endpoint.at === 'receive' && edge.source === edge.target) : sequenceEndpointY(edge, endpoint.at));
      const key = `${edge.id}:${endpoint.at}`;
      if (anchors.has(key)) errors.push(`${prefix}.${role} ambiguous endpoint ${key} with execution ${anchors.get(key)}`);
      anchors.set(key, execution.id);
    }
    if (ys.length === 2) {
      if (ys[0] >= ys[1]) errors.push(`${prefix} start must precede end`);
      if (scopes.get(execution.start.edgeId) !== scopes.get(execution.end.edgeId)) errors.push(`${prefix} endpoints must stay in the same operand scope`);
      intervals.set(execution.id, ys);
    }
  }
  for (const execution of ids.values()) {
    if (execution.parentId !== undefined) {
      const parent = ids.get(execution.parentId);
      if (!parent) errors.push(`execution ${execution.id} unknown parent ${String(execution.parentId)}`);
      else {
        if (parent.participantId !== execution.participantId) errors.push(`execution ${execution.id} parent ${parent.id} belongs to another participant`);
        const a = intervals.get(parent.id), b = intervals.get(execution.id);
        if (a && b && (b[0] < a[0] || b[1] > a[1])) errors.push(`execution ${execution.id} exceeds parent ${parent.id}`);
        const parentScope = scopes.get(parent.start?.edgeId) ?? '', childScope = scopes.get(execution.start?.edgeId) ?? '';
        if (parentScope && childScope !== parentScope && !childScope.startsWith(parentScope + '/')) errors.push(`execution ${execution.id} is outside parent ${parent.id} operand scope`);
      }
    }
    const seen = new Set([execution.id]); let parent = ids.get(execution.parentId);
    while (parent) {
      if (seen.has(parent.id)) { errors.push(`execution ${execution.id} parent cycle at ${parent.id}`); break; }
      seen.add(parent.id); parent = ids.get(parent.parentId);
    }
  }
  const list = [...ids.values()];
  const ancestor = (a, b) => { const seen = new Set(); let parent = ids.get(b.parentId); while (parent && !seen.has(parent.id)) { if (parent.id === a.id) return true; seen.add(parent.id); parent = ids.get(parent.parentId); } return false; };
  for (let i = 0; i < list.length; i++) for (const other of list.slice(i + 1)) {
    const item = list[i], a = intervals.get(item.id), b = intervals.get(other.id);
    if (a && b && item.participantId === other.participantId && !ancestor(item, other) && !ancestor(other, item) && a[0] < b[1] && b[0] < a[1]) errors.push(`executions ${item.id} and ${other.id} overlap without nesting`);
  }
  return errors;
}

// Authoring rule for the CLI, not the Viewer: an answered sync call needs a bar on its callee from the call's receive
// to the reply's send. Legacy sequences have no replyTo, so they are never asked for one; async pairs need no bar. Two
// answered calls to one callee that interleave (the second opens inside the first and closes after it) cannot be drawn,
// since bars on one participant nest or stay apart, so neither is asked for one.
export function callsMissingExecutions(graph) {
  if (graph.meta?.diagramType !== 'sequence') return [];
  const edges = new Map(graph.edges.map(edge => [edge.id, edge])), bars = graph.executions ?? [];
  const at = (anchor, edgeId, side) => anchor?.edgeId === edgeId && anchor.at === side;
  const pairs = graph.edges.filter(reply => edges.get(reply.replyTo)?.kind === 'sync').map(reply => ({ call: edges.get(reply.replyTo), reply }));
  const crosses = (a, b) => a.call.order < b.call.order && b.call.order < a.reply.order && a.reply.order < b.reply.order;
  return pairs.filter(pair => !pairs.some(other => other.call.target === pair.call.target && (crosses(pair, other) || crosses(other, pair)))
    && !bars.some(bar => bar.participantId === pair.call.target && at(bar.start, pair.call.id, 'receive') && at(bar.end, pair.reply.id, 'send')));
}

export const missingCallExecutions = graph => callsMissingExecutions(graph)
  .map(({ call, reply }) => `edge ${call.id} sync call answered by ${reply.id} needs an execution on ${call.target} from ${call.id} receive to ${reply.id} send; --fix adds it`);

// Geometry is shared by routing, the participant SVG, exports and bounds.
export function sequenceExecutions(graph) {
  if (graph.meta.diagramType !== 'sequence') return [];
  const items = graph.executions ?? [], edges = new Map(graph.edges.map(edge => [edge.id, edge])), scopes = operandScopes(graph);
  return items.map(item => {
    let depth = 0, parent = items.find(other => other.id === item.parentId);
    const seen = new Set([item.id]);
    while (parent && !seen.has(parent.id)) { seen.add(parent.id); depth++; parent = items.find(other => other.id === parent.parentId); }
    const node = graph.nodes.find(node => node.id === item.participantId);
    const y = sequenceEndpointY(edges.get(item.start.edgeId), item.start.at);
    return { ...item, depth, scope: scopes.get(item.start.edgeId) ?? '', x: node.position.x + node.size.width / 2 - 8 + depth * 8, y, width: 16, height: sequenceEndpointY(edges.get(item.end.edgeId), item.end.at) - y };
  });
}

export function executionAt(executions, participantId, edge, at, y, scope = '') {
  const candidates = executions.filter(item => item.participantId === participantId);
  const bound = candidates.find(item => [item.start, item.end].some(anchor => anchor.edgeId === edge.id && anchor.at === at));
  if (bound) return bound;
  return candidates.filter(item => y >= item.y && y <= item.y + item.height && (!item.scope || scope === item.scope || scope.startsWith(item.scope + '/'))).sort((a, b) => b.depth - a.depth)[0];
}
