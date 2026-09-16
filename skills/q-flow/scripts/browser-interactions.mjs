#!/usr/bin/env node
// Replays the production Viewer contract over the canvas-first shell: one floating toolbar, collapsed floating panels,
// quick-look cards and the legend popover. Uses an existing Playwright installation.
// Usage: node browser-interactions.mjs GENERATED_DIRECTORY REPORT_DIRECTORY
// Optional: PLAYWRIGHT_MODULE, CHROME_PATH, QA_HEADED=1, QA_TYPES, QA_ONLY_EXTRAS=1, QA_EXTRAS=none|selection-entrypoints|ambient-flow|flow-contrast|inspector-sync|information-layout|facts-layout|fullscreen|fullscreen-errors|quick-details|repeat-notice|long-preview|text-bounds|relationship-card-avoidance|sequence-reading|file-url, QA_FIXTURE_DIR.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { graphLegend } from '../assets/viewer/src/legend.js';
import { renderNode } from '../assets/viewer/src/node-svg.js';
import { moduleColorMap, PALETTES, TYPOGRAPHY, isCore } from '../assets/viewer/src/visual-style.js';
import { diagramLabels as labels, getDiagram, hasArrow, isDashed } from '../assets/viewer/src/diagrams/registry.js';
import { validateGraph, validateGraphInput } from './validate-graph.mjs';

const [inputDirectory, reportDirectory] = process.argv.slice(2);
if (!inputDirectory || !reportDirectory) throw new Error('Usage: node browser-interactions.mjs GENERATED_DIRECTORY REPORT_DIRECTORY');
const inputRoot = path.resolve(inputDirectory), outputRoot = path.resolve(reportDirectory);
const input = JSON.parse(fs.readFileSync(path.join(inputRoot, 'graph.json'), 'utf8'));
const graphs = (input.diagrams ?? [input]).slice().sort((a, b) => Object.keys(labels).indexOf(a.meta.diagramType) - Object.keys(labels).indexOf(b.meta.diagramType));
const fixtureRoot = process.env.QA_FIXTURE_DIR ? path.resolve(process.env.QA_FIXTURE_DIR) : null;
const fixtures = fixtureRoot ? fs.readdirSync(fixtureRoot).filter(name => fs.existsSync(path.join(fixtureRoot, name, 'index.html'))).map(name => ({ name, graph: JSON.parse(fs.readFileSync(path.join(fixtureRoot, name, 'graph.json'), 'utf8')) })) : [];
const filtered = graphs.filter(graph => !process.env.QA_TYPES || process.env.QA_TYPES.split(',').includes(graph.meta.diagramType));
const viewports = [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }];
const report = { startedAt: new Date().toISOString(), cases: [], extra: [], exports: [], failures: [] };
for (const directory of ['', 'screens', 'exports', 'failures']) fs.mkdirSync(path.join(outputRoot, directory), { recursive: true });
const writeReport = () => fs.writeFileSync(path.join(outputRoot, 'browser-interactions-report.json'), JSON.stringify(report, null, 2) + '\n');
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
  if (!await count(page, '.inspector')) await button(page, '显示右侧详情栏').click();
  await page.locator('.inspector').waitFor();
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
  assert.equal(await count(page, '.nav,.inspector'), 0, 'Both floating panels start collapsed at every width.');
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
  if (mobile) assert.equal(await count(page, '.nav,.inspector'), 0, 'Switching views leaves mobile panels closed.');
  return assertIdentity(page, graph);
}
async function assertIdentity(page, graph) {
  const documentTitle = `${graph.meta.title} · QGraphFlow`;
  await page.waitForFunction(title => document.title === title, documentTitle);
  const toolbar = page.locator('.toolbar');
  assert.equal(await toolbar.count(), 1, 'One toolbar floats over the canvas.');
  assert.ok(!(await toolbar.innerText()).includes('QGraphFlow'), 'The product name lives only in the document title.');
  assert.equal(await count(page, '.brand,.heading,.topbar,.board-head,.board-foot'), 0, 'No brand block, second header bar, board header or footer remains.');
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
  if (await page.locator('html').getAttribute('data-theme') !== value) {
    await openMore(page); await page.getByRole('radio', { name: value === 'dark' ? '深色' : '浅色', exact: true }).click(); await dismiss(page);
  }
  await page.waitForFunction(value => document.documentElement.dataset.theme === value, value);
}
async function fit(page) { await button(page, '适应画布').click(); await page.waitForTimeout(360); }
async function blankPoint(page) {
  const point = await page.locator('.react-flow__pane').evaluate(pane => {
    const box = pane.getBoundingClientRect();
    return [.12, .5, .95].flatMap(y => [.05, .5, .95].map(x => ({ x: box.x + box.width * x, y: box.y + box.height * y })))
      .find(({ x, y }) => document.elementFromPoint(x, y) === pane);
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
  const actualLegend = await page.locator('.legend-pop .legend span').evaluateAll(elements => elements.map(element => ({ text: element.textContent, fill: element.querySelector('i').style.backgroundColor, border: element.querySelector('i').style.borderColor, symbol: element.firstElementChild.className, lineStyle: getComputedStyle(element.firstElementChild).borderTopStyle })));
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
    await page.evaluate(() => { const active = document.activeElement; if (active?.closest('.nav,.inspector')) active.blur(); });
    await page.keyboard.press('Escape');
  }
  else if (method === 'close') await button(page, '关闭详情').click();
  else { const point = await blankPoint(page); await page.mouse.click(point.x, point.y); }
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
  for (const node of graph.nodes) {
    const expected = renderNode(node, graph.meta.diagramType, -node.position.x, -node.position.y, palette, undefined, moduleColors);
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
  const pending = page.waitForEvent('download'); await menuItem(page, `导出 ${format}`).click(); const result = await pending;
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
    const notation = edges.map(element => ({ dashed: element.firstElementChild.hasAttribute('stroke-dasharray'), arrow: element.firstElementChild.hasAttribute('marker-end'), label: [...element.querySelectorAll('text')].map(text => text.textContent).join('') }));
    const lifelines = [...root.querySelectorAll('.lifeline')].map(element => element.getAttribute('d'));
    const image = new Image(); image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml); await image.decode();
    return { title: document.querySelector('title')?.textContent, width: image.naturalWidth, height: image.naturalHeight, paths, notation, lifelines };
  }, svg);
  assert.equal(parsed.title, graph.meta.title); assert.equal(parsed.paths.length, graph.edges.length);
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
    const pageNotation = await page.locator('.react-flow__edge-path').evaluateAll(elements => elements.map(element => ({ dashed: getComputedStyle(element).strokeDasharray !== 'none', arrow: element.hasAttribute('marker-end') })));
    parsed.notation.forEach((edge, index) => {
      assert.deepEqual({ dashed: edge.dashed, arrow: edge.arrow }, pageNotation[index], `${graph.edges[index].id}: export and page agree on dashes and arrows`);
      assert.ok(edge.label.startsWith(`${String(graph.edges[index].order).padStart(2, '0')} · `), 'Export preserves message order.');
    });
    const current = await geometry(page);
    assert.equal(parsed.lifelines.length, graph.nodes.length);
    parsed.lifelines.forEach((line, index) => {
      const [start, end] = points(line), node = current.nodes[index];
      assert.ok(Math.abs(end.y - start.y - (Number.parseFloat(node.height) - (graph.nodes[index].kind === 'actor' ? 108 : 72))) < .01, 'Export retains the full authored lifeline length.');
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
  report.exports.push({ name, svg: svgFile, png: pngFile, ...pngSize, pathParity: true, decoded: true, ...(sequence ? { notationParity: true, lifelineParity: true, pngPixelParity: true } : {}) });
  return { svgFile, pngFile };
}
async function runCase(browser, name, viewport, options, run, extra = false) {
  if (extra && process.env.QA_EXTRAS && !process.env.QA_EXTRAS.split(',').some(value => name === value || name.endsWith('-' + value))) return;
  const context = await browser.newContext({ viewport, acceptDownloads: true, reducedMotion: 'no-preference', ...options });
  const page = await context.newPage(); page.setDefaultTimeout(10000); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    const evidence = await run(page, context); assert.deepEqual(errors, [], 'Browser errors.');
    (extra ? report.extra : report.cases).push({ name, ...viewport, ...evidence, passed: true }); console.log('PASS', name);
  } catch (error) {
    await page.screenshot({ path: path.join(outputRoot, 'failures', name + '.png'), animations: 'disabled' }).catch(() => {});
    (extra ? report.extra : report.cases).push({ name, passed: false, error: error.message });
    report.failures.push({ name, message: error.message, stack: error.stack, console: errors }); console.error('FAIL', name, error.stack);
  } finally { await context.close(); writeReport(); }
}
async function matrix(browser, url, graph, viewport, colorTheme) {
  const name = `${graph.meta.diagramType}-${viewport.width}-${colorTheme}`, mobile = viewport.width <= 700;
  await runCase(browser, name, viewport, {}, async page => {
    await page.goto(url); await page.locator('.diagram-node').first().waitFor();
    await theme(page, colorTheme); const branding = await chooseGraph(page, graph, mobile);
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
    assert.deepEqual(await panelState(page), panelsBeforeReset, 'Reset preserves panel preferences.');
    await page.waitForFunction(() => !document.querySelector('.diagram-node.is-selected'));
    assert.equal(await page.locator('#search').inputValue(), '');
    await openMore(page); assert.equal(await menuItem(page, '整理间距').getAttribute('aria-disabled'), 'true'); await dismiss(page);
    assert.equal(await page.locator('html').getAttribute('data-theme'), colorTheme);
    assert.match(await status(page), /已重置/, 'Reset reports through the toast.');
    assert.ok(!/请先|布局已调整|整理.*移动/.test(await status(page)), 'Reset clears stale spacing status.');

    await fit(page);
    if (viewport.width === 1440) { await searchSelect(page, graph, target(graph)); await exportsMatch(page, graph, name); }
    await hidePanels(page); await fit(page);
    const beforeFullscreen = await geometry(page);
    await button(page, '进入全屏').click(); await fullscreenState(page, true);
    await assertNodeDrawing(page, graph, colorTheme);
    assert.deepEqual(await geometry(page), beforeFullscreen, 'Fullscreen preserves node geometry, routes and arrow markers for every diagram type.');
    await page.screenshot({ path: path.join(outputRoot, 'screens', name + '-fullscreen.png'), animations: 'disabled' });
    await button(page, '退出全屏').click(); await fullscreenState(page, false);
    return { type: graph.meta.diagramType, theme: colorTheme, branding, linkedEdges: graph.edges.filter(edge => edge.source === target(graph).id || edge.target === target(graph).id).length, stableGeometry: true };
  });
}
async function pointerNode(page, node, drag = false) {
  const element = nodeElement(page, node.id);
  const shape = element.locator('.participant-head,.actor-figure,.state-dot,.shape-label,header').first();
  const locate = async () => (await shape.count() ? shape : element).evaluate(element => {
    const box = element.getBoundingClientRect();
    return [[.5, .5], [.9, .5], [.1, .5], [.5, .9], [.5, .1]]
      .map(([x, y]) => ({ x: box.x + box.width * x, y: box.y + box.height * y }))
      .find(({ x, y }) => element.contains(document.elementFromPoint(x, y)));
  });
  let point = await locate();
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
        return [.5, .35, .65].flatMap(y => [.5, .4, .6].map(x => ({ x: box.x + box.width * x, y: box.y + box.height * y }))).find(({ x, y }) => document.elementFromPoint(x, y) === pane);
      });
      assert.ok(blank, 'A blank canvas point is available to uncover a covered node.');
      await page.mouse.move(blank.x, blank.y); await page.mouse.down(); await page.mouse.move(blank.x + shift, blank.y, { steps: 8 }); await page.mouse.up();
      await page.waitForTimeout(160); point = await locate();
    }
  }
  assert.ok(point, `Node ${node.id} exposes a pointer target outside canvas overlays.`);
  const { x, y } = point;
  await page.mouse.move(x, y); await page.mouse.down();
  if (drag) await page.mouse.move(x + 36, y + 22, { steps: 8 });
  await page.mouse.up();
}
async function entrypoints(browser, url, graph) {
  await runCase(browser, `${graph.meta.diagramType}-selection-entrypoints`, viewports[0], {}, async page => {
    await page.goto(url); await chooseGraph(page, graph, false); await hidePanels(page); await fit(page);
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
    await selection(page, graph, selected.id); await exportsMatch(page, graph, `${graph.meta.diagramType}-dragged`);
    await openMore(page); await menuItem(page, '整理间距').click(); const spacingStatus = await status(page);
    assert.match(spacingStatus, /移动 \d+ 个节点|当前间距无需调整|仍有.*(?:问题|手动)/);
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
      // SVG interaction paths are deliberate transparent hit targets; dispatch exercises React's edge handler.
      await edge.locator('.react-flow__edge-interaction').dispatchEvent('click');
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
      const downloads = await exportsMatch(page, graph, `${graph.meta.diagramType}-edited`);
      const editedSvg = fs.readFileSync(downloads.svgFile, 'utf8');
      assert.ok(editedSvg.includes(editedNodeLabel) && editedSvg.includes(editedEdgeLabel), 'SVG export uses current session text.');
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
      const pending = page.waitForEvent('download'); await menuItem(page, '保存 Graph JSON').click();
      const downloaded = await pending;
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
  for (const phase of [null, 0, 600]) {
    await page.locator('.sequence-edge-flow').evaluateAll((elements, phase) => {
      for (const element of elements) {
        element.style.visibility = phase === null ? 'hidden' : '';
        for (const animation of element.getAnimations()) { animation.pause(); animation.currentTime = phase ?? 0; }
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
      const path = document.getElementById(id), matrix = path.getScreenCTM(), length = path.getTotalLength();
      let motion = 0, gapChange = 0, ink = 0, gap = 0, inkCount = 0, gapCount = 0, gapWorst;
      for (let distance = 21.5; distance < length - 16; distance += 10) for (const offset of [0, 6]) {
        const local = path.getPointAtLength(distance + offset), point = new DOMPoint(local.x, local.y).matrixTransform(matrix);
        if (point.x < 1 || point.y < 8 || point.x >= innerWidth - 1 || point.y >= innerHeight - 8 || labels.some(box => point.x >= box.left - 2 && point.x <= box.right + 2 && point.y >= box.top - 2 && point.y <= box.bottom + 2)) continue;
        if (dashed && offset === 6) {
          // Only test pixels wholly inside the gap, excluding stroke-edge antialiasing at fractional zoom.
          const next = path.getPointAtLength(distance + offset + .1), tangent = new DOMPoint(next.x, next.y).matrixTransform(matrix);
          const dx = (tangent.x - point.x) / .1, dy = (tangent.y - point.y) / .1, zoom = Math.hypot(dx, dy);
          const center = { x: (Math.floor(point.x * scale) + .5) / scale, y: (Math.floor(point.y * scale) + .5) / scale };
          const phase = 7.5 + ((center.x - point.x) * dx + (center.y - point.y) * dy) / (zoom * zoom);
          const halfPixel = .5 * (Math.abs(dx) + Math.abs(dy)) / (scale * zoom * zoom);
          if (phase - halfPixel < 5.5 || phase + halfPixel > 9.5) continue;
        }
        const colors = images.map(image => pixel(image, point));
        const contrast = Math.max(...images.map((image, index) => delta(colors[index], pixel(image, { x: point.x, y: point.y + 7 }))));
        if (dashed && offset === 6) {
          gapCount++; gap += contrast;
          // Allow at most three 8-bit levels per channel for fractional-scale SVG compositing.
          const change = Math.max(...colors[1].map((value, index) => Math.abs(value - colors[2][index])));
          if (change > gapChange) { gapChange = change; gapWorst = { distance: distance + offset, x: point.x, y: point.y, colors: colors.map(color => [...color]) }; }
        } else { inkCount++; ink += contrast; motion += delta(colors[1], colors[2]); }
      }
      return { id, dashed, motion, gapChange, gapWorst, ink: ink / Math.max(1, inkCount), gap: gap / Math.max(1, gapCount), inkCount, gapCount };
    });
  }, { frames, checked });
  assert.equal(new Set(viewports).size, 1, 'Pixel sampling keeps the viewport fixed.');
  for (const sample of samples) {
    assert.ok(sample.inkCount > 0 && sample.motion > 12, `${sample.id}: no visible sequence motion in rendered pixels (${JSON.stringify(sample)})`);
    if (sample.dashed) {
      assert.ok(sample.gapCount > 0 && sample.gapChange <= 3, `${sample.id}: flow paints the semantic dash gaps (${JSON.stringify(sample)})`);
      assert.ok(sample.gap < sample.ink * .5, `${sample.id}: selected dash gaps are no longer distinguishable (${JSON.stringify(sample)})`);
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
        await page.waitForTimeout(230);
        assert.notEqual(await flow.evaluate(e => getComputedStyle(e).strokeDashoffset), before, `${edge.id}: moving`);
        if (sequence) {
          const sample = await sequenceEdgeSample(page, edge.id), dashed = isDashed(edge, graph.meta.diagramType);
          assert.equal(sample.base.opacity, 1, `${edge.id}: sequence baseline stays opaque`);
          assert.equal(sample.base.dash.length > 0, dashed, `${edge.id}: sequence baseline preserves semantic dashes`);
          assert.ok(sample.flow.width <= sample.base.width && sample.flow.filter === 'none', `${edge.id}: sequence flow remains subordinate`);
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
      const phaseSamples = [], pixelSamples = [];
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
        if (sequence && checked.length) pixelSamples.push({ time, samples: await sequenceFlowPixels(page, checked, `${graph.meta.diagramType}-${colorTheme}-selection-${time}`) });
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
      for (const phase of [0, 600]) {
        await page.locator('.edge-flow').evaluateAll((elements, phase) => {
          for (const element of elements) for (const animation of element.getAnimations()) {
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
          assert.ok(samples.every(sample => sample.flow.width <= sample.base.width && sample.flow.filter === 'none' && sample.base.opacity === 1), `${feature}: sequence notation remains subordinate`);
          media.push(feature);
        }
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
      let negativeGuard = false;
      if (sequence && checked.length) {
        const hidden = await page.addStyleTag({ content: '.sequence-edge-flow { opacity: 0 !important; }' });
        await assert.rejects(() => sequenceFlowPixels(page, checked), /no visible sequence motion/);
        await hidden.evaluate(element => element.remove());
        if (checked.some(edge => edge.dashed)) {
          const unmasked = await page.addStyleTag({ content: '.sequence-edge-flow { mask: none !important; }' });
          await assert.rejects(() => sequenceFlowPixels(page, checked), /paints the semantic dash gaps/);
          await unmasked.evaluate(element => element.remove());
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
      await openMore(page); await menuItem(page, '重置').click(); await assertFlow(page);
    }
    return { playbackRemoved: true, directedEdges: directed.length, flowSwitch: true };
  }, true);
}

async function sequenceReadingChecks(browser, url, graph) {
  // These named-node counterexamples belong only to the explicit synthetic reading fixture.
  if (graph.meta.diagramType !== 'sequence' || graph.meta.sourceRef !== 'Viewer test fixture · no business source evidence') return;
  await runCase(browser, 'sequence-reading', viewports[0], {}, async page => {
    await page.goto(url); await chooseGraph(page, graph, false); await hidePanels(page); await fit(page);
    const redis = graph.nodes.find(node => node.id === 'redis');
    assert.ok(redis, 'The sequence-reading fixture includes Redis.');
    const positions = (await geometry(page)).nodes.map(node => ({ id: node.id, position: node.position }));
    const readingState = id => page.evaluate(id => {
      const rect = element => { const box = element.getBoundingClientRect(); return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height }; };
      const canvas = rect(document.querySelector('.canvas')), toolbar = rect(document.querySelector('.toolbar'));
      const nav = document.querySelector('.nav'), inspector = document.querySelector('.inspector');
      const node = id ? document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`) : null;
      const controls = [...document.querySelectorAll('.react-flow__controls,.react-flow__minimap')].map(rect).filter(box => box.width && box.height);
      const area = { left: nav ? rect(nav).right + 12 : canvas.left + 24, right: inspector ? rect(inspector).left - 12 : canvas.right - 24, top: toolbar.bottom + 12, bottom: Math.min(canvas.bottom - 24, ...controls.map(box => box.top - 12)) };
      return { area, head: node ? rect(node.querySelector('.participant-head,.actor-figure')) : null,
        labels: [...document.querySelectorAll('.edge-label')].map(rect), selected: node?.querySelector('.diagram-node').classList.contains('is-selected') ?? false,
        inspected: document.querySelector('.drawer-body')?.dataset.nodeId, inspectedEdge: document.querySelector('.drawer-body')?.dataset.edgeId };
    }, id);
    const traceZoom = async action => {
      await page.evaluate(() => {
        const viewport = document.querySelector('.react-flow__viewport');
        window.__qaZoomTrace = [new DOMMatrix(getComputedStyle(viewport).transform).a];
        window.__qaZoomObserver = new MutationObserver(() => window.__qaZoomTrace.push(new DOMMatrix(getComputedStyle(viewport).transform).a));
        window.__qaZoomObserver.observe(viewport, { attributes: true, attributeFilter: ['style'] });
      });
      await action(); await page.waitForTimeout(460);
      return page.evaluate(() => { window.__qaZoomObserver.disconnect(); return window.__qaZoomTrace; });
    };
    const outside = (box, area) => box && (box.left < area.left - 1 || box.right > area.right + 1 || box.top < area.top - 1 || box.bottom > area.bottom + 1);
    const issues = [];

    await nav(page, true);
    await page.waitForTimeout(380);
    const navOnly = await readingState();
    if (navOnly.labels.some(box => outside(box, navOnly.area))) issues.push('opening navigation without a selection hides message labels');
    await page.locator('.nav .search-results button').filter({ hasText: redis.label }).click();
    await selection(page, graph, redis.id); await page.locator('.inspector').waitFor(); await page.waitForTimeout(460);
    const reading = await readingState(redis.id);

    await clear(page, 'close'); await hidePanels(page); await fit(page);
    const dotnet = graph.nodes.find(node => node.id === 'dotnet');
    const searchZoom = await traceZoom(() => searchSelect(page, graph, dotnet));
    const searchReading = await readingState(dotnet.id);
    if (searchReading.labels.some(box => outside(box, searchReading.area)) || outside(searchReading.head, searchReading.area)) issues.push('search does not preserve sequence reading context');
    if (Math.max(...searchZoom) > searchZoom[0] + .01) issues.push('search enlarges or uses a second centring target before reveal');

    await clear(page, 'close'); await fit(page);
    const pigeon = graph.nodes.find(node => node.id === 'pigeon');
    const keyboardZoom = await traceZoom(async () => { await nodeElement(page, pigeon.id).focus(); await page.keyboard.press('Enter'); await selection(page, graph, pigeon.id); });
    const keyboardReading = await readingState(pigeon.id);
    if (keyboardReading.labels.some(box => outside(box, keyboardReading.area)) || outside(keyboardReading.head, keyboardReading.area)) issues.push('keyboard locate does not preserve sequence reading context');
    if (Math.max(...keyboardZoom) > keyboardZoom[0] + .01) issues.push('keyboard locate enlarges or uses a second centring target before reveal');
    await clear(page, 'close'); await fit(page); await nodeElement(page, pigeon.id).focus(); await page.keyboard.press('Space'); await selection(page, graph, pigeon.id);

    await hidePanels(page); await fit(page);
    await nodeElement(page, redis.id).locator('.participant-title').click();
    const card = page.locator('.node-card'); await card.waitFor();
    const quickLook = await page.evaluate(() => {
      const head = document.querySelector('.react-flow__node[data-id="redis"] .participant-head').getBoundingClientRect();
      const card = document.querySelector('.node-card').getBoundingClientRect();
      return { below: document.querySelector('.node-card').classList.contains('is-below'), gap: card.top - head.bottom, headBottom: head.bottom, cardTop: card.top };
    });

    const notation = await page.evaluate(() => {
      const read = id => {
        const base = document.getElementById(id), edge = base.closest('.react-flow__edge'), flow = edge.querySelector('.edge-flow');
        const style = getComputedStyle(base), moving = getComputedStyle(flow);
        return { dash: style.strokeDasharray, opacity: Number(style.strokeOpacity), width: parseFloat(style.strokeWidth), flowWidth: parseFloat(moving.strokeWidth), flowFilter: moving.filter };
      };
      return { request: read('m1'), returned: read('m2') };
    });

    await card.getByRole('button', { name: '查看详情', exact: true }).click(); await page.locator('.inspector').waitFor(); await page.waitForTimeout(380);
    await nav(page, true); await page.waitForTimeout(380);
    const doublePanels = await readingState(redis.id);
    if (doublePanels.labels.some(box => outside(box, doublePanels.area))) issues.push('node quick-look handoff does not avoid both panels');
    const beforeClose = await page.locator('.react-flow__viewport').getAttribute('style'); await nav(page, false);
    assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'), beforeClose, 'Closing navigation preserves the sequence viewport.');
    await clear(page, 'close'); await hidePanels(page); await fit(page);
    await page.locator('.react-flow__edge').and(page.locator('[data-id="m2"]')).locator('.react-flow__edge-interaction').dispatchEvent('click');
    const relation = page.locator('.relation-card'); await relation.waitFor(); await page.waitForTimeout(220);
    const relationshipPlacement = await relation.evaluate(card => {
      const box = card.getBoundingClientRect(), label = [...document.querySelectorAll('.edge-label')].find(element => element.textContent.startsWith('02 ·')).getBoundingClientRect();
      const overlaps = element => { const other = element.getBoundingClientRect(); return box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top; };
      return { rightGap: box.left - (label.left + label.width / 2), topGap: box.top - (label.top + label.height / 2),
        headOverlaps: [...document.querySelectorAll('.participant-head,.actor-figure,.participant-title')].filter(overlaps).length,
        lifelineBoxOverlaps: [...document.querySelectorAll('.react-flow__node-diagram')].filter(overlaps).length };
    });
    assert.ok(Math.abs(relationshipPlacement.rightGap - 14) < 1 && Math.abs(relationshipPlacement.topGap) < 1, 'The message quick look stays 14px beside its label anchor.');
    assert.equal(relationshipPlacement.headOverlaps, 0);
    assert.ok(relationshipPlacement.lifelineBoxOverlaps > 0, 'Empty lifeline rectangles do not displace the message quick look.');
    await relation.getByRole('button', { name: '查看详情', exact: true }).click(); await page.locator('.inspector').waitFor(); await page.waitForTimeout(380);
    const relationReading = await readingState();
    if (relationReading.inspectedEdge !== 'm2' || relationReading.labels.some(box => outside(box, relationReading.area))) issues.push('relationship quick-look handoff does not preserve its message and reading context');
    await clear(page, 'close'); await hidePanels(page); await fit(page); await setLocked(page, false);
    const selfBefore = await sequenceEdgeSample(page, 'm7'); await pointerNode(page, graph.nodes.find(node => node.id === 'dotnet'), true);
    const selfAfter = await sequenceEdgeSample(page, 'm7');
    assert.notEqual(selfAfter.base.d, selfBefore.base.d, 'Horizontal participant dragging recomputes the self-call route.');
    assert.equal(selfAfter.mask.path.d, selfAfter.base.d, 'The dashed self-call mask follows the recomputed route.');
    await openMore(page); await menuItem(page, '重置').click(); await hidePanels(page); await fit(page);
    await nodeElement(page, 'java').locator('.participant-title').click(); const actorCard = page.locator('.node-card'); await actorCard.waitFor();
    assert.equal(await actorCard.evaluate(card => {
      const box = card.getBoundingClientRect(), label = document.querySelector('[data-id="java"] .participant-title').getBoundingClientRect();
      return box.left < label.right && box.right > label.left && box.top < label.bottom && box.bottom > label.top;
    }), false, 'The actor quick look does not cover the actor name.');
    await actorCard.getByRole('button', { name: '关闭', exact: true }).click(); await nav(page, true); await page.waitForTimeout(380);
    await nodeElement(page, 'redis').locator('.participant-title').click(); const navCard = page.locator('.node-card'); await navCard.waitFor();
    const navCardBefore = await navCard.boundingBox();
    assert.ok(await navCard.evaluate(card => card.getBoundingClientRect().left >= document.querySelector('.nav').getBoundingClientRect().right + 11), 'The quick look stays outside open navigation.');
    await page.locator('.react-flow__controls-zoomin').click(); await page.waitForTimeout(260); const navCardAfter = await navCard.boundingBox();
    assert.ok(Math.abs(navCardAfter.x - navCardBefore.x) > 1 || Math.abs(navCardAfter.y - navCardBefore.y) > 1, 'The head-anchored quick look follows zoom.');
    await navCard.getByRole('button', { name: '关闭', exact: true }).click(); await nav(page, false); await fit(page);
    await page.screenshot({ path: path.join(outputRoot, 'screens', 'sequence-reading.png'), animations: 'disabled' });

    if (!reading.selected || reading.inspected !== redis.id) issues.push('directory selection and details are inconsistent');
    if (outside(reading.head, reading.area)) issues.push('Redis head is outside the two-panel reading area');
    if (reading.labels.some(box => outside(box, reading.area))) issues.push('one or more message labels are outside the two-panel reading area');
    if (!quickLook.below || Math.abs(quickLook.gap - 14) > 1) issues.push(`Redis quick look is not 14px below its head (${quickLook.gap.toFixed(1)}px)`);
    if (notation.request.dash !== 'none') issues.push('direct request baseline is not solid');
    if (notation.returned.dash === 'none') issues.push('return baseline is not dashed');
    if (notation.request.opacity < .99 || notation.returned.opacity < .99) issues.push('sequence baseline is faded while flow is enabled');
    if (notation.request.flowWidth > notation.request.width + .01 || notation.request.flowFilter !== 'none') issues.push('sequence flow is thicker or glowing over its baseline');
    assert.deepEqual((await geometry(page)).nodes.map(node => ({ id: node.id, position: node.position })), positions, 'Sequence locating preserves authored graph coordinates.');
    assert.deepEqual(issues, [], `Sequence reading regressions after native user actions:\n- ${issues.join('\n- ')}`);
    return { directory: true, panels: true, quickLook, relationshipPlacement, notation };
  }, true);
  await runCase(browser, 'tall-sequence-reading', viewports[0], { reducedMotion: 'reduce' }, async page => {
    const tall = structuredClone(graph);
    tall.nodes.forEach(node => { node.size.height = 1700; });
    const message = tall.edges.find(edge => edge.id === 'm7'); message.target = 'pigeon'; delete message.route;
    assert.deepEqual(validateGraph(tall), []);
    await openFixture(page, tall, viewports[0], url); await fit(page);
    await page.locator('.react-flow__controls-zoomin').click(); await page.waitForTimeout(260);
    await nav(page, true); await page.locator('.nav .search-results button').filter({ hasText: 'Redis' }).click(); await selection(page, tall, 'redis'); await page.locator('.inspector').waitFor();
    const clearance = await page.evaluate(() => {
      const controls = [...document.querySelectorAll('.react-flow__controls,.react-flow__minimap')].map(element => element.getBoundingClientRect()).filter(box => box.width && box.height);
      const lines = [...document.querySelectorAll('.lifeline')].map(element => element.getBoundingClientRect());
      return Math.min(...lines.flatMap(line => controls.map(control => control.top - line.bottom)));
    });
    assert.ok(clearance >= 11.5, `Long lifelines clear visible bottom controls by 12px, actual ${clearance}px.`);
    await page.screenshot({ path: path.join(outputRoot, 'screens', 'tall-sequence-reading.png'), animations: 'disabled' });
    await exportsMatch(page, tall, 'tall-sequence');
    return { lifelineHeight: 1700, bottomControlClearance: clearance };
  }, true);
  await runCase(browser, '390-sequence-reading', viewports[2], {}, async page => {
    await page.goto(url); await chooseGraph(page, graph, true); await hidePanels(page); await fit(page);
    const before = await page.locator('.react-flow__viewport').getAttribute('style');
    await nav(page, true); await page.locator('.nav .search-results button').filter({ hasText: 'Redis' }).click();
    await selection(page, graph, 'redis'); await page.locator('.inspector').waitFor(); await page.locator('.nav').waitFor({ state: 'detached' });
    assert.equal(await count(page, '.nav'), 0, 'Narrow panels remain mutually exclusive.');
    assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'), before, 'Narrow panel opening does not force the sequence smaller.');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'The narrow page has no horizontal overflow.');
    const opened = await page.locator('.react-flow__viewport').getAttribute('style'); await clear(page, 'close');
    assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'), opened, 'Closing the narrow panel preserves the viewport.');
    return { mutuallyExclusive: true, forcedViewport: false, pageOverflow: false };
  }, true);
  await runCase(browser, '200pct-sequence-reading', { width: 720, height: 450 }, { deviceScaleFactor: 2 }, async page => {
    await page.goto(url); await chooseGraph(page, graph, false); await hidePanels(page); await fit(page); await nav(page, true);
    await page.locator('.nav .search-results button').filter({ hasText: 'Redis' }).click(); await selection(page, graph, 'redis'); await page.locator('.inspector').waitFor(); await page.waitForTimeout(460);
    const visible = await page.evaluate(() => {
      const head = document.querySelector('[data-id="redis"] .participant-head').getBoundingClientRect();
      const nav = document.querySelector('.nav').getBoundingClientRect(), drawer = document.querySelector('.inspector').getBoundingClientRect(), toolbar = document.querySelector('.toolbar').getBoundingClientRect();
      return head.left >= nav.right + 11 && head.right <= drawer.left - 11 && head.top >= toolbar.bottom + 11 && document.documentElement.scrollWidth <= innerWidth + 1;
    });
    assert.equal(visible, true, 'At a 200% equivalent CSS viewport, the minimum-zoom fallback prioritizes the selected head without page overflow.');
    return { deviceScaleFactor: 2, selectedHeadVisible: true, pageOverflow: false };
  }, true);
  await runCase(browser, 'reduced-motion-sequence-reading', viewports[0], { reducedMotion: 'reduce' }, async page => {
    await page.goto(url); await chooseGraph(page, graph, false); await hidePanels(page); await fit(page); await nav(page, true);
    await page.locator('.nav .search-results button').filter({ hasText: 'Redis' }).click(); await selection(page, graph, 'redis'); await page.locator('.inspector').waitFor();
    assert.ok(await page.locator('.selection-outline,.selection-outline *,.selection-feedback,.selection-feedback *').evaluateAll(elements => elements.every(element => getComputedStyle(element).animationName === 'none')), 'Reduced motion lands without selection or viewport animation.');
    const visible = await page.evaluate(() => {
      const box = document.querySelector('[data-id="redis"] .participant-head').getBoundingClientRect(), nav = document.querySelector('.nav').getBoundingClientRect(), drawer = document.querySelector('.inspector').getBoundingClientRect();
      return box.left >= nav.right + 11 && box.right <= drawer.left - 11;
    });
    assert.equal(visible, true, 'Reduced motion keeps the same final reading geometry.');
    return { immediate: true, geometryMatches: true };
  }, true);
  await runCase(browser, 'fullscreen-sequence-reading', viewports[0], {}, async page => {
    await page.goto(url); await chooseGraph(page, graph, false); await hidePanels(page); await fit(page); await nav(page, true);
    await page.locator('.nav .search-results button').filter({ hasText: 'Redis' }).click(); await selection(page, graph, 'redis'); await page.locator('.inspector').waitFor();
    await button(page, '进入全屏').click(); await fullscreenState(page, true); await page.waitForTimeout(420);
    assert.ok(await page.locator('.canvas').evaluate(canvas => {
      const bounds = canvas.getBoundingClientRect();
      return [...canvas.querySelectorAll('.edge-label')].every(label => { const box = label.getBoundingClientRect(); return box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom; });
    }), 'Panels outside fullscreen do not reduce its reading area.');
    const fullscreenViewport = await page.locator('.react-flow__viewport').getAttribute('style');
    await button(page, '退出全屏').click(); await fullscreenState(page, false);
    assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'), fullscreenViewport, 'Exiting fullscreen preserves its reading position.');

    await hidePanels(page); await button(page, '进入全屏').click(); await fullscreenState(page, true);
    await nodeElement(page, 'redis').locator('.participant-title').click(); const card = page.locator('.node-card'); await card.waitFor();
    await page.evaluate(() => { window.nativeExitFullscreen = document.exitFullscreen; document.exitFullscreen = () => Promise.reject(new Error('Exit denied')); });
    await card.getByRole('button', { name: '查看详情', exact: true }).click(); await page.waitForFunction(() => /无法退出全屏/.test(document.querySelector('.toast').textContent));
    assert.equal(await card.count(), 1, 'A failed fullscreen exit leaves the original quick look usable.');
    await page.evaluate(() => { document.exitFullscreen = window.nativeExitFullscreen; return document.exitFullscreen(); }); await fullscreenState(page, false);
    return { outsidePanelsIgnored: true, exitPreserved: true, rejectedExitRecovery: true };
  }, true);
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
    const nodeCard = page.locator('.node-card'); await nodeCard.waitFor(); await nodeCard.getByRole('button', { name: '查看详情', exact: true }).click(); await page.locator('.inspector').waitFor();
    await clear(page, 'close');
    if (edge) {
      await page.locator('.react-flow__edge').and(page.locator(`[data-id=${JSON.stringify(edge.id)}]`)).locator('.react-flow__edge-interaction').dispatchEvent('click');
      const relationCard = page.locator('.relation-card'); await relationCard.waitFor(); await relationCard.getByRole('button', { name: '查看详情', exact: true }).click(); await page.locator('.inspector').waitFor();
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
    const shape = node.classList.contains('kind-actor') ? null : node.querySelector('.node-visual .node-surface');
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
    for (const kind of getDiagram(graph.meta.diagramType).nodeKinds) {
      if (!stress.nodes.some(node => node.kind === kind)) stress.nodes.push({ ...structuredClone(stress.nodes[0]), id: `text-${kind}`, kind });
    }
    stress.nodes.forEach((node, index) => {
      node.label = `${index} 节点 ${'WMWM_LongIdentifier_'.repeat(3)}`;
      node.subtitle = '完整职责 LongMixedIdentifier_'.repeat(3);
      node.fields?.forEach(field => { field.name = 'long_field_'.repeat(12); field.type = 'generic_type_'.repeat(12); });
      for (const field of ['attributes', 'methods']) if (node[field]) node[field] = node[field].map(() => 'long_member_identifier_'.repeat(12));
      node.position = { x: 80 + index % 3 * 480, y: 100 + Math.floor(index / 3) * 420 };
      node.size = { width: 360, height: 260 };
      if (['start', 'end'].includes(node.kind)) node.size = { width: 220, height: 64 };
      if (getDiagram(graph.meta.diagramType).cardLayout && index === 0) node.size.height = 80;
    });
    assert.deepEqual(validateGraph(stress), [], 'The overflow stress graph passes the production validator.');
    const uppercase = structuredClone(graph);
    uppercase.edges.forEach(edge => { edge.label = 'FOUND_VALUE FOUND_NULL KEY_NOT_EXIST（不回填）'; });
    uppercase.groups?.forEach(group => { group.label = '完整边界 LongMixedIdentifier_'.repeat(20); });
    for (const fixture of [graph, stress, uppercase]) {
      await openFixture(page, fixture, viewports[0], url);
      await searchSelect(page, fixture, target(fixture)); await hidePanels(page); await clear(page);
      for (const clicks of [0, 4, 2]) {
        for (let i = 0; i < clicks; i++) await page.locator('.react-flow__controls-zoomout').click();
        await page.waitForTimeout(300); await assertTextBounds(page);
      }
      await page.screenshot({ path: path.join(outputRoot, 'screens', `${graph.meta.diagramType}-${fixture === graph ? 'authored' : fixture === stress ? 'long' : 'uppercase-edge'}-text.png`), animations: 'disabled' });
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
      assert.deepEqual(await assertLegendLayout(page), anchor, 'The inspector does not move the legend button.');
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

async function fullscreenState(page, active) {
  await page.waitForFunction(active => (document.fullscreenElement === document.querySelector('.diagram-board')) === active, active);
  const control = button(page, active ? '退出全屏' : '进入全屏');
  await control.waitFor();
  await page.waitForFunction(() => document.querySelector('.react-flow__controls-fullscreen')?.getAttribute('aria-busy') !== 'true');
  assert.equal(await control.getAttribute('aria-pressed'), String(active));
  if (active) await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (!active) assert.ok(await control.evaluate(element => element === document.activeElement), 'Exiting fullscreen returns focus to its button.');
}
async function fullscreenChecks(browser, url, graph) {
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
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const url = `http://127.0.0.1:${server.address().port}/`;
  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? (fs.existsSync(macChrome) ? macChrome : undefined), headless: process.env.QA_HEADED !== '1' });
  if (filtered.length && process.env.QA_EXTRAS !== 'none') await fullscreenChecks(browser, url, filtered[0]);
  if (filtered.length && process.env.QA_EXTRAS !== 'none') await mobileEditingCheck(browser, url, filtered[0]);
  if (filtered.length && process.env.QA_EXTRAS !== 'none') await editPersistenceChecks(browser, url);
  if (filtered.length && process.env.QA_EXTRAS !== 'none') await relationshipCardAvoidanceCheck(browser, url);
  const layoutGraph = filtered.find(graph => graph.meta.diagramType === 'state' && graph.nodes.length >= 4) ?? filtered.find(graph => graph.nodes.length >= 4);
  if (layoutGraph && process.env.QA_EXTRAS !== 'none') await informationLayoutChecks(browser, url, layoutGraph);
  if (!process.env.QA_ONLY_EXTRAS) await Promise.all(viewports.map(async viewport => { for (const colorTheme of ['light', 'dark']) for (const graph of filtered) await matrix(browser, url, graph, viewport, colorTheme); }));
  if (process.env.QA_EXTRAS !== 'none') for (const graph of filtered) await sequenceReadingChecks(browser, url, graph);
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
} catch (error) { report.failures.push({ name: 'fatal', message: error.message, stack: error.stack }); console.error(error); }
finally {
  if (browser) { await browser.close(); report.browserClosed = true; }
  if (server.listening) await new Promise(resolve => server.close(resolve)); report.serverClosed = true;
  report.finishedAt = new Date().toISOString();
  report.summary = { scenes: report.cases.length, passed: report.cases.filter(value => value.passed).length, extras: report.extra.length, extraPassed: report.extra.filter(value => value.passed).length, exports: report.exports.length * 2, failures: report.failures.length };
  writeReport(); console.log(JSON.stringify(report.summary)); if (report.failures.length) process.exitCode = 1;
}
