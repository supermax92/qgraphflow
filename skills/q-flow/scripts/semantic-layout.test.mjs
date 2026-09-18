import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { DIAGRAM_TYPES, validateGraph, validateGraphInput, layoutComposition } from './validate-graph.mjs';
import { minimumNodeSize, measureFragmentText } from '../assets/viewer/src/layout-measure.js';
import { getDiagram, edgeMarkers } from '../assets/viewer/src/diagrams/registry.js';
import { PALETTES } from '../assets/viewer/src/visual-style.js';
import { layoutText } from '../assets/viewer/src/text-layout.js';
import { routeCrossings, createEdgeRoutes, graphBounds } from '../assets/viewer/src/edge-routing.js';
import { sequenceEndpointY, sequenceExecutions } from '../assets/viewer/src/sequence-executions.js';
import { auditLayoutQuality, requireDiagramQuality } from '../assets/viewer/src/layout-quality.js';
import { compileGraphLayout, migrateOwnership, LAYOUT_VERSION } from './compile-layout.mjs';
import { createDiagramSvg } from '../assets/viewer/src/export-svg.js';
import { writeOutputPair } from './generate-viewer.mjs';

const inputPath = path.resolve(import.meta.dirname, '../../../tests/fixtures/semantic-layout.graph.json');
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const fixture = type => structuredClone(input.diagrams.find(graph => graph.meta.diagramType === type));
const semanticErrors = graph => validateGraph(graph, { inputOnly: true });

test('adaptive spacing: long group headings keep a fixed side inset', async () => {
  for (const label of ['app', '业务服务与缓存协调及配置变更事件处理运行边界'.repeat(4)]) {
    const input = fixture('architecture'); input.groups[0].label = label;
    const { graph } = await compileGraphLayout(input), group = graph.groups[0];
    const inset = Math.min(...graph.nodes.filter(node => node.groupId === group.id).map(node => node.position.x - group.position.x));
    assert.ok(inset <= 40, `A heading must occupy the top, not a ${inset}px side column`);
    assert.deepEqual(auditLayoutQuality(graph).errors, []);
    assert.doesNotMatch(createDiagramSvg(graph), /…/);
  }
});

test('adaptive spacing: one long sequence message leaves unrelated gaps unchanged', async () => {
  const input = { meta: { title: 'Local spacing', diagramType: 'sequence', sourceRef: 'conceptual:spacing' },
    nodes: Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, label: `Service ${i}`, kind: 'participant' })),
    edges: Array.from({ length: 4 }, (_, i) => ({ id: `e${i}`, source: `n${i}`, target: `n${i + 1}`, label: 'Request', kind: 'sync', order: i + 1, evidence: 'inference' })) };
  const short = (await compileGraphLayout(input)).graph;
  input.edges[0].label = '完整请求内容 LongRequestDescription '.repeat(6);
  const long = (await compileGraphLayout(input)).graph;
  const gaps = graph => graph.nodes.slice(1).map((node, i) => node.position.x - graph.nodes[i].position.x - graph.nodes[i].size.width);
  assert.deepEqual(gaps(long).slice(1), gaps(short).slice(1), 'Only the constrained message span may grow');
  assert.ok(createEdgeRoutes(long).get('e0').labelLines.length > 1);
  assert.deepEqual(auditLayoutQuality(long).errors, []);
  assert.deepEqual((await compileGraphLayout(long)).graph, long);
});

test('adaptive spacing: nine types retain facts and regenerate at three scales', async t => {
  for (const type of DIAGRAM_TYPES) {
    const medium = fixture(type), simple = structuredClone(medium), edge = simple.edges[0];
    simple.nodes = simple.nodes.filter(node => [edge.source, edge.target].includes(node.id));
    simple.nodes.forEach(node => { delete node.groupId; delete node.layout; });
    simple.edges = [edge]; delete simple.groups; delete simple.executions; delete simple.layout;
    if (type === 'sequence') {
      edge.order = 1;
      const reply = medium.edges.find(item => item.replyTo === edge.id);
      simple.edges.push({ ...reply, order: 2 });
      simple.executions = [{ id: 'work', participantId: edge.target, start: { edgeId: edge.id, at: 'receive' }, end: { edgeId: reply.id, at: 'send' } }];
    }
    const complex = structuredClone(medium);
    for (let index = 1; index <= 2; index++) {
      const copy = structuredClone(medium), rename = id => `${index}:${id}`;
      if (type !== 'sequence') for (const node of copy.nodes) {
        node.id = rename(node.id); if (node.groupId) node.groupId = rename(node.groupId);
      }
      for (const edge of copy.edges) {
        edge.id = rename(edge.id);
        if (type === 'sequence') edge.order += index * Math.max(...medium.edges.map(edge => edge.order));
        else { edge.source = rename(edge.source); edge.target = rename(edge.target); }
        if (edge.replyTo) edge.replyTo = rename(edge.replyTo);
      }
      for (const group of copy.groups ?? []) {
        group.id = rename(group.id); if (group.parentId) group.parentId = rename(group.parentId);
        for (const operand of group.operands ?? []) operand.edgeIds = operand.edgeIds.map(rename);
      }
      for (const execution of copy.executions ?? []) {
        execution.id = rename(execution.id); if (execution.parentId) execution.parentId = rename(execution.parentId);
        execution.start.edgeId = rename(execution.start.edgeId); execution.end.edgeId = rename(execution.end.edgeId);
      }
      if (type !== 'sequence') {
        complex.nodes.push(...copy.nodes);
        const bridge = medium.edges.find(edge => !['initial', 'final'].includes(medium.nodes.find(node => node.id === edge.source).kind));
        complex.edges.push({ ...bridge, id: `bridge-${index}`, target: rename(bridge.target) });
      }
      complex.edges.push(...copy.edges); complex.groups = [...(complex.groups ?? []), ...(copy.groups ?? [])];
      if (copy.executions) complex.executions.push(...copy.executions);
    }
    for (const [scale, graph] of Object.entries({ simple, medium, complex })) {
      const compiled = await compileGraphLayout(graph);
      assert.ok(compiled.report.semantics.preserved, `${type}/${scale}: facts retained`);
      assert.deepEqual(auditLayoutQuality(compiled.graph).errors, [], `${type}/${scale}: safety`);
      assert.deepEqual((await compileGraphLayout(JSON.parse(JSON.stringify(compiled.graph)))).graph, compiled.graph, `${type}/${scale}: JSON regeneration`);
      const bounds = graphBounds(compiled.graph);
      t.diagnostic(`${type}/${scale}: ${graph.nodes.length} nodes, ${graph.edges.length} edges, ${bounds.width} × ${bounds.height}`);
    }
  }
});

test('all nine coordinate-free semantic inputs pass before any geometry is evaluated', () => {
  const before = JSON.stringify(input);
  assert.deepEqual(input.diagrams.map(graph => graph.meta.diagramType).sort(), [...DIAGRAM_TYPES].sort());
  assert.deepEqual(validateGraphInput(input, { inputOnly: true }), []);
  for (const graph of input.diagrams) {
    assert.match(validateGraph(graph).join('\n'), /position is required/);
    const malformed = structuredClone(graph);
    malformed.nodes[0].position = { x: NaN, y: 0 };
    assert.match(semanticErrors(malformed).join('\n'), /position.x must be/);
  }
  assert.equal(JSON.stringify(input), before);
  const result = spawnSync(process.execPath, [path.join(import.meta.dirname, 'validate-graph.mjs'), inputPath, '--input-only'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.semantic.status, 'passed');
  assert.equal(report.geometry.status, 'not-checked');
  assert.equal(report.rendering.status, 'not-checked');
  const imported = spawnSync(process.execPath, ['--input-type=module', '-'], { input: `await import(${JSON.stringify(new URL('./validate-graph.mjs', import.meta.url).href)}); process.stdout.write('imported');`, encoding: 'utf8' });
  assert.equal(imported.status, 0, imported.stderr); assert.equal(imported.stdout, 'imported', 'Importing from stdin must not execute the CLI or resolve a file named dash.');
  assert.equal(report.layoutComposition, null);
});

test('horizontal diagram types allow a compact six-node chain', async () => {
  for (const type of ['er', 'deployment', 'usecase', 'dataflow']) {
    const model = fixture(type), kind = { er: 'entity', deployment: 'service', usecase: 'usecase', dataflow: 'process' }[type];
    const template = model.nodes.find(node => node.kind === kind), edge = model.edges.find(edge => type === 'usecase' ? edge.kind === 'include' : true);
    model.nodes = Array.from({ length: 6 }, (_, i) => ({ ...template, id: `n${i}`, label: `N${i}`, groupId: undefined, layout: undefined }));
    model.edges = Array.from({ length: 5 }, (_, i) => ({ ...edge, id: `e${i}`, source: `n${i}`, target: `n${i + 1}` }));
    delete model.groups; delete model.layout;
    const { graph } = await compileGraphLayout(model);
    assert.deepEqual(auditLayoutQuality(graph).errors, []);
    assert.equal(new Set(graph.nodes.map(node => node.position.y)).size, 1, type);
    assert.ok(graph.nodes.every((node, i) => !i || node.position.x > graph.nodes[i - 1].position.x));
  }
});

test('ownership, path, order and notation errors are rejected without entering routing', () => {
  const cases = [
    ['architecture', g => g.nodes[0].groupId = 'missing', /groupId does not name/],
    ['architecture', g => g.nodes[0].groupId = ['app'], /groupId does not name/],
    ['architecture', g => g.nodes[0].layout = { rank: -1 }, /rank must be/],
    ['architecture', g => g.nodes[0].layout = { order: 0.5 }, /order must be/],
    ['architecture', g => g.layout = [], /layout must be an object/],
    ['architecture', g => g.edges[0].target = 'missing', /target does not name/],
    ['deployment', g => g.groups[0].parentId = 'host', /contains a cycle/],
    ['deployment', g => g.groups[0].parentId = 'unknown', /parentId does not name/],
    ['flowchart', g => g.layout.primaryPath = ['start', 'end'], /no directed edge/],
    ['flowchart', g => g.layout.primaryPath = ['start', 'check', 'start'], /distinct node IDs/],
    ['flowchart', g => { g.nodes[0].layout = { rank: 2 }; g.nodes[1].layout = { rank: 1 }; }, /primaryPath conflicts/],
    ['sequence', g => g.layout.participantOrder.pop(), /complete permutation/],
    ['sequence', g => g.nodes[0].groupId = 'retry', /not supported for sequence/],
    ['sequence', g => { g.nodes[0].layout = { order: 2 }; g.nodes[1].layout = { order: 1 }; }, /participantOrder conflicts/],
    ['sequence', g => g.executions[0].end.edgeId = 'c1', /start must precede end/],
    ['sequence', g => g.edges.find(e => e.id === 'r3').replyTo = 'c4', /must precede|endpoints must|scope/],
    ['class', g => g.nodes[0].layout.rank = 2, /above/],
    ['class', g => g.edges[0].target = 'Order', /target must be an interface/],
    ['usecase', g => g.nodes[0].groupId = 'shop', /actor inside/],
    ['usecase', g => g.edges.find(e => e.kind === 'include').source = 'buyer', /both be use cases/],
  ];
  for (const [type, mutate, expected] of cases) {
    const graph = fixture(type); mutate(graph);
    assert.match(semanticErrors(graph).join('\n'), expected, `${type}: ${mutate}`);
  }
});

test('component data flows preserve direct external and storage relationships', async () => {
  for (const [sourceKind, targetKind] of [['external', 'dataStore'], ['dataStore', 'dataStore'], ['external', 'external']]) {
    const graph = { meta: { title: 'Component data flow', sourceRef: 'conceptual:component-flow', diagramType: 'dataflow' },
      nodes: [{ id: 'source', label: 'Source', kind: sourceKind }, { id: 'target', label: 'Target', kind: targetKind }],
      edges: [{ id: 'data', source: 'source', target: 'target', label: 'Records', kind: 'data', evidence: 'inference' }] };
    assert.deepEqual(semanticErrors(graph), []);
    const compiled = await compileGraphLayout(graph);
    assert.deepEqual(compiled.graph.nodes.map(({ position, size, ...node }) => node), graph.nodes);
    assert.deepEqual(compiled.graph.edges.map(({ route, ...edge }) => edge), graph.edges);
    assert.deepEqual(auditLayoutQuality(compiled.graph).errors, []);
    const invalid = structuredClone(graph); invalid.edges[0].kind = 'call';
    assert.ok(semanticErrors(invalid).length, 'Data-flow edges still require the data kind.');
    invalid.edges[0].kind = 'data'; invalid.edges[0].target = 'missing';
    assert.match(semanticErrors(invalid).join('\n'), /target does not name/);
  }
});

test('nonplanarity alone never rejects a semantic graph and module never implies ownership', async () => {
  const graph = fixture('architecture');
  delete graph.groups;
  graph.nodes = Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, label: `N${i}`, kind: 'service', module: 'app' }));
  graph.edges = graph.nodes.slice(0, 3).flatMap(a => graph.nodes.slice(3).map(b => ({ id: `${a.id}-${b.id}`, source: a.id, target: b.id, kind: 'call', evidence: 'inference' })));
  assert.deepEqual(semanticErrors(graph), []);
  assert.ok(graph.nodes.every(node => node.groupId === undefined));
  const compiled = await compileGraphLayout(graph);
  assert.equal(compiled.graph.edges.length, 9);
  assert.ok(compiled.report.candidates.find(item => item.index === compiled.report.selected).crossings.length > 0);
  assert.deepEqual(auditLayoutQuality(compiled.graph).errors, []);
});

for (const type of ['architecture', 'flowchart', 'sequence']) test(`${type}: long text remains compilable without inventing relationships`, async () => {
  const graph = fixture(type);
  if (type === 'sequence') graph.groups.forEach(group => { group.label = '完整边界 LongMixedIdentifier_'.repeat(20); });
  else {
    graph.edges = []; graph.groups = []; delete graph.layout;
    graph.nodes.forEach(node => { delete node.groupId; delete node.layout; node.label = '完整节点 WMWM_LongIdentifier_'.repeat(3); });
  }
  const { graph: compiled, report } = await compileGraphLayout(graph);
  assert.ok(report.semantics.preserved);
  assert.equal(compiled.edges.length, graph.edges.length);
  assert.deepEqual(auditLayoutQuality(compiled).errors, []);
  assert.doesNotMatch(createDiagramSvg(compiled), /…/);
});

test('full bilingual content fits the same shape safety regions used by drawing', () => {
  const title = '库存预留与幂等校验 InventoryReservationAndIdempotencyValidation'.repeat(3);
  const subtitle = '处理中返回完整结果 / Return the complete processing result'.repeat(2);
  for (const type of DIAGRAM_TYPES) for (const kind of getDiagram(type).nodeKinds) {
    const node = { id: kind, kind, label: title, subtitle, fields: [{ name: title, type: 'DECIMAL(36, 18)', key: 'PK' }], attributes: [title, subtitle], methods: ['+ ' + title + '(): Optional<ReservationResult>'] };
    node.size = minimumNodeSize(node, type, 'zh-CN');
    const diagram = getDiagram(type);
    const svg = diagram.render(node, 0, 0, '#fff', '#000', PALETTES.light, 'zh-CN');
    assert.doesNotMatch(svg, /…|scale\(/, `${type}/${kind} must neither truncate nor shrink`);
    if (type === 'state' && ['initial', 'final'].includes(kind)) continue;
    if (diagram.textArea && kind !== 'actor') {
      const area = diagram.textArea(node);
      const required = layoutText(title, area.width, 20, 29).height + 5 + layoutText(subtitle, area.width, 16, 23.2).height;
      assert.ok(area.height >= required, `${type}/${kind} content must fit its safety area`);
    }
    assert.ok(svg.includes('完整结果') || svg.includes('完整') && svg.includes('结果'), `${type}/${kind} preserves the subtitle`);
    assert.doesNotMatch(svg, /font-size:1[0-3](?:\D)|compact-title|compact-body/);
  }
  const group = { label: title, operands: [{ guard: title, body: subtitle }] };
  const measured = measureFragmentText(group);
  assert.equal(measured.heading.lines.join(''), title);
  assert.equal(measured.operands[0].heading.lines.join(''), title);
  assert.equal(measured.operands[0].body.lines.join(''), subtitle);
  const russian = { kind: 'usecase', label: 'Обработать проблемные заказы', subtitle: 'Проверить, закрыть, компенсировать', size: { width: 480, height: 196 } };
  const russianSvg = getDiagram('usecase').render(russian, 0, 0, '#fff', '#000', PALETTES.light);
  assert.doesNotMatch(russianSvg, /…/, 'Already wrapped lines must not be truncated again by rounded width estimates.');
  assert.match(russianSvg, /проблемные заказы/);
  for (const theme of ['light', 'dark']) for (const kind of ['initial', 'final']) {
    const node = { kind, position: { x: 0, y: 0 }, size: { width: 26, height: 26 } };
    const svg = getDiagram('state').render(node, 0, 0, '#fdf3eb', '#b66314', PALETTES[theme]);
    assert.match(svg, /fill="#b66314"/, 'State initial and final centers stay solid even with a pale module fill.');
    if (kind === 'final') assert.match(svg, /r="8" fill="#b66314"/);
  }
});

test('crossing diagnostics retain remote and repeated intersections even for shared endpoints', () => {
  const first = { source: 'shared', target: 'a' }, second = { source: 'shared', target: 'b' };
  const a = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 300, y: 100 }];
  const b = [{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 200, y: 50 }, { x: 200, y: 150 }];
  assert.deepEqual(routeCrossings(first, a, second, b), [{ x: 100, y: 50 }, { x: 200, y: 100 }]);
  assert.deepEqual(routeCrossings(second, b, first, a), routeCrossings(first, a, second, b));
  const bend = [{ x: 100, y: 50 }, { x: 100, y: 100 }, { x: 150, y: 100 }];
  assert.equal(routeCrossings({ source: 'x', target: 'y' }, bend, { source: 'z', target: 'w' }, [{ x: 50, y: 100 }, { x: 200, y: 100 }]).length, 1, 'A bend intersection is deduplicated.');
});

test('state endpoint descriptions remain visible beside solid symbols and clear of routes', async () => {
  const input = fixture('state');
  input.nodes.find(node => node.kind === 'initial').subtitle = '对象已构造\nConstructed';
  input.nodes.find(node => node.kind === 'final').subtitle = 'Registry / Lifecycle 已关闭';
  const { graph } = await compileGraphLayout(input);
  assert.deepEqual(auditLayoutQuality(graph).errors, []);
  const svg = createDiagramSvg(graph);
  for (const node of graph.nodes.filter(node => ['initial', 'final'].includes(node.kind))) {
    assert.ok(svg.includes(node.subtitle));
    assert.ok(node.size.height >= 80);
    const incident = graph.edges.find(edge => edge.source === node.id || edge.target === node.id);
    const route = createEdgeRoutes(graph).get(incident.id);
    assert.equal((incident.source === node.id ? route.points[0] : route.points.at(-1)).x, node.position.x + 14);
  }
  const cyclic = { meta: input.meta, nodes: [
    { id: 'initial', label: 'Initial', kind: 'initial' }, { id: 'stopped', label: 'Stopped', kind: 'state' },
    { id: 'running', label: 'Running', kind: 'state' }, { id: 'final', label: 'Final', kind: 'final' }
  ], edges: [['init', 'initial', 'stopped'], ['start', 'stopped', 'running'], ['stop', 'running', 'stopped'], ['close', 'stopped', 'final']]
    .map(([id, source, target]) => ({ id, source, target, kind: 'transition', evidence: 'inference' })) };
  const compiled = (await compileGraphLayout(cyclic)).graph, byId = Object.fromEntries(compiled.nodes.map(node => [node.id, node]));
  assert.ok(byId.initial.position.y < byId.stopped.position.y && byId.stopped.position.y < byId.running.position.y && byId.running.position.y < byId.final.position.y);
  assert.deepEqual(compiled.edges.map(({ route, ...edge }) => edge), cyclic.edges);
  byId.initial.position.y = byId.running.position.y;
  assert.ok(auditLayoutQuality(compiled).diagnostics.some(item => item.ruleId === 'semantic.state-endpoint'));
});

test('strict layout permits clear crossings and enforces 48px nodes and 24px parallel channels', () => {
  const node = (id, x, y) => ({ id, label: id, kind: 'service', position: { x, y }, size: { width: 240, height: 100 } });
  const edge = (id, source, target, via) => ({ id, source, target, kind: 'call', evidence: 'inference', ...(via ? { route: { via } } : {}) });
  const graph = { meta: { title: 'Crossing', sourceRef: 'conceptual:crossing', diagramType: 'architecture' }, nodes: [node('l', 0, 400), node('r', 800, 400), node('t', 400, 0), node('b', 400, 800)], edges: [edge('horizontal', 'l', 'r'), edge('vertical', 't', 'b')] };
  let audit = auditLayoutQuality(graph);
  assert.deepEqual(audit.errors, []);
  assert.equal(audit.crossings.length, 1);
  assert.equal(audit.crossings[0].severity, 'info');
  const pair = { ...graph, nodes: [node('a', 0, 0), node('b', 288, 0)], edges: [] };
  assert.deepEqual(auditLayoutQuality(pair).errors, []);
  pair.nodes[1].position.x--;
  assert.ok(auditLayoutQuality(pair).diagnostics.some(item => item.ruleId === 'spacing.nodes' && item.measured === 47));
  const row = { ...graph, nodes: Array.from({ length: 8 }, (_, i) => node(`service-${i}`, i * 400, i % 3 * 12)), edges: [] };
  assert.ok(auditLayoutQuality(row).diagnostics.some(item => item.ruleId === 'semantic.single-row'), 'Small y offsets retain the legacy row degeneration.');
  const parallel = { ...graph, nodes: [node('a', 0, 0), node('b', 0, 400), node('c', 800, 0), node('d', 800, 400)], edges: [edge('upper', 'a', 'c', [{ x: 260, y: 50 }, { x: 300, y: 50 }, { x: 300, y: 200 }, { x: 740, y: 200 }, { x: 760, y: 50 }]), edge('lower', 'b', 'd', [{ x: 260, y: 450 }, { x: 300, y: 450 }, { x: 300, y: 224 }, { x: 740, y: 224 }, { x: 760, y: 450 }])] };
  assert.deepEqual(auditLayoutQuality(parallel).errors, []);
  parallel.edges[1].route.via.filter(point => point.y === 224).forEach(point => point.y--);
  audit = auditLayoutQuality(parallel);
  assert.ok(audit.diagnostics.some(item => item.ruleId === 'route.parallel-channels' && item.measured === 23));
  parallel.edges[1].route.via.filter(point => point.y === 223).forEach(point => point.y = 200);
  assert.ok(auditLayoutQuality(parallel).diagnostics.some(item => item.ruleId === 'route.parallel-channels' && item.measured === 0));
});

test('label and ownership clearances accept their boundary and reject one pixel less', () => {
  const node = (id, x, y) => ({ id, label: id, kind: 'service', position: { x, y }, size: { width: 240, height: 100 } });
  const graph = { meta: { title: 'Clearance boundaries', sourceRef: 'conceptual:boundaries', diagramType: 'architecture' },
    nodes: [node('a', 0, 0), node('b', 1000, 0), node('c', 0, 600), node('d', 1000, 600)],
    edges: [{ id: 'upper', source: 'a', target: 'b', label: 'Label', kind: 'call', evidence: 'inference' }, { id: 'lower', source: 'c', target: 'd', label: 'Label', kind: 'call', evidence: 'inference' }] };
  const { width, height } = createEdgeRoutes(graph).get('upper').labelBox;
  const has = (model, rule) => auditLayoutQuality(model).diagnostics.some(item => item.ruleId === rule);
  graph.edges[0].route = { labelAt: { x: 240 + 24 + width / 2, y: 50 } };
  assert.equal(has(graph, 'spacing.label-node'), false);
  graph.edges[0].route.labelAt.x--;
  assert.equal(has(graph, 'spacing.label-node'), true);
  graph.edges[0].route.labelAt = { x: 600, y: 300 };
  graph.edges[1].route = { labelAt: { x: 600, y: 300 + height + 24 } };
  assert.equal(has(graph, 'spacing.labels'), false);
  graph.edges[1].route.labelAt.y--;
  assert.equal(has(graph, 'spacing.labels'), true);
  graph.edges[0].route.labelAt = { x: 600, y: 650 - height / 2 - 6 };
  graph.edges[1].route.labelAt = { x: 400, y: 730 };
  assert.equal(has(graph, 'spacing.label-edge'), false);
  graph.edges[0].route.labelAt.y++;
  assert.equal(has(graph, 'spacing.label-edge'), true);

  const owned = { ...graph, edges: [], nodes: [{ ...node('a', 32, 58), groupId: 'left' }, { ...node('b', 680, 58), groupId: 'right' }],
    groups: [{ id: 'left', label: 'Left', kind: 'runtime', position: { x: 0, y: 0 }, size: { width: 600, height: 400 } }, { id: 'right', label: 'Right', kind: 'runtime', position: { x: 648, y: 0 }, size: { width: 400, height: 400 } }] };
  assert.deepEqual(auditLayoutQuality(owned).errors, []);
  for (const axis of ['x', 'y']) {
    const invalid = structuredClone(owned); invalid.nodes[0].position[axis]--;
    assert.equal(has(invalid, 'group.member-inset'), true, `${axis}: preserve 32px side inset and 24px below the measured heading`);
  }
  owned.groups[1].position.x--;
  assert.equal(has(owned, 'group.sibling-gap'), true);
});

test('bounded compilation preserves facts and repeats geometry across reorder and recompile', async () => {
  const snapshot = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../../tests/fixtures/semantic-layout.geometry.json'), 'utf8'));
  assert.equal(snapshot.layoutVersion, LAYOUT_VERSION);
  assert.equal(snapshot.inputSha256, createHash('sha256').update(fs.readFileSync(inputPath)).digest('hex'));
  const semantic = graph => {
    const result = structuredClone(graph);
    for (const item of [...result.nodes, ...(result.groups ?? [])]) { delete item.position; delete item.size; }
    for (const edge of result.edges) delete edge.route;
    if (result.layout) { delete result.layout.version; delete result.layout.strategy; }
    return result;
  };
  const geometry = graph => ({ nodes: [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id)), edges: [...graph.edges].sort((a, b) => a.id.localeCompare(b.id)), groups: [...(graph.groups ?? [])].sort((a, b) => a.id.localeCompare(b.id)), routes: [...createEdgeRoutes(graph)].sort(([a], [b]) => a.localeCompare(b)) });
  for (const type of DIAGRAM_TYPES) {
    const graph = fixture(type), first = await compileGraphLayout(graph), second = await compileGraphLayout(graph), again = await compileGraphLayout(first.graph);
    const reordered = structuredClone(graph);
    for (const key of ['nodes', 'edges', 'groups']) reordered[key]?.reverse();
    const permuted = await compileGraphLayout(reordered);
    assert.deepEqual(semantic(first.graph), semantic({ ...graph, layout: graph.layout ?? {} }), type);
    assert.deepEqual(geometry(first.graph), geometry(second.graph), `${type}: repeat`);
    assert.deepEqual(geometry(first.graph), geometry(again.graph), `${type}: idempotent`);
    assert.deepEqual(geometry(first.graph), geometry(permuted.graph), `${type}: permutation`);
    assert.deepEqual({ type, strategy: first.graph.layout.strategy, nodes: first.graph.nodes.map(({ id, position, size }) => ({ id, position, size })), edges: first.graph.edges.map(({ id, route }) => ({ id, route })), groups: (first.graph.groups ?? []).map(({ id, position, size }) => ({ id, position, size })) }, snapshot.diagrams.find(item => item.type === type), `${type}: reviewed geometry baseline`);
    assert.equal(first.report.candidates.length, 6);
    assert.deepEqual(auditLayoutQuality(first.graph).errors, []);
  }
  await assert.rejects(compileGraphLayout(fixture('architecture'), { timeoutMs: 1 }), /exceeded 1ms/);
});

test('messageY moves routes, activation endpoints and fragments without renumbering messages', async () => {
  const input = fixture('sequence');
  input.edges[0].label = '请求包含完整的中文与英文说明 / Full request description '.repeat(10);
  input.groups[0].operands[0].guard += ' && inventoryVersionMatches && 所有前置条件均已校验';
  const result = await compileGraphLayout(input), graph = result.graph;
  assert.deepEqual(graph.edges.map(edge => [edge.id, edge.order, edge.replyTo]), input.edges.map(edge => [edge.id, edge.order, edge.replyTo]));
  assert.deepEqual(graph.executions, input.executions);
  const routes = createEdgeRoutes(graph), executions = sequenceExecutions(graph);
  for (const edge of graph.edges) assert.equal(routes.get(edge.id).points[0].y, edge.route.messageY);
  for (const execution of graph.executions) {
    const rect = executions.find(item => item.id === execution.id), start = graph.edges.find(edge => edge.id === execution.start.edgeId), end = graph.edges.find(edge => edge.id === execution.end.edgeId);
    assert.equal(rect.y, sequenceEndpointY(graph, start, execution.start.at));
    assert.equal(rect.y + rect.height, sequenceEndpointY(graph, end, execution.end.at));
  }
  assert.deepEqual(validateGraph(graph), []);
  const invalid = structuredClone(graph);
  invalid.edges[1].route.messageY = invalid.edges[0].route.messageY;
  assert.match(validateGraph(invalid).join('\n'), /preserve message order/);
  const malformed = fixture('sequence'); malformed.edges[0].route = { messageY: NaN };
  assert.match(semanticErrors(malformed).join('\n'), /messageY must be/);
});

test('flow main paths stay vertical with or without hints at every strict output entry', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-flow-direction-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const count of [2, 3, 6]) for (const axis of ['x', 'y']) for (const hints of ['none', 'path', 'rank', 'both']) {
    const graph = {
      meta: { title: 'Main flow', diagramType: 'flowchart', sourceRef: 'conceptual:flow-direction' },
      nodes: Array.from({ length: count }, (_, i) => ({ id: `step-${i}`, label: `Step ${i}`, kind: i === 0 ? 'start' : i === count - 1 ? 'end' : 'process',
        position: { x: 100, y: 100, [axis]: 100 + i * 600 }, size: { width: 240, height: 120 },
        ...(['rank', 'both'].includes(hints) ? { layout: { rank: i } } : {}) })),
      edges: Array.from({ length: count - 1 }, (_, i) => ({ id: `edge-${i}`, source: `step-${i}`, target: `step-${i + 1}`, kind: 'flow', evidence: 'inference' })),
    };
    if (['path', 'both'].includes(hints)) graph.layout = { primaryPath: graph.nodes.map(node => node.id) };
    const before = structuredClone(graph), horizontal = axis === 'x';
    if (horizontal) {
      assert.ok(auditLayoutQuality(graph).diagnostics.some(item => item.ruleId === 'semantic.primary-path'));
      await assert.rejects(compileGraphLayout(graph, { layout: 'preserve' }), /semantic.primary-path/);
      assert.throws(() => createDiagramSvg(graph), /semantic.primary-path/);
      const shuffled = structuredClone(graph); shuffled.nodes.reverse(); shuffled.edges.reverse();
      assert.throws(() => requireDiagramQuality(shuffled), /semantic.primary-path/, 'Topology, not array order, determines a simple chain.');
    } else {
      assert.deepEqual(auditLayoutQuality(graph).errors, []);
      assert.deepEqual((await compileGraphLayout(graph, { layout: 'preserve' })).graph, graph);
      assert.match(createDiagramSvg(graph), /data-diagram-node-id="step-1"/);
    }
    assert.equal(layoutComposition(graph).singleRow, horizontal && count > 5);
    const input = path.join(directory, `${count}-${axis}-${hints}.json`), output = path.join(directory, `${count}-${axis}-${hints}`);
    fs.writeFileSync(input, JSON.stringify(graph));
    fs.mkdirSync(output);
    for (const name of ['index.html', 'graph.json']) fs.writeFileSync(path.join(output, name), 'existing accepted output');
    for (const [script, args] of [['validate-graph.mjs', [input]], ['generate-viewer.mjs', [input, output, '--layout', 'preserve', '--force']]]) {
      const result = spawnSync(process.execPath, [path.join(import.meta.dirname, script), ...args], { encoding: 'utf8' });
      assert.equal(result.status, horizontal ? 1 : 0, `${count}/${axis}/${hints}: ${result.stderr}`);
    }
    if (horizontal) for (const name of ['index.html', 'graph.json']) assert.equal(fs.readFileSync(path.join(output, name), 'utf8'), 'existing accepted output');
    else assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, 'graph.json'))), graph);
    assert.deepEqual(graph, before, 'Quality checks do not insert inferred hints or change geometry.');
    if (horizontal && hints === 'none') {
      const compiled = (await compileGraphLayout(graph)).graph;
      requireDiagramQuality(compiled);
      assert.deepEqual(compiled.edges.map(({ route, ...edge }) => edge), graph.edges);
      assert.equal(compiled.layout.primaryPath, undefined, 'Inferred order is not invented business metadata.');
    }
  }
  const original = (await compileGraphLayout(fixture('flowchart'))).graph;
  const horizontal = structuredClone(original), transpose = ({ x, y }) => ({ x: y * 2, y: x * 2 });
  for (const node of horizontal.nodes) {
    node.position = transpose(node.position);
    node.size = { width: node.size.height * 2, height: node.size.width * 2 };
  }
  for (const edge of horizontal.edges) {
    edge.route.via = edge.route.via.map(transpose);
    if (edge.route.labelAt) edge.route.labelAt = transpose(edge.route.labelAt);
  }
  assert.throws(() => createDiagramSvg(horizontal), /semantic.primary-path/);
  requireDiagramQuality(original);
  delete original.layout.primaryPath;
  requireDiagramQuality(original); // Real branches and retry edges are not mistaken for a simple main chain.
});

test('branch corridors, cycles and structured element locations survive the shared strict gate', async () => {
  for (const type of ['flowchart', 'state']) {
    const { graph } = await compileGraphLayout(fixture(type));
    requireDiagramQuality(graph);
    const decision = graph.nodes.find(node => ['decision', 'choice'].includes(node.kind));
    const branches = graph.edges.filter(edge => edge.source === decision.id && edge.target !== decision.id);
    const routes = createEdgeRoutes(graph);
    assert.deepEqual(new Set(branches.map(edge => routes.get(edge.id).sourceSide)), new Set(['left', 'right']));
    assert.deepEqual(graph.edges.map(({ id, source, target }) => ({ id, source, target })), fixture(type).edges.map(({ id, source, target }) => ({ id, source, target })));
    const invalid = structuredClone(graph);
    for (const edge of invalid.edges.filter(edge => edge.source === decision.id)) edge.route.via[0] = { x: decision.position.x + decision.size.width / 2, y: decision.position.y + decision.size.height + 12 };
    const diagnostic = auditLayoutQuality(invalid).diagnostics.find(item => item.ruleId === 'semantic.branch-sides');
    assert.equal(diagnostic.severity, 'error'); assert.ok(diagnostic.elementIds.includes(decision.id));
    assert.ok(diagnostic.bounds.length); assert.ok(diagnostic.remediation);
    assert.throws(() => createDiagramSvg(invalid), /semantic.branch-sides/);
  }
  const graph = (await compileGraphLayout(fixture('architecture'))).graph;
  graph.nodes[1].position = { ...graph.nodes[0].position };
  const diagnostic = auditLayoutQuality(graph).diagnostics.find(item => item.ruleId === 'shape.node-overlap');
  assert.equal(diagnostic.elementIds.length, 2); assert.equal(diagnostic.bounds.length, 2); assert.ok(diagnostic.remediation);
});

test('legacy migration requires unique containment and preserve retains complete geometry', async () => {
  const { graph } = await compileGraphLayout(fixture('deployment'));
  const legacy = structuredClone(graph);
  for (const node of legacy.nodes) delete node.groupId;
  for (const group of legacy.groups) delete group.parentId;
  const migrated = structuredClone(legacy), report = migrateOwnership(migrated);
  assert.equal(report.length, 5);
  assert.deepEqual(migrated, graph);
  const preserved = await compileGraphLayout(legacy, { layout: 'preserve' });
  assert.deepEqual(preserved.graph, graph);
  const ambiguous = structuredClone(legacy);
  ambiguous.groups.push({ ...structuredClone(ambiguous.groups[0]), id: 'duplicate' });
  assert.throws(() => migrateOwnership(ambiguous), /Ambiguous legacy containment/);
  const overlap = structuredClone(legacy);
  overlap.nodes[0].position = { x: overlap.groups[0].position.x - 10, y: overlap.groups[0].position.y + 40 };
  assert.throws(() => migrateOwnership(overlap), /Ambiguous legacy containment/);
  const invalid = structuredClone(graph); invalid.nodes[0].position = { ...invalid.nodes[1].position };
  await assert.rejects(compileGraphLayout(invalid, { layout: 'preserve' }), /Diagram quality failed/);
});

test('multiedges and loops preserve independent routes; class multiplicities appear in SVG', async () => {
  for (const kind of ['include', 'extend']) assert.equal(edgeMarkers({ kind }, 'usecase').end, 'arrow-open');
  assert.equal(edgeMarkers({ kind: 'dependency' }, 'class').end, 'arrow-open');
  const graph = fixture('architecture');
  graph.edges.push({ ...graph.edges[1], id: 'orders-audit', label: 'Audit' });
  graph.edges.push({ id: 'orders-self', source: 'orders', target: 'orders', kind: 'call', evidence: 'inference', label: 'Retry' });
  const result = await compileGraphLayout(graph);
  assert.deepEqual(result.graph.edges.map(edge => [edge.id, edge.source, edge.target]), graph.edges.map(edge => [edge.id, edge.source, edge.target]));
  assert.deepEqual(auditLayoutQuality(result.graph).errors, []);
  const classGraph = (await compileGraphLayout(fixture('class'))).graph;
  const annotations = createEdgeRoutes(classGraph).get('contains').endpointLabels;
  assert.deepEqual(annotations.map(item => [item.role, item.label]), [['source', '1'], ['target', '1..*']]);
  const svg = createDiagramSvg(classGraph);
  assert.equal((svg.match(/class="edge-multiplicity"/g) ?? []).length, 2);
  assert.match(svg, />1\.\.\*<\/text>/);
  const inheritance = fixture('class'), relation = inheritance.edges.find(edge => edge.kind === 'implementation');
  relation.kind = 'inheritance'; inheritance.nodes.find(node => node.id === relation.target).kind = 'class';
  const inherited = (await compileGraphLayout(inheritance)).graph;
  const parent = inherited.nodes.find(node => node.id === relation.target), child = inherited.nodes.find(node => node.id === relation.source);
  assert.ok(parent.position.y + parent.size.height + 96 <= child.position.y);
  assert.match(createDiagramSvg(inherited), /marker-end="url\(#triangle\)"/);
  const invalid = fixture('class'); invalid.edges.at(-1).targetMultiplicity = '5..2';
  assert.match(semanticErrors(invalid).join('\n'), /ascending range/);
});

test('the public generator compiles semantic input, preserves validated geometry and leaves failed output untouched', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-strict-cli-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'viewer'), source = path.join(directory, 'input.json'), generator = path.join(import.meta.dirname, 'generate-viewer.mjs');
  const run = (...options) => spawnSync(process.execPath, [generator, source, output, ...options], { encoding: 'utf8' });
  fs.writeFileSync(source, JSON.stringify(input));
  let result = run(); assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.layout.length, 9);
  assert.ok(report.quality.every(item => item.semantic.status === 'passed' && item.geometry.status === 'passed' && item.rendering.status === 'not-checked'));
  assert.ok(report.layout.every(item => item.semantics.preserved));
  const graph = fs.readFileSync(path.join(output, 'graph.json')), html = fs.readFileSync(path.join(output, 'index.html'));
  fs.writeFileSync(source, graph);
  result = run('--layout', 'preserve', '--force'); assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readFileSync(path.join(output, 'graph.json')), graph);
  const invalid = JSON.parse(graph); invalid.diagrams.at(-1).edges[0].target = 'missing';
  invalid.diagrams[0].layout.passed = true;
  fs.writeFileSync(source, JSON.stringify(invalid));
  result = run('--force'); assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not name a node/);
  assert.deepEqual(fs.readFileSync(path.join(output, 'graph.json')), graph);
  assert.deepEqual(fs.readFileSync(path.join(output, 'index.html')), html);
  assert.deepEqual(fs.readdirSync(output).sort(), ['graph.json', 'index.html']);
});

test('staging and installation failures restore both outputs and remove temporary files', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-output-transaction-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const old = { 'graph.json': '{"old":true}', 'index.html': '<html>old</html>', 'snapshot.svg': '<svg/>' }, next = { 'graph.json': '{"new":true}', 'index.html': '<html>new</html>' };
  for (const [name, contents] of Object.entries(old)) fs.writeFileSync(path.join(directory, name), contents);
  for (const method of ['writeFileSync', 'renameSync']) {
    const original = fs[method]; let failed = false, writes = 0;
    fs[method] = (...args) => {
      const inject = method === 'writeFileSync' ? ++writes === 2 : args[0].endsWith('/graph.json') && args[1] === path.join(directory, 'graph.json');
      if (!failed && inject) { failed = true; throw new Error(`injected ${method} failure`); }
      return original(...args);
    };
    try { assert.throws(() => writeOutputPair(directory, next), /injected/); }
    finally { fs[method] = original; }
    for (const [name, contents] of Object.entries(old)) assert.equal(fs.readFileSync(path.join(directory, name), 'utf8'), contents);
    assert.deepEqual(fs.readdirSync(directory).sort(), Object.keys(old).sort());
  }
  writeOutputPair(directory, next);
  for (const [name, contents] of Object.entries(next)) assert.equal(fs.readFileSync(path.join(directory, name), 'utf8'), contents);
  assert.deepEqual(fs.readdirSync(directory).sort(), Object.keys(next).sort());
});

test('endpoint, bottom/right inset and sequence message boundaries reject one pixel less', async () => {
  const has = (graph, rule) => auditLayoutQuality(graph).diagnostics.some(item => item.ruleId === rule);
  for (const [type, stub] of [['architecture', 12], ['er', 28]]) {
    const graph = { meta: { title: 'Endpoint boundary', sourceRef: 'conceptual:boundary', diagramType: type },
      nodes: ['a', 'b'].map((id, i) => ({ id, label: id, kind: type === 'er' ? 'entity' : 'service', fields: [{ name: 'id', type: 'int', key: 'PK' }], position: { x: i * 800, y: 0 }, size: { width: 240, height: 140 } })),
      edges: [{ id: 'edge', source: 'a', target: 'b', kind: type === 'er' ? 'relationship' : 'call', sourceCardinality: '1', targetCardinality: '*', evidence: 'inference', route: { via: [{ x: 240 + stub, y: 70 }, { x: 240 + stub, y: 300 }, { x: 800 - stub, y: 300 }, { x: 800 - stub, y: 70 }] } }] };
    assert.equal(has(graph, 'route.endpoint-stub'), false);
    for (const end of ['source', 'target']) {
      const invalid = structuredClone(graph);
      for (const point of invalid.edges[0].route.via.slice(end === 'source' ? 0 : 2, end === 'source' ? 2 : 4)) point.x += end === 'source' ? -1 : 1;
      assert.equal(has(invalid, 'route.endpoint-stub'), true, `${type}/${end}: ${stub - 1}px`);
    }
  }
  const owned = { meta: { title: 'Inset boundary', sourceRef: 'conceptual:boundary', diagramType: 'architecture' }, nodes: [{ id: 'a', label: 'A', kind: 'service', groupId: 'group', position: { x: 32, y: 84 }, size: { width: 240, height: 100 } }], edges: [], groups: [{ id: 'group', label: 'Group', kind: 'runtime', position: { x: 0, y: 0 }, size: { width: 304, height: 216 } }] };
  assert.equal(has(owned, 'group.member-inset'), false);
  for (const axis of ['width', 'height']) { const invalid = structuredClone(owned); invalid.groups[0].size[axis]--; assert.equal(has(invalid, 'group.member-inset'), true, axis); }
  const { graph } = await compileGraphLayout(fixture('sequence'));
  const edge = graph.edges[0], route = createEdgeRoutes(graph).get(edge.id);
  graph.groups = []; graph.executions = []; graph.edges = [edge];
  edge.route.labelAt = { x: route.labelPoint.x, y: route.points[0].y - route.labelBox.height / 2 - 6 };
  assert.equal(has(graph, 'sequence.message-clearance'), false);
  edge.route.labelAt.y++;
  assert.equal(has(graph, 'sequence.message-clearance'), true);
});

test('semantic and geometry failures carry typed element locations and remediation', async () => {
  const semantic = fixture('class'); semantic.edges[0].target = 'missing';
  await assert.rejects(compileGraphLayout(semantic), error => {
    assert.equal(error.phases.semantic.status, 'failed');
    assert.ok(error.diagnostics.some(item => item.elementIds.includes(semantic.edges[0].id)));
    assert.ok(error.diagnostics.every(item => item.ruleId && item.diagramType === 'class' && item.remediation && Array.isArray(item.bounds)));
    return true;
  });
  const { graph } = await compileGraphLayout(fixture('architecture'));
  graph.nodes[0].position.x = graph.nodes[1].position.x; graph.nodes[0].position.y = graph.nodes[1].position.y;
  assert.throws(() => requireDiagramQuality(graph), error => {
    assert.equal(error.phases.geometry.status, 'failed');
    assert.ok(error.diagnostics.some(item => item.elementIds.includes(graph.nodes[0].id) && item.bounds.length));
    return true;
  });
});
