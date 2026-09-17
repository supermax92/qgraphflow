#!/usr/bin/env node
// Replays the production Viewer contract over the canvas-first shell: one floating toolbar, collapsed floating panels,
// quick-look cards and the legend popover. Uses an existing Playwright installation.
// Usage: node browser-interactions.mjs GENERATED_DIRECTORY REPORT_DIRECTORY
// Optional: PLAYWRIGHT_MODULE, CHROME_PATH, QA_HEADED=1, QA_TYPES, QA_WIDTHS (matrix only), QA_DPR=1, QA_MOTION_CALIBRATION=1, QA_ONLY_EXTRAS=1,
// QA_EXTRAS=none|acceptance|acceptance-details|editor-boundaries|flow-direction|export-failures|motion-matrix|motion-preferences|selection-entrypoints|ambient-flow|flow-contrast|inspector-sync|information-layout|facts-layout|fullscreen|fullscreen-errors|quick-details|repeat-notice|long-preview|text-bounds|relationship-card-avoidance|sequence-reading|file-url, QA_FIXTURE_DIR.
// QA_REUSE_PASSED=REPORT reuses completed same-build cases with intact attachments; failures rerun.
// QA_COVERAGE_ONLY=1 QA_MERGE_REPORTS=REPORT,... QA_HOST_EVIDENCE=RECEIPT QA_FULL_ACCEPTANCE=1 checks the complete evidence gate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { graphLegend } from '../assets/viewer/src/legend.js';
import { renderNode } from '../assets/viewer/src/node-svg.js';
import { sequenceHeaderHeight } from '../assets/viewer/src/diagrams/sequence.js';
import { sequencePairs, sequenceExecutions } from '../assets/viewer/src/sequence-executions.js';
import { createEdgeRoutes } from '../assets/viewer/src/edge-routing.js';
import { moduleColorMap, PALETTES, TYPOGRAPHY, isCore, sequenceGroupColor } from '../assets/viewer/src/visual-style.js';
import { diagramLabels as labels, getDiagram, hasArrow, isDashed, edgeMarkers } from '../assets/viewer/src/diagrams/registry.js';
import { validateGraph, validateGraphInput } from './validate-graph.mjs';
import { compileGraphLayout } from './compile-layout.mjs';
import { requireDiagramQuality } from '../assets/viewer/src/layout-quality.js';

const [inputDirectory, reportDirectory] = process.argv.slice(2);
if (!inputDirectory || !reportDirectory) throw new Error('Usage: node browser-interactions.mjs GENERATED_DIRECTORY REPORT_DIRECTORY');
const inputRoot = path.resolve(inputDirectory), outputRoot = path.resolve(reportDirectory);
const input = JSON.parse(fs.readFileSync(path.join(inputRoot, 'graph.json'), 'utf8'));
const graphs = (input.diagrams ?? [input]).slice().sort((a, b) => Object.keys(labels).indexOf(a.meta.diagramType) - Object.keys(labels).indexOf(b.meta.diagramType));
const fixtureRoot = process.env.QA_FIXTURE_DIR ? path.resolve(process.env.QA_FIXTURE_DIR) : null;
const fixtures = fixtureRoot ? fs.readdirSync(fixtureRoot).filter(name => fs.existsSync(path.join(fixtureRoot, name, 'index.html'))).map(name => ({ name, graph: JSON.parse(fs.readFileSync(path.join(fixtureRoot, name, 'graph.json'), 'utf8')) })) : [];
const filtered = graphs.filter(graph => !process.env.QA_TYPES || process.env.QA_TYPES.split(',').includes(graph.meta.diagramType));
const viewports = [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }];
const matrixViewports = viewports.filter(viewport => !process.env.QA_WIDTHS || process.env.QA_WIDTHS.split(',').includes(String(viewport.width)));
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = { startedAt: new Date().toISOString(), build: { htmlSha256: digest(path.join(inputRoot, 'index.html')), graphSha256: digest(path.join(inputRoot, 'graph.json')), runnerSha256: digest(import.meta.filename) }, environment: { platform: os.platform(), release: os.release(), arch: os.arch(), node: process.version, options: Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('QA_'))) }, cases: [], extra: [], exports: [], failures: [] };
for (const directory of ['', 'screens', 'exports', 'failures', 'traces', 'steps']) fs.mkdirSync(path.join(outputRoot, directory), { recursive: true });
const writeReport = () => fs.writeFileSync(path.join(outputRoot, 'browser-interactions-report.json'), JSON.stringify(report, null, 2) + '\n');
function relocateEvidence(item, base) {
  const relative = value => value ? path.relative(outputRoot, path.resolve(base, value)) : undefined;
  const prefix = `${item.type ?? item.name.split('-')[0]}-${item.width}-${item.theme ?? (item.name.includes('-dark-') ? 'dark' : 'light')}-`;
  const files = item.files ?? (fs.existsSync(path.join(base, 'exports')) ? fs.readdirSync(path.join(base, 'exports')).filter(name => name.startsWith(prefix)).map(name => ({ path: 'exports/' + name, sha256: digest(path.join(base, 'exports', name)) })) : []);
  return { ...item, trace: relative(item.trace), video: relative(item.video), pixelFrames: item.pixelFrames?.map(relative), files: files.map(file => ({ ...file, path: relative(file.path) })), steps: item.steps?.map(step => ({ ...step, screenshot: relative(step.screenshot), files: step.files?.map(file => ({ ...file, path: relative(file.path) })) })) };
}
// Reuse only completed cases from the same build; interrupted/failed cases still run normally.
if (process.env.QA_REUSE_PASSED) {
  const file = path.resolve(process.env.QA_REUSE_PASSED), source = JSON.parse(fs.readFileSync(file));
  assert.notEqual(path.dirname(file), outputRoot, 'Keep the previous report immutable.');
  assert.equal(source.build.htmlSha256, report.build.htmlSha256, 'Reused HTML version mismatch');
  assert.equal(source.build.graphSha256, report.build.graphSha256, 'Reused graph version mismatch');
  assert.equal(Number(source.environment?.options?.QA_DPR ?? 1), Number(process.env.QA_DPR ?? 1), 'Reused device pixel ratio mismatch');
  assert.ok(source.finishedAt && source.browserClosed && source.serverClosed, 'Previous run must have closed its resources.');
  report.reusedRun = { report: path.relative(outputRoot, file), sha256: digest(file), build: source.build, failures: source.failures };
  for (const section of ['cases', 'extra']) for (const item of source[section].filter(item => item.passed)) {
    const relocated = { ...relocateEvidence(item, path.dirname(file)), sourceReport: report.reusedRun.report };
    const evidence = [relocated.trace, relocated.video, ...(relocated.pixelFrames ?? []), ...(relocated.steps ?? []).map(step => step.screenshot)].filter(Boolean);
    const complete = evidence.length && evidence.every(attachment => fs.existsSync(path.resolve(outputRoot, attachment))) && relocated.files.every(attachment => fs.existsSync(path.resolve(outputRoot, attachment.path)) && digest(path.resolve(outputRoot, attachment.path)) === attachment.sha256);
    if (!complete) { console.log('RERUN', item.name, 'incomplete prior evidence'); continue; }
    report[section].push(relocated);
  }
  report.exports.push(...source.exports);
}
const require = createRequire(import.meta.url);
function playwright() {
  if (process.env.PLAYWRIGHT_MODULE) return require(process.env.PLAYWRIGHT_MODULE);
  try { return require('playwright'); } catch { /* Reuse npx's existing cache; never install a dependency. */ }
  const cache = path.join(os.homedir(), '.npm', '_npx');
  for (const directory of fs.existsSync(cache) ? fs.readdirSync(cache).sort() : []) {
    const candidate = path.join(cache, directory, 'node_modules', 'playwright');
    if (fs.existsSync(path.join(candidate, 'package.json'))) return require(candidate);
  }
  throw new Error('Playwright is unavailable. Set PLAYWRIGHT_MODULE to an existing installation.');
}
const { chromium } = playwright();
const button = (page, name) => page.getByRole('button', { name, exact: true });
const count = (page, selector) => page.locator(selector).count();
const core = graph => graph.nodes.find(isCore);
const target = graph => core(graph) ?? graph.nodes[0];
const nodeElement = (page, id) => page.locator('.react-flow__node-diagram').and(page.locator(`[data-id=${JSON.stringify(id)}]`));
const menuItem = (page, name) => page.getByRole('menuitem', { name, exact: true });
// The toast is the operation status channel.
const status = page => page.locator('.toast').innerText();
const panelState = page => page.locator('[aria-controls="graph-tools"],[aria-controls="node-inspector"]').evaluateAll(elements => elements.map(element => element.getAttribute('aria-expanded')));
async function dismiss(page) {
  // Escape closes an open popover (menu, search results, legend) before anything else reacts to it.
  if (await count(page, '.popover')) { await page.keyboard.press('Escape'); await page.locator('.popover').waitFor({ state: 'detached' }); }
}
async function openMore(page) {
  if (!await count(page, '.menu.is-right[role="menu"]')) { await dismiss(page); await page.locator('#more-menu-button').click(); }
  await page.locator('.menu.is-right[role="menu"]').waitFor();
}
async function openLegend(page) {
  if (!await count(page, '.legend-pop')) { await dismiss(page); await page.locator('.legend-anchor .float-btn').click(); }
  await page.locator('.legend-pop').waitFor();
}
// Narrow screens keep one panel at a time: opening one starts the other's exit animation, so wait until it is gone.
const mobile = page => page.viewportSize().width <= 700;
async function nav(page, open) {
  const toggle = button(page, open ? '显示图谱导航' : '隐藏图谱导航');
  if (await toggle.count()) await toggle.click();
  await page.locator('.nav').waitFor({ state: open ? 'visible' : 'detached' });
  if (open && mobile(page)) await page.locator('.inspector').waitFor({ state: 'detached' });
}
async function hidePanels(page) {
  if (await count(page, '.nav')) await nav(page, false);
  if (await count(page, '.inspector')) {
    const close = button(page, '隐藏右侧详情栏');
    if (await close.count()) await close.click();
    await page.locator('.inspector').waitFor({ state: 'detached' });
  }
}
async function ensureInspector(page) {
  if (await button(page, '显示右侧详情栏').count()) await button(page, '显示右侧详情栏').click();
  await page.locator('.inspector').waitFor();
  await page.waitForFunction(() => document.querySelector('[aria-controls="node-inspector"]')?.getAttribute('aria-expanded') === 'true' && !document.querySelector('.node-card'));
  if (mobile(page)) await page.locator('.nav').waitFor({ state: 'detached' });
}
async function assertLayoutSwitch(page) {
  const row = page.locator('.menu-row').filter({ has: page.getByRole('switch', { name: /^(布局锁定|可拖动)$/ }) });
  const result = await row.evaluate(element => {
    const label = element.querySelector('.menu-lead'), toggle = element.querySelector('.switch');
    const outer = element.getBoundingClientRect(), text = label.getBoundingClientRect(), control = toggle.getBoundingClientRect(), style = getComputedStyle(toggle);
    return {
      control: { width: parseFloat(style.width), height: parseFloat(style.height) },
      singleLine: label.scrollHeight <= label.clientHeight + 1,
      contained: text.left >= outer.left && text.right <= control.left && control.right <= outer.right && control.top >= outer.top && control.bottom <= outer.bottom
    };
  });
  assert.deepEqual(result, { control: { width: 32, height: 20 }, singleLine: true, contained: true }, 'Layout lock stays aligned inside the menu row.');
}
async function setLocked(page, locked) {
  await openMore(page);
  await assertLayoutSwitch(page);
  const toggle = page.getByRole('switch', { name: locked ? '可拖动' : '布局锁定', exact: true });
  if (await toggle.count()) await toggle.click();
  assert.equal(await page.getByRole('switch', { name: locked ? '布局锁定' : '可拖动', exact: true }).count(), 1, 'The layout lock is one switch in the more menu.');
  await dismiss(page);
}
async function chooseGraph(page, graph, mobile) {
  if (graphs.length > 1) {
    await dismiss(page); await page.locator('#view-menu-button').click(); await page.locator('.menu[role="menu"]').waitFor();
    const items = page.locator('.menu [role="menuitemradio"]');
    assert.equal(await items.count(), graphs.length, 'The view menu lists every diagram of the collection.');
    assert.equal(await items.evaluateAll(elements => elements.filter(element => element.getAttribute('aria-checked') === 'true').length), 1, 'Exactly one view is checked.');
    assert.ok(await items.evaluateAll(elements => elements.every(element => /\d+/.test(element.querySelector('small')?.textContent ?? ''))), 'Every view shows its relationship count.');
    await items.filter({ hasText: labels[graph.meta.diagramType] }).click();
    await page.locator('.menu[role="menu"]').waitFor({ state: 'detached' });
    await page.waitForFunction(label => document.querySelector('#view-menu-button span')?.textContent === label, labels[graph.meta.diagramType]);
  } else assert.equal(await count(page, '#view-menu-button'), 0, 'A standalone graph has no view menu.');
  await page.waitForFunction(ids => ids.every(id => document.getElementById(id)?.classList.contains('react-flow__edge-path')), graph.edges.map(edge => edge.id));
  assert.equal(await count(page, '.diagram-node'), graph.nodes.length);
  if (mobile) assert.ok(await count(page, '.nav,.inspector') <= 1, 'Narrow view keeps at most one floating panel.');
  return assertIdentity(page, graph);
}
async function assertIdentity(page, graph) {
  const documentTitle = `${graph.meta.title} · QGraphFlow`;
  await page.waitForFunction(title => document.title === title, documentTitle);
  const toolbar = page.locator('.toolbar');
  assert.equal(await toolbar.count(), 1, 'One toolbar floats over the canvas.');
  assert.ok(!(await toolbar.innerText()).includes('QGraphFlow'), 'The product name lives only in the document title.');
  assert.equal(await count(page, '#root .brand,#root .heading,#root .topbar,#root .board-head,#root .board-foot'), 0, 'No brand block, second header bar, board header or footer remains.');
  const toolbarHeight = await toolbar.evaluate(element => element.getBoundingClientRect().height);
  assert.equal(toolbarHeight, 52, 'The toolbar is 52px tall.');
  assert.equal(await page.locator('.canvas').evaluate(element => element.getBoundingClientRect().top), 0, 'The canvas starts at the window top and runs under the toolbar.');
  assert.equal(await toolbar.locator('.btn-primary').count(), 0, 'The toolbar has no playback button.');
  assert.equal(await count(page, '.react-flow__attribution'), 0, 'The public hideAttribution option removes the canvas attribution.');
  const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
  assert.match(favicon, /^data:image\/svg\+xml,/, 'Favicon is an offline SVG.');
  const dimensions = await page.evaluate(async source => {
    const icon = new Image(); icon.src = source; await icon.decode();
    return { width: icon.naturalWidth, height: icon.naturalHeight };
  }, favicon);
  assert.ok(dimensions.width > 0 && dimensions.height > 0, 'Favicon decodes successfully.');
  return { product: 'QGraphFlow', documentTitle, toolbarHeight, favicon: { inline: true, decoded: true, ...dimensions } };
}
async function theme(page, value) {
  await openMore(page);
  await page.getByRole('radio', { name: {system: '跟随系统', light: '浅色', dark: '深色'}[value], exact: true }).click(); await dismiss(page);
  if (value !== 'system') await page.waitForFunction(value => document.documentElement.dataset.theme === value, value);
}
async function fit(page) { await button(page, '适应画布').click(); await page.waitForTimeout(360); }
async function blankPoint(page) {
  const point = await page.locator('.react-flow__pane').evaluate(pane => {
    const box = pane.getBoundingClientRect();
    return [.12, .5, .95].flatMap(y => [.05, .5, .95].map(x => ({ x: box.x + box.width * x, y: box.y + box.height * y })))
      .find(({ x, y }) => document.elementFromPoint(x, y) === pane) ?? Array.from({ length: Math.ceil(box.height / 24) }, (_, row) => row * 24 + 72).flatMap(y => Array.from({ length: Math.ceil(box.width / 24) }, (_, col) => ({ x: col * 24 + 12, y }))).find(({ x, y }) => x < innerWidth - 8 && y < innerHeight - 8 && document.elementFromPoint(x, y) === pane);
  });
  assert.ok(point, 'An uncovered blank canvas point is available outside the toolbar and floats.');
  return point;
}
async function pulse(page) {
  const value = await page.locator('.selection-outline').first().getAttribute('data-selection-pulse');
  assert.ok(value !== null && Number.isInteger(Number(value)), 'Selection exposes a stable numeric pulse token.');
  return Number(value);
}
async function selection(page, graph, id) {
  await page.waitForFunction(id => document.querySelector('.diagram-node.is-selected')?.closest('[data-id]')?.dataset.id === id, id);
  assert.equal(await count(page, '.diagram-node.is-selected'), 1);
  assert.equal(await count(page, '.selection-outline'), 1);
  const edges = graph.edges.filter(edge => edge.source === id || edge.target === id).map(edge => edge.id).sort();
  const actual = await page.locator('.react-flow__edge').evaluateAll(elements => elements.filter(element => element.querySelector('.selection-edge-shine')).map(element => element.dataset.id).sort());
  assert.deepEqual(actual, edges, 'Exactly the directly incident relationships are highlighted, including each self-loop once.');
  const feedback = await page.locator('.react-flow__edge').evaluateAll(elements => elements.map(element => {
    const base = element.querySelector('.react-flow__edge-path');
    const overlays = [...element.querySelectorAll('.selection-edge-halo,.selection-edge-shine')];
    return { id: element.dataset.id, path: base.getAttribute('d'), overlays: overlays.map(overlay => ({ d: overlay.getAttribute('d'), markerStart: overlay.getAttribute('marker-start'), markerEnd: overlay.getAttribute('marker-end'), pointer: getComputedStyle(overlay).pointerEvents })) };
  }));
  for (const edge of feedback) {
    assert.equal(edge.overlays.length, edges.includes(edge.id) ? 2 : 0);
    for (const overlay of edge.overlays) {
      assert.equal(overlay.d, edge.path, 'Highlight reuses the exact current route.');
      assert.equal(overlay.markerStart, null); assert.equal(overlay.markerEnd, null);
      assert.equal(overlay.pointer, 'none');
    }
  }
  assert.equal(await count(page, '.diagram-node.is-dimmed'), 0, 'Selection does not dim unrelated nodes.');
  assert.ok(await page.locator('.react-flow__edge').evaluateAll(elements => elements.every(element => Number(getComputedStyle(element).opacity) === 1)), 'Selection does not dim unrelated relationships.');
  const overflow = await page.locator('.edge-label').evaluateAll(labels => labels.flatMap(label => {
    const box = label.getBoundingClientRect();
    return [...label.children].flatMap(line => {
      const range = document.createRange(); range.selectNodeContents(line); const text = range.getBoundingClientRect();
      return text.left < box.left - 1 || text.right > box.right + 1 || text.top < box.top - 1 || text.bottom > box.bottom + 1 ? [{ text: line.textContent, width: text.width, available: box.width }] : [];
    });
  }));
  assert.deepEqual(overflow, [], 'Highlighted relationship labels stay inside the shared label bounds.');
}
async function geometry(page) {
  return page.evaluate(() => ({
    nodes: [...document.querySelectorAll('.react-flow__node-diagram')].map(element => ({ id: element.dataset.id, position: { x: new DOMMatrix(element.style.transform).e, y: new DOMMatrix(element.style.transform).f }, width: element.style.width, height: element.style.height, innerTransform: getComputedStyle(element.querySelector('.diagram-node')).transform })),
    edges: [...document.querySelectorAll('.react-flow__edge-path')].map(element => ({ id: element.id, d: element.getAttribute('d'), start: element.getAttribute('marker-start'), end: element.getAttribute('marker-end') }))
  }));
}
async function settledViewport(page) {
  await page.locator('.react-flow__viewport').evaluate(element => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Viewport did not settle before pointer input')), 5000);
    let previous = '', frames = 0;
    const check = () => {
      const current = getComputedStyle(element).transform;
      frames = current === previous ? frames + 1 : 0; previous = current;
      if (frames >= 3) { clearTimeout(timeout); resolve(); } else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }));
}
async function assertFlow(page, enabled = true) {
  const running = enabled && !await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  assert.ok(await page.locator('.edge-flow').evaluateAll((elements, running) => elements.every(element => getComputedStyle(element).animationPlayState === (running ? 'running' : 'paused')), running), 'The independent switch and reduced motion control ambient edge flow.');
}
async function assertInspector(page, node) {
  assert.ok(node, 'The inspector resolves to a real graph node.');
  const card = page.locator('.drawer-body');
  assert.equal(await card.locator('h2').innerText(), node.label);
  const actual = await page.locator('.inspector').evaluate(element => {
    const norm = value => (value ?? '').replace(/\s+/g, ' ').trim();
    const items = names => {
      const heading = [...element.querySelectorAll('h3')].find(e => names.includes(e.textContent));
      return heading?.nextElementSibling?.tagName === 'UL'
        ? [...heading.nextElementSibling.children].map(e => norm(e.textContent)) : [];
    };
    return {
      subtitle: norm(element.querySelector('.drawer-subtitle')?.textContent),
      facts: items(['证据事实', '节点说明']), fields: items(['字段']),
      attributes: items(['属性']), methods: items(['方法']),
      source: norm(element.querySelector('.source-path')?.textContent),
      symbol: norm(element.querySelector('.symbol')?.textContent),
      tags: [...element.querySelectorAll('.tags span')].map(e => norm(e.textContent))
    };
  });
  const norm = value => (value ?? '').replace(/\s+/g, ' ').trim();
  assert.deepEqual(actual, {
    subtitle: norm(node.subtitle), facts: (node.facts ?? []).map(norm),
    fields: (node.fields ?? []).map(f => norm(`${f.key ?? ''} ${f.name}: ${f.type}${f.nullable === false ? ' · NOT NULL' : f.nullable === true ? ' · NULL' : ''}`)),
    attributes: (node.attributes ?? []).map(norm), methods: (node.methods ?? []).map(norm),
    source: node.source ? norm(`${node.source.file}:${node.source.lineStart}${node.source.lineEnd ? `-${node.source.lineEnd}` : ''}`) : '',
    symbol: norm(node.source?.symbol), tags: (node.tags ?? []).map(norm)
  }, `Complete Inspector contents: ${node.id}`);
  assert.equal(await card.getAttribute('data-node-id'), node.id);
  const facts = page.locator('.inspector-facts');
  assert.equal(await facts.count(), node.facts?.length ? 1 : 0, 'Facts have one dedicated final section, only when populated.');
  if (node.facts?.length) {
    assert.equal(await facts.locator('h3').innerText(), node.source ? '证据事实' : '节点说明');
    assert.equal(await facts.getAttribute('data-node-id'), node.id);
    assert.ok(await facts.evaluate(element => element === element.parentElement.lastElementChild), 'Facts are the last Inspector section.');
    assert.equal(await card.getByRole('heading', { name: /^(证据事实|节点说明)$/ }).count(), 0, 'Facts are not duplicated in the first card.');
  }
}

async function assertLegendLayout(page) {
  await openLegend(page);
  assert.equal(await count(page, '.legend'), 1, 'There is one reading legend.');
  assert.equal(await count(page, '.legend-pop .legend'), 1, 'The reading legend lives in the legend popover.');
  assert.equal(await count(page, '.board-head,.toolbar .legend,.nav .legend,.inspector .legend'), 0, 'No board header or duplicate legend remains.');
  const bounds = await page.getByRole('group', { name: '阅读图例', exact: true }).evaluate(element => {
    const pop = element.closest('.legend-pop').getBoundingClientRect(), anchor = element.closest('.legend-anchor').querySelector('.float-btn').getBoundingClientRect();
    const canvas = document.querySelector('.canvas').getBoundingClientRect(), style = getComputedStyle(element);
    const overlaps = [...document.querySelectorAll('.react-flow__controls,.react-flow__minimap')].filter(control => {
      const b = control.getBoundingClientRect();
      return b.width && b.height && pop.left < b.right && pop.right > b.left && pop.top < b.bottom && pop.bottom > b.top;
    }).map(control => control.className);
    return { button: { x: Math.round(anchor.left - canvas.left), y: Math.round(anchor.top - canvas.top) }, fontSize: getComputedStyle(element.querySelector('span')).fontSize, overlaps,
      inCanvas: pop.left >= canvas.left - 1 && pop.right <= canvas.right + 1 && pop.top >= canvas.top - 1 && pop.bottom <= canvas.bottom + 1, belowButton: pop.top >= anchor.bottom,
      plain: style.position === 'static' && style.boxShadow === 'none' && style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.borderTopWidth === '0px',
      clipped: [...element.querySelectorAll('span')].some(item => { const b = item.getBoundingClientRect(); return b.left < pop.left - 1 || b.right > pop.right + 1 || b.bottom > pop.bottom + 1; }),
      overflow: element.scrollWidth > element.clientWidth + 1, pageOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  assert.ok(bounds.inCanvas && bounds.belowButton, `The legend popover opens below its button inside the canvas: ${JSON.stringify(bounds)}`);
  assert.ok(bounds.plain && !bounds.clipped, 'All legend entries are readable as plain inline content, without a card or clipping.');
  assert.deepEqual(bounds.overlaps, [], 'The legend popover does not cover canvas controls.');
  assert.equal(bounds.overflow || bounds.pageOverflow, false, 'Legend text wraps without horizontal overflow.');
  await dismiss(page);
  assert.equal(await count(page, '.legend'), 0, 'Escape closes the legend popover.');
  return { button: bounds.button, fontSize: bounds.fontSize };
}
async function assertLegendEntries(page, graph, colorTheme) {
  await openLegend(page);
  const palette = PALETTES[colorTheme], legend = graphLegend(graph, palette, moduleColorMap(graphs, palette));
  const actualLegend = await page.locator('.legend-pop .legend span').evaluateAll(elements => elements.map(element => ({ text: element.textContent, fill: element.querySelector('i')?.style.backgroundColor ?? 'transparent', border: element.querySelector('i')?.style.borderColor ?? getComputedStyle(element.querySelector('svg')).color, symbol: `legend-${element.dataset.legendShape}`, lineStyle: element.querySelector('i') ? getComputedStyle(element.firstElementChild).borderTopStyle : 'solid' })));
  const rgb = color => color ? `rgb(${color.slice(1).match(/../g).map(value => parseInt(value, 16)).join(', ')})` : 'transparent';
  assert.deepEqual(actualLegend, legend.map(entry => ({ text: entry.label, fill: rgb(entry.fill), border: rgb(entry.stroke), symbol: `legend-${entry.shape}`, lineStyle: entry.shape === 'dashed' ? 'dashed' : 'solid' })), 'Each legend label retains its original leading symbol, line style and theme colors.');
  const flowSwitch = page.getByRole('switch', { name: '连线流动', exact: true });
  assert.equal(await flowSwitch.count(), graph.edges.some(edge => hasArrow(edge, graph.meta.diagramType)) ? 1 : 0, 'The flow switch sits in the legend popover exactly when directed relationships exist.');
  await dismiss(page);
}
async function searchSelect(page, graph, selected, keyboard = false) {
  await dismiss(page);

  await page.locator('#search').fill(`  ${selected.label.toUpperCase()}  `);
  const result = page.locator('.results button').first();
  await page.waitForFunction(label => document.querySelector('.results button')?.textContent.includes(label), selected.label);
  assert.ok((await result.innerText()).includes(selected.label));
  assert.ok(await count(page, '.results button') <= 8, 'Search shows at most eight results.');
  await result.evaluate(element => {
    window.__qaActivated = false;
    element.addEventListener('click', () => { window.__qaActivated = true; }, { once: true, capture: true });
  });
  if (keyboard) { await result.focus(); await page.keyboard.press('Enter'); } else await result.click();
  assert.equal(await page.evaluate(() => window.__qaActivated), true, 'Search selection reaches the native button activation.');
  await page.locator('.results').waitFor({ state: 'detached' });
  await selection(page, graph, selected.id);
  if (page.viewportSize().width <= 700) await page.locator('.nav').waitFor({ state: 'detached' });
  await assertFlow(page);
  await page.locator('.inspector').waitFor();
  await assertInspector(page, selected);
  assert.ok(await page.locator('.inspector').evaluate(element => element.scrollWidth <= element.clientWidth + 1));
}
async function assertSelectedDetails(page, graph) {
  const id = await page.locator('.diagram-node.is-selected').evaluate(e => e.closest('[data-id]').dataset.id);
  await ensureInspector(page);
  await assertInspector(page, graph.nodes.find(node => node.id === id));
}
async function clear(page, method = 'Escape') {
  if (method === 'Escape') {
    // Escape only gives up one layer: close any popover first and leave the panels, so the key reaches the selection.
    await dismiss(page);
    await page.locator('#more-menu-button').focus();
    await page.keyboard.press('Escape');
  }
  else if (method === 'close') await button(page, '关闭详情').click();
  else { await page.waitForTimeout(450); const point = await blankPoint(page); await page.mouse.click(point.x, point.y); }
  await page.waitForFunction(() => !document.querySelector('.selection-outline,.selection-edge-shine,.diagram-node.is-selected'));
  await page.locator('.inspector').waitFor({ state: 'detached' });
  await assertFlow(page);
}
async function assertShape(page, graph, selected) {
  const node = nodeElement(page, selected.id), outline = node.locator('.selection-outline');
  assert.ok(await outline.evaluate(element => [...element.querySelectorAll('path,rect,circle,ellipse,polygon,polyline')].some(shape => shape.getAttribute('fill') === 'none' || getComputedStyle(shape).fill === 'none')), 'Selection traces a shape without replacing its fill.');
  if (graph.meta.diagramType === 'sequence') {
    assert.equal(await node.locator('.diagram-node').evaluate(element => getComputedStyle(element).boxShadow), 'none', 'Lifelines do not get full-card shadows.');
    const dimensions = await outline.evaluate(element => ({ height: element.getBoundingClientRect().height, parent: element.closest('.diagram-node').getBoundingClientRect().height }));
    assert.ok(dimensions.height < dimensions.parent, 'Sequence feedback is restricted to the participant head.');
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page overflow.');
}
async function assertNodeDrawing(page, graph, colorTheme) {
  const palette = PALETTES[colorTheme], moduleColors = moduleColorMap(graphs, palette);
  const fragmentTexts = await page.locator('.fragment-text text').evaluateAll(elements => elements.map(element => ({
    text: element.textContent, body: Boolean(element.closest('.operand-body')), fill: getComputedStyle(element).fill, font: parseFloat(getComputedStyle(element).fontSize)
  })));
  const fragmentColor = `rgb(${palette.ink2.slice(1).match(/../g).map(value => parseInt(value, 16)).join(', ')})`;
  for (const text of fragmentTexts) {
    assert.equal(text.fill, fragmentColor, `Fragment text preserves ${colorTheme} theme contrast: ${text.text}`);
    assert.equal(text.font, text.body ? TYPOGRAPHY.body : TYPOGRAPHY.small, 'Fragment text uses the shared export typography.');
  }
  const fragmentOverlaps = await page.evaluate(() => {
    const headings = [...document.querySelectorAll('.boundary > span')];
    return [...document.querySelectorAll('.operand-guard,.operand-body')].flatMap(operand => {
      const a = operand.getBoundingClientRect();
      return headings.filter(heading => {
        const b = heading.getBoundingClientRect();
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      }).map(heading => ({ heading: heading.textContent, operand: operand.textContent }));
    });
  });
  assert.deepEqual(fragmentOverlaps, [], 'Fragment conditions and body text avoid the final heading positions.');
  for (const [id, pair] of sequencePairs(graph)) {
    const expected = sequenceGroupColor(pair, palette);
    const actual = await page.locator('.react-flow__edge').and(page.locator(`[data-id=${JSON.stringify(id)}]`)).evaluate(root => {
      const path = root.querySelector('.react-flow__edge-path');
      return { base: path.style.stroke, overlays: [...root.querySelectorAll('.edge-flow,.selection-feedback')].map(element => element.style.stroke) };
    });
    // Use CSS normalization for the same authored color, then compare every active layer.
    const color = await page.evaluate(value => { const element = document.createElement('i'); element.style.color = value; return element.style.color; }, expected);
    assert.equal(actual.base, color, `Message ${id} retains its call group color.`);
    assert.ok(actual.overlays.every(value => value === color));
    assert.equal(await page.locator(`[data-edge-id=${JSON.stringify(id)}] .pair-label`).innerText(), pair.label);
  }
  for (const node of graph.nodes) {
    const expected = renderNode({ ...node, executionRects: sequenceExecutions(graph).filter(item => item.participantId === node.id).map(item => ({ ...item, x: item.x - node.position.x, y: item.y - node.position.y, color: sequenceGroupColor(sequencePairs(graph).get(item.start.edgeId), palette) ?? palette.edge })) }, graph.meta.diagramType, -node.position.x, -node.position.y, palette, undefined, moduleColors);
    const same = await nodeElement(page, node.id).locator('.node-drawing').evaluate((element, xml) => {
      const expected = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${xml}</svg>`, 'image/svg+xml').querySelector('.node-drawing');
      // Compare parsed DOMs: serialization differences must not hide drawing differences.
      const tree = node => ({ tag: node.localName, attrs: [...node.attributes].filter(a => a.name !== 'xmlns').map(a => [a.name, a.value]).sort(), text: [...node.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(''), children: [...node.children].map(tree) });
      return JSON.stringify(tree(element)) === JSON.stringify(tree(expected));
    }, expected);
    assert.ok(same, `Page node ${node.id} uses the exact shared export drawing.`);
    const minimapTags = await page.locator(`.react-flow__minimap-node[data-node-id=${JSON.stringify(node.id)}] .node-surface`).evaluateAll(elements => elements.map(element => element.localName));
    assert.deepEqual(minimapTags, getDiagram(graph.meta.diagramType).outline(node, 0, 0).map(([tag]) => tag), `MiniMap node ${node.id} uses the diagram outline.`);
    const texts = await nodeElement(page, node.id).locator('.node-visual text').evaluateAll(elements => elements.map(element => {
      const b = element.getBBox(), style = getComputedStyle(element);
      return { text: element.textContent, cls: element.getAttribute('class'), font: parseFloat(style.fontSize), fill: style.fill, x: b.x, y: b.y, width: b.width, height: b.height };
    }));
    const compact = getDiagram(graph.meta.diagramType).cardLayout && node.size.height < 100;
    for (const text of texts) {
      if (!compact) assert.ok(text.font >= TYPOGRAPHY.small, `Readable shared typography: ${node.id} ${text.cls}`);
      assert.ok(text.x >= -1 && text.y >= -1 && text.x + text.width <= node.size.width + 1 && text.y + text.height <= node.size.height + 1, `Node text stays inside its authored bounds: ${node.id} ${text.text}`);
      if (['title', 'shape-title', 'participant-title', 'entity-title'].includes(text.cls)) {
        const color = isCore(node) && node.kind !== 'actor' ? palette.heroInk : palette.ink;
        const rgb = `rgb(${color.slice(1).match(/../g).map(value => parseInt(value, 16)).join(', ')})`;
        assert.equal(text.fill, rgb, `Title preserves its semantic contrast: ${node.id}`);
      }
    }
    if (!['initial', 'final'].includes(node.kind)) assert.ok(texts.length > 0, `Node ${node.id} renders readable text.`);
  }
}

async function download(page, format, name) {
  await openMore(page);
  const [result] = await Promise.all([page.waitForEvent('download'), menuItem(page, `导出 ${format}`).click()]);
  await page.locator('.menu.is-right[role="menu"]').waitFor({ state: 'detached' });
  const filename = path.join(outputRoot, 'exports', `${name}.${format.toLowerCase()}`); await result.saveAs(filename);
  assert.equal(await result.failure(), null); assert.ok(fs.statSync(filename).size > 300); return filename;
}
function points(d) {
  const tokens = d.match(/[MHVL]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi), result = []; let x = 0, y = 0;
  for (let index = 0; index < tokens.length;) {
    const command = tokens[index++];
    if (command === 'M' || command === 'L') { x = +tokens[index++]; y = +tokens[index++]; }
    else if (command === 'H') x = +tokens[index++]; else if (command === 'V') y = +tokens[index++]; else throw Error(`Unsupported route command ${command}`);
    result.push({ x, y });
  }
  return result;
}
async function exportsMatch(page, graph, name) {
  const svgFile = await download(page, 'SVG', name), pngFile = await download(page, 'PNG', name);
  const svg = fs.readFileSync(svgFile, 'utf8'), png = fs.readFileSync(pngFile);
  assert.ok(!/selection-outline|selection-edge-|playback-feedback|playback-outline|sequence-flow-|edge-flow|<mask/.test(svg), 'Exports omit transient selection, flow and masks.');
  assert.match(svg, /MIT License/); assert.match(svg, /WorkOS/);
  const parsed = await page.evaluate(async xml => {
    const document = new DOMParser().parseFromString(xml, 'image/svg+xml');
    if (document.querySelector('parsererror')) throw Error('Invalid SVG XML');
    const root = document.documentElement;
    const edges = [...root.children].filter(element => element.tagName === 'g' && element.firstElementChild?.tagName === 'path' && element.firstElementChild.getAttribute('stroke-width') === '1.5' && element.firstElementChild.getAttribute('fill') === 'none');
    const paths = edges.map(element => element.firstElementChild.getAttribute('d'));
    const notation = edges.map(element => ({ dashed: element.firstElementChild.hasAttribute('stroke-dasharray'), arrow: element.firstElementChild.hasAttribute('marker-end'),
      start: element.firstElementChild.getAttribute('marker-start'), end: element.firstElementChild.getAttribute('marker-end'),
      label: [...element.querySelectorAll(':scope > text')].map(text => text.textContent).join(''),
      multiplicities: [...element.querySelectorAll('.edge-multiplicity')].map(item => [item.dataset.endpoint, item.textContent]) }));
    const lifelines = [...root.querySelectorAll('.lifeline')].map(element => element.getAttribute('d'));
    const image = new Image(); image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml); await image.decode();
    const executions = [...root.querySelectorAll('.sequence-execution')].map(element => ({ id: element.dataset.executionId, x: +element.getAttribute('x'), y: +element.getAttribute('y'), width: +element.getAttribute('width'), height: +element.getAttribute('height'), color: element.getAttribute('stroke') }));
    return { title: document.querySelector('title')?.textContent, width: image.naturalWidth, height: image.naturalHeight, paths, notation, lifelines, executions, colors: edges.map(element => element.firstElementChild.getAttribute('stroke')) };
  }, svg);
  assert.equal(parsed.title, graph.meta.title); assert.equal(parsed.paths.length, graph.edges.length);
  const pageNotation = await page.locator('.react-flow__edge').evaluateAll(elements => elements.map(element => {
    const path = element.querySelector('.react-flow__edge-path');
    return { id: element.dataset.id, dashed: getComputedStyle(path).strokeDasharray !== 'none', start: path.getAttribute('marker-start'), end: path.getAttribute('marker-end'),
      multiplicities: [...element.querySelectorAll('.edge-multiplicity')].map(item => [item.dataset.endpoint, item.textContent]) };
  }));
  const routes = createEdgeRoutes(graph);
  graph.edges.forEach((edge, index) => {
    const exported = parsed.notation[index], rendered = pageNotation.find(item => item.id === edge.id), markers = edgeMarkers(edge, graph.meta.diagramType);
    assert.equal(exported.dashed, rendered.dashed, `${edge.id}: page and SVG retain line notation`);
    for (const end of ['start', 'end']) {
      assert.equal(Boolean(exported[end]), Boolean(markers[end]), `${edge.id}: SVG ${end} marker`);
      assert.equal(Boolean(rendered[end]), Boolean(markers[end]), `${edge.id}: page ${end} marker`);
      if (markers[end] && markers[end] !== 'arrow') {
        assert.ok(exported[end].includes(`#${markers[end]})`));
        assert.ok(rendered[end].includes(`#codegraph-${markers[end]})`));
      }
    }
    assert.equal(exported.label, routes.get(edge.id).labelLines.join(''), `${edge.id}: full relationship text includes all declared event, guard and action text`);
    const multiplicities = (routes.get(edge.id).endpointLabels ?? []).map(item => [item.role, item.label]);
    assert.deepEqual(exported.multiplicities, multiplicities); assert.deepEqual(rendered.multiplicities, multiplicities);
  });
  const pagePaths = await page.locator('.react-flow__edge-path').evaluateAll(elements => elements.map(element => element.getAttribute('d')));
  let offset;
  for (let index = 0; index < pagePaths.length; index++) {
    const a = points(pagePaths[index]), b = points(parsed.paths[index]); assert.equal(a.length, b.length);
    offset ??= { x: b[0].x - a[0].x, y: b[0].y - a[0].y };
    for (let point = 0; point < a.length; point++) assert.ok(Math.abs(b[point].x - a[point].x - offset.x) < .01 && Math.abs(b[point].y - a[point].y - offset.y) < .01, 'Page and exported routes differ beyond the common export offset.');
  }
  assert.ok(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  const pngSize = await page.evaluate(async value => { const image = new Image(); image.src = 'data:image/png;base64,' + value; await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight }; }, png.toString('base64'));
  assert.equal(pngSize.width, png.readUInt32BE(16)); assert.equal(pngSize.height, png.readUInt32BE(20));
  assert.ok(Math.abs(pngSize.width - parsed.width) <= 1 && Math.abs(pngSize.height - parsed.height) <= 1);
  const sequence = getDiagram(graph.meta.diagramType).sequence;
  if (sequence) {
    const palette = PALETTES[await page.locator('html').getAttribute('data-theme')], pairs = sequencePairs(graph);
    const executions = sequenceExecutions(graph);
    assert.equal(parsed.executions.length, executions.length);
    for (const item of executions) {
      const actual = parsed.executions.find(value => value.id === item.id);
      assert.ok(actual && Math.abs(actual.x - item.x - offset.x) < .01 && Math.abs(actual.y - item.y - offset.y) < .01);
      assert.equal(actual.width, item.width); assert.equal(actual.height, item.height);
      assert.equal(actual.color, sequenceGroupColor(pairs.get(item.start.edgeId), palette) ?? palette.edge);
    }
    graph.edges.forEach((edge, index) => { if (pairs.has(edge.id)) assert.equal(parsed.colors[index], sequenceGroupColor(pairs.get(edge.id), palette)); });
    const pageNotation = await page.locator('.react-flow__edge-path').evaluateAll(elements => elements.map(element => ({ dashed: getComputedStyle(element).strokeDasharray !== 'none', arrow: element.hasAttribute('marker-end') })));
    parsed.notation.forEach((edge, index) => {
      assert.deepEqual({ dashed: edge.dashed, arrow: edge.arrow }, pageNotation[index], `${graph.edges[index].id}: export and page agree on dashes and arrows`);
      assert.equal(edge.label, createEdgeRoutes(graph).get(graph.edges[index].id).labelLines.join(''), 'Export preserves pairing or legacy message labels.');
    });
    const current = await geometry(page);
    assert.equal(parsed.lifelines.length, graph.nodes.length);
    parsed.lifelines.forEach((line, index) => {
      const [start, end] = points(line), node = current.nodes[index];
      assert.ok(Math.abs(end.y - start.y - (Number.parseFloat(node.height) - sequenceHeaderHeight(graph.nodes[index]))) < .01, 'Export retains the full authored lifeline length.');
      assert.ok(Math.abs(end.y - node.position.y - Number.parseFloat(node.height) - offset.y) < .01, 'Export retains the lifeline endpoint.');
    });
    const pixelDifference = await page.evaluate(async ({ svg, png }) => {
      const sources = ['data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), 'data:image/png;base64,' + png];
      const pixels = await Promise.all(sources.map(async source => {
        const image = new Image(); image.src = source; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); return context.getImageData(0, 0, canvas.width, canvas.height).data;
      }));
      return pixels[0].reduce((sum, value, index) => sum + Math.abs(value - pixels[1][index]), 0);
    }, { svg, png: png.toString('base64') });
    assert.equal(pixelDifference, 0, 'PNG pixels exactly reproduce the semantic SVG, including arrows, gaps and lifelines.');
  }
  report.exports.push({ name, svg: svgFile, png: pngFile, svgSha256: digest(svgFile), pngSha256: digest(pngFile), ...pngSize, pathParity: true, decoded: true, notationParity: true, ...(sequence ? { lifelineParity: true, pngPixelParity: true } : {}) });
  return { svgFile, pngFile };
}
async function runCase(browser, name, viewport, options, run, extra = false) {
  if (extra && process.env.QA_EXTRAS && !process.env.QA_EXTRAS.split(',').some(value => name === value || name.endsWith('-' + value))) return;
  if ((extra ? report.extra : report.cases).some(item => item.name === name && item.passed)) { console.log('REUSE', name); return; }
  const context = await browser.newContext({ viewport, deviceScaleFactor: Number(process.env.QA_DPR ?? 1), acceptDownloads: true, reducedMotion: 'no-preference', ...options });
  const traced=!/motion-matrix|motion-preferences|flow-contrast/.test(name);
  if(traced)await context.tracing.start({ screenshots: false, snapshots: false });
  const page = await context.newPage(); page.qaSteps = []; page.setDefaultTimeout(10000); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    const evidence = await run(page, context); assert.deepEqual(errors, [], 'Browser errors.');
    (extra ? report.extra : report.cases).push({ name, ...viewport, ...evidence, steps: page.qaSteps, trace: traced ? `traces/${name}.zip` : undefined, passed: true }); console.log('PASS', name);
  } catch (error) {
    await page.screenshot({ path: path.join(outputRoot, 'failures', name + '.png'), animations: 'disabled' }).catch(() => {});
    (extra ? report.extra : report.cases).push({ name, ...viewport, steps: page.qaSteps, failedOperations: page.qaPending, trace: traced ? `traces/${name}.zip` : undefined, passed: false, error: error.message });
    report.failures.push({ name, message: error.message, stack: error.stack, console: errors }); console.error('FAIL', name, error.stack);
  } finally { try { if(traced)await context.tracing.stop({ path: path.join(outputRoot, 'traces', name + '.zip') }); } finally { await context.close(); writeReport(); } }
}

async function exportFailureChecks(browser, url, graph, viewport=viewports[0], colorTheme='light') {
  await runCase(browser, `${graph.meta.diagramType}-${viewport.width}-${colorTheme}-export-failures`, viewport, {}, async page => {
    await page.goto(url); await chooseGraph(page, graph, viewport.width<=700); await theme(page,colorTheme);
    const downloads = [];
    page.on('download', item => downloads.push(item));
    const failures = [
      ...(graph.groups?.length ? [['missing-group-heading', /文字未完整显示/]] : []),
      ...(graph.meta.diagramType === 'sequence' && graph.groups?.some(group => group.operands?.length) ? [['missing-operand-guard', /文字未完整显示/], ['guard-outside-safe-area', /文字超出安全区/]] : []),
      ...(graph.meta.diagramType === 'er' ? [['missing-crowfoot', /基数标记缺失/], ['crowfoot-outside-safe-area', /基数标记越界/]] : []),
      ['context', /无法创建 PNG 画布/], ['blank', /空白 PNG/],
      ['blob', /未能生成 PNG/], ['decode', /injected PNG decode failure/],
      ['limit', /PNG 导出上限/], ['glyph', /文字越界|安全区/],
      ...([...createEdgeRoutes(graph).values()].some(route => route.label) ? [['edge-overflow', /文字越界|关系文字超出安全区/], ['missing-edge-text', /关系文字未完整显示/]] : []),
      ...(graph.edges.some(edge => Object.values(edgeMarkers(edge, graph.meta.diagramType)).some(Boolean)) ? [['oversized-marker', /关系标记越界或遮挡/], ['missing-marker', /关系标记缺失/]] : [])
    ];
    for (const [mode, expected] of failures) {
      await page.evaluate(mode => {
        const originals = { getContext: HTMLCanvasElement.prototype.getContext, drawImage: CanvasRenderingContext2D.prototype.drawImage,
          toBlob: HTMLCanvasElement.prototype.toBlob, createImageBitmap: window.createImageBitmap,
          naturalWidth: Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'naturalWidth'), getBBox: SVGGraphicsElement.prototype.getBBox, parse: DOMParser.prototype.parseFromString };
        window.restoreExportProbe = () => {
          HTMLCanvasElement.prototype.getContext = originals.getContext; CanvasRenderingContext2D.prototype.drawImage = originals.drawImage;
          HTMLCanvasElement.prototype.toBlob = originals.toBlob; window.createImageBitmap = originals.createImageBitmap;
          Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', originals.naturalWidth); SVGGraphicsElement.prototype.getBBox = originals.getBBox;
          DOMParser.prototype.parseFromString = originals.parse;
        };
        if (mode === 'context') HTMLCanvasElement.prototype.getContext = () => null;
        if (mode === 'blank') CanvasRenderingContext2D.prototype.drawImage = () => {};
        if (mode === 'blob') HTMLCanvasElement.prototype.toBlob = callback => callback(null);
        if (mode === 'decode') window.createImageBitmap = async () => { throw new Error('injected PNG decode failure'); };
        if (mode === 'limit') Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 40000 });
        if (mode === 'glyph') SVGGraphicsElement.prototype.getBBox = function () { const box = originals.getBBox.call(this); return this.tagName === 'text' ? { ...box, x: box.x, y: box.y, width: 1e6, height: box.height } : box; };
        if (['edge-overflow', 'missing-edge-text', 'oversized-marker', 'missing-marker', 'missing-group-heading', 'missing-operand-guard', 'guard-outside-safe-area', 'missing-crowfoot', 'crowfoot-outside-safe-area'].includes(mode)) DOMParser.prototype.parseFromString = function (source, type) {
          const document = originals.parse.call(this, source, type);
          if (type === 'image/svg+xml') {
            if (mode === 'missing-group-heading') document.querySelector('[data-diagram-group-id] text.group').remove();
            if (mode === 'missing-operand-guard') document.querySelector('.operand-guard text').remove();
            if (mode === 'guard-outside-safe-area') { const guard = document.querySelector('.operand-guard'); guard.querySelector('text').setAttribute('transform', `translate(${Number(guard.querySelector('rect').getAttribute('width')) + 16} 0)`); }
            if (mode === 'missing-crowfoot') document.querySelector('[data-cardinality-endpoint]').remove();
            if (mode === 'crowfoot-outside-safe-area') { const mark = document.querySelector('[data-cardinality-endpoint]'); mark.setAttribute('transform', mark.getAttribute('transform') + ' translate(40 0)'); }
            if (mode === 'edge-overflow') document.querySelector('text.edge').setAttribute('transform', 'translate(400 0)');
            if (mode === 'missing-edge-text') document.querySelector('text.edge').remove();
            if (mode.includes('marker')) {
              const line = document.querySelector('[marker-end],[marker-start]'), id = /#([^)]*)/.exec(line.getAttribute('marker-end') ?? line.getAttribute('marker-start'))[1];
              const marker = document.getElementById(id);
              if (mode === 'missing-marker') marker.remove();
              else { marker.setAttribute('markerWidth', '900'); marker.setAttribute('markerHeight', '900'); }
            }
          }
          return document;
        };
      }, mode);
      for (const format of ['edge-overflow', 'missing-edge-text', 'oversized-marker', 'missing-marker', 'missing-group-heading', 'missing-operand-guard', 'guard-outside-safe-area', 'missing-crowfoot', 'crowfoot-outside-safe-area'].includes(mode) ? ['SVG', 'PNG'] : [mode === 'glyph' ? 'SVG' : 'PNG']) {
        const before = downloads.length;
        await openMore(page); await menuItem(page, `导出 ${format}`).click();
        await page.waitForFunction(source => new RegExp(source).test(document.querySelector('.toast')?.textContent), expected.source);
        assert.equal(downloads.length, before, `${mode}/${format}: no file is downloaded after failure`);
        if(!['context','blank','blob','decode','limit'].includes(mode)){await page.locator('.layout-problems').waitFor();assert.ok(await count(page,'.layout-problems li button'),'Rendered failures expose an actionable element location');}
        await page.screenshot({ path: path.join(outputRoot, 'screens', `${graph.meta.diagramType}-${viewport.width}-${colorTheme}-export-failure-${mode}-${format}.png`) });
      }
      await page.evaluate(() => window.restoreExportProbe());
    }
    const recovered = await exportsMatch(page, graph, `${graph.meta.diagramType}-${viewport.width}-${colorTheme}-export-failure-recovery`);
    return { type: graph.meta.diagramType, theme:colorTheme, operations:['I21.10','I21.11','I21.12','I21.13'], faults: failures.map(([mode]) => mode), rejectedWithoutDownload: true, recovered };
  }, true);
}

async function saveFailureChecks(browser, url, graph) {
  await runCase(browser, 'save-failures', viewports[0], {}, async page => {
    await page.goto(url); await chooseGraph(page, graph, false); await hidePanels(page); await setLocked(page, false);
    await nodeElement(page, target(graph).id).focus(); await page.keyboard.press('Enter');
    await button(page, '编辑文字').click();
    const label = target(graph).label + ' saved draft';
    await page.getByRole('textbox', { name: '名称', exact: true }).fill(label); await button(page, '保存').click();
    const expected = structuredClone(input), current = (expected.diagrams ?? [expected]).find(item => item.meta.diagramType === graph.meta.diagramType);
    current.nodes.find(node => node.id === target(graph).id).label = label;
    const failures = [];
    for (const phase of ['cancel', 'open', 'write', 'close']) {
      await page.evaluate(phase => {
        window.saveProbe = { phase, aborted: false };
        window.showSaveFilePicker = async () => {
          if (phase === 'cancel') throw new DOMException('Canceled by test', 'AbortError');
          return { createWritable: async () => {
            if (phase === 'open') throw new Error('Injected open failure');
            return { write: async contents => { window.saveProbe.contents = contents; if (phase === 'write') throw new Error('Injected write failure'); },
              close: async () => { throw new Error('Injected close failure'); }, abort: async () => { window.saveProbe.aborted = true; } };
          } };
        };
      }, phase);
      await openMore(page); await menuItem(page, '保存 Graph JSON').click();
      await page.waitForFunction(phase => document.querySelector('.toast')?.textContent.includes(phase === 'cancel' ? '已取消保存' : '保存失败'), phase);
      const probe = await page.evaluate(() => window.saveProbe);
      assert.equal(probe.aborted, ['write', 'close'].includes(phase));
      if (probe.contents) assert.deepEqual(JSON.parse(probe.contents), expected);
      await page.screenshot({ path: path.join(outputRoot, 'screens', `save-${phase}.png`) });
      failures.push({ phase, aborted: probe.aborted, message: await status(page) });
    }
    await page.evaluate(() => { window.showSaveFilePicker = undefined; });
    await openMore(page); const [downloadedFile] = await Promise.all([page.waitForEvent('download'), menuItem(page, '保存 Graph JSON').click()]);
    const savedFile = path.join(outputRoot, 'exports', 'save-failure-recovery.json'); await downloadedFile.saveAs(savedFile);
    assert.deepEqual(JSON.parse(fs.readFileSync(savedFile, 'utf8')), expected, 'Every failed save preserves all current and unrelated model fields.');
    return { failures, savedFile, recovery: 'actual download', injection: 'native API failure substitutes; native success/cancel has separate Mac evidence' };
  }, true);
}

async function strictDraftChecks(browser, url, graph) {
  await runCase(browser, `${graph.meta.diagramType}-strict-draft`, viewports[0], {}, async page => {
    await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
    await page.goto(url); await theme(page, 'light'); await chooseGraph(page, graph, false);
    const selected = graph.nodes.find(node => !['initial', 'final'].includes(node.kind));
    await searchSelect(page, graph, selected); await setLocked(page, false);
    await page.locator('.inspector').getByRole('button', { name: '编辑文字', exact: true }).click();
    const label = page.getByRole('textbox', { name: '名称', exact: true });
    await label.fill('   '); await button(page, '保存').click();
    assert.equal(await page.getByRole('alert').innerText(), '名称不能为空');
    const value = '<>& "中文草稿" ' + 'W'.repeat(240);
    await label.fill(value);
    await label.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true });
    assert.equal(await label.count(), 1, 'Composition confirmation must not submit the draft.');
    await button(page, '保存').click(); await page.locator('.layout-problems').waitFor();
    assert.equal(await page.locator('.drawer-body h2').innerText(), value);
    await page.locator('.layout-problems summary').click();
    assert.ok(await page.locator('.layout-problems li button').count(), 'The invalid draft has actionable element locations.');
    await page.locator('.layout-problems li button').first().click();
    await page.screenshot({ path: path.join(outputRoot, 'screens', `${graph.meta.diagramType}-invalid-draft.png`) });
    const downloads = []; page.on('download', item => downloads.push(item));
    for (const format of ['SVG', 'PNG']) {
      await openMore(page); await menuItem(page, `导出 ${format}`).click();
      await page.waitForFunction(() => document.querySelector('.toast')?.textContent.includes('Diagram quality failed'));
      assert.equal(downloads.length, 0, 'Invalid layout does not start an image download.');
    }
    const save = async suffix => {
      await openMore(page); const [downloadedFile] = await Promise.all([page.waitForEvent('download'), menuItem(page, '保存 Graph JSON').click()]);
      const item = downloadedFile, file = path.join(outputRoot, 'exports', `${graph.meta.diagramType}-${suffix}.json`); await item.saveAs(file);
      assert.equal(await item.failure(), null); return JSON.parse(fs.readFileSync(file, 'utf8'));
    };
    const saved = await save('invalid-draft'), expected = structuredClone(input);
    (expected.diagrams ?? [expected]).find(item => item.meta.diagramType === graph.meta.diagramType).nodes.find(node => node.id === selected.id).label = value;
    assert.deepEqual(saved, expected, 'JSON retains the entire invalid draft without altering other views or route geometry.');
    await openMore(page); await menuItem(page, '重置').click(); await page.locator('.layout-problems').waitFor({ state: 'detached' });
    assert.deepEqual(await save('reset-draft'), input, 'Reset restores the complete embedded model, including route.messageY.');
    await clear(page); await hidePanels(page); await fit(page); await setLocked(page, false);
    const other = graph.nodes.find(node => node.id !== selected.id);
    const shape = nodeElement(page, selected.id).locator('.sequence-head,.participant-head,.actor-figure,.state-dot,.shape-label,header').first();
    const sourceBox = await (await shape.count() ? shape : nodeElement(page, selected.id)).boundingBox();
    const zoom = await page.locator('.react-flow__viewport').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).a);
    const start = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + Math.min(sourceBox.height / 2, 18) };
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(start.x + (other.position.x - selected.position.x) * zoom,
      start.y + (graph.meta.diagramType === 'sequence' ? 0 : other.position.y - selected.position.y) * zoom, { steps: 12 });
    await page.mouse.up(); await page.locator('.layout-problems').waitFor();
    const dragged = await save('invalid-drag'), draggedGraph = (dragged.diagrams ?? [dragged]).find(item => item.meta.diagramType === graph.meta.diagramType);
    const position = draggedGraph.nodes.find(node => node.id === selected.id).position;
    assert.notDeepEqual(position, selected.position, 'A real pointer drag changes the selected node.');
    if (graph.meta.diagramType === 'sequence') assert.equal(position.y, selected.position.y, 'The sequence time axis stays fixed.');
    const dragExpected = structuredClone(input);
    (dragExpected.diagrams ?? [dragExpected]).find(item => item.meta.diagramType === graph.meta.diagramType).nodes.find(node => node.id === selected.id).position = position;
    assert.deepEqual(dragged, dragExpected, 'Dragging retains every unrelated field and the other views.');
    const downloadCount = downloads.length;
    for (const format of ['SVG', 'PNG']) {
      await openMore(page); await menuItem(page, `导出 ${format}`).click();
      await page.waitForFunction(() => document.querySelector('.toast')?.textContent.includes('Diagram quality failed'));
      assert.equal(downloads.length, downloadCount, 'Overlapping dragged nodes block both image formats.');
    }
    await page.screenshot({ path: path.join(outputRoot, 'screens', `${graph.meta.diagramType}-invalid-drag.png`) });
    await openMore(page); await menuItem(page, '重置').click(); await page.locator('.layout-problems').waitFor({ state: 'detached' });
    assert.deepEqual(await save('reset-drag'), input, 'Reset restores all geometry after the invalid drag.');
    await exportsMatch(page, graph, `${graph.meta.diagramType}-draft-recovery`);
    return { type: graph.meta.diagramType, theme: 'light', draftRetained: true, invalidDragRetained: true, resetComplete: true, actualDownloads: true,
      operations: ['I13.03', 'I14.09', 'I14.10', 'I14.11', 'I14.14', 'I16.04', 'I16.06', 'I16.07', 'I16.08', 'I16.09', 'I19.01', 'I19.03', 'I19.04', 'I20.05', 'I21.05', 'I21.06'] };
  }, true);
}
async function flowDirectionChecks(browser, url, viewport, colorTheme) {
  const name = `flowchart-${viewport.width}-${colorTheme}-flow-direction`;
  await runCase(browser, name, viewport, {}, async page => {
    const html = fs.readFileSync(path.join(inputRoot, 'index.html'), 'utf8');
    let graph;
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: html.replace(
      /(<script id="graph-data" type="application\/json">)[\s\S]*?(<\/script>)/,
      (_, open, close) => open + JSON.stringify(graph) + close) }));
    await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
    const downloads = [], checks = [];
    page.on('download', item => downloads.push(item));
    for (const hinted of [false, true]) for (const axis of ['x', 'y']) {
      graph = { meta: { title: '纵向主干验收', diagramType: 'flowchart', locale: 'zh-CN', sourceRef: 'conceptual:flow-direction' },
        nodes: ['start', 'process', 'end'].map((kind, i) => ({ id: kind, label: kind, kind,
          position: { x: 100, y: 100, [axis]: 100 + i * 600 }, size: { width: 240, height: 120 } })),
        edges: [{ id: 'first', source: 'start', target: 'process', kind: 'flow', evidence: 'inference' },
          { id: 'second', source: 'process', target: 'end', kind: 'flow', evidence: 'inference' }],
        ...(hinted ? { layout: { primaryPath: ['start', 'process', 'end'] } } : {}) };
      await page.goto(url); await page.locator('.diagram-node').first().waitFor(); await theme(page, colorTheme);
      const suffix = `${name}-${hinted ? 'hinted' : 'unhinted'}-${axis}`;
      if (axis === 'x') {
        await page.locator('.layout-problems').waitFor();
        const before = downloads.length;
        for (const format of ['SVG', 'PNG']) {
          await openMore(page); await menuItem(page, `导出 ${format}`).click();
          await page.waitForFunction(() => document.querySelector('.toast')?.textContent.includes('semantic.primary-path'));
          assert.equal(downloads.length, before, 'Horizontal main paths cannot download either image format.');
        }
        await openMore(page); const [downloadedFile] = await Promise.all([page.waitForEvent('download'), menuItem(page, '保存 Graph JSON').click()]);
        const saved = downloadedFile, file = path.join(outputRoot, 'exports', `${suffix}.json`); await saved.saveAs(file);
        assert.equal(await saved.failure(), null);
        assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), graph, 'Rejected image exports retain the complete JSON draft.');
        await page.screenshot({ path: path.join(outputRoot, 'screens', `${suffix}.png`) });
      } else {
        await page.locator('.layout-problems').waitFor({ state: 'detached' });
        await hidePanels(page); await fit(page); await exportsMatch(page, graph, suffix);
      }
      checks.push({ hinted, axis, images: axis === 'x' ? 'blocked' : 'downloaded' });
    }
    return { type: 'flowchart', theme: colorTheme, checks };
  }, true);
}

async function matrix(browser, url, graph, viewport, colorTheme) {
  const name = `${graph.meta.diagramType}-${viewport.width}-${colorTheme}`, mobile = viewport.width <= 700;
  await runCase(browser, name, viewport, {}, async page => {
    await page.goto(url); await page.locator('.diagram-node').first().waitFor();
    await theme(page, colorTheme); const branding = await chooseGraph(page, graph, mobile);
    await proportionalFlow(page);
    await assertLegendLayout(page);
    await assertLegendEntries(page, graph, colorTheme);
    await assertNodeDrawing(page, graph, colorTheme);

    await nav(page, true);
    await ensureInspector(page);
    const initial = core(graph);
    assert.equal(await count(page, '.diagram-node.is-selected'), initial ? 1 : 0);
    if (initial) {
      await selection(page, graph, initial.id); assert.equal(await pulse(page), 0);
      assert.ok(await page.locator('.selection-outline .selection-node-shine,.selection-edge-shine').evaluateAll(elements => elements.every(element => getComputedStyle(element).animationName === 'none')), 'Initial core emphasis is static.');
    }
    assert.ok(await page.locator('.edge-flow').evaluateAll(elements => elements.every(element => getComputedStyle(element).animationPlayState === 'running')), 'Initial core selection does not pause flow.');
    const lockedPositions = await geometry(page);
    await openMore(page);
    await assertLayoutSwitch(page);
    const spacing = menuItem(page, '整理间距'); assert.equal(await spacing.getAttribute('aria-disabled'), 'true'); assert.equal(await spacing.evaluate(element => element.disabled), false);
    await spacing.click({ force: true }); assert.match(await status(page), /请先解除布局锁定/);
    assert.deepEqual(await geometry(page), lockedPositions, 'Locked spacing does not change geometry.');
    await openMore(page); await menuItem(page, '整理间距').focus(); await page.keyboard.press('Enter'); assert.match(await status(page), /请先解除布局锁定/);
    await searchSelect(page, graph, target(graph));
    if (mobile) assert.equal(await count(page, '.nav'), 0, 'Mobile panels remain mutually exclusive.');
    const token = await pulse(page); assert.equal(token, 1, 'One search action produces one feedback pulse.');
    await assertShape(page, graph, target(graph));
    const selectedGeometry = await geometry(page);
    assert.equal(await page.locator('.selection-outline .selection-node-shine').evaluate(element => getComputedStyle(element).animationDuration), '0.76s');
    const animatedWidths = [];
    for (const time of [0, 182, 334, 479, 608, 760]) {
      // Seek the real CSS timeline so mobile panel transitions and slow CI cannot hide a short pulse.
      await page.locator('.selection-feedback').evaluateAll((elements, time) => {
        for (const animation of new Set(elements.flatMap(element => element.getAnimations({ subtree: true })))) { animation.pause(); animation.currentTime = time; }
      }, time);
      animatedWidths.push(await page.locator('.selection-outline .selection-node-shine').evaluate(element => getComputedStyle(element).strokeWidth));
      assert.deepEqual(await geometry(page), selectedGeometry, 'Selection animation preserves node geometry, endpoints, routes and arrow markers.');
    }
    assert.ok(new Set(animatedWidths).size > 1, 'The selection outline visibly recoils before settling.');
    await page.locator('.selection-feedback').evaluateAll(elements => { for (const animation of new Set(elements.flatMap(element => element.getAnimations({ subtree: true })))) animation.finish(); });
    await page.screenshot({ path: path.join(outputRoot, 'screens', name + '.png'), animations: 'disabled' });
    if (graph.meta.diagramType === 'dataflow' && colorTheme === 'light' && viewport.width !== 1920 && await count(page, '.inspector-facts')) {
      await page.locator('.inspector-facts').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(outputRoot, 'screens', name + '-facts.png'), animations: 'disabled' });
    }
    await clear(page, 'close');
    await page.locator('#search').fill('no-such-node-qa'); assert.equal(await count(page, '.results button'), 0); assert.equal(await count(page, '.results .pop-empty'), 1, 'An empty search says so in the popover.');
    await dismiss(page); assert.equal(await page.locator('#search').inputValue(), 'no-such-node-qa', 'Closing the results keeps the query.');
    const panelsBeforeReset = await panelState(page);
    await openMore(page); await menuItem(page, '重置').click();
    const resetNotice = await status(page);
    assert.match(resetNotice, /已重置/, 'Reset reports through the toast.');
    assert.ok(!/请先|布局已调整|整理.*移动/.test(resetNotice), 'Reset clears stale spacing status.');
    assert.deepEqual(await panelState(page), panelsBeforeReset, 'Reset preserves panel preferences.');
    await page.waitForFunction(() => !document.querySelector('.diagram-node.is-selected'));
    assert.equal(await page.locator('#search').inputValue(), '');
    await openMore(page); assert.equal(await menuItem(page, '整理间距').getAttribute('aria-disabled'), 'true'); await dismiss(page);
    assert.equal(await page.locator('html').getAttribute('data-theme'), colorTheme);

    await fit(page);
    if (viewport.width === 1440) { await searchSelect(page, graph, target(graph)); await exportsMatch(page, graph, name); }
    await hidePanels(page); await fit(page);
    const beforeFullscreen = await geometry(page);
    await button(page, '进入全屏').click(); await fullscreenState(page, true);
    await assertNodeDrawing(page, graph, colorTheme);
    assert.deepEqual(await geometry(page), beforeFullscreen, 'Fullscreen preserves node geometry, routes and arrow markers for every diagram type.');
    await page.screenshot({ path: path.join(outputRoot, 'screens', name + '-fullscreen.png'), animations: 'disabled' });
    await button(page, '退出全屏').click(); await fullscreenState(page, false);
    return { type: graph.meta.diagramType, theme: colorTheme, branding, linkedEdges: graph.edges.filter(edge => edge.source === target(graph).id || edge.target === target(graph).id).length, stableGeometry: true,
      operations: ['I01.01', 'I03.01', 'I03.02', 'I03.08', 'I05.03', 'I09.11', 'I09.17', 'I18.01', 'I19.05', 'I19.07', 'I24.01', 'I24.02', 'I27.03',
        ...(graphs.length > 1 ? ['I08.01', 'I08.02'] : ['I08.05']), ...(viewport.width === 1440 ? ['I21.01', 'I21.02'] : [])] };
  });
}

async function editorBoundaryChecks(browser, url, graph, viewport, colorTheme) {
  const type = graph.meta.diagramType, name = `${type}-${viewport.width}-${colorTheme}-editor-boundaries`;
  await runCase(browser, name, viewport, {}, async (page, context) => {
    await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
    await page.goto(url); await chooseGraph(page, graph, mobile(page)); await theme(page, colorTheme);
    const expected = structuredClone(input), current = (expected.diagrams ?? [expected]).find(g => g.meta.diagramType === type);
    const verifyFile = async suffix => {
      await openMore(page); const [downloadedFile] = await Promise.all([page.waitForEvent('download'), menuItem(page, '保存 Graph JSON').click()]);
      const download = downloadedFile, file = path.join(outputRoot, 'exports', `${name}-${suffix}.json`); await download.saveAs(file);
      assert.equal(await download.failure(), null); assert.deepEqual(JSON.parse(fs.readFileSync(file)), expected);
      return { path: path.relative(outputRoot, file), sha256: digest(file) };
    };
    for (const subject of ['node', 'edge']) for (const entry of ['quick', 'inspector']) {
      const object = subject === 'node' ? current.nodes.find(n => !['initial', 'final'].includes(n.kind)) : type === 'sequence' ? current.edges.at(-1) : current.edges[0];
      assert.ok(object, `${type} has an editable ${subject}`);
      const scope = `${subject}.${entry}`, nameInput = page.getByRole('textbox', { name: '名称', exact: true });
      const step = async (id, action, run) => {
        const operations = id.split(' ').map(value => `${value}.${scope}`), operation = operations[0]; page.qaPending = operations;
        await run(); const file = await verifyFile(operation);
        const screenshot = `steps/${name}-${operation}.jpg`; await page.screenshot({ path: path.join(outputRoot, screenshot), type: 'jpeg', quality: 65 });
        page.qaSteps.push({ operations, objectType: subject, editorEntry: entry, objectId: object.id, action,
          expected: 'The named editor boundary preserves the complete committed model and permits correction',
          measured: { modelUnchangedExceptExplicitCommit: true, editorVisible: await nameInput.count(), viewport: page.viewportSize() }, files: [file], screenshot });
        page.qaPending = null; console.log('EDITOR', name, operation);
      };
      const open = async () => {
        const selected = subject === 'node' ? nodeElement(page, object.id).locator('.is-selected') : page.locator(`.react-flow__edge.selected[data-id=${JSON.stringify(object.id)}]`);
        const surface = page.locator(entry === 'quick' ? '.node-card' : '.drawer-body').and(page.locator(`[data-${subject}-id=${JSON.stringify(object.id)}]`));
        const detailsOpen = await page.locator('[aria-controls="node-inspector"]').getAttribute('aria-expanded') === 'true';
        if (await selected.count() && await surface.isVisible() && detailsOpen === (entry === 'inspector')) return;
        if (entry === 'inspector') {
          await hidePanels(page); await clear(page);
          await (subject === 'node' ? nodeElement(page, object.id) : page.locator(`.react-flow__edge[data-id=${JSON.stringify(object.id)}]`)).focus();
          await page.keyboard.press('Enter'); await ensureInspector(page); return;
        }
        await hidePanels(page); await clear(page); await fit(page); await settledViewport(page);
        if (subject === 'node') {
          await nodeElement(page, object.id).waitFor({ state: 'visible' });
          const rect = await nodeElement(page, object.id).boundingBox(), blank = await blankPoint(page);
          await page.mouse.move(blank.x, blank.y); await page.mouse.down();
          await page.mouse.move(blank.x + 48 - rect.x, blank.y + 450 - rect.y, { steps: 8 }); await page.mouse.up();
          await pointerNode(page, object);
        } else {
          const relation = page.locator('.react-flow__edge').and(page.locator(`[data-id=${JSON.stringify(object.id)}]`));
          await centerMotionEdge(page, object.id);
          const label = page.locator('.edge-label').and(page.locator(`[data-edge-id=${JSON.stringify(object.id)}]`));
          const anchor = await label.count() ? await label.boundingBox() : await relation.locator('.react-flow__edge-path').evaluate(path => {
            const p = path.getPointAtLength(path.getTotalLength() / 2), q = new DOMPoint(p.x, p.y).matrixTransform(path.getScreenCTM());
            return { x: q.x, y: q.y, width: 0, height: 0 };
          });
          if (anchor) { const blank = await blankPoint(page); await page.mouse.move(blank.x, blank.y); await page.mouse.down();
            await page.mouse.move(blank.x + 48 - anchor.x - anchor.width / 2, blank.y + 450 - anchor.y - anchor.height / 2, { steps: 8 }); await page.mouse.up(); }
          await relation.focus(); await page.keyboard.press('Enter');
        }
        if (entry === 'inspector') await ensureInspector(page);
        else await page.locator('.node-card').waitFor({ state: 'visible' });
      };
      const begin = async () => { await open(); const surface = page.locator(entry === 'quick' ? '.node-card' : '.inspector');
        await surface.getByRole('button', { name: '编辑文字', exact: true }).click(); await nameInput.waitFor(); };
      await setLocked(page, true); await open();
      await step('I13.05', 'Locked editor entry is disabled', async () => {
        const edit = page.locator(entry === 'quick' ? '.node-card' : '.inspector').getByRole('button', { name: '编辑文字', exact: true });
        assert.equal(await edit.isDisabled(), true); assert.equal(await edit.getAttribute('title'), '请先解除布局锁定'); assert.equal(await nameInput.count(), 0);
      });
      await setLocked(page, false); await begin();
      await step('I13.06', 'Unlocked editor focuses its name input', async () => assert.equal(await nameInput.evaluate(el => el === document.activeElement), true));
      for (const [id, value] of [['I14.13', ''], ['I14.14', '   ']]) await step(id, 'Reject an empty or whitespace name without committing', async () => {
        await nameInput.fill(value); await button(page, '保存').click(); assert.equal(await nameInput.inputValue(), value);
        assert.equal(await nameInput.evaluate(el => el === document.activeElement), true);
        if (value) assert.equal(await page.getByRole('alert').innerText(), '名称不能为空');
        else assert.equal(await nameInput.evaluate(el => el.validity.valueMissing), true);
      });
      await button(page, '取消').click();
      for (const [id, cancel] of [['I15.01', 'button'], ['I15.02', 'Escape']]) await step(id, 'Discard a draft and return focus without closing the editor surface', async () => {
        await begin(); await nameInput.fill('未提交 <>&😀');
        if (subject === 'node') await page.getByRole('textbox', { name: '说明', exact: true }).fill('未提交说明');
        if (cancel === 'button') await button(page, '取消').click(); else await nameInput.press('Escape');
        assert.equal(await nameInput.count(), 0); assert.equal(await button(page, '编辑文字').evaluate(el => el === document.activeElement), true);
      });
      await step('I14.04 I14.05 I14.10', 'Select, delete and paste a long draft, then cancel without writing it', async () => {
        await begin(); const value = '长文字中文 Emoji😀 <>&\"'.repeat(80); await nameInput.fill(value);
        await nameInput.press('Meta+a'); await nameInput.press('Meta+c'); await nameInput.press('Backspace'); assert.equal(await nameInput.inputValue(), '');
        await nameInput.press('Meta+v'); assert.equal(await nameInput.inputValue(), value); await button(page, '取消').click();
      });
      await step('I14.15', 'Browser composition Enter confirms input without submitting the editor', async () => {
        await begin(); await nameInput.fill(''); const ime = await context.newCDPSession(page);
        try {
          await ime.send('Input.imeSetComposition', { text: '中文', selectionStart: 2, selectionEnd: 2 }); await nameInput.press('Enter');
          assert.equal(await nameInput.count(), 1); await ime.send('Input.insertText', { text: '中文' });
          assert.equal(await nameInput.inputValue(), '中文'); await button(page, '取消').click();
        } finally { await ime.detach(); }
      });
      for (const [id, key] of [['I14.11', false], ['I14.12', true]]) await step(`${id} I14.08 I14.09 ${subject === 'node' ? 'I14.01 I14.02 I14.07' : 'I14.03'} I16.04 I16.05`, 'Commit a literal label through the named save control and check its displayed value', async () => {
        await begin(); const value = key ? '已确认😀' : '新 <>&\"😀'; await nameInput.fill(value);
        if (subject === 'node') { const subtitle = page.getByRole('textbox', { name: '说明', exact: true });
          await subtitle.fill('第一行'); await subtitle.press('Enter'); await subtitle.pressSequentially('Second line');
          assert.equal(await subtitle.inputValue(), '第一行\nSecond line'); assert.equal(await nameInput.count(), 1);
        }
        if (key) await nameInput.press('Enter'); else await button(page, '保存').click();
        await nameInput.waitFor({ state: 'detached' }); object.label = value;
        if (subject === 'node') { object.subtitle = '第一行\nSecond line'; assert.ok((await nodeElement(page, object.id).textContent()).includes(value)); }
        else assert.ok((await page.locator('.react-flow__edge').and(page.locator(`[data-id=${JSON.stringify(object.id)}]`)).getAttribute('aria-label')).includes(value));
        await ensureInspector(page); assert.ok((await page.locator('.drawer-body').textContent()).includes(value));
      });
      await step('I13.07', 'Keep one draft while handing the same object between quick look and details', async () => {
        await begin(); await nameInput.fill('交接草稿');
        if (entry === 'quick') await ensureInspector(page);
        else { await hidePanels(page); await ensureInspector(page); }
        await nameInput.waitFor(); assert.equal(await nameInput.inputValue(), '交接草稿'); await button(page, '取消').click();
      });
      await step('I15.07', 'Theme changes retain the unsaved draft', async () => {
        await begin(); await nameInput.fill('主题草稿'); await theme(page, colorTheme === 'dark' ? 'light' : 'dark');
        assert.equal(await nameInput.inputValue(), '主题草稿'); await theme(page, colorTheme); await button(page, '取消').click();
      });
      await step('I15.09', 'Resize a live draft across the panel breakpoint and return', async () => {
        await begin(); await nameInput.fill('窗口草稿');
        for (const size of [{ width: 690, height: 900 }, { width: 710, height: 900 }, viewport]) {
          await page.setViewportSize(size);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          await ensureInspector(page);
          await page.waitForFunction(() => document.querySelectorAll('.card-form input').length === 1);
          await nameInput.waitFor(); assert.equal(await nameInput.inputValue(), '窗口草稿');
        }
        await button(page, '取消').click();
      });
      await step(entry === 'quick' ? 'I15.03' : 'I15.04', 'Close the active editor without committing', async () => {
        await begin(); await nameInput.fill('关闭草稿');
        if (await page.locator('.node-card').isVisible()) await page.locator('.node-card .card-close').click(); else await button(page, '关闭详情').click();
        await nameInput.waitFor({ state: 'detached' }); await open(); assert.equal(await nameInput.count(), 0);
      });
      await step('I15.05', 'Selecting another object discards this draft without writing either object', async () => {
        await begin(); await nameInput.fill('切对象草稿'); const other = current.nodes.find(n => n.id !== object.id);
        await searchSelect(page, current, other); await nameInput.waitFor({ state: 'detached' });
      });
      await step('I15.06', 'Switching diagrams discards this draft and preserves committed values', async () => {
        await begin(); await nameInput.fill('切图草稿'); const other = graphs.find(g => g.meta.diagramType !== type); assert.ok(other);
        await chooseGraph(page, other, mobile(page)); await chooseGraph(page, graph, mobile(page)); await nameInput.waitFor({ state: 'detached' });
      });
    }
    return { type, theme: colorTheme, editorEntries: 4 };
  }, true);
}

async function completeInteractions(browser, url, graph, viewport, colorTheme) {
  const type = graph.meta.diagramType, mobile = viewport.width <= 700;
  await runCase(browser, `${type}-${viewport.width}-${colorTheme}-acceptance`, viewport, {}, async (page, context) => {
    await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
    let activeStep = !process.env.QA_ACCEPTANCE_FROM;
    const step = async (ids, action, run) => {
      if (!activeStep && ids.split(' ').includes(process.env.QA_ACCEPTANCE_FROM)) activeStep = true;
      if (!activeStep) return;
      page.qaPending = ids.split(' ');
      const beforePositions=await positions(),beforeFiles=new Set(fs.readdirSync(path.join(outputRoot,'exports')));
      await run();
      page.qaPending = null;
      console.log('STEP', type, viewport.width, colorTheme, ids);
      const screenshot = `steps/${type}-${viewport.width}-${colorTheme}-${page.qaSteps.length}.jpg`;
      await page.screenshot({path:path.join(outputRoot,screenshot),type:'jpeg',quality:65});
      page.qaSteps.push({ operations: ids.split(' '), action, expected: 'Assertions in this action succeed without changing unrelated model data', measured: { beforePositions, positions: await positions(), viewport: page.viewportSize() }, files:fs.readdirSync(path.join(outputRoot,'exports')).filter(file=>!beforeFiles.has(file)&&file.startsWith(`${type}-${viewport.width}-${colorTheme}-`)).map(file=>({path:'exports/'+file,sha256:digest(path.join(outputRoot,'exports',file))})), screenshot, at: new Date().toISOString(), url: page.url() });
    };
    const positions = async () => (await geometry(page)).nodes.map(({ id, position }) => ({ id, position }));
    const transform = () => page.locator('.react-flow__viewport').evaluate(el => { const m = new DOMMatrix(getComputedStyle(el).transform); return { x: m.e, y: m.f, zoom: m.a }; });
    const ready = async () => { await page.locator('.diagram-node').first().waitFor(); await chooseGraph(page, graph, mobile); await theme(page, colorTheme); await hidePanels(page); await fit(page); };
    const reset = async () => { await openMore(page); await menuItem(page, '重置').click(); await hidePanels(page); await fit(page); };
    const saved = async suffix => {
      await openMore(page); const [downloadedFile] = await Promise.all([page.waitForEvent('download'), menuItem(page, '保存 Graph JSON').click()]);
      const file = path.join(outputRoot, 'exports', `${type}-${viewport.width}-${colorTheme}-${suffix}.json`);
      await downloadedFile.saveAs(file); return JSON.parse(fs.readFileSync(file));
    };
    const current = value => (value.diagrams ?? [value]).find(g => g.meta.diagramType === type);
    if (process.env.QA_ACCEPTANCE_FROM) { await page.goto(url); await ready(); await setLocked(page,false); }
    await step('I01.01 I01.05', 'Open the collection, choose this type and read all initial nodes', async () => { await page.goto(url); await ready(); assert.equal(await count(page, '.diagram-node'), graph.nodes.length); });
    await step('I01.02 I01.03', 'Reload, then navigate away and reopen the generated page', async () => { await page.reload(); await ready(); await page.goto('about:blank'); await page.goto(url); await ready(); assert.deepEqual(await positions(), graph.nodes.map(n => ({ id: n.id, position: n.position }))); });
    await step('I02.01 I02.02 I02.03 I02.04 I02.05 I02.06', 'Pan four directions, far and outside the canvas, under each lock state', async () => {
      const before = await positions();
      for (const locked of [true, false]) {
        await setLocked(page, locked);
        for (const [dx, dy] of [[60,0],[-60,0],[0,60],[0,-60],[viewport.width * .6,100],[0,-viewport.height]]) {
          const p = await blankPoint(page), old = await transform(); await page.mouse.move(p.x,p.y); await page.mouse.down(); await page.mouse.move(p.x+dx,p.y+dy,{steps:8}); await page.mouse.up();
          const next = await transform(); assert.notDeepEqual(next, old); await page.mouse.move(3,3); assert.deepEqual(await positions(), before);
          await fit(page);
        }
      }
    });
    await step('I03.01 I03.02 I03.03 I03.04 I03.05 I03.06 I03.07 I03.08', 'Use buttons, wheel and double click; repeatedly reach each zoom bound and fit', async () => {
      const before = await positions(), p = await blankPoint(page);
      for (const name of ['放大','缩小']) { const old = await transform(); await button(page,name).click(); await page.waitForTimeout(240); assert.notEqual((await transform()).zoom,old.zoom); }
      await page.mouse.move(p.x,p.y); const z = (await transform()).zoom; await page.mouse.wheel(0,-300); await page.waitForTimeout(300); assert.ok((await transform()).zoom>z);
      if((await transform()).zoom>=1.999){await button(page,'缩小').click();await page.waitForTimeout(240);}const old = (await transform()).zoom; const dbl=await blankPoint(page);await page.mouse.dblclick(dbl.x,dbl.y); await page.waitForTimeout(300); assert.ok((await transform()).zoom>old);
      for (const [name, limit] of [['放大',2],['缩小',.08]]) { for (let i=0;i<50 && await button(page,name).isEnabled();i++) { await button(page,name).click(); await page.waitForTimeout(210); } assert.ok(Math.abs((await transform()).zoom-limit)<.001); }
      await fit(page);const pinch=await blankPoint(page),startZoom=(await transform()).zoom;const cdp=await context.newCDPSession(page);await cdp.send('Input.synthesizePinchGesture',{x:pinch.x,y:pinch.y,scaleFactor:1.25,gestureSourceType:'mouse'});await page.waitForTimeout(300);assert.ok((await transform()).zoom>startZoom);await cdp.detach();await fit(page); assert.deepEqual(await positions(),before);
    });
    if (!mobile) await step('I04.01 I04.02 I04.03 I04.04 I04.05', 'Click, drag and wheel the minimap including its edges', async () => {
      const before = await positions(), map = await page.locator('.react-flow__minimap').boundingBox();
      for (const fraction of [.1,.9,.5]) { const old=await transform(); await page.mouse.click(map.x+map.width*fraction,map.y+map.height*fraction); assert.notDeepEqual(await transform(),old); }
      await page.mouse.move(map.x+map.width*.5,map.y+map.height*.5);await page.mouse.down();await page.mouse.move(map.x+map.width*.7,map.y+map.height*.7,{steps:8});await page.mouse.up();
      const old=await transform();await page.mouse.wheel(0,-150);await page.waitForTimeout(250);assert.notDeepEqual(await transform(),old);assert.deepEqual(await positions(),before);await fit(page);
    });
    await step('I10.01 I10.02 I10.03 I10.04 I10.05 I10.06 I10.07 I25.05 I25.06 I25.07 I25.11', 'Open/toggle/switch menus; use arrows, Home, End and Escape with focus return', async () => {
      for (const id of ['#more-menu-button','#view-menu-button']) { await page.locator(id).click();assert.equal(await page.locator(id).getAttribute('aria-expanded'),'true');await page.locator(id).click();assert.equal(await page.locator(id).getAttribute('aria-expanded'),'false'); }
      await openLegend(page);await button(page,'图例').click();await openMore(page);await page.locator('#view-menu-button').click();assert.equal(await page.locator('#more-menu-button').getAttribute('aria-expanded'),'false');await page.keyboard.press('Escape');
      await openMore(page);await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('role')),'menuitem');await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('role')),'radio');await menuItem(page,'导出 PNG').focus();await page.keyboard.press('Home');assert.match(await page.evaluate(()=>document.activeElement.textContent),/SVG/);
      const radio=page.getByRole('radio',{name:'跟随系统',exact:true});await radio.focus();await page.keyboard.press('ArrowRight');assert.equal(await page.getByRole('radio',{name:'浅色',exact:true}).getAttribute('aria-checked'),'true');await page.keyboard.press('ArrowRight');assert.equal(await page.getByRole('radio',{name:'深色',exact:true}).getAttribute('aria-checked'),'true');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'more-menu-button');
      await openMore(page);const p=await blankPoint(page);await page.mouse.click(p.x,p.y);assert.equal(await page.locator('#more-menu-button').getAttribute('aria-expanded'),'false');await theme(page,colorTheme);
    });
    await step('I05.02 I05.05 I05.06 I07.01 I07.02 I07.03 I07.04 I07.05 I07.06 I07.07', 'Navigate every directory entry, including scroll-to-last and repeated toggles', async () => {
      for(const node of graph.nodes) { await nav(page,true); const item=page.locator('.nav .search-results button').filter({hasText:node.label}).first();await item.scrollIntoViewIfNeeded();await item.click();await selection(page,graph,node.id); }
      await nav(page,true);await page.locator('.nav .side-close').click();await page.locator('.nav').waitFor({state:'detached'});for(let i=0;i<3;i++){await nav(page,true);await nav(page,false);}await hidePanels(page);await fit(page);
    });
    await step('I05.01 I05.04 I05.07 I25.03 I25.04 I25.09 I25.10', 'Select each node shape by pointer and keyboard; hold Enter; Delete cannot alter the graph', async () => {
      for(const node of graph.nodes) { await searchSelect(page,graph,node);await hidePanels(page);await pointerNode(page,node);await selection(page,graph,node.id);await nodeElement(page,node.id).focus();await page.keyboard.press('Enter');await selection(page,graph,node.id);await page.keyboard.press('Space');await selection(page,graph,node.id); }
      const node=target(graph);await nodeElement(page,node.id).focus();await page.keyboard.down('Enter');const first=await pulse(page);await page.keyboard.down('Enter');assert.equal(await pulse(page),first);await page.keyboard.up('Enter');
      await page.keyboard.press('Backspace');await page.keyboard.press('Delete');assert.equal(await count(page,'.diagram-node'),graph.nodes.length);await hidePanels(page);await fit(page);await clear(page,'pane');
    });
    await step('I05.03 I09.01 I09.02 I09.11 I09.12 I09.15 I09.16 I09.17 I09.18', 'Search empty/whitespace/none/one; choose by pointer and keyboard, close via Escape and outside', async () => {
      for(const text of ['','   ']){await page.locator('#search').fill(text);assert.equal(await count(page,'.results'),0);}
      await page.locator('#search').fill('not-found-acceptance');assert.equal(await count(page,'.results button'),0);await page.keyboard.press('Escape');assert.equal(await count(page,'.results'),0);
      await searchSelect(page,graph,target(graph));await searchSelect(page,graph,target(graph),true);await page.locator('#search').fill(target(graph).label);await button(page,'更多').click();assert.equal(await count(page,'.results'),0);await dismiss(page);await clear(page);
    });
    await step('I12.01 I12.02 I12.03 I12.04 I12.06 I12.07 I26.09', 'Read empty and node details, scroll to bottom, select and copy text without moving nodes', async () => {
      await ensureInspector(page);assert.equal(await count(page,'.drawer-body h2'),0);await button(page,'关闭详情').click();await searchSelect(page,graph,target(graph));const before=await positions();const body=page.locator('.drawer-body');await body.hover();await page.mouse.wheel(0,1000);await page.waitForTimeout(100);assert.ok(await body.evaluate(el=>el.scrollTop>=0));
      const title=page.locator('.drawer-body h2');await title.click({clickCount:3});await page.keyboard.press('Meta+c');assert.ok(await page.evaluate(()=>window.getSelection().toString().length>0));assert.deepEqual(await positions(),before);await hidePanels(page);
    });
    await step('I13.03 I13.05 I13.06 I14.01 I14.02 I14.04 I14.07 I14.08 I14.09 I14.11 I14.12 I14.13 I14.14 I15.01 I15.02 I16.01 I16.02 I16.04 I16.05 I25.08 I25.12', 'Edit in Inspector: locked state, focus, empty/whitespace, literals/newline, commit and cancel', async () => {
      const node=target(graph);await setLocked(page,true);await searchSelect(page,graph,node);assert.equal(await button(page,'编辑文字').isDisabled(),true);await setLocked(page,false);await button(page,'编辑文字').click();const name=page.getByRole('textbox',{name:'名称',exact:true});assert.equal(await name.evaluate(el=>el===document.activeElement),true);
      const ime=await context.newCDPSession(page);await name.fill('');await ime.send('Input.imeSetComposition',{text:'中文',selectionStart:2,selectionEnd:2});await name.press('Enter');assert.equal(await name.count(),1,'An Enter during browser IME composition leaves the draft open');await ime.send('Input.insertText',{text:'中文'});await name.fill('normal submit');await name.press('Enter');assert.equal(await name.count(),0,'A subsequent deliberate Enter still submits');await ime.detach();await button(page,'编辑文字').click();await name.fill(node.label);await name.press('Enter');await button(page,'编辑文字').click();
      await name.press('Meta+a');await name.press('Backspace');await button(page,'保存').click();assert.equal(await name.inputValue(),'');assert.equal((current(await saved('empty'))).nodes.find(n=>n.id===node.id).label,node.label);
      await name.fill('   ');await button(page,'保存').click();assert.equal(await page.getByRole('alert').innerText(),'名称不能为空');
      await name.fill('验收 <>&" 😀');const subtitle=page.getByRole('textbox',{name:'说明',exact:true});await subtitle.fill('第一行');await subtitle.press('Enter');await subtitle.pressSequentially('Second line');assert.equal(await subtitle.inputValue(),'第一行\nSecond line');await button(page,'保存').click();assert.equal(await page.locator('.drawer-body h2').innerText(),'验收 <>&" 😀');
      await nav(page,true);assert.ok((await page.locator('.nav .search-results').innerText()).includes('验收 <>&" 😀'));await page.locator('#search').fill('验收 <>&" 😀');await page.getByRole('option').first().click();assert.equal(await page.locator('.drawer-body h2').innerText(),'验收 <>&" 😀');
      await button(page,'编辑文字').click();await name.fill(node.label);await name.press('Enter');assert.equal(await page.locator('.drawer-body h2').innerText(),node.label);
      for(const cancel of ['button','Escape']){await button(page,'编辑文字').click();await name.fill('uncommitted');if(cancel==='button')await button(page,'取消').click();else await name.press('Escape');assert.equal(await page.locator('.drawer-body h2').innerText(),node.label);assert.equal(await button(page,'编辑文字').evaluate(el=>el===document.activeElement),true);}
      await reset();
    });
    await step('I18.01 I18.02 I18.03 I18.04 I19.01 I19.02 I19.03 I19.05 I19.06 I19.07 I19.09 I19.10 I27.03 I27.04 I27.05', 'Nudge locked/full/neighborhood and reset with an active draft; check repeated notices and full JSON', async () => {
      await setLocked(page,true);for(let i=0;i<2;i++){await openMore(page);const box=await menuItem(page,'整理间距').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);assert.match(await status(page),/请先/);}await setLocked(page,false);await clear(page);await openMore(page);await menuItem(page,'整理间距').click();assert.match(await status(page),/整理|间距/);
      await searchSelect(page,graph,target(graph));for(let i=0;i<2;i++){await openMore(page);await menuItem(page,'整理间距').click();assert.match(await status(page),/整理|间距/);}await button(page,'编辑文字').click();await page.getByRole('textbox',{name:'名称',exact:true}).fill('reset this draft');await reset();assert.equal(await count(page,'.card-form'),0);assert.deepEqual(current(await saved('reset')),graph);await reset();assert.deepEqual(current(await saved('reset-twice')),graph);
    });
    await step('I22.01 I22.02 I22.03 I22.04 I22.05 I22.06', 'Exercise system/light/dark and live system changes while selected and editing', async () => {
      await searchSelect(page,graph,target(graph));await setLocked(page,false);await button(page,'编辑文字').click();const name=page.getByRole('textbox',{name:'名称',exact:true});await name.fill('theme draft');
      for(const color of ['light','dark','system']){await theme(page,color);assert.equal(await name.inputValue(),'theme draft');}
      for(const color of ['dark','light']){await page.emulateMedia({colorScheme:color});await page.waitForFunction(color=>document.documentElement.dataset.theme===color,color);assert.equal(await name.inputValue(),'theme draft');}
      await theme(page,'light');await page.emulateMedia({colorScheme:'dark'});assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await button(page,'取消').click();await theme(page,colorTheme);await hidePanels(page);
    });
    await step('I06.01 I06.02 I06.03 I06.04 I06.05 I06.06 I06.07 I06.08 I06.09 I06.10 I11.02 I12.05', 'Select every actual relationship by line, label and keyboard, and inspect its identity', async () => {
      for (const edge of graph.edges) {
        await clear(page); await hidePanels(page); await fit(page); await centerMotionEdge(page,edge.id);
        const relation=page.locator('.react-flow__edge').and(page.locator(`[data-id=${JSON.stringify(edge.id)}]`));
        const point=await relation.locator('.react-flow__edge-path').evaluate(path=>{
          const matrix=path.getScreenCTM(),length=path.getTotalLength();
          for(let i=1;i<40;i++){const p=path.getPointAtLength(length*i/40),q=new DOMPoint(p.x,p.y).matrixTransform(matrix);if(document.elementFromPoint(q.x,q.y)?.closest('.react-flow__edge')===path.closest('.react-flow__edge'))return {x:q.x,y:q.y};}
        });
        assert.ok(point,`Visible hit segment for ${edge.id}`);await page.mouse.click(point.x,point.y);assert.equal(await relation.evaluate(el=>el.classList.contains('selected')),true);
        await relation.focus();await page.keyboard.press('Enter');assert.equal(await relation.evaluate(el=>el.classList.contains('selected')),true);await page.keyboard.press('Space');assert.equal(await relation.evaluate(el=>el.classList.contains('selected')),true);
        const label=page.locator('.edge-label').and(page.locator(`[data-edge-id=${JSON.stringify(edge.id)}]`));
        if(await label.count()){await clear(page);await hidePanels(page);await label.scrollIntoViewIfNeeded();await label.click();assert.equal(await relation.evaluate(el=>el.classList.contains('selected')),true);}
        await ensureInspector(page);assert.ok((await page.locator('.drawer-body').innerText()).includes(graph.nodes.find(n=>n.id===edge.source).label));assert.ok((await page.locator('.drawer-body').innerText()).includes(graph.nodes.find(n=>n.id===edge.target).label));
      }
      await clear(page);await hidePanels(page);await fit(page);
    });
    await step('I17.01 I17.02 I17.03 I17.04 I17.05 I17.06 I17.07 I11.08', 'Try locked and unlocked pointer/keyboard moves, four directions and release outside', async () => {
      const node=target(graph);
      for(const locked of [true,false,true]) {
        await reset();await setLocked(page,locked);await searchSelect(page,graph,node);await hidePanels(page);
        for(const [dx,dy] of [[40,0],[-40,0],[0,40],[0,-40],[viewport.width*.55,120],[0,-viewport.height]]) {
          await fit(page);await nodeElement(page,node.id).focus();await page.keyboard.press('Enter');await hidePanels(page);await page.waitForTimeout(400);
          await settledViewport(page);
          const {x,y}=await nodePointerTarget(page,node),before=await positions();
          assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('.react-flow__node-diagram')?.dataset.id,{x,y}),node.id,`Drag start hits ${node.id}: ${JSON.stringify({locked,dx,dy,x,y})}`);await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});
          if(!locked && (type!=='sequence'||dx))assert.equal(await count(page,'.node-card'),0);await page.mouse.up();await page.mouse.move(3,60);
          if(!locked && (type!=='sequence'||dx))await page.waitForFunction(({element,before})=>{
            const m=new DOMMatrix(element.style.transform);return m.e!==before.x||m.f!==before.y;
          },{element:await nodeElement(page,node.id).elementHandle(),before:before.find(item=>item.id===node.id).position},{timeout:2000});
          const after=await positions();if(locked)assert.deepEqual(after,before);else if(type!=='sequence'||dx)assert.notDeepEqual(after,before);
          if(type==='sequence')assert.equal(after.find(n=>n.id===node.id).position.y,node.position.y);
          await reset();await setLocked(page,locked);
        }
        await nodeElement(page,node.id).focus();await page.keyboard.press('Enter');await hidePanels(page);await nodeElement(page,node.id).focus();const before=await positions();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');const after=await positions();if(locked)assert.deepEqual(after,before);else assert.notDeepEqual(after,before);
      }
      await reset();await setLocked(page,false);
    });
    await step('I11.01 I11.03 I11.04 I11.05 I11.06 I11.07 I11.09 I13.01 I13.02 I13.04 I13.07 I14.03 I15.03 I15.04 I15.05 I15.06 I15.07 I15.08 I15.09 I16.03', 'Edit through quick look and Inspector, retain the same-object draft and discard on object/view changes', async () => {
      const node=target(graph);await searchSelect(page,graph,node);
      const preview = async () => {
        await hidePanels(page);await fit(page);await hidePanels(page);await settledViewport(page);
        if(type==='sequence') { const head=await nodeElement(page,node.id).evaluate(el=>el.getBoundingClientRect().toJSON());const blank=await blankPoint(page);await page.mouse.move(blank.x,blank.y);await page.mouse.down();await page.mouse.move(blank.x+48-head.x,blank.y+450-head.y,{steps:8});await page.mouse.up(); }
        await pointerNode(page,node);await page.locator('.node-card').waitFor({state:'visible'});
      };
      await preview();
      const card=page.locator('.node-card');
      for(const corner of [[.08,.2],[.92,.2],[.08,.8],[.92,.8]]) {
        await hidePanels(page);await fit(page);await hidePanels(page);await settledViewport(page);const b=await nodeElement(page,node.id).evaluate(el=>el.getBoundingClientRect().toJSON()),p=await blankPoint(page);
        await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+viewport.width*corner[0]-(b.x+b.width/2),p.y+viewport.height*corner[1]-(b.y+Math.min(b.height/2,18)),{steps:8});await page.mouse.up();
        await nodeElement(page,node.id).focus();await page.keyboard.press('Enter');await page.waitForTimeout(500);
        if(await card.isVisible()){const box=await card.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1);await button(page,'缩小').click();await page.waitForTimeout(300);if(await card.isVisible()){const next=await card.boundingBox();assert.ok(next.x>=0&&next.y>=0&&next.x+next.width<=viewport.width+1&&next.y+next.height<=viewport.height+1);}}
        else {await ensureInspector(page);assert.equal(await page.locator('.drawer-body h2').innerText(),node.label);}
      }
      await preview();
      if(await card.isVisible()) {
        await card.getByRole('button',{name:'编辑文字',exact:true}).click();await page.getByRole('textbox',{name:'名称',exact:true}).fill('节点');await page.getByRole('textbox',{name:'说明',exact:true}).fill('说明');await button(page,'保存').click();
        assert.equal((current(await saved('quick-node'))).nodes.find(n=>n.id===node.id).label,'节点');await reset();await setLocked(page,false);await preview();
      }
      if(await card.isVisible()) {
        await card.getByRole('button',{name:'编辑文字',exact:true}).click();await page.getByRole('textbox',{name:'名称',exact:true}).fill('pending handoff');
        await ensureInspector(page);assert.equal(await page.getByRole('textbox',{name:'名称',exact:true}).inputValue(),'pending handoff');await button(page,'取消').click();
        await preview();
        if(await card.count()){await card.getByRole('button',{name:'编辑文字',exact:true}).click();await page.getByRole('textbox',{name:'名称',exact:true}).fill('closed draft');if(await card.isVisible())await card.locator('.card-close').click();else await button(page,'关闭详情').click();await page.locator('.card-form').waitFor({state:'detached'});}
      } else {await ensureInspector(page);assert.equal(await page.locator('.drawer-body h2').innerText(),node.label);}
      await searchSelect(page,graph,node);await button(page,'编辑文字').click();await page.getByRole('textbox',{name:'名称',exact:true}).fill('resizable draft');
      await nav(page,true);await ensureInspector(page);assert.equal(await page.getByRole('textbox',{name:'名称',exact:true}).inputValue(),'resizable draft');
      for(const size of [{width:690,height:900},{width:710,height:500},viewport]){await page.setViewportSize(size);await page.waitForTimeout(150);await ensureInspector(page);assert.equal(await page.getByRole('textbox',{name:'名称',exact:true}).inputValue(),'resizable draft');}
      await button(page,'关闭详情').click();await searchSelect(page,graph,node);assert.equal(await count(page,'.card-form'),0);assert.equal(await page.locator('.drawer-body h2').innerText(),node.label);
      await button(page,'编辑文字').click();await page.getByRole('textbox',{name:'名称',exact:true}).fill('different object');const other=graph.nodes.find(n=>n.id!==node.id);if(other){await searchSelect(page,graph,other);assert.equal(await count(page,'.card-form'),0);}
      if(graph.edges.length){const edge=graph.edges[0];await hidePanels(page);await fit(page);const relation=page.locator('.react-flow__edge').and(page.locator(`[data-id=${JSON.stringify(edge.id)}]`));await relation.focus();await page.keyboard.press('Enter');await button(page,'编辑文字').click();await page.getByRole('textbox',{name:'名称',exact:true}).fill('临时关系');await button(page,'保存').click();assert.ok((await relation.getAttribute('aria-label')).includes('临时关系'));await ensureInspector(page);await button(page,'编辑文字').click();await page.getByRole('textbox',{name:'名称',exact:true}).fill(edge.label||'关系');await page.keyboard.press('Enter');}
      await reset();
    });
    await step('I08.01 I08.02 I08.03 I08.04 I19.08', 'Visit every graph, edit a second view and reset only this view', async () => {
      await searchSelect(page,graph,target(graph));await setLocked(page,false);await button(page,'编辑文字').click();await page.getByRole('textbox',{name:'名称',exact:true}).fill('uncommitted view draft');for(const item of graphs)await chooseGraph(page,item,mobile);await chooseGraph(page,graph,mobile);await searchSelect(page,graph,target(graph));assert.equal(await count(page,'.card-form'),0);assert.equal(await page.locator('.drawer-body h2').innerText(),target(graph).label);
      const other=graphs.find(g=>g.meta.diagramType!==type);
      if(other){await chooseGraph(page,other,mobile);await setLocked(page,false);await searchSelect(page,other,target(other));await button(page,'编辑文字').click();await page.getByRole('textbox',{name:'名称',exact:true}).fill('Other view retained');await button(page,'保存').click();await chooseGraph(page,graph,mobile);await searchSelect(page,graph,target(graph));await setLocked(page,false);await button(page,'编辑文字').click();await page.getByRole('textbox',{name:'名称',exact:true}).fill('discard current pending draft');await reset();assert.equal(await count(page,'.card-form'),0);const result=await saved('other-view');assert.deepEqual(current(result),graph);assert.equal((result.diagrams??[result]).find(g=>g.meta.diagramType===other.meta.diagramType).nodes.find(n=>n.id===target(other).id).label,'Other view retained');await chooseGraph(page,other,mobile);await reset();await chooseGraph(page,graph,mobile);}
      await hidePanels(page);await fit(page);
    });
    await step('I21.01 I21.02 I21.03 I21.04 I21.07 I20.05 I20.06 I27.06', 'Download current SVG/PNG and consecutive complete JSON files, then continue editing', async () => {
      await exportsMatch(page,graph,`${type}-${viewport.width}-${colorTheme}-acceptance`);assert.deepEqual(current(await saved('consecutive-1')),graph);assert.deepEqual(current(await saved('consecutive-2')),graph);
      await setLocked(page,false);await searchSelect(page,graph,target(graph));await button(page,'编辑文字').click();await page.getByRole('textbox',{name:'名称',exact:true}).fill('still editable');await button(page,'取消').click();await hidePanels(page);
    });
    await step('I23.01 I23.02 I23.03 I23.04 I23.05 I23.06 I23.07 I23.08 I23.09', 'Toggle flow, live reduced motion, switch diagrams and reset, checking effective states', async () => {
      await assertLegendEntries(page,graph,colorTheme);await openLegend(page);const control=page.getByRole('switch',{name:'连线流动',exact:true});
      if(await control.count()){
        await control.click();assert.equal(await control.getAttribute('aria-checked'),'false');await control.click();assert.equal(await control.getAttribute('aria-checked'),'true');
        await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('[role="switch"][aria-label="连线流动"]')?.disabled);assert.equal(await control.isDisabled(),true);await assertFlow(page,false);await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.querySelector('[role="switch"][aria-label="连线流动"]')?.disabled===false);assert.equal(await control.isEnabled(),true);
        await control.click();await dismiss(page);const other=graphs.find(g=>g.meta.diagramType!==type);if(other){await chooseGraph(page,other,mobile);await assertFlow(page,false);await chooseGraph(page,graph,mobile);await assertFlow(page,false);}await reset();await assertFlow(page,true);
      } else await dismiss(page);
    });
    await step('I24.01 I24.02 I24.04 I24.08 I24.09 I24.10 I15.10 I22.07', 'Use actual fullscreen, repeated entry, live system appearance and editor handoff', async () => {
      await hidePanels(page);await fit(page);await setLocked(page,false);await theme(page,'system');await button(page,'进入全屏').dblclick();await page.waitForTimeout(150);
      if(!await page.evaluate(()=>Boolean(document.fullscreenElement)))await button(page,'进入全屏').click();await fullscreenState(page,true);
      for(const color of ['dark','light']){await page.emulateMedia({colorScheme:color});await page.waitForFunction(color=>document.documentElement.dataset.theme===color,color);}
      await nodeElement(page,target(graph).id).focus();await page.keyboard.press('Enter');await page.waitForTimeout(500);
      if(await button(page,'查看详情').count()){await page.locator('.node-card').getByRole('button',{name:'编辑文字',exact:true}).click();await page.getByRole('textbox',{name:'名称',exact:true}).fill('inside fullscreen');await page.getByRole('textbox',{name:'名称',exact:true}).press('Escape');await button(page,'查看详情').click();await page.locator('.inspector').waitFor();}
      if(await page.evaluate(()=>Boolean(document.fullscreenElement)))await button(page,'退出全屏').click();
      await page.waitForFunction(()=>!document.fullscreenElement);await ensureInspector(page);assert.equal(await page.locator('.drawer-body h2').innerText(),target(graph).label);
      await button(page,'编辑文字').click();await page.getByRole('textbox',{name:'名称',exact:true}).fill('fullscreen draft');await hidePanels(page);await button(page,'进入全屏').click();await fullscreenState(page,true);await button(page,'退出全屏').click();await fullscreenState(page,false);await ensureInspector(page);assert.equal(await page.getByRole('textbox',{name:'名称',exact:true}).inputValue(),'fullscreen draft');await button(page,'取消').click();await hidePanels(page);
      await theme(page,colorTheme);
    });
    await step('I01.04 I08.05 I09.03 I09.04 I09.05 I09.06 I09.07 I09.08 I09.09 I09.10 I09.13 I09.14 I07.05 I14.05 I26.01 I26.02 I26.03', 'Open a compiled single-view stress fixture, search every field and long result list, paste and resize a live draft', async () => {
      const exemplar=graph.nodes.find(n=>!['initial','final','actor'].includes(n.kind))??graph.nodes[0];
      const semantic={meta:{...graph.meta,title:'搜索验收 SearchAcceptance',sourceRef:'conceptual:interaction-stress'},nodes:Array.from({length:18},(_,i)=>({id:`search-${i}`,kind:exemplar.kind,label:`共同节点 SearchNode${i}`,subtitle:`Subtitle${i}`,tags:[`TagToken${i}`],facts:[`FactToken${i}`],attributes:[`AttributeToken${i}`],methods:[`MethodToken${i}()`],fields:[{name:`FieldToken${i}`,type:'TEXT',key:'PK'}]})),edges:[]};
      const fixture=(await compileGraphLayout(semantic)).graph;
      const html=fs.readFileSync(path.join(inputRoot,'index.html'),'utf8').replace(/(<script\b[^>]*\bid="graph-data"[^>]*>)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify(fixture).replaceAll('<','\\u003c')+b);
      const fixtureUrl=url+'acceptance-search';await page.route(fixtureUrl,route=>route.fulfill({contentType:'text/html',body:html}));await page.goto(fixtureUrl);await page.locator('.diagram-node').first().waitFor();await theme(page,colorTheme);assert.equal(await count(page,'#view-menu-button'),0);
      for(const query of ['searchnode9','SEARCHNODE9','共同节点','Subtitle9','TagToken9','FactToken9','FieldToken9','AttributeToken9','MethodToken9']){
        await page.locator('#search').fill(query);const matches=await page.locator('.results button').allTextContents();assert.equal(matches.length,query==='共同节点'?8:1);assert.ok(matches.every(text=>text.includes('共同节点')));
      }
      await dismiss(page);await nav(page,true);const last=page.locator('.nav .search-results button').last();await last.scrollIntoViewIfNeeded();await last.click();await selection(page,fixture,'search-17');await setLocked(page,false);await button(page,'编辑文字').click();
      const field=page.getByRole('textbox',{name:'名称',exact:true});await field.fill('中文 paste <>&');await field.press('Meta+a');await field.press('Meta+c');await field.press('Backspace');await field.press('Meta+v');assert.equal(await field.inputValue(),'中文 paste <>&');
      for(const size of [{width:390,height:844},{width:844,height:390},{width:690,height:900},{width:710,height:900}]){await page.setViewportSize(size);await page.waitForTimeout(150);await ensureInspector(page);assert.equal(await field.inputValue(),'中文 paste <>&');await page.locator('.drawer-body').hover();await page.mouse.wheel(0,500);await page.waitForTimeout(200);const save=await button(page,'保存').boundingBox();assert.ok(save.x>=0&&save.y>=0&&save.x+save.width<=size.width&&save.y+save.height<=size.height,JSON.stringify({size,save}));}
      await page.setViewportSize(viewport);await page.waitForTimeout(150);await ensureInspector(page);await page.locator('.inspector').getByRole('button',{name:'保存',exact:true}).click();await page.locator('#search').fill('中文 paste');assert.equal(await count(page,'.results button'),1);await page.goto(url);await ready();
    });
    await step('I21.08 I21.09 I27.06 I27.07', 'Hold font readiness, switch view/theme while exporting and verify the captured file before editing again', async () => {
      const other=graphs.find(g=>g.meta.diagramType!==type);
      for(const format of ['SVG','PNG']){
        await page.evaluate(()=>Object.defineProperty(document.fonts,'ready',{configurable:true,value:new Promise(resolve=>window.releaseExport=resolve)}));
        await openMore(page);const pending=page.waitForEvent('download');pending.catch(()=>{});await menuItem(page,`导出 ${format}`).click();assert.match(await status(page),/正在生成/);
        if(other)await chooseGraph(page,other,mobile);await theme(page,colorTheme==='light'?'dark':'light');await page.evaluate(()=>{window.releaseExport();delete document.fonts.ready;});
        const result=await pending,file=path.join(outputRoot,'exports',`${type}-${viewport.width}-${colorTheme}-pending.${format.toLowerCase()}`);await result.saveAs(file);assert.equal(await result.failure(),null);assert.ok(fs.statSync(file).size>100);
        const baseline=path.join(outputRoot,'exports',`${type}-${viewport.width}-${colorTheme}-acceptance.${format.toLowerCase()}`);if(fs.existsSync(baseline))assert.equal(digest(file),digest(baseline),'An export pending during a view/theme switch keeps the trigger snapshot');
        await chooseGraph(page,graph,mobile);await theme(page,colorTheme);await hidePanels(page);
      }
      const native=await page.evaluate(()=>{window.nativeBitmap=createImageBitmap;window.createImageBitmap=async()=>{throw new Error('acceptance failure');};return true;});assert.ok(native);await openMore(page);await menuItem(page,'导出 PNG').click();await page.waitForFunction(()=>document.querySelector('.toast')?.textContent.includes('acceptance failure'));await page.evaluate(()=>window.createImageBitmap=window.nativeBitmap);
      await setLocked(page,false);await searchSelect(page,graph,target(graph));await button(page,'编辑文字').click();await page.getByRole('textbox',{name:'名称',exact:true}).fill('editable after failure');await button(page,'取消').click();await hidePanels(page);
    });
    await step('I20.03 I20.04 I24.05 I24.06 I24.07', 'Inject native capability/write failures, preserve state and recover using the actual controls', async () => {
      for(const phase of ['write','close']){
        await page.evaluate(phase=>{window.saveAborted=false;window.showSaveFilePicker=async()=>({createWritable:async()=>({write:async()=>{if(phase==='write')throw new Error('write denied');},close:async()=>{throw new Error('close denied');},abort:async()=>{window.saveAborted=true;}})});},phase);
        await openMore(page);await menuItem(page,'保存 Graph JSON').click();await page.waitForFunction(()=>document.querySelector('.toast')?.textContent.includes('保存失败'));assert.equal(await page.evaluate(()=>window.saveAborted),true);
      }
      await page.evaluate(()=>{window.showSaveFilePicker=undefined;window.originalFullscreen=Element.prototype.requestFullscreen;Element.prototype.requestFullscreen=()=>Promise.reject(new Error('Denied'));});await button(page,'进入全屏').click();await page.waitForFunction(()=>document.querySelector('.toast')?.textContent.includes('无法进入全屏'));assert.equal(await page.evaluate(()=>Boolean(document.fullscreenElement)),false);
      await page.evaluate(()=>Element.prototype.requestFullscreen=window.originalFullscreen);await button(page,'进入全屏').click();await fullscreenState(page,true);
      await page.evaluate(()=>{window.originalExit=document.exitFullscreen;document.exitFullscreen=()=>Promise.reject(new Error('Denied'));});await button(page,'退出全屏').click();await page.waitForFunction(()=>document.querySelector('.toast')?.textContent.includes('无法退出全屏'));assert.equal(await page.evaluate(()=>Boolean(document.fullscreenElement)),true);
      await page.evaluate(()=>document.exitFullscreen=window.originalExit);await button(page,'退出全屏').click();await fullscreenState(page,false);
      await page.evaluate(()=>Object.defineProperty(document,'fullscreenEnabled',{configurable:true,value:false}));await theme(page,colorTheme==='light'?'dark':'light');assert.equal(await button(page,'进入全屏').getAttribute('aria-disabled'),'true');await button(page,'进入全屏').focus();await page.keyboard.press('Enter');assert.match(await status(page),/不支持全屏/);
      await page.evaluate(()=>delete document.fullscreenEnabled);await theme(page,colorTheme);await button(page,'进入全屏').click();await fullscreenState(page,true);await button(page,'退出全屏').click();await fullscreenState(page,false);
    });
    await step('I14.10 I16.06 I16.07 I16.08 I16.09 I18.05 I19.04 I21.05 I21.06', 'Retain an oversized text draft, locate its quality failure, block both images and reset before retrying', async () => {
      const node=graph.nodes.find(node=>!['initial','final'].includes(node.kind))??target(graph);
      await setLocked(page,false);await searchSelect(page,graph,node);await button(page,'编辑文字').click();const text='完整压力输入 WMWM_'.repeat(30);await page.getByRole('textbox',{name:'名称',exact:true}).fill(text);await button(page,'保存').click();await page.locator('.layout-problems').waitFor();await page.locator('.layout-problems summary').click();await page.locator('.layout-problems li button').first().click();
      const downloads=[],listener=d=>downloads.push(d);page.on('download',listener);
      try{for(const format of ['SVG','PNG']){await openMore(page);await menuItem(page,`导出 ${format}`).click();await page.waitForFunction(()=>document.querySelector('.toast')?.textContent.includes('Diagram quality failed'));assert.equal(downloads.length,0);}}finally{page.off('download',listener);}
      const draft=current(await saved('long-draft'));assert.equal(draft.nodes.find(n=>n.id===node.id).label,text);const before=await geometry(page);await openMore(page);await menuItem(page,'整理间距').click();assert.match(await status(page),/无法继续整理/);assert.deepEqual(await geometry(page),before);await reset();assert.deepEqual(current(await saved('draft-reset')),graph);await exportsMatch(page,graph,`${type}-${viewport.width}-${colorTheme}-draft-retry`);
    });
    await step('I25.01 I25.02 I27.01 I27.02', 'Traverse visible controls with Tab and Shift+Tab and inspect native hover/focus descriptions', async () => {
      await page.locator('#search').focus();const seen=new Set();for(let i=0;i<35;i++){await page.keyboard.press('Tab');const item=await page.evaluate(()=>{const e=document.activeElement,r=e.getBoundingClientRect();return {tag:e.tagName,label:e.getAttribute('aria-label')||e.textContent||e.title,visible:(r.width>0&&r.height>0)||(e instanceof SVGElement&&(r.width>0||r.height>0))};});assert.ok(item.visible||item.tag==='BODY',JSON.stringify(item));seen.add(item.label);}assert.ok(seen.size>3);await page.keyboard.press('Shift+Tab');await page.locator('#more-menu-button').hover();assert.equal(await page.locator('#more-menu-button').getAttribute('title'),'更多');await page.locator('#more-menu-button').focus();assert.ok(await page.locator('#more-menu-button').evaluate(el=>el.matches(':focus-visible')));
    });
    await page.screenshot({path:path.join(outputRoot,'screens',`${type}-${viewport.width}-${colorTheme}-acceptance.png`)});
    return { type, theme:colorTheme, operations:page.qaSteps.flatMap(step=>step.operations) };
  },true);
}

async function proportionalFlow(page) {
  const sample = () => page.evaluate(() => {
    const animations = document.getAnimations().filter(animation => ['edge-flow', 'sequence-edge-flow'].includes(animation.animationName));
    for (const animation of animations) { animation.pause(); animation.currentTime = 140; }
    const zoom = new DOMMatrix(getComputedStyle(document.querySelector('.react-flow__viewport')).transform).a;
    const nodeWidth = document.querySelector('.diagram-node').getBoundingClientRect().width;
    const strokes = [...document.querySelectorAll('.edge-flow,.flow-edge--sequence .react-flow__edge-path,.flow-edge--sequence mask path')].map(element => {
      const style = getComputedStyle(element);
      const sequence = Boolean(element.closest('.flow-edge--sequence')), unit = sequence ? Math.max(1, .6 / zoom) : 1;
      const dash = style.strokeDasharray.split(/[ ,]+/).map(parseFloat).filter(Number.isFinite);
      if (sequence && dash.length && Math.abs(dash.reduce((sum, value) => sum + value, 0) * zoom - Math.max(6, 10 * zoom)) > .001) throw new Error('Sequence dashes must retain their 6 CSS px minimum period.');
      return [parseFloat(style.strokeWidth), parseFloat(style.strokeDashoffset), ...dash].map((value, index) => value * zoom / nodeWidth / (index ? unit : 1));
    });
    for (const animation of animations) animation.play();
    return { zoom, strokes };
  });
  const original = await sample();
  for (const control of ['zoomin', 'zoomin', 'zoomout']) {
    const button = page.locator(`.react-flow__controls-${control}`);
    if (await button.isDisabled()) {
      const current = await sample();
      assert.ok(Math.abs(current.zoom - (control === 'zoomin' ? 2 : .08)) < .001, 'Zoom controls disable only at the declared limit.');
      continue;
    }
    await button.click(); await page.waitForTimeout(250);
    const current = await sample();
    assert.equal(current.strokes.length, original.strokes.length);
    current.strokes.forEach((values, i) => values.forEach((value, j) => assert.ok(Math.abs(value - original.strokes[i][j]) < .0001, 'Stroke width scales with nodes; dash pattern and phase stay synchronized above the overview minimum.')));
  }
  await fit(page);
}

async function nodePointerTarget(page, node) {
  await settledViewport(page);
  const element = nodeElement(page, node.id);
  const locate = async () => page.evaluate(async id => {
    // Pan and selection may replace the SVG; resolve the live hit target on each frame.
    for (let frame = 0; frame < 20; frame++) {
      const root = document.querySelector(`.react-flow__node-diagram[data-id="${CSS.escape(id)}"]`);
      const element = root?.querySelector('.sequence-head,.participant-head,.actor-figure,.state-dot,.shape-label,header') ?? root;
      if (!element) { await new Promise(requestAnimationFrame); continue; }
      const box = element.getBoundingClientRect();
      const point = [[.5, .5], [.9, .5], [.1, .5], [.5, .9], [.5, .1]]
        .map(([x, y]) => ({ x: box.x + box.width * x, y: box.y + box.height * y }))
        .find(({ x, y }) => document.elementFromPoint(x, y)?.closest('.react-flow__node-diagram') === root);
      if (point) return point;
      await new Promise(requestAnimationFrame);
    }
  }, node.id);
  let point = await locate();
  if (!point) {
    const shift = await element.evaluate(element => {
      const node = element.getBoundingClientRect(), banner = document.querySelector('.layout-problems')?.getBoundingClientRect();
      return banner && node.left < banner.right && node.right > banner.left && node.top < banner.bottom && node.bottom > banner.top ? banner.bottom - node.top + 24 : 0;
    });
    if (shift) {
      const blank = await blankPoint(page);
      await page.mouse.move(blank.x, blank.y); await page.mouse.down(); await page.mouse.move(blank.x, blank.y + shift, { steps: 8 }); await page.mouse.up();
      await page.waitForTimeout(160); point = await locate();
    }
  }
  if (!point) {
    // An open floating panel can cover a node of the fitted diagram; pan the canvas so the node clears the panel, then retry.
    const shift = await element.evaluate(element => {
      const box = element.getBoundingClientRect();
      const panel = [...document.querySelectorAll('.sidebar')].map(item => item.getBoundingClientRect()).find(item => box.left < item.right && box.right > item.left);
      return panel ? (panel.left < innerWidth / 2 ? panel.right - box.left + 24 : panel.left - box.right - 24) : 0;
    });
    if (shift) {
      const blank = await page.locator('.react-flow__pane').evaluate(pane => {
        const box = pane.getBoundingClientRect();
        return [.5, .35, .65].flatMap(y => [.5, .4, .6].map(x => ({ x: box.x + box.width * x, y: box.y + box.height * y }))).find(({ x, y }) => document.elementFromPoint(x, y) === pane) ?? Array.from({ length: Math.ceil(box.height / 24) }, (_, row) => row * 24 + 72).flatMap(y => Array.from({ length: Math.ceil(box.width / 24) }, (_, col) => ({ x: col * 24 + 12, y }))).find(({ x, y }) => x < innerWidth - 8 && y < innerHeight - 8 && document.elementFromPoint(x, y) === pane);
      });
      assert.ok(blank, 'A blank canvas point is available to uncover a covered node.');
      await page.mouse.move(blank.x, blank.y); await page.mouse.down(); await page.mouse.move(blank.x + shift, blank.y, { steps: 8 }); await page.mouse.up();
      await page.waitForTimeout(160); point = await locate();
    }
  }
  assert.ok(point, `Node ${node.id} exposes a pointer target outside canvas overlays. ${point ? '' : JSON.stringify(await element.evaluate(el => { const b=el.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+Math.min(b.height/2,18));return {bounds:b.toJSON(),hit:hit?.outerHTML.slice(0,300)}; }))}`);
  return point;
}
async function pointerNode(page, node, drag = false) {
  const { x, y } = await nodePointerTarget(page, node);
  await page.mouse.move(x, y); await page.mouse.down();
  if (drag) await page.mouse.move(x + 36, y + 22, { steps: 8 });
  await page.mouse.up();
}
async function entrypoints(browser, url, graph) {
  if (graph.meta.diagramType === 'sequence') return; // Native sequence entry points and Inspector fallback are checked by sequence-reading/persistence.
  await runCase(browser, `${graph.meta.diagramType}-selection-entrypoints`, viewports[0], {}, async page => {
    await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
    await page.goto(url); await chooseGraph(page, graph, false); await hidePanels(page); await fit(page);
    const exportCurrentDraft = async suffix => {
      const name = `${graph.meta.diagramType}-${suffix}`, savedFile = path.join(outputRoot, 'exports', name + '.json');
      await openMore(page); const [saved] = await Promise.all([page.waitForEvent('download'), menuItem(page, '保存 Graph JSON').click()]);
      await saved.saveAs(savedFile);
      const model = JSON.parse(fs.readFileSync(savedFile, 'utf8'));
      const current = (model.diagrams ?? [model]).find(item => item.meta.diagramType === graph.meta.diagramType);
      let invalid = false;
      try { requireDiagramQuality(current); } catch { invalid = true; }
      if (!invalid) return { current, ...await exportsMatch(page, current, name) };
      const downloads = [], listener = download => downloads.push(download);
      page.on('download', listener);
      try {
        await page.locator('.layout-problems').waitFor();
        for (const format of ['SVG', 'PNG']) {
          await openMore(page); await menuItem(page, `导出 ${format}`).click();
          await page.waitForFunction(() => document.querySelector('.toast')?.textContent.includes('Diagram quality failed'));
        }
        assert.equal(downloads.length, 0, 'Invalid edited geometry retains its JSON draft and blocks both image downloads.');
      } finally { page.off('download', listener); }
      return { current, blocked: true, savedFile };
    };
    const legendAnchor = await assertLegendLayout(page);
    const selected = target(graph);
    const viewBeforeClick = await page.locator('.react-flow__viewport').getAttribute('style'); await pointerNode(page, selected);
    await selection(page, graph, selected.id); await assertFlow(page);
    const card = page.locator('.node-card'); await card.waitFor();
    assert.equal(await card.getAttribute('data-node-id'), selected.id, 'A click shows the quick look for that node.'); assert.equal(await card.getAttribute('role'), 'dialog');
    assert.equal(await card.locator('h4').innerText(), selected.label); assert.ok(await card.locator('.card-tags span').count() <= 4, 'The quick look shows at most four tags.');
    assert.equal(await card.getByRole('button', { name: '编辑文字', exact: true }).isDisabled(), true, 'Text editing is disabled while layout is locked.');
    assert.equal(await count(page, '.inspector'), 0, 'A click does not open the inspector.');
    assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'), viewBeforeClick, 'A click does not move the canvas.');
    const cardBefore = await card.boundingBox(); await page.locator('.react-flow__controls-zoomin').click(); await page.waitForTimeout(260); const cardAfter = await card.boundingBox();
    assert.ok(Math.abs(cardAfter.x - cardBefore.x) > 1 || Math.abs(cardAfter.y - cardBefore.y) > 1, 'The quick look follows its node through zoom.');
    await card.getByRole('button', { name: '查看详情', exact: true }).click(); await page.locator('.inspector').waitFor(); await card.waitFor({ state: 'detached' });
    await assertInspector(page, selected); assert.equal(await pulse(page), 1);
    await page.waitForTimeout(480); const oldPulse = await pulse(page); await fit(page); await pointerNode(page, selected);
    await selection(page, graph, selected.id); await assertFlow(page); assert.equal(await count(page, '.node-card'), 0, 'With the inspector open a click updates it without a quick look.'); await assertSelectedDetails(page, graph); assert.equal(await pulse(page), oldPulse + 1, 'Clicking an already selected node replays once.');
    await page.waitForTimeout(480);
    await page.locator('.inspector').focus(); await page.keyboard.press('Escape'); await page.locator('.inspector').waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-controls') === 'node-inspector');
    assert.equal(await count(page, '.diagram-node.is-selected'), 1, 'Escape closes the focused panel and returns focus to its toggle before touching the selection.');
    await clear(page); await hidePanels(page); await fit(page);
    const keyboardNode = graph.nodes.find(node => node.id !== selected.id) ?? selected;
    await nodeElement(page, keyboardNode.id).focus(); await page.keyboard.press('Enter');
    await selection(page, graph, keyboardNode.id); await assertFlow(page); await assertSelectedDetails(page, graph); assert.equal(await pulse(page), oldPulse + 2);
    await clear(page);
    await nodeElement(page, keyboardNode.id).focus(); await page.keyboard.press('Space');
    await selection(page, graph, keyboardNode.id); await assertFlow(page); await assertSelectedDetails(page, graph); assert.equal(await pulse(page), oldPulse + 3, 'Space produces one selection pulse.');
    await clear(page); await searchSelect(page, graph, selected, true);
    const searchPulse = await pulse(page); await clear(page);
    await hidePanels(page); await fit(page); await setLocked(page, false);
    const geometryBeforeDrag = await geometry(page); await pointerNode(page, selected, true);
    await selection(page, graph, selected.id); await assertFlow(page); assert.equal(await count(page, '.inspector'), 0); await assertSelectedDetails(page, graph); assert.equal(await pulse(page), searchPulse + 1, 'Dragging selects once.');
    const geometryAfterDrag = await geometry(page);
    assert.notDeepEqual(geometryAfterDrag.nodes, geometryBeforeDrag.nodes, 'Unlocked drag moves a node.');
    if (graph.meta.diagramType === 'sequence') assert.equal(geometryAfterDrag.nodes.find(node => node.id === selected.id).position.y, geometryBeforeDrag.nodes.find(node => node.id === selected.id).position.y, 'Sequence participants only move horizontally.');
    await selection(page, graph, selected.id); await exportCurrentDraft('dragged');
    const beforeSpacing = await geometry(page);
    await openMore(page); await menuItem(page, '整理间距').click(); const spacingStatus = await status(page);
    assert.match(spacingStatus, /移动 \d+ 个节点|当前间距无需调整|当前约束下无法继续整理|仍有.*(?:问题|手动)/);
    if (spacingStatus === '当前约束下无法继续整理') assert.deepEqual(await geometry(page), beforeSpacing, 'A rejected spacing candidate does not partially change geometry.');
    await openMore(page); await menuItem(page, '重置').click(); await hidePanels(page); await fit(page);
    const authored = await geometry(page);
    for (const node of graph.nodes) assert.deepEqual(authored.nodes.find(value => value.id === node.id).position, node.position, 'Reset restores authored positions.');
    await openMore(page); assert.equal(await page.getByRole('switch', { name: '可拖动', exact: true }).count(), 1, 'Reset preserves lock preference.'); await dismiss(page);
    await pointerNode(page, selected);
    const editCard = page.locator('.node-card'); await editCard.waitFor();
    const editButton = editCard.getByRole('button', { name: '编辑文字', exact: true });
    assert.equal(await editButton.isEnabled(), true); await editButton.click();
    const nodeName = editCard.getByRole('textbox', { name: '名称', exact: true });
    await nodeName.fill('   '); await editCard.getByRole('button', { name: '保存', exact: true }).click();
    assert.equal(await editCard.getByRole('alert').innerText(), '名称不能为空'); assert.equal(await nodeName.evaluate(element => element === document.activeElement), true);
    await nodeName.fill(selected.label + ' QA'); await page.keyboard.press('Escape');
    assert.equal(await editButton.evaluate(element => element === document.activeElement), true, 'Escape cancels editing and returns focus to its quick look action.');
    await editButton.click();
    const editedNodeLabel = selected.label + ' QA';
    await editCard.getByRole('textbox', { name: '名称', exact: true }).fill(editedNodeLabel);
    await editCard.getByRole('textbox', { name: '说明', exact: true }).fill('会话说明');
    await editCard.getByRole('button', { name: '保存', exact: true }).click();
    await page.waitForFunction(({ id, label }) => document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"] .node-visual title`)?.textContent.startsWith(label), { id: selected.id, label: editedNodeLabel });
    assert.equal(await editCard.locator('h4').innerText(), editedNodeLabel);
    await nav(page, true); assert.ok((await page.locator('.nav .search-results').innerText()).includes(editedNodeLabel), 'Directory uses current node text.'); await nav(page, false);
    await editCard.getByRole('button', { name: '查看详情', exact: true }).click();
    assert.equal(await page.locator('.drawer-body h2').innerText(), editedNodeLabel); assert.equal(await page.locator('.drawer-subtitle').innerText(), '会话说明');
    await clear(page, 'close'); await hidePanels(page);
    if (graph.edges.length) {
      const edge = page.locator('.react-flow__edge').first();
      await edge.focus(); await page.keyboard.press('Enter');
      await assertFlow(page); const relationCard = page.locator('.relation-card'); await relationCard.waitFor();
      assert.equal(await count(page, '.inspector'), 0, 'Relationship click opens quick look before details.');
      await relationCard.getByRole('button', { name: '编辑文字', exact: true }).click();
      const editedEdgeLabel = '会话关系';
      await relationCard.getByRole('textbox', { name: '名称', exact: true }).fill(editedEdgeLabel);
      await relationCard.getByRole('button', { name: '保存', exact: true }).click();
      assert.ok((await relationCard.locator('h4').innerText()).includes(editedEdgeLabel));
      assert.ok((await edge.getAttribute('aria-label')).includes(editedEdgeLabel), 'Edited relationship text updates its accessible name.');
      await relationCard.getByRole('button', { name: '查看详情', exact: true }).click();
      assert.ok((await page.locator('.drawer-body h2').innerText()).includes(editedEdgeLabel));
      await clear(page, 'close'); await edge.focus(); await page.keyboard.press('Enter'); await relationCard.waitFor(); await assertFlow(page);
      const downloads = await exportCurrentDraft('edited');
      assert.equal(downloads.current.nodes.find(node => node.id === selected.id).label, editedNodeLabel);
      assert.equal(downloads.current.edges[0].label, editedEdgeLabel);
      if (downloads.svgFile) {
        const editedSvg = fs.readFileSync(downloads.svgFile, 'utf8');
        assert.ok(editedSvg.includes(editedNodeLabel) && editedSvg.includes(editedEdgeLabel), 'SVG export uses current session text.');
      }
      await openMore(page); await menuItem(page, '重置').click();
      await page.waitForFunction(({ id, label }) => document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"] .node-visual title`)?.textContent.startsWith(label), { id: selected.id, label: selected.label });
      assert.ok(!(await page.locator('.canvas').innerText()).includes(editedEdgeLabel), 'Reset restores authored relationship text.');
    }
    const viewport = page.locator('.react-flow__viewport');
    const beforeZoom = await viewport.evaluate(element => new DOMMatrix(getComputedStyle(element).transform).a);
    const zoomIn = page.locator('.react-flow__controls-zoomin'), zoomOut = page.locator('.react-flow__controls-zoomout');
    const zoomingIn = await zoomIn.isEnabled(), zoomControl = zoomingIn ? zoomIn : zoomOut;
    assert.ok(await zoomControl.isEnabled(), 'At least one zoom direction remains available.');
    const zoomDetails = await count(page, '.drawer-body h2');
    await zoomControl.click(); await page.waitForTimeout(220);
    const afterZoom = await viewport.evaluate(element => new DOMMatrix(getComputedStyle(element).transform).a);
    assert.ok(zoomingIn ? afterZoom > beforeZoom : afterZoom < beforeZoom, 'An enabled zoom control changes scale in its direction.');
    assert.deepEqual(await assertLegendLayout(page), legendAnchor, 'Zoom does not move or resize the legend.');
    assert.equal(await count(page, '.drawer-body h2'), zoomDetails); await assertFlow(page);
    await fit(page);
    const beforePan = await viewport.getAttribute('style'); const blank = await blankPoint(page);
    await page.mouse.move(blank.x, blank.y); await page.mouse.down(); await page.mouse.move(blank.x + 40, blank.y + 25, { steps: 8 }); await page.mouse.up();
    assert.notEqual(await viewport.getAttribute('style'), beforePan, 'Dragging empty canvas pans the viewport.');
    assert.deepEqual(await assertLegendLayout(page), legendAnchor, 'Pan does not move or resize the legend.');
    await fit(page); const beforeMap = await viewport.getAttribute('style'); const minimap = await page.locator('.react-flow__minimap').boundingBox();
    await page.mouse.move(minimap.x + minimap.width * .55, minimap.y + minimap.height * .45); await page.mouse.down(); await page.mouse.move(minimap.x + minimap.width * .7, minimap.y + minimap.height * .6, { steps: 8 }); await page.mouse.up();
    assert.notEqual(await viewport.getAttribute('style'), beforeMap, 'Dragging the minimap navigates the canvas.');
    await button(page, '适应画布').click(); await page.waitForTimeout(360);
    await searchSelect(page, graph, selected); await clear(page, 'pane');
    await page.keyboard.press('Backspace'); await page.keyboard.press('Delete'); assert.equal(await count(page, '.diagram-node'), graph.nodes.length);
    return { type: graph.meta.diagramType, pointer: true, repeated: true, keyboard: ['Enter', 'Space'], search: true, drag: true, edge: true, edgeKeyboard: true, panZoomMinimap: true, spacingStatus };
  }, true);
}

async function mobileEditingCheck(browser, url, graph) {
  await runCase(browser, `${graph.meta.diagramType}-390-mobile-editing`, viewports[2], {}, async page => {
    await page.goto(url); await chooseGraph(page, graph, true); await hidePanels(page); await fit(page); await setLocked(page, false);
    const selected = target(graph), edited = selected.label + ' 移动端';
    await pointerNode(page, selected);
    const card = page.locator('.node-card'); await card.waitFor();
    await card.getByRole('button', { name: '编辑文字', exact: true }).click();
    await card.getByRole('textbox', { name: '名称', exact: true }).fill(edited);
    await card.getByRole('button', { name: '保存', exact: true }).click();
    assert.equal(await card.locator('h4').innerText(), edited);
    assert.ok(await card.evaluate(element => { const box = element.getBoundingClientRect(), canvas = element.closest('.canvas').getBoundingClientRect(); return box.left >= canvas.left && box.right <= canvas.right && box.top >= canvas.top && box.bottom <= canvas.bottom; }), 'The mobile editing card stays inside the canvas.');
    await page.reload(); await page.locator('.diagram-node').first().waitFor(); await chooseGraph(page, graph, true);
    await page.waitForFunction(({ id, label }) => document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"] .node-visual title`)?.textContent.startsWith(label), { id: selected.id, label: selected.label });
    await hidePanels(page); await fit(page); await setLocked(page, false); await pointerNode(page, selected);
    const resetCard = page.locator('.node-card'); await resetCard.getByRole('button', { name: '编辑文字', exact: true }).click();
    await resetCard.getByRole('textbox', { name: '名称', exact: true }).fill(edited);
    await resetCard.getByRole('button', { name: '保存', exact: true }).click();
    await openMore(page); await menuItem(page, '重置').click();
    await page.waitForFunction(({ id, label }) => document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"] .node-visual title`)?.textContent.startsWith(label), { id: selected.id, label: selected.label });
    return { nodeEditing: true, boundedCard: true, reload: true, reset: true };
  }, true);
}

async function relationshipCardAvoidanceCheck(browser, url) {
  const graph = {
    meta: { title: '关系速览避让', diagramType: 'flowchart', sourceRef: 'browser test fixture', locale: 'zh-CN' },
    groups: [],
    nodes: [
      { id: 'left', label: '左侧处理', kind: 'process', position: { x: 300, y: 100 }, size: { width: 180, height: 100 } },
      { id: 'right', label: '右侧处理', kind: 'process', position: { x: 720, y: 100 }, size: { width: 180, height: 100 } }
    ],
    edges: [{ id: 'crowded', source: 'left', target: 'right', label: '校验通过', kind: 'flow', evidence: 'test', route: { labelAt: { x: 600, y: 195 } } }]
  };
  assert.deepEqual(validateGraph(graph), []);
  const html = fs.readFileSync(path.join(inputRoot, 'index.html'), 'utf8').replace(
    /(<script id="graph-data" type="application\/json">)[\s\S]*?(<\/script>)/,
    (_, open, close) => open + JSON.stringify(graph).replaceAll('<', '\\u003c') + close
  );
  await runCase(browser, 'relationship-card-avoidance', viewports[0], {}, async page => {
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto(url); await page.locator('.diagram-node').first().waitFor(); await hidePanels(page); await fit(page);
    await page.locator('.react-flow__edge-interaction').dispatchEvent('click');
    const card = page.locator('.relation-card'); await card.waitFor();
    const placement = await card.evaluate(element => {
      const box = element.getBoundingClientRect();
      const overlaps = [...document.querySelectorAll('.react-flow__node-diagram')].filter(node => {
        const target = node.getBoundingClientRect();
        return box.left < target.right && box.right > target.left && box.top < target.bottom && box.bottom > target.top;
      }).map(node => node.dataset.id);
      return { below: element.classList.contains('is-below'), overlaps };
    });
    assert.equal(placement.below, true, 'A relationship card uses the free space below a crowded midpoint.');
    assert.deepEqual(placement.overlaps, [], 'The relationship card does not cover either adjacent node.');
    return { below: true, nodeOverlap: false };
  }, true);
  await runCase(browser, 'quick-card-overlap', viewports[0], { reducedMotion: 'reduce' }, async page => {
    const crowded = { meta: { ...graph.meta, title: 'Four-direction quick-look test fixture' }, groups: [], edges: [],
      nodes: [['center', 600, 340], ['left', 390, 340], ['right', 810, 340], ['below', 600, 480], ['above', 600, 180]].map(([id, x, y]) => ({ id, label: id, kind: 'process', position: { x, y }, size: { width: 180, height: 100 } })) };
    assert.deepEqual(validateGraph(crowded), []);
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: html.replace(/(<script\b[^>]*\bid="graph-data"[^>]*>)[\s\S]*?(<\/script>)/, (_, start, end) => start + JSON.stringify(crowded) + end) }));
    await page.goto(url); await page.locator('.diagram-node').first().waitFor(); await fit(page);
    await nodeElement(page, 'center').locator('.diagram-node').click(); await page.locator('.node-card').waitFor();
    const placement = await page.locator('.node-card').evaluate(card => {
      const box = card.getBoundingClientRect(), node = document.querySelector('[data-id="center"]').getBoundingClientRect();
      const neighbours = [...document.querySelectorAll('.react-flow__node-diagram')].filter(element => element.dataset.id !== 'center').map(element => element.getBoundingClientRect());
      const areaBottom = Math.min(...[...document.querySelectorAll('.react-flow__controls,.react-flow__minimap')].map(element => element.getBoundingClientRect().top - 12));
      const candidates = [{ side: 'right', x: node.right + 14, y: node.top }, { side: 'left', x: node.left - 14 - box.width, y: node.top },
        { side: 'below', x: node.left, y: node.bottom + 14 }, { side: 'above', x: node.left, y: node.top - 14 - box.height }].map(item => ({ ...item,
          fits: item.x >= 24 && item.x + box.width <= innerWidth - 24 && item.y >= 76 && item.y + box.height <= areaBottom,
          covered: neighbours.reduce((sum, neighbour) => sum + Math.max(0, Math.min(item.x + box.width, neighbour.right) - Math.max(item.x, neighbour.left)) * Math.max(0, Math.min(item.y + box.height, neighbour.bottom) - Math.max(item.y, neighbour.top)), 0) }));
      return { candidates, chosen: candidates.find(item => Math.abs(item.x - box.left) < 1 && Math.abs(item.y - box.top) < 1)?.side };
    });
    assert.ok(placement.candidates.every(item => item.fits && item.covered > 0), 'All four fitting directions must actually overlap in this counterexample.');
    assert.equal(placement.candidates.find(item => item.side === placement.chosen)?.covered, Math.min(...placement.candidates.map(item => item.covered)), 'The quick look chooses the least covered direction.');
    return placement;
  }, true);
}

async function editPersistenceChecks(browser, url) {
  const collection = { note: 'Preserve collection metadata and original ordering', diagrams: ['flowchart', 'architecture'].map(type => ({
    meta: { title: type, diagramType: type, locale: 'zh-CN', sourceRef: 'Browser regression fixture' },
    nodes: ['left', 'right'].map((id, index) => ({ id, label: id, kind: type === 'flowchart' ? 'process' : 'service',
      position: { x: 300 + index * 500, y: 100 }, size: { width: 240, height: 160 },
      source: { kind: 'test', file: 'browser-interactions.mjs', lineStart: 1, lineEnd: 2 }, facts: ['Synthetic fixture'] })),
    edges: [{ id: 'relation', source: 'left', target: 'right', label: '原关系', kind: type === 'flowchart' ? 'flow' : 'call', evidence: 'test' }]
  })) };
  assert.deepEqual(validateGraphInput(collection), []);
  const html = fs.readFileSync(path.join(inputRoot, 'index.html'), 'utf8').replace(
    /(<script id="graph-data" type="application\/json">)[\s\S]*?(<\/script>)/,
    (_, open, close) => open + JSON.stringify(collection) + close
  );
  for (const viewport of [viewports[0], viewports[2]]) await runCase(browser, `${viewport.width}-edit-persistence`, viewport, {}, async page => {
    await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto(url); await page.locator('.diagram-node').first().waitFor();
    const expected = structuredClone(collection);
    const switchTo = async type => {
      await dismiss(page); await page.locator('#view-menu-button').click();
      await page.getByRole('menuitemradio').filter({ hasText: labels[type] }).click();
      await page.waitForFunction(label => document.querySelector('#view-menu-button span')?.textContent === label, labels[type]);
      await hidePanels(page); await fit(page);
    };
    const downloadJson = async suffix => {
      await openMore(page);
      assert.ok(await page.locator('.menu.is-right').evaluate(element => { const box = element.getBoundingClientRect(); return box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight; }), 'The save action remains inside the viewport.');
      if (suffix === 'edited') await page.screenshot({ path: path.join(outputRoot, 'screens', `${viewport.width}-save-menu.png`), animations: 'disabled' });
      const [downloadedFile] = await Promise.all([page.waitForEvent('download'), menuItem(page, '保存 Graph JSON').click()]);
      const downloaded = downloadedFile;
      assert.equal(downloaded.suggestedFilename(), 'graph.json');
      const file = path.join(outputRoot, 'exports', `${viewport.width}-${suffix}.json`);
      await downloaded.saveAs(file); assert.equal(await downloaded.failure(), null);
      return file;
    };
    for (const graph of expected.diagrams) {
      await switchTo(graph.meta.diagramType); await setLocked(page, false);
      await pointerNode(page, graph.nodes[0], true);
      graph.nodes[0].position = (await geometry(page)).nodes.find(node => node.id === 'left').position;
      assert.notDeepEqual(graph.nodes[0].position, collection.diagrams.find(g => g.meta.diagramType === graph.meta.diagramType).nodes[0].position);
      const card = page.locator('.node-card'); await card.getByRole('button', { name: '编辑文字', exact: true }).click();
      graph.nodes[0].label = graph.meta.diagramType === 'flowchart' ? '流程改名' : '服务改名'; graph.nodes[0].subtitle = '修改说明';
      await card.getByRole('textbox', { name: '名称', exact: true }).fill(graph.nodes[0].label);
      await card.getByRole('textbox', { name: '说明', exact: true }).fill(graph.nodes[0].subtitle);
      await card.getByRole('button', { name: '保存', exact: true }).click();
      await page.locator('.react-flow__edge-interaction').dispatchEvent('click');
      const relation = page.locator('.relation-card'); await relation.getByRole('button', { name: '编辑文字', exact: true }).click();
      graph.edges[0].label = graph.meta.diagramType === 'flowchart' ? '流程关系' : '服务关系';
      await relation.getByRole('textbox', { name: '名称', exact: true }).fill(graph.edges[0].label);
      await relation.getByRole('button', { name: '保存', exact: true }).click();
    }
    await switchTo('flowchart');
    assert.ok((await nodeElement(page, 'left').innerText()).includes('流程改名'), 'Switching back retains text for this type even with shared node IDs.');
    assert.deepEqual((await geometry(page)).nodes.find(node => node.id === 'left').position, expected.diagrams[0].nodes[0].position);
    const savedFile = await downloadJson('edited');
    const saved = JSON.parse(fs.readFileSync(savedFile, 'utf8'));
    for (let index = 0; index < expected.diagrams.length; index++) {
      const position = saved.diagrams[index].nodes[0].position, painted = expected.diagrams[index].nodes[0].position;
      for (const axis of ['x', 'y']) assert.ok(Math.abs(position[axis] - painted[axis]) < .001, 'Saved positions agree with the painted CSS matrix, allowing its subpixel rounding.');
      expected.diagrams[index].nodes[0].position = position;
    }
    assert.deepEqual(saved, expected, 'The download includes every edited view, source field and collection metadata.');
    const regenerated = path.join(outputRoot, `${viewport.width}-regenerated`);
    const result = spawnSync(process.execPath, [path.join(import.meta.dirname, 'generate-viewer.mjs'), savedFile, regenerated, '--repo-root', import.meta.dirname], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).sourceEvidence.status, 'passed');
    await openMore(page); await menuItem(page, '重置').click();
    expected.diagrams[0] = collection.diagrams[0];
    await switchTo('architecture'); await switchTo('flowchart');
    assert.deepEqual(JSON.parse(fs.readFileSync(await downloadJson('reset'), 'utf8')), expected, 'Reset restores only the active graph, including absent optional subtitles.');
    await page.goto(pathToFileURL(path.join(regenerated, 'index.html')).href); await page.locator('.diagram-node').first().waitFor();
    assert.ok((await nodeElement(page, 'left').innerText()).includes('服务改名'));
    await switchTo('flowchart'); assert.ok((await nodeElement(page, 'left').innerText()).includes('流程改名'));
    await page.screenshot({ path: path.join(outputRoot, 'screens', `${viewport.width}-saved-model.png`), animations: 'disabled' });
    return { retainedAcrossViews: true, resetIsolated: true, jsonRoundTrip: true, sourceReverified: true, fileUrlReopened: true };
  }, true);
}

async function edgeContrast(page, edgeId, details = false) {
  const sample = await page.evaluate(id => {
    const base = document.getElementById(id);
    const edge = base.closest('.react-flow__edge');
    const flow = edge.querySelector('.edge-flow');
    const properties = element => {
      const s = getComputedStyle(element);
      return { className: element.getAttribute('class'), stroke: s.stroke, width: parseFloat(s.strokeWidth),
        opacity: Number(s.opacity), strokeOpacity: Number(s.strokeOpacity),
        alpha: Number(s.opacity) * Number(s.strokeOpacity), filter: s.filter,
        dash: s.strokeDasharray === 'none' ? [] : s.strokeDasharray.split(/[ ,]+/).map(parseFloat),
        dashOffset: s.strokeDashoffset, animationTimes: element.getAnimations().map(animation => animation.currentTime) };
    };
    const track = properties(base), moving = properties(flow);
    const overlays = [...edge.querySelectorAll('.selection-edge-halo,.selection-edge-shine')].map(properties);
    const background = getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim();
    const pixels = (offset, selected) => {
      const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 32;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = background; ctx.fillRect(0, 0, 160, 32);
      const draw = (s, phase = 0) => {
        if (!s.stroke || s.stroke === 'none') throw new Error(`Missing computed stroke in contrast sample: ${s.className}`);
        ctx.save(); ctx.strokeStyle = s.stroke; ctx.lineWidth = s.width;
        ctx.globalAlpha = s.alpha; ctx.filter = s.filter; ctx.lineCap = 'round';
        ctx.setLineDash(s.dash); ctx.lineDashOffset = phase;
        ctx.beginPath(); ctx.moveTo(8, 16); ctx.lineTo(152, 16); ctx.stroke(); ctx.restore();
      };
      if (selected) overlays.forEach(s => draw(s));
      draw(selected ? track : { ...track, alpha: 0.55 });
      draw(moving, offset);
      return ctx.getImageData(12, 14, 136, 4).data;
    };
    const delta = selected => {
      const a = pixels(0, selected), b = pixels(-7.5, selected);
      return a.reduce((sum, value, index) => sum + (index % 4 === 3 ? 0 : Math.abs(value - b[index])), 0);
    };
    const reference = delta(false);
    if (reference === 0) throw new Error(`No visible reference flow: ${id}`);
    const selected = delta(true);
    return { ratio: selected / reference, reference, selected, background, base: track, flow: moving, overlays };
  }, edgeId);
  return details ? sample : sample.ratio;
}

async function sequenceEdgeSample(page, edgeId) {
  return page.evaluate(id => {
    const properties = element => {
      const style = getComputedStyle(element);
      return { d: element.getAttribute('d'), dash: style.strokeDasharray === 'none' ? [] : style.strokeDasharray.split(/[ ,]+/).map(parseFloat),
        dashOffset: style.strokeDashoffset, opacity: Number(style.strokeOpacity), elementOpacity: Number(style.opacity), width: parseFloat(style.strokeWidth), filter: style.filter,
        markerEnd: element.getAttribute('marker-end'), mask: element.getAttribute('mask') };
    };
    const base = document.getElementById(id), edge = base.closest('.react-flow__edge'), flow = edge.querySelector('.edge-flow');
    const maskId = flow?.getAttribute('mask')?.match(/^url\(#(.+)\)$/)?.[1];
    const mask = maskId ? document.getElementById(maskId) : null, maskPath = mask?.querySelector('path');
    return { base: properties(base), flow: flow ? properties(flow) : null, maskId,
      mask: mask ? { x: mask.getAttribute('x'), y: mask.getAttribute('y'), width: mask.getAttribute('width'), height: mask.getAttribute('height'), path: properties(maskPath) } : null,
      overlays: [...edge.querySelectorAll('.selection-edge-halo,.selection-edge-shine')].map(properties) };
  }, edgeId);
}

// Sample the rendered page, not a re-created canvas stroke or animation clock.
async function sequenceFlowPixels(page, checked, name) {
  const frames = [], viewports = [];
  for (const phase of [null, 0, 175]) {
    await page.locator('.flow-edge--sequence').evaluateAll((elements, phase) => {
      for (const element of elements) {
        element.querySelector('.sequence-edge-flow').style.visibility = phase === null ? 'hidden' : '';
        for (const animation of element.getAnimations({ subtree: true }).filter(a => a.animationName === 'sequence-edge-flow')) { animation.pause(); animation.currentTime = phase ?? 0; }
      }
    }, phase);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    viewports.push(await page.locator('.react-flow__viewport').getAttribute('style'));
    frames.push((await page.screenshot({ ...(name ? { path: path.join(outputRoot, 'screens', `${name}-${phase ?? 'baseline'}.png`) } : {}), animations: 'allow' })).toString('base64'));
  }
  const samples = await page.evaluate(async ({ frames, checked }) => {
    const images = await Promise.all(frames.map(async frame => {
      const image = new Image(); image.src = 'data:image/png;base64,' + frame; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      return { width: image.width, height: image.height, pixels: context.getImageData(0, 0, image.width, image.height).data };
    }));
    const scale = images[0].width / innerWidth;
    const pixel = (image, point) => { const i = (Math.floor(point.y * scale) * image.width + Math.floor(point.x * scale)) * 4; return image.pixels.slice(i, i + 3); };
    const delta = (a, b) => a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0);
    const labels = [...document.querySelectorAll('.edge-label')].map(element => element.getBoundingClientRect());
    return checked.map(({ id, dashed }) => {
      const path = document.getElementById(id), matrix = path.getScreenCTM(), zoom = Math.hypot(matrix.a, matrix.b), length = path.getTotalLength();
      const period = getComputedStyle(path.closest('.react-flow__edge').querySelector('.edge-flow')).strokeDasharray.split(/[ ,]+/).reduce((sum, value) => sum + parseFloat(value), 0);
      let motion = 0;
      const phases = [0, 175].map(time => ({ time, ink: 0, gap: 0, inkCount: 0, gapCount: 0 }));
      for (let distance = period * 2.25; distance < length - 16; distance += period) for (const offset of [0, period / 2]) {
        const local = path.getPointAtLength(distance + offset), point = new DOMPoint(local.x, local.y).matrixTransform(matrix);
        if (point.x < 1 || point.y < 8 || point.x >= innerWidth - 1 || point.y >= innerHeight - 8 || labels.some(box => point.x >= box.left - .5 && point.x <= box.right + .5 && point.y >= box.top - .5 && point.y <= box.bottom + .5)) continue;
        const next = path.getPointAtLength(distance + offset + .1), tangent = new DOMPoint(next.x, next.y).matrixTransform(matrix);
        const dx = (tangent.x - point.x) / .1, dy = (tangent.y - point.y) / .1, scaleAlong = Math.hypot(dx, dy);
        if (!scaleAlong) continue;
        const normal = { x: -dy / scaleAlong, y: dx / scaleAlong };
        if (dashed) {
          // Sample the middle of a dash/gap, keeping the complete pixel clear of antialiasing at either phase.
          const center = { x: (Math.floor(point.x * scale) + .5) / scale, y: (Math.floor(point.y * scale) + .5) / scale };
          const phase = period / 4 + ((center.x - point.x) * dx + (center.y - point.y) * dy) / (scaleAlong * scaleAlong);
          const halfPixel = .5 * (Math.abs(dx) + Math.abs(dy)) / (scale * scaleAlong * scaleAlong);
          if (phase - halfPixel < period * .08 || phase + halfPixel > period * .42) continue;
        }
        const colors = images.map(image => pixel(image, point));
        const background = [1, -1].map(sign => ({ x: point.x + normal.x * 7 * sign, y: point.y + normal.y * 7 * sign })).find(point => !labels.some(box => point.x >= box.left - 1 && point.x <= box.right + 1 && point.y >= box.top - 1 && point.y <= box.bottom + 1));
        if (!background) continue;
        // Same-color call flow widens the opaque baseline; its center stays the same color.
        motion += [-1, 0, 1].reduce((sum, offset) => {
          const sample = { x: point.x + normal.x * offset, y: point.y + normal.y * offset };
          return sum + delta(pixel(images[1], sample), pixel(images[2], sample));
        }, 0);
        phases.forEach((phase, index) => {
          const contrast = delta(colors[index + 1], pixel(images[index + 1], background));
          const ink = !dashed || (index === 0 ? offset === 0 : offset === period / 2);
          phase[ink ? 'ink' : 'gap'] += contrast;
          phase[ink ? 'inkCount' : 'gapCount']++;
        });
      }
      for (const phase of phases) { phase.ink /= Math.max(1, phase.inkCount); phase.gap /= Math.max(1, phase.gapCount); }
      return { id, dashed, motion, phases };
    });
  }, { frames, checked });
  assert.equal(new Set(viewports).size, 1, 'Pixel sampling keeps the viewport fixed.');
  for (const sample of samples) {
    assert.ok(sample.phases.every(phase => phase.inkCount > 0) && sample.motion > 12, `${sample.id}: no visible sequence motion in rendered pixels (${JSON.stringify(sample)})`);
    if (sample.dashed) for (const phase of sample.phases) {
      assert.ok(phase.gapCount > 0 && phase.gap < phase.ink * .5, `${sample.id}: dashed strokes must travel while retaining clear gaps at ${phase.time}ms (${JSON.stringify(sample)})`);
    }
  }
  return samples;
}

async function flowContrastChecks(browser, url, graph) {
  for (const colorTheme of ['light', 'dark']) {
    await runCase(browser, `${graph.meta.diagramType}-${colorTheme}-flow-contrast`, viewports[0], {}, async (page, context) => {
      await page.goto(url); await chooseGraph(page, graph, false);
      await theme(page, colorTheme);
      const selected = target(graph); await searchSelect(page, graph, selected);
      if (graph.meta.diagramType === 'sequence') { await hidePanels(page); await fit(page); }
      await page.waitForTimeout(800);
      const stable = await geometry(page), sequence = getDiagram(graph.meta.diagramType).sequence;
      const linked = sequence ? graph.edges : graph.edges.filter(e => e.source === selected.id || e.target === selected.id);
      const directedLinked = linked.filter(edge => hasArrow(edge, graph.meta.diagramType));
      const checked = [];
      for (const edge of linked) {
        const element = page.locator('.react-flow__edge').and(page.locator(`[data-id=${JSON.stringify(edge.id)}]`));
        const flow = element.locator('.edge-flow');
        if (!hasArrow(edge, graph.meta.diagramType)) continue;
        assert.equal(await flow.count(), 1, `${edge.id}: expected one rendered flow path`);
        const before = await flow.evaluate(e => getComputedStyle(e).strokeDashoffset);
        await page.waitForFunction(({ id, before }) => getComputedStyle(document.getElementById(id).closest('.react-flow__edge').querySelector('.edge-flow')).strokeDashoffset !== before, { id: edge.id, before });
        if (sequence) {
          const sample = await sequenceEdgeSample(page, edge.id), dashed = isDashed(edge, graph.meta.diagramType);
          if (dashed) {
            const before = sample.base.dashOffset;
            await page.waitForTimeout(230);
            assert.notEqual((await sequenceEdgeSample(page, edge.id)).base.dashOffset, before, `${edge.id}: the semantic dashed stroke must travel, not just flicker inside fixed gaps`);
          }
          assert.equal(sample.base.opacity, 1, `${edge.id}: sequence baseline stays opaque`);
          assert.equal(sample.base.dash.length > 0, dashed, `${edge.id}: sequence baseline preserves semantic dashes`);
          assert.ok(sample.flow.width <= sample.base.width * 2.01 && sample.flow.filter === 'none', `${edge.id}: sequence flow is legible without hiding notation`);
          assert.ok(sample.base.markerEnd && !sample.flow.markerEnd, `${edge.id}: the baseline arrow remains unclipped and the overlay adds no arrow`);
          assert.equal(Boolean(sample.mask), dashed, `${edge.id}: only dashed sequence messages use a mask`);
          if (sample.mask) {
            assert.equal(sample.mask.path.d, sample.base.d, `${edge.id}: mask reuses the current route`);
            assert.deepEqual(sample.mask.path.dash, sample.base.dash, `${edge.id}: mask reuses the semantic dash cycle`);
            assert.ok(Number(sample.mask.width) > 0 && Number(sample.mask.height) > 0, `${edge.id}: mask has a local non-empty range`);
          }
          checked.push({ id: edge.id, dashed, maskId: sample.maskId });
        } else {
          const ratio = await edgeContrast(page, edge.id);
          assert.ok(ratio >= 0.6, `${edge.id}: selected flow contrast ${ratio.toFixed(3)} is below 60% of reference`);
          checked.push({ id: edge.id, ratio });
        }
      }
      assert.equal(checked.length, directedLinked.length, 'Every expected directed incident edge has a checked flow path.');
      if (sequence) assert.equal(new Set(checked.filter(item => item.dashed).map(item => item.maskId)).size, checked.filter(item => item.dashed).length, 'Every dashed sequence edge has a unique mask id.');
      assert.deepEqual(await geometry(page), stable);
      await searchSelect(page, graph, selected);
      if (sequence) { await hidePanels(page); await fit(page); }
      const phaseSamples = [], pixelSamples = [];
      const overviewChecked = checked.filter(item => { const edge = graph.edges.find(edge => edge.id === item.id); return edge.source !== edge.target; });
      for (const time of [0, 182, 334, 479, 608, 760]) {
        await page.locator('.selection-feedback').evaluateAll((elements, time) => {
          for (const animation of new Set(elements.flatMap(e => e.getAnimations({ subtree: true })))) {
            animation.pause(); animation.currentTime = time;
          }
        }, time);
        await page.evaluate(() => new Promise(requestAnimationFrame));
        for (const { id } of checked) {
          if (sequence) {
            const sample = await sequenceEdgeSample(page, id);
            phaseSamples.push({ id, time, base: sample.base, flow: sample.flow, overlays: sample.overlays });
            assert.equal(sample.base.opacity, 1);
            assert.ok(sample.overlays.every(overlay => overlay.d === sample.base.d));
            if (isDashed(graph.edges.find(edge => edge.id === id), graph.meta.diagramType)) assert.ok(sample.overlays.every(overlay => overlay.dash.length > 0));
          } else {
            const sample = await edgeContrast(page, id, true);
            phaseSamples.push({ id, time, ...sample });
            assert.ok(sample.ratio >= 0.6, `${id} at ${time}ms: ${JSON.stringify(sample)}`);
          }
        }
        assert.deepEqual(await geometry(page), stable);
        if (sequence && overviewChecked.length) pixelSamples.push({ time, samples: await sequenceFlowPixels(page, overviewChecked, `${graph.meta.diagramType}-${colorTheme}-selection-${time}`) });
      }
      await page.locator('.selection-feedback').evaluateAll(elements => {
        for (const animation of new Set(elements.flatMap(e => e.getAnimations({ subtree: true })))) animation.finish();
      });
      if (sequence) for (const { id } of checked) {
        const sample = await sequenceEdgeSample(page, id);
        for (const [index, overlay] of sample.overlays.entries()) {
          if (index % 2 === 0) assert.ok(overlay.width <= 9.01 && overlay.elementOpacity <= .16, `${id}: sequence halo lands on the limited static value`);
          else assert.ok(overlay.width <= 2.01, `${id}: sequence shine lands on the limited static value`);
        }
      }
      if (sequence) {
        for (const item of checked.filter(item => !overviewChecked.includes(item))) {
          await centerMotionEdge(page, item.id);
          pixelSamples.push({ local: item.id, samples: await sequenceFlowPixels(page, [item], `${graph.meta.diagramType}-${colorTheme}-${item.id}-local-contrast`) });
        }
        await fit(page);
      }
      for (const phase of [0, 600]) {
        await page.locator(sequence ? '.flow-edge--sequence' : '.edge-flow').evaluateAll((elements, phase) => {
          for (const element of elements) for (const animation of element.getAnimations({ subtree: true }).filter(a => ['edge-flow', 'sequence-edge-flow'].includes(a.animationName))) {
            animation.pause(); animation.currentTime = phase;
          }
        }, phase);
        await page.screenshot({ path: path.join(outputRoot, 'screens', `${graph.meta.diagramType}-${colorTheme}-flow-${phase}.png`), animations: 'allow' });
      }
      const media = [];
      if (sequence) {
        const session = await context.newCDPSession(page);
        for (const feature of ['prefers-contrast', 'prefers-reduced-transparency']) {
          await session.send('Emulation.setEmulatedMedia', { features: [{ name: feature, value: feature === 'prefers-contrast' ? 'more' : 'reduce' }] });
          await page.evaluate(() => new Promise(requestAnimationFrame));
          const samples = await Promise.all(checked.map(item => sequenceEdgeSample(page, item.id)));
          assert.ok(samples.every(sample => sample.flow.width <= sample.base.width * 2.01 && sample.flow.filter === 'none' && sample.base.opacity === 1), `${feature}: sequence motion retains readable notation`);
          media.push(feature);
        }
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
      let negativeGuard = false;
      if (sequence && checked.length) {
        const hidden = await page.addStyleTag({ content: '.sequence-edge-flow { opacity: 0 !important; } .flow-edge--sequence.flow-edge--dashed { animation: none !important; }' });
        await assert.rejects(() => sequenceFlowPixels(page, overviewChecked), /no visible sequence motion/);
        await hidden.evaluate(element => element.remove());
        if (checked.some(edge => edge.dashed)) {
          const fixedDashes = await page.addStyleTag({ content: '.flow-edge--sequence.flow-edge--dashed { animation: none !important; }' });
          await assert.rejects(() => sequenceFlowPixels(page, overviewChecked), /dashed strokes must travel/);
          await fixedDashes.evaluate(element => element.remove());
        }
      }
      if (directedLinked.length) {
        const edgeId = directedLinked[0].id;
        await page.locator('.react-flow__edge').and(page.locator(`[data-id=${JSON.stringify(edgeId)}]`)).locator('.edge-flow').evaluate(element => element.remove());
        await assert.rejects(async () => {
          const flow = page.locator('.react-flow__edge').and(page.locator(`[data-id=${JSON.stringify(edgeId)}]`)).locator('.edge-flow');
          assert.equal(await flow.count(), 1, `${edgeId}: expected one rendered flow path`);
        }, /expected one rendered flow path/);
        negativeGuard = true;
      }
      return { theme: colorTheme, checked, phaseSamples, pixelSamples, media, expectedDirected: directedLinked.length, negativeGuard, invisibleFlowRejected: sequence && checked.length > 0, staticRelations: linked.length - checked.length };
    }, true);
  }
}

async function inspectorChecks(browser, url, graph) {
  for (const viewport of [viewports[0], viewports[2]]) {
    await runCase(browser, `${graph.meta.diagramType}-${viewport.width}-inspector-sync`, viewport, {}, async page => {
      await page.goto(url); await chooseGraph(page, graph, viewport.width <= 700);
      await ensureInspector(page);
      if (core(graph)) await assertInspector(page, core(graph));
      else assert.equal(await count(page, '.drawer-body h2'), 0);
      for (const node of graph.nodes) await searchSelect(page, graph, node);
      const selected = graph.nodes.at(-1);
      await page.locator('.inspector').focus();
      await page.waitForTimeout(420);
      const view = await page.locator('.react-flow__viewport').getAttribute('style');
      await page.waitForTimeout(1950); await assertInspector(page, selected);
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'node-inspector');
      assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'), view);
      await hidePanels(page); await ensureInspector(page); await assertInspector(page, selected);
      await openMore(page); await menuItem(page, '重置').click();
      assert.equal(await count(page, '.drawer-body h2'), 0);
      await nav(page, true); await ensureInspector(page);
      if (viewport.width <= 700) assert.equal(await count(page, '.nav'), 0);
      await button(page, '关闭详情').click();
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-controls') === 'node-inspector');
      return { nodes: graph.nodes.length, stableSelection: true, fullContents: true, reset: true, focusReturned: true };
    }, true);
  }
}

async function flowChecks(browser, url, graph) {
  await runCase(browser, `${graph.meta.diagramType}-ambient-flow`, viewports[0], {}, async page => {
    await page.goto(url); await chooseGraph(page, graph, false);
    const directed = graph.edges.filter(edge => hasArrow(edge, graph.meta.diagramType));
    const assertDashMotion = async running => {
      if (graph.meta.diagramType !== 'sequence') return;
      const offsets = () => page.locator('.flow-edge--sequence.flow-edge--dashed .react-flow__edge-path').evaluateAll(paths => paths.map(path => getComputedStyle(path).strokeDashoffset));
      const before = await offsets(); await page.waitForTimeout(230); const after = await offsets();
      for (let i = 0; i < before.length; i++) {
        if (running) assert.notEqual(after[i], before[i], 'The dashed stroke travels with flow enabled.');
        else assert.equal(after[i], before[i], 'The dashed stroke stays still with flow disabled or reduced motion.');
      }
    };
    assert.equal(await count(page, '.edge-flow'), directed.length);
    assert.equal(await count(page, '.capsule,.playback-controls,.playback-outline,.diagram-node.is-current,.diagram-node.is-complete'), 0);
    assert.equal(await page.getByRole('button', { name: /^(播放|暂停|← 上一步|下一步 →)$/ }).count(), 0);
    await searchSelect(page, graph, target(graph));
    if (directed.length) {
      const flow = page.locator('.edge-flow').first();
      const before = await flow.evaluate(element => getComputedStyle(element).strokeDashoffset);
      await page.waitForTimeout(350);
      assert.notEqual(await flow.evaluate(element => getComputedStyle(element).strokeDashoffset), before);
      await openLegend(page); await page.getByRole('switch', { name: '连线流动', exact: true }).click();
      await assertFlow(page, false); await dismiss(page);
      if (getDiagram(graph.meta.diagramType).sequence) assert.equal(await count(page, '.edge-flow'), 0, 'Stopping sequence flow removes the overlay instead of freezing it.');
      await assertDashMotion(false);
      await openMore(page); await menuItem(page, '重置').click(); await assertFlow(page);
      await assertDashMotion(true);
      if (graph.meta.diagramType === 'sequence') {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => !document.querySelector('.edge-flow')); await assertDashMotion(false);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.waitForFunction(() => document.querySelector('.edge-flow')); await assertDashMotion(true);
      }
    }
    return { playbackRemoved: true, directedEdges: directed.length, flowSwitch: true };
  }, true);
}

async function sequenceReadingChecks(browser, url, graph) {
  if (graph.meta.diagramType !== 'sequence') return;
  for (const viewport of viewports) for (const colorTheme of ['light', 'dark']) {
    const name = `${viewport.width}-${colorTheme}-sequence-reading`;
    await runCase(browser, name, viewport, { reducedMotion: 'reduce' }, async page => {
      // Exercise the download fallback here; native picker success/cancel has separate host evidence.
      await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
      await page.goto(url); await chooseGraph(page, graph, viewport.width <= 700); await theme(page, colorTheme);
      const zoom = () => page.locator('.react-flow__viewport').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a);
      const authored = (await geometry(page)).nodes.map(({id, position}) => ({id, position}));
      if (mobile(page)) assert.ok(await zoom() >= .75, 'Mobile opens in a readable local view.');
      const overview = async () => {
        await page.keyboard.press('Escape'); await hidePanels(page); await button(page, '适应画布').click();
        await page.waitForFunction(() => !document.querySelector('.node-card'));
      };
      const selectedEdge = async id => {
        await page.waitForFunction(id => document.querySelector('.node-card')?.dataset.edgeId === id || document.querySelector('.drawer-body')?.dataset.edgeId === id, id);
        assert.ok((await page.locator(`.react-flow__edge[data-id="${id}"]`).getAttribute('class')).includes('selected'));
        await settledViewport(page);
      };
      const clicks = []; let lastPulse = 0;
      const messagePulse = async previous => {
        if (previous !== undefined) await page.waitForFunction(old => Number(document.querySelector('.selection-feedback[data-selection-pulse]')?.dataset.selectionPulse) > old, previous);
        return Number(await page.locator('.selection-feedback[data-selection-pulse]').first().getAttribute('data-selection-pulse'));
      };
      for (const edge of graph.edges) {
        await overview();
        const label = page.locator(`.edge-label[data-edge-id="${edge.id}"]`), box = await label.boundingBox();
        const hit = await page.evaluate(({x,y}) => document.elementFromPoint(x,y)?.closest('.edge-label')?.dataset.edgeId, {x:box.x+box.width/2,y:box.y+box.height/2});
        assert.equal(hit, edge.id, 'No invisible participant column intercepts a label.');
        const before = lastPulse;
        await page.mouse.click(box.x+box.width/2, box.y+box.height/2); await selectedEdge(edge.id);
        assert.equal(lastPulse = await messagePulse(before), before + 1, 'A pointer activation creates exactly one pulse.');
        await overview();
        const point = await page.locator(`.react-flow__edge-path[id="${edge.id}"]`).evaluate(path => { const p = path.getPointAtLength(path.getTotalLength()*.45), t = new DOMPoint(p.x,p.y).matrixTransform(path.getScreenCTM()); return {x:t.x,y:t.y}; });
        await page.mouse.click(point.x, point.y); await selectedEdge(edge.id); lastPulse = await messagePulse();
        for (const key of ['Enter', 'Space']) {
          const old = lastPulse; await page.locator(`.react-flow__edge[data-id="${edge.id}"]`).focus(); await page.keyboard.press(key); await selectedEdge(edge.id); assert.equal(lastPulse = await messagePulse(old), old + 1);
        }
        await overview(); const old = lastPulse; await label.focus(); await page.keyboard.press('Enter'); await selectedEdge(edge.id); assert.equal(lastPulse = await messagePulse(old), old+1, 'Label keyboard activation is not handled twice.');
        clicks.push({id:edge.id,label:true,line:true,keyboard:true,hit});
      }
      await overview();
      const clearance = await page.locator('.edge-label').evaluateAll(labels => labels.map(label => {
        const path = document.getElementById(label.dataset.edgeId), p = path.getPointAtLength(0), screen = new DOMPoint(p.x,p.y).matrixTransform(path.getScreenCTM());
        return { id:label.dataset.edgeId, gap:screen.y-label.getBoundingClientRect().bottom, zoom:new DOMMatrix(getComputedStyle(document.querySelector('.react-flow__viewport')).transform).a };
      }));
      for (const item of clearance.filter(item => graph.edges.find(edge=>edge.id===item.id).source !== graph.edges.find(edge=>edge.id===item.id).target)) assert.ok(item.gap / item.zoom >= 5.9, `${item.id}: label keeps 6px baseline clearance.`);
      for (const node of graph.nodes.filter(node => node.subtitle)) assert.ok((await nodeElement(page,node.id).locator('.node-visual .body').textContent()).length > 0, `${node.id}: subtitle is drawn.`);
      const guards = await page.locator('.operand-guard').allTextContents();
      for (const group of graph.groups ?? []) if(group.kind==='alt') {
        if(group.operands) for(const operand of group.operands) assert.ok(guards.includes(`[${operand.guard}]`));
        else assert.ok(guards.includes('分支条件未标注'));
      }
      await page.screenshot({path:path.join(outputRoot,'screens',name+'-overview.png'),animations:'disabled'});
      if(viewport.width===1440) await exportsMatch(page,graph,name);
      const located=[];
      for(const node of graph.nodes) {
        await nav(page,true); await page.locator('.nav .search-results button').filter({hasText:node.label}).first().click();
        await selection(page,graph,node.id); await page.locator('.inspector').waitFor();
        assert.ok(await zoom()>=.75, 'Directory restores readable scale.');
        if(mobile(page)) { assert.equal(await count(page,'.nav'),0); await button(page,'隐藏右侧详情栏').click(); await page.locator('.inspector').waitFor({state:'detached'}); }
        const position=await nodeElement(page,node.id).locator('.sequence-head').evaluate(head=>{
          const r=head.getBoundingClientRect(),nav=document.querySelector('.nav')?.getBoundingClientRect(),drawer=document.querySelector('.inspector')?.getBoundingClientRect();
          const left=nav?nav.right+12:24,right=drawer?drawer.left-12:innerWidth-24;
          return {visible:r.left>=left-1&&r.right<=right+1&&r.top>=64,left:r.left,right:r.right};
        });
        assert.ok(position.visible, `${node.id}: visible head at readable scale ${JSON.stringify(position)}`);
        located.push({id:node.id,zoom:await zoom(),...position});
      }
      await page.screenshot({path:path.join(outputRoot,'screens',name+'-locate.png'),animations:'disabled'});
      for(const node of graph.nodes) {
        await hidePanels(page); await searchSelect(page,graph,node); assert.ok(await zoom()>=.75);
        for (const key of ['Enter','Space']) { await nodeElement(page,node.id).focus(); await page.keyboard.press(key); assert.ok(await zoom()>=.75); }
      }
      await hidePanels(page);
      const stableZoom=await zoom(); await nav(page,true); await ensureInspector(page); assert.equal(await zoom(),stableZoom,'Opening panels only pans.');
      await hidePanels(page); assert.equal(await zoom(),stableZoom,'Closing panels preserves scale.');
      const cards=[];
      if(!mobile(page)) for(const node of graph.nodes) {
        await overview(); const before=await zoom(); await pointerNode(page,node); await selection(page,graph,node.id);
        await page.waitForFunction(()=>document.querySelector('.inspector')||document.querySelector('.node-card')?.style.visibility!=='hidden');
        if(await count(page,'.inspector')) { assert.equal(await page.locator('.drawer-body').getAttribute('data-node-id'),node.id); assert.equal(await zoom(),before); cards.push({id:node.id,inspector:true}); }
        else {
          const overlaps=await page.locator('.node-card').evaluate(card=>{const b=card.getBoundingClientRect();return [...document.querySelectorAll('.edge-label,.operand-guard,.sequence-head')].filter(el=>{if(el.closest('.react-flow__node')?.dataset.id===card.dataset.nodeId)return false;const r=el.getBoundingClientRect();return b.left<r.right&&b.right>r.left&&b.top<r.bottom&&b.bottom>r.top;}).length;});
          assert.equal(overlaps,0,'Quick look does not cover message/guard/head text.'); cards.push({id:node.id,overlaps});
        }
      }
      await overview(); await setLocked(page,false);
      for(const locked of [true,false]) {
      await setLocked(page,locked);
      const positions=(await geometry(page)).nodes.map(({id,position})=>({id,position}));
      const blank=await page.evaluate(()=>{const node=document.querySelector('.react-flow__node-diagram'),box=node.getBoundingClientRect();return [.8,.85,.9,.95].map(y=>({x:box.x+box.width/2,y:box.y+box.height*y})).find(p=>document.elementFromPoint(p.x,p.y)?.classList.contains('react-flow__pane'));});
      assert.ok(blank,'A blank lifeline column reaches the canvas.');
      await page.mouse.move(blank.x,blank.y);await page.mouse.down();await page.mouse.move(blank.x+24,blank.y+15,{steps:5});await page.mouse.up();
      assert.deepEqual((await geometry(page)).nodes.map(({id,position})=>({id,position})),positions,'Dragging a blank column never moves a participant.');
      }
      await overview(); await nodeElement(page,graph.nodes[0].id).focus(); await page.keyboard.press('Enter'); await setLocked(page,false);
      await button(page,'编辑文字').click(); await page.getByRole('textbox',{name:'说明',exact:true}).fill('修复验收说明'); await button(page,'保存').click();
      assert.equal(await nodeElement(page,graph.nodes[0].id).locator('.body').textContent(),'修复验收说明');
      await overview(); await page.locator(`.edge-label[data-edge-id="${graph.edges[0].id}"]`).click();
      await button(page,'编辑文字').click(); const labelInput=page.getByRole('textbox',{name:'名称',exact:true});
      const excessive='Long message '.repeat(150).trim(); await labelInput.fill(excessive); await button(page,'保存').click();
      await page.locator('.layout-problems').waitFor();
      assert.equal(await labelInput.count(),0,'Saving a draft closes the editor even when its layout needs repair.');
      await openMore(page);
      const [draftDownload]=await Promise.all([page.waitForEvent('download'),menuItem(page,'保存 Graph JSON').click()]);
      const draftFile=path.join(outputRoot,'exports',`sequence-reading-${page.viewportSize().width}-draft.json`);
      await draftDownload.saveAs(draftFile);
      const draftModel=JSON.parse(fs.readFileSync(draftFile,'utf8'));
      assert.equal((draftModel.diagrams??[draftModel]).find(item=>item.meta.diagramType==='sequence').edges.find(edge=>edge.id===graph.edges[0].id).label,excessive);
      await openMore(page);await menuItem(page,'导出 SVG').click();
      await page.waitForFunction(()=>document.querySelector('.toast')?.textContent.includes('Diagram quality failed'));
      await openMore(page);await menuItem(page,'重置').click();await hidePanels(page);
      assert.deepEqual((await geometry(page)).nodes.map(({id,position})=>({id,position})),authored);
      if(mobile(page))assert.ok(await zoom()>=.75,'Mobile reset restores local reading.');
      await nodeElement(page,graph.nodes[0].id).focus(); await page.keyboard.press('Enter'); if(mobile(page)) await hidePanels(page);
      const preferenceSelection = await page.locator('.diagram-node.is-selected').evaluate(el=>el.closest('[data-id]').dataset.id), preferencePanels = await panelState(page);
      await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.querySelectorAll('.sequence-edge-flow').length>0);
      await openLegend(page);const toggle=page.getByRole('switch',{name:'连线流动',exact:true});
      const state=await page.locator('.react-flow__viewport').getAttribute('style');
      await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelectorAll('.sequence-edge-flow').length===0);
      assert.equal(await toggle.isDisabled(),true);assert.equal(await toggle.getAttribute('aria-checked'),'false');assert.ok(await page.getByText('已遵循系统减少动态效果设置',{exact:true}).count());
      await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.querySelectorAll('.sequence-edge-flow').length>0);assert.equal(await toggle.isEnabled(),true);
      await toggle.click();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.legend-pop .switch').disabled);
      await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>!document.querySelector('.legend-pop .switch').disabled);assert.equal(await toggle.getAttribute('aria-checked'),'false');assert.equal(await count(page,'.sequence-edge-flow'),0);
      assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'),state,'Preference changes preserve camera.');
      assert.equal(await page.locator('.diagram-node.is-selected').evaluate(el=>el.closest('[data-id]').dataset.id),preferenceSelection); assert.deepEqual(await panelState(page),preferencePanels);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      return {clicks,clearance,located,cards,guards,subtitles:true,invalidDraftPreserved:true,liveMotion:true};
    },true);
  }
}

async function sequenceEditorHandoffCheck(browser,url,graph){
  if(graph.meta.diagramType!=='sequence')return;
  await runCase(browser,'sequence-editor-handoff',viewports[1],{reducedMotion:'reduce'},async page=>{
    const fixture={meta:{title:'Sequence editor handoff',diagramType:'sequence',locale:'zh-CN',sourceRef:'Browser regression fixture; no business evidence'},groups:[],nodes:[100,800,1200].map((x,i)=>({id:`n${i}`,label:`Participant ${i}`,subtitle:'Short description',kind:'participant',position:{x,y:50},size:{width:220,height:900}})),edges:[{id:'m1',source:'n1',target:'n2',kind:'sync',order:1,label:'Message',evidence:'test'}]};
    assert.deepEqual(validateGraph(fixture),[]);await openFixture(page,fixture,viewports[1],url);await hidePanels(page);await fit(page);await setLocked(page,false);await pointerNode(page,fixture.nodes[0]);
    await page.locator('.node-card:visible').waitFor();await button(page,'编辑文字').click();
    await page.getByRole('textbox',{name:'名称',exact:true}).fill('   ');await button(page,'保存').click();assert.equal(await page.getByRole('alert').innerText(),'名称不能为空');
    await page.getByRole('textbox',{name:'名称',exact:true}).fill('Draft preserved');await page.getByRole('textbox',{name:'说明',exact:true}).fill('Unsaved subtitle');
    await page.setViewportSize(viewports[2]);await page.locator('.inspector').waitFor();await page.locator('.node-card').waitFor({state:'detached'});
    assert.equal(await page.getByRole('textbox',{name:'名称',exact:true}).inputValue(),'Draft preserved');assert.equal(await page.getByRole('textbox',{name:'说明',exact:true}).inputValue(),'Unsaved subtitle');
    assert.equal(await page.locator('.drawer-body').getAttribute('data-node-id'),'n0');
    await button(page,'保存').click();assert.equal(await nodeElement(page,'n0').locator('.body').textContent(),'Unsaved subtitle');
    await button(page,'编辑文字').click();await page.getByRole('textbox',{name:'名称',exact:true}).fill('Discard me');await page.keyboard.press('Escape');assert.equal(await page.locator('.drawer-body h2').innerText(),'Draft preserved');
    await button(page,'隐藏右侧详情栏').click();await page.locator('.inspector').waitFor({state:'detached'});await page.waitForTimeout(150);assert.equal(await count(page,'.inspector,.node-card'),0,'Closing a fallback never reopens it.');
    return {draftSurvivesResize:true,invalidName:true,sameObject:true,cancel:true,closedStaysClosed:true};
  },true);
}

async function sequencePersistenceChecks(browser, url, graph) {
  if(graph.meta.diagramType!=='sequence')return;
  await runCase(browser,'sequence-persistence',viewports[0],{reducedMotion:'reduce'},async(page)=>{
    await page.goto(url);await chooseGraph(page,graph,false);await hidePanels(page);await fit(page);await setLocked(page,false);
    const selected=graph.nodes[0];await pointerNode(page,selected,true);await ensureInspector(page);
    const position=(await geometry(page)).nodes.find(node=>node.id===selected.id).position;
    assert.notEqual(position.x,selected.position.x);assert.equal(position.y,selected.position.y);
    await button(page,'编辑文字').click();await page.getByRole('textbox',{name:'名称',exact:true}).fill(selected.label+' QA');await page.getByRole('textbox',{name:'说明',exact:true}).fill('JSON 往返说明');await button(page,'保存').click();
    assert.equal(await page.locator('.drawer-body h2').innerText(),selected.label+' QA');
    const editedEdge = graph.edges.find(edge => sequencePairs(graph).has(edge.id));
    if (editedEdge) {
      await hidePanels(page);
      await page.locator('.react-flow__edge').and(page.locator(`[data-id=${JSON.stringify(editedEdge.id)}]`)).focus(); await page.keyboard.press('Enter');
      await button(page, '编辑文字').click(); await page.getByRole('textbox', { name: '名称', exact: true }).fill('配对标签 QA'); await button(page, '保存').click();
      assert.ok((await page.locator(`.edge-label[data-edge-id=${JSON.stringify(editedEdge.id)}]`).innerText()).includes('配对标签 QA'));
      assert.equal(await page.locator(`[data-edge-id=${JSON.stringify(editedEdge.id)}] .pair-label`).innerText(), sequencePairs(graph).get(editedEdge.id).label);
      await ensureInspector(page); await nodeElement(page, selected.id).focus(); await page.keyboard.press('Enter');
      await page.locator('.drawer-body').and(page.locator(`[data-node-id=${JSON.stringify(selected.id)}]`)).waitFor();
    }
    await page.evaluate(()=>{window.__nativePicker=window.showSaveFilePicker;window.showSaveFilePicker=()=>Promise.reject(new DOMException('Canceled by test','AbortError'));});
    await openMore(page);await menuItem(page,'保存 Graph JSON').click();await page.waitForFunction(()=>document.querySelector('.toast').textContent.includes('已取消保存'));
    assert.equal(await page.locator('.drawer-body h2').innerText(),selected.label+' QA','Canceled save keeps session changes.');
    await page.evaluate(()=>{window.showSaveFilePicker=undefined;});
    const other=graphs.find(g=>g.meta.diagramType!=='sequence');
    const switchTo=async(g)=>{await dismiss(page);await page.locator('#view-menu-button').click();await page.getByRole('menuitemradio').filter({hasText:labels[g.meta.diagramType]}).click();await page.waitForFunction(label=>document.querySelector('#view-menu-button span')?.textContent===label,labels[g.meta.diagramType]);};
    if(other){await switchTo(other);await openMore(page);await menuItem(page,'重置').click();await switchTo(graph);}
    assert.ok((await nodeElement(page,selected.id).locator('.node-visual title').textContent()).includes('JSON 往返说明'));
    const download=async(suffix)=>{await openMore(page);const pending=page.waitForEvent('download');pending.catch(()=>{});await menuItem(page,'保存 Graph JSON').click();const result=await pending,file=path.join(outputRoot,'exports',`sequence-${suffix}.json`);await result.saveAs(file);assert.equal(await result.failure(),null);return file;};
    const savedFile=await download('saved'),saved=JSON.parse(fs.readFileSync(savedFile,'utf8')),savedGraph=(saved.diagrams??[saved]).find(g=>g.meta.diagramType==='sequence');
    assert.deepEqual(savedGraph.groups,graph.groups);assert.deepEqual(savedGraph.edges,graph.edges.map(edge=>edge.id===editedEdge?.id?{...edge,label:'配对标签 QA'}:edge));assert.deepEqual(savedGraph.executions,graph.executions);
    assert.equal(savedGraph.nodes[0].label,selected.label+' QA');assert.equal(savedGraph.nodes[0].subtitle,'JSON 往返说明');assert.ok(Math.abs(savedGraph.nodes[0].position.x-position.x)<.001);
    for(let i=1;i<graph.nodes.length;i++)assert.deepEqual(savedGraph.nodes[i],graph.nodes[i]);
    if(other)assert.deepEqual(saved.diagrams.find(g=>g.meta.diagramType===other.meta.diagramType),other,'Reset in another view is isolated.');
    const regenerated=path.join(outputRoot,'sequence-regenerated');
    const args=[path.join(import.meta.dirname,'generate-viewer.mjs'),savedFile,regenerated,'--force'];
    if(process.env.QA_REPO_ROOT)args.push('--repo-root',process.env.QA_REPO_ROOT);
    const generated=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(generated.status,0,generated.stderr);
    await openMore(page);await menuItem(page,'重置').click();const reset=JSON.parse(fs.readFileSync(await download('reset'),'utf8'));assert.deepEqual(reset,input,'Reset restores the input without dropping optional operands.');
    const generatedModel = JSON.parse(fs.readFileSync(path.join(regenerated, 'graph.json'), 'utf8'));
    const generatedGraph = (generatedModel.diagrams ?? [generatedModel]).find(item => item.meta.diagramType === 'sequence');
    const layoutReport = JSON.parse(generated.stdout).layout;
    assert.ok(layoutReport.every(item => item.semantics.preserved), 'Auto regeneration preserves semantics while recomputing geometry.');
    await page.goto(pathToFileURL(path.join(regenerated,'index.html')).href);await page.locator('.diagram-node').first().waitFor();await chooseGraph(page,generatedGraph,false);
    assert.equal(await nodeElement(page,selected.id).locator('.body').textContent(),'JSON 往返说明');
    for (const colorTheme of ['light', 'dark']) {
      await theme(page, colorTheme); await hidePanels(page); await fit(page);
      if (editedEdge) await page.locator(`.edge-label[data-edge-id=${JSON.stringify(editedEdge.id)}]`).hover();
      await assertNodeDrawing(page, generatedGraph, colorTheme);
      await exportsMatch(page,generatedGraph,'sequence-roundtrip-'+colorTheme);
    }
    return {savedFile,regenerated,operandsPreserved:true,savedPositionsPreserved:true,regeneratedSemanticsPreserved:true,resetIsolated:true,cancel:'browser picker AbortError injected; edits retained',sourceEvidence:JSON.parse(generated.stdout).sourceEvidence};
  },true);
}

async function sequenceFullscreenChecks(browser,url,graph){
  if(graph.meta.diagramType!=='sequence')return;
  for(const viewport of [viewports[0],viewports[2]])await runCase(browser,`${viewport.width}-sequence-fullscreen`,viewport,{reducedMotion:'reduce'},async page=>{
    await page.goto(url);await chooseGraph(page,graph,mobile(page));await hidePanels(page);
    await button(page,'进入全屏').click();await fullscreenState(page,true);
    if(mobile(page))assert.ok(await page.locator('.react-flow__viewport').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a)>=.75);
    await button(page,'适应画布').click();
    await page.evaluate(()=>{window.__nativeExit=document.exitFullscreen;document.exitFullscreen=()=>Promise.reject(new Error('Exit denied'));});
    const chosen=graph.nodes.find(n=>n.id==='pigeon')??target(graph);await pointerNode(page,chosen);await selection(page,graph,chosen.id);
    if(await page.locator('.node-card:visible').count())await page.locator('.node-card').getByRole('button',{name:'查看详情',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.toast').textContent.includes('无法退出全屏'));assert.equal(await count(page,'.inspector'),0);
    assert.equal(await nodeElement(page,chosen.id).locator('.diagram-node').evaluate(el=>el.classList.contains('is-selected')),true);
    await page.evaluate(()=>{document.exitFullscreen=window.__nativeExit;});await button(page,'退出全屏').click();await fullscreenState(page,false,false);
    if(await page.locator('.node-card:visible').count())await page.locator('.node-card').getByRole('button',{name:'查看详情',exact:true}).click();
    await page.locator('.inspector').waitFor();assert.equal(await page.locator('.drawer-body').getAttribute('data-node-id'),chosen.id);
    await page.waitForFunction(()=>document.activeElement?.closest('.inspector'));
    await setLocked(page,false);await button(page,'编辑文字').click();await page.getByRole('textbox',{name:'说明',exact:true}).fill('全屏回退草稿');await page.keyboard.press('Escape');assert.equal(await button(page,'编辑文字').count(),1);
    return {nativeFullscreen:true,failedExitPreservesSelection:true,retryOpensSameInspector:true,editing:true};
  },true);
}

async function fileUrlSequenceCheck(browser, graph) {
  if (graph.meta.diagramType !== 'sequence') return;
  const selected = target(graph), edge = graph.edges[0];
  await runCase(browser, 'sequence-file-url', viewports[0], {}, async page => {
    const external = [], failed = [];
    page.on('request', request => { if (!/^(file|data|blob):/.test(request.url())) external.push(request.url()); });
    page.on('requestfailed', request => failed.push({ url: request.url(), error: request.failure()?.errorText }));
    await page.goto(pathToFileURL(path.join(inputRoot, 'index.html')).href); await page.locator('.diagram-node').first().waitFor(); await chooseGraph(page, graph, false);
    await nav(page, true); await page.locator('.nav .search-results button').filter({ hasText: selected.label }).click(); await selection(page, graph, selected.id); await page.locator('.inspector').waitFor();
    await clear(page, 'close'); await hidePanels(page); await fit(page); await nodeElement(page, selected.id).locator('.participant-title').click();
    await page.waitForFunction(() => document.querySelector('.inspector') || document.querySelector('.node-card')?.style.visibility !== 'hidden');
    if (await page.locator('.node-card:visible').count()) await page.locator('.node-card').getByRole('button', { name: '查看详情', exact: true }).click(); await page.locator('.inspector').waitFor();
    await clear(page, 'close');
    if (edge) {
      await page.locator('.react-flow__edge').and(page.locator(`[data-id=${JSON.stringify(edge.id)}]`)).locator('.react-flow__edge-interaction').dispatchEvent('click');
      await page.waitForFunction(() => document.querySelector('.inspector') || document.querySelector('.relation-card')?.style.visibility !== 'hidden');
      if (await page.locator('.relation-card:visible').count()) await page.locator('.relation-card').getByRole('button', { name: '查看详情', exact: true }).click(); await page.locator('.inspector').waitFor();
      await clear(page, 'close');
    }
    await openLegend(page); const flow = page.getByRole('switch', { name: '连线流动', exact: true });
    if (await flow.count()) {
      await flow.click(); assert.equal(await count(page, '.edge-flow'), 0, 'The file page removes sequence overlays when flow is off.'); await flow.click();
    }
    await dismiss(page); await assertFlow(page);
    assert.deepEqual(external, [], 'The copied file page makes no external requests.'); assert.deepEqual(failed, [], 'The copied file page has no failed requests.');
    await page.screenshot({ path: path.join(outputRoot, 'screens', 'sequence-file-url.png'), animations: 'disabled' });
    return { protocol: 'file:', directory: true, nodeQuickLook: selected.id, relationshipQuickLook: edge?.id ?? null, flowSwitch: Boolean(edge), externalRequests: 0, failedRequests: 0, scope: graph.meta.scope ?? graph.meta.sourceRef, originalUserHtmlVerified: false };
  }, true);
}
async function openFixture(page, fixture, viewport, url) {
  const model = input.diagrams ? { ...input, diagrams: graphs.map(g => g.meta.diagramType === fixture.meta.diagramType ? fixture : g) } : fixture;
  const html = fs.readFileSync(path.join(inputRoot, 'index.html'), 'utf8').replace(/(<script\b[^>]*\bid="graph-data"[^>]*>)[\s\S]*?(<\/script>)/,
    (_, start, end) => start + JSON.stringify(model).replaceAll('<', '\\u003c') + end);
  await page.route(url, route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(url); await chooseGraph(page, fixture, viewport.width <= 700);
}

async function assertTextBounds(page) {
  const result = await page.locator('.node-visual text').evaluateAll(texts => ({
    hidden: texts.filter(text => text.textContent.trim() && getComputedStyle(text).opacity === '0').map(text => text.textContent),
    failures: texts.flatMap(text => {
    const node = text.closest('.diagram-node'), box = text.getBoundingClientRect(), bounds = node.getBoundingClientRect();
    const id = node.closest('[data-id]').dataset.id;
    if (box.left < bounds.left - .5 || box.right > bounds.right + .5 || box.top < bounds.top - .5 || box.bottom > bounds.bottom + .5) return [{ id, text: text.textContent, reason: 'outside node' }];
    const shape = node.matches('.kind-actor,.kind-initial,.kind-final') ? null : node.querySelector('.node-visual .node-surface');
    if (!shape?.isPointInFill) return [];
    const inverse = shape.getScreenCTM().inverse();
    const corners = [[box.left, box.top], [box.right, box.top], [box.left, box.bottom], [box.right, box.bottom]];
    return corners.every(([x, y]) => shape.isPointInFill(new DOMPoint(x, y).matrixTransform(inverse))) ? [] : [{ id, text: text.textContent, reason: 'outside shape' }];
    })
  }));
  assert.deepEqual(result.hidden, [], 'Zoom scales the complete node without hiding authored text.');
  assert.deepEqual(result.failures, [], 'Visible text stays inside its node and actual shape.');
  assert.ok(await page.locator('.boundary > span').evaluateAll(labels => labels.every(label => {
    const box = label.getBoundingClientRect(), boundary = label.parentElement.getBoundingClientRect();
    return box.left >= boundary.left && box.right <= boundary.right && box.bottom <= boundary.bottom
      && getComputedStyle(label).textOverflow === 'ellipsis' && getComputedStyle(label).overflow === 'hidden';
  })), 'Long boundary titles stay inside their group.');
}

async function textBoundsChecks(browser, url, graph) {
  await runCase(browser, `${graph.meta.diagramType}-text-bounds`, viewports[0], {}, async page => {
    const stress = structuredClone(graph);
    stress.edges = []; stress.groups = [];
    delete stress.executions; delete stress.layout;
    for (const kind of getDiagram(graph.meta.diagramType).nodeKinds) {
      if (!stress.nodes.some(node => node.kind === kind)) stress.nodes.push({ ...structuredClone(stress.nodes[0]), id: `text-${kind}`, kind });
    }
    stress.nodes.forEach((node, index) => {
      delete node.groupId; delete node.layout;
      node.label = `${index} 节点 ${'WMWM_LongIdentifier_'.repeat(3)}`;
      node.subtitle = '完整职责 LongMixedIdentifier_'.repeat(3);
      node.fields?.forEach(field => { field.name = 'long_field_'.repeat(12); field.type = 'generic_type_'.repeat(12); });
      for (const field of ['attributes', 'methods']) if (node[field]) node[field] = node[field].map(() => 'long_member_identifier_'.repeat(12));
      node.position = { x: 80 + index % 3 * 480, y: 100 + Math.floor(index / 3) * 420 };
      node.size = { width: 360, height: 260 };
      if (['start', 'end'].includes(node.kind)) node.size = { width: 220, height: 64 };
      if (getDiagram(graph.meta.diagramType).cardLayout && index === 0) node.size.height = 80;
    });
    if (graph.meta.diagramType === 'usecase') {
      stress.groups = [{ id: 'text-system', kind: 'system', label: 'Text bounds system' }];
      stress.nodes.filter(node => node.kind === 'usecase').forEach(node => { node.groupId = 'text-system'; });
    }
    const compiledStress = (await compileGraphLayout(stress)).graph;
    const uppercase = structuredClone(graph);
    uppercase.edges.forEach(edge => { edge.label = 'FOUND_VALUE FOUND_NULL KEY_NOT_EXIST（不回填）'; });
    uppercase.groups?.forEach(group => { group.label = '完整边界 LongMixedIdentifier_'.repeat(20); });
    const compiledUppercase = (await compileGraphLayout(uppercase)).graph;
    for (const fixture of [graph, compiledStress, compiledUppercase]) {
      await openFixture(page, fixture, viewports[0], url);
      await searchSelect(page, fixture, target(fixture)); await hidePanels(page); await clear(page);
      for (const clicks of [0, 4, 2]) {
        for (let i = 0; i < clicks; i++) await page.locator('.react-flow__controls-zoomout').click();
        await page.waitForTimeout(300); await assertTextBounds(page);
      }
      const clippedHeadings = await page.locator('.boundary > span').evaluateAll(elements => elements.filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.textContent));
      assert.deepEqual(clippedHeadings, [], 'Complete group headings fit without ellipsis.');
      await page.screenshot({ path: path.join(outputRoot, 'screens', `${graph.meta.diagramType}-${fixture === graph ? 'authored' : fixture === compiledStress ? 'long' : 'uppercase-edge'}-text.png`), animations: 'disabled' });
      if (['architecture', 'flowchart'].includes(graph.meta.diagramType) && fixture === compiledStress || graph.meta.diagramType === 'sequence' && fixture === compiledUppercase) {
        await exportsMatch(page, fixture, `${graph.meta.diagramType}-long-input`);
      }
      await page.unroute(url);
    }
    return { authoredAndLongText: true, uppercaseEdges: true, zoomLevels: 3, shapeContainment: true };
  }, true);
}

async function informationLayoutChecks(browser, url, graph) {
  const longLegend = structuredClone(graph);
  const stressLegend = graph.meta.diagramType === 'state' && graph.nodes.length >= 5 && graph.edges.length >= 2;
  if (stressLegend) {
    ['initial', 'final', 'choice', 'state', 'state'].forEach((kind, i) => { longLegend.nodes[i].kind = kind; longLegend.nodes[i].tags = i === 3 ? ['core'] : []; });
    longLegend.edges[0].evidence = 'inference'; longLegend.edges[1].evidence = 'source';
  }
  for (const viewport of [viewports[0], viewports[2]]) {
    await runCase(browser, `${viewport.width}-long-preview`, viewport, {}, async page => {
      const fixture = structuredClone(graph), node = fixture.nodes[0];
      node.subtitle = 'LongPreviewToken'.repeat(120);
      node.tags = ['LongTagToken'.repeat(30)];
      await openFixture(page, fixture, viewport, url); await hidePanels(page); await fit(page);
      await pointerNode(page, node);
      const card = page.locator('.node-card'); await card.waitFor();
      assert.equal(await card.locator('.card-subtitle').textContent(), node.subtitle);
      assert.equal(await card.locator('.card-tags').textContent(), node.tags[0]);
      assert.ok(await card.evaluate(card => {
        const box = card.getBoundingClientRect(), canvas = card.closest('.canvas').getBoundingClientRect();
        return box.top >= canvas.top && box.bottom <= canvas.bottom && card.scrollHeight > card.clientHeight && card.scrollWidth <= card.clientWidth + 1;
      }), 'Long preview content scrolls inside the canvas without horizontal overflow.');
      await card.locator('.card-action').focus();
      assert.ok(await card.locator('.card-action').evaluate(button => {
        const box = button.getBoundingClientRect(), card = button.closest('.node-card').getBoundingClientRect();
        return box.top >= card.top && box.bottom <= card.bottom;
      }), 'Keyboard focus scrolls the detail action into view.');
      await page.screenshot({ path: path.join(outputRoot, 'screens', `${viewport.width}-long-preview.png`), animations: 'disabled' });
      await page.keyboard.press('Enter'); await assertInspector(page, node);
      await clear(page, 'close'); await fit(page); await pointerNode(page, node);
      await card.locator('.card-close').focus(); await page.keyboard.press('Enter');
      await card.waitFor({ state: 'detached' });
      return { bounded: true, fullContent: true, keyboardDetailsAndClose: true };
    }, true);
    await runCase(browser, `${viewport.width}-information-layout`, viewport, {}, async page => {
      await openFixture(page, longLegend, viewport, url); await hidePanels(page);
      const anchor = await assertLegendLayout(page);
      await ensureInspector(page);
      if (viewport.width > 700) assert.deepEqual(await assertLegendLayout(page), anchor, 'The inspector does not move the legend button.');
      else assert.deepEqual(await page.locator('.legend-anchor .float-btn').evaluate(button => { const box = button.getBoundingClientRect(), canvas = button.closest('.canvas').getBoundingClientRect(); return { x: Math.round(box.left-canvas.left), y: Math.round(box.top-canvas.top) }; }), anchor.button, 'The full-width mobile Inspector covers, but does not reposition, the legend.');
      await hidePanels(page); assert.deepEqual(await assertLegendLayout(page), anchor);
      if (viewport.width > 700) {
        // The legend button slides over 300ms when the navigation panel opens or closes; let it settle before measuring.
        await nav(page, true); await page.waitForTimeout(360); const shifted = await assertLegendLayout(page);
        assert.ok(shifted.button.x > anchor.button.x, 'The legend button yields to the right of the open navigation panel.');
        await hidePanels(page); await page.waitForTimeout(360); assert.deepEqual(await assertLegendLayout(page), anchor);
      }
      await fit(page); const view = page.locator('.react-flow__viewport'), before = await view.getAttribute('style');
      await page.locator('.react-flow__controls-zoomin').click(); await page.waitForTimeout(250);
      assert.notEqual(await view.getAttribute('style'), before);
      assert.deepEqual(await assertLegendLayout(page), anchor);
      const blank = await blankPoint(page), beforePan = await view.getAttribute('style');
      await page.mouse.move(blank.x, blank.y); await page.mouse.down();
      await page.mouse.move(blank.x + 40, blank.y + 30, { steps: 8 }); await page.mouse.up();
      assert.notEqual(await view.getAttribute('style'), beforePan);
      assert.deepEqual(await assertLegendLayout(page), anchor);
      await searchSelect(page, longLegend, target(longLegend)); await hidePanels(page);
      const selected = await count(page, '.diagram-node.is-selected');
      await openLegend(page);
      const legend = page.getByRole('group', { name: '阅读图例', exact: true });
      await legend.click({ position: { x: 8, y: 8 } });
      assert.equal(await count(page, '.legend-pop'), 1, 'Clicking inside the legend keeps its popover open.');
      assert.equal(await count(page, '.diagram-node.is-selected'), selected);
      const rows = await legend.locator('span').evaluateAll(elements => new Set(elements.map(element => Math.round(element.getBoundingClientRect().top))).size);
      if (stressLegend && viewport.width <= 700) assert.ok(rows > 1, 'A semantic-rich mobile legend wraps into multiple visible rows.');
      const legendEntries = await count(page, '.legend span');
      await page.screenshot({ path: path.join(outputRoot, 'screens', `${viewport.width}-information-layout.png`), animations: 'disabled' });
      await dismiss(page);
      await assertLegendLayout(page);
      return { legendAnchor: anchor, legendEntries, rows, pointerPreservesSelection: true, allEntriesVisible: true };
    }, true);
    await runCase(browser, `${viewport.width}-facts-layout`, viewport, {}, async page => {
      const fixture = structuredClone(graph);
      fixture.nodes[0].facts = Array.from({ length: 24 }, (_, i) => `${i + 1}. 完整事实说明 ${'LongEvidenceToken'.repeat(12)}`);
      fixture.nodes[1].facts = ['无来源的节点说明']; delete fixture.nodes[1].source;
      delete fixture.nodes[2].facts; fixture.nodes[3].facts = [];
      await openFixture(page, fixture, viewport, url);
      for (const node of fixture.nodes.slice(0, 4)) {
        await searchSelect(page, fixture, node);
        if (node === fixture.nodes[0]) {
          const last = page.locator('.inspector-facts li').last(); await last.scrollIntoViewIfNeeded();
          assert.ok(await page.locator('.inspector').evaluate(element => element.scrollTop > 0 && element.scrollWidth <= element.clientWidth + 1));
          assert.ok(await last.evaluate(element => element.getBoundingClientRect().bottom <= element.closest('.inspector').getBoundingClientRect().bottom + 1));
          await page.screenshot({ path: path.join(outputRoot, 'screens', `${viewport.width}-long-facts.png`), animations: 'disabled' });
        }
      }
      await clear(page, 'close');
      await ensureInspector(page);
      await page.locator('.drawer-empty').waitFor();
      assert.equal(await count(page, '.drawer-body h2,.inspector-facts'), 0, 'Cleared details have no stale facts card.');
      return { sourceAndNoSource: true, missingAndEmptyFacts: true, longFacts: true, clearedDetails: true };
    }, true);
  }
}

async function fullscreenState(page, active, expectButtonFocus = true) {
  await page.waitForFunction(active => (document.fullscreenElement === document.querySelector('.diagram-board')) === active, active);
  const control = button(page, active ? '退出全屏' : '进入全屏');
  await control.waitFor();
  await page.waitForFunction(() => document.querySelector('.react-flow__controls-fullscreen')?.getAttribute('aria-busy') !== 'true');
  assert.equal(await control.getAttribute('aria-pressed'), String(active));
  if (active) await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (!active && expectButtonFocus) assert.ok(await control.evaluate(element => element === document.activeElement), 'Exiting fullscreen returns focus to its button.');
}
async function fullscreenChecks(browser, url, graph) {
  if (graph.meta.diagramType === 'sequence') return; // Sequence may exit fullscreen to show a safe Inspector; checked separately.
  for (const viewport of [viewports[0], viewports[2]]) {
    await runCase(browser, `${viewport.width}-quick-details`, viewport, {}, async page => {
      await page.goto(url); await chooseGraph(page, graph, viewport.width <= 700); await hidePanels(page);
      const node = target(graph);
      for (const rejectExit of [false, true]) {
        await button(page, '进入全屏').click(); await fullscreenState(page, true);
        await pointerNode(page, node);
        if (rejectExit) await page.evaluate(() => {
          window.nativeExitFullscreen = document.exitFullscreen;
          document.exitFullscreen = () => Promise.reject(new Error('Exit denied'));
        });
        await button(page, '查看详情').click();
        if (rejectExit) {
          await page.waitForFunction(() => /无法退出全屏/.test(document.querySelector('.toast').textContent));
          assert.ok(await page.evaluate(() => Boolean(document.fullscreenElement)));
          assert.equal(await count(page, '.inspector'), 0);
          assert.equal(await count(page, '.node-card'), 1, 'Rejected exit keeps the quick look accessible.');
          await page.evaluate(() => { document.exitFullscreen = window.nativeExitFullscreen; });
          await button(page, '查看详情').click();
        }
        await page.waitForFunction(() => !document.fullscreenElement && document.activeElement?.id === 'node-inspector');
        await assertInspector(page, node);
        await page.waitForFunction(() => {
          const box = document.querySelector('.inspector')?.getBoundingClientRect();
          return box && box.left >= 0 && box.right <= innerWidth + 1;
        });
        await hidePanels(page);
      }
      return { nativeExit: true, visibleDetails: true, focus: true, rejectedExitRecovery: true };
    }, true);
  }
  await runCase(browser, 'repeat-notice', viewports[0], {}, async page => {
    await page.goto(url); await chooseGraph(page, graph, false);
    const notify = async () => { await openMore(page); await menuItem(page, '整理间距').click({ force: true }); };
    await notify();
    await page.waitForFunction(() => document.querySelector('.toast').classList.contains('is-on'));
    const message = await status(page);
    await page.waitForTimeout(3000); await notify(); await page.waitForTimeout(1800);
    assert.ok(await page.locator('.toast').evaluate(element => element.classList.contains('is-on')), 'Repeating a visible result restarts its display timer.');
    await page.waitForFunction(() => !document.querySelector('.toast').classList.contains('is-on'), null, { timeout: 6000 });
    await notify();
    await page.waitForFunction(() => document.querySelector('.toast').classList.contains('is-on'));
    assert.equal(await page.getByRole('status').innerText(), message, 'An identical later result returns to the live status region.');
    await button(page, '进入全屏').click(); await fullscreenState(page, true);
    assert.equal(await status(page), '', 'Starting a new operation clears the old notification.');
    return { visibleRepeatResetsTimer: true, identicalResultRedisplayed: true, clearedOnNewOperation: true };
  }, true);
  for (const viewport of viewports) for (const colorTheme of ['light', 'dark']) {
    await runCase(browser, `${viewport.width}-${colorTheme}-fullscreen`, viewport, {}, async page => {
      await page.goto(url); await chooseGraph(page, graph, viewport.width <= 700);
      await theme(page, colorTheme);
      await hidePanels(page); await fit(page);
      await setLocked(page, false);
      assert.equal(await button(page, '进入全屏').count(), 1, 'The canvas exposes one fullscreen control.');
      await page.evaluate(() => { window.fullscreenTestFlow = document.querySelector('.react-flow'); });
      const snapshot = () => page.evaluate(() => ({
        viewport: document.querySelector('.react-flow__viewport').getAttribute('style'),
        positions: [...document.querySelectorAll('.react-flow__node')].map(node => [node.dataset.id, node.style.transform]),
        selected: [...document.querySelectorAll('.diagram-node.is-selected')].map(node => node.closest('[data-id]').dataset.id),
        panels: [...document.querySelectorAll('[aria-controls="graph-tools"],[aria-controls="node-inspector"]')].map(button => button.getAttribute('aria-expanded')),
        query: document.querySelector('#search')?.value,
        locked: !document.querySelector('.react-flow__node-diagram')?.classList.contains('draggable')
      }));
      await page.locator('.react-flow__controls-zoomin').click(); await page.waitForTimeout(240);
      const before = await snapshot();
      const fullscreen = button(page, '进入全屏');
      await fullscreen.focus(); await page.keyboard.press('Enter'); await fullscreenState(page, true);
      const entered = await snapshot();
      assert.notEqual(entered.viewport, before.viewport, 'Entering fullscreen automatically fits a previously zoomed view.');
      assert.deepEqual({ ...entered, viewport: before.viewport }, before, 'Auto-fit only changes the viewport, preserving reading and layout state.');
      const viewTransform = () => page.locator('.react-flow__viewport').evaluate(element => {
        const matrix = new DOMMatrix(getComputedStyle(element).transform); return [matrix.a, matrix.e, matrix.f];
      });
      const autoFit = await viewTransform();
      await button(page, '适应画布').click(); await page.waitForTimeout(360);
      assert.ok((await viewTransform()).every((value, index) => Math.abs(value - autoFit[index]) < .01), 'Auto-fit matches the fit button using the fullscreen canvas dimensions.');
      assert.ok(await page.locator('.canvas').evaluate(canvas => {
        const bounds = canvas.getBoundingClientRect();
        return [...canvas.querySelectorAll('.react-flow__node-diagram')].every(node => {
          const box = node.getBoundingClientRect();
          return box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom;
        });
      }), 'The whole diagram fits inside the fullscreen canvas.');
      const bounds = await page.locator('.diagram-board').evaluate(board => {
        const box = board.getBoundingClientRect(), canvas = board.querySelector('.canvas').getBoundingClientRect();
        const controls = [...board.querySelectorAll('.react-flow__controls,.react-flow__minimap,.legend-anchor')].map(element => element.getBoundingClientRect());
        const overlaps = controls.some((a, i) => controls.slice(i + 1).some(b => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top));
        return { width: box.width, height: box.height, x: box.x, y: box.y, windowWidth: innerWidth, windowHeight: innerHeight,
          canvasHeight: canvas.height, radius: getComputedStyle(board).borderRadius, overlaps,
          definitions: Boolean(board.querySelector('#codegraph-triangle,#codegraph-diamond-open')),
          outside: controls.some(box => box.left < canvas.left || box.right > canvas.right || box.top < canvas.top || box.bottom > canvas.bottom) };
      });
      assert.ok(Math.abs(bounds.width - bounds.windowWidth) <= 1 && Math.abs(bounds.height - bounds.windowHeight) <= 1 && bounds.x === 0 && bounds.y === 0, 'The board fills the fullscreen viewport.');
      assert.ok(bounds.canvasHeight > 0 && bounds.definitions); assert.equal(bounds.radius, '0px');
      assert.equal(bounds.overlaps, false, 'Canvas controls do not overlap.'); assert.equal(bounds.outside, false);
      await assertLegendLayout(page); await assertNodeDrawing(page, graph, colorTheme);
      await page.screenshot({ path: path.join(outputRoot, 'screens', `${viewport.width}-${colorTheme}-fullscreen.png`), animations: 'disabled' });
      const zoom = page.locator('.react-flow__controls-zoomin');
      await zoom.click(); await page.waitForTimeout(240);
      assert.notEqual((await snapshot()).viewport, entered.viewport, 'Zoom remains usable after automatic fitting.');
      const zoomed = await snapshot();
      await button(page, '退出全屏').click(); await fullscreenState(page, false);
      assert.deepEqual(await snapshot(), zoomed, 'Exiting preserves changes made inside fullscreen.');
      for (const key of [' ', 'Enter']) {
        await page.keyboard.press(key); await fullscreenState(page, true);
        const beforeEscape = await snapshot();
        await page.keyboard.press('Escape'); await fullscreenState(page, false);
        assert.deepEqual(await snapshot(), beforeEscape, 'Escape exits without clearing selection or changing the fitted viewport.');
      }
      await button(page, '进入全屏').click(); await fullscreenState(page, true);
      await button(page, '适应画布').click(); await page.waitForTimeout(360);
      const fitted = (await snapshot()).viewport;
      const blank = await blankPoint(page);
      await page.mouse.move(blank.x, blank.y); await page.mouse.down(); await page.mouse.move(blank.x + 40, blank.y + 25, { steps: 8 }); await page.mouse.up();
      assert.notEqual((await snapshot()).viewport, fitted);
      const map = await page.locator('.react-flow__minimap').boundingBox(), panned = (await snapshot()).viewport;
      if (viewport.width <= 700) assert.equal(map, null, 'The minimap is hidden on narrow screens.');
      else {
        await page.mouse.move(map.x + map.width * .55, map.y + map.height * .45); await page.mouse.down(); await page.mouse.move(map.x + map.width * .7, map.y + map.height * .6, { steps: 8 }); await page.mouse.up();
        assert.notEqual((await snapshot()).viewport, panned);
      }
      await button(page, '适应画布').click(); await page.waitForTimeout(360);
      const beforeDrag = (await snapshot()).positions;
      await pointerNode(page, target(graph), true);
      assert.notDeepEqual((await snapshot()).positions, beforeDrag, 'Unlocked nodes can be moved in fullscreen.');
      await pointerNode(page, target(graph));
      const selected = graph.nodes.find(node => node.id !== target(graph).id) ?? target(graph);
      await nodeElement(page, selected.id).focus(); await page.keyboard.press('Enter');
      await page.waitForTimeout(460);
      assert.equal(await count(page, '.nav,.inspector'), 0, 'Fullscreen selection does not open outside panels.');
      assert.deepEqual((await snapshot()).selected, [selected.id]);
      assert.ok(await page.evaluate(() => document.fullscreenElement.contains(document.activeElement)), 'Focus stays in fullscreen.');
      const changed = await snapshot();
      await page.evaluate(() => document.exitFullscreen()); await fullscreenState(page, false);
      assert.deepEqual(await snapshot(), changed, 'External exit synchronizes state without restoring an old snapshot.');
      await button(page, '显示右侧详情栏').click(); await assertInspector(page, selected);
      const openPanels = (await snapshot()).panels;
      await button(page, '进入全屏').click(); await fullscreenState(page, true);
      await nodeElement(page, target(graph).id).focus(); await page.keyboard.press(' ');
      assert.deepEqual((await snapshot()).panels, openPanels, 'Fullscreen selection also preserves already-open panels.');
      await button(page, '退出全屏').click(); await fullscreenState(page, false);
      await assertInspector(page, target(graph));
      await clear(page); await hidePanels(page);
      await page.locator('#search').fill(target(graph).label); await dismiss(page);

      const running = await snapshot();
      await button(page, '进入全屏').click(); await fullscreenState(page, true);
      await button(page, '退出全屏').click(); await fullscreenState(page, false);
      const afterRunning = await snapshot();
      assert.equal(afterRunning.query, running.query); assert.deepEqual(afterRunning.panels, running.panels);
      await button(page, '进入全屏').click(); await fullscreenState(page, true);
      await nodeElement(page, selected.id).focus(); await page.keyboard.press('Enter');
      await page.keyboard.press('Escape'); await fullscreenState(page, false);
      assert.ok(await page.evaluate(() => window.fullscreenTestFlow === document.querySelector('.react-flow')), 'React Flow is never remounted.');
      return { theme: colorTheme, nativeFullscreen: true, autoFit: true, statePreserved: true, keyboard: true, externalExit: true, controls: true };
    }, true);
  }
  for (const failure of ['unsupported', 'rejected', 'pending', 'exit-rejected']) {
    await runCase(browser, `${failure}-fullscreen-errors`, viewports[0], {}, async page => {
      await page.addInitScript(failure => {
        if (failure === 'unsupported') Object.defineProperty(document, 'fullscreenEnabled', { value: false });
        else if (failure === 'exit-rejected') {
          window.nativeExitFullscreen = document.exitFullscreen;
          document.exitFullscreen = () => Promise.reject(new Error('Exit denied'));
        }
        else Element.prototype.requestFullscreen = function () {
          window.fullscreenRequests = (window.fullscreenRequests ?? 0) + 1;
          return failure === 'rejected' ? Promise.reject(new Error('Denied by host')) : new Promise((resolve, reject) => { window.rejectFullscreen = reject; });
        };
      }, failure);
      await page.goto(url); await chooseGraph(page, graph, false); await hidePanels(page);
      const control = page.locator('.react-flow__controls-fullscreen');
      assert.equal(await control.count(), 1);
      if (failure === 'unsupported') {
        assert.equal(await control.getAttribute('aria-disabled'), 'true');
        assert.match(await control.getAttribute('title'), /不支持|不允许/);
      } else if (failure === 'exit-rejected') {
        await control.click(); await fullscreenState(page, true); await control.click();
        await page.waitForFunction(() => /无法退出全屏/.test(document.querySelector('.toast').textContent));
        assert.equal(await control.getAttribute('aria-pressed'), 'true', 'A failed exit does not report fullscreen as closed.');
        await page.evaluate(() => { document.exitFullscreen = window.nativeExitFullscreen; return document.exitFullscreen(); });
        await fullscreenState(page, false);
      } else {
        await control.click();
        if (failure === 'pending') {
          assert.equal(await control.getAttribute('aria-busy'), 'true');
          await control.evaluate(element => { element.click(); element.click(); });
          assert.equal(await page.evaluate(() => window.fullscreenRequests), 1, 'Repeated clicks cannot start concurrent requests.');
          await page.evaluate(() => window.rejectFullscreen(new Error('Denied by host')));
        }
        await page.waitForFunction(() => /无法.*全屏/.test(document.querySelector('.toast').textContent));
        assert.equal(await control.getAttribute('aria-busy'), 'false');
      }
      assert.equal(await page.evaluate(() => document.fullscreenElement), null);
      assert.equal(await control.getAttribute('aria-pressed'), 'false');
      return { failure, recovered: true };
    }, true);
  }
}

// Actual browser pixels, sampled along the visible path in CSS pixels. No reconstructed SVG.
async function motionFrames(page, graph, name, onlyIds, seek = true) {
  const phases = [0, 70, 140], frames = [], offsets = [];
  for (const phase of phases) {
    if (!seek) await page.waitForTimeout(70);
    else await page.evaluate(time => {
      for (const animation of document.getAnimations().filter(a => ['edge-flow', 'sequence-edge-flow'].includes(a.animationName))) { animation.pause(); animation.currentTime = time; }
    }, phase);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    if (seek) {
      const phasesMatch = await page.locator('.flow-edge--sequence.flow-edge--dashed').evaluateAll(elements => elements.every(element => {
        const paths = [...element.querySelectorAll('.react-flow__edge-path,.edge-flow,mask path')];
        const phases = paths.map(path => parseFloat(getComputedStyle(path).strokeDashoffset));
        return !element.querySelector('.edge-flow') || phases.every(value => Math.abs(value - phases[0]) < .001);
      }));
      assert.ok(phasesMatch, 'Sequence baseline, moving stroke and mask share an explicit zero-based animation phase.');
    }
    offsets.push(await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.react-flow__edge')].map(edge => [edge.dataset.id, parseFloat(getComputedStyle(edge.querySelector('.edge-flow') ?? edge.querySelector('.react-flow__edge-path')).strokeDashoffset)]))));
    frames.push((await page.screenshot({ path: path.join(outputRoot, 'screens', `${name}-${phase}.png`), animations: 'allow' })).toString('base64'));
  }
  const result = await page.evaluate(async ({ frames, offsets, graph, onlyIds }) => {
    const images = await Promise.all(frames.map(async frame => {
      const image = new Image(); image.src = 'data:image/png;base64,' + frame; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      return { width: image.width, height: image.height, data: context.getImageData(0, 0, image.width, image.height).data };
    }));
    const scale = images[0].width / innerWidth;
    const pixel = (image, x, y) => { const i = (Math.floor(y * scale) * image.width + Math.floor(x * scale)) * 4; return [...image.data.slice(i, i + 3)]; };
    const delta = (a, b) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0);
    const blocked = [...document.querySelectorAll('.edge-label,.sequence-head,.operand-guard,.operand-body,.node-card,.relation-card,.toolbar,.sidebar,.popover')].map(element => element.getBoundingClientRect());
    const zoom = new DOMMatrix(getComputedStyle(document.querySelector('.react-flow__viewport')).transform).a;
    const edges = graph.edges.filter(edge => !onlyIds || onlyIds.includes(edge.id)).map(edge => {
      const path = document.getElementById(edge.id), root = path.closest('.react-flow__edge'), flow = root.querySelector('.edge-flow');
      const matrix = path.getScreenCTM(), length = path.getTotalLength(), profiles = [[], [], []];
      const distances = [], points = [], pixelChanges = [];
      const radius = Math.max(1, Math.ceil(parseFloat(getComputedStyle(flow ?? path).strokeWidth) * zoom * scale / 2));
      const offsetsAcross = Array.from({ length: radius * 2 + 1 }, (_, i) => (i - radius) / scale);
      const markerMargin = Math.max(3, 8 * zoom);
      // Sample physical pixels: a 1 CSS px step aliases short dashes on high-DPI displays.
      for (let sample = 0, distance = markerMargin; distance < length * zoom - markerMargin; distance = markerMargin + ++sample / scale) {
        const local = path.getPointAtLength(distance / zoom), next = path.getPointAtLength(Math.min(length, distance / zoom + .1));
        const p = new DOMPoint(local.x, local.y).matrixTransform(matrix), q = new DOMPoint(next.x, next.y).matrixTransform(matrix);
        const size = Math.hypot(q.x - p.x, q.y - p.y); if (!size) continue;
        const beforeTurn = path.getPointAtLength(Math.max(0, (distance - 2) / zoom)), afterTurn = path.getPointAtLength(Math.min(length, (distance + 2) / zoom));
        if (Math.abs(afterTurn.x - beforeTurn.x) * zoom > .2 && Math.abs(afterTurn.y - beforeTurn.y) * zoom > .2) continue;
        const nx = -(q.y - p.y) / size, ny = (q.x - p.x) / size;
        if (p.x < 10 || p.x > innerWidth - 10 || p.y < 80 || p.y > innerHeight - 65 || blocked.some(b => p.x >= b.left - 1 && p.x <= b.right + 1 && p.y >= b.top - 1 && p.y <= b.bottom + 1)) continue;
        const otherEdgeAt = (x, y) => { const hit = document.elementFromPoint(x, y)?.closest('.react-flow__edge'); return hit && hit.dataset.id !== edge.id; };
        if (otherEdgeAt(p.x, p.y) || otherEdgeAt(p.x + nx * 6, p.y + ny * 6)) continue;
        distances.push(distance); points.push({ x: p.x, y: p.y });
        pixelChanges.push(offsetsAcross.reduce((sum, offset) => sum + delta(pixel(images[0], p.x + nx * offset, p.y + ny * offset), pixel(images[1], p.x + nx * offset, p.y + ny * offset)), 0) / offsetsAcross.length);
        images.forEach((image, i) => {
          const background = pixel(image, p.x + nx * 6, p.y + ny * 6);
          profiles[i].push(offsetsAcross.reduce((sum, offset) => sum + delta(pixel(image, p.x + nx * offset, p.y + ny * offset), background), 0) / offsetsAcross.length);
        });
      }
      const mean = values => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
      // Compare the stroke pixels themselves: a moving neighboring edge must not
      // turn this static edge into motion just by changing its background sample.
      const motion = mean(pixelChanges);
      // Center each profile without subtracting a position-dependent temporal
      // minimum, which distorts a translating dash at subpixel displacement.
      const moving = profiles.map(profile => profile.map(value => value - mean(profile)));
      const style = flow && getComputedStyle(flow);
      const period = style ? style.strokeDasharray.split(/[ ,]+/).reduce((sum, value) => sum + parseFloat(value), 0) : 0;
      const displacements = [0, 1].map(index => {
        let travel = offsets[index][edge.id] - offsets[index + 1][edge.id];
        if (period && Math.abs(travel) > period / 2) travel -= Math.sign(travel) * period;
        return travel * zoom;
      });
      const byDistance = new Map(distances.map((distance, index) => [Math.round((distance - markerMargin) * 1000), index]));
      const score = direction => {
        const errors = [];
        for (let phase = 0; phase < 2; phase++) for (let i = 0; i < distances.length; i++) {
          const target = (distances[i] - markerMargin + Math.abs(displacements[phase]) * direction) * scale, lower = Math.floor(target), fraction = target - lower;
          const a = byDistance.get(Math.round(lower / scale * 1000)), b = byDistance.get(Math.round((lower + 1) / scale * 1000));
          if (a !== undefined && b !== undefined) errors.push(Math.abs(moving[phase][i] - (moving[phase + 1][a] * (1 - fraction) + moving[phase + 1][b] * fraction)));
        }
        return errors.length ? mean(errors) : null;
      };
      return { id: edge.id, kind: edge.kind, dashed: getComputedStyle(path).strokeDasharray !== 'none', directed: Boolean(flow), samples: distances.length, motion, displacements, period, forwardError: score(1), reverseError: score(-1), contrast: mean(profiles.flat()), width: style ? parseFloat(style.strokeWidth) * zoom : 0, points: points.length ? [points[0], points.at(-1)] : [], profiles };
    });
    return { zoom, deviceScaleFactor: scale, phases: [0, 70, 140], directionSampling: 'measured-dash-offset-and-zoom-two-intervals', edges };
  }, { frames, offsets, graph, onlyIds });
  if (seek) await page.evaluate(() => { for (const animation of document.getAnimations().filter(a => ['edge-flow', 'sequence-edge-flow'].includes(a.animationName))) animation.play(); });
  return result;
}

async function centerMotionEdge(page, id) {
  const zoom = () => page.locator('.react-flow__viewport').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a);
  while (await zoom() < .75) { await page.locator('.react-flow__controls-zoomin').click(); await page.waitForTimeout(120); }
  while (await zoom() > 1.25) { await page.locator('.react-flow__controls-zoomout').click(); await page.waitForTimeout(120); }
  const point = await page.locator('.react-flow__edge-path').and(page.locator(`[id=${JSON.stringify(id)}]`)).evaluate(path => {
    const p = path.getPointAtLength(path.getTotalLength() * .35), q = new DOMPoint(p.x, p.y).matrixTransform(path.getScreenCTM()); return { x: q.x, y: q.y };
  });
  const blank = await blankPoint(page), viewport = page.viewportSize();
  await page.mouse.move(blank.x, blank.y); await page.mouse.down();
  await page.mouse.move(blank.x + viewport.width / 2 - point.x, blank.y + viewport.height / 2 - point.y, { steps: 5 }); await page.mouse.up(); await page.mouse.move(3, 60);
}

async function motionMatrix(browser, url, graph, viewport, colorTheme) {
  const name = `${graph.meta.diagramType}-${viewport.width}-${colorTheme}-motion-matrix`;
  const videoOptions = viewport.width === 1440 ? { recordVideo: { dir: path.join(outputRoot, 'videos'), size: viewport } } : {};
  await runCase(browser, name, viewport, videoOptions, async page => {
    await page.goto(url); await chooseGraph(page, graph, mobile(page)); await theme(page, colorTheme); await hidePanels(page); await clear(page); await page.mouse.move(3, 60);
    await page.waitForTimeout(800);
    const expected = graph.edges.filter(edge => hasArrow(edge, graph.meta.diagramType));
    assert.equal(await count(page, '.edge-flow'), expected.length, 'Directed and static edge counts match the registry.');
    const video = page.video() ? await page.video().path() : undefined;
    const overview = await motionFrames(page, graph, name + '-default');
    const local = [], kinds = new Set();
    const check = (sample, required = true) => {
      if (required) assert.ok(sample.samples >= 16, `${sample.id}: insufficient visible pixels (${sample.samples})`);
      if (sample.samples < 16) return;
      if (sample.directed) {
        assert.ok(sample.displacements.every(value => value > 0), `${sample.id}: sampled dash travel must be forward`);
        assert.ok(sample.motion > 1, `${sample.id}: no visible movement ${JSON.stringify(sample)}`);
        assert.notEqual(sample.forwardError, null, `${sample.id}: insufficient contiguous pixels to measure displacement`);
        assert.notEqual(sample.reverseError, null, `${sample.id}: insufficient contiguous pixels to measure displacement`);
        assert.ok(sample.forwardError < sample.reverseError, `${sample.id}: motion must travel source to target ${JSON.stringify(sample)}`);
      } else assert.ok(sample.motion < .5, `${sample.id}: undirected relationship must stay static ${JSON.stringify(sample)}`);
    };
    overview.edges.forEach(sample => check(sample, false));
    if (expected.length) assert.ok(overview.edges.some(edge => edge.directed && edge.samples >= 16 && edge.motion > 1), `Default view has visibly moving paths: ${JSON.stringify(overview.edges.map(({ profiles, ...item }) => item))}`);
    for (const edge of graph.edges) {
      const key = `${edge.kind}:${isDashed(edge, graph.meta.diagramType)}:${edge.source === edge.target}`;
      if (kinds.has(key)) continue; kinds.add(key);
      await clear(page); await centerMotionEdge(page, edge.id);
      const before = await motionFrames(page, graph, `${name}-${edge.id}-local`, [edge.id]);
      check(before.edges[0]);
      if (before.edges[0].directed) assert.ok(before.edges[0].width >= 1.5, 'Motion stroke remains readable in CSS pixels.');
      const element = page.locator('.react-flow__edge').and(page.locator(`[data-id=${JSON.stringify(edge.id)}]`));
      await element.focus(); await page.keyboard.press('Enter');
      if (await count(page, '.relation-card')) await button(page, '查看详情').click();
      await hidePanels(page); await page.waitForTimeout(850); await centerMotionEdge(page, edge.id); await page.mouse.move(3, 60);
      const selected = await motionFrames(page, graph, `${name}-${edge.id}-selected`, [edge.id]);
      check(selected.edges[0]);
      assert.ok(selected.edges[0].contrast >= before.edges[0].contrast * .6, `${edge.id}: selected contrast retains 60% of unselected reference`);
      for (const sample of [...before.edges, ...selected.edges]) delete sample.profiles;
      local.push({ kind: key, before, selected });
    }
    await clear(page); await fit(page); await page.waitForTimeout(800);
    const selectedEdge = graph.edges.find(edge => hasArrow(edge, graph.meta.diagramType)) ?? graph.edges[0];
    if (selectedEdge) { await page.locator('.react-flow__edge').and(page.locator(`[data-id=${JSON.stringify(selectedEdge.id)}]`)).focus(); await page.keyboard.press('Enter'); if (await count(page, '.relation-card')) await button(page, '查看详情').click(); await hidePanels(page); await fit(page); await page.waitForTimeout(850); }
    const selectedOverview = await motionFrames(page, graph, name + '-selected-overview');
    selectedOverview.edges.forEach(sample => check(sample, false));
    let reverseControl;
    if (process.env.QA_MOTION_CALIBRATION === '1') {
      const edge = graph.edges.find(edge => edge.kind === 'return') ?? expected[0];
      if (edge) {
        const style = await page.addStyleTag({ content: '.edge-flow,.flow-edge--sequence.flow-edge--dashed,.flow-edge--sequence mask path { animation-direction: reverse !important; }' });
        try {
          reverseControl = await motionFrames(page, graph, name + '-reverse-control', [edge.id]);
          const sample = reverseControl.edges[0];
          assert.ok(sample.samples >= 16 && sample.motion > 1, 'Reverse control is visibly moving.');
          assert.ok(sample.displacements.every(value => value < 0), 'Reverse control reverses the animation phase.');
          assert.ok(sample.reverseError < sample.forwardError, 'Actual reverse pixels are classified as reverse, not forward.');
          delete sample.profiles;
        } finally { await style.evaluate(element => element.remove()); }
      }
    }
    for (const sample of [...overview.edges, ...selectedOverview.edges]) delete sample.profiles;
    await page.waitForTimeout(1100);
    return { type:graph.meta.diagramType, theme:colorTheme, operations:['I23.10','I23.11','I23.12'], diagramType: graph.meta.diagramType, colorTheme, directedCount: expected.length, staticCount: graph.edges.length - expected.length, semanticResult: expected.length ? 'motion' : 'static-control', pixelFrames:fs.readdirSync(path.join(outputRoot,'screens')).filter(file=>file.startsWith(name+'-')).map(file=>'screens/'+file), overview, selectedOverview, local, reverseControl, video };
  }, true);
}

async function motionPreferences(browser, url, graph) {
  for (const colorTheme of ['light', 'dark']) await runCase(browser, `${graph.meta.diagramType}-${colorTheme}-motion-preferences`, viewports[0], {}, async (page, context) => {
    await page.goto(url); await chooseGraph(page, graph, false); await theme(page, colorTheme); await clear(page); await hidePanels(page); await fit(page);
    const directed = graph.edges.filter(edge => hasArrow(edge, graph.meta.diagramType)), edge = directed[0] ?? graph.edges[0];
    if (edge) await centerMotionEdge(page, edge.id);
    const states = [], capture = async (label, moving) => {
      await page.waitForTimeout(120);
      const sample = await motionFrames(page, graph, `${graph.meta.diagramType}-${colorTheme}-${label}`, edge ? [edge.id] : undefined, moving);
      for (const item of sample.edges) {
        assert.ok(item.samples >= 16, 'Preference check samples a visible route.');
        assert.ok(moving ? item.motion > 1 : item.motion < .5, `${label}: ${JSON.stringify(item)}`);
        delete item.profiles;
      }
      states.push({ label, ...sample });
    };
    const toggle = async value => {
      await openLegend(page); const control = page.getByRole('switch', { name: '连线流动', exact: true });
      if (await control.count()) { if ((await control.getAttribute('aria-checked') === 'true') !== value) await control.click(); }
      else {
        assert.equal(directed.length, 0);
        const withArrows = graphs.find(item => item.edges.some(edge => hasArrow(edge, item.meta.diagramType)));
        if (withArrows) {
          await dismiss(page); await chooseGraph(page, withArrows, false); await openLegend(page);
          const control = page.getByRole('switch', { name: '连线流动', exact: true });
          if ((await control.getAttribute('aria-checked') === 'true') !== value) await control.click();
          await dismiss(page); await chooseGraph(page, graph, false); await hidePanels(page);
          if (edge) await centerMotionEdge(page, edge.id);
        }
      }
      await dismiss(page);
    };
    await toggle(false); await capture('flow-off', false);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await assertFlow(page, false); await capture('reduced', false);
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await assertFlow(page, false); await capture('restored-user-off', false);
    const other = graphs.find(item => item.meta.diagramType !== graph.meta.diagramType);
    if (other) { await chooseGraph(page, other, false); await assertFlow(page, false); await chooseGraph(page, graph, false); await assertFlow(page, false); if (edge) await centerMotionEdge(page, edge.id); await capture('switch-preserves-off', false); }
    await toggle(true);
    const session = await context.newCDPSession(page);
    for (const [feature, value] of [['prefers-contrast', 'more'], ['prefers-reduced-transparency', 'reduce']]) {
      await session.send('Emulation.setEmulatedMedia', { features: [{ name: feature, value }] });
      await capture(feature, directed.length > 0);
      assert.ok(await page.locator('.edge-flow').evaluateAll(elements => elements.every(element => getComputedStyle(element).filter === 'none')));
      assert.ok(await page.locator('.selection-edge-halo,.selection-node-halo').evaluateAll(elements => elements.every(element => getComputedStyle(element).display === 'none')));
    }
    await session.send('Emulation.setEmulatedMedia', { features: [] });
    await page.emulateMedia({ reducedMotion: 'reduce' }); await capture('enabled-but-reduced', false);
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await capture('restored-user-on', directed.length > 0);
    return { colorTheme, directedCount: directed.length, states, pixelFrames: fs.readdirSync(path.join(outputRoot, 'screens')).filter(file => file.startsWith(`${graph.meta.diagramType}-${colorTheme}-`)).map(file => 'screens/' + file) };
  }, true);
}

async function detailBoundaryChecks(browser, url, graph, viewport, colorTheme) {
  const type = graph.meta.diagramType, name = `${type}-${viewport.width}-${colorTheme}-acceptance-details`;
  await runCase(browser, name, viewport, {}, async page => {
    const fixture = structuredClone(graph), node = fixture.nodes.find(n => n.id === target(graph).id);
    fixture.meta.title = '中文文件名验收';
    node.facts = Array.from({ length: 24 }, (_, i) => `${i + 1}. 完整事实说明 ${'LongEvidenceToken'.repeat(12)}`);
    await openFixture(page, fixture, viewport, url); await theme(page, colorTheme);
    page.qaPending = ['I05.01', 'I05.04'];
    const selections = [], positions = (await geometry(page)).nodes.map(({ id, position }) => ({ id, position }));
    for (const selected of fixture.nodes) for (const method of ['pointer', 'Enter', 'Space']) {
      await searchSelect(page, fixture, selected); const before = await pulse(page);
      await clear(page); await hidePanels(page);
      if (method === 'pointer') await pointerNode(page, selected);
      else { await nodeElement(page, selected.id).focus(); await page.keyboard.press(method); }
      await selection(page, fixture, selected.id); assert.equal(await pulse(page), before + 1, `${method} selects ${selected.id} from an empty selection`);
      selections.push({ id: selected.id, method, pulse: before + 1 });
    }
    assert.deepEqual((await geometry(page)).nodes.map(({ id, position }) => ({ id, position })), positions);
    const selectionScreenshot = `steps/${name}-selection.jpg`;
    await page.screenshot({ path: path.join(outputRoot, selectionScreenshot), type: 'jpeg', quality: 65 });
    page.qaSteps.push({ operations: page.qaPending, action: 'Select every node from an empty selection by pointer, Enter and Space', expected: 'Each input selects the named node exactly once without changing model positions', measured: { selections, positions }, screenshot: selectionScreenshot });
    page.qaPending = null; await searchSelect(page, fixture, node);
    const last = page.locator('.inspector-facts li').last(); await last.scrollIntoViewIfNeeded();
    const scroll = await page.locator('.inspector').evaluate(el => ({ top: el.scrollTop, height: el.clientHeight, total: el.scrollHeight, width: el.clientWidth, contentWidth: el.scrollWidth }));
    assert.ok(scroll.top > 0 && scroll.contentWidth <= scroll.width + 1, JSON.stringify(scroll));
    assert.ok(await last.evaluate(el => el.getBoundingClientRect().bottom <= el.closest('.inspector').getBoundingClientRect().bottom + 1));
    assert.equal(await last.textContent(), node.facts.at(-1));
    const screenshot = `steps/${name}.jpg`; await page.screenshot({ path: path.join(outputRoot, screenshot), type: 'jpeg', quality: 65 });
    const filenames = []; page.on('download', download => filenames.push(download.suggestedFilename()));
    await hidePanels(page); const exported = await exportsMatch(page, fixture, name);
    assert.deepEqual(filenames, ['中文文件名验收.svg', '中文文件名验收.png']);
    const files = Object.values(exported).map(file => ({ path: path.relative(outputRoot, file), sha256: digest(file) }));
    page.qaSteps.push({ operations: ['I12.06', 'I21.04'], action: 'Scroll 24 long facts to the last complete item and download SVG/PNG with Chinese filenames', expected: 'Last fact visible without horizontal overflow; both suggested names retain Chinese', measured: { scroll, filenames }, files, screenshot });
    return { type, theme: colorTheme, files };
  }, true);
}

const server = http.createServer((request, response) => {
  if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  let filename, root = inputRoot;
  try {
    let requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
    if (fixtureRoot && requested.startsWith('/__fixtures/')) { root = fixtureRoot; requested = requested.slice('/__fixtures'.length); }
    filename = path.resolve(root, '.' + requested);
  }
  catch { response.writeHead(400); response.end(); return; }
  if (!filename.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
  fs.readFile(filename, (error, body) => {
    if (error) { response.writeHead(404); response.end('Not found'); return; }
    response.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(filename)] ?? 'application/octet-stream'); response.end(body);
  });
});
let browser;
try {
  if(process.env.QA_COVERAGE_ONLY!=='1'){
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const url = `http://127.0.0.1:${server.address().port}/`;
  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? (fs.existsSync(macChrome) ? macChrome : undefined), headless: process.env.QA_HEADED !== '1' });
  report.environment.browser = browser.version();
  if (process.env.QA_EXTRAS?.split(',').includes('editor-boundaries')) await Promise.all(matrixViewports.map(async viewport => {
    for (const colorTheme of (process.env.QA_THEMES ?? 'light,dark').split(',')) for (const graph of filtered) await editorBoundaryChecks(browser, url, graph, viewport, colorTheme);
  }));
  if (filtered.some(graph => graph.meta.diagramType === 'flowchart') && process.env.QA_EXTRAS !== 'none') await Promise.all(matrixViewports.map(async viewport => {
    for (const colorTheme of ['light', 'dark']) await flowDirectionChecks(browser, url, viewport, colorTheme);
  }));
  if (process.env.QA_EXTRAS?.split(',').includes('export-failures')) await Promise.all(matrixViewports.map(async viewport=>{for(const colorTheme of ['light','dark'])for(const graph of filtered)await exportFailureChecks(browser,url,graph,viewport,colorTheme);}));
  if (filtered.length && process.env.QA_EXTRAS !== 'none') await saveFailureChecks(browser, url, filtered[0]);
  if (process.env.QA_EXTRAS !== 'none') for (const graph of filtered) await strictDraftChecks(browser, url, graph);
  if (filtered.length && process.env.QA_EXTRAS !== 'none') await fullscreenChecks(browser, url, filtered[0]);
  if (filtered.length && process.env.QA_EXTRAS !== 'none') await mobileEditingCheck(browser, url, filtered[0]);
  if (filtered.length && process.env.QA_EXTRAS !== 'none') await editPersistenceChecks(browser, url);
  if (filtered.length && process.env.QA_EXTRAS !== 'none') await relationshipCardAvoidanceCheck(browser, url);
  const layoutGraph = filtered.find(graph => graph.meta.diagramType === 'state' && graph.nodes.length >= 4) ?? filtered.find(graph => graph.nodes.length >= 4);
  if (layoutGraph && process.env.QA_EXTRAS !== 'none') await informationLayoutChecks(browser, url, layoutGraph);
  if (process.env.QA_EXTRAS?.split(',').includes('motion-preferences')) for (const graph of filtered) await motionPreferences(browser, url, graph);
  if (process.env.QA_EXTRAS?.split(',').includes('motion-matrix')) await Promise.all(matrixViewports.map(async viewport => { for (const colorTheme of ['light', 'dark']) for (const graph of filtered) await motionMatrix(browser, url, graph, viewport, colorTheme); }));
  if (process.env.QA_EXTRAS?.split(',').includes('acceptance')) await Promise.all(matrixViewports.map(async viewport => { for (const colorTheme of (process.env.QA_THEMES ?? 'light,dark').split(',')) for (const graph of filtered) await completeInteractions(browser, url, graph, viewport, colorTheme); }));
  if (process.env.QA_EXTRAS?.split(',').includes('acceptance-details')) await Promise.all(matrixViewports.map(async viewport => { for (const colorTheme of ['light', 'dark']) for (const graph of filtered) await detailBoundaryChecks(browser, url, graph, viewport, colorTheme); }));
  if (!process.env.QA_ONLY_EXTRAS) await Promise.all(matrixViewports.map(async viewport => { for (const colorTheme of ['light', 'dark']) for (const graph of filtered) await matrix(browser, url, graph, viewport, colorTheme); }));
  if (process.env.QA_EXTRAS !== 'none') for (const graph of filtered) await sequenceReadingChecks(browser, url, graph);
  if (process.env.QA_EXTRAS !== 'none') for (const graph of filtered) { await sequencePersistenceChecks(browser, url, graph); await sequenceFullscreenChecks(browser, url, graph); await sequenceEditorHandoffCheck(browser, url, graph); }
  if (process.env.QA_EXTRAS !== 'none') for (const graph of filtered) await fileUrlSequenceCheck(browser, graph);
  if (process.env.QA_EXTRAS !== 'none') for (const graph of filtered) {
    await textBoundsChecks(browser, url, graph);
    await entrypoints(browser, url, graph);
    await flowChecks(browser, url, graph);
    await flowContrastChecks(browser, url, graph);
    await inspectorChecks(browser, url, graph);
    await runCase(browser, `${graph.meta.diagramType}-reduced-motion`, viewports[0], { reducedMotion: 'reduce' }, async page => {
      await page.goto(url); await chooseGraph(page, graph, false); await assertFlow(page);
      await openLegend(page);
      const flowSwitch = page.getByRole('switch', { name: '连线流动', exact: true });
      if (await flowSwitch.count()) assert.equal(await flowSwitch.isDisabled(), true);
      await dismiss(page);
      if (getDiagram(graph.meta.diagramType).sequence) assert.equal(await count(page, '.edge-flow'), 0, 'Reduced motion leaves only the sequence semantic baseline.');
      await searchSelect(page, graph, target(graph));
      assert.ok(await page.locator('.selection-outline,.selection-outline *,.selection-feedback,.selection-feedback *').evaluateAll(elements => elements.every(element => getComputedStyle(element).animationName === 'none')), 'Reduced motion suppresses selection recoil.');
      await openMore(page); await menuItem(page, '重置').click(); await assertFlow(page);
      assert.equal(await count(page, '.drawer-body h2'), 0, 'Reduced-motion reset keeps an empty Inspector.');
      await searchSelect(page, graph, target(graph));
      await assertFlow(page, false);
      return { staticSelection: true, emptyReset: true };
    }, true);
    await runCase(browser, `${graph.meta.diagramType}-offline`, viewports[0], {}, async (page, context) => {
      const offlineUrl = url + 'offline.html'; await page.route(offlineUrl, route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(inputRoot, 'index.html'), 'utf8') })); await context.setOffline(true);
      await page.goto(offlineUrl); await chooseGraph(page, graph, false); await searchSelect(page, graph, target(graph)); return { offline: true };
    }, true);
  }
  for (const { name, graph } of fixtures) await runCase(browser, `fixture-${name}`, viewports[0], {}, async page => {
    await page.goto(url + '__fixtures/' + encodeURIComponent(name) + '/'); await page.locator('.diagram-node').first().waitFor();
    for (const selected of graph.nodes) {
      const before = await geometry(page);
      const symbols = await page.locator('.cardinality-mark').evaluateAll(elements => elements.map(element => element.outerHTML));
      await searchSelect(page, graph, selected); await assertShape(page, graph, selected);
      assert.deepEqual(await geometry(page), before);
      assert.deepEqual(await page.locator('.cardinality-mark').evaluateAll(elements => elements.map(element => element.outerHTML)), symbols);
      const shape = await nodeElement(page, selected.id).locator('.selection-outline .selection-node-shine').evaluate(element => element.firstElementChild.tagName);
      if (graph.meta.diagramType === 'state' && ['initial', 'final'].includes(selected.kind)) assert.equal(shape, 'circle');
      if (selected.kind === 'decision' || selected.kind === 'choice' || ['input', 'output'].includes(selected.kind)) assert.equal(shape, 'polygon');
      await page.screenshot({ path: path.join(outputRoot, 'screens', `fixture-${name}-${selected.id}.png`), animations: 'disabled' });
    }
    await exportsMatch(page, graph, `fixture-${name}`);
    return { nodes: graph.nodes.length, selfLoops: graph.edges.filter(edge => edge.source === edge.target).length, symbolsPreserved: true };
  }, true);
  }
} catch (error) { report.failures.push({ name: 'fatal', message: error.message, stack: error.stack }); console.error(error); }
finally {
  if (browser) await browser.close(); report.browserClosed = true;
  if (server.listening) await new Promise(resolve => server.close(resolve)); report.serverClosed = true;
  if(process.env.QA_MERGE_REPORTS){
    const cases=new Map(),extras=new Map(),exports=[],history=[];
    report.sources=[];
    for(const entry of process.env.QA_MERGE_REPORTS.split(',')){
      const file=path.resolve(entry),source=JSON.parse(fs.readFileSync(file)),base=path.dirname(file);
      assert.equal(source.build.htmlSha256,report.build.htmlSha256,`HTML version mismatch: ${file}`);
      assert.equal(source.build.graphSha256,report.build.graphSha256,`Graph version mismatch: ${file}`);
      assert.ok(source.finishedAt&&source.browserClosed&&source.serverClosed,`Incomplete resource cleanup: ${file}`);
      const relative=value=>value?path.relative(outputRoot,path.resolve(base,value)):undefined;
      report.sources.push({report:relative(file),sha256:digest(file),build:source.build,summary:source.summary});
      const adapt=item=>({...relocateEvidence(item,base),sourceReport:relative(file)});
      for(const item of source.cases)cases.set(item.name,adapt(item));
      for(const item of source.extra)extras.set(item.name,adapt(item));
      exports.push(...source.exports.map(item=>{
        for(const format of ['svg','png']) {
          const attachment=path.resolve(base,item[format]);
          assert.ok(fs.existsSync(attachment),`Missing exported file: ${attachment}`);
          if(item[`${format}Sha256`])assert.equal(digest(attachment),item[`${format}Sha256`],`Export hash mismatch: ${attachment}`);
        }
        return {...item,sourceReport:relative(file)};
      }));
      history.push(...source.failures.map(failure=>({...failure,sourceReport:relative(file)})));
    }
    report.cases=[...cases.values()];report.extra=[...extras.values()];report.exports=exports;
    report.failures=history.filter(failure=>!(cases.get(failure.name)??extras.get(failure.name))?.passed);
    report.resolvedRetries=history.filter(failure=>(cases.get(failure.name)??extras.get(failure.name))?.passed);
  }
  report.finishedAt = new Date().toISOString();
  report.summary = { scenes: report.cases.length, passed: report.cases.filter(value => value.passed).length, extras: report.extra.length, extraPassed: report.extra.filter(value => value.passed).length, exports: report.exports.length * 2, failures: report.failures.length };
  const inventory = JSON.parse(fs.readFileSync(new URL('../../../tests/fixtures/viewer-interactions.json', import.meta.url)));
  const coverage = { build: report.build, inventorySha256: digest(new URL('../../../tests/fixtures/viewer-interactions.json', import.meta.url)), operations: inventory.operations, cases: [], hostChecks: [], excluded: inventory.operations.filter(op=>op.scope==='deferred') };
  const applicable = (op, graph, viewport) => {
    if (!graph) return null;
    const type=graph.meta.diagramType, id=op.id, arrows=graph.edges.filter(edge=>hasArrow(edge,type));
    if (id.startsWith('I04.') && viewport.width<=700) return 'The production CSS hides MiniMap at widths <=700px; navigation is provided by fit/search.';
    if (['I17.07','I19.04','I06.10','I11.09'].includes(id) && type!=='sequence') return 'This operation concerns sequence time-axis, call/return or safe-card fallback behavior.';
    if (id==='I06.04' && ![...createEdgeRoutes(graph).values()].some(r=>!r.label)) return 'This graph has no relationship with an empty rendered label.';
    if (id==='I06.05' && !graph.edges.some(e=>!isDashed(e,type))) return 'This graph has no solid relationship.';
    if (id==='I06.06' && !graph.edges.some(e=>isDashed(e,type))) return 'This graph has no dashed relationship.';
    if (id==='I06.07' && !graph.edges.some(e=>e.source===e.target)) return 'This graph has no self relationship.';
    if (id==='I06.08' && !graph.edges.some((e,i)=>graph.edges.slice(i+1).some(o=>o.source===e.source&&o.target===e.target))) return 'This graph has no parallel relationship pair.';
    if (id==='I06.09' && !graph.edges.some(e=>graph.nodes.find(n=>n.id===e.source)?.groupId!==graph.nodes.find(n=>n.id===e.target)?.groupId)) return 'This graph has no relationship crossing declared ownership groups.';
    if (/^I23\.(02|03|04|05|06|07|08|09)$/.test(id) && !arrows.length) return 'The diagram contains no directed relationships, so no flow control is exposed.';
    if (id==='I23.10' && !arrows.some(e=>!isDashed(e,type))) return 'No directed solid relationship to animate.';
    if (id==='I23.11' && !arrows.some(e=>isDashed(e,type))) return 'No directed dashed relationship to animate.';
    if (id==='I23.12' && graph.edges.every(e=>hasArrow(e,type))) return 'No undirected relationship in this model.';
    return null;
  };
  const results=[...report.cases,...report.extra];
  for (const type of Object.keys(labels)) for (const viewport of viewports) for (const theme of ['light','dark']) {
    const scene=`${type}-${viewport.width}-${theme}`, graph=graphs.find(g=>g.meta.diagramType===type);
    const matching=results.filter(r=>r.width===viewport.width && (r.type===type||r.name.startsWith(type+'-')) && (r.theme===theme||r.name.includes('-'+theme+'-')));
    for(const op of inventory.operations.filter(op=>op.scope==='scene')) {
      const reason=applicable(op,graph,viewport);
      const found=matching.flatMap(r=>(r.steps??[]).filter(step=>step.operations.includes(op.id)).map((step,index)=>({r,step,index})));
      const fallback=matching.find(r=>r.passed&&(r.operations??[]).includes(op.id));
      const evidence=found.map(({r,step,index})=>({report:'browser-interactions-report.json',case:r.name,step:r.steps.indexOf(step),screenshot:step.screenshot,trace:r.trace,files:step.files??r.files}));
      if(!evidence.length&&fallback)evidence.push({report:'browser-interactions-report.json',case:fallback.name,trace:fallback.trace,pixelFrames:fallback.pixelFrames,video:fallback.video,files:fallback.files});
      const missingEvidence=evidence.some(e=>(e.trace?!fs.existsSync(path.join(outputRoot,e.trace)):!e.pixelFrames?.length||e.pixelFrames.some(file=>!fs.existsSync(path.join(outputRoot,file))))||e.video&&!fs.existsSync(path.join(outputRoot,e.video))||e.screenshot&&!fs.existsSync(path.join(outputRoot,e.screenshot))||e.files?.some(file=>!fs.existsSync(path.join(outputRoot,file.path))||digest(path.join(outputRoot,file.path))!==file.sha256));
      const failed=matching.some(r=>r.failedOperations?.includes(op.id));
      coverage.cases.push({id:`${scene}/${op.id}`,operation:op.id,entry:op.entry,expected:op.expected,
        status:reason?'not-applicable':failed?'fail':missingEvidence?'blocked':evidence.length?'pass':'not-run',reason,evidence});
    }
  }
  let host;
  if(process.env.QA_HOST_EVIDENCE) {
    host=JSON.parse(fs.readFileSync(process.env.QA_HOST_EVIDENCE));
    assert.equal(host.build.htmlSha256,report.build.htmlSha256,'Native receipt must test this exact packaged HTML');
    assert.equal(host.build.graphSha256,report.build.graphSha256,'Native receipt must test this exact model');
  }
  for(const op of inventory.operations.filter(op=>op.scope==='host')) {
    const receipt=host?.operations?.find(item=>item.id===op.id);
    const evidenceExists=receipt?.evidence?.length && receipt.evidence.every(file=>fs.existsSync(path.resolve(path.dirname(process.env.QA_HOST_EVIDENCE),file)));
    coverage.hostChecks.push({id:op.id,entry:op.entry,expected:op.expected,status:receipt?.status==='pass'&&evidenceExists?'pass':'blocked',evidence:receipt??null});
  }
  coverage.requiredRuns = [];
  for (const type of Object.keys(labels)) for (const viewport of viewports) for (const theme of ['light', 'dark']) for (const suffix of ['', '-acceptance', '-editor-boundaries', '-acceptance-details', '-motion-matrix', '-export-failures']) {
    const name = `${type}-${viewport.width}-${theme}${suffix}`, result = results.find(item => item.name === name);
    const attachments = [result?.trace, result?.video, ...(result?.pixelFrames ?? []), ...(result?.steps ?? []).map(step => step.screenshot)].filter(Boolean);
    const files = [...(result?.files ?? []), ...(result?.steps ?? []).flatMap(step => step.files ?? [])];
    const complete = result && attachments.length && attachments.every(file => fs.existsSync(path.resolve(outputRoot, file))) && files.every(file => fs.existsSync(path.resolve(outputRoot, file.path)) && digest(path.resolve(outputRoot, file.path)) === file.sha256)
      && (suffix === '-motion-matrix' ? result.pixelFrames?.length >= 3 && (viewport.width !== 1440 || result.video) : result.trace)
      && (!['-acceptance', '-editor-boundaries', '-acceptance-details', '-export-failures'].includes(suffix) || files.length > 0);
    coverage.requiredRuns.push({ name, status: !result ? 'not-run' : !result.passed ? 'fail' : complete ? 'pass' : 'blocked' });
  }
  const all=[...coverage.cases,...coverage.hostChecks];
  coverage.summary={total:all.length,passed:all.filter(x=>x.status==='pass').length,notApplicable:all.filter(x=>x.status==='not-applicable').length,notRun:all.filter(x=>x.status==='not-run').length,blocked:all.filter(x=>x.status==='blocked').length,failed:all.filter(x=>x.status==='fail').length,failedScenes:report.failures.length,requiredRuns:coverage.requiredRuns.length,incompleteRuns:coverage.requiredRuns.filter(item=>item.status!=='pass').length,userDeferred:coverage.excluded.length};
  coverage.status=all.some(x=>!['pass','not-applicable'].includes(x.status))||report.failures.length||coverage.summary.incompleteRuns?'incomplete':'passed';
  fs.writeFileSync(path.join(outputRoot,'interaction-coverage.json'),JSON.stringify(coverage,null,2)+'\n');
  const groups = [...new Set(inventory.operations.map(op => op.group))].map(group => {
    const entries = all.filter(item => (item.operation ?? item.id).startsWith(group + '.'));
    return `| ${group} | ${entries.length} | ${entries.filter(item => item.status === 'pass').length} | ${entries.filter(item => item.status === 'not-applicable').length} | ${entries.filter(item => !['pass','not-applicable'].includes(item.status)).length} |`;
  });
  const sceneLinks = coverage.requiredRuns.filter(item => item.name.endsWith('-acceptance')).map(item => {
    const result = results.find(value => value.name === item.name);
    return `| ${item.name} | ${item.status} | ${result?.steps?.length ?? 0} | ${result?.trace ? `[trace](${result.trace})` : 'missing'} | ${result?.sourceReport ? `[source report](${result.sourceReport})` : '[report](browser-interactions-report.json)'} |`;
  });
  fs.writeFileSync(path.join(outputRoot,'interaction-coverage.md'),`# Interaction coverage\n\nStatus: ${coverage.status}. ${JSON.stringify(coverage.summary)}\n\n[Detailed operations, expected results and evidence](interaction-coverage.json). [Measured steps, model positions and files](browser-interactions-report.json). Not-applicable entries state the source/model capability. Physical touch and soft keyboard are explicitly deferred by the user and never counted as passed. Native evidence must match this exact HTML and graph.\n\n## Operation groups\n\n| Group | Records | Pass | Not applicable | Incomplete |\n| --- | ---: | ---: | ---: | ---: |\n${groups.join('\n')}\n\n## Complete scene workflows\n\n| Scene | Status | Steps | Pointer/keyboard trace | Measurements and screenshots |\n| --- | --- | ---: | --- | --- |\n${sceneLinks.join('\n')}\n\n## Remaining gaps\n\n`+[...all.filter(x=>!['pass','not-applicable'].includes(x.status)).map(x=>`- ${x.id}: ${x.status} — ${x.entry}`),...coverage.requiredRuns.filter(x=>x.status!=='pass').map(x=>`- ${x.name}: ${x.status}`)].join('\n')+'\n');
  report.acceptance={status:coverage.status,coverage:'interaction-coverage.json'};
  if(process.env.QA_FULL_ACCEPTANCE==='1'&&coverage.status!=='passed')process.exitCode=1;
  writeReport(); console.log(JSON.stringify(report.summary)); if (report.failures.length) process.exitCode = 1;
}
