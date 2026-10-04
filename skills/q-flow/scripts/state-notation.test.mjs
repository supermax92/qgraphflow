import test from 'node:test';
import assert from 'node:assert/strict';
import { compileGraphLayout } from './compile-layout.mjs';
import { validateGraph } from './validate-graph.mjs';
import { createDiagramSvg } from '../assets/viewer/src/export-svg.js';
import { minimumNodeSize } from '../assets/viewer/src/layout-measure.js';
import { requireDiagramQuality } from '../assets/viewer/src/layout-quality.js';
import { stateActivities } from '../assets/viewer/src/diagrams/state.js';
import { labelRunsByLine } from '../assets/viewer/src/text-layout.js';
import { createEdgeRoutes } from '../assets/viewer/src/edge-routing.js';
import { graphLegend } from '../assets/viewer/src/legend.js';
import { PALETTES, moduleColorMap } from '../assets/viewer/src/visual-style.js';

const machine = () => ({
  meta: { title: 'Session', sourceRef: 'test', diagramType: 'state', locale: 'en' },
  nodes: [
    { id: 'initial', label: 'start', kind: 'initial' },
    { id: 'idle', label: 'IDLE', kind: 'state', subtitle: 'waiting for work' },
    { id: 'busy', label: 'BUSY', kind: 'state', tags: ['core'], entry: 'open the connection and send the first request', exit: 'close the connection' },
    { id: 'done', label: 'done', kind: 'final' }
  ],
  edges: [
    { id: 't0', source: 'initial', target: 'idle', kind: 'transition', label: 'new Session', evidence: 'test' },
    { id: 't1', source: 'idle', target: 'busy', kind: 'transition', label: 'submit', guard: 'queue.nonEmpty', action: 'take the next job', evidence: 'test' },
    { id: 't2', source: 'busy', target: 'busy', kind: 'transition', label: 'heartbeat', guard: '!finished', action: 'wait for the next one', evidence: 'test' },
    { id: 't3', source: 'busy', target: 'done', kind: 'transition', label: 'close()', evidence: 'test' }
  ]
});

test('entry, do and exit are plain strings, and only a state can have them', () => {
  assert.deepEqual(validateGraph(machine(), { inputOnly: true }), []);
  for (const [mutate, expected] of [
    [g => { g.nodes[2].entry = ''; }, /nodes\[2\]\.entry must be a non-empty string/],
    [g => { g.nodes[2].do = ['poll']; }, /nodes\[2\]\.do must be a non-empty string/],
    [g => { g.nodes[0].exit = 'x'; }, /nodes\[0\]\.exit is only supported on state nodes/]
  ]) { const graph = machine(); mutate(graph); assert.match(validateGraph(graph, { inputOnly: true }).join('\n'), expected); }
});

test('a state with actions is measured as a title compartment above the action compartment', () => {
  const plain = minimumNodeSize({ id: 'p', label: 'BUSY', kind: 'state' }, 'state'), busy = machine().nodes[2];
  const size = minimumNodeSize(busy, 'state'), actions = stateActivities({ ...busy, size }).height;
  assert.ok(actions >= 2 * 8 + 2 * 20, 'entry and exit take at least one line each');
  assert.ok(size.height >= 72 + actions && size.width <= 480);
  const short = minimumNodeSize({ id: 's', label: 'STARTING', kind: 'state', entry: 'send BrokerRegistration' }, 'state');
  assert.ok(short.width > 240 && stateActivities({ id: 's', kind: 'state', entry: 'send BrokerRegistration', size: short }).rows[0].lines.length === 1, 'an action that fits in 480 px stays on one line');
  assert.equal(minimumNodeSize({ id: 'p', label: 'BUSY', kind: 'state' }, 'state').height, plain.height, 'a state without actions keeps its size');
});

test('the exported machine draws action rows, an arc self-transition, open arrows, colored guards and ink pseudostates', async () => {
  const { graph } = await compileGraphLayout(machine());
  requireDiagramQuality(graph);
  const palette = PALETTES.light, svg = createDiagramSvg(graph);
  assert.match(svg, />entry \/<\/text>/); assert.match(svg, />exit \/<\/text>/); assert.match(svg, /stroke-opacity="\.35"/, 'divider above the actions');
  assert.match(svg.split('data-diagram-edge-id="t2"')[1].match(/<path d="([^"]+)"/)[1], /^M [\d.]+ [\d.]+ C /, 'the self-transition is one arc');
  assert.match(svg.split('data-diagram-edge-id="t1"')[1], /^><path d="[^"]*(?:L|H|V)[^"]*" fill="none"[^>]*marker-end="url\(#arrow-open\)"/, 'other transitions stay orthogonal with open arrows');
  assert.match(svg, new RegExp(`<tspan style="fill:${palette.guard}">\\[queue\\.nonEmpty\\] ?</tspan>`), 'the guard takes the guard color');
  assert.match(svg, new RegExp(`<tspan style="fill:${palette.ink}">submit ?</tspan>`), 'the trigger takes ink');
  assert.match(svg, new RegExp(`class="state-dot"><circle[^>]*fill="${palette.ink}"`), 'the initial dot is ink');
});

test('label runs follow the wrapped lines and give up when the lines do not spell the label', () => {
  const parts = [{ text: 'tick', role: 'trigger' }, { text: '[!done]', role: 'guard' }, { text: '/ wait for the next one', role: 'effect' }];
  const lines = ['tick [!done] / wait', ' for the next one'];
  const runs = labelRunsByLine(lines, parts);
  assert.deepEqual(runs.map(line => line.map(run => run.text).join('')), lines);
  assert.deepEqual(runs[0].map(run => run.role), ['trigger', 'guard', 'effect']);
  assert.deepEqual(runs[1].map(run => run.role), ['effect']);
  assert.equal(labelRunsByLine(['tick', '[!done]'], parts), null);
  // A hand-wrapped label keeps its roles: the break is skipped, not drawn.
  const wrapped = labelRunsByLine(['Confirm', 'payment [Valid]'], [{ text: 'Confirm\npayment', role: 'trigger' }, { text: '[Valid]', role: 'guard' }]);
  assert.deepEqual(wrapped, [[{ text: 'Confirm', role: 'trigger' }], [{ text: 'payment ', role: 'trigger' }, { text: '[Valid]', role: 'guard' }]]);
  assert.deepEqual(labelRunsByLine(['a', '', 'b'], [{ text: 'a\n\nb', role: 'trigger' }]).map(line => line.map(run => run.text).join('')), ['a', '', 'b']);
  assert.equal(labelRunsByLine(['Confirm'], [{ text: 'Confirm\npayment', role: 'trigger' }]), null, 'a missing paragraph is not guessed');
});

test('the state legend names states and transitions; other types keep the neutral wording', () => {
  const graph = machine(), palette = PALETTES.light, labels = view => graphLegend(view, palette, moduleColorMap([view], palette)).map(entry => entry.label);
  const state = labels(graph);
  for (const expected of ['State', 'Core state', 'Transition', 'Initial state', 'Final state', 'Self-transition: handled without leaving the state']) assert.ok(state.includes(expected), expected);
  assert.ok(!state.includes('Components / actors') && !state.includes('Solid relation'));
  const flow = { meta: { ...graph.meta, diagramType: 'flowchart' }, nodes: [{ id: 'a', label: 'A', kind: 'process' }, { id: 'b', label: 'B', kind: 'process' }], edges: [{ id: 'e', source: 'a', target: 'b', kind: 'flow', evidence: 'test' }] };
  assert.deepEqual(labels(flow).filter(label => /State|Transition/.test(label)), []);
  assert.ok(labels(flow).includes('Components / actors') && labels(flow).includes('Solid relation'));
});

test('the guard color is Radix amber step 11 in both themes', () => {
  assert.equal(PALETTES.light.guard, '#ab6400'); assert.equal(PALETTES.dark.guard, '#ffca16');
});

test('a self-transition keeps its polyline when its ends sit on two sides or on one point', () => {
  const view = (kind, size, via) => ({ meta: { title: 'Loop', sourceRef: 'test', diagramType: 'state' },
    nodes: [{ id: 's', label: 'S', kind, position: { x: 100, y: 200 }, size }],
    edges: [{ id: 'loop', source: 's', target: 's', kind: 'transition', label: 'tick', evidence: 'test', route: { via } }] });
  const moved = createEdgeRoutes(view('state', { width: 240, height: 80 }, [{ x: 300, y: 160 }, { x: 400, y: 160 }, { x: 400, y: 250 }])).get('loop');
  assert.notEqual(moved.sourceSide, moved.targetSide);
  assert.doesNotMatch(moved.path, / C /, 'a single arc on one side would cut through the state');
  const choice = createEdgeRoutes(view('choice', { width: 120, height: 120 }, [{ x: 352, y: 236 }, { x: 352, y: 284 }])).get('loop');
  assert.deepEqual(choice.points[0], choice.points.at(-1));
  assert.doesNotMatch(choice.path, / C /, 'ends on one point would collapse the arc into a line');
  const plain = createEdgeRoutes(view('state', { width: 240, height: 80 }, [{ x: 352, y: 224 }, { x: 384, y: 224 }, { x: 384, y: 256 }, { x: 352, y: 256 }])).get('loop');
  assert.match(plain.path, /^M [\d.]+ [\d.]+ C /, 'an ordinary loop on one side is still an arc');
});
