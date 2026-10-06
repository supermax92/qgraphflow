import { layoutText } from './text-layout.js';
import { isArchitectureOverview } from './view-identity.js';

export const overviewSections = graph => {
  const walk = (sections, depth = 0) => (Array.isArray(sections) && depth <= 16 ? sections : []).filter(section => section && typeof section === 'object').flatMap(section => [section, ...walk((Array.isArray(section.items) ? section.items : []).filter(item => item?.mode), depth + 1)]);
  return walk(graph.layout?.sections);
};
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim());
export const hasOverviewContent = node => node.overviewText !== undefined || node.badges !== undefined;

export function validateOverview(graph, { inputOnly = true, validateAnchor, evidenceKinds } = {}) {
  const errors = [], overview = isArchitectureOverview(graph);
  const anchor = (source, path) => {
    if (!object(source)) errors.push(`${path} must be an object`);
    else { validateAnchor?.(source, path, errors); if (source.kind !== undefined && !evidenceKinds?.has(source.kind)) errors.push(`${path}.kind is unsupported`); }
  };
  for (const node of graph.nodes ?? []) {
    if (node.overviewText !== undefined && !strings(node.overviewText)) errors.push(`node ${node.id}.overviewText must contain non-empty strings`);
    if (node.badges !== undefined) {
      if (!Array.isArray(node.badges)) errors.push(`node ${node.id}.badges must be an array`);
      else for (const [i, badge] of node.badges.entries()) {
        const path = `node ${node.id}.badges[${i}]`;
        if (!object(badge) || typeof badge.label !== 'string' || !badge.label.trim() || !['status', 'version', 'requirement'].includes(badge.role) || !evidenceKinds?.has(badge.evidence)) errors.push(`${path} needs label, role (status/version/requirement) and evidence`);
        if (badge?.source !== undefined) anchor(badge.source, `${path}.source`);
      }
    }
  }
  if (!overview) {
    if (graph.layout?.sections !== undefined) errors.push('layout.sections requires an architecture overview');
    return errors;
  }
  if (!Array.isArray(graph.layout?.sections) || !graph.layout.sections.length) return [...errors, 'architecture overview requires non-empty layout.sections'];
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const groups = new Map((graph.groups ?? []).map(group => [group.id, group]));
  const seen = new Set(), sectionIds = new Set(), referencedGroups = new Set();
  const addNode = id => { if (!nodeMap.has(id)) errors.push(`section nodeId does not name a node: ${id}`); else if (seen.has(id)) errors.push(`section repeats node ${id}`); else seen.add(id); };
  const addGroup = (id, ancestry = new Set()) => {
    if (!groups.has(id)) { errors.push(`section groupId does not name a group: ${id}`); return; }
    if (ancestry.has(id) || referencedGroups.has(id)) { errors.push(`section repeats or cycles group ${id}`); return; }
    referencedGroups.add(id); const path = new Set([...ancestry, id]);
    graph.nodes.filter(node => node.groupId === id).forEach(node => addNode(node.id));
    [...groups.values()].filter(group => group.parentId === id).forEach(group => addGroup(group.id, path));
  };
  const visit = (section, depth = 0) => {
    if (!object(section) || depth > 16) { errors.push('invalid section or nesting exceeds 16 levels'); return; }
    if (typeof section.id !== 'string' || !section.id.trim() || sectionIds.has(section.id) || nodeMap.has(section.id) || groups.has(section.id)) errors.push(`section.id must be unique: ${section.id}`);
    sectionIds.add(section.id);
    if (!['stack', 'grid', 'row', 'note'].includes(section.mode)) errors.push(`section ${section.id}.mode is unsupported`);
    if (typeof section.title !== 'string' || !section.title.trim()) errors.push(`section ${section.id}.title is required`);
    if (section.text !== undefined && !strings(section.text)) errors.push(`section ${section.id}.text must contain non-empty strings`);
    if (section.source !== undefined) anchor(section.source, `section ${section.id}.source`);
    if (section.detailOf !== undefined && !nodeMap.has(section.detailOf)) errors.push(`section ${section.id}.detailOf does not name a node`);
    if (!inputOnly && (!object(section.position) || !object(section.size) || !Number.isFinite(section.position.x) || !Number.isFinite(section.position.y) || section.position.x < 0 || section.position.y < 0 || !Number.isFinite(section.size.width) || !Number.isFinite(section.size.height) || section.size.width <= 0 || section.size.height <= 0)) errors.push(`section ${section.id} requires finite geometry`);
    if (section.mode === 'note') {
      if (!strings(section.text) || !section.text.length || (section.items?.length ?? 0)) errors.push(`note ${section.id} requires text and no items`);
    } else if (!Array.isArray(section.items) || !section.items.length) errors.push(`section ${section.id}.items must be non-empty`);
    for (const item of Array.isArray(section.items) ? section.items : []) {
      if (!object(item)) { errors.push(`section ${section.id} item must be an object`); continue; }
      const refs = ['nodeId', 'groupId', 'mode'].filter(key => Object.hasOwn(item, key));
      if (refs.length !== 1) errors.push(`section ${section.id} item needs exactly one nodeId, groupId or nested section`);
      else if (item.nodeId !== undefined) addNode(item.nodeId);
      else if (item.groupId !== undefined) addGroup(item.groupId);
      else visit(item, depth + 1);
    }
  };
  graph.layout.sections.forEach(section => visit(section));
  for (const id of nodeMap.keys()) if (!seen.has(id)) errors.push(`overview node ${id} is missing from sections`);
  return errors;
}

export function overviewCardLayout(node, width = node.size.width) {
  const inner = width - 40;
  const title = layoutText(node.label, inner, 20, 26), subtitle = layoutText(node.subtitle ?? '', inner, 16, 24);
  let cursor = 20;
  const lines = [];
  const add = (content, font, height, role) => { for (const line of content.lines) { lines.push({ text: line, x: 20, y: cursor + font, role }); cursor += height; } };
  add(title, 20, 26, 'title'); if (subtitle.lines.length) { cursor += 6; add(subtitle, 16, 24, 'body'); }
  for (const paragraph of node.overviewText ?? []) { cursor += 8; add(layoutText(paragraph, inner, 16, 24), 16, 24, 'body'); }
  const badges = [];
  if (node.badges?.length) {
    cursor += 12; let x = 20, rowHeight = 0;
    for (const badge of node.badges) {
      const label = layoutText(badge.label, inner - 16, 14, 20), w = Math.min(inner, Math.max(70, label.width + 16)), h = label.height + 10;
      if (x > 20 && x + w > width - 20) { cursor += rowHeight + 8; x = 20; rowHeight = 0; }
      badges.push({ ...badge, x, y: cursor, width: w, height: h, lines: label.lines }); x += w + 8; rowHeight = Math.max(rowHeight, h);
    }
    cursor += rowHeight;
  }
  return { lines, badges, minHeight: cursor + 20 };
}

const sectionContentHeight = (section, width) => 32 + layoutText(section.title, width - 64, 20, 26).height + (section.text ?? []).reduce((sum, paragraph) => sum + 12 + layoutText(paragraph, width - 64, 16, 24).height, 0);

// The same synchronous layout runs in Node and in the offline Viewer. Sections are presentation, never ownership.
export function layoutArchitectureOverview(input, { width = 1800, gap = 120 } = {}) {
  const graph = structuredClone(input), nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const groups = new Map((graph.groups ?? []).map(group => [group.id, group]));
  const nodeHeight = (node, w) => hasOverviewContent(node) ? overviewCardLayout(node, w).minHeight : Math.max(100, 40 + layoutText(node.label, w - 100, 20, 26).height + layoutText(node.subtitle ?? '', w - 68, 16, 24).height + (node.source ? 26 : 0));
  const groupSection = id => { const group = groups.get(id); return { id, title: group.label, mode: 'grid', group: true, items: [...(graph.groups ?? []).filter(child => child.parentId === id).map(child => ({ groupId: child.id })), ...graph.nodes.filter(node => node.groupId === id).map(node => ({ nodeId: node.id }))] }; };
  const measure = (item, w) => {
    if (item.nodeId) return { item, width: w, height: nodeHeight(nodes.get(item.nodeId), w) };
    const section = item.groupId ? groupSection(item.groupId) : item;
    const top = sectionContentHeight(section, w) + (section.mode === 'note' ? 24 : 64);
    if (section.mode === 'note') return { item: section, width: w, height: top + 20 };
    const columns = section.mode === 'row' ? section.items.length : section.mode === 'grid' ? Math.min(section.items.length, Math.max(1, Math.floor((w - 64 + 128) / 428))) : 1;
    const cellWidth = (w - 64 - 128 * (columns - 1)) / columns;
    const children = section.items.map(child => measure(child, cellWidth));
    const rows = [];
    for (let i = 0; i < children.length; i += columns) rows.push(children.slice(i, i + columns));
    return { item: section, width: w, height: top + rows.reduce((sum, row) => sum + Math.max(...row.map(child => child.height)), 0) + gap * Math.max(0, rows.length - 1) + 32, top, rows };
  };
  const place = (plan, x, y) => {
    if (plan.item.nodeId) { const node = nodes.get(plan.item.nodeId); node.position = { x, y }; node.size = { width: plan.width, height: plan.height }; return; }
    const section = plan.item; section.position = { x, y }; section.size = { width: plan.width, height: plan.height };
    if (section.group) Object.assign(groups.get(section.id), { position: section.position, size: section.size });
    let rowY = y + plan.top;
    for (const row of plan.rows ?? []) { let columnX = x + 32; for (const child of row) { place(child, columnX, rowY); columnX += child.width + 128; } rowY += Math.max(...row.map(child => child.height)) + gap; }
  };
  // A parallel region must keep readable card widths, even with many columns or nested regions.
  const minimumWidth = item => {
    if (item.nodeId) return 300;
    const section = item.groupId ? groupSection(item.groupId) : item;
    if (section.mode === 'note') return 364;
    const sizes = section.items.map(minimumWidth);
    return section.mode === 'row' ? 64 + sizes.reduce((sum, size) => sum + size, 0) + 128 * (sizes.length - 1) : 64 + Math.max(...sizes);
  };
  width = Math.max(width, ...graph.layout.sections.map(minimumWidth));
  let y = 48;
  for (const section of graph.layout.sections) { const plan = measure(section, width); place(plan, 48, y); y += plan.height + gap; }
  // Boundaries not explicitly laid out as a group reference still keep their real member ownership.
  const bounds = group => {
    const children = [...graph.nodes.filter(node => node.groupId === group.id), ...(graph.groups ?? []).filter(child => child.parentId === group.id).map(child => { bounds(child); return child; })];
    if (!children.length) throw new Error(`Empty ownership group ${group.id}`);
    const x = Math.min(...children.map(child => child.position.x)) - 32, y = Math.min(...children.map(child => child.position.y)) - layoutText(group.label, width, 20, 26).height - 24;
    const right = Math.max(...children.map(child => child.position.x + child.size.width)) + 32, bottom = Math.max(...children.map(child => child.position.y + child.size.height)) + 32;
    group.position = { x: Math.max(0, x), y: Math.max(0, y) }; group.size = { width: right - group.position.x, height: bottom - group.position.y };
  };
  for (const group of graph.groups ?? []) if (!group.parentId && !overviewSections(graph).some(section => section.items?.some(item => item.groupId === group.id))) bounds(group);
  graph.layout.direction = 'down'; graph.layout.strategy = 'architecture-overview-v1';
  // Recompute routes after all node movements; the common orthogonal router remains authoritative.
  for (const edge of graph.edges) delete edge.route;
  return routeOverview(graph);
}

export function fitArchitectureOverview(input, accept) {
  let last;
  for (const gap of [120, 200, 320]) { try { const graph = layoutArchitectureOverview(input, { gap }); accept(graph); return graph; } catch (error) { last = error; } }
  throw last;
}

export function reorderOverview(graph, id, position) {
  const next = structuredClone(graph), target = next.nodes.find(node => node.id === id);
  if (!target) return next;
  const list = overviewSections(next).find(section => section.items?.some(item => item.nodeId === id));
  if (list) {
    const peers = list.items.filter(item => item.nodeId).map(item => next.nodes.find(node => node.id === item.nodeId));
    const nearest = peers.sort((a, b) => Math.hypot(a.position.x - position.x, a.position.y - position.y) - Math.hypot(b.position.x - position.x, b.position.y - position.y))[0];
    if (nearest && nearest.id !== id) { const from = list.items.findIndex(item => item.nodeId === id), to = list.items.findIndex(item => item.nodeId === nearest.id); list.items.splice(to, 0, list.items.splice(from, 1)[0]); }
  } else if (target.groupId) {
    const peers = next.nodes.filter(node => node.groupId === target.groupId), nearest = peers.sort((a, b) => Math.hypot(a.position.x - position.x, a.position.y - position.y) - Math.hypot(b.position.x - position.x, b.position.y - position.y))[0];
    if (nearest && nearest.id !== id) { const from = next.nodes.findIndex(node => node.id === id), to = next.nodes.findIndex(node => node.id === nearest.id); next.nodes.splice(to, 0, next.nodes.splice(from, 1)[0]); }
  }
  return next;
}

const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const svgText = (x, y, value, role) => `<text x="${x}" y="${y}" class="${role}">${escape(value)}</text>`;
export function overviewCardSvg(node, x, y, palette, fill, stroke) {
  const layout = overviewCardLayout(node);
  return `<rect x="${x}" y="${y}" width="${node.size.width}" height="${node.size.height}" rx="16" fill="${fill}" stroke="${stroke}"/>` + layout.lines.map(line => svgText(x + line.x, y + line.y, line.text, line.role)).join('') + layout.badges.map(badge => `<g data-badge-role="${badge.role}"><rect x="${x + badge.x}" y="${y + badge.y}" width="${badge.width}" height="${badge.height}" rx="6" fill="${palette.badge}" stroke="${palette.rule}"/>${badge.lines.map((line, i) => svgText(x + badge.x + 8, y + badge.y + 20 + i * 20, line, 'meta')).join('')}</g>`).join('');
}
export function sectionSvg(section, palette, offsetX = 0, offsetY = 0) {
  const x = section.position.x + offsetX, y = section.position.y + offsetY, w = section.size.width;
  const heading = layoutText(section.title, w - 64, 20, 26); let cursor = y + 32 + heading.height;
  let body = '';
  for (const paragraph of section.text ?? []) { cursor += 12; const lines = layoutText(paragraph, w - 64, 16, 24); body += lines.lines.map((line, i) => svgText(x + 32, cursor + 16 + i * 24, line, 'body')).join(''); cursor += lines.height; }
  return `<g data-overview-section-id="${escape(section.id)}"><rect x="${x}" y="${y}" width="${w}" height="${section.size.height}" rx="16" fill="${palette.surface}" stroke="${palette.rule}"/>${heading.lines.map((line, i) => svgText(x + 32, y + 32 + 20 + i * 26, line, 'title')).join('')}${body}</g>`;
}

export function overviewGeometryErrors(graph, routes = new Map()) {
  if (!isArchitectureOverview(graph)) return [];
  const errors = [], sections = overviewSections(graph);
  for (const section of sections) {
    const required = sectionContentHeight(section, section.size.width) + (section.mode === 'note' ? 44 : 32);
    if (section.size.height < required) errors.push(`section ${section.id} text is clipped`);
    for (const item of Array.isArray(section.items) ? section.items : []) {
      const child = item.nodeId ? graph.nodes.find(node => node.id === item.nodeId) : item.groupId ? graph.groups.find(group => group.id === item.groupId) : item;
      if (child && (child.position.x < section.position.x + 32 || child.position.y < section.position.y + sectionContentHeight(section, section.size.width) + 24 || child.position.x + child.size.width > section.position.x + section.size.width - 32 || child.position.y + child.size.height > section.position.y + section.size.height - 32)) errors.push(`section ${section.id} does not contain ${child.id}`);
    }
  }
  const itemBox = item => ({ ...item.position, ...item.size });
  const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  const siblings = items => {
    const resolved = items.map(item => item.nodeId ? graph.nodes.find(node => node.id === item.nodeId) : item.groupId ? (graph.groups ?? []).find(group => group.id === item.groupId) : item).filter(Boolean);
    for (let i = 0; i < resolved.length; i++) for (const other of resolved.slice(i + 1)) if (overlaps(itemBox(resolved[i]), itemBox(other))) errors.push(`overview siblings ${resolved[i].id} and ${other.id} overlap`);
  };
  siblings(graph.layout.sections);
  for (const section of sections) if (section.items) siblings(section.items);
  const crosses = (a, b, rect) => {
    let low = 0, high = 1;
    for (const [axis, dimension] of [['x', 'width'], ['y', 'height']]) {
      const delta = b[axis] - a[axis];
      if (!delta) { if (a[axis] <= rect[axis] || a[axis] >= rect[axis] + rect[dimension]) return false; continue; }
      const t1 = (rect[axis] - a[axis]) / delta, t2 = (rect[axis] + rect[dimension] - a[axis]) / delta;
      low = Math.max(low, Math.min(t1, t2)); high = Math.min(high, Math.max(t1, t2));
      if (low >= high) return false;
    }
    return high > 0 && low < 1;
  };
  for (const section of sections) {
    const obstacle = { ...itemBox(section), height: section.mode === 'note' ? section.size.height : sectionContentHeight(section, section.size.width) + 8 };
    for (const [id, route] of routes) {
      if (route.points.slice(1).some((point, i) => crosses(route.points[i], point, obstacle))) errors.push(`overview route ${id} crosses section ${section.id} text`);
      if (route.label && overlaps(route.labelBox, obstacle)) errors.push(`overview label ${id} overlaps section ${section.id} text`);
    }
  }
  return errors;
}

// Route through a rectilinear visibility grid. Presentation headings and notes are obstacles too.
export function routeOverview(graph) {
  const box = item => ({ ...item.position, ...item.size });
  const expand = (rect, pad) => ({ x: rect.x - pad, y: rect.y - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 });
  const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  const onSegment = (a, b, rect) => a.x === b.x ? a.x > rect.x && a.x < rect.x + rect.width && Math.max(a.y, b.y) > rect.y && Math.min(a.y, b.y) < rect.y + rect.height : a.y > rect.y && a.y < rect.y + rect.height && Math.max(a.x, b.x) > rect.x && Math.min(a.x, b.x) < rect.x + rect.width;
  const headings = overviewSections(graph).map(section => section.mode === 'note' ? box(section) : { ...box(section), height: sectionContentHeight(section, section.size.width) + 8 });
  const base = [...graph.nodes.map(node => expand(box(node), 24)), ...headings];
  const previous = [], labels = [];
  for (const [edgeIndex, edge] of graph.edges.entries()) {
    const source = graph.nodes.find(node => node.id === edge.source), target = graph.nodes.find(node => node.id === edge.target);
    const ports = node => {
      const rect = box(node), cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
      const shiftX = Math.min(rect.width / 2 - 20, (edgeIndex % 5 - 2) * 28), shiftY = Math.min(rect.height / 2 - 20, (edgeIndex % 3 - 1) * 28);
      return [...[.2, .5, .8].flatMap(fraction => [{ x: rect.x + rect.width * fraction + shiftX, y: rect.y - 40 }, { x: rect.x + rect.width * fraction + shiftX, y: rect.y + rect.height + 40 }]), { x: rect.x - 40, y: cy + shiftY }, { x: rect.x + rect.width + 40, y: cy + shiftY }];
    };
    const starts = ports(source), ends = ports(target), obstacles = [...base, ...labels.map(rect => expand(rect, 24)), ...previous];
    const pointBlocked = point => point.x < 0 || point.y < 0 || obstacles.some(rect => point.x > rect.x && point.x < rect.x + rect.width && point.y > rect.y && point.y < rect.y + rect.height);
    const xValues = [...starts, ...ends].map(point => point.x), yValues = [...starts, ...ends].map(point => point.y);
    for (const rect of obstacles) { xValues.push(Math.max(8, rect.x - 16), rect.x + rect.width + 16); yValues.push(Math.max(8, rect.y - 16), rect.y + rect.height + 16); }
    const xs = [...new Set(xValues)].sort((a, b) => a - b), ys = [...new Set(yValues)].sort((a, b) => a - b);
    const key = point => `${point.x},${point.y}`, endKeys = new Set(ends.filter(point => !pointBlocked(point)).map(key));
    const queue = starts.filter(point => !pointBlocked(point)).map(point => ({ point, distance: 0, path: [point] })), distances = new Map(queue.map(item => [key(item.point), 0]));
    let path;
    while (queue.length) {
      queue.sort((a, b) => b.distance - a.distance); const here = queue.pop();
      if (here.distance !== distances.get(key(here.point))) continue;
      if (endKeys.has(key(here.point))) { path = here.path; break; }
      const xi = xs.indexOf(here.point.x), yi = ys.indexOf(here.point.y);
      const neighbors = [[xi - 1, yi], [xi + 1, yi], [xi, yi - 1], [xi, yi + 1]].filter(([x, y]) => x >= 0 && x < xs.length && y >= 0 && y < ys.length).map(([x, y]) => ({ x: xs[x], y: ys[y] }));
      for (const next of neighbors) {
        if (pointBlocked(next) || obstacles.some(rect => onSegment(here.point, next, rect))) continue;
        const last = here.path.at(-2), bend = last && ((last.x === here.point.x) !== (here.point.x === next.x)) ? 32 : 0;
        const distance = here.distance + Math.abs(next.x - here.point.x) + Math.abs(next.y - here.point.y) + bend;
        if (distance >= (distances.get(key(next)) ?? Infinity)) continue;
        distances.set(key(next), distance); queue.push({ point: next, distance, path: [...here.path, next] });
      }
    }
    if (!path) throw new Error(`Overview route ${edge.id} has no clear corridor`);
    path = path.filter((point, i) => !i || i === path.length - 1 || !((path[i - 1].x === point.x && point.x === path[i + 1].x) || (path[i - 1].y === point.y && point.y === path[i + 1].y)));
    const labelSize = { width: Math.max(44, layoutText(edge.label ?? '', 360, 16, 24).width + 12), height: Math.max(30, layoutText(edge.label ?? '', 360, 16, 24).height + 6) };
    let labelAt;
    const segments = path.slice(1).map((end, i) => ({ start: path[i], end, length: Math.abs(end.x - path[i].x) + Math.abs(end.y - path[i].y) })).sort((a, b) => b.length - a.length);
    for (const { start, end } of segments) for (const fraction of [.5, .25, .75]) {
      const point = { x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction }, rect = { x: point.x - labelSize.width / 2, y: point.y - labelSize.height / 2, ...labelSize };
      if (!labelAt && ![...base, ...previous, ...labels.map(rect => expand(rect, 24))].some(obstacle => overlap(rect, obstacle))) { labelAt = point; labels.push(rect); }
    }
    if (edge.label && !labelAt) throw new Error(`Overview route ${edge.id} has no clear label area`);
    edge.route = { via: path, ...(labelAt ? { labelAt } : {}) };
    for (const { start, end } of segments) previous.push(start.x === end.x ? { x: start.x - 24, y: Math.min(start.y, end.y), width: 48, height: Math.abs(start.y - end.y) } : { x: Math.min(start.x, end.x), y: start.y - 24, width: Math.abs(start.x - end.x), height: 48 });
  }
  return graph;
}
