import { centeredTitle, rectangle, diamond, paint, ellipseAnchor, polygonAnchor, rectAnchor, text, layoutText, TYPOGRAPHY } from './drawing.js';

export const stateSymbolX = node => node.subtitle ? 14 : node.size.width / 2;

// UML state actions: a state may list what it does on entry, while it is active (do) and on exit, below a divider.
export const STATE_ACTIONS = ['entry', 'do', 'exit'];
const ACTION = { side: 16, pad: 8, line: 20, keyWidth: 64 };
export function stateActivities(node) {
  const rows = node.kind === 'state' ? STATE_ACTIONS.filter(key => typeof node[key] === 'string' && node[key].trim())
    .map(key => ({ key, lines: layoutText(node[key], node.size.width - 2 * ACTION.side - ACTION.keyWidth, TYPOGRAPHY.small, ACTION.line).lines })) : [];
  return { rows, height: rows.length ? rows.reduce((sum, row) => sum + row.lines.length, 0) * ACTION.line + 2 * ACTION.pad : 0 };
}
export const STATE_ACTION_INSET = 2 * ACTION.side + ACTION.keyWidth;
// The action list sits in the bottom compartment; the title keeps the compartment above it.
export const activityArea = node => {
  const { height } = stateActivities(node);
  return height ? { x: ACTION.side, y: node.size.height - height, width: node.size.width - 2 * ACTION.side, height } : null;
};

const outline = (node, x, y) => {
  if (['initial', 'final'].includes(node.kind)) return [['circle', { cx: x + stateSymbolX(node), cy: y + node.size.height / 2, r: node.kind === 'initial' ? 12 : 13 }]];
  return node.kind === 'choice' ? diamond(node, x, y) : rectangle(node, x, y, 12);
};
const anchor = (node, side, offset) => {
  if (['initial', 'final'].includes(node.kind)) {
    const radius = node.kind === 'initial' ? 12 : 13;
    const shift = stateSymbolX(node) - node.size.width / 2;
    const circle = { ...node, position: { ...node.position, x: node.position.x + shift } };
    return ellipseAnchor(circle, side, offset - (['top', 'bottom'].includes(side) ? shift : 0), node.size.width / 2 - radius, node.size.height / 2 - radius);
  }
  return node.kind === 'choice' ? polygonAnchor(node, side, offset, [[.5, 0], [1, .5], [.5, 1], [0, .5]]) : rectAnchor(node, side, offset);
};
const textArea = node => {
  if (['initial', 'final'].includes(node.kind) && node.subtitle) return { x: 42, y: 8, width: node.size.width - 50, height: node.size.height - 16 };
  const actions = stateActivities(node).height;
  const area = { width: node.kind === 'choice' ? node.size.width / 2 - 8 : node.size.width - 24, height: node.kind === 'choice' ? node.size.height / 2 - 8 : node.size.height - 16 - actions };
  return actions ? { x: 12, y: 8, ...area } : area;
};

function activityMarkup(node, x, y, stroke, palette) {
  const { rows, height } = stateActivities(node);
  if (!rows.length) return '';
  const top = y + node.size.height - height;
  let index = 0;
  return `<path d="M${x} ${top}H${x + node.size.width}" fill="none" stroke="${stroke}" stroke-opacity=".35"/>${rows.map(row => row.lines.map((line, i) => {
    const baseline = top + ACTION.pad + index++ * ACTION.line + 15;
    return (i ? '' : text(x + ACTION.side, baseline, `${row.key} /`, 'field-key'))
      + text(x + ACTION.side + ACTION.keyWidth, baseline, line, 'entity-meta', ` style="fill:${palette.ink}"`);
  }).join('')).join('')}`;
}

function stateNode(node, x, y, fill, stroke, palette) {
  const cx = x + node.size.width / 2, cy = y + node.size.height / 2;
  if (['initial', 'final'].includes(node.kind)) {
    const area = textArea(node), final = node.kind === 'final';
    return `<g class="state-dot">${paint(outline(node, x, y), { fill: final ? palette.surface : stroke, stroke, 'stroke-width': 1 })}${final ? `<circle cx="${x + stateSymbolX(node)}" cy="${cy}" r="8" fill="${stroke}"/>` : ''}</g>${node.subtitle ? centeredTitle(x + area.x + area.width / 2, cy, node.label, area.width, area.height, node.subtitle) : ''}`;
  }
  const area = textArea(node), titleY = y + (node.size.height - stateActivities(node).height) / 2;
  return `<g class="shape-label">${paint(outline(node, x, y), { fill, stroke, 'stroke-width': 1.2 })}${centeredTitle(cx, titleY, node.label, area.width, area.height, node.subtitle)}${activityMarkup(node, x, y, stroke, palette)}</g>`;
}

// Trigger, [guard] and / effect are told apart by color; the label string is these parts joined by single spaces.
const labelParts = edge => [
  { text: edge.label, role: 'trigger' },
  ...(edge.guard ? [{ text: `[${edge.guard}]`, role: 'guard' }] : []),
  ...(edge.action ? [{ text: `/ ${edge.action}`, role: 'effect' }] : [])
].filter(part => part.text);

export default {
  id: 'state', label: 'State diagram',
  nodeKinds: ["initial", "state", "final", "choice"],
  groupKinds: [],
  edgeKinds: ["transition"],
  render: stateNode, outline, anchor, textArea, activityArea,
  curvedSelfLoops: true,
  markers: { transition: { end: 'arrow-open' } },
  edgeLabel: edge => labelParts(edge).map(part => part.text).join(' '),
  edgeLabelParts: labelParts,
  labelRoleColors: { trigger: 'ink', guard: 'guard' },
  legend: { neutral: 'State', core: 'Core state', solid: 'Transition' },
  validateNode(node, label, errors) {
    for (const key of STATE_ACTIONS) {
      if (node?.[key] === undefined) continue;
      if (typeof node[key] !== 'string' || !node[key].trim()) errors.push(`${label}.${key} must be a non-empty string`);
      else if (node.kind !== 'state') errors.push(`${label}.${key} is only supported on state nodes`);
    }
  },
  validateEdge(edge, label, errors) {
    for (const field of ['guard', 'action']) if (edge?.[field] !== undefined && typeof edge[field] !== 'string') errors.push(`${label}.${field} must be a string`);
  },
};
