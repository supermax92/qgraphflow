import { RADIX } from './radix-colors.js';

export const PALETTES = Object.fromEntries(Object.entries(RADIX).map(([theme, { sand: n, teal: t, blue: b, amber: a }]) => [theme, {
  paper: n[1], surface: theme === 'light' ? '#ffffff' : n[1], surface2: n[2],
  ink: n[12], ink2: n[11], ink3: n[11], rule: n[6], ruleSoft: n[4],
  accent: t[11], accentSoft: t[2], accentBorder: t[7], hero: t[3], heroBorder: t[8], heroInk: t[12],
  data: b[11], dataSoft: b[3], dataBorder: b[8], warn: a[11], warnSoft: a[3], warnBorder: a[8],
  edge: n[9], flow: t[11],
  mask: theme === 'dark' ? 'rgba(17,17,16,.75)' : 'rgba(253,253,252,.75)',
  group: n[2], button: n[2]
}]));

export const warningKinds = new Set(['decision', 'choice', 'failure']);
export const dataKinds = new Set(['data', 'database', 'dataStore', 'entity']);
export const TYPOGRAPHY = { title: 20, body: 16, small: 14, edgeLineHeight: 24, sequenceHeader: 72, sequenceActorHeader: 108, erHeader: 72, erRow: 32, classHeader: 68, classRow: 28 };
export const isCore = node => node.kind === 'business' || (node.tags ?? []).some(tag => ['core', 'business'].includes(String(tag).trim().toLowerCase()));

export function nodeAppearance(node, palette) {
  if (['initial', 'final'].includes(node.kind)) return { role: node.kind, label: node.kind === 'initial' ? '初始状态' : '结束状态', fill: node.kind === 'initial' ? palette.accent : palette.surface, stroke: palette.accent };
  if (isCore(node)) return { role: 'core', label: '核心组件', fill: palette.hero, stroke: palette.heroBorder };
  if (warningKinds.has(node.kind)) return { role: 'warning', label: '判断与异常', fill: palette.warnSoft, stroke: palette.warnBorder };
  if (dataKinds.has(node.kind) || ['input', 'output'].includes(node.kind)) return { role: 'data', label: '数据与存储', fill: palette.dataSoft, stroke: palette.dataBorder };
  if (['start', 'end', 'usecase'].includes(node.kind)) return { role: 'accent', label: node.kind === 'usecase' ? '用例' : '起止节点', fill: palette.accentSoft, stroke: palette.accentBorder };
  return { role: 'neutral', label: '普通组件 / 角色', fill: palette.surface2, stroke: node.kind === 'actor' ? palette.ink2 : palette.rule };
}

export function edgeColor(edge, target, palette) {
  if (edge.kind === 'failure') return palette.warn;
  if (edge.kind === 'success') return palette.accent;
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
  return { compact: ['architecture', 'deployment'].includes(type) && node.size.height < 100, erHeaderHeight, erRowHeight, erFontSize: Math.max(TYPOGRAPHY.small, Math.min(TYPOGRAPHY.body, erRowHeight - 6)), classHeaderHeight: TYPOGRAPHY.classHeader, classRowHeight: TYPOGRAPHY.classRow };
}
