import { MODULE_ACCENTS, RADIX } from './radix-colors.js';

// Approved demo hues: 44, 8, 94, 208, 330, 66, 150, 120, 24 degrees.
// Fill = HSL(hue, 42%, 76%) at 20% over light canvas (dark: 24%, 76% at 24%).
// Precomposed opaque fills preserve the gauze appearance without nested tint accumulation.
// Accent = the same hue at 78% saturation, 30% lightness (dark: 68%).
const GROUP_TONES = {
  light: [['#f6f3ec', '#886811'], ['#f6edec', '#882111'], ['#f0f6ec', '#458811'], ['#ebf1f6', '#115088'], ['#f6ebf1', '#88114d'], ['#f4f6ec', '#7c8811'], ['#ebf6f1', '#11884d'], ['#ebf6ec', '#118811'], ['#f6efec', '#884111']],
  dark: [['#3f3d39', '#edcb6e'], ['#3f3939', '#ed7f6e'], ['#3b3f39', '#a5ed6e'], ['#383c40', '#6eb2ed'], ['#3f383d', '#ed6ead'], ['#3e3f39', '#e0ed6e'], ['#383f3d', '#6eedad'], ['#383f39', '#6eed6e'], ['#3f3b39', '#eda16e']]
};

// Light Orange 11 is darkened slightly so small failure text also clears 4.5:1 on Slate 2.
export const PALETTES = Object.fromEntries(Object.entries(RADIX).map(([theme, { neutral: n, accent: t, data: b, warn: a }]) => [theme, {
  paper: n[1], surface: n[1], surface2: n[2],
  ink: n[12], ink2: n[11], ink3: n[11], rule: n[6], ruleSoft: n[4],
  accent: t[11], accentSoft: t[2], accentBorder: t[7], hero: t[3], heroBorder: t[8], heroInk: t[12],
  data: b[11], dataSoft: b[3], dataBorder: b[8], warn: theme === 'light' ? '#c44b00' : a[11], warnSoft: a[3], warnBorder: a[8],
  groupTones: GROUP_TONES[theme].map(([fill, accent]) => ({ fill, accent })),
  moduleAccents: MODULE_ACCENTS[theme], nodeTint: theme === 'dark' ? .18 : .12,
  edge: n[11],
  mask: theme === 'dark' ? 'rgba(17,17,19,.75)' : 'rgba(252,252,253,.75)',
  group: n[2], button: n[2]
}]));

export const warningKinds = new Set(['failure']);
export const dataKinds = new Set(['data', 'database', 'dataStore', 'entity']);
export const TYPOGRAPHY = { title: 20, body: 16, small: 14, edgeLineHeight: 24, sequenceHeader: 72, sequenceActorHeader: 108, erHeader: 72, erRow: 32, classHeader: 68, classRow: 28 };
export const isCore = node => node.kind === 'business' || (node.tags ?? []).some(tag => ['core', 'business'].includes(String(tag).trim().toLowerCase()));

function tint(color, background, amount) {
  const channel = index => Math.round(parseInt(color.slice(index, index + 2), 16) * amount + parseInt(background.slice(index, index + 2), 16) * (1 - amount)).toString(16).padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

function colorSlot(value, count) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  return (hash >>> 0) % count;
}

export function moduleColorMap(diagrams, palette) {
  const modules = [...new Set(diagrams.flatMap(graph => [
    ...graph.nodes.map(node => node.module), ...graph.edges.map(edge => edge.module)
  ]).filter(Boolean))].sort();
  // ponytail: bounded categorical slots can collide; module labels remain authoritative.
  return new Map(modules.map(module => [module, palette.moduleAccents[colorSlot(module, palette.moduleAccents.length)]]));
}

export function groupAppearanceMap(groups, palette) {
  const appearances = new Map(), tones = palette.groupTones;
  let next = 0;
  const visit = parentId => {
    let previous;
    const siblings = groups.filter(group => (group.parentId ?? null) === parentId)
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x || a.id.localeCompare(b.id));
    for (const group of siblings) {
      // ponytail: nine local region tones repeat in larger graphs; labels carry meaning.
      while (tones[next % tones.length] === previous || tones[next % tones.length] === appearances.get(parentId)) next++;
      const appearance = tones[next++ % tones.length];
      appearances.set(group.id, appearance);
      previous = appearance;
      visit(group.id);
    }
  };
  visit(null);
  return appearances;
}

export function nodeAppearance(node, palette, moduleColors) {
  const moduleColor = moduleColors?.get(node.module);
  let appearance;
  if (['initial', 'final'].includes(node.kind)) appearance = { role: node.kind, label: node.kind === 'initial' ? '初始状态' : '结束状态', fill: node.kind === 'initial' ? palette.accent : palette.surface, stroke: palette.accent };
  else if (warningKinds.has(node.kind)) appearance = { role: 'warning', label: '失败', fill: palette.surface2, stroke: palette.warn };
  else if (isCore(node)) appearance = { role: 'core', label: '核心组件', fill: palette.surface2, stroke: palette.accent };
  else if (dataKinds.has(node.kind) || ['input', 'output'].includes(node.kind)) appearance = { role: 'data', label: '数据与存储', fill: palette.surface2, stroke: palette.data };
  else if (['start', 'end', 'usecase'].includes(node.kind)) appearance = { role: 'accent', label: node.kind === 'usecase' ? '用例' : '起止节点', fill: palette.surface2, stroke: palette.accent };
  else appearance = { role: 'neutral', label: '普通组件 / 角色', fill: palette.surface2, stroke: palette.edge };
  const stroke = warningKinds.has(node.kind) ? palette.warn : moduleColor ?? appearance.stroke;
  const fill = !['initial', 'final'].includes(node.kind) && (moduleColor || appearance.role !== 'neutral')
    ? tint(stroke, palette.surface, palette.nodeTint) : appearance.fill;
  return { ...appearance, fill, stroke, moduleColor };
}

export const sequenceGroupColor = (pair, palette) => pair ? palette.moduleAccents[[0, 2, 7, 3, 1, 6, 5, 4][pair.index % 8]] : undefined;

export function edgeColor(edge, target, palette, moduleColors, source, pair) {
  if (pair) return sequenceGroupColor(pair, palette);
  if (edge.kind === 'failure') return palette.warn;
  if (edge.kind === 'success') return palette.accent;
  const moduleColor = moduleColors?.get(edge.module ?? source?.module ?? target?.module);
  if (moduleColor) return moduleColor;
  return dataKinds.has(target?.kind) ? palette.data : palette.edge;
}

export function themeVariables(palette) {
  const tokens = { bg: 'paper', panel: 'surface2', canvas: 'surface', ink: 'ink', muted: 'ink2', line: 'rule', accent: 'accent', 'accent-soft': 'accentSoft', hero: 'hero', 'hero-border': 'heroBorder', 'hero-ink': 'heroInk', good: 'data', warm: 'warn', 'warm-soft': 'warnSoft', edge: 'edge', button: 'button', 'button-line': 'rule', group: 'group' };
  const sizes = { 'font-title': 'title', 'font-body': 'body', 'font-small': 'small', 'edge-line-height': 'edgeLineHeight' };
  return Object.fromEntries([...Object.entries(tokens).map(([name, key]) => [`--${name}`, palette[key]]), ...Object.entries(sizes).map(([name, key]) => [`--${name}`, `${TYPOGRAPHY[key]}px`])]);
}

export const kindLabels = {
  external: '外部', config: '配置', framework: '框架', security: '安全', service: '服务', business: '业务',
  data: '数据', failure: '失败', system: '系统', component: '组件', database: '数据库', start: '开始', end: '结束',
  process: '处理', decision: '判断', input: '输入', output: '输出', subprocess: '子流程', actor: '角色',
  participant: '参与者', entity: '实体', device: '设备', node: '节点', container: '容器', artifact: '制品',
  class: '类', interface: '接口', abstract: '抽象类', state: '状态', initial: '初始', final: '结束', choice: '选择',
  usecase: '用例', dataStore: '数据存储'
};

export function nodeMetrics(node, type) {
  const erHeaderHeight = Math.min(TYPOGRAPHY.erHeader, node.size.height * .4);
  const erRowHeight = Math.min(TYPOGRAPHY.erRow, (node.size.height - erHeaderHeight) / Math.max(1, node.fields?.length ?? 0));
  return { compact: ['architecture', 'deployment'].includes(type) && node.size.height < 100, erHeaderHeight, erRowHeight, erFontSize: Math.max(TYPOGRAPHY.small, Math.min(TYPOGRAPHY.body, erRowHeight - 6)), classHeaderHeight: TYPOGRAPHY.classHeader + (node.subtitle ? 24 : 0), classRowHeight: TYPOGRAPHY.classRow };
}
