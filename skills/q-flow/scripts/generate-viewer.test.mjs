import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { auditGraphLayout, cardinalityMarks, createEdgeRoutes, ER_ENDPOINT_STUB, graphBounds, layoutText, occupiedBox, pathFromPoints, visibleEdgeLabel } from '../assets/viewer/src/edge-routing.js';
import { createDiagramSvg } from '../assets/viewer/src/export-svg.js';
import { edgeColor, isCore, moduleColorMap, nodeAppearance, PALETTES, TYPOGRAPHY, themeVariables } from '../assets/viewer/src/visual-style.js';
import { RADIX } from '../assets/viewer/src/radix-colors.js';
import { graphLegend } from '../assets/viewer/src/legend.js';
import { nudgeGraphLayout } from '../assets/viewer/src/layout-nudge.js';
import { constrainNodeChanges, currentGraphFromFlow, graphInputWithEdits } from '../assets/viewer/src/session-graph.js';
import { saveGraphJson } from '../assets/viewer/src/features/download.js';
import { DIAGRAM_TYPES, validateGraph, validateGraphInput, verifySourceEvidence } from './validate-graph.mjs';
import { getDiagram, edgeMarkers, isDashed } from '../assets/viewer/src/diagrams/registry.js';
import { readingRect, readingViewport } from '../assets/viewer/src/reading-area.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const box = (id, label, kind, x, y, width = 180, height = 100, extra = {}) => ({
  id, label, kind, position: { x, y }, size: { width, height }, ...extra
});
const edge = (id, source, target, kind, extra = {}) => ({ id, source, target, kind, evidence: 'source', ...extra });
const graph = (diagramType, nodes, edges, groups = []) => ({
  meta: { title: `${diagramType} self test`, diagramType, sourceRef: 'test@local' }, groups, nodes, edges
});
const entityForTest = (id, x) => box(id, id, 'entity', x, 0, 240, 150, { fields: [{ name: 'id', type: 'bigint', key: 'PK' }] });

test('saved JSON retains edits across diagrams, preserves source data and resets only the current graph', () => {
  const input = { title: 'Collection metadata', diagrams: [fixtures.er, fixtures.architecture] };
  const before = JSON.stringify(input);
  const edited = structuredClone(fixtures.er);
  edited.nodes[0].label = 'Edited entity'; edited.nodes[0].position.x += 10;
  const current = structuredClone(fixtures.architecture);
  current.nodes[0].label = 'Edited service'; current.edges[0].label = 'Edited relation';
  const drafts = new Map([['er', edited], ['architecture', fixtures.architecture]]);
  const saved = graphInputWithEdits(input, drafts, current);
  assert.deepEqual(saved, { ...input, diagrams: [edited, current] });
  const reset = graphInputWithEdits(input, drafts, fixtures.architecture);
  assert.deepEqual(reset.diagrams, [edited, fixtures.architecture]);
  assert.deepEqual(graphInputWithEdits(fixtures.architecture, drafts, current), current);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(saved.diagrams[0].nodes[0].fields, fixtures.er.nodes[0].fields);
});

test('native JSON saving commits all graph data and preserves edits on cancellation or write failure', async () => {
  const originalWindow = globalThis.window, input = { diagrams: [fixtures.architecture, fixtures.er] };
  try {
    for (const failure of [null, 'cancel', 'write', 'close']) {
      let written, closed = false, aborted = false;
      const statuses = [];
      globalThis.window = { showSaveFilePicker: async options => {
        assert.equal(options.suggestedName, 'graph.json');
        if (failure === 'cancel') throw new DOMException('Cancelled', 'AbortError');
        return { createWritable: async () => ({
          write: async value => { if (failure === 'write') throw new Error('Disk full'); written = value; },
          close: async () => { if (failure === 'close') throw new Error('Commit failed'); closed = true; },
          abort: async () => { aborted = true; }
        }) };
      } };
      await saveGraphJson(input, 'zh-CN', value => statuses.push(value));
      assert.equal(closed, failure === null);
      assert.equal(aborted, failure === 'write' || failure === 'close');
      if (!failure) { assert.deepEqual(JSON.parse(written), input); assert.equal(statuses.at(-1), 'Graph JSON 已保存'); }
      else assert.match(statuses.at(-1), /修改仍保留/);
    }
  } finally { if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; }
});

test('both CLI paths verify real source anchors and reject invalid evidence before replacing outputs', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-evidence-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const repo = path.join(temp, 'repo with spaces'), inputPath = path.join(temp, 'graph.json'), output = path.join(temp, 'out');
  fs.mkdirSync(repo); fs.mkdirSync(path.join(repo, '目录'));
  fs.writeFileSync(path.join(repo, '目录/source.java'), '\ufeff第一行\r\n第二行\r\n');
  fs.writeFileSync(path.join(repo, 'empty.txt'), '');
  fs.writeFileSync(path.join(repo, 'binary.bin'), Buffer.from([0, 1, 2]));
  fs.writeFileSync(path.join(temp, 'outside.txt'), 'outside');
  fs.symlinkSync(path.join(temp, 'outside.txt'), path.join(repo, 'escape.txt'));
  fs.symlinkSync(path.join(repo, '目录/source.java'), path.join(repo, 'inside.txt'));
  const input = { diagrams: structuredClone([fixtures.architecture, fixtures.er]) };
  for (const item of input.diagrams) for (const node of item.nodes) node.source = { kind: 'source', file: '目录/source.java', lineStart: 1, lineEnd: 2 };
  const run = (script, args = []) => spawnSync(process.execPath, [path.join(scriptDir, script), inputPath, ...args], { cwd: temp, encoding: 'utf8' });
  fs.writeFileSync(inputPath, JSON.stringify(input));
  assert.equal(JSON.parse(run('validate-graph.mjs').stdout).sourceEvidence.status, 'skipped');
  const checked = run('validate-graph.mjs', ['--repo-root', repo]);
  assert.equal(checked.status, 0, checked.stderr);
  assert.deepEqual(JSON.parse(checked.stdout).sourceEvidence, { scope: 'working-tree', status: 'passed', references: input.diagrams.reduce((n, g) => n + g.nodes.length, 0), checked: input.diagrams.reduce((n, g) => n + g.nodes.length, 0), files: 1 });
  const generated = run('generate-viewer.mjs', [output, '--repo-root', repo]);
  assert.equal(generated.status, 0, generated.stderr);
  assert.equal(JSON.parse(generated.stdout).sourceEvidence.status, 'passed');
  const html = fs.readFileSync(path.join(output, 'index.html'));
  const model = fs.readFileSync(path.join(output, 'graph.json'));
  for (const [file, end, expected] of [
    ['missing.java', 2, /file does not exist/], ['目录/source.java', 3, /exceeds file length \(2 lines\)/],
    ['empty.txt', 1, /0 lines/], ['目录', 1, /regular file/], ['binary.bin', 1, /text file/],
    ['../outside.txt', 1, /repository-relative/], [path.join(temp, 'outside.txt'), 1, /repository-relative/],
    ['escape.txt', 1, /outside --repo-root/], ['C:\\outside.txt', 1, /repository-relative/]
  ]) {
    input.diagrams[1].nodes[0].source = { file, lineStart: 1, lineEnd: end };
    fs.writeFileSync(inputPath, JSON.stringify(input));
    for (const [script, args] of [['validate-graph.mjs', []], ['generate-viewer.mjs', [output, '--force']]]) {
      const result = run(script, [...args, '--repo-root', repo]);
      assert.equal(result.status, 1, `${script}: ${file}`); assert.match(result.stderr, expected);
      assert.match(result.stderr, /diagrams\[1\]\.nodes\[0\]\.source/);
    }
    assert.deepEqual(fs.readFileSync(path.join(output, 'index.html')), html);
    assert.deepEqual(fs.readFileSync(path.join(output, 'graph.json')), model);
  }
  input.diagrams[1].nodes[0].source = { file: 'inside.txt', lineStart: 2 };
  assert.equal(verifySourceEvidence(input, repo).files, 1);
  for (const content of ['one', 'one\n', 'one\rtwo', 'one\ntwo\n']) {
    fs.writeFileSync(path.join(repo, '目录/source.java'), content);
    const lastLine = content.includes('two') ? 2 : 1;
    for (const item of input.diagrams) for (const node of item.nodes) node.source = { file: '目录/source.java', lineStart: lastLine };
    assert.equal(verifySourceEvidence(input, repo).status, 'passed');
    input.diagrams[1].nodes[0].source.lineStart++;
    assert.throws(() => verifySourceEvidence(input, repo), /exceeds file length/);
  }
  assert.throws(() => verifySourceEvidence(input, ''), /must name a directory/);
});

test('ranks node names before details, keeps ties stable, then limits results', async () => {
  const { searchNodes } = await import('../assets/viewer/src/search.js');
  const nodes = [
    ...Array.from({ length: 9 }, (_, index) => ({ id: `fact-${index}`, label: `Other ${index}`, facts: ['leader'] })),
    { id: 'contains', label: '分区 Leader 与日志层' },
    { id: 'subtitle', label: 'Replica', subtitle: 'Leader follower' },
    { id: 'tag', label: 'Broker', tags: ['leader'] },
    { id: 'prefix', label: 'Leader 日志' },
    { id: 'exact', label: 'Leader' }
  ];
  assert.deepEqual(searchNodes(nodes, ' LEADER ').map(node => node.id), [
    'exact', 'prefix', 'contains', 'subtitle', 'tag', 'fact-0', 'fact-1', 'fact-2'
  ]);
  assert.deepEqual(searchNodes(nodes, '   '), []);
  assert.deepEqual(searchNodes(nodes, 'not-found'), []);
  for (const extra of [{ fields: [{ name: 'leaderId', type: 'string' }] }, { methods: ['getLeader()'] }, { attributes: ['leaderId'] }]) {
    assert.equal(searchNodes([{ label: 'Details', ...extra }], 'leader').length, 1);
  }
});

test('routes request and return hints through distinct bottom ports outside endpoint nodes', () => {
  const dataflow = graph('dataflow', [
    box('producer', 'Producer', 'process', 40, 90, 240, 76),
    box('log', 'Log', 'dataStore', 400, 90, 240, 76),
    box('consumer', 'Consumer', 'process', 760, 90, 240, 76)
  ], [
    edge('produce', 'producer', 'log', 'data'),
    edge('result', 'log', 'producer', 'data', { label: 'result', route: { via: [{ x: 520, y: 202 }, { x: 160, y: 202 }] } }),
    edge('fetch', 'consumer', 'log', 'data', { route: { via: [{ x: 880, y: 202 }, { x: 560, y: 202 }] } }),
    edge('records', 'log', 'consumer', 'data')
  ]);
  assert.deepEqual(validateGraph(dataflow), []);
  const routes = createEdgeRoutes(dataflow);
  assert.equal(routes.get('result').sourceSide, 'bottom');
  assert.equal(routes.get('result').targetSide, 'bottom');
  assert.deepEqual(routes.get('result').points, [{ x: 520, y: 166 }, { x: 520, y: 202 }, { x: 160, y: 202 }, { x: 160, y: 166 }]);
  assert.deepEqual(routes.get('fetch').points.at(-1), { x: 560, y: 166 });
  assert.notDeepEqual(routes.get('result').points[0], routes.get('fetch').points.at(-1));
  const svg = createDiagramSvg(dataflow);
  const [startX, startY, bottomY, endX, endY] = exportedEdgePath(svg, 'result').match(/-?\d+(?:\.\d+)?/g).map(Number);
  assert.deepEqual([bottomY - startY, endX - startX, endY - startY], [36, -360, 0]);
});

test('rejects hinted paths crossing either endpoint, including collinear backtracking', () => {
  for (const [id, x] of [['source', 90], ['target', 490]]) {
    const invalid = graph('architecture', [
      box('source', 'Source', 'service', 0, 0), box('target', 'Target', 'service', 400, 0)
    ], [edge('request', 'source', 'target', 'request', { route: { via: [{ x, y: 50 }] } })]);
    assert.match(validateGraph(invalid).join('\n'), new RegExp(`layout: edge request crosses node ${id}`));
  }
});

test('anchors input and output routes on their slanted sides, including self returns', () => {
  for (const kind of ['input', 'output']) {
    for (const side of ['left', 'right']) {
      for (const y of [120, 200, 280]) {
        const diagram = graph('flowchart', [
          box('caller', 'Caller', 'process', side === 'left' ? 20 : 1100, y - 50),
          box('slanted', 'Slanted', kind, 500, 100, 300, 200)
        ], [edge('into', 'caller', 'slanted', 'flow', { route: { via: [{ x: side === 'left' ? 488 : 812, y }] } })]);
        const x = side === 'left' ? 500 + 36 * (1 - (y - 100) / 200) : 800 - 36 * ((y - 100) / 200);
        const route = createEdgeRoutes(diagram).get('into');
        assert.ok(Math.abs(route.points.at(-1).x - x) < 1e-7);
        assert.equal(route.points.at(-1).y, y);
        assert.deepEqual(validateGraph(diagram), []);

        diagram.edges = [edge('out', 'slanted', 'caller', 'flow', { route: diagram.edges[0].route })];
        assert.ok(Math.abs(createEdgeRoutes(diagram).get('out').points[0].x - x) < 1e-7);
        assert.deepEqual(validateGraph(diagram), []);
      }
    }
    const self = graph('flowchart', [box('slanted', 'Slanted', kind, 100, 100, 300, 200)], [edge('self', 'slanted', 'slanted', 'flow')]);
    const route = createEdgeRoutes(self).get('self');
    assert.ok(route.points[0].x > route.points.at(-1).x, 'self-loop endpoints follow the right slant');
    assert.deepEqual(validateGraph(self), []);
  }
});

test('checks the actual parallelogram interior without exempting endpoint nodes', () => {
  for (const kind of ['input', 'output']) {
    const corner = graph('flowchart', [
      box('a', 'A', 'process', 0, 0), box('b', 'B', 'process', 900, 0),
      box('obstacle', 'Slanted', kind, 500, 100, 300, 200)
    ], [edge('around', 'a', 'b', 'flow', { route: { via: [{ x: 400, y: 120 }, { x: 510, y: 120 }, { x: 510, y: 50 }, { x: 888, y: 50 }] } })]);
    assert.deepEqual(validateGraph(corner), [], 'the clipped top-left corner is outside the shape');
    for (const via of [
      [{ x: 400, y: 120 }, { x: 550, y: 120 }, { x: 550, y: 50 }],
      [{ x: 510, y: 320 }, { x: 510, y: 260 }, { x: 888, y: 260 }]
    ]) {
      const crossing = structuredClone(corner);
      crossing.edges[0].route.via = via;
      assert.match(validateGraph(crossing).join('\n'), /edge around crosses node obstacle/);
    }
    for (const [id, x] of [['source', 150], ['target', 650]]) {
      const crossing = graph('flowchart', [
        box('source', 'Source', kind, 0, 0, 300, 200), box('target', 'Target', kind, 500, 0, 300, 200)
      ], [edge('crossing', 'source', 'target', 'flow', { route: { via: [{ x, y: 100 }] } })]);
      assert.match(validateGraph(crossing).join('\n'), new RegExp(`edge crossing crosses node ${id}`));
    }
  }
});

test('exports the same twelve-percent slant and bottom return route as the page', () => {
  const diagram = graph('flowchart', [
    box('input', 'Input', 'input', 40, 100, 300, 200),
    box('output', 'Output', 'output', 700, 100, 340, 220)
  ], [
    edge('request', 'input', 'output', 'flow', { label: 'request' }),
    edge('return', 'output', 'input', 'flow', { label: 'return', route: { via: [{ x: 870, y: 380 }, { x: 190, y: 380 }] } })
  ]);
  assert.deepEqual(validateGraph(diagram), []);
  const routes = createEdgeRoutes(diagram);
  assert.deepEqual(routes.get('return').points, [{ x: 870, y: 320 }, { x: 870, y: 380 }, { x: 190, y: 380 }, { x: 190, y: 300 }]);
  const svg = createDiagramSvg(diagram);
  const polygons = [...svg.matchAll(/<polygon points="([^"]+)"/g)].map(match => match[1].split(' ').map(point => {
    const [x, y] = point.split(',').map(Number);
    return { x, y };
  }));
  assert.equal(polygons.length, 2);
  for (const [index, points] of polygons.entries()) {
    const width = diagram.nodes[index].size.width;
    assert.ok(Math.abs(points[0].x - points[3].x - width * .12) < 1e-7);
    assert.ok(Math.abs(points[1].x - points[2].x - width * .12) < 1e-7);
  }
  const offsetX = polygons[0][3].x - 40;
  const offsetY = polygons[0][0].y - 100;
  for (const id of ['request', 'return']) assert.equal(exportedEdgePath(svg, id), pathFromPoints(routes.get(id).points, offsetX, offsetY));
});

function exportedEdgePath(svg, label) {
  const group = svg.split('</g>').find(fragment => fragment.includes(`>${label}</text>`));
  assert.ok(group, `missing exported edge label: ${label}`);
  return group.match(/<path d="([^"]+)" fill="none" stroke=/)?.[1];
}

export const fixtures = {
  architecture: graph('architecture', [
    box('a', 'Caller', 'external', 0, 0), box('b', 'Service', 'service', 260, 0)
  ], [edge('a-b', 'a', 'b', 'call', { label: 'call' })]),
  flowchart: graph('flowchart', [
    box('start', 'Start', 'start', 0, 0, 130, 70), box('decision', 'Valid?', 'decision', 220, 0, 130, 110), box('end', 'End', 'end', 440, 0, 130, 70)
  ], [edge('to-decision', 'start', 'decision', 'flow'), edge('to-end', 'decision', 'end', 'yes')]),
  sequence: graph('sequence', [
    box('browser', 'Browser', 'actor', 0, 0, 140, 360), box('api', 'Order API', 'service', 260, 0, 180, 360)
  ], [edge('request', 'browser', 'api', 'sync', { label: 'POST /orders', order: 1 })]),
  er: graph('er', [
    box('users', 'users', 'entity', 0, 0, 240, 130, { fields: [{ name: 'id', type: 'bigint', key: 'PK', nullable: false }] }),
    box('orders', 'orders', 'entity', 400, 0, 240, 160, { fields: [{ name: 'id', type: 'bigint', key: 'PK' }, { name: 'user_id', type: 'bigint', key: 'FK' }] })
  ], [edge('user-orders', 'users', 'orders', 'relationship', { sourceCardinality: '1', targetCardinality: '0..*' })]),
  deployment: graph('deployment', [
    box('host', 'Application host', 'device', 80, 80, 180, 130), box('api', 'Order API', 'container', 340, 80)
  ], [edge('deploy', 'host', 'api', 'deploy')], [{ id: 'cluster', label: 'Production cluster', kind: 'cluster', position: { x: 20, y: 20 }, size: { width: 560, height: 260 } }]),
  class: graph('class', [
    box('port', 'OrderPort', 'interface', 0, 0, 220, 150, { methods: ['+ create(command): Order'] }),
    box('service', 'OrderService', 'class', 440, 0, 240, 190, { attributes: ['- repository: OrderRepository'], methods: ['+ create(command): Order'] })
  ], [edge('implements', 'service', 'port', 'implementation')]),
  state: graph('state', [
    box('initial', 'Initial', 'initial', 0, 20, 50, 50), box('pending', 'Pending', 'state', 150, 0, 180, 90), box('final', 'Final', 'final', 430, 20, 50, 50)
  ], [edge('begin', 'initial', 'pending', 'transition'), edge('finish', 'pending', 'final', 'transition', { guard: 'paid' })]),
  usecase: graph('usecase', [
    box('buyer', 'Buyer', 'actor', 0, 80, 100, 120), box('pay', 'Pay order', 'usecase', 280, 90, 200, 90)
  ], [edge('uses', 'buyer', 'pay', 'association')], [{ id: 'system', label: 'Payment system', kind: 'system', position: { x: 200, y: 20 }, size: { width: 380, height: 260 } }]),
  dataflow: graph('dataflow', [
    box('client', 'Client', 'external', 0, 0), box('verify', 'Verify payment', 'process', 340, 0), box('ledger', 'Ledger', 'dataStore', 680, 0)
  ], [edge('request', 'client', 'verify', 'data', { label: 'payment request' }), edge('entry', 'verify', 'ledger', 'data', { label: 'ledger entry' })])
};

test('uses visible sequence heads for interaction without changing authored lifelines', () => {
  const ordinary = box('ordinary', 'Ordinary', 'service', 10, 20, 180, 360);
  const participant = box('participant', 'Participant', 'participant', 10, 20, 180, 960);
  const actor = box('actor', 'Actor', 'actor', 10, 20, 180, 960);
  const before = structuredClone([ordinary, participant, actor]);
  assert.deepEqual(occupiedBox(ordinary, 'architecture'), { x: 10, y: 20, width: 180, height: 360 });
  assert.deepEqual(occupiedBox(participant, 'sequence'), { x: 10, y: 20, width: 180, height: 72 });
  assert.deepEqual(occupiedBox(actor, 'sequence'), { x: 10, y: 20, width: 180, height: 108 });
  assert.deepEqual([ordinary, participant, actor], before, 'interaction bounds do not shorten lifelines');
});

test('reading area clears actual visible bottom controls', () => {
  const boxes = [{ top: 806, width: 28, height: 112 }, { top: 840, width: 112, height: 78 }];
  const canvas = { clientWidth: 1440, clientHeight: 900, getBoundingClientRect: () => ({ top: 30 }),
    querySelectorAll: () => boxes.map(box => ({ getBoundingClientRect: () => box })) };
  assert.equal(readingRect(canvas, true, true).bottom, 764, '112px controls plus 12px clearance determine the reading bottom');
  boxes[0] = { top: 0, width: 0, height: 0 };
  assert.equal(readingRect(canvas, true, true).bottom, 798, 'hidden controls do not contribute; the visible minimap still does');
});

test('keeps, pans, shrinks and falls back within the sequence reading area', () => {
  const area = { left: 0, top: 0, right: 500, bottom: 400, width: 500, height: 400 };
  const inside = { x: 100, y: 100, zoom: 1 };
  assert.equal(readingViewport({ x: 0, y: 0, width: 200, height: 100 }, area, inside), inside);
  assert.deepEqual(readingViewport({ x: 0, y: 0, width: 200, height: 100 }, area, { x: 450, y: 100, zoom: 1 }), { x: 300, y: 100, zoom: 1 });
  assert.deepEqual(readingViewport({ x: 0, y: 0, width: 1000, height: 500 }, area, { x: 0, y: 0, zoom: 1 }), { x: 0, y: 75, zoom: .5 });
  const priority = { x: 9000, y: 0, width: 100, height: 72 };
  const fallback = readingViewport({ x: 0, y: 0, width: 10000, height: 10000 }, area, { x: 0, y: 0, zoom: 1 }, priority);
  assert.equal(fallback.zoom, .08);
  assert.ok(Math.abs((priority.x + priority.width / 2) * fallback.zoom + fallback.x - 250) < 1e-7);
  assert.ok(Math.abs((priority.y + priority.height / 2) * fallback.zoom + fallback.y - 200) < 1e-7);
});

test('derives session text and positions without mutating the authored graph, then resets exactly', () => {
  const authored = structuredClone(fixtures.flowchart), before = structuredClone(authored);
  const initialNodes = authored.nodes.map(node => ({ id: node.id, type: 'diagram', position: node.position, data: { ...node } }));
  const initialEdges = authored.edges.map(edge => ({ id: edge.id, data: { ...edge } }));
  const nodes = initialNodes.map(node => node.id === 'decision' ? {
    ...node, position: { x: 310, y: 44 }, data: { ...node.data, label: 'Risk approved?', subtitle: 'session only' }
  } : node);
  const edges = initialEdges.map(item => item.id === 'to-end' ? { ...item, data: { ...item.data, label: 'approved' } } : item);
  const current = currentGraphFromFlow(authored, nodes, edges);
  assert.equal(current.nodes.find(node => node.id === 'decision').label, 'Risk approved?');
  assert.equal(current.nodes.find(node => node.id === 'decision').position.x, 310);
  assert.equal(current.edges.find(item => item.id === 'to-end').label, 'approved');
  assert.deepEqual(authored, before, 'author input stays immutable');
  assert.deepEqual(currentGraphFromFlow(authored, initialNodes, initialEdges), authored);
});

test('keeps sequence dragging horizontal and recomputes the shared route after movement', () => {
  const sequenceNodes = fixtures.sequence.nodes.map(node => ({ id: node.id, type: 'diagram', position: node.position, data: { ...node } }));
  const constrained = constrainNodeChanges([{ id: 'browser', type: 'position', position: { x: 120, y: 240 }, dragging: true }], sequenceNodes, 'sequence');
  assert.deepEqual(constrained[0].position, { x: 120, y: 0 });
  assert.deepEqual(constrainNodeChanges([{ id: 'decision', type: 'position', position: { x: 300, y: 80 } }], [], 'flowchart')[0].position, { x: 300, y: 80 });

  const moved = structuredClone(fixtures.flowchart);
  moved.edges.find(item => item.id === 'to-decision').label = 'moved route';
  const before = createEdgeRoutes(moved).get('to-decision');
  const beforeExport = exportedEdgePath(createDiagramSvg(moved), 'moved route');
  moved.nodes.find(node => node.id === 'decision').position.x += 80;
  const after = createEdgeRoutes(moved).get('to-decision');
  assert.notDeepEqual(after.points, before.points);
  assert.notEqual(exportedEdgePath(createDiagramSvg(moved), 'moved route'), beforeExport, 'export uses the moved route too');
});

test('validates and renders every supported diagram type', () => {
  assert.deepEqual(Object.keys(fixtures), DIAGRAM_TYPES);
  for (const [type, fixture] of Object.entries(fixtures)) {
    assert.deepEqual(validateGraph(fixture), [], type);
    const svg = createDiagramSvg(fixture);
    assert.match(svg, /<svg[\s>]/, type);
    assert.match(svg, new RegExp(`${type} diagram`), type);
  }
});

test('uses D3 to clear local node collisions for every diagram type', () => {
  for (const [type, fixture] of Object.entries(fixtures)) {
    const crowded = structuredClone(fixture);
    const [first, second] = crowded.nodes;
    second.position = { x: first.position.x + first.size.width - 40, y: first.position.y };
    const result = nudgeGraphLayout(crowded);
    const [movedFirst, movedSecond] = result.graph.nodes;
    const horizontalGap = Math.max(
      movedFirst.position.x - movedSecond.position.x - movedSecond.size.width,
      movedSecond.position.x - movedFirst.position.x - movedFirst.size.width
    );
    const verticalGap = Math.max(
      movedFirst.position.y - movedSecond.position.y - movedSecond.size.height,
      movedSecond.position.y - movedFirst.position.y - movedFirst.size.height
    );
    assert.ok(horizontalGap >= 64 || verticalGap >= 64, `${type} must restore 64px clearance`);
    if (type === 'sequence') assert.equal(movedSecond.position.y, second.position.y, 'sequence participants must keep their authored row');
  }
});

test('limits focused D3 nudging to the selected node and its one-hop neighbors', () => {
  const local = graph('architecture', [
    box('selected', 'Selected', 'service', 200, 100),
    box('neighbor', 'Neighbor', 'service', 340, 100),
    box('unrelated', 'Unrelated', 'service', 700.25, 100.75)
  ], [edge('selected-neighbor', 'selected', 'neighbor', 'call')]);

  const result = nudgeGraphLayout(local, 'selected');
  assert.ok(result.movedNodeIds.some(id => id === 'selected' || id === 'neighbor'));
  assert.equal(result.graph.nodes.find(node => node.id === 'unrelated'), local.nodes[2]);
  assert.ok(!result.movedNodeIds.includes('unrelated'));
});

test('nudging preserves tight and nested group containment, including fractional bounds', () => {
  for (const width of [110, 126.2, 250]) {
    const selected = box('selected', 'Selected', 'service', 150.25, 200.75, 100, 80);
    const inner = box('inner', 'Inner', 'runtime', 145.2, 145.4, width, width + 40);
    const outer = box('outer', 'Outer', 'runtime', 50, 50, 500, 500);
    const local = graph('architecture', [selected, box('outside', 'Outside', 'service', 260, 200, 100, 80)], [], [outer, inner]);
    const result = nudgeGraphLayout(local, selected.id);
    const moved = result.graph.nodes[0];
    assert.ok(moved.position.x >= inner.position.x && moved.position.y >= inner.position.y);
    assert.ok(moved.position.x + moved.size.width <= inner.position.x + inner.size.width);
    assert.ok(moved.position.y + moved.size.height <= inner.position.y + inner.size.height);
    assert.ok(Math.abs(moved.position.x - selected.position.x) <= 156 && Math.abs(moved.position.y - selected.position.y) <= 156);
    if (width === 110) assert.equal(moved, selected, 'An infeasible inset keeps the original node');
    assert.equal(result.graph.nodes[1], local.nodes[1]);
  }
});

test('rejects malformed containers and shared render fields before layout or generation', t => {
  for (const [field, value] of [
    ['meta', null], ['meta.scope', {}], ['meta.subtitle', []],
    ['nodes', {}], ['edges', {}], ['groups', {}],
    ['nodes', [null, null]], ['edges', [null, null]], ['groups', [null, null]],
    ['nodes.0.subtitle', {}], ['nodes.0.source', []],
    ['nodes.0.source', { file: 'a.js', lineStart: 1, symbol: {} }],
    ['nodes.0.source', { file: 'a.js', lineStart: { toString: null }, lineEnd: 2 }],
    ['nodes.0.fields', {}], ['nodes.0.fields', [null]], ['nodes.0.fields', [{ name: 'id', type: {} }]],
    ['nodes.0.attributes', 'id'], ['nodes.0.methods', [{}]], ['edges.0.label', {}],
    ['edges.0.source', { toString: null }], ['edges.0.target', { toString: null }]
  ]) {
    const invalid = structuredClone(fixtures.architecture), parts = field.split('.');
    const owner = parts.slice(0, -1).reduce((object, key) => object[key], invalid);
    owner[parts.at(-1)] = value;
    assert.ok(validateGraph(invalid).length > 0, field);
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-invalid-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const input = path.join(root, 'input.json'), output = path.join(root, 'out');
  fs.writeFileSync(input, JSON.stringify({ ...fixtures.architecture, nodes: {} }));
  const result = spawnSync(process.execPath, [path.join(scriptDir, 'generate-viewer.mjs'), input, output], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid graph:[\s\S]*nodes must be a non-empty array/);
  assert.equal(fs.existsSync(output), false);
});

test('keeps legacy architecture graphs valid', () => {
  const legacy = structuredClone(fixtures.architecture);
  delete legacy.meta.diagramType;
  assert.deepEqual(validateGraph(legacy), []);
});

test('accepts semantic module ids, rejects blank modules, and keeps them optional', () => {
  const graph = structuredClone(fixtures.architecture);
  graph.nodes[0].module = 'Checkout';
  graph.edges[0].module = 'Checkout';
  assert.deepEqual(validateGraph(graph), []);
  for (const [item, label] of [[graph.nodes[0], 'nodes[0].module'], [graph.edges[0], 'edges[0].module']]) {
    item.module = '   ';
    assert.ok(validateGraph(graph).includes(`${label} must be a non-empty string`));
    delete item.module;
  }
  assert.deepEqual(validateGraph(graph), []);
});

test('validates graph collections and tolerates unused legacy playback metadata', () => {
  const architecture = structuredClone(fixtures.architecture);
  architecture.playback = { edgeIds: ['a-b'] };
  const collection = { diagrams: [architecture, structuredClone(fixtures.flowchart)] };
  assert.deepEqual(validateGraphInput(collection), []);

  const duplicateType = { diagrams: [architecture, structuredClone(architecture)] };
  assert.match(validateGraphInput(duplicateType).join('\n'), /diagramType duplicates architecture/);

  architecture.playback.edgeIds = ['missing'];
  assert.deepEqual(validateGraphInput({ diagrams: [architecture] }), []);
  assert.match(validateGraphInput({ diagrams: [] }).join('\n'), /diagrams must contain between 1 and 9 graphs/);
  assert.match(validateGraphInput({ diagrams: Array(10).fill(fixtures.architecture) }).join('\n'), /diagrams must contain between 1 and 9 graphs/);
});

test('preserves complete export labels and UML composition markers', () => {
  const longLabel = 'Caller with a deliberately long label that must remain complete in downloads';
  const architecture = structuredClone(fixtures.architecture);
  architecture.nodes[0].label = longLabel;
  architecture.nodes[0].size = { width: 420, height: 240 };
  architecture.nodes[1].position.x = 1200;
  architecture.nodes[1].source = { file: 'src/main/java/example/with/a/very/long/package/ServiceImplementation.java', lineStart: 42 };
  const architectureSvg = createDiagramSvg(architecture);
  assert.match(architectureSvg, new RegExp(longLabel));
  assert.doesNotMatch(architectureSvg, /textLength=/);
  assert.doesNotMatch(architectureSvg, /…/);
  assert.doesNotMatch(architectureSvg, /src\/main\/java\/example/);
  const height = Number(architectureSvg.match(/<svg[^>]+height="([\d.]+)"/)[1]);
  for (const match of architectureSvg.matchAll(/<text[^>]+y="([\d.]+)"/g)) assert.ok(Number(match[1]) <= height, 'visible text must remain inside the SVG');

  const classDiagram = structuredClone(fixtures.class);
  classDiagram.edges[0].kind = 'composition';
  const classSvg = createDiagramSvg(classDiagram);
  assert.match(classSvg, /marker-start="url\(#diamond-filled\)"/);
  assert.doesNotMatch(classSvg, /marker-end="url\(#arrow\)" marker-start="url\(#diamond-filled\)"/);
});

test('separates parallel transitions and routes self transitions outside the node', () => {
  const state = graph('state', [
    box('initial', 'Initial', 'initial', 0, 20, 50, 50),
    box('pending', 'Pending', 'state', 150, 0, 180, 90)
  ], [
    edge('begin-primary', 'initial', 'pending', 'transition', { label: 'primary transition' }),
    edge('begin-fallback', 'initial', 'pending', 'transition', { label: 'fallback transition' }),
    edge('retry', 'pending', 'pending', 'transition', { label: 'retry transition' })
  ]);

  const svg = createDiagramSvg(state);
  assert.notEqual(exportedEdgePath(svg, 'primary transition'), exportedEdgePath(svg, 'fallback transition'));
  const route = createEdgeRoutes(state).get('retry');
  const path = exportedEdgePath(svg, 'retry transition');
  const [x, y] = path.match(/^M ([\d.]+) ([\d.]+)/).slice(1).map(Number);
  assert.equal(path, pathFromPoints(route.points, x - route.points[0].x, y - route.points[0].y));
});

test('exports the React Flow UI board in light and dark themes', () => {
  const light = createDiagramSvg(fixtures.architecture);
  assert.doesNotMatch(light, /product-grid/);
  assert.ok(light.includes(`fill="${PALETTES.light.paper}"`));
  assert.ok(light.includes(`fill="${PALETTES.light.surface}"`));
  assert.match(light, /fill="#fcfcfd"/); assert.doesNotMatch(light, /fill="#ffffff"/);
  assert.ok(light.includes(`stroke="${PALETTES.light.rule}"`));
  assert.match(light, /rx="16"/);
  assert.doesNotMatch(light, /linearGradient/);
  assert.doesNotMatch(light, /<path d="[^"]* C /);

  const dark = createDiagramSvg(fixtures.architecture, 'dark');
  assert.ok(dark.includes(`fill="${PALETTES.dark.paper}"`));
  assert.ok(dark.includes(`fill="${PALETTES.dark.surface2}"`));
  assert.ok(dark.includes(`stroke="${PALETTES.dark.rule}"`));

  const semantic = structuredClone(fixtures.architecture);
  semantic.edges[0].kind = 'success';
  assert.match(createDiagramSvg(semantic), new RegExp(`stroke="${PALETTES.light.accent}"[^>]+marker-end="url\\(#arrow-ok\\)"`));
});

test('legend uses only actual semantic appearances and core colors stay light with readable text', () => {
  const model = graph('dataflow', [box('core', 'Core', 'dataStore', 0, 0, 180, 100, { tags: [' CORE '] }), box('store', 'Store', 'dataStore', 400, 0), box('plain', 'Plain', 'process', 800, 0)], [edge('data', 'core', 'store', 'data')]);
  for (const palette of Object.values(PALETTES)) {
    const legend = graphLegend(model, palette);
    assert.deepEqual(legend.filter(entry => entry.role).map(entry => entry.role), ['core', 'data', 'neutral']);
    for (const node of model.nodes) {
      const appearance = nodeAppearance(node, palette), entry = legend.find(entry => entry.role === appearance.role);
      assert.equal(entry.fill, appearance.fill); assert.equal(entry.stroke, appearance.stroke);
    }
    const svg = createDiagramSvg(model, palette === PALETTES.light ? 'light' : 'dark');
    assert.ok(svg.includes(`fill="${palette.hero}"`)); assert.ok(svg.includes(`stroke="${palette.heroBorder}"`));
    assert.match(svg, /MIT License/); assert.match(svg, /WorkOS/);
  }
  assert.deepEqual([PALETTES.light.hero, PALETTES.light.heroBorder, PALETTES.light.heroInk], [RADIX.light.accent[3], RADIX.light.accent[8], RADIX.light.accent[12]]);
  assert.deepEqual([PALETTES.light.hero, PALETTES.light.heroBorder, PALETTES.light.heroInk], ['#f0f1fe', '#9b9ef0', '#272962']);
  const luminance = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  for (const palette of Object.values(PALETTES)) {
    const values = [luminance(palette.hero), luminance(palette.heroInk)].sort((a, b) => a - b);
    assert.ok((values[1] + .05) / (values[0] + .05) >= 4.5, 'Core text has readable contrast in both themes.');
  }
});

test('maps the first eight modules to stable distinct light and dark accent slots', () => {
  const modules = ['渠道', '结算', '价格', '库存', '风控', '支付', '订单', '履约'];
  const collection = modules.map((module, index) => graph('architecture', [box(`n${index}`, module, 'service', index * 240, 0, 180, 100, { module })], []));
  const reversed = [...collection].reverse();
  for (const theme of ['light', 'dark']) {
    const map = moduleColorMap(collection, PALETTES[theme]);
    assert.equal(new Set(map.values()).size, 8);
    assert.deepEqual([...map], [...moduleColorMap(reversed, PALETTES[theme])], 'view order must not change module slots');
    assert.deepEqual([...map.keys()], [...map.keys()].sort());
  }
  const light = moduleColorMap(collection, PALETTES.light), dark = moduleColorMap(collection, PALETTES.dark);
  assert.deepEqual([...light.keys()], [...dark.keys()], 'theme changes tones, not module slots');
  assert.deepEqual(Object.fromEntries(light), {
    '价格': '#8b5cf6', '履约': '#b14b7d', '库存': '#0f8f83', '支付': '#2474d2',
    '渠道': '#6b7280', '结算': '#5753d7', '订单': '#348052', '风控': '#c26a17'
  }, 'The ecommerce modules keep the reviewed demo palette.');
  assert.equal(createDiagramSvg(fixtures.architecture), createDiagramSvg(fixtures.architecture, 'light', new Map()), 'legacy graphs remain visually unchanged');
});

test('shares module accents across nodes, edges, legend, minimap data and light/dark SVG export', () => {
  const model = graph('architecture', [
    box('checkout', 'Checkout', 'business', 0, 0, 220, 120, { module: '结算', tags: ['core'] }),
    box('order', 'Order', 'data', 420, 0, 220, 120, { module: '订单' })
  ], [
    edge('create', 'checkout', 'order', 'call', { label: 'create' }),
    edge('fail', 'order', 'checkout', 'failure', { label: 'fail', module: '订单', route: { via: [{ x: 530, y: 180 }, { x: 110, y: 180 }] } })
  ]);
  for (const theme of ['light', 'dark']) {
    const palette = PALETTES[theme], colors = moduleColorMap([model], palette);
    const checkoutColor = colors.get('结算');
    const checkoutAppearance = nodeAppearance(model.nodes[0], palette, colors);
    assert.equal(checkoutAppearance.moduleColor, checkoutColor);
    assert.equal(checkoutAppearance.stroke, checkoutColor, 'Module color owns the full node outline.');
    assert.notEqual(checkoutAppearance.fill, palette.hero, 'Module color owns the full node tint instead of a restrained dot.');
    assert.equal(edgeColor(model.edges[0], model.nodes[1], palette, colors, model.nodes[0]), checkoutColor);
    assert.equal(edgeColor(model.edges[1], model.nodes[0], palette, colors, model.nodes[1]), palette.warn, 'failure semantics win over modules');
    assert.equal(graphLegend(model, palette, colors).filter(item => item.role === 'module').length, 2);
    const svg = createDiagramSvg(model, theme, colors);
    assert.ok(svg.includes(`class="module-accent"`));
    assert.ok(svg.includes(`fill="${checkoutAppearance.fill}"`));
    assert.match(svg, new RegExp(`class="module-accent"[^>]+stroke="${checkoutColor}"`));
    assert.match(svg, new RegExp(`stroke="${checkoutColor}"[^>]+marker-end="url\\(#arrow-module\\)"`));
  }
});

test('generates only index.html and graph.json', () => {
  const fixture = fixtures.architecture;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-flow-'));
  const input = path.join(root, 'graph.json');
  const output = path.join(root, 'out');
  fs.writeFileSync(input, JSON.stringify(fixture));
  const result = spawnSync(process.execPath, [path.join(scriptDir, 'generate-viewer.mjs'), input, output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readdirSync(output).sort(), ['graph.json', 'index.html']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, 'graph.json'), 'utf8')), fixture);
  const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  assert.match(html, /<title>QGraphFlow<\/title>/);
  assert.doesNotMatch(html, /CODEGRAPH FLOW/);
  assert.match(html, /architecture self test/);
  assert.match(html, /SVG/);
  assert.match(html, /PNG/);
  assert.match(html, /布局/);
  assert.match(html, /深色/);
  assert.match(html, /浅色/);
  assert.match(html, /content="light dark"/);
  assert.doesNotMatch(html, /__CODEGRAPH_FLOW_DATA__/);
  const notices = fs.readFileSync(new URL('../../../THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8').trim();
  assert.ok(html.includes(notices), 'Generated HTML must retain the complete third-party notices');
});

test('preserves replacement metacharacters and script delimiters in embedded JSON', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-embedded-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = structuredClone(fixtures.architecture);
  fixture.nodes[0].facts = ['$$', "$'", '$`', '$&', '</script><script>alert(1)</script>', '\u2028\u2029 中文'];
  const input = path.join(root, 'input.json'), output = path.join(root, 'out');
  fs.writeFileSync(input, JSON.stringify(fixture));
  const result = spawnSync(process.execPath, [path.join(scriptDir, 'generate-viewer.mjs'), input, output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  const embedded = html.match(/<script\b[^>]*id="graph-data"[^>]*>([\s\S]*?)<\/script>/)[1];
  assert.deepEqual(JSON.parse(embedded), fixture);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, 'graph.json'), 'utf8')), fixture);
});

test('preserves authored old names and explicit legacy output paths', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-flow-rename-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = structuredClone(fixtures.architecture);
  delete fixture.meta.diagramType;
  fixture.meta.title = 'CodeGraph Flow migration';
  fixture.meta.sourceRef = 'CodeGraph · docs/codegraph-flow/original';
  fixture.nodes[0].label = 'CodeGraph Flow';
  fixture.nodes[0].size.height = 130;
  fixture.nodes[0].facts = ['Use codegraph with the existing .codegraph/ index'];
  const input = path.join(root, 'input.json');
  const output = path.join(root, 'docs/codegraph-flow/legacy-architecture');
  fs.writeFileSync(input, JSON.stringify(fixture));
  const args = [path.join(scriptDir, 'generate-viewer.mjs'), input, output];
  const generated = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stderr);
  assert.equal(JSON.parse(generated.stdout).outputDir, output);
  assert.deepEqual(fs.readdirSync(output).sort(), ['graph.json', 'index.html']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, 'graph.json'), 'utf8')), fixture);
  const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  assert.match(html, /<title>QGraphFlow<\/title>/);
  const embedded = html.match(/<script\b[^>]*id="graph-data"[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(embedded, 'Generated HTML contains its original graph data.');
  assert.deepEqual(JSON.parse(embedded[1]), fixture);
  const refused = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /Refusing to overwrite/);
  assert.equal(fs.readFileSync(path.join(output, 'index.html'), 'utf8'), html);
  const forced = spawnSync(process.execPath, [...args, '--force'], { encoding: 'utf8' });
  assert.equal(forced.status, 0, forced.stderr);
  assert.equal(fs.readFileSync(path.join(output, 'index.html'), 'utf8'), html);
});

test('generates a graph collection with aggregate metadata', () => {
  const collection = { diagrams: [fixtures.architecture, fixtures.flowchart] };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-flow-collection-'));
  const input = path.join(root, 'graph.json');
  const output = path.join(root, 'out');
  fs.writeFileSync(input, JSON.stringify(collection));
  const result = spawnSync(process.execPath, [path.join(scriptDir, 'generate-viewer.mjs'), input, output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.deepEqual(summary.diagramTypes, ['architecture', 'flowchart']);
  assert.equal(summary.diagrams, 2);
  assert.equal(summary.nodes, fixtures.architecture.nodes.length + fixtures.flowchart.nodes.length);
  assert.match(fs.readFileSync(path.join(output, 'index.html'), 'utf8'), /"diagrams"/);
});

test('removes the legacy snapshot only with force', () => {
  const fixture = fixtures.architecture;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-flow-legacy-'));
  const input = path.join(root, 'input.json');
  const output = path.join(root, 'out');
  fs.mkdirSync(output);
  fs.writeFileSync(input, JSON.stringify(fixture));
  fs.writeFileSync(path.join(output, 'snapshot.svg'), '<svg/>');
  const args = [path.join(scriptDir, 'generate-viewer.mjs'), input, output];
  const refused = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /Refusing to remove legacy snapshot.svg/);
  const forced = spawnSync(process.execPath, [...args, '--force'], { encoding: 'utf8' });
  assert.equal(forced.status, 0, forced.stderr);
  assert.deepEqual(fs.readdirSync(output).sort(), ['graph.json', 'index.html']);
});

test('rejects invalid endpoints and diagram-specific notation', () => {
  const endpoint = structuredClone(fixtures.architecture);
  endpoint.edges[0].target = 'missing';
  assert.match(validateGraph(endpoint).join('\n'), /does not name a node/);

  const sequence = structuredClone(fixtures.sequence);
  sequence.edges.push(edge('duplicate-order', 'api', 'browser', 'return', { label: 'response', order: 1 }));
  assert.match(validateGraph(sequence).join('\n'), /order duplicates 1/);

  const er = structuredClone(fixtures.er);
  delete er.edges[0].targetCardinality;
  assert.match(validateGraph(er).join('\n'), /targetCardinality is unsupported/);
});

test('accepts optional route hints and rejects invalid route coordinates', () => {
  const routed = structuredClone(fixtures.architecture);
  routed.edges[0].route = {
    via: [{ x: 220, y: 50 }, { x: 220, y: 140 }],
    labelAt: { x: 220, y: 140 }
  };
  assert.deepEqual(validateGraph(routed), []);

  routed.edges[0].route.via[0].x = '220';
  assert.match(validateGraph(routed).join('\n'), /route\.via\[0\]\.x must be a non-negative finite number/);
});

test('fits routed lines and labels outside node bounds using the same extent as SVG export', () => {
  const routed = graph('architecture', [
    box('ready', 'Ready', 'service', 100, 100, 240, 100),
    box('committing', 'Committing', 'service', 100, 460, 240, 100)
  ], [edge('return', 'committing', 'ready', 'call', {
    label: 'return',
    route: { via: [{ x: 700, y: 510 }, { x: 700, y: 150 }, { x: 390, y: 150 }], labelAt: { x: 760, y: 300 } }
  })], [box('boundary', 'Runtime', 'runtime', 40, 40, 380, 580)]);
  assert.deepEqual(validateGraph(routed), []);
  const bounds = graphBounds(routed);
  assert.deepEqual(bounds, { x: 40, y: 40, width: 753.5, height: 580 });
  assert.ok(bounds.x + bounds.width > 700, 'fit includes the label beyond the outer route');
  assert.match(createDiagramSvg(routed), /<svg[^>]+width="881\.5" height="796"/);

  const moved = structuredClone(routed);
  moved.nodes[1].position = { x: 180, y: 660 };
  assert.equal(graphBounds(moved).y + graphBounds(moved).height, 760, 'fit uses current node positions');
  assert.deepEqual(graphBounds(routed), bounds, 'reset can fit the authored graph without stale moved bounds');
});

test('rejects an edge label that is squeezed into an endpoint node', () => {
  const congested = graph('architecture', [
    box('caller', 'Caller', 'external', 0, 0),
    box('api', 'Order API', 'service', 200, 0)
  ], [edge('request', 'caller', 'api', 'request', { label: 'POST /orders' })]);

  assert.match(validateGraph(congested).join('\n'), /layout: edge request label overlaps node/);
});

test('rejects overlapping nodes', () => {
  const overlapping = graph('architecture', [
    box('caller', 'Caller', 'external', 0, 0),
    box('api', 'Order API', 'service', 100, 20)
  ], []);

  assert.match(validateGraph(overlapping).join('\n'), /layout: nodes caller and api overlap/);
});

test('rejects an edge that crosses an unrelated node', () => {
  const crossed = graph('architecture', [
    box('caller', 'Caller', 'external', 0, 0),
    box('blocker', 'Unexpected middle node', 'component', 250, 0),
    box('api', 'Order API', 'service', 500, 0)
  ], [edge('direct', 'caller', 'api', 'request')]);

  assert.match(validateGraph(crossed).join('\n'), /layout: edge direct crosses node blocker/);
});

test('rejects overlapping edge labels', () => {
  const crowdedLabels = graph('flowchart', [
    box('decision', 'Valid?', 'decision', 0, 0, 130, 110),
    box('accepted', 'Accepted', 'end', 420, 0, 130, 70),
    box('rejected', 'Rejected', 'end', 420, 220, 130, 70)
  ], [
    edge('yes', 'decision', 'accepted', 'yes', { label: 'accepted branch', route: { labelAt: { x: 300, y: 180 } } }),
    edge('no', 'decision', 'rejected', 'no', { label: 'rejected branch', route: { labelAt: { x: 300, y: 180 } } })
  ]);

  assert.match(validateGraph(crowdedLabels).join('\n'), /layout: edge labels yes and no overlap/);
});

test('rejects shared route segments longer than the endpoint stub', () => {
  const sharedRoute = graph('architecture', [
    box('source', 'Source', 'service', 0, 0),
    box('first-target', 'First target', 'service', 500, 0),
    box('second-target', 'Second target', 'service', 500, 220)
  ], [
    edge('first', 'source', 'first-target', 'call', { route: { via: [{ x: 320, y: 50 }] } }),
    edge('second', 'source', 'second-target', 'call', { route: { via: [{ x: 320, y: 50 }, { x: 320, y: 270 }] } })
  ]);

  assert.match(validateGraph(sharedRoute).join('\n'), /layout: edges first and second share a route segment longer than 12px/);
});

test('rejects a self-loop route that crosses its own node', () => {
  const invalidLoop = graph('state', [box('pending', 'Pending', 'state', 150, 0, 180, 90)], [
    edge('retry', 'pending', 'pending', 'transition', { route: { via: [{ x: 200, y: 45 }] } })
  ]);

  assert.match(validateGraph(invalidLoop).join('\n'), /layout: self-loop retry crosses node pending/);
});

test('warns without failing when nodes are less than 64px apart', () => {
  const tight = graph('architecture', [
    box('caller', 'Caller', 'external', 0, 0),
    box('api', 'Order API', 'service', 230, 0)
  ], []);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-flow-layout-warning-'));
  const input = path.join(root, 'graph.json');
  fs.writeFileSync(input, JSON.stringify(tight));

  const result = spawnSync(process.execPath, [path.join(scriptDir, 'validate-graph.mjs'), input], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Layout warning: nodes caller and api are only 50px apart/);
});

test('rejects wrapped sequence labels that cannot fit the fixed message pitch', () => {
  const sequence = structuredClone(fixtures.sequence);
  sequence.edges[0].label = 'POST /orders with a deliberately long request payload and idempotency metadata';

  assert.match(validateGraph(sequence).join('\n'), /layout: sequence edge request wrapped label needs .*px height/);
  sequence.edges[0].route = { labelAt: { x: 320, y: 80 } };
  assert.match(validateGraph(sequence).join('\n'), /layout: sequence edge request wrapped label needs .*px height/);
});

test('warns about route crossings and labels with less than 12px clearance', () => {
  const crossing = graph('architecture', [
    box('left', 'Left', 'service', 0, 200, 100, 60),
    box('right', 'Right', 'service', 500, 200, 100, 60),
    box('top', 'Top', 'service', 250, 0, 100, 60),
    box('bottom', 'Bottom', 'service', 250, 440, 100, 60)
  ], [edge('horizontal', 'left', 'right', 'call'), edge('vertical', 'top', 'bottom', 'call')]);
  const tightLabel = graph('architecture', [
    box('caller', 'Caller', 'external', 0, 0),
    box('api', 'Order API', 'service', 240, 0)
  ], [edge('request', 'caller', 'api', 'request', { label: 'call' })]);

  for (const [fixture, expected] of [
    [crossing, /Layout warning: edges horizontal and vertical cross/],
    [tightLabel, /Layout warning: edge request label has less than 12px clearance from node/]
  ]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-flow-layout-warning-'));
    const input = path.join(root, 'graph.json');
    fs.writeFileSync(input, JSON.stringify(fixture));
    const result = spawnSync(process.execPath, [path.join(scriptDir, 'validate-graph.mjs'), input], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, expected);
  }
});

test('keeps sequence route hints on the ordered message lane', () => {
  const sequence = structuredClone(fixtures.sequence);
  sequence.edges[0].route = { via: [{ x: 200, y: 112 }] };

  const route = createEdgeRoutes(sequence).get('request');
  assert.equal(route.points[0].y, 166);
  assert.equal(route.points.at(-1).y, 166);
});

test('routes multiple self-loops without creating shared long segments', () => {
  const state = graph('state', [box('pending', 'Pending', 'state', 150, 0, 180, 90)], [
    edge('retry-first', 'pending', 'pending', 'transition'),
    edge('retry-second', 'pending', 'pending', 'transition')
  ]);

  assert.deepEqual(validateGraph(state), []);
  for (const route of createEdgeRoutes(state).values()) {
    assert.ok(route.points.slice(1).every((point, index) => point.x === route.points[index].x || point.y === route.points[index].y));
  }
});

test('fans out five edges without nested shared route segments', () => {
  const fanout = graph('architecture', [
    box('source', 'Source', 'service', 0, 400, 180, 120),
    ...Array.from({ length: 5 }, (_, index) => box(`target-${index}`, `Target ${index}`, 'service', 650, index * 200))
  ], Array.from({ length: 5 }, (_, index) => edge(`call-${index}`, 'source', `target-${index}`, 'call')));

  assert.deepEqual(validateGraph(fanout), []);
});

test('rejects more automatic lanes than an endpoint side can hold', () => {
  const overflow = graph('architecture', [
    box('source', 'Source', 'service', 0, 500, 180, 100),
    ...Array.from({ length: 6 }, (_, index) => box(`target-${index}`, `Target ${index}`, 'service', 650, index * 200))
  ], Array.from({ length: 6 }, (_, index) => edge(`call-${index}`, 'source', `target-${index}`, 'call')));

  assert.match(validateGraph(overflow).join('\n'), /layout: edge .* exceeds an endpoint side/);

  const loops = graph('state', [box('pending', 'Pending', 'state', 150, 0, 180, 100)],
    Array.from({ length: 4 }, (_, index) => edge(`retry-${index}`, 'pending', 'pending', 'transition')));
  assert.match(validateGraph(loops).join('\n'), /layout: edge retry-3 exceeds an endpoint side/);
});

test('checks ER cardinality geometry against nodes even with no relationship label', () => {
  const er = graph('er', [entityForTest('users', 0), entityForTest('orders', 260)], [
    edge('user-orders', 'users', 'orders', 'relationship', { sourceCardinality: '1', targetCardinality: '0..*' })
  ]);

  assert.match(validateGraph(er).join('\n'), /layout: ER edge user-orders .*cardinality overlaps node/);
});

test('uses only the visible ER label for routing and omits absent labels', () => {
  const er = graph('er', [entityForTest('users', 0), entityForTest('orders', 340)], [
    edge('user-orders', 'users', 'orders', 'relationship', { sourceCardinality: '1', targetCardinality: '0..*', label: '关联' })
  ]);
  assert.deepEqual(validateGraph(er), []);
  let route = createEdgeRoutes(er).get('user-orders');
  assert.equal(route.label, '关联');
  assert.deepEqual(route.labelLines, ['关联']);
  assert.equal(route.labelBox.width, 44);
  delete er.edges[0].label;
  route = createEdgeRoutes(er).get('user-orders');
  assert.deepEqual([route.label, route.labelLines, route.labelBox.width, route.labelBox.height], ['', [], 0, 0]);
  assert.deepEqual(validateGraph(er), []);
  assert.doesNotMatch(createDiagramSvg(er), />关系<|>0\.\.\*</);
});

test('reserves ER endpoint segments and rejects incompatible hints without changing graph data', () => {
  const er = graph('er', [entityForTest('users', 0), { ...entityForTest('orders', 400), position: { x: 400, y: 300 } }], [
    edge('user-orders', 'users', 'orders', 'relationship', {
      sourceCardinality: '1', targetCardinality: '0..*', label: '关联',
      route: { via: [{ x: 268, y: 80 }, { x: 268, y: 250 }, { x: 372, y: 250 }, { x: 372, y: 380 }] }
    })
  ]);
  assert.deepEqual(validateGraph(er), []);
  const route = createEdgeRoutes(er).get('user-orders');
  assert.equal(route.points[1].x - route.points[0].x, ER_ENDPOINT_STUB);
  assert.equal(route.points.at(-1).x - route.points.at(-2).x, ER_ENDPOINT_STUB);
  for (const [index, x, role] of [[0, 252, 'source'], [3, 388, 'target']]) {
    const invalid = structuredClone(er);
    invalid.edges[0].route.via[index].x = x;
    const before = structuredClone(invalid);
    assert.match(validateGraph(invalid).join('\n'), new RegExp(`ER edge user-orders ${role} needs a 28px outward straight segment`));
    assert.deepEqual(invalid, before);
  }
});

test('connects hinted diamonds at vertices and turns after the existing 12px stub', () => {
  for (const [type, diamondKind, normalKind, relationKind] of [['flowchart', 'decision', 'process', 'flow'], ['state', 'choice', 'state', 'transition']]) {
    const diagram = graph(type, [
      box('before', 'Before', normalKind, 430, 100, 220, 120),
      box('diamond', 'Diamond', diamondKind, 800, 100, 220, 140),
      box('after', 'After', normalKind, 430, 340, 220, 120)
    ], [
      edge('into', 'before', 'diamond', relationKind, { label: '进入' }),
      edge('out', 'diamond', 'after', relationKind, { label: '退出', route: {
        via: [{ x: 740, y: 210 }, { x: 740, y: 290 }, { x: 540, y: 290 }], labelAt: { x: 740, y: 260 }
      } })
    ]);
    const before = structuredClone(diagram);
    assert.deepEqual(validateGraph(diagram), []);
    const route = createEdgeRoutes(diagram).get('out');
    assert.deepEqual(route.points.slice(0, 4), [{ x: 800, y: 170 }, { x: 788, y: 170 }, { x: 788, y: 210 }, { x: 740, y: 210 }]);
    assert.deepEqual(diagram, before);
    diagram.edges = [edge('return', 'after', 'diamond', relationKind, { route: { via: [{ x: 540, y: 290 }, { x: 860, y: 290 }] } })];
    assert.deepEqual(validateGraph(diagram), []);
    assert.deepEqual(createEdgeRoutes(diagram).get('return').points.slice(-3), [{ x: 860, y: 252 }, { x: 910, y: 252 }, { x: 910, y: 240 }]);
  }
});

test('routes representative non-rectangular nodes from their visible contour', () => {
  const cases = [
    ['flowchart', 'decision', 220, 140], ['flowchart', 'input', 240, 140],
    ['state', 'choice', 120, 120], ['state', 'initial', 50, 50],
    ['usecase', 'usecase', 220, 110], ['usecase', 'actor', 100, 140],
    ['architecture', 'external', 220, 140], ['architecture', 'security', 220, 140],
    ['deployment', 'device', 220, 140], ['deployment', 'database', 220, 140]
  ];
  for (const [type, kind, width, height] of cases) {
    const target = box('target', 'Target', kind, 500, 100, width, height);
    const sourceKind = getDiagram(type).nodeKinds.find(value => !['initial', 'final'].includes(value)) ?? kind;
    const source = box('source', 'Source', sourceKind, 40, 110, 180, 100);
    if (type === 'usecase' && sourceKind === 'actor') source.size = { width: 100, height: 140 };
    const item = graph(type, [source, target], [edge('route', 'source', 'target', getDiagram(type).edgeKinds[0])]);
    if (type === 'er') continue;
    const route = createEdgeRoutes(item).get('route');
    const end = route.points.at(-1);
    assert.deepEqual(end, getDiagram(type).anchor(target, route.targetSide, 0), `${type}/${kind}`);
    if (['decision', 'choice', 'usecase', 'actor', 'external', 'security', 'device', 'database', 'input'].includes(kind)) {
      const onEmptyBoxCorner = [target.position.x, target.position.x + width].includes(end.x)
        && [target.position.y, target.position.y + height].includes(end.y);
      assert.equal(onEmptyBoxCorner, false, `${type}/${kind} must not terminate in bounding-box whitespace`);
    }
  }
});

test('preserves diagram-specific relationship notation and direction', () => {
  const usecase = getDiagram('usecase');
  assert.equal(usecase.edgeLabel({ kind: 'include', label: 'include' }), '«include»');
  assert.equal(usecase.edgeLabel({ kind: 'extend', label: 'conditional' }), '«extend» · conditional');
  assert.equal(isDashed({ kind: 'extend' }, 'usecase'), true);
  assert.deepEqual(edgeMarkers({ kind: 'composition' }, 'class'), { start: 'diamond-filled', end: null });
  assert.equal(getDiagram('state').edgeLabel({ kind: 'transition', label: 'pay', guard: 'stock', action: 'reserve()' }), 'pay [stock] / reserve()');
  const sequence = graph('sequence', [
    box('left', 'Left', 'service', 0, 0, 160, 320), box('right', 'Right', 'service', 360, 0, 160, 320)
  ], [edge('return', 'right', 'left', 'return', { label: 'result', order: 1 })]);
  const route = createEdgeRoutes(sequence).get('return');
  assert.ok(route.points[0].x > route.points.at(-1).x, 'return arrow follows source to target');
  assert.equal(isDashed(sequence.edges[0], 'sequence'), true);
});

test('checks all five ER cardinalities in four directions and includes nearby nodes in marker bounds', () => {
  const point = { x: 100, y: 100 };
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (const value of ['1', '0..1', '*', '1..*', '0..*']) {
      const mark = cardinalityMarks(value, point, { x: point.x + dx * 40, y: point.y + dy * 40 });
      const optional = value.startsWith('0') || value === '*';
      assert.equal(Boolean(mark.circle), optional);
      if (optional) assert.deepEqual(mark.circle, { cx: 100 + dx * 23, cy: 100 + dy * 23, r: 4 });
      assert.ok(mark.bounds.width > 0 && mark.bounds.height > 0);
      assert.equal((mark.path.match(/M/g) ?? []).length, value.includes('*') ? optional ? 3 : 4 : optional ? 1 : 2);
    }
  }
  assert.deepEqual(cardinalityMarks('1', point, point), { path: '' });
  const er = graph('er', [entityForTest('users', 0), entityForTest('orders', 400),
    box('near-marker', 'Near marker', 'entity', 247, 78, 8, 4, { fields: [{ name: 'id', type: 'int' }] })
  ], [edge('user-orders', 'users', 'orders', 'relationship', { sourceCardinality: '1', targetCardinality: '0..*' })]);
  const errors = auditGraphLayout(er).errors.join('\n');
  assert.match(errors, /source cardinality overlaps node near-marker/);
  assert.doesNotMatch(errors, /edge user-orders crosses node near-marker/);
});

test('wraps sequence messages at legacy 210px spacing and preserves the 54px message pitch', () => {
  const sequence = graph('sequence', [box('a', 'A', 'service', 0, 0, 140, 300), box('b', 'B', 'service', 210, 0, 140, 300)], [
    edge('request', 'a', 'b', 'sync', { label: 'Create payment request', order: 1 }),
    edge('response', 'b', 'a', 'return', { label: 'Return payment response', order: 2 })
  ]);
  assert.deepEqual(validateGraph(sequence), []);
  const routes = createEdgeRoutes(sequence);
  for (const message of sequence.edges) {
    const route = routes.get(message.id);
    assert.equal(route.labelLines.length, 2);
    assert.equal(route.labelLines.join(''), visibleEdgeLabel(message, 'sequence'));
    assert.ok(route.labelBox.width <= 210 - 32);
    assert.equal(route.labelBox.height, 54);
    assert.equal(route.labelBox.y + route.labelBox.height, route.points[0].y + 2);
    const svg = createDiagramSvg(sequence);
    for (const line of route.labelLines) assert.ok(svg.includes(`>${line}</text>`), 'the export must render the same wrapped lines as the page');
  }
  assert.equal(routes.get('response').points[0].y - routes.get('request').points[0].y, 54);
});

test('wraps mixed-language text without dropping characters and bounds small-export headings', () => {
  const input = '支付 Create payment request · 支付结果';
  const layout = layoutText(input, 166);
  assert.equal(layout.lines.join(''), input);
  assert.ok(layout.width <= 166);
  assert.equal(layout.height, layout.lines.length * 24);
  const tiny = graph('architecture', [box('only', 'Only', 'service', 0, 0, 120, 100)], []);
  tiny.meta.title = 'Orders / ' + 'Business domain '.repeat(6);
  const svg = createDiagramSvg(tiny);
  const width = Number(svg.match(/<svg[^>]+width="([\d.]+)"/)[1]);
  const lines = [...svg.matchAll(/<text[^>]+class="heading"[^>]*>([^<]*)<\/text>/g)].map(match => match[1]);
  assert.ok(lines.length > 1);
  assert.equal(lines.join(''), tiny.meta.title);
  for (const line of lines) assert.ok(layoutText(line, Infinity, 24).width <= width - 128);
});

test('accounts for wide ASCII glyphs in compact headers and node titles', () => {
  assert.equal(layoutText('MW@%&', Infinity, 24).width, 120);
  const tiny = graph('architecture', [box('only', 'Only', 'service', 0, 0, 110, 100)], []);
  tiny.meta.title = 'WWWWWWWW';
  let svg = createDiagramSvg(tiny);
  const headings = [...svg.matchAll(/<text[^>]+class="heading"[^>]*>([^<]*)<\/text>/g)].map(match => match[1]);
  assert.equal(headings.join(''), tiny.meta.title);
  assert.ok(headings.length > 1);
  for (const line of headings) assert.ok(line.length * 24 <= 110);
  tiny.nodes[0].size = { width: 180, height: 150 };
  tiny.nodes[0].label = 'W'.repeat(20);
  svg = createDiagramSvg(tiny);
  const titles = [...svg.matchAll(/<text([^>]+class="title"[^>]*)>([^<]*)<\/text>/g)];
  assert.equal(titles.map(match => match[2]).join(''), tiny.nodes[0].label);
  for (const [, attributes, line] of titles) {
    const length = attributes.match(/textLength="([\d.]+)"/);
    assert.ok((length ? Number(length[1]) : line.length * 20) <= 150);
  }
});

test('keeps short-card text and all ER fields inside authored node bounds', () => {
  const samples = [
    graph('architecture', [box('only', 'Only', 'service', 0, 0, 180, 70, { subtitle: 'subtitle' })], []),
    graph('er', [box('only', 'Only', 'entity', 0, 0, 240, 150, {
      fields: Array.from({ length: 4 }, (_, index) => ({ name: `field_${index}`, type: index === 3 ? 'varchar(128) COLLATE utf8mb4_unicode_520_ci' : 'bigint' }))
    })], [])
  ];
  for (const sample of samples) {
    assert.deepEqual(validateGraph(sample), []);
    const svg = createDiagramSvg(sample);
    const node = sample.nodes[0];
    const card = svg.match(new RegExp(`<rect x="64" y="([\\d.]+)" width="${node.size.width}" height="${node.size.height}"`));
    assert.ok(card);
    const top = Number(card[1]);
    const texts = [...svg.matchAll(/<text([^>]+class="(title|body|compact-title|compact-body|field-name|field-type)"[^>]*)>([^<]*)<\/text>/g)];
    for (const [, attributes, className, content] of texts) {
      const y = Number(attributes.match(/y="([\d.]+)"/)[1]);
      assert.ok(y > top && y + 3 <= top + node.size.height, `${className} ${content} must fit inside the card`);
    }
    if (sample.meta.diagramType === 'er') {
      for (const [index, name] of texts.filter(match => match[2] === 'field-name').entries()) {
        assert.ok(node.fields[index].name.startsWith(name[3].replace(/…$/, '')));
        assert.ok(svg.includes(node.fields[index].name), 'full field name remains in the SVG node title');
      }
      const lastType = texts.filter(match => match[2] === 'field-type').at(-1);
      assert.ok(lastType[3].endsWith('…'), 'legacy narrow types use an ellipsis instead of squeezing glyphs');
      assert.ok(node.fields.at(-1).type.startsWith(lastType[3].slice(0, -1)));
      assert.ok(!svg.includes('textLength='), 'export must not compress the enlarged typography');
    } else assert.ok(texts.some(match => match[3] === 'subtitle'));
  }
});

test('shares theme and semantic colors between page tokens and SVG exports', () => {
  assert.equal(isCore({ kind: 'service', tags: [' CORE '] }), true);
  assert.equal(isCore({ kind: 'service', tags: ['business'] }), true);
  for (const [theme, palette] of Object.entries(PALETTES)) {
    const tokens = themeVariables(palette);
    const dataflow = structuredClone(fixtures.dataflow);
    const target = dataflow.nodes.find(node => node.id === 'ledger');
    const entry = dataflow.edges.find(item => item.id === 'entry');
    const fragment = createDiagramSvg(dataflow, theme).split('</g>').find(item => item.includes('>ledger entry</text>'));
    assert.equal(fragment.match(/<path[^>]+stroke="([^"]+)"/)[1], edgeColor(entry, target, palette));
    assert.equal(edgeColor(entry, target, palette), tokens['--good']);
    const erSvg = createDiagramSvg(fixtures.er, theme);
    assert.match(erSvg, new RegExp(`style="fill:${tokens['--good']}"[^>]*>PK</text>`));
    assert.match(erSvg, new RegExp(`style="fill:${tokens['--warm']}"[^>]*>FK</text>`));
  }
});

test('rejects edge labels placed over a group heading', () => {
  const grouped = graph('architecture', [
    box('caller', 'Caller', 'external', 0, 100),
    box('api', 'Order API', 'service', 760, 100)
  ], [edge('request', 'caller', 'api', 'request', { label: 'request', route: { labelAt: { x: 320, y: 118 } } })], [
    { id: 'runtime', label: 'Runtime', kind: 'runtime', position: { x: 240, y: 100 }, size: { width: 440, height: 300 } }
  ]);

  assert.match(validateGraph(grouped).join('\n'), /layout: edge request label overlaps group runtime heading/);
  grouped.edges[0].route.labelAt.x = 600;
  assert.doesNotMatch(validateGraph(grouped).join('\n'), /group runtime heading/);
});


test('shares readable typography with label measurement and SVG output', () => {
  const tokens = themeVariables(PALETTES.light);
  assert.deepEqual([tokens['--font-small'], tokens['--font-body'], tokens['--font-title']], ['14px', '16px', '20px']);
  assert.equal(layoutText('字段', Infinity).height, TYPOGRAPHY.edgeLineHeight);
  assert.equal(layoutText('字段', Infinity, 20, 26).height, 26);
  const sample = graph('er', [box('entity', 'Readable entity', 'entity', 0, 0, 600, 210, { fields: [{ name: 'partitionId', type: 'Integer', key: 'PK' }] })], []);
  const svg = createDiagramSvg(sample);
  assert.match(svg, /field-name\{font:500 16px/);
  assert.match(svg, /field-type\{font:400 14px/);
  assert.ok(!svg.includes('textLength='));
});


test('reports undersized normal cards instead of silently shrinking or truncating text', () => {
  const sample = graph('architecture', [box('old', 'Follower replica', 'service', 0, 0, 240, 112, { subtitle: 'A long subtitle that wraps across several lines at the readable size' })], []);
  assert.match(validateGraph(sample).join('\n'), /node old text needs at least \d+px height at 20\/16px/);
  sample.nodes[0].size.height = 240;
  assert.deepEqual(validateGraph(sample), []);
  const svg = createDiagramSvg(sample);
  assert.ok(!svg.includes('textLength='));
  assert.ok(!svg.includes('…'));
});
