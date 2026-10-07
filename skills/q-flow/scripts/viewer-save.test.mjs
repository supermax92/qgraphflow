import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { saveGraphJson } from '../assets/viewer/src/features/download.js';
import { translate } from '../assets/viewer/src/i18n.js';
import { pageWithGraph } from '../assets/viewer/src/session-graph.js';
import { requireDiagramQuality } from '../assets/viewer/src/layout-quality.js';

const generator = path.join(import.meta.dirname, 'generate-viewer.mjs');
const flowchart = path.join(import.meta.dirname, '../../../examples/jeepay/flowchart.graph.json');
const collection = path.join(import.meta.dirname, '../../../examples/jeepay/collection.graph.json');
const SAVED = 'Saved into this page, its sibling graph.json and SVGs';
const DRAFT = 'Saved into this page and its sibling graph.json; SVGs not updated: the layout needs adjustment';

function generate(t, input, ...args) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-save-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [generator, input, path.join(dir, 'page'), ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return { dir: path.join(dir, 'page'), svgs: JSON.parse(result.stdout).files.slice(2) };
}
const contents = dir => Object.fromEntries(fs.readdirSync(dir).sort().map(name => [name, fs.readFileSync(path.join(dir, name))]));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

// The folder the user picks, behind a fake File System Access handle shaped like Chromium's; a file reaches the disk
// when its writable closes.
async function saveInto(dir, input, { page = 'index.html', failOn, picker } = {}) {
  const writes = [], statuses = [], original = globalThis.window;
  const folder = { getFileHandle: async (name, { create } = {}) => {
    const file = path.join(dir, name);
    if (!create && !fs.existsSync(file)) throw new DOMException('missing', 'NotFoundError');
    return { getFile: async () => ({ text: async () => fs.readFileSync(file, 'utf8') }), createWritable: async () => {
      let data;
      return { write: async value => { if (name === failOn) throw new Error('Disk full'); data = value; },
        close: async () => { fs.writeFileSync(file, data); writes.push(name); }, abort: async () => { writes.push(`aborted ${name}`); } };
    } };
  } };
  globalThis.window = { location: { pathname: `/folder/${encodeURIComponent(page)}` },
    showDirectoryPicker: picker ?? (async options => { assert.equal(options.mode, 'readwrite'); return folder; }) };
  try { await saveGraphJson(input, 'en', status => statuses.push(status)); }
  finally { if (original === undefined) delete globalThis.window; else globalThis.window = original; }
  return { writes, status: statuses.at(-1) };
}

test('saving into the page folder writes graph.json, the page, then every SVG the generator would write', async t => {
  for (const [input, args, view] of [[flowchart, [], null], [collection, [], 0]]) {
    const { dir, svgs } = generate(t, input, ...args);
    const before = contents(dir), saved = readJson(path.join(dir, 'graph.json'));
    const moved = view === null ? saved : saved.diagrams[view];
    // This verifies folder saving with an edit that fits; invalid geometry is exercised below.
    moved.nodes[0].label = 'CI';
    requireDiagramQuality(moved);
    const { writes, status } = await saveInto(dir, saved);
    assert.equal(status, SAVED);
    assert.deepEqual(writes, ['graph.json', 'index.html', ...svgs], 'graph.json first, the page next, then the SVGs in view order');
    assert.deepEqual(readJson(path.join(dir, 'graph.json')), saved);
    assert.equal(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), pageWithGraph(before['index.html'].toString(), saved), 'only the embedded data changed');
    assert.notDeepEqual(fs.readFileSync(path.join(dir, svgs[view ?? 0])), before[svgs[view ?? 0]], 'the dragged view is redrawn');
    // The SVG on disk is the generator's SVG for the saved graph.json, whatever theme the page shows.
    const regenerated = generate(t, path.join(dir, 'graph.json'), '--layout', 'preserve');
    assert.deepEqual(regenerated.svgs, svgs);
    for (const name of svgs) assert.deepEqual(fs.readFileSync(path.join(dir, name)), fs.readFileSync(path.join(regenerated.dir, name)), name);
  }
});

test('a view outside the layout gate saves the page and graph.json as a draft and leaves every SVG untouched', async t => {
  const { dir, svgs } = generate(t, collection);
  const before = contents(dir), draft = readJson(path.join(dir, 'graph.json')), view = draft.diagrams[4];
  view.nodes[1].position = { ...view.nodes[0].position };
  const { writes, status } = await saveInto(dir, draft);
  assert.equal(status, DRAFT);
  assert.equal(translate('zh-CN', DRAFT), '已保存到当前页面和同级 graph.json；SVG 未更新：布局需要调整');
  assert.deepEqual(writes, ['graph.json', 'index.html']);
  assert.deepEqual(readJson(path.join(dir, 'graph.json')), draft);
  for (const name of svgs) assert.deepEqual(fs.readFileSync(path.join(dir, name)), before[name], name);
});

test('a wrong folder, a cancelled picker or a failed write reports it and keeps the edits in the page', async t => {
  const { dir, svgs } = generate(t, flowchart);
  fs.renameSync(path.join(dir, 'index.html'), path.join(dir, '查看器.html'));
  const input = readJson(path.join(dir, 'graph.json'));
  // An edit that still fits the card; a longer one would leave the layout for regeneration (see the draft test).
  input.nodes[0].label = 'Edited';
  const before = contents(dir);
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-empty-'));
  t.after(() => fs.rmSync(empty, { recursive: true, force: true }));
  let result = await saveInto(empty, input, { page: '查看器.html' });
  assert.match(result.status, /Choose the folder containing this page \(查看器\.html\)/);
  assert.deepEqual(fs.readdirSync(empty), []);
  result = await saveInto(dir, input, { page: '查看器.html', picker: async () => { throw new DOMException('Cancelled', 'AbortError'); } });
  assert.equal(result.status, 'Save cancelled; edits remain in this page');
  result = await saveInto(dir, input, { page: '查看器.html', failOn: 'graph.json' });
  assert.equal(result.status, 'Save failed; edits remain in this page');
  assert.deepEqual(result.writes, ['aborted graph.json']);
  assert.deepEqual(contents(dir), before);
  // A failure after graph.json is reported too; graph.json, the regeneration input, is already current.
  result = await saveInto(dir, input, { page: '查看器.html', failOn: svgs[0] });
  assert.equal(result.status, 'Save failed; edits remain in this page');
  assert.deepEqual(result.writes, ['graph.json', '查看器.html', `aborted ${svgs[0]}`]);
  assert.deepEqual(readJson(path.join(dir, 'graph.json')), input);
});

test('browsers without folder access save or download graph.json only', async () => {
  const input = readJson(collection), originalWindow = globalThis.window, originalDocument = globalThis.document;
  const files = [], statuses = [];
  try {
    globalThis.window = { showSaveFilePicker: async options => ({ createWritable: async () => ({
      write: async () => {}, close: async () => { files.push(options.suggestedName); }, abort: async () => {}
    }) }) };
    await saveGraphJson(input, 'en', status => statuses.push(status));
    globalThis.window = {};
    globalThis.document = { createElement: () => ({ click() { files.push(this.download); } }) };
    await saveGraphJson(input, 'en', status => statuses.push(status));
  } finally {
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
  }
  assert.deepEqual(files, ['graph.json', 'graph.json']);
  assert.deepEqual(statuses, ['Graph JSON saved', 'Graph JSON downloaded; keep the file to preserve edits']);
});
