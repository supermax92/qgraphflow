import { affectedRouteIds } from './route-clearance.js';
import { LAYOUT_VERSION } from './layout-policy.js';
import { presentationGraph, mergePresentationEdges } from './presentation-graph.js';
import { routeOrthogonal } from './orthogonal-routing.js';
import { layoutText } from './text-layout.js';
import { isArchitectureOverview } from './view-identity.js';
import { OVERVIEW, OVERVIEW_TONES, overviewPalette } from './architecture-overview-theme.js';

export const overviewSections = graph => {
  const walk = (sections, depth = 0) => (Array.isArray(sections) && depth <= 16 ? sections : []).filter(section => section && typeof section === 'object').flatMap(section => [section, ...walk((Array.isArray(section.items) ? section.items : []).filter(item => item?.mode), depth + 1)]);
  return walk(graph.layout?.sections);
};
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim());
export const hasOverviewContent = node => node.overviewText !== undefined || node.badges !== undefined || node.overviewTone !== undefined;

export function validateOverview(graph, { inputOnly = true, validateAnchor, evidenceKinds } = {}) {
  const errors = [], overview = isArchitectureOverview(graph);
  const tone = (value, path) => { if (value !== undefined && !OVERVIEW_TONES.includes(value)) errors.push(`${path} is unsupported`); };
  const anchor = (source, path) => {
    if (!object(source)) errors.push(`${path} must be an object`);
    else { validateAnchor?.(source, path, errors); if (source.kind !== undefined && !evidenceKinds?.has(source.kind)) errors.push(`${path}.kind is unsupported`); }
  };
  for (const node of graph.nodes ?? []) {
    tone(node.overviewTone, `node ${node.id}.overviewTone`);
    if (node.overviewAccent !== undefined && typeof node.overviewAccent !== 'boolean') errors.push(`node ${node.id}.overviewAccent must be boolean`);
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
    tone(section.tone, `section ${section.id}.tone`);
    if (section.frame !== undefined && !['solid', 'dashed', 'none'].includes(section.frame)) errors.push(`section ${section.id}.frame is unsupported`);
    if (section.columns !== undefined && (!Number.isInteger(section.columns) || section.columns < 1 || section.columns > 16 || section.mode !== 'grid')) errors.push(`section ${section.id}.columns requires a grid and an integer from 1 to 16`);
    if (section.weights !== undefined && (section.mode !== 'row' || !Array.isArray(section.weights) || section.weights.length !== section.items?.length || section.weights.some(weight => !Number.isFinite(weight) || weight <= 0))) errors.push(`section ${section.id}.weights requires a row and one positive finite weight per item`);
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
  const p = node.overviewTone === 'plain' ? 0 : OVERVIEW.cardPadding, inner = width - p * 2, badges = [];
  const badgeWidth = node.badges?.length ? Math.min(inner * .45, Math.max(...node.badges.map(badge => layoutText(badge.label, inner * .45 - 16, OVERVIEW.badge, OVERVIEW.badgeLine).width + 16))) : 0;
  let badgeY = p;
  for (const badge of node.badges ?? []) {
    const label = layoutText(badge.label, badgeWidth - 16, OVERVIEW.badge, OVERVIEW.badgeLine), w = Math.max(48, label.width + 16), h = label.height + 6;
    badges.push({ ...badge, x: width - p - w, y: badgeY, width: w, height: h, lines: label.lines }); badgeY += h + 6;
  }
  const title = layoutText(node.label, inner - (badgeWidth ? badgeWidth + 10 : 0), OVERVIEW.title, OVERVIEW.titleLine);
  const lines = title.lines.map((text, i) => ({ text, x: p, y: p + OVERVIEW.title + i * OVERVIEW.titleLine, role: 'title' }));
  const inlineSubtitle = node.subtitle && title.lines.length === 1 && layoutText(node.subtitle, Infinity, OVERVIEW.body, OVERVIEW.bodyLine).width + title.width + 12 <= inner - (badgeWidth ? badgeWidth + 10 : 0);
  if (inlineSubtitle) lines.push({ text: node.subtitle, x: p + title.width + 12, y: p + OVERVIEW.title, role: 'body' });
  let cursor = Math.max(p + title.height, badges.length ? badgeY - 6 : 0);
  const paragraphs = width > 1000 ? [(node.overviewText ?? []).join(' ')] : node.overviewText ?? [];
  for (const paragraph of [inlineSubtitle ? '' : node.subtitle, ...paragraphs].filter(Boolean)) {
    cursor += 6; const content = layoutText(paragraph, inner, OVERVIEW.body, OVERVIEW.bodyLine);
    lines.push(...content.lines.map((text, i) => ({ text, x: p, y: cursor + OVERVIEW.body + i * OVERVIEW.bodyLine, role: 'body' }))); cursor += content.height;
  }
  return { lines, badges, minHeight: cursor + p };
}

const sectionPadding = section => section.frame === 'none' ? 0 : OVERVIEW.padding;
const sectionContentHeight = (section, width) => {
  const inner = width - sectionPadding(section) * 2;
  return sectionPadding(section) + layoutText(section.title, inner, OVERVIEW.sectionTitle, OVERVIEW.sectionLine).height + (section.text ?? []).reduce((sum, paragraph) => sum + 8 + layoutText(paragraph, inner, OVERVIEW.body, OVERVIEW.bodyLine).height, 0);
};

// A title occupies its measured lines, not an invisible wall across the whole band.
// Routing and geometry checks share these boxes with the section's SVG typography.
export function sectionTextBoxes(section) {
  if (section.mode === 'note') return [{ ...section.position, ...section.size }];
  const p = sectionPadding(section), x = section.position.x + p, width = section.size.width - p * 2;
  const title = layoutText(section.title, width, OVERVIEW.sectionTitle, OVERVIEW.sectionLine);
  const boxes = title.lines.map((line, i) => ({ x, y: section.position.y + p + i * OVERVIEW.sectionLine,
    width: layoutText(line, Infinity, OVERVIEW.sectionTitle, OVERVIEW.sectionLine).width, height: OVERVIEW.sectionLine }));
  let cursor = section.position.y + p + title.height;
  for (const paragraph of section.text ?? []) {
    cursor += 8;
    const body = layoutText(paragraph, width, OVERVIEW.body, OVERVIEW.bodyLine);
    boxes.push(...body.lines.map((line, i) => ({ x, y: cursor + i * OVERVIEW.bodyLine,
      width: layoutText(line, Infinity, OVERVIEW.body, OVERVIEW.bodyLine).width, height: OVERVIEW.bodyLine })));
    cursor += body.height;
  }
  return boxes;
}

// The same synchronous layout runs in Node and in the offline Viewer. Sections are presentation, never ownership.
export function layoutArchitectureOverview(input, { width = OVERVIEW.width, gap = OVERVIEW.cardGap, gaps = {}, bandGaps = {} } = {}) {
  const graph = structuredClone(input), nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const groups = new Map((graph.groups ?? []).map(group => [group.id, group]));
  const nodeHeight = (node, w) => overviewCardLayout(node, w).minHeight;
  const groupSection = id => { const group = groups.get(id); return { id, title: group.label, mode: 'grid', group: true, items: [...(graph.groups ?? []).filter(child => child.parentId === id).map(child => ({ groupId: child.id })), ...graph.nodes.filter(node => node.groupId === id).map(node => ({ nodeId: node.id }))] }; };
  const idsOf = item => item.nodeId ? [item.nodeId] : (item.groupId ? groupSection(item.groupId) : item).items?.flatMap(idsOf) ?? [];
  const measure = (item, w) => {
    if (item.nodeId) return { item, width: w, height: nodeHeight(nodes.get(item.nodeId), w) };
    const section = item.groupId ? groupSection(item.groupId) : item, p = sectionPadding(section), localGap = gaps[section.id] ?? gap;
    const top = sectionContentHeight(section, w) + (section.mode === 'note' ? 0 : 24);
    if (section.mode === 'note') return { item: section, width: w, height: top + p };
    const columns = section.mode === 'row' ? section.items.length : section.mode === 'grid' ? Math.min(section.items.length, section.columns ?? Math.max(1, Math.floor((w - p * 2 + localGap) / (300 + localGap)))) : 1;
    const rows = [];
    for (let i = 0; i < section.items.length; i += columns) {
      const items = section.items.slice(i, i + columns), weights = section.mode === 'row' && section.weights || items.map(() => 1), total = weights.reduce((sum, weight) => sum + weight, 0);
      const available = w - p * 2 - localGap * (items.length - 1);
      const row = items.map((child, j) => measure(child, available * weights[j] / total)), height = Math.max(...row.map(child => child.height));
      // Inventory rows align both edges; parallel regions share a full-height support boundary.
      for (const child of row) if (section.mode === 'grid' && child.item.nodeId || section.mode === 'row') child.height = height;
      rows.push(row);
    }
    // Labeled dependencies need a small explicit connector lane. Unconnected inventory grids retain reference spacing.
    const owned = new Set(idsOf(section)), connected = graph.edges.some(edge => owned.has(edge.source) && owned.has(edge.target));
    const rowGap = connected ? Math.max(localGap, OVERVIEW.connectedGap) : localGap;
    return { item: section, width: w, height: top + rows.reduce((sum, row) => sum + Math.max(...row.map(child => child.height)), 0) + rowGap * Math.max(0, rows.length - 1) + p, top, rows, rowGap, gap: localGap, padding: p };
  };
  const place = (plan, x, y) => {
    if (plan.item.nodeId) { const node = nodes.get(plan.item.nodeId); node.position = { x, y }; node.size = { width: plan.width, height: plan.height }; return; }
    const section = plan.item; section.position = { x, y }; section.size = { width: plan.width, height: plan.height };
    if (section.group) Object.assign(groups.get(section.id), { position: section.position, size: section.size });
    let rowY = y + plan.top;
    for (const row of plan.rows ?? []) { let columnX = x + plan.padding; for (const child of row) { place(child, columnX, rowY); columnX += child.width + plan.gap; } rowY += Math.max(...row.map(child => child.height)) + plan.rowGap; }
  };
  const minimumWidth = item => {
    if (item.nodeId) return 300;
    const section = item.groupId ? groupSection(item.groupId) : item, p = sectionPadding(section), localGap = gaps[section.id] ?? gap;
    if (section.mode === 'note') return 300 + p * 2;
    const sizes = section.items.map(minimumWidth);
    if (section.mode === 'row') {
      const weights = section.weights ?? sizes.map(() => 1);
      return p * 2 + Math.max(...sizes.map((size, i) => size / weights[i])) * weights.reduce((sum, weight) => sum + weight, 0) + gap * (sizes.length - 1);
    }
    if (section.columns) return p * 2 + Math.min(section.columns, section.items.length) * 176 + gap * (Math.min(section.columns, section.items.length) - 1);
    return p * 2 + Math.max(...sizes);
  };
  width = Math.max(width, ...graph.layout.sections.map(minimumWidth));
  let y = OVERVIEW.margin;
  for (const section of graph.layout.sections) { const plan = measure(section, width); place(plan, OVERVIEW.margin, y); y += plan.height + Math.max(bandGaps[section.id] ?? gap, OVERVIEW.bandGap); }
  const bounds = group => {
    const children = [...graph.nodes.filter(node => node.groupId === group.id), ...(graph.groups ?? []).filter(child => child.parentId === group.id).map(child => { bounds(child); return child; })];
    if (!children.length) throw new Error(`Empty ownership group ${group.id}`);
    const x = Math.min(...children.map(child => child.position.x)) - OVERVIEW.padding, y = Math.min(...children.map(child => child.position.y)) - layoutText(group.label, width, 20, 26).height - OVERVIEW.padding;
    const right = Math.max(...children.map(child => child.position.x + child.size.width)) + OVERVIEW.padding, bottom = Math.max(...children.map(child => child.position.y + child.size.height)) + OVERVIEW.padding;
    group.position = { x: Math.max(0, x), y: Math.max(0, y) }; group.size = { width: right - group.position.x, height: bottom - group.position.y };
  };
  for (const group of graph.groups ?? []) if (!group.parentId && !overviewSections(graph).some(section => section.items?.some(item => item.groupId === group.id))) bounds(group);
  graph.layout.version = LAYOUT_VERSION; graph.layout.direction = 'down'; graph.layout.strategy = 'architecture-overview-v2';
  for (const edge of graph.edges) delete edge.route;
  return routeOverview(graph);
}

// Local maintenance keeps every existing slot and the legacy version. Oversized edits fail the same
// quality gate as drags, so the Viewer can retain the last valid canvas and the user's text draft.
export function maintainArchitectureOverview(input, reference, accept) {
  const graph = structuredClone(input);
  for (const node of graph.nodes) {
    const old = reference.nodes.find(item => item.id === node.id);
    if (JSON.stringify(node) !== JSON.stringify(old)) node.size.height = Math.max(node.size.height, overviewCardLayout(node).minHeight);
  }
  const installSlots = (oldIds, newIds) => {
    if (oldIds.join('\0') === newIds.join('\0')) return;
    const slots = oldIds.map(id => reference.nodes.find(node => node.id === id));
    newIds.forEach((id,i) => { const node = graph.nodes.find(node => node.id === id); node.position = { ...slots[i].position }; });
  };
  for (const section of overviewSections(graph)) {
    const old = overviewSections(reference).find(item => item.id === section.id);
    if (old) installSlots((old.items ?? []).filter(item => item.nodeId).map(item => item.nodeId), (section.items ?? []).filter(item => item.nodeId).map(item => item.nodeId));
  }
  for (const group of graph.groups ?? []) installSlots(reference.nodes.filter(n=>n.groupId===group.id).map(n=>n.id),graph.nodes.filter(n=>n.groupId===group.id).map(n=>n.id));
  const edgeIds = affectedRouteIds(reference, graph);
  const routed = routeOrthogonal(presentationGraph(graph), { edgeIds, passes: 2, accept });
  graph.edges = mergePresentationEdges(graph, routed.graph);
  accept(graph, { strictEdgeIds: edgeIds });
  return graph;
}

export const overviewLayoutReports = new WeakMap();
export function fitArchitectureOverview(input, accept) {
  const gaps = {}, bandGaps = {}, attempts = [];
  let last;
  for (let evaluation = 0; evaluation < 60; evaluation++) {
    try {
      const graph = layoutArchitectureOverview(input, { gaps, bandGaps });
      accept(graph);
      overviewLayoutReports.set(graph, { evaluations: evaluation + 1, budget: 60, gaps: { ...gaps }, bandGaps: { ...bandGaps }, attempts, termination: 'valid-local-spacing', provenImpossible: false });
      return graph;
    } catch (error) {
      last = error;
      const ids = new Set([...(error.elementIds ?? []), ...(error.diagnostics ?? []).flatMap(d => d.elementIds)]);
      for (const edge of input.edges) if (ids.has(edge.id)) { ids.add(edge.source); ids.add(edge.target); }
      const all = overviewSections(input);
      const descendants = section => (section.items ?? []).flatMap(item => item.nodeId ? [item.nodeId] : item.groupId ? input.nodes.filter(n => n.groupId === item.groupId).map(n => n.id) : descendants(item));
      const affected = all.filter(section => descendants(section).some(id => ids.has(id)));
      const leaves = affected.filter(section => !affected.some(child => child !== section && (section.items ?? []).includes(child)));
      if (!leaves.length) throw error;
      let changed = false;
      for (const section of leaves) {
        const before = gaps[section.id] ?? OVERVIEW.cardGap;
        if (before >= 200) continue;
        gaps[section.id] = before + 16; changed = true;
      }
      // Only the corridor following a source band grows; unrelated card grids keep their gap.
      for (const section of input.layout.sections) if (descendants(section).some(id => ids.has(id))) {
        const before = bandGaps[section.id] ?? OVERVIEW.bandGap;
        if (before < 200) { bandGaps[section.id] = before + 16; changed = true; }
      }
      attempts.push({ elementIds: [...ids], reason: error.routingReason ?? 'quality', gaps: { ...gaps }, bandGaps: { ...bandGaps } });
      if (!changed) break;
    }
  }
  throw Object.assign(last, { routingReport: { attempts, termination: 'local-spacing-budget', provenImpossible: false } });
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
const svgText = (x, y, value, role, style = '') => `<text x="${x}" y="${y}" class="${role}"${style ? ` style="${style}"` : ''}>${escape(value)}</text>`;
export function overviewCardSvg(node, x, y, palette) {
  const colors = overviewPalette(palette), tone = colors[node.overviewTone ?? 'subtle'] ?? colors.subtle, layout = overviewCardLayout(node);
  const plain = node.overviewTone === 'plain';
  const gradientId = `overview-card-${[...node.id].map(c => c.codePointAt(0).toString(16)).join('-')}`;
  const gradient = !plain && tone.band && node.size.width > 1000 ? `<defs><linearGradient id="${gradientId}"><stop stop-color="${tone.band[0]}"/><stop offset="1" stop-color="${tone.band[1]}"/></linearGradient></defs>` : '';
  const frame = `<rect class="node-surface" x="${x}" y="${y}" width="${node.size.width}" height="${node.size.height}" rx="${OVERVIEW.cardRadius}" fill="${plain ? 'none' : gradient ? `url(#${gradientId})` : tone.fill}" stroke="${plain ? 'none' : tone.stroke}" stroke-width="1.5"/>`;
  const accent = node.overviewAccent && tone.accent ? `<path d="M${x + 5} ${y + 10}V${y + node.size.height - 10}" stroke="${tone.accent}" stroke-width="5" stroke-linecap="round"/>` : '';
  const text = layout.lines.map(line => svgText(x + line.x, y + line.y, line.text, line.role, `fill:${line.role === 'title' ? colors.ink : colors.body};font-size:${line.role === 'title' ? OVERVIEW.title : OVERVIEW.body}px;font-weight:${line.role === 'title' ? 700 : 400}`)).join('');
  return gradient + frame + accent + text + layout.badges.map(badge => {
    const done = /^(已实现|已完成|完成|implemented|ready|done|complete)$/i.test(badge.label), badgeTone = badge.role === 'version' ? { fill: tone.accent ?? colors.blue.accent, ink: colors.paper } : badge.role === 'status' && done || badge.role === 'requirement' && /^(必选|required|mandatory)$/i.test(badge.label) ? colors.success : colors.badge;
    return `<g data-badge-role="${badge.role}"><rect x="${x + badge.x}" y="${y + badge.y}" width="${badge.width}" height="${badge.height}" rx="8" fill="${badgeTone.fill}"/>${badge.lines.map((line, i) => svgText(x + badge.x + 8, y + badge.y + 3 + OVERVIEW.badge + i * OVERVIEW.badgeLine, line, 'meta', `fill:${badgeTone.ink};font-size:${OVERVIEW.badge}px;font-weight:600`)).join('')}</g>`;
  }).join('');
}
export function sectionSvg(section, palette, offsetX = 0, offsetY = 0) {
  const colors = overviewPalette(palette), tone = colors[section.tone ?? 'white'] ?? colors.white;
  const x = section.position.x + offsetX, y = section.position.y + offsetY, w = section.size.width, p = sectionPadding(section);
  const heading = layoutText(section.title, w - p * 2, OVERVIEW.sectionTitle, OVERVIEW.sectionLine); let cursor = y + p + heading.height;
  let body = '';
  for (const paragraph of section.text ?? []) { cursor += 8; const lines = layoutText(paragraph, w - p * 2, OVERVIEW.body, OVERVIEW.bodyLine); body += lines.lines.map((line, i) => svgText(x + p, cursor + OVERVIEW.body + i * OVERVIEW.bodyLine, line, 'body', `fill:${colors.body};font-size:${OVERVIEW.body}px`)).join(''); cursor += lines.height; }
  const gradientId = `overview-band-${[...section.id].map(c => c.codePointAt(0).toString(16)).join('-')}`;
  const gradient = tone.band && section.frame !== 'none' ? `<defs><linearGradient id="${gradientId}"><stop stop-color="${tone.band[0]}"/><stop offset="1" stop-color="${tone.band[1]}"/></linearGradient></defs>` : '';
  const frame = section.frame === 'none' ? '' : `<rect x="${x}" y="${y}" width="${w}" height="${section.size.height}" rx="${OVERVIEW.sectionRadius}" fill="${gradient ? `url(#${gradientId})` : tone.fill}" stroke="${tone.stroke}" stroke-width="1.5"${section.frame === 'dashed' ? ' stroke-dasharray="5 4"' : ''}/>`;
  return `<g data-overview-section-id="${escape(section.id)}">${gradient}${frame}${heading.lines.map((line, i) => svgText(x + p, y + p + OVERVIEW.sectionTitle + i * OVERVIEW.sectionLine, line, 'title', `fill:${colors.ink};font-size:${OVERVIEW.sectionTitle}px;font-weight:700`)).join('')}${body}</g>`;
}

export function overviewGeometryErrors(graph, routes = new Map()) {
  if (!isArchitectureOverview(graph)) return [];
  const errors = [], sections = overviewSections(graph);
  for (const section of sections) {
    const required = sectionContentHeight(section, section.size.width) + sectionPadding(section);
    if (section.size.height < required) errors.push(`section ${section.id} text is clipped`);
    for (const item of Array.isArray(section.items) ? section.items : []) {
      const child = item.nodeId ? graph.nodes.find(node => node.id === item.nodeId) : item.groupId ? graph.groups.find(group => group.id === item.groupId) : item;
      if (child && (child.position.x < section.position.x + sectionPadding(section) || child.position.y < section.position.y + sectionContentHeight(section, section.size.width) + 24 || child.position.x + child.size.width > section.position.x + section.size.width - sectionPadding(section) + .01 || child.position.y + child.size.height > section.position.y + section.size.height - sectionPadding(section) + .01)) errors.push(`section ${section.id} does not contain ${child.id}`);
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
    for (const obstacle of sectionTextBoxes(section)) for (const [id, route] of routes) {
      if (route.points.slice(1).some((point, i) => crosses(route.points[i], point, obstacle))) errors.push(`overview route ${id} crosses section ${section.id} text`);
      if (route.label && overlaps(route.labelBox, obstacle)) errors.push(`overview label ${id} overlaps section ${section.id} text`);
    }
  }
  return errors;
}

// Kept as a compatible entry point for older callers. All types use the shared router.
export function routeOverview(graph) {
  const result = routeOrthogonal(presentationGraph(graph), { passes: 3 });
  graph.edges = mergePresentationEdges(graph, result.graph);
  return graph;
}
