import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { DIAGRAMS } from '../assets/viewer/src/diagrams/registry.js';
import { paint, escapeXml } from '../assets/viewer/src/diagrams/drawing.js';
import { renderMiniMapNode, renderNode, renderSelection } from '../assets/viewer/src/node-svg.js';
import { PALETTES } from '../assets/viewer/src/visual-style.js';

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = kind => ({ id: 'one', label: 'Component', kind, position: { x: 0, y: 0 }, size: { width: 320, height: 240 }, fields: [{ name: 'id', type: 'string', key: 'PK' }], attributes: ['+id: string'], methods: ['+read(): void'] });

test('every registered node kind shares its visible contour with selection in both themes', () => {
  for (const diagram of DIAGRAMS) for (const kind of diagram.nodeKinds) for (const palette of Object.values(PALETTES)) {
    const item = node(kind), markup = renderNode(item, diagram.id, 0, 0, palette);
    const selection = renderSelection(item, diagram.id);
    assert.equal(selection.markup, paint(diagram.outline(item, 0, 0)));
    assert.equal(renderMiniMapNode(item, diagram.id, 12, 18, 160, 120, '#fff', '#000', 2), paint(diagram.outline({ ...item, position: { x: 12, y: 18 }, size: { width: 160, height: 120 } }, 12, 18), { fill: '#fff', stroke: '#000', 'stroke-width': 2 }));
    const surfaces = [...markup.matchAll(/<(\w+)\s+([^>]*class="node-surface"[^>]*)\/>/g)];
    const outline = diagram.outline(item, 0, 0);
    assert.equal(surfaces.length, outline.length, `${diagram.id}/${kind}`);
    outline.forEach(([tag, geometry], index) => {
      assert.equal(surfaces[index][1], tag);
      const attributes = Object.fromEntries([...surfaces[index][2].matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
      for (const [name, value] of Object.entries(geometry)) assert.equal(attributes[name], escapeXml(value), `${diagram.id}/${kind}/${name}`);
    });
  }
});

test('architecture and deployment kinds keep dedicated visible contours', () => {
  for (const id of ['architecture', 'deployment']) {
    const diagram = DIAGRAMS.find(item => item.id === id);
    const signatures = diagram.nodeKinds.map(kind => JSON.stringify(diagram.outline(node(kind), 0, 0)));
    assert.equal(new Set(signatures).size, signatures.length, `${id} kinds must not fall back to one card outline`);
  }
});

test('shared SVG escapes authored text and preserves complete accessible descriptions', () => {
  const attack = '</text><script>alert("x")</script>&';
  for (const diagram of DIAGRAMS) {
    const item = { ...node(diagram.nodeKinds[0]), label: attack, subtitle: attack, fields: [{ name: attack, type: attack, key: 'PK', nullable: false }], attributes: [attack], methods: [attack] };
    const markup = renderNode(item, diagram.id, 0, 0, PALETTES.light);
    assert.ok(!markup.includes('<script>'));
    assert.ok(markup.includes(escapeXml(attack)));
    assert.ok(markup.includes('nullable: false'));
  }
});

test('a tenth module plus one registry entry validates, builds and generates without central edits', async t => {
  // Set MODULE_TEST_OUTPUT to a new directory to retain the built extension for browser QA.
  const directory = process.env.MODULE_TEST_OUTPUT ? path.resolve(process.env.MODULE_TEST_OUTPUT) : fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-module-'));
  if (process.env.MODULE_TEST_OUTPUT) { assert.ok(!fs.existsSync(directory), 'Use a new test output directory'); fs.mkdirSync(directory, { recursive: true }); }
  else t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const copy = path.join(directory, 'skills/q-flow');
  for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
    fs.copyFileSync(path.resolve(skill, '../..', name), path.join(directory, name));
  }
  fs.cpSync(skill, copy, { recursive: true, filter: source => !['node_modules', 'viewer-dist'].includes(path.basename(source)) });
  const viewer = path.join(copy, 'assets/viewer'), src = path.join(viewer, 'src');
  fs.symlinkSync(path.join(skill, 'assets/viewer/node_modules'), path.join(viewer, 'node_modules'), 'dir');
  fs.writeFileSync(path.join(src, 'diagrams/review-flow.js'), `import { rectangle, paint, centeredTitle } from './drawing.js';
const outline = (node, x, y) => rectangle(node, x, y, 18);
export default {
  id: 'review-flow', label: '审核图', nodeKinds: ['stage'], groupKinds: [], edgeKinds: ['handoff'],
  outline,
  render: (node, x, y, fill, stroke) => '<g class="shape-label">' + paint(outline(node, x, y), { fill, stroke }) + centeredTitle(x + node.size.width / 2, y + node.size.height / 2, node.label, node.size.width - 32) + '</g>',
  validateNode(node, label, errors, { requireString }) { requireString(node.subtitle, label + '.subtitle', errors); },
  edgeLabel: edge => edge.label ?? '交接'
};
`);
  const registryFile = path.join(src, 'diagrams/registry.js');
  fs.writeFileSync(registryFile, "import reviewFlow from './review-flow.js';\n" + fs.readFileSync(registryFile, 'utf8').replace('DIAGRAMS = [', 'DIAGRAMS = [reviewFlow, '));
  const { DIAGRAM_TYPES, validateGraph } = await import(pathToFileURL(path.join(copy, 'scripts/validate-graph.mjs')));
  const { createDiagramSvg } = await import(pathToFileURL(path.join(src, 'export-svg.js')));
  const { createEdgeRoutes } = await import(pathToFileURL(path.join(src, 'edge-routing.js')));
  const graph = {
    meta: { diagramType: 'review-flow', title: '图类型扩展验收', sourceRef: 'test fixture · not repository evidence' },
    nodes: ['提交', '审核', '归档'].map((label, index) => ({ ...node('stage'), id: 'stage-' + index, label, subtitle: '扩展检查', position: { x: 60 + index * 460, y: 100 }, size: { width: 300, height: 160 }, ...(index === 1 ? { tags: ['core'] } : {}) })),
    edges: [0, 1].map(index => ({ id: 'edge-' + index, source: 'stage-' + index, target: 'stage-' + (index + 1), kind: 'handoff', evidence: 'test' }))
  };
  assert.equal(DIAGRAM_TYPES.length, 10);
  assert.deepEqual(validateGraph(graph), []);
  const invalid = structuredClone(graph); delete invalid.nodes[0].subtitle;
  assert.ok(validateGraph(invalid).includes('nodes[0].subtitle must be a non-empty string'));
  assert.equal(createEdgeRoutes(graph).size, 2);
  const svg = createDiagramSvg(graph);
  assert.ok(svg.includes('审核')); assert.ok(svg.includes('交接'));
  fs.writeFileSync(path.join(directory, 'model.json'), JSON.stringify(graph));
  const run = (script, args, cwd) => {
    const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    return result.stdout;
  };
  run(path.join(viewer, 'node_modules/vite/bin/vite.js'), ['build'], viewer);
  run(path.join(copy, 'scripts/generate-viewer.mjs'), [path.join(directory, 'model.json'), path.join(directory, 'page')], copy);
  assert.deepEqual(fs.readdirSync(path.join(directory, 'page')).sort(), ['graph.json', 'index.html']);
  assert.ok(fs.readFileSync(path.join(directory, 'page/index.html'), 'utf8').includes('review-flow'));
  // The only production-source differences in the temporary copy are the new module and its registration.
  for (const source of fs.readdirSync(path.join(skill, 'assets/viewer/src'), { recursive: true }).filter(name => /\.(jsx?|css)$/.test(name) && name !== 'diagrams/registry.js')) {
    assert.equal(fs.readFileSync(path.join(src, source), 'utf8'), fs.readFileSync(path.join(skill, 'assets/viewer/src', source), 'utf8'), source);
  }
  assert.equal(fs.readFileSync(path.join(copy, 'scripts/validate-graph.mjs'), 'utf8'), fs.readFileSync(path.join(skill, 'scripts/validate-graph.mjs'), 'utf8'));
});
