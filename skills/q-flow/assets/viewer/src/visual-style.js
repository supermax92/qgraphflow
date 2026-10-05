import { IDENTITY, IDENTITY_SCALES, RADIX } from './radix-colors.js';

// Mix a color over a background: identity washes and headers stay tied to their chip color.
export function mix(color, background, amount) {
  const channel = index => Math.round(parseInt(color.slice(index, index + 2), 16) * amount + parseInt(background.slice(index, index + 2), 16) * (1 - amount)).toString(16).padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

// In-flight states of a state diagram walk this ramp, warm to cool, in the order the machine reaches them.
const FLIGHT_SCALES = ['orange', 'blue', 'teal', 'violet', 'plum', 'indigo'];

// Structure stays cool and neutral (Slate); identity is a saturated chip, a matching frame and a faint wash;
// roles speak through a soft ring (core, failure) and the icon glyph, never through the text.
export const PALETTES = Object.fromEntries(Object.entries(RADIX).map(([theme, { neutral: n, accent: t, data: b, warn: a, guard: g }]) => [theme, {
  paper: n[1], surface: n[1], surface2: n[2],
  ink: n[12], ink2: n[11], ink3: n[11], rule: n[6], ruleSoft: n[4],
  accent: t[11], accentSoft: t[2], ringCore: t[5],
  data: b[11], warn: a[11], ringWarn: a[5], guard: g[11],
  badge: n[3], outline: theme === 'dark' ? n[10] : n[9],
  // Dark cards lift one step above the canvas so a plain card still reads as a surface.
  card: theme === 'dark' ? n[3] : n[1],
  groupFill: n[2], groupFillNested: theme === 'dark' ? mix(n[2], n[3], .5) : n[1], groupLine: n[5],
  moduleTones: IDENTITY_SCALES.map(name => { const scale = IDENTITY[theme][name]; return { name, chip: scale[9], accent: scale[10], wash: mix(scale[9], theme === 'dark' ? n[3] : n[1], theme === 'dark' ? .09 : .05), header: mix(scale[9], n[2], theme === 'dark' ? .16 : .1) }; }),
  // Lifecycle tones of a state card: the goal is green, an ended state Slate, a failed one Red, and in-flight states take
  // the ramp above. The body is step 3; the frame is step 11 on light cards and step 10 on dark ones, the first steps
  // that hold 3:1 against that body in each theme.
  stateTones: (() => {
    const step = theme === 'dark' ? 10 : 11, scales = IDENTITY[theme], identity = name => ({ name, fill: scales[name][3], stroke: scales[name][step] });
    return { goal: identity('grass'), ended: { name: 'slate', fill: n[3], stroke: n[step] }, failed: { name: 'red', fill: a[3], stroke: a[step] }, flight: FLIGHT_SCALES.map(identity) };
  })(),
  edge: theme === 'dark' ? n[10] : n[9],
  mask: theme === 'dark' ? 'rgba(17,17,19,.75)' : 'rgba(252,252,253,.75)',
  group: n[2]
}]));

export const warningKinds = new Set(['failure']);
export const dataKinds = new Set(['data', 'database', 'dataStore', 'entity']);
export const TYPOGRAPHY = { title: 20, body: 16, small: 14, edgeLineHeight: 24, sequenceHeader: 72, sequenceActorHeader: 108, erHeader: 72, erRow: 32, classHeader: 68, classRow: 28 };
export const isCore = node => node.kind === 'business' || (node.tags ?? []).some(tag => ['core', 'business'].includes(String(tag).trim().toLowerCase()));

// FNV-1a over the module name, bounded to the identity palette.
function colorSlot(value, count) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  return (hash >>> 0) % count;
}

const hasTag = (node, name) => (node.tags ?? []).some(tag => String(tag).trim().toLowerCase() === name);

// A state diagram describes one component, so its module says nothing there: its states are colored by lifecycle role
// instead. The core state is the goal, a `failure`-tagged state is failed, a state with nowhere left to go (every way
// out ends the machine, or there is none) is ended, and the states in between are in flight and take the warm-to-cool
// ramp in the order the machine reaches them (distance from the initial state, then declaration order). Roles are
// derived from facts the graph already has; there is no color field. Without a core state the module colors stay.
export function stateToneRoles(graph) {
  const states = graph.nodes.filter(node => node.kind === 'state');
  if (graph.meta?.diagramType !== 'state' || !states.some(isCore)) return new Map();
  const next = new Map(graph.nodes.map(node => [node.id, []]));
  for (const edge of graph.edges) if (edge.kind === 'transition' && edge.source !== edge.target) next.get(edge.source)?.push(edge.target);
  const ending = new Set(graph.nodes.filter(node => node.kind === 'final').map(node => node.id));
  const distance = new Map(graph.nodes.filter(node => node.kind === 'initial').map(node => [node.id, 0]));
  for (const id of distance.keys()) for (const target of next.get(id) ?? []) if (!distance.has(target)) distance.set(target, distance.get(id) + 1);
  const role = node => hasTag(node, 'failure') ? 'failed' : isCore(node) ? 'goal' : next.get(node.id).every(id => ending.has(id)) ? 'ended' : 'flight';
  const reach = node => distance.get(node.id) ?? Infinity;
  const flight = states.filter(node => role(node) === 'flight').sort((a, b) => Math.sign(reach(a) - reach(b)) || 0);
  return new Map(states.map(node => [node.id, role(node) === 'flight' ? { role: 'flight', index: flight.indexOf(node) } : { role: role(node) }]));
}

// The map also carries `stateTones` (state node id -> role): a collection has one state view, so the id is enough for
// every nodeAppearance caller, none of which knows its graph.
export function moduleColorMap(diagrams, palette) {
  const modules = [...new Set(diagrams.flatMap(graph => [
    ...graph.nodes.map(node => node.module), ...graph.edges.map(edge => edge.module)
  ]).filter(Boolean))].sort();
  // ponytail: bounded categorical slots can collide; module labels remain authoritative.
  const colors = new Map(modules.map(module => [module, palette.moduleTones[colorSlot(module, palette.moduleTones.length)]]));
  colors.stateTones = new Map(diagrams.flatMap(graph => [...stateToneRoles(graph)]));
  return colors;
}

// A copy keeps what the map carries besides the module tones; a download snapshots the colors this way.
export function copyColors(colors) {
  const copy = new Map(colors);
  copy.stateTones = colors.stateTones;
  copy.plainStates = colors.plainStates;
  return copy;
}

// The card-wash switch: module washes and state tones fall back to the plain card, frames and chips stay.
export function withoutWash(colors, palette) {
  for (const [name, tone] of colors) colors.set(name, { ...tone, wash: palette.card, header: palette.surface2 });
  colors.plainStates = true;
  return colors;
}

// Boundaries are containers, not information: a hairline fence on a barely-there surface, nested one step apart.
export function groupAppearanceMap(groups, palette) {
  const appearances = new Map();
  const depth = group => { let level = 0, parent = groups.find(item => item.id === group.parentId); while (parent && level < groups.length) { level++; parent = groups.find(item => item.id === parent.parentId); } return level; };
  for (const group of groups) appearances.set(group.id, { fill: depth(group) % 2 ? palette.groupFillNested : palette.groupFill, stroke: palette.groupLine });
  return appearances;
}

const STATE_TONE_LABELS = { goal: 'Core state', ended: 'Ended state', failed: 'Failed state', flight: 'In-progress state' };

// The frame, chip and wash say whose a node is (module); a ring says it is the business center or an explicit failure.
// Text never follows either: titles stay ink. A failure keeps its red frame over any module. A state in a state
// diagram wears its lifecycle tone instead of the module's frame and wash; the ring and the module's lines stay.
export function nodeAppearance(node, palette, moduleColors) {
  const tone = moduleColors?.get(node.module);
  const stateRole = node.kind === 'state' ? moduleColors?.stateTones?.get(node.id) : undefined;
  if (stateRole) {
    const lifecycle = stateRole.role === 'flight' ? palette.stateTones.flight[stateRole.index % palette.stateTones.flight.length] : palette.stateTones[stateRole.role];
    return { role: stateRole.role, label: STATE_TONE_LABELS[stateRole.role], fill: moduleColors.plainStates ? palette.card : lifecycle.fill, stroke: lifecycle.stroke, ring: isCore(node) ? palette.ringCore : undefined, toneIndex: stateRole.index, moduleColor: tone?.accent, chip: tone?.chip, header: tone?.header };
  }
  let appearance;
  if (['initial', 'final'].includes(node.kind)) appearance = { role: node.kind, label: node.kind === 'initial' ? 'Initial state' : 'Final state', fill: node.kind === 'initial' ? palette.ink : palette.surface, stroke: palette.ink };
  else if (warningKinds.has(node.kind)) appearance = { role: 'warning', label: 'Failure', fill: palette.card, stroke: palette.warn, ring: palette.ringWarn };
  else if (isCore(node)) appearance = { role: 'core', label: 'Core component', fill: palette.card, stroke: palette.accent, ring: palette.ringCore };
  else if (dataKinds.has(node.kind) || ['input', 'output'].includes(node.kind)) appearance = { role: 'data', label: 'Data / storage', fill: palette.card, stroke: palette.data };
  else if (['start', 'end', 'usecase'].includes(node.kind)) appearance = { role: 'accent', label: node.kind === 'usecase' ? 'Use case' : 'Start / end', fill: palette.card, stroke: palette.accent };
  else appearance = { role: 'neutral', label: 'Components / actors', fill: palette.card, stroke: palette.outline };
  const framed = tone && !['initial', 'final', 'failure'].includes(node.kind);
  return { ...appearance, fill: framed ? tone.wash : appearance.fill, stroke: framed ? tone.accent : appearance.stroke, moduleColor: tone?.accent, chip: tone?.chip, header: tone?.header };
}

// Pairs walk the identity scales in order; the order itself keeps neighbouring pair numbers far apart in hue.
export const sequenceGroupColor = (pair, palette) => pair ? palette.moduleTones[pair.index % palette.moduleTones.length].accent : undefined;

export function edgeColor(edge, target, palette, moduleColors, source, pair) {
  if (pair) return sequenceGroupColor(pair, palette);
  if (edge.kind === 'failure') return palette.warn;
  if (edge.kind === 'success') return palette.accent;
  const tone = moduleColors?.get(edge.module ?? source?.module ?? target?.module);
  if (tone) return tone.accent;
  return dataKinds.has(target?.kind) ? palette.data : palette.edge;
}

export function themeVariables(palette) {
  const tokens = { bg: 'paper', panel: 'surface2', canvas: 'surface', ink: 'ink', muted: 'ink2', line: 'rule', accent: 'accent', 'accent-soft': 'accentSoft', warm: 'warn', guard: 'guard' };
  const sizes = { 'font-body': 'body', 'font-small': 'small', 'edge-line-height': 'edgeLineHeight' };
  return Object.fromEntries([...Object.entries(tokens).map(([name, key]) => [`--${name}`, palette[key]]), ...Object.entries(sizes).map(([name, key]) => [`--${name}`, `${TYPOGRAPHY[key]}px`])]);
}

export const evidenceLabels = { source: 'Source code', code: 'Code', config: 'Configuration', schema: 'Schema', test: 'Test', document: 'Document', framework: 'Framework convention', inference: 'Inference' };
// "file:start-end" for a node source or an edge site.
export const anchorText = anchor => `${anchor.file}:${anchor.lineStart}${anchor.lineEnd ? `-${anchor.lineEnd}` : ''}`;

export const kindLabels = {
  external: 'External', config: 'Configuration', framework: 'Framework', security: 'Security', service: 'Service', business: 'Business',
  data: 'Data', failure: 'Failure', system: 'System', component: 'Component', database: 'Database', start: 'Start', end: 'End',
  process: 'Process', decision: 'Decision', input: 'Input', output: 'Output', subprocess: 'Subprocess', actor: 'Actor',
  participant: 'Participant', entity: 'Entity', device: 'Device', node: 'Nodes', container: 'Container', artifact: 'Artifact',
  class: 'Class', interface: 'Interface', abstract: 'Abstract class', state: 'State', initial: 'Initial', final: 'End', choice: 'Choice',
  usecase: 'Use case', dataStore: 'Data store'
};

export function nodeMetrics(node) {
  const erHeaderHeight = Math.min(TYPOGRAPHY.erHeader, node.size.height * .4);
  const erRowHeight = Math.min(TYPOGRAPHY.erRow, (node.size.height - erHeaderHeight) / Math.max(1, node.fields?.length ?? 0));
  return { erHeaderHeight, erRowHeight, erFontSize: Math.max(TYPOGRAPHY.small, Math.min(TYPOGRAPHY.body, erRowHeight - 6)), classHeaderHeight: TYPOGRAPHY.classHeader + (node.subtitle ? 24 : 0), classRowHeight: TYPOGRAPHY.classRow };
}
