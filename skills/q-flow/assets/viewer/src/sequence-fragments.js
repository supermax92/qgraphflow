import { layoutText } from './text-layout.js';
import { LAYOUT_TARGETS } from './layout-spacing.js';
import { translate } from './i18n.js';
import { text, escapeXml } from './diagrams/drawing.js';

export const intersects = (a, b, gap = 0) => a.x < b.x + b.width + gap && a.x + a.width > b.x - gap && a.y < b.y + b.height + gap && a.y + a.height > b.y - gap;
export const segmentBoxes = route => route.points.slice(1).map((end, i) => {
  const start = route.points[i];
  return { x: Math.min(start.x, end.x) - 6, y: Math.min(start.y, end.y) - 6, width: Math.abs(end.x - start.x) + 12, height: Math.abs(end.y - start.y) + 12 };
});

export const operandId = (operand, index) => operand?.id ?? String(index);
export function operandScopes(graph) {
  const groups = new Map((graph.groups ?? []).map(group => [group.id, group]));
  const result = new Map();
  const prefix = (group, seen = new Set()) => {
    if (!group.parentId || seen.has(group.id)) return '';
    seen.add(group.id);
    const parent = groups.get(group.parentId);
    return parent ? prefix(parent, seen) + `${encodeURIComponent(parent.id)}:${encodeURIComponent(group.parentOperandId)}/` : '';
  };
  for (const group of groups.values()) if (Array.isArray(group.operands)) for (const [i, operand] of group.operands.entries()) {
    for (const id of Array.isArray(operand?.edgeIds) ? operand.edgeIds : []) result.set(id, prefix(group) + `${encodeURIComponent(group.id)}:${encodeURIComponent(operandId(operand, i))}`);
  }
  return result;
}

export function operandEdges(group, operand, index, groups, seen = new Set()) {
  if (seen.has(group.id)) return [];
  const next = new Set(seen).add(group.id);
  const children = groups.filter(child => child.parentId === group.id && child.parentOperandId === operandId(operand, index));
  return [...(operand.edgeIds ?? []), ...children.flatMap(child => (child.operands ?? []).flatMap((item, i) => operandEdges(child, item, i, groups, next)))];
}

export function validateOperands(graph) {
  const errors = [], edges = new Map(graph.edges.map(edge => [edge.id, edge]));
  const groups = graph.groups ?? [], used = new Map();
  for (const group of groups) {
    const prefix = `group ${group.id}.operands`;
    if (graph.meta.diagramType !== 'sequence') {
      if (group.operands !== undefined || group.parentOperandId !== undefined || group.loop !== undefined) errors.push(`${prefix} is only supported for sequence`);
      continue;
    }
    if (group.parentId !== undefined || group.parentOperandId !== undefined) {
      const parent = groups.find(item => item.id === group.parentId);
      if (!parent || !Array.isArray(parent.operands) || !parent.operands.some((item, i) => operandId(item, i) === group.parentOperandId)) errors.push(`group ${group.id} unknown parent operand ${group.parentId}/${group.parentOperandId}`);
    }
    const seen = new Set([group.id]); let parent = groups.find(item => item.id === group.parentId);
    while (parent) {
      if (seen.has(parent.id)) { errors.push(`group ${group.id} parent cycle at ${parent.id}`); break; }
      seen.add(parent.id); parent = groups.find(item => item.id === parent.parentId);
    }
    if (group.operands === undefined && group.kind !== 'par' && group.loop === undefined && group.parentId === undefined) continue;
    const multiple = ['alt', 'par'].includes(group.kind);
    if (!Array.isArray(group.operands) || (multiple ? group.operands.length < 2 : group.operands.length !== 1)) {
      errors.push(`${prefix} needs ${multiple ? 'at least two branches' : 'exactly one branch'}`); continue;
    }
    if (group.kind === 'loop') {
      if (!Number.isInteger(group.loop?.min) || group.loop.min < 0 || !(group.loop?.max === '*' || Number.isInteger(group.loop?.max) && group.loop.max >= group.loop.min)) errors.push(`group ${group.id}.loop needs a non-negative min and max >= min (or *)`);
    } else if (group.loop !== undefined) errors.push(`group ${group.id}.loop is only supported for loop`);
    const ids = new Set();
    for (const [i, operand] of group.operands.entries()) {
      const label = `${prefix}[${i}] (${String(operand?.id ?? i)})`;
      if (!operand || typeof operand !== 'object' || Array.isArray(operand)) { errors.push(`${label} must be an object`); continue; }
      if (operand.id !== undefined && (typeof operand.id !== 'string' || !operand.id.trim())) errors.push(`${label}.id must be a non-empty string`);
      if (group.kind !== 'alt' && operand.id === undefined) errors.push(`${label}.id is required`);
      const id = operandId(operand, i);
      if (ids.has(id)) errors.push(`${label} duplicate operand id`);
      ids.add(id);
      const field = group.kind === 'par' ? 'label' : 'guard';
      if (typeof operand[field] !== 'string' || !operand[field].trim()) errors.push(`${label}.${field} must be a non-empty string`);
      if (group.kind === 'alt' && operand.guard?.trim?.() === 'else' && i !== group.operands.length - 1) errors.push(`${label} else must be last and unique`);
      if (operand.body !== undefined && (typeof operand.body !== 'string' || !operand.body.trim())) errors.push(`${label}.body must be a non-empty string`);
      const children = groups.filter(child => child.parentId === group.id && child.parentOperandId === id);
      if (!Array.isArray(operand.edgeIds) || !operand.edgeIds.length && !operand.body?.trim?.() && !children.length) { errors.push(`${label}.edgeIds must be an array with messages, body or a child fragment`); continue; }
      for (const edgeId of operand.edgeIds) {
        if (typeof edgeId !== 'string' || !edges.has(edgeId)) errors.push(`${label} unknown edge ${String(edgeId)}`);
        if (used.has(edgeId)) errors.push(`${label} duplicate edge ${edgeId}, already in ${used.get(edgeId)}`);
        used.set(edgeId, `${group.id}/${id}`);
      }
      // Recursive ranges are checked after malformed operands have been rejected.
    }
  }
  if (errors.length) return errors;
  for (const group of groups) {
    let previous = -Infinity;
    for (const [i, operand] of (group.operands ?? []).entries()) {
      const orders = operandEdges(group, operand, i, groups).map(id => edges.get(id)?.order).filter(Number.isFinite);
      if (orders.length && Math.min(...orders) <= previous) errors.push(`group ${group.id}.operands order ranges must be ordered and non-interleaving`);
      if (orders.length) previous = Math.max(...orders);
    }
  }
  return errors;
}

export function fragmentDepth(group, groups) {
  let depth = 0, parent = groups.find(item => item.id === group.parentId);
  const seen = new Set([group.id]);
  while (parent && !seen.has(parent.id)) { seen.add(parent.id); depth++; parent = groups.find(item => item.id === parent.parentId); }
  return depth;
}

// Text masks inside a fragment borrow the innermost frame's surface, so they blend in both themes.
export function fragmentSurfaceAt(box, groups = [], appearances) {
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const inside = groups.filter(group => group.position && group.size && cx >= group.position.x && cx <= group.position.x + group.size.width && cy >= group.position.y && cy <= group.position.y + group.size.height);
  const innermost = inside.sort((a, b) => fragmentDepth(b, groups) - fragmentDepth(a, groups))[0];
  return innermost ? appearances?.get(innermost.id)?.fill : undefined;
}

export const fragmentHeadingLayout = group => layoutText(group.label, Math.min(LAYOUT_TARGETS.headingWidth, Math.max(1, (group.size?.width ?? Infinity) - 88)), 15.12, 22);
export const fragmentHeadingWidth = group => fragmentHeadingLayout(group).width + 16;

function fragmentHeading(group, executions) {
  const frame = { ...group.position, ...group.size };
  const layout = fragmentHeadingLayout(group);
  const size = { width: Math.min(layout.width + 16, frame.width - 88), height: Math.max(24, layout.height + 8), lines: layout.lines };
  return [frame.x + 16, ...executions.map(item => item.x + item.width + 12)].map(x => ({ x, y: frame.y + 6, ...size })).find(box => box.x >= frame.x + 16 && box.x + box.width <= frame.x + frame.width - 64 && !executions.some(item => intersects(box, item, 4)));
}

// The authored frame stays fixed. Conditions use free space beside messages; impossible frames are rejected.
function legacyFragment(group, routes, locale, executions, heading) {
  const errors = [], warnings = [], guards = [], separators = [];
  if (group.kind !== 'alt') return { errors, warnings, guards, separators };
  const frame = { ...group.position, ...group.size };
  const all = [...routes.entries()];
  const inside = route => route.points.some(p => p.x >= frame.x && p.x <= frame.x + frame.width && p.y > frame.y && p.y < frame.y + frame.height);
  const enclosed = all.filter(([, route]) => inside(route));
  const legacy = group.operands === undefined;
  const operands = legacy ? [{ guard: translate(locale, '分支条件未标注'), edgeIds: enclosed.map(([id]) => id) }] : group.operands;
  if (legacy) warnings.push(`group ${group.id}: alt branch conditions are unspecified (operands missing)`);
  if (!Array.isArray(operands) || !operands.length) return { errors, warnings, guards, separators };
  const members = new Set(operands.flatMap(operand => operand.edgeIds ?? []));
  if (!legacy) for (const [id] of enclosed) if (!members.has(id)) errors.push(`layout: group ${group.id} omits enclosed message ${id}`);
  const sections = operands.map(operand => {
    const selected = (operand.edgeIds ?? []).map(id => routes.get(id)).filter(Boolean);
    return { operand, selected, top: Math.min(...selected.map(r => Math.min(r.labelBox.y, ...r.points.map(p => p.y)))), bottom: Math.max(...selected.map(r => Math.max(r.labelBox.y + r.labelBox.height, ...r.points.map(p => p.y)))) };
  });
  for (let i = 1; i < sections.length; i++) {
    const previous = sections[i - 1], next = sections[i];
    if (next.top - previous.bottom < 12) errors.push(`layout: group ${group.id} needs 12px between operands ${i} and ${i + 1}; adjust message order spacing`);
    separators.push((previous.bottom + next.top) / 2);
  }
  const obstacles = [
    ...(heading ? [heading] : []),
    { x: frame.x + frame.width - 52, y: frame.y, width: 52, height: 36 },
    ...all.flatMap(([, r]) => [r.labelBox, ...segmentBoxes(r)]), ...executions
  ];
  sections.forEach(({ operand, selected, top }, i) => {
    const begin = i ? separators[i - 1] : frame.y, end = separators[i] ?? frame.y + frame.height;
    if (!legacy) for (const route of selected) {
      if (route.points.some(p => p.x < frame.x || p.x > frame.x + frame.width || p.y <= begin || p.y >= end) || route.labelBox.x < frame.x || route.labelBox.x + route.labelBox.width > frame.x + frame.width || route.labelBox.y < begin || route.labelBox.y + route.labelBox.height > end) errors.push(`layout: group ${group.id} cannot contain operand ${i + 1}; enlarge or reposition its frame`);
    }
    const label = legacy ? operand.guard : `[${operand.guard}]`;
    const layout = layoutText(label, Math.max(1, frame.width - 32), 14, 20);
    const size = { width: layout.width + 8, height: layout.height + 4 };
    const xs = [frame.x + 16, ...obstacles.map(box => box.x + box.width + 8), frame.x + frame.width - size.width - 16];
    const ys = [begin + 6, top, ...selected.map(r => r.points[0].y - size.height - 6)];
    const candidates = ys.flatMap(y => xs.map(x => ({ x, y, ...size })));
    const box = candidates.find(b => b.x >= frame.x + 8 && b.x + b.width <= frame.x + frame.width - 8 && b.y >= begin + 6 && b.y + b.height <= end - 6 && !obstacles.some(o => intersects(b, o, 2)));
    if (!box) {
      (legacy ? warnings : errors).push(`layout: group ${group.id} has no room for guard ${i + 1}; shorten the guard or adjust the frame/participant spacing`);
      if (!legacy) return;
    }
    guards.push({ ...(box ?? { x: frame.x + 16, y: frame.y + 38, ...size }), lines: layout.lines, operandId: operandId(operand, i) });
  });
  return { errors, warnings, guards, separators };
}

export function sequenceFragment(group, routes, locale, groups = [], executions = []) {
  const errors = [], warnings = [], guards = [], bodies = [], separators = [];
  const frame = { ...group.position, ...group.size }, bottom = frame.y + frame.height;
  // Frame relationships apply before either compact/legacy or nested layout can return.
  const parent = groups.find(item => item.id === group.parentId);
  if (parent && !(frame.x >= parent.position.x + 8 && frame.x + frame.width <= parent.position.x + parent.size.width - 8 && frame.y >= parent.position.y + 36 && bottom <= parent.position.y + parent.size.height - 8)) errors.push(`layout: group ${group.id} exceeds parent ${parent.id}`);
  const ancestors = new Set(); let ancestor = parent;
  while (ancestor && !ancestors.has(ancestor.id)) { ancestors.add(ancestor.id); ancestor = groups.find(item => item.id === ancestor.parentId); }
  for (const other of groups) if (other.id !== group.id && !ancestors.has(other.id)) {
    let item = other; const seen = new Set();
    while (item?.parentId && !seen.has(item.id)) { seen.add(item.id); if (item.parentId === group.id) break; item = groups.find(g => g.id === item.parentId); }
    if (item?.parentId === group.id) continue;
    if (intersects(frame, { ...other.position, ...other.size })) errors.push(`layout: groups ${group.id} and ${other.id} cross without nesting`);
  }
  if (group.kind !== 'alt' && !group.operands) return { errors, warnings, guards, bodies, separators };
  const heading = fragmentHeading(group, executions);
  if (!heading) errors.push(`layout: group ${group.id} has no room for heading; adjust its frame`);
  const children = groups.filter(child => child.parentId === group.id);
  if (group.kind === 'alt' && !group.parentId && !children.length && !(group.operands ?? []).some(item => item.body || !item.edgeIds?.length)) {
    const fragment = legacyFragment(group, routes, locale, executions, heading);
    return { ...fragment, heading, errors: [...errors, ...fragment.errors] };
  }
  if (!group.operands) return { errors, warnings, guards, bodies, separators };
  const headingBottom = Math.max(frame.y + 36, heading ? heading.y + heading.height + 6 : 0);
  const sections = group.operands.map((operand, i) => {
    const childFrames = children.filter(child => child.parentOperandId === operandId(operand, i)).map(child => ({ ...child.position, ...child.size, id: child.id }));
    const selected = operandEdges(group, operand, i, groups).map(id => routes.get(id)).filter(Boolean);
    const boxes = [...childFrames, ...selected.flatMap(route => [route.labelBox, ...segmentBoxes(route)])];
    return { operand, selected, childFrames, boxes, top: Math.min(...boxes.map(box => box.y)), bottom: Math.max(...boxes.map(box => box.y + box.height)) };
  });
  for (let i = 1; i < sections.length; i++) {
    const previous = sections[i - 1], next = sections[i];
    separators.push(Number.isFinite(previous.bottom) && Number.isFinite(next.top) ? (previous.bottom + next.top) / 2 : headingBottom + (bottom - headingBottom) * i / sections.length);
  }
  const members = new Set(group.operands.flatMap((operand, i) => operandEdges(group, operand, i, groups)));
  for (const [id, route] of routes) if (route.points.some(p => p.x >= frame.x && p.x <= frame.x + frame.width && p.y > frame.y && p.y < bottom) && !members.has(id)) errors.push(`layout: group ${group.id} omits enclosed message ${id}`);
  const allObstacles = [...routes.values()].flatMap(route => [route.labelBox, ...segmentBoxes(route)]);
  allObstacles.push(...executions);
  sections.forEach(({ operand, selected, childFrames, top }, i) => {
    const begin = i ? separators[i - 1] : headingBottom, end = separators[i] ?? bottom;
    for (const box of [...childFrames, ...selected.flatMap(route => [route.labelBox, ...segmentBoxes(route)])]) {
      if (box.x < frame.x + 4 || box.x + box.width > frame.x + frame.width - 4 || box.y < begin + 2 || box.y + box.height > end - 2) errors.push(`layout: group ${group.id} cannot contain operand ${operandId(operand, i)}${box.id ? ` child ${box.id}` : ''}; enlarge or reposition its frame`);
    }
    const label = group.kind === 'par' ? operand.label : `${group.kind === 'loop' ? `${group.loop.min}..${group.loop.max} ` : ''}[${operand.guard}]`;
    const obstacles = [...allObstacles, ...childFrames, ...guards, ...bodies];
    const place = (value, kind, after) => {
      const fontSize = kind === 'body' ? 16 : 14, lineHeight = kind === 'body' ? 24 : 20;
      const layout = layoutText(value, Math.min(LAYOUT_TARGETS.labelWidth, Math.max(1, frame.width - 40)), fontSize, lineHeight);
      const size = { width: layout.width + 8, height: layout.height + 4 };
      const xs = [frame.x + 16, ...obstacles.map(box => box.x + box.width + 8), frame.x + frame.width - size.width - 16];
      const ys = [after, ...obstacles.map(box => box.y + box.height + 8), top - size.height - 8].filter(Number.isFinite).sort((a, b) => a - b);
      const box = ys.flatMap(y => xs.map(x => ({ x, y, ...size }))).find(box => box.x >= frame.x + 8 && box.x + box.width <= frame.x + frame.width - 8 && box.y >= after && box.y + box.height <= end - 6 && !obstacles.some(obstacle => intersects(box, obstacle, 2)));
      if (!box) errors.push(`layout: group ${group.id} has no room for ${kind} ${operandId(operand, i)}; adjust frame/message spacing`);
      else { box.lines = layout.lines; box.fontSize = fontSize; box.lineHeight = lineHeight; box.operandId = operandId(operand, i); obstacles.push(box); (kind === 'guard' ? guards : bodies).push(box); }
      return box;
    };
    const guard = place(label, 'guard', begin + 6);
    if (operand.body) place(operand.body, 'body', guard ? guard.y + guard.height + 8 : begin + 38);
  });
  return { errors, warnings, guards, bodies, separators, heading };
}

export function renderFragment(fragment, group, offsetX = 0, offsetY = 0, stroke = 'currentColor', background = 'var(--canvas)') {
  return fragment.separators.map(y => `<path class="operand-separator" d="M${group.position.x + offsetX} ${y + offsetY}h${group.size.width}" fill="none" stroke="${stroke}" stroke-dasharray="6 4"/>`).join('')
    + [...fragment.guards, ...(fragment.bodies ?? [])].map(box => `<g data-fragment-group-id="${escapeXml(group.id)}" data-operand-id="${escapeXml(box.operandId)}" class="${fragment.guards.includes(box) ? 'operand-guard' : 'operand-body'}"><rect x="${box.x + offsetX}" y="${box.y + offsetY}" width="${box.width}" height="${box.height}" rx="2" fill="${background}"/>${box.lines.map((line, i) => text(box.x + offsetX + 4, box.y + offsetY + (box.fontSize === 16 ? 18 : 16) + i * (box.lineHeight ?? 20), line, box.fontSize === 16 ? 'body' : 'group')).join('')}</g>`).join('');
}
