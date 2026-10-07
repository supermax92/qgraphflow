import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateGraphInput } from '../assets/viewer/src/graph-validation.js';
import { layoutArchitectureOverview, reorderOverview, overviewSections } from '../assets/viewer/src/architecture-overview.js';
import { requireDiagramQuality } from '../assets/viewer/src/layout-quality.js';
import { graphInputWithEdits } from '../assets/viewer/src/session-graph.js';
import { diagramSvgFiles } from '../assets/viewer/src/export-svg.js';
import { verifySourceEvidence } from './validate-graph.mjs';
import { compileGraphLayout } from './compile-layout.mjs';
import { compileViews } from './generate-viewer.mjs';
const read = name => JSON.parse(fs.readFileSync(new URL(`../../../examples/architecture-overviews/${name}.graph.json`, import.meta.url)));

test('multiple architecture views validate with separate identities; old collections stay valid', () => {
  const collection = read('collection'); assert.deepEqual(validateGraphInput(collection, { inputOnly: true }), []);
  const duplicate = structuredClone(collection); duplicate.diagrams[1].meta.viewId = duplicate.diagrams[0].meta.viewId;
  assert.match(validateGraphInput(duplicate, { inputOnly: true }).join('\n'), /duplicates capabilities/);
  delete duplicate.diagrams[1].meta.viewId;
  assert.match(validateGraphInput(duplicate, { inputOnly: true }).join('\n'), /viewId is required/);
  assert.deepEqual(validateGraphInput({ diagrams: [read('capabilities.zh-CN')] }, { inputOnly: true }), []);
  assert.match(validateGraphInput({ diagrams: Array(33).fill(collection.diagrams[0]) }).join('\n'), /between 1 and 32/);
});

test('sections reject missing, duplicated, invalid and cyclic references', () => {
  for (const [mutate, message] of [
    [graph => graph.layout.sections[0].items.push({ nodeId: 'p-library' }), /repeats node/],
    [graph => graph.layout.sections[0].items[0].nodeId = 'missing', /does not name a node/],
    [graph => graph.layout.sections[0].items = [], /items must be non-empty/],
    [graph => graph.layout.sections[0].detailOf = 'missing', /detailOf/],
    [graph => graph.nodes[0].badges[0].evidence = 'verified', /needs label/],
    [graph => graph.nodes[0].overviewTone = 'unknown', /overviewTone is unsupported/],
    [graph => graph.nodes[0].overviewAccent = 'yes', /overviewAccent must be boolean/],
    [graph => graph.layout.sections[0].tone = 'unknown', /tone is unsupported/],
    [graph => graph.layout.sections[0].frame = 'unknown', /frame is unsupported/],
    [graph => graph.layout.sections[1].columns = 0, /columns requires a grid/],
    [graph => graph.layout.sections[0].columns = 2, /columns requires a grid/],
    [graph => graph.layout.sections[0].weights = [1], /weights requires a row/]
  ]) { const graph = read('capabilities.zh-CN'); mutate(graph); assert.match(validateGraphInput(graph, { inputOnly: true }).join('\n'), message); }
});

test('both templates preserve full text, directions and traceable content through compile and SVG', async () => {
  for (const name of ['capabilities.zh-CN', 'engineering.zh-CN', 'capabilities.en', 'source-project']) {
    const graph = read(name), { graph: output, report } = await compileGraphLayout(graph);
    requireDiagramQuality(output); assert.equal(report.semantics.preserved, true);
    assert.deepEqual(output.edges.map(edge => [edge.source, edge.target, edge.kind]), graph.edges.map(edge => [edge.source, edge.target, edge.kind]));
    const svg = diagramSvgFiles(output)[0].svg;
    for (const section of overviewSections(output)) assert.ok(svg.includes(section.id));
    for (const node of graph.nodes) for (const badge of node.badges) assert.ok(svg.includes(badge.label));
    assert.equal(verifySourceEvidence(output, process.cwd()).status, 'passed');
    const preserved = await compileGraphLayout(output, { layout: 'preserve' }); assert.equal(diagramSvgFiles(preserved.graph)[0].svg, svg);
  }
});

test('reordering remains within the owning section, survives save and does not overwrite another architecture view', () => {
  const collection = read('collection'); collection.diagrams = collection.diagrams.map(graph => layoutArchitectureOverview(graph));
  const initial = collection.diagrams[0], first = initial.nodes.find(node => node.id === 'p-catalog'), second = initial.nodes.find(node => node.id === 'p-loans');
  const edited = layoutArchitectureOverview(reorderOverview(initial, first.id, second.position)); requireDiagramQuality(edited);
  assert.notDeepEqual(edited.layout.sections[1].items, initial.layout.sections[1].items);
  const saved = graphInputWithEdits(collection, new Map([['capabilities', edited]]), collection.diagrams[1]);
  assert.deepEqual(saved.diagrams[0], edited); assert.deepEqual(saved.diagrams[1], collection.diagrams[1]);
  const svgs = diagramSvgFiles(saved); assert.deepEqual(svgs.map(file => file.name), ['diagram-1-architecture.svg', 'diagram-2-architecture.svg']);
});

test('long body, multiline badges and notes grow without dropping content; invalid geometry blocks export', () => {
  const graph = read('capabilities.zh-CN'); graph.nodes[1].overviewText = ['完整中文职责说明和 VeryLongCamelCaseIdentifierThatMustRemainReadable '.repeat(15)];
  graph.nodes[1].badges.push({ label: '运行时兼容范围需要源码与实际运行环境分别核验 '.repeat(5), role: 'version', evidence: 'document' });
  graph.layout.sections.at(-1).text.push('完整说明正文 '.repeat(30));
  const output = layoutArchitectureOverview(graph); requireDiagramQuality(output);
  assert.ok(output.nodes[1].size.height > 500);
  output.layout.sections.at(-1).size.height = 10;
  assert.throws(() => diagramSvgFiles(output), /section .*text is clipped/);
});

test('reference grids align row bottoms with compact gaps and parallel support spans the detail', () => {
  const graph = read('capabilities.zh-CN'); graph.nodes.find(node => node.id === 'p-loans').overviewText.push('完整职责说明 '.repeat(40));
  const placed = layoutArchitectureOverview(graph); requireDiagramQuality(placed);
  const inventory = placed.layout.sections[1].items.map(item => placed.nodes.find(node => node.id === item.nodeId));
  assert.equal(new Set(inventory.slice(0, 4).map(node => node.size.height)).size, 1);
  assert.equal(inventory[1].position.x - inventory[0].position.x - inventory[0].size.width, 14);
  assert.equal(inventory[4].position.y - inventory[0].position.y - inventory[0].size.height, 14);
  assert.ok(inventory[1].size.height > 500);
  const engineering = layoutArchitectureOverview(read('engineering.zh-CN')); requireDiagramQuality(engineering);
  const [layers, support] = engineering.layout.sections[1].items;
  assert.equal(layers.position.y, support.position.y); assert.equal(layers.size.height, support.size.height);
  assert.equal(layers.size.width, support.size.width * 2);
  for (const weights of [[1], [1, 0], [1, Infinity]]) {
    const invalid = read('engineering.zh-CN'); invalid.layout.sections[1].weights = weights;
    assert.match(validateGraphInput(invalid, { inputOnly: true }).join('\n'), /weights requires a row/);
  }
});

test('failures from repeated architecture views keep all diagnostic candidates', async () => {
  await assert.rejects(compileViews(read('collection').diagrams, async graph => { throw Object.assign(new Error(graph.meta.viewId), { candidates: [graph.meta.viewId] }); }), error => {
    assert.deepEqual(error.failedViews, ['capabilities', 'engineering']); assert.deepEqual(Object.keys(error.candidates), ['capabilities', 'engineering']); return true;
  });
});

test('same-template architecture views coexist; optional body enables editing and nested groups keep real ownership', () => {
  const first = read('capabilities.zh-CN'), second = structuredClone(first); second.meta.viewId = 'platform-second';
  assert.deepEqual(validateGraphInput({ diagrams: [first, second] }, { inputOnly: true }), []);
  const output = layoutArchitectureOverview(first); output.nodes[0].overviewText = ['Updated paragraph'];
  const saved = graphInputWithEdits({ diagrams: [output, second] }, new Map(), output);
  assert.equal(saved.diagrams[1].meta.viewId, 'platform-second'); assert.notEqual(saved.diagrams[1].nodes[0].overviewText[0], 'Updated paragraph');
  const graph = { meta: { title: 'Owned components', sourceRef: 'concept', architectureView: 'engineering' }, nodes: ['a', 'b'].map(id => ({ id, label: id, kind: 'component', groupId: 'child', overviewText: [], badges: [] })), groups: [{ id: 'owner', label: 'Ownership', kind: 'ownership' }, { id: 'child', label: 'Nested module', kind: 'ownership', parentId: 'owner' }], edges: [], layout: { sections: [{ id: 'inventory', title: 'Organization', mode: 'stack', items: [{ groupId: 'owner' }] }] } };
  assert.deepEqual(validateGraphInput(graph, { inputOnly: true }), []);
  const placed = layoutArchitectureOverview(graph); requireDiagramQuality(placed);
  assert.deepEqual(placed.nodes.map(node => node.groupId), ['child', 'child']); assert.equal(placed.groups[1].parentId, 'owner');
  graph.layout.sections[0].items.push({ nodeId: 'a' }); assert.match(validateGraphInput(graph, { inputOnly: true }).join('\n'), /repeats node/);
});

test('section descriptions and many parallel cards grow the canvas; failures locate sections', () => {
  const graph = read('capabilities.zh-CN'); graph.layout.sections[0].text = ['完整分区说明与 English explanation '.repeat(25)];
  graph.layout.sections[1].mode = 'row'; delete graph.layout.sections[1].columns;
  const placed = layoutArchitectureOverview(graph); requireDiagramQuality(placed);
  assert.ok(placed.layout.sections[1].size.width > 3000);
  assert.ok(placed.nodes.every(node => node.size.width >= 176));
  assert.ok(placed.nodes.filter(node => node.id.startsWith('p-')).every(node => node.size.width >= 300));
  const note = placed.layout.sections.at(-1); note.text = [];
  assert.throws(() => requireDiagramQuality(placed), error => error.diagnostics.some(item => item.elementIds.includes(note.id) && item.bounds.length));
});

test('preserved overviews reject note/card, section and route/text collisions', () => {
  const graph = layoutArchitectureOverview(read('capabilities.zh-CN')), note = graph.layout.sections.at(-1);
  note.position = { x: graph.nodes[0].position.x - 32, y: graph.nodes[0].position.y - 32 }; note.size.width = graph.nodes[0].size.width + 64;
  assert.throws(() => diagramSvgFiles(graph), /overview siblings/);
  const allConnections = read('capabilities.zh-CN'); allConnections.layout.overviewConnections = 'all';
  const other = layoutArchitectureOverview(allConnections), edge = other.edges[0], section = other.layout.sections[1];
  edge.route.via = [{ x: section.position.x - 20, y: section.position.y + 40 }, { x: section.position.x + section.size.width + 20, y: section.position.y + 40 }];
  assert.throws(() => requireDiagramQuality(other), /crosses section/);
});

test('an unchanged drop preserves order; reorder does not bypass larger-gap layout retries', () => {
  const graph = layoutArchitectureOverview(read('capabilities.zh-CN')), node = graph.nodes.find(node => node.id === 'p-catalog');
  assert.deepEqual(reorderOverview(graph, node.id, node.position), graph);
  assert.deepEqual(reorderOverview(graph, node.id, { x: node.position.x + 5, y: node.position.y + 5 }).layout.sections, graph.layout.sections);
  const dense = read('engineering.zh-CN'); dense.edges = [dense.edges.at(-1)]; dense.edges[0].label = '这是完整的较长关系说明 '.repeat(5);
  const placed = layoutArchitectureOverview(dense, { gap: 200 }); requireDiagramQuality(placed);
  const ordered = reorderOverview(placed, placed.nodes[0].id, placed.nodes[0].position);
  assert.deepEqual(ordered, placed); requireDiagramQuality(layoutArchitectureOverview(ordered, { gap: 200 }));
});
