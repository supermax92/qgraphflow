import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileGraphLayout } from './compile-layout.mjs';
import { createDiagramSvg } from '../assets/viewer/src/export-svg.js';
import { graphLegend, rampGradient } from '../assets/viewer/src/legend.js';
import { IDENTITY } from '../assets/viewer/src/radix-colors.js';
import { PALETTES, copyColors, moduleColorMap, nodeAppearance, stateToneRoles, withoutWash } from '../assets/viewer/src/visual-style.js';

const state = (id, extra = {}) => ({ id, label: id.toUpperCase(), kind: 'state', module: 'order', ...extra });
const move = (source, target, label = `${source}-${target}`) => ({ id: `${source}>${target}`, source, target, kind: 'transition', label, evidence: 'test' });
const order = () => ({
  meta: { title: 'Order status', sourceRef: 'test', diagramType: 'state', locale: 'en' },
  nodes: [{ id: 'initial', label: 'start', kind: 'initial' }, state('unpay'), state('payed'), state('consignment'), state('success', { tags: ['core'] }), state('close')],
  edges: [move('initial', 'unpay'), move('unpay', 'payed'), move('payed', 'consignment'), move('consignment', 'success'), move('unpay', 'close')]
});
const roles = graph => Object.fromEntries([...stateToneRoles(graph)].map(([id, tone]) => [id, tone.role === 'flight' ? `flight${tone.index}` : tone.role]));

test('the core state is the goal, a dead end is ended, and the states in between walk the ramp in the order they are reached', () => {
  assert.deepEqual(roles(order()), { unpay: 'flight0', payed: 'flight1', consignment: 'flight2', success: 'goal', close: 'ended' });
});

test('ties go by declaration order, an unreachable state comes last, a failure tag wins, a way out that only ends the machine still ends it', () => {
  const graph = order();
  graph.nodes.splice(3, 0, state('review'), state('orphan'), state('draining'), state('sink'), { id: 'done', label: 'done', kind: 'final' }, { id: 'pick', label: 'pick', kind: 'choice' });
  graph.nodes.find(node => node.id === 'close').tags = ['Failure'];
  graph.edges.push(move('unpay', 'review'), move('review', 'consignment'), move('orphan', 'success'), move('unpay', 'draining'), move('draining', 'done'), move('unpay', 'sink'), move('sink', 'sink'), move('unpay', 'pick'));
  assert.deepEqual(roles(graph), { unpay: 'flight0', payed: 'flight1', review: 'flight2', consignment: 'flight3', orphan: 'flight4', draining: 'ended', sink: 'ended', success: 'goal', close: 'failed' });
  assert.ok(!stateToneRoles(graph).has('pick') && !stateToneRoles(graph).has('initial') && !stateToneRoles(graph).has('done'), 'only states are colored by lifecycle');
});

test('a machine without a core state, or any other diagram type, keeps its module colors', () => {
  const plain = order(); plain.nodes.find(node => node.id === 'success').tags = [];
  assert.equal(stateToneRoles(plain).size, 0);
  assert.equal(stateToneRoles({ ...order(), meta: { ...order().meta, diagramType: 'flowchart' } }).size, 0);
  for (const [theme, palette] of Object.entries(PALETTES)) {
    const colors = moduleColorMap([plain], palette), unpay = plain.nodes.find(node => node.id === 'unpay');
    assert.equal(nodeAppearance(unpay, palette, colors).fill, colors.get('order').wash, theme);
    assert.equal(nodeAppearance(unpay, palette, colors).stroke, colors.get('order').accent, theme);
  }
});

test('a state wears its lifecycle tone; the ring stays the core state\'s, the module keeps its chip and lines', () => {
  const graph = order(), byId = Object.fromEntries(graph.nodes.map(node => [node.id, node]));
  for (const [theme, palette] of Object.entries(PALETTES)) {
    const colors = moduleColorMap([graph], palette), tones = palette.stateTones, appearance = id => nodeAppearance(byId[id], palette, colors);
    assert.deepEqual([appearance('unpay').fill, appearance('unpay').stroke], [tones.flight[0].fill, tones.flight[0].stroke], theme);
    assert.deepEqual([appearance('payed').fill, appearance('payed').stroke], [tones.flight[1].fill, tones.flight[1].stroke], theme);
    assert.deepEqual([appearance('consignment').fill, appearance('consignment').stroke], [tones.flight[2].fill, tones.flight[2].stroke], theme);
    assert.deepEqual([appearance('success').fill, appearance('success').stroke], [tones.goal.fill, tones.goal.stroke], theme);
    assert.deepEqual([appearance('close').fill, appearance('close').stroke], [tones.ended.fill, tones.ended.stroke], theme);
    assert.equal(appearance('success').ring, palette.ringCore); assert.equal(appearance('unpay').ring, undefined);
    assert.equal(appearance('unpay').chip, colors.get('order').chip); assert.equal(appearance('unpay').moduleColor, colors.get('order').accent);
    assert.equal(appearance('initial').fill, palette.ink, 'the initial dot keeps its notation');
    assert.deepEqual(new Set(['unpay', 'payed', 'consignment', 'success', 'close'].map(id => appearance(id).stroke)).size, 5, 'five states, five frames');
  }
});

test('the ramp is warm to cool and the third in-flight tone is teal; every tone is a Radix step', () => {
  for (const [theme, palette] of Object.entries(PALETTES)) {
    assert.deepEqual(palette.stateTones.flight.slice(0, 3).map(tone => tone.name), ['orange', 'blue', 'teal']);
    const step = theme === 'dark' ? 10 : 11;
    for (const tone of [palette.stateTones.goal, ...palette.stateTones.flight]) assert.deepEqual([tone.fill, tone.stroke], [IDENTITY[theme][tone.name][3], IDENTITY[theme][tone.name][step]], `${theme} ${tone.name}`);
    assert.equal(palette.stateTones.goal.name, 'grass');
  }
});

test('every tone is readable: ink on the body, a 3:1 frame on body and surfaces, frames apart from each other and from the failure red', () => {
  const luminance = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  const lab = hex => { const [r, g, b] = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); const x = (.4124 * r + .3576 * g + .1805 * b) / .95047, y = .2126 * r + .7152 * g + .0722 * b, z = (.0193 * r + .1192 * g + .9505 * b) / 1.08883; const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116; return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]; };
  const distance = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
  for (const [theme, palette] of Object.entries(PALETTES)) {
    const tones = [['goal', palette.stateTones.goal], ['ended', palette.stateTones.ended], ['failed', palette.stateTones.failed], ...palette.stateTones.flight.map((tone, index) => [`flight${index}`, tone])];
    for (const [name, tone] of tones) {
      for (const key of ['ink', 'ink2', 'accent']) assert.ok(contrast(palette[key], tone.fill) >= 4.5, `${theme} ${name} ${key} on the body`);
      assert.ok(contrast(tone.stroke, tone.fill) >= 3, `${theme} ${name} frame on the body`);
      for (const surface of [palette.surface, palette.surface2, palette.groupFill, palette.groupFillNested]) assert.ok(contrast(tone.stroke, surface) >= 3, `${theme} ${name} frame on ${surface}`);
      if (name !== 'failed') assert.ok(distance(tone.stroke, palette.warn) >= 20, `${theme} ${name} stays away from the failure red`);
    }
    for (let i = 0; i < tones.length; i++) for (let j = i + 1; j < tones.length; j++) assert.ok(distance(tones[i][1].stroke, tones[j][1].stroke) >= 12, `${theme} ${tones[i][0]} and ${tones[j][0]} frames are apart`);
  }
});

test('the card-wash switch turns the tone bodies plain and leaves the frames', () => {
  const graph = order(), byId = Object.fromEntries(graph.nodes.map(node => [node.id, node]));
  for (const palette of Object.values(PALETTES)) {
    const colors = withoutWash(moduleColorMap([graph], palette), palette);
    for (const [id, tone] of [['unpay', palette.stateTones.flight[0]], ['success', palette.stateTones.goal], ['close', palette.stateTones.ended]]) {
      const appearance = nodeAppearance(byId[id], palette, colors);
      assert.equal(appearance.fill, palette.card); assert.equal(appearance.stroke, tone.stroke);
    }
    assert.equal(colors.get('order').wash, palette.card);
  }
});

test('a copy of the colors keeps the state tones, and nothing in the Viewer copies the map without them', () => {
  const graph = order(), palette = PALETTES.light, copy = copyColors(withoutWash(moduleColorMap([graph], palette), palette));
  assert.deepEqual([...copy.stateTones], [...stateToneRoles(graph)]);
  assert.equal(copy.plainStates, true); assert.equal(copy.get('order').wash, palette.card);
  assert.equal(nodeAppearance(graph.nodes.find(node => node.id === 'unpay'), palette, copy).fill, palette.card);
  const sources = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sources(path.join(directory, entry.name)) : /\.(js|jsx)$/.test(entry.name) ? [path.join(directory, entry.name)] : []);
  for (const file of sources(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/viewer/src'))) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /new Map\(\s*moduleColors/, `${path.basename(file)} copies the color map; use copyColors() so the state tones travel with it`);
  }
});

test('the legend lists the tones in use and one ramp for the in-flight states, in the order the ramp is walked', () => {
  const graph = order(), palette = PALETTES.light, colors = moduleColorMap([graph], palette), legend = graphLegend(graph, palette, colors), byId = Object.fromEntries(legend.map(entry => [entry.id, entry]));
  assert.deepEqual(byId['flight-ramp'].ramp, palette.stateTones.flight.slice(0, 3).map(tone => tone.stroke));
  assert.equal(byId['flight-ramp'].label, 'In-progress state: warm to cool as it advances');
  assert.deepEqual([byId['goal-box'].label, byId['goal-box'].fill, byId['goal-box'].stroke], ['Core state', palette.stateTones.goal.fill, palette.stateTones.goal.stroke]);
  assert.deepEqual([byId['ended-box'].label, byId['ended-box'].fill], ['Ended state', palette.stateTones.ended.fill]);
  assert.ok(!legend.some(entry => entry.role === 'neutral' || entry.role === 'failed'), 'tones that are not in the diagram have no entry');
  const failing = order(); failing.nodes.find(node => node.id === 'close').tags = ['failure'];
  assert.equal(graphLegend(failing, palette, moduleColorMap([failing], palette)).find(entry => entry.role === 'failed').label, 'Failed state');
  assert.equal(rampGradient(['#111111', '#222222']), 'linear-gradient(90deg, #111111 0% 50%, #222222 50% 100%)');
  const zh = { ...graph, meta: { ...graph.meta, locale: 'zh-CN' } };
  assert.deepEqual(graphLegend(zh, palette, moduleColorMap([zh], palette)).filter(entry => ['flight', 'goal', 'ended'].includes(entry.role)).map(entry => entry.label), ['进行中状态：由暖到冷表示推进顺序', '核心状态', '终结状态']);
});

test('the exported SVG paints each state with its tone, in both themes, whether or not the collection colors are passed in', async () => {
  const { graph } = await compileGraphLayout(order());
  const other = { meta: { title: 'Other', sourceRef: 'test', diagramType: 'architecture' }, nodes: [{ id: 'svc', label: 'Svc', kind: 'service', module: 'billing' }], edges: [] };
  for (const [theme, palette] of Object.entries(PALETTES)) {
    const alone = createDiagramSvg(graph, theme), inCollection = createDiagramSvg(graph, theme, moduleColorMap([other, graph], palette));
    assert.equal(alone, inCollection, `${theme}: the tones come from the graph itself`);
    const tones = palette.stateTones;
    for (const [id, tone] of [['unpay', tones.flight[0]], ['payed', tones.flight[1]], ['consignment', tones.flight[2]], ['success', tones.goal], ['close', tones.ended]]) {
      const drawing = alone.split(`data-diagram-node-id="${id}"`)[1].split('</g></g>')[0];
      assert.ok(drawing.includes(`fill="${tone.fill}" stroke="${tone.stroke}"`), `${theme} ${id}`);
    }
    assert.match(alone, new RegExp(`class="role-ring"[^>]+stroke="${palette.ringCore}"`), 'the goal state keeps the core ring');
  }
});
