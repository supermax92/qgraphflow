import { sequenceHeaderHeight } from './diagrams/sequence.js';
import { operandScopes } from './sequence-fragments.js';

export function sequencePairs(graph) {
  if (graph.meta.diagramType !== 'sequence') return new Map();
  const calls = [...new Set(graph.edges.map(edge => edge.replyTo).filter(Boolean))].sort();
  const indices = new Map(calls.map((id, index) => [id, index]));
  return new Map(graph.edges.filter(edge => indices.has(edge.replyTo ?? edge.id)).map(edge => {
    const callId = edge.replyTo ?? edge.id, index = indices.get(callId);
    return [edge.id, { callId, index, label: `${edge.replyTo ? '↩ ' : ''}C${index + 1}` }];
  }));
}

export function sequenceEndpointY(graph, edge, at) {
  const source = graph.nodes.find(node => node.id === edge.source);
  const target = graph.nodes.find(node => node.id === edge.target);
  return (edge.route?.messageY ?? Math.min(source.position.y, target.position.y) + Math.max(...graph.nodes.map(sequenceHeaderHeight)) + 4 + edge.order * 54)
    + (at === 'receive' && edge.source === edge.target ? 30 : 0);
}

export function validateExecutions(graph, { inputOnly = false } = {}) {
  const errors = [], edges = new Map(graph.edges.map(edge => [edge.id, edge]));
  const sequence = graph.meta.diagramType === 'sequence';
  if (!sequence) {
    if (graph.executions !== undefined || graph.edges.some(edge => edge.replyTo !== undefined)) errors.push('executions and replyTo are only supported for sequence');
    return errors;
  }
  if (!inputOnly) {
    const ordered = [...graph.edges].sort((a, b) => a.order - b.order);
    for (let i = 1; i < ordered.length; i++) if (sequenceEndpointY(graph, ordered[i], 'send') <= sequenceEndpointY(graph, ordered[i - 1], 'send')) errors.push(`edge ${ordered[i].id}.route.messageY must preserve message order after ${ordered[i - 1].id}`);
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
      ys.push(inputOnly ? edge.order * 2 + Number(endpoint.at === 'receive' && edge.source === edge.target) : sequenceEndpointY(graph, edge, endpoint.at));
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

// Geometry is shared by routing, the participant SVG, exports and bounds.
export function sequenceExecutions(graph) {
  if (graph.meta.diagramType !== 'sequence') return [];
  const items = graph.executions ?? [], edges = new Map(graph.edges.map(edge => [edge.id, edge])), scopes = operandScopes(graph);
  return items.map(item => {
    let depth = 0, parent = items.find(other => other.id === item.parentId);
    const seen = new Set([item.id]);
    while (parent && !seen.has(parent.id)) { seen.add(parent.id); depth++; parent = items.find(other => other.id === parent.parentId); }
    const node = graph.nodes.find(node => node.id === item.participantId);
    const y = sequenceEndpointY(graph, edges.get(item.start.edgeId), item.start.at);
    return { ...item, depth, scope: scopes.get(item.start.edgeId) ?? '', x: node.position.x + node.size.width / 2 - 8 + depth * 8, y, width: 16, height: sequenceEndpointY(graph, edges.get(item.end.edgeId), item.end.at) - y };
  });
}

export function executionAt(executions, participantId, edge, at, y, scope = '') {
  const candidates = executions.filter(item => item.participantId === participantId);
  const bound = candidates.find(item => [item.start, item.end].some(anchor => anchor.edgeId === edge.id && anchor.at === at));
  if (bound) return bound;
  return candidates.filter(item => y >= item.y && y <= item.y + item.height && (!item.scope || scope === item.scope || scope.startsWith(item.scope + '/'))).sort((a, b) => b.depth - a.depth)[0];
}
