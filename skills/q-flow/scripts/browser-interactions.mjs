#!/usr/bin/env node
// Replays the production Viewer contract. Uses an existing Playwright installation.
// Usage: node browser-interactions.mjs GENERATED_DIRECTORY REPORT_DIRECTORY
// Optional: PLAYWRIGHT_MODULE, CHROME_PATH, QA_HEADED=1, QA_TYPES, QA_ONLY_EXTRAS=1, QA_EXTRAS=none|selection-entrypoints|playback-flow|flow-contrast|inspector-sync|information-layout|facts-layout|fullscreen|fullscreen-errors, QA_FIXTURE_DIR.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { playbackPlan } from '../assets/viewer/src/playback.js';
import { graphLegend } from '../assets/viewer/src/legend.js';
import { renderNode } from '../assets/viewer/src/node-svg.js';
import { PALETTES, TYPOGRAPHY, isCore } from '../assets/viewer/src/visual-style.js';
import { diagramLabels as labels, getDiagram, hasArrow } from '../assets/viewer/src/diagrams/registry.js';

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
const core = graph => graph.nodes.find(node => node.kind === 'business' || node.tags?.some(tag => ['core', 'business'].includes(tag.trim().toLowerCase())));
const target = graph => core(graph) ?? graph.nodes[0];
const nodeElement = (page, id) => page.locator('.react-flow__node-diagram').and(page.locator(`[data-id=${JSON.stringify(id)}]`));
const status = page => page.locator('.board-foot [role="status"]').innerText();
const currentStep = page => page.locator('.status-pill').innerText().then(text => text.match(/\d+\/\d+/)?.[0] ?? null);
async function toolbar(page, open) {
  const toggle = button(page, open ? '显示左侧工具栏' : '隐藏左侧工具栏');
  if (await toggle.count()) await toggle.click();
  await page.locator('.toolbar').waitFor({ state: open ? 'visible' : 'detached' });
}
async function hidePanels(page) {
  if (await count(page, '.toolbar')) await toolbar(page, false);
  if (await count(page, '.inspector')) {
    const close = button(page, '隐藏右侧详情栏');
    if (await close.count()) await close.click();
    await page.locator('.inspector').waitFor({ state: 'detached' });
  }
}
async function chooseGraph(page, graph, mobile) {
  if (graphs.length > 1) {
    await toolbar(page, true);
    assert.equal(await count(page, '.tabs .tab'), graphs.length);
    await page.locator('.tabs .tab').filter({ hasText: labels[graph.meta.diagramType] }).click();
  }
  await page.locator('.board-head h2').filter({ hasText: labels[graph.meta.diagramType] }).waitFor();
  await page.waitForFunction(ids => ids.every(id => document.getElementById(id)?.classList.contains('react-flow__edge-path')), graph.edges.map(edge => edge.id));
  assert.equal(await count(page, '.diagram-node'), graph.nodes.length);
  if (mobile && graphs.length > 1) await page.locator('.toolbar').waitFor({ state: 'detached' });
  return assertBrand(page, graph);
}
async function assertBrand(page, graph) {
  const documentTitle = `${graph.meta.title} · QGraphFlow`;
  await page.waitForFunction(title => document.title === title, documentTitle);
  const brand = page.locator('.heading .eyebrow');
  assert.equal(await brand.innerText(), 'QGraphFlow');
  const textTransform = await brand.evaluate(element => getComputedStyle(element).textTransform);
  assert.equal(textTransform, 'none', 'Product capitalization is preserved.');
  assert.equal(await count(page, '.react-flow__attribution'), 0, 'The public hideAttribution option removes the canvas attribution.');
  const mark = page.locator('.brand svg');
  assert.ok(await mark.isVisible(), 'The brand mark is visible.');
  assert.ok(await mark.evaluate(svg => {
    const bounds = svg.getBBox(), view = svg.viewBox.baseVal;
    const padding = Number.parseFloat(getComputedStyle(svg).strokeWidth) / 2;
    return bounds.x - padding >= view.x && bounds.y - padding >= view.y && bounds.x + bounds.width + padding <= view.x + view.width && bounds.y + bounds.height + padding <= view.y + view.height;
  }), 'The brand mark and its stroke fit inside the SVG viewport.');
  const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
  assert.match(favicon, /^data:image\/svg\+xml,/, 'Favicon is an offline SVG.');
  const dimensions = await page.evaluate(async source => {
    const icon = new Image(); icon.src = source; await icon.decode();
    return { width: icon.naturalWidth, height: icon.naturalHeight };
  }, favicon);
  assert.ok(dimensions.width > 0 && dimensions.height > 0, 'Favicon decodes successfully.');
  return { product: 'QGraphFlow', documentTitle, textTransform, favicon: { inline: true, decoded: true, ...dimensions } };
}
async function theme(page, value) {
  if (await page.locator('html').getAttribute('data-theme') !== value) await button(page, value === 'dark' ? '深色' : '浅色').click();
  await page.waitForFunction(value => document.documentElement.dataset.theme === value, value);
}
async function fit(page) { await button(page, '适应窗口').click(); await page.waitForTimeout(360); }
async function playing(page, value) {
  const action = button(page, value ? '▶ 播放' : 'Ⅱ 暂停');
  if (await action.count()) await action.click();
  assert.equal(await button(page, value ? 'Ⅱ 暂停' : '▶ 播放').count(), 1, 'Step play/pause is independently available.');
  await assertFlow(page);
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
  assert.ok(await page.locator('.edge-flow').evaluateAll((elements, running) => elements.every(element => getComputedStyle(element).animationPlayState === (running ? 'running' : 'paused')), running), 'Step pause must not change ambient edge flow.');
}
async function assertPaused(page, step = undefined) {
  assert.equal(await button(page, 'Ⅱ 暂停').count(), 0, 'User selection pauses presentation.');
  await assertFlow(page);
  if (step !== undefined) assert.equal(await currentStep(page), step, 'Selection preserves the current step.');
}
async function assertInspector(page, node) {
  assert.ok(node, 'The demonstration step resolves to a real graph node.');
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
  assert.equal(await count(page, '.legend'), 1, 'There is one reading legend.');
  assert.equal(await count(page, '.board-head > .legend'), 1, 'The reading legend is directly below the diagram title.');
  assert.equal(await count(page, '.inspector .legend,.canvas .legend,.board-head p'), 0, 'No old subtitle or duplicate legend remains.');
  const bounds = await page.getByRole('group', { name: '阅读图例', exact: true }).evaluate(element => {
    const box = element.getBoundingClientRect(), head = element.closest('.board-head'), title = head.querySelector('h2').getBoundingClientRect();
    const canvas = head.nextElementSibling.getBoundingClientRect(), style = getComputedStyle(element);
    const overlaps = [...document.querySelectorAll('.react-flow__controls,.react-flow__minimap,.flow-hud')].filter(control => {
      const b = control.getBoundingClientRect();
      return b.width && b.height && box.left < b.right && box.right > b.left && box.top < b.bottom && box.bottom > b.top;
    }).map(control => control.className);
    return { x: box.left - title.left, y: box.top - title.bottom, right: head.getBoundingClientRect().right - box.right, gapToCanvas: canvas.top - box.bottom,
      fontSize: getComputedStyle(element.querySelector('span')).fontSize, overlaps, canvasHeight: canvas.height,
      plain: style.position === 'static' && style.boxShadow === 'none' && style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.borderTopWidth === '0px',
      clipped: [...element.querySelectorAll('span')].some(item => { const b = item.getBoundingClientRect(); return b.left < box.left - 1 || b.right > box.right + 1 || b.bottom > box.bottom + 1; }),
      overflow: element.scrollWidth > element.clientWidth + 1, pageOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  assert.ok(Math.abs(bounds.x) <= 1 && bounds.y >= 4 && bounds.y <= 12, `Legend follows and aligns with the diagram title: ${JSON.stringify(bounds)}`);
  assert.ok(bounds.right >= 0 && bounds.gapToCanvas >= 0 && bounds.canvasHeight > 0, 'Legend stays above a visible canvas.');
  assert.ok(bounds.plain && !bounds.clipped, 'All legend entries are readable as plain inline content, without a card or clipping.');
  assert.deepEqual(bounds.overlaps, [], 'Legend does not cover canvas controls or step status.');
  assert.equal(bounds.overflow || bounds.pageOverflow, false, 'Legend text wraps without horizontal overflow.');
  return { x: bounds.x, y: bounds.y, fontSize: bounds.fontSize };
}
async function searchSelect(page, graph, selected, keyboard = false) {
  await toolbar(page, true);
  await page.locator('#search').fill(`  ${selected.label.toUpperCase()}  `);
  const result = page.locator('.search-results button').first();
  await page.waitForFunction(label => document.querySelector('.search-results button')?.textContent.includes(label), selected.label);
  assert.ok((await result.innerText()).includes(selected.label));
  await result.evaluate(element => {
    window.__qaStepAtActivation = undefined;
    element.addEventListener('click', () => { window.__qaStepAtActivation = document.querySelector('.status-pill')?.textContent.match(/\d+\/\d+/)?.[0] ?? null; }, { once: true, capture: true });
  });
  if (keyboard) { await result.focus(); await page.keyboard.press('Enter'); } else await result.click();
  const step = await page.evaluate(() => window.__qaStepAtActivation);
  assert.notEqual(step, undefined, 'Search selection reaches the native button activation.');
  await selection(page, graph, selected.id);
  if (page.viewportSize().width <= 700) await page.locator('.toolbar').waitFor({ state: 'detached' });
  await assertPaused(page, step);
  await assertInspector(page, selected);
  assert.ok(await page.locator('.inspector').evaluate(element => element.scrollWidth <= element.clientWidth + 1));
}
async function assertSelectedDetails(page, graph) {
  const id = await page.locator('.diagram-node.is-selected').evaluate(e => e.closest('[data-id]').dataset.id);
  if (!await count(page, '.inspector')) await button(page, '显示右侧详情栏').click();
  await assertInspector(page, graph.nodes.find(node => node.id === id));
}
async function clear(page, method = 'Escape') {
  if (method === 'Escape') await page.keyboard.press('Escape');
  else if (method === 'close') await button(page, '关闭详情').click();
  else {
    const point = await page.locator('.react-flow__pane').evaluate(pane => {
      const box = pane.getBoundingClientRect();
      return [.05, .5, .95].flatMap(y => [.05, .5, .95].map(x => ({ x: box.x + box.width * x, y: box.y + box.height * y })))
        .find(({ x, y }) => document.elementFromPoint(x, y) === pane);
    });
    assert.ok(point, 'An uncovered blank canvas point is available for clearing selection.');
    await page.mouse.click(point.x, point.y);
  }
  await page.waitForFunction(() => !document.querySelector('.selection-outline,.selection-edge-shine,.diagram-node.is-selected'));
  await assertPaused(page);
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
  const palette = PALETTES[colorTheme];
  for (const node of graph.nodes) {
    const expected = renderNode(node, graph.meta.diagramType, -node.position.x, -node.position.y, palette);
    const same = await nodeElement(page, node.id).locator('.node-drawing').evaluate((element, xml) => {
      const expected = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${xml}</svg>`, 'image/svg+xml').querySelector('.node-drawing');
      // Compare parsed DOMs: serialization differences must not hide drawing differences.
      const tree = node => ({ tag: node.localName, attrs: [...node.attributes].filter(a => a.name !== 'xmlns').map(a => [a.name, a.value]).sort(), text: [...node.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(''), children: [...node.children].map(tree) });
      return JSON.stringify(tree(element)) === JSON.stringify(tree(expected));
    }, expected);
    assert.ok(same, `Page node ${node.id} uses the exact shared export drawing.`);
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
  const pending = page.waitForEvent('download'); await button(page, format).click(); const result = await pending;
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
  assert.ok(!/selection-outline|selection-edge-|playback-feedback|playback-outline/.test(svg), 'Exports omit transient selection and playback feedback.');
  assert.match(svg, /MIT License/); assert.match(svg, /WorkOS/);
  const parsed = await page.evaluate(async xml => {
    const document = new DOMParser().parseFromString(xml, 'image/svg+xml');
    if (document.querySelector('parsererror')) throw Error('Invalid SVG XML');
    const root = document.documentElement;
    const paths = [...root.children].filter(element => element.tagName === 'g' && element.firstElementChild?.tagName === 'path' && element.firstElementChild.getAttribute('stroke-width') === '1.5' && element.firstElementChild.getAttribute('fill') === 'none').map(element => element.firstElementChild.getAttribute('d'));
    const image = new Image(); image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml); await image.decode();
    return { title: document.querySelector('title')?.textContent, width: image.naturalWidth, height: image.naturalHeight, paths };
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
  report.exports.push({ name, svg: svgFile, png: pngFile, ...pngSize, pathParity: true, decoded: true });
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
    if (mobile) { assert.equal(await count(page, '.toolbar'), 0); assert.equal(await count(page, '.inspector'), 0); }
    await theme(page, colorTheme); const branding = await chooseGraph(page, graph, mobile);
    await assertLegendLayout(page);
    await assertNodeDrawing(page, graph, colorTheme);
    await playing(page, false);
    await toolbar(page, true);
    assert.equal(await page.locator('.playback-controls').getAttribute('data-playback-mode'), playbackPlan(graph).mode);
    assert.equal(await page.locator('.playback-notice').innerText(), playbackPlan(graph).description);
    if (!await count(page, '.inspector')) await button(page, '显示右侧详情栏').click();
    const legend = graphLegend(graph, PALETTES[colorTheme]);
    const actualLegend = await page.locator('.legend span').evaluateAll(elements => elements.map(element => ({ text: element.textContent, fill: element.querySelector('i').style.backgroundColor, border: element.querySelector('i').style.borderColor, symbol: element.firstElementChild.className, lineStyle: getComputedStyle(element.firstElementChild).borderTopStyle })));
    const rgb = color => color ? `rgb(${color.slice(1).match(/../g).map(value => parseInt(value, 16)).join(', ')})` : 'transparent';
    assert.deepEqual(actualLegend, legend.map(entry => ({ text: entry.label, fill: rgb(entry.fill), border: rgb(entry.stroke), symbol: `legend-${entry.shape}`, lineStyle: entry.shape === 'dashed' ? 'dashed' : 'solid' })), 'Each legend label retains its original leading symbol, line style and theme colors.');
    const initial = core(graph);
    assert.equal(await count(page, '.diagram-node.is-selected'), initial ? 1 : 0);
    if (initial) {
      await selection(page, graph, initial.id); assert.equal(await pulse(page), 0);
      assert.ok(await page.locator('.selection-outline .selection-node-shine,.selection-edge-shine').evaluateAll(elements => elements.every(element => getComputedStyle(element).animationName === 'none')), 'Initial core emphasis is static.');
    }
    assert.ok(await page.locator('.edge-flow').evaluateAll(elements => elements.every(element => getComputedStyle(element).animationPlayState === 'running')), 'Initial core selection does not pause flow.');
    const plan = playbackPlan(graph);
    for (let index = 0; index < plan.steps.length; index++) {
      await toolbar(page, true);
      if (mobile) await page.locator('.inspector').waitFor({ state: 'detached' });
      await button(page, '下一步 →').click();
      assert.ok(await page.evaluate(() => document.activeElement?.textContent === '下一步 →'), 'Stepping retains button focus.');
      if (mobile) assert.equal(await count(page, '.inspector'), 0, 'A step does not open the mobile Inspector.');
      if (!await count(page, '.inspector')) await button(page, '显示右侧详情栏').click();
      const stepIndex = Number((await currentStep(page)).split('/')[0]) - 1;
      await assertInspector(page, graph.nodes.find(n => n.id === plan.steps[stepIndex].nodeId));
    }
    await toolbar(page, true);
    const lockedPositions = await geometry(page);
    const spacing = button(page, '整理间距'); assert.equal(await spacing.getAttribute('aria-disabled'), 'true'); assert.equal(await spacing.evaluate(element => element.disabled), false);
    await spacing.click({ force: true }); assert.match(await status(page), /请先解除布局锁定/);
    assert.deepEqual(await geometry(page), lockedPositions, 'Locked spacing does not change geometry.');
    await spacing.focus(); await page.keyboard.press('Enter'); assert.match(await status(page), /请先解除布局锁定/);
    await searchSelect(page, graph, target(graph));
    if (mobile) assert.equal(await count(page, '.toolbar'), 0, 'Mobile panels remain mutually exclusive.');
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
    if (mobile) await page.locator('.inspector').waitFor({ state: 'detached' });
    await toolbar(page, true); await page.locator('#search').fill('no-such-node-qa'); assert.equal(await count(page, '.search-results button'), 0);
    const panelsBeforeReset = await page.locator('.panel-switcher button').evaluateAll(elements => elements.map(element => element.getAttribute('aria-expanded')));
    await button(page, '重置').click();
    assert.deepEqual(await page.locator('.panel-switcher button').evaluateAll(elements => elements.map(element => element.getAttribute('aria-expanded'))), panelsBeforeReset, 'Reset preserves panel preferences.');
    await page.waitForFunction(() => !document.querySelector('.diagram-node.is-selected'));
    assert.equal(await page.locator('#search').inputValue(), ''); assert.equal(await spacing.getAttribute('aria-disabled'), 'true');
    assert.equal(await page.locator('html').getAttribute('data-theme'), colorTheme);
    assert.ok(!/请先|布局已调整|整理.*移动/.test(await status(page)), 'Reset clears stale spacing status.');
    assert.equal(await currentStep(page), `1/${playbackPlan(graph).steps.length}`);
    await playing(page, false); await fit(page);
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
  const point = await (await shape.count() ? shape : element).evaluate(element => {
    const box = element.getBoundingClientRect();
    return [[.5, .5], [.9, .5], [.1, .5], [.5, .9], [.5, .1]]
      .map(([x, y]) => ({ x: box.x + box.width * x, y: box.y + box.height * y }))
      .find(({ x, y }) => element.contains(document.elementFromPoint(x, y)));
  });
  assert.ok(point, `Node ${node.id} exposes a pointer target outside canvas overlays.`);
  const { x, y } = point;
  await page.mouse.move(x, y); await page.mouse.down();
  if (drag) await page.mouse.move(x + 36, y + 22, { steps: 8 });
  await page.mouse.up();
}
async function entrypoints(browser, url, graph) {
  await runCase(browser, `${graph.meta.diagramType}-selection-entrypoints`, viewports[0], {}, async page => {
    await page.goto(url); await chooseGraph(page, graph, false); await playing(page, false); await hidePanels(page); await fit(page);
    const legendAnchor = await assertLegendLayout(page);
    const selected = target(graph);
    await playing(page, true); const beforeStep = await currentStep(page); await pointerNode(page, selected);
    await selection(page, graph, selected.id); await assertPaused(page, beforeStep); await assertSelectedDetails(page, graph); assert.equal(await pulse(page), 1);
    await page.waitForTimeout(480); const oldPulse = await pulse(page); await fit(page); await playing(page, true); await pointerNode(page, selected);
    await selection(page, graph, selected.id); await assertPaused(page); await assertSelectedDetails(page, graph); assert.equal(await pulse(page), oldPulse + 1, 'Clicking an already selected node replays once.');
    await page.waitForTimeout(480); await clear(page); await hidePanels(page); await fit(page);
    const keyboardNode = graph.nodes.find(node => node.id !== selected.id) ?? selected;
    await playing(page, true); const step = await currentStep(page); await nodeElement(page, keyboardNode.id).focus(); await page.keyboard.press('Enter');
    await selection(page, graph, keyboardNode.id); await assertPaused(page, step); await assertSelectedDetails(page, graph); assert.equal(await pulse(page), oldPulse + 2);
    await clear(page); await playing(page, true); const spaceStep = await currentStep(page);
    await nodeElement(page, keyboardNode.id).focus(); await page.keyboard.press('Space');
    await selection(page, graph, keyboardNode.id); await assertPaused(page, spaceStep); await assertSelectedDetails(page, graph); assert.equal(await pulse(page), oldPulse + 3, 'Space produces one selection pulse.');
    await clear(page); await playing(page, true); await searchSelect(page, graph, selected, true);
    const searchPulse = await pulse(page); await clear(page); if (playbackPlan(graph).steps.length) assert.ok(await button(page, '▶ 播放').count());
    await hidePanels(page); await fit(page); await button(page, '布局锁定').click();
    const geometryBeforeDrag = await geometry(page); await playing(page, true); const dragStep = await currentStep(page); await pointerNode(page, selected, true);
    await selection(page, graph, selected.id); await assertPaused(page, dragStep); assert.equal(await count(page, '.inspector'), 0); await assertSelectedDetails(page, graph); assert.equal(await pulse(page), searchPulse + 1, 'Dragging selects once.');
    assert.notDeepEqual((await geometry(page)).nodes, geometryBeforeDrag.nodes, 'Unlocked drag moves a node.');
    await selection(page, graph, selected.id); await exportsMatch(page, graph, `${graph.meta.diagramType}-dragged`);
    await button(page, '整理间距').click(); const spacingStatus = await status(page);
    assert.match(spacingStatus, /移动 \d+ 个节点|当前间距无需调整|仍有.*(?:问题|手动)/);
    await button(page, '重置').click(); await playing(page, false); await hidePanels(page); await fit(page);
    const authored = await geometry(page);
    for (const node of graph.nodes) assert.deepEqual(authored.nodes.find(value => value.id === node.id).position, node.position, 'Reset restores authored positions.');
    assert.equal(await button(page, '可拖动').count(), 1, 'Reset preserves lock preference.');
    if (graph.edges.length) {
      await playing(page, true); const edgeStep = await currentStep(page);
      const edge = page.locator('.react-flow__edge').first();
      // SVG interaction paths are deliberate transparent hit targets; dispatch exercises React's edge handler.
      await edge.locator('.react-flow__edge-interaction').dispatchEvent('click');
      await assertPaused(page, edgeStep);
      const detailCount = await count(page, '.drawer-body h2'); await playing(page, true);
      await edge.focus(); await page.keyboard.press('Enter'); await assertPaused(page, edgeStep);
      assert.equal(await count(page, '.drawer-body h2'), detailCount, 'Edge keyboard selection does not invent node details.');
    }
    const viewport = page.locator('.react-flow__viewport');
    const beforeZoom = await viewport.evaluate(element => new DOMMatrix(getComputedStyle(element).transform).a);
    const zoomIn = page.locator('.react-flow__controls-zoomin'), zoomOut = page.locator('.react-flow__controls-zoomout');
    const zoomingIn = await zoomIn.isEnabled(), zoomControl = zoomingIn ? zoomIn : zoomOut;
    assert.ok(await zoomControl.isEnabled(), 'At least one zoom direction remains available.');
    const zoomStep = await currentStep(page), zoomDetails = await count(page, '.drawer-body h2');
    await zoomControl.click(); await page.waitForTimeout(220);
    const afterZoom = await viewport.evaluate(element => new DOMMatrix(getComputedStyle(element).transform).a);
    assert.ok(zoomingIn ? afterZoom > beforeZoom : afterZoom < beforeZoom, 'An enabled zoom control changes scale in its direction.');
    assert.deepEqual(await assertLegendLayout(page), legendAnchor, 'Zoom does not move or resize the legend.');
    assert.equal(await currentStep(page), zoomStep); assert.equal(await count(page, '.drawer-body h2'), zoomDetails); await assertPaused(page);
    await fit(page);
    const beforePan = await viewport.getAttribute('style'); const canvas = await page.locator('.canvas').boundingBox();
    await page.mouse.move(canvas.x + 5, canvas.y + 8); await page.mouse.down(); await page.mouse.move(canvas.x + 45, canvas.y + 33, { steps: 8 }); await page.mouse.up();
    assert.notEqual(await viewport.getAttribute('style'), beforePan, 'Dragging empty canvas pans the viewport.');
    assert.deepEqual(await assertLegendLayout(page), legendAnchor, 'Pan does not move or resize the legend.');
    await fit(page); const beforeMap = await viewport.getAttribute('style'); const minimap = await page.locator('.react-flow__minimap').boundingBox();
    await page.mouse.move(minimap.x + minimap.width * .55, minimap.y + minimap.height * .45); await page.mouse.down(); await page.mouse.move(minimap.x + minimap.width * .7, minimap.y + minimap.height * .6, { steps: 8 }); await page.mouse.up();
    assert.notEqual(await viewport.getAttribute('style'), beforeMap, 'Dragging the minimap navigates the canvas.');
    await button(page, '适应画布').click(); await page.waitForTimeout(360);
    if (playbackPlan(graph).steps.length > 1) {
      await toolbar(page, true); await button(page, '下一步 →').click();
      const step = await currentStep(page); const completed = await page.locator('.diagram-node.is-complete').evaluateAll(elements => elements.map(element => element.closest('[data-id]').dataset.id));
      await searchSelect(page, graph, selected); await page.waitForTimeout(1950); await assertPaused(page, step);
      assert.deepEqual(await page.locator('.diagram-node.is-complete').evaluateAll(elements => elements.map(element => element.closest('[data-id]').dataset.id)), completed);
      await playing(page, true); await page.waitForTimeout(1200); assert.equal(await currentStep(page), step, 'Resume restarts the 1.8-second interval.');
      await page.waitForFunction(step => document.querySelector('.status-pill').textContent.match(/\d+\/\d+/)?.[0] !== step, step, { timeout: 1100 }); await playing(page, false);
    }
    await searchSelect(page, graph, selected); await clear(page, 'pane');
    await page.keyboard.press('Backspace'); await page.keyboard.press('Delete'); assert.equal(await count(page, '.diagram-node'), graph.nodes.length);
    return { type: graph.meta.diagramType, pointer: true, repeated: true, keyboard: ['Enter', 'Space'], search: true, drag: true, edge: true, edgeKeyboard: true, panZoomMinimap: true, spacingStatus, resume: playbackPlan(graph).steps.length > 1 };
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

async function flowContrastChecks(browser, url, graph) {
  for (const colorTheme of ['light', 'dark']) {
    await runCase(browser, `${graph.meta.diagramType}-${colorTheme}-flow-contrast`, viewports[0], {}, async page => {
      await page.goto(url); await chooseGraph(page, graph, false);
      await playing(page, false); await theme(page, colorTheme);
      const selected = target(graph); await searchSelect(page, graph, selected);
      await page.waitForTimeout(800);
      const stable = await geometry(page);
      const linked = graph.edges.filter(e => e.source === selected.id || e.target === selected.id);
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
        const ratio = await edgeContrast(page, edge.id);
        assert.ok(ratio >= 0.6, `${edge.id}: selected flow contrast ${ratio.toFixed(3)} is below 60% of reference`);
        checked.push({ id: edge.id, ratio });
      }
      assert.equal(checked.length, directedLinked.length, 'Every expected directed incident edge has a checked flow path.');
      assert.deepEqual(await geometry(page), stable);
      await toolbar(page, true);
      const plan = playbackPlan(graph);
      const directedPlayback = plan.steps
        .filter(step => step.edgeId)
        .filter(step => hasArrow(graph.edges.find(edge => edge.id === step.edgeId), graph.meta.diagramType));
      const currentChecked = [];
      for (let index = 0; index < plan.steps.length; index++) {
        const stepIndex = Number((await currentStep(page)).split('/')[0]) - 1;
        const edgeId = plan.steps[stepIndex].edgeId;
        const edge = edgeId && graph.edges.find(value => value.id === edgeId);
        if (edge && hasArrow(edge, graph.meta.diagramType)) {
          const flow = page.locator('.react-flow__edge').and(page.locator(`[data-id=${JSON.stringify(edgeId)}]`)).locator('.edge-flow');
          assert.equal(await flow.count(), 1, `${edgeId}: expected one current playback flow path`);
          const ratio = await edgeContrast(page, edgeId);
          assert.ok(ratio >= 0.6, `Current step flow: ${edgeId}`);
          currentChecked.push({ id: edgeId, ratio });
        }
        await button(page, '下一步 →').click();
      }
      assert.equal(currentChecked.length, directedPlayback.length, 'Every expected directed playback edge has a checked current flow path.');
      await searchSelect(page, graph, selected);
      const phaseSamples = [];
      for (const time of [0, 182, 334, 479, 608, 760]) {
        await page.locator('.selection-feedback').evaluateAll((elements, time) => {
          for (const animation of new Set(elements.flatMap(e => e.getAnimations({ subtree: true })))) {
            animation.pause(); animation.currentTime = time;
          }
        }, time);
        await page.evaluate(() => new Promise(requestAnimationFrame));
        for (const { id } of checked) {
          const sample = await edgeContrast(page, id, true);
          phaseSamples.push({ id, time, ...sample });
          assert.ok(sample.ratio >= 0.6, `${id} at ${time}ms: ${JSON.stringify(sample)}`);
        }
        assert.deepEqual(await geometry(page), stable);
      }
      await page.locator('.selection-feedback').evaluateAll(elements => {
        for (const animation of new Set(elements.flatMap(e => e.getAnimations({ subtree: true })))) animation.finish();
      });
      for (const phase of [0, 600]) {
        await page.locator('.edge-flow').evaluateAll((elements, phase) => {
          for (const element of elements) for (const animation of element.getAnimations()) {
            animation.pause(); animation.currentTime = phase;
          }
        }, phase);
        await page.screenshot({ path: path.join(outputRoot, 'screens', `${graph.meta.diagramType}-${colorTheme}-flow-${phase}.png`), animations: 'allow' });
      }
      let negativeGuard = false;
      if (directedLinked.length) {
        const edgeId = directedLinked[0].id;
        await page.locator('.react-flow__edge').and(page.locator(`[data-id=${JSON.stringify(edgeId)}]`)).locator('.edge-flow').evaluate(element => element.remove());
        await assert.rejects(async () => {
          const flow = page.locator('.react-flow__edge').and(page.locator(`[data-id=${JSON.stringify(edgeId)}]`)).locator('.edge-flow');
          assert.equal(await flow.count(), 1, `${edgeId}: expected one rendered flow path`);
        }, /expected one rendered flow path/);
        negativeGuard = true;
      }
      return { theme: colorTheme, checked, phaseSamples, expectedDirected: directedLinked.length, currentChecked, expectedCurrent: directedPlayback.length, negativeGuard, staticRelations: linked.length - checked.length };
    }, true);
  }
}

async function inspectorChecks(browser, url, graph) {
  await runCase(browser, `${graph.meta.diagramType}-inspector-sync`, viewports[0], {}, async page => {
    await page.goto(url); await chooseGraph(page, graph, false); await playing(page, false);
    await toolbar(page, true);
    if (!await count(page, '.inspector')) await button(page, '显示右侧详情栏').click();
    const plan = playbackPlan(graph);
    const current = async () => {
      const index = Number((await currentStep(page)).split('/')[0]) - 1;
      return graph.nodes.find(n => n.id === plan.steps[index].nodeId);
    };
    // Includes initial content and all steps; no assumption that the first node is the core.
    if (plan.steps.length > 1) await assertInspector(page, await current());
    else if (core(graph)) await assertInspector(page, core(graph));
    else assert.equal(await count(page, '.drawer-body h2'), 0);
    for (let i = 0; i < plan.steps.length; i++) {
      await button(page, '下一步 →').click();
      await assertPaused(page); await assertInspector(page, await current());
      assert.equal(await page.locator('.diagram-node.is-current').evaluate(e => e.closest('[data-id]').dataset.id), (await current()).id);
    }
    await button(page, '← 上一步').click(); await assertInspector(page, await current());
    const manual = graph.nodes.find(n => n.id !== plan.steps[0].nodeId) ?? graph.nodes[0];
    await searchSelect(page, graph, manual); await assertInspector(page, manual);
    const held = await currentStep(page);
    await page.waitForTimeout(1950); await assertPaused(page, held); await assertInspector(page, manual);
    await playing(page, true); await assertInspector(page, await current());
    if (plan.steps.length > 1) {
      await page.waitForTimeout(1100); assert.equal(await currentStep(page), held);
      await page.waitForFunction(held => document.querySelector('.status-pill').textContent.match(/\d+\/\d+/)?.[0] !== held, held, { timeout: 1400 });
    }
    await playing(page, false); await assertInspector(page, await current());
    await searchSelect(page, graph, manual);
    await toolbar(page, true); await button(page, '下一步 →').click();
    await assertPaused(page); await assertInspector(page, await current());
    await clear(page); assert.equal(await count(page, '.drawer-body h2'), 0);
    await playing(page, true); await assertInspector(page, await current()); await playing(page, false);
    await button(page, '重置').click(); await playing(page, false);
    assert.equal(await currentStep(page), `1/${plan.steps.length}`);
    if (plan.steps.length > 1) await assertInspector(page, graph.nodes.find(n => n.id === plan.steps[0].nodeId));
    await button(page, '隐藏右侧详情栏').click();
    await page.locator('.inspector').waitFor({ state: 'detached' });
    await playing(page, true);
    const hiddenStep = await currentStep(page);
    if (plan.steps.length > 1) await page.waitForFunction(step => document.querySelector('.status-pill').textContent.match(/\d+\/\d+/)?.[0] !== step, hiddenStep, { timeout: 2400 });
    assert.equal(await count(page, '.inspector'), 0);
    await playing(page, false);
    await button(page, '显示右侧详情栏').click(); await assertInspector(page, await current());
    await page.locator('.inspector').focus(); await fit(page);
    const viewportStyle = await page.locator('.react-flow__viewport').getAttribute('style');
    await playing(page, true); await page.locator('.inspector').focus();
    const focusStep = await currentStep(page);
    if (plan.steps.length > 1) await page.waitForFunction(step => document.querySelector('.status-pill').textContent.match(/\d+\/\d+/)?.[0] !== step, focusStep, { timeout: 2400 });
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'node-inspector');
    assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'), viewportStyle);
    await playing(page, false); await assertInspector(page, await current());
    return { steps: plan.steps.length, fullContents: true, manualOverride: true, resume: true, previous: true, reset: true };
  }, true);
  await runCase(browser, `${graph.meta.diagramType}-mobile-inspector-sync`, viewports[2], {}, async page => {
    await page.goto(url); await chooseGraph(page, graph, true); await page.waitForTimeout(400);
    const held = await currentStep(page);
    const view = await page.locator('.react-flow__viewport').getAttribute('style');
    const active = await page.evaluateHandle(() => document.activeElement);
    if (playbackPlan(graph).steps.length > 1) await page.waitForFunction(step => document.querySelector('.status-pill').textContent.match(/\d+\/\d+/)?.[0] !== step, held, { timeout: 2400 });
    await page.locator('.toolbar').waitFor({ state: 'detached' });
    await page.locator('.inspector').waitFor({ state: 'detached' });
    assert.equal(await count(page, '.toolbar'), 0); assert.equal(await count(page, '.inspector'), 0);
    assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'), view);
    assert.equal(await active.evaluate(element => document.activeElement === element), true);
    await active.dispose();
    await playing(page, false); await toolbar(page, true); await button(page, '下一步 →').click();
    await page.locator('.inspector').waitFor({ state: 'detached' });
    assert.equal(await count(page, '.inspector'), 0);
    await button(page, '显示右侧详情栏').click();
    await page.locator('.toolbar').waitFor({ state: 'detached' });
    assert.equal(await count(page, '.toolbar'), 0);
    const index = Number((await currentStep(page)).split('/')[0]) - 1;
    await assertInspector(page, graph.nodes.find(n => n.id === playbackPlan(graph).steps[index].nodeId));
    await button(page, '关闭详情').click();
    await page.locator('.inspector').waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-controls') === 'node-inspector');
    return { collapsedDuringPlayback: true, exclusivePanels: true, focusReturned: true };
  }, true);
}

async function playbackChecks(browser, url, graph) {
  await runCase(browser, `${graph.meta.diagramType}-playback-flow`, viewports[0], {}, async page => {
    await page.goto(url); await chooseGraph(page, graph, false);
    const plan = playbackPlan(graph);
    assert.equal(await button(page, plan.steps.length > 1 ? 'Ⅱ 暂停' : '▶ 播放').count(), 1, 'A generated graph exposes its default demonstration.');
    await playing(page, false); await clear(page); await toolbar(page, true);
    assert.equal(await page.locator('.playback-controls').getAttribute('data-playback-mode'), plan.mode);
    const beforeStep = await currentStep(page);
    await button(page, '下一步 →').click();
    const step = await currentStep(page), index = Number(step.split('/')[0]) - 1;
    assert.equal(await page.locator('.diagram-node.is-current').evaluate(element => element.closest('[data-id]').dataset.id), plan.steps[index].nodeId);
    if (plan.steps.length > 1) assert.notEqual(step, beforeStep);
    const stable = await geometry(page), widths = [];
    for (const time of [0, 182, 479, 760]) {
      await page.locator('.playback-outline').evaluate((element, time) => { for (const animation of element.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = time; } }, time);
      widths.push(await page.locator('.playback-outline .selection-node-shine').evaluate(element => getComputedStyle(element).strokeWidth));
      assert.deepEqual(await geometry(page), stable, 'Step recoil changes neither node geometry nor routes.');
    }
    assert.ok(new Set(widths).size > 1, 'Advancing a step visibly pulses its current node.');
    await searchSelect(page, graph, target(graph));
    const offset = await page.locator('.edge-flow').first().evaluate(element => getComputedStyle(element).strokeDashoffset).catch(() => null);
    const expectedFlowEdges = graph.edges.filter(edge => hasArrow(edge, graph.meta.diagramType));
    assert.equal(await count(page, '.edge-flow'), expectedFlowEdges.length, 'Rendered flow paths match directed graph edges.');
    await page.waitForTimeout(1950); await assertPaused(page, step);
    if (offset !== null) {
      assert.notEqual(await page.locator('.edge-flow').first().evaluate(element => getComputedStyle(element).strokeDashoffset), offset, 'Edges really keep moving while selected, beyond a whole step interval.');
      await toolbar(page, true); await page.locator('.flow-toggle').click(); await assertFlow(page, false);
      await button(page, '▶ 播放').click();
      if (plan.steps.length > 1) await page.waitForFunction(step => document.querySelector('.status-pill').textContent.match(/\d+\/\d+/)?.[0] !== step, step, { timeout: 2400 });
      await assertFlow(page, false);
      await page.locator('.flow-toggle').click(); await assertFlow(page);
    }
    return { mode: plan.mode, steps: plan.steps.length, expectedFlowEdges: expectedFlowEdges.length, stepRecoil: true, stableGeometry: true, selectionKeepsFlow: true, independentFlowSwitch: offset !== null };
  }, true);
}
async function informationLayoutChecks(browser, url, graph) {
  const longLegend = structuredClone(graph);
  const stressLegend = graph.meta.diagramType === 'state' && graph.nodes.length >= 5 && graph.edges.length >= 2;
  if (stressLegend) {
    ['initial', 'final', 'choice', 'state', 'state'].forEach((kind, i) => { longLegend.nodes[i].kind = kind; longLegend.nodes[i].tags = i === 3 ? ['core'] : []; });
    longLegend.edges[0].evidence = 'inference'; longLegend.edges[1].evidence = 'source';
  }
  async function openFixture(page, fixture, viewport) {
    const model = input.diagrams ? { ...input, diagrams: graphs.map(g => g.meta.diagramType === fixture.meta.diagramType ? fixture : g) } : fixture;
    const html = fs.readFileSync(path.join(inputRoot, 'index.html'), 'utf8').replace(/(<script\b[^>]*\bid="graph-data"[^>]*>)[\s\S]*?(<\/script>)/,
      (_, start, end) => start + JSON.stringify(model).replaceAll('<', '\\u003c') + end);
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto(url); await chooseGraph(page, fixture, viewport.width <= 700); await playing(page, false);
  }
  for (const viewport of [viewports[0], viewports[2]]) {
    await runCase(browser, `${viewport.width}-information-layout`, viewport, {}, async page => {
      await openFixture(page, longLegend, viewport); await hidePanels(page);
      const anchor = await assertLegendLayout(page);
      await button(page, '显示右侧详情栏').click(); await page.locator('.inspector').waitFor();
      await hidePanels(page); assert.deepEqual(await assertLegendLayout(page), anchor);
      await fit(page); const view = page.locator('.react-flow__viewport'), before = await view.getAttribute('style');
      await page.locator('.react-flow__controls-zoomin').click(); await page.waitForTimeout(250);
      assert.notEqual(await view.getAttribute('style'), before);
      assert.deepEqual(await assertLegendLayout(page), anchor);
      const canvas = await page.locator('.canvas').boundingBox(), beforePan = await view.getAttribute('style');
      await page.mouse.move(canvas.x + 3, canvas.y + 3); await page.mouse.down();
      await page.mouse.move(canvas.x + 40, canvas.y + 30, { steps: 8 }); await page.mouse.up();
      assert.notEqual(await view.getAttribute('style'), beforePan);
      assert.deepEqual(await assertLegendLayout(page), anchor);
      await searchSelect(page, longLegend, target(longLegend)); await hidePanels(page);
      const selected = await count(page, '.diagram-node.is-selected'), step = await currentStep(page);
      const legend = page.getByRole('group', { name: '阅读图例', exact: true });
      await legend.click({ position: { x: 8, y: 8 } });
      assert.equal(await count(page, '.diagram-node.is-selected'), selected); assert.equal(await currentStep(page), step);
      const rows = await legend.locator('span').evaluateAll(elements => new Set(elements.map(element => Math.round(element.getBoundingClientRect().top))).size);
      if (stressLegend && viewport.width <= 700) assert.ok(rows > 1, 'A semantic-rich mobile legend wraps into multiple visible rows.');
      await assertLegendLayout(page);
      await page.screenshot({ path: path.join(outputRoot, 'screens', `${viewport.width}-information-layout.png`), animations: 'disabled' });
      return { legendAnchor: anchor, legendEntries: await count(page, '.legend span'), rows, pointerPreservesSelection: true, allEntriesVisible: true };
    }, true);
    await runCase(browser, `${viewport.width}-facts-layout`, viewport, {}, async page => {
      const fixture = structuredClone(graph);
      fixture.nodes[0].facts = Array.from({ length: 24 }, (_, i) => `${i + 1}. 完整事实说明 ${'LongEvidenceToken'.repeat(12)}`);
      fixture.nodes[1].facts = ['无来源的节点说明']; delete fixture.nodes[1].source;
      delete fixture.nodes[2].facts; fixture.nodes[3].facts = [];
      await openFixture(page, fixture, viewport);
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
      if (viewport.width <= 700) await page.locator('.inspector').waitFor({ state: 'detached' });
      if (!await count(page, '.inspector')) await button(page, '显示右侧详情栏').click();
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
  for (const viewport of viewports) for (const theme of ['light', 'dark']) {
    await runCase(browser, `${viewport.width}-${theme}-fullscreen`, viewport, {}, async page => {
      await page.goto(url); await chooseGraph(page, graph, viewport.width <= 700); await playing(page, false);
      if (theme === 'dark') await button(page, '深色').click();
      await hidePanels(page); await fit(page);
      await button(page, '布局锁定').click();
      assert.equal(await button(page, '进入全屏').count(), 1, 'The canvas exposes one fullscreen control.');
      await page.evaluate(() => { window.fullscreenTestFlow = document.querySelector('.react-flow'); });
      const snapshot = () => page.evaluate(() => ({
        viewport: document.querySelector('.react-flow__viewport').getAttribute('style'),
        positions: [...document.querySelectorAll('.react-flow__node')].map(node => [node.dataset.id, node.style.transform]),
        selected: [...document.querySelectorAll('.diagram-node.is-selected')].map(node => node.closest('[data-id]').dataset.id),
        panels: [...document.querySelectorAll('.panel-switcher button')].map(button => button.getAttribute('aria-expanded')),
        query: document.querySelector('#search')?.value,
        playing: [...document.querySelectorAll('.top-actions button')].some(button => button.textContent.includes('暂停')),
        locked: [...document.querySelectorAll('.top-actions button')].find(button => /布局锁定|可拖动/.test(button.textContent))?.getAttribute('aria-pressed')
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
        const controls = [...board.querySelectorAll('.react-flow__controls,.react-flow__minimap,.flow-hud')].map(element => element.getBoundingClientRect());
        const overlaps = controls.some((a, i) => controls.slice(i + 1).some(b => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top));
        return { width: box.width, height: box.height, x: box.x, y: box.y, windowWidth: innerWidth, windowHeight: innerHeight,
          canvasHeight: canvas.height, radius: getComputedStyle(board).borderRadius, overlaps,
          definitions: Boolean(board.querySelector('#codegraph-triangle,#codegraph-diamond-open')),
          outside: controls.some(box => box.left < canvas.left || box.right > canvas.right || box.top < canvas.top || box.bottom > canvas.bottom) };
      });
      assert.ok(Math.abs(bounds.width - bounds.windowWidth) <= 1 && Math.abs(bounds.height - bounds.windowHeight) <= 1 && bounds.x === 0 && bounds.y === 0, 'The board fills the fullscreen viewport.');
      assert.ok(bounds.canvasHeight > 0 && bounds.definitions); assert.equal(bounds.radius, '0px');
      assert.equal(bounds.overlaps, false, 'Canvas controls do not overlap.'); assert.equal(bounds.outside, false);
      await assertLegendLayout(page); await assertNodeDrawing(page, graph, theme);
      await page.screenshot({ path: path.join(outputRoot, 'screens', `${viewport.width}-${theme}-fullscreen.png`), animations: 'disabled' });
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
      const canvas = await page.locator('.canvas').boundingBox();
      await page.mouse.move(canvas.x + 5, canvas.y + 8); await page.mouse.down(); await page.mouse.move(canvas.x + 45, canvas.y + 33, { steps: 8 }); await page.mouse.up();
      assert.notEqual((await snapshot()).viewport, fitted);
      const map = await page.locator('.react-flow__minimap').boundingBox(), panned = (await snapshot()).viewport;
      await page.mouse.move(map.x + map.width * .55, map.y + map.height * .45); await page.mouse.down(); await page.mouse.move(map.x + map.width * .7, map.y + map.height * .6, { steps: 8 }); await page.mouse.up();
      assert.notEqual((await snapshot()).viewport, panned);
      await button(page, '适应画布').click(); await page.waitForTimeout(360);
      const beforeDrag = (await snapshot()).positions;
      await pointerNode(page, target(graph), true);
      assert.notDeepEqual((await snapshot()).positions, beforeDrag, 'Unlocked nodes can be moved in fullscreen.');
      await pointerNode(page, target(graph));
      const selected = graph.nodes.find(node => node.id !== target(graph).id) ?? target(graph);
      await nodeElement(page, selected.id).focus(); await page.keyboard.press('Enter');
      await page.waitForTimeout(460);
      assert.equal(await count(page, '.toolbar,.inspector'), 0, 'Fullscreen selection does not open outside panels.');
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
      await toolbar(page, true); await page.locator('#search').fill(target(graph).label);
      if (viewport.width <= 700) await toolbar(page, false);
      await playing(page, true);
      const running = await snapshot();
      await button(page, '进入全屏').click(); await fullscreenState(page, true);
      await button(page, '退出全屏').click(); await fullscreenState(page, false);
      const afterRunning = await snapshot();
      assert.equal(afterRunning.playing, running.playing); assert.equal(afterRunning.query, running.query); assert.deepEqual(afterRunning.panels, running.panels);
      await button(page, '进入全屏').click(); await fullscreenState(page, true);
      await nodeElement(page, selected.id).focus(); await page.keyboard.press('Enter');
      assert.equal((await snapshot()).playing, false, 'Selecting a node in fullscreen pauses a running presentation.');
      await page.keyboard.press('Escape'); await fullscreenState(page, false);
      assert.ok(await page.evaluate(() => window.fullscreenTestFlow === document.querySelector('.react-flow')), 'React Flow is never remounted.');
      return { theme, nativeFullscreen: true, autoFit: true, statePreserved: true, keyboard: true, externalExit: true, controls: true };
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
      await page.goto(url); await chooseGraph(page, graph, false); await playing(page, false); await hidePanels(page);
      const control = page.locator('.react-flow__controls-fullscreen');
      assert.equal(await control.count(), 1);
      if (failure === 'unsupported') {
        assert.equal(await control.getAttribute('aria-disabled'), 'true');
        assert.match(await control.getAttribute('title'), /不支持|不允许/);
      } else if (failure === 'exit-rejected') {
        await control.click(); await fullscreenState(page, true); await control.click();
        await page.waitForFunction(() => /无法退出全屏/.test(document.querySelector('.board-foot').textContent));
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
        await page.waitForFunction(() => /无法.*全屏/.test(document.querySelector('.board-foot').textContent));
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
  const layoutGraph = filtered.find(graph => graph.meta.diagramType === 'state' && graph.nodes.length >= 4) ?? filtered.find(graph => graph.nodes.length >= 4);
  if (layoutGraph && process.env.QA_EXTRAS !== 'none') await informationLayoutChecks(browser, url, layoutGraph);
  if (!process.env.QA_ONLY_EXTRAS) await Promise.all(viewports.map(async viewport => { for (const colorTheme of ['light', 'dark']) for (const graph of filtered) await matrix(browser, url, graph, viewport, colorTheme); }));
  if (process.env.QA_EXTRAS !== 'none') for (const graph of filtered) {
    await entrypoints(browser, url, graph);
    await playbackChecks(browser, url, graph);
    await flowContrastChecks(browser, url, graph);
    await inspectorChecks(browser, url, graph);
    await runCase(browser, `${graph.meta.diagramType}-reduced-motion`, viewports[0], { reducedMotion: 'reduce' }, async page => {
      await page.goto(url); await chooseGraph(page, graph, false); await assertPaused(page);
      await toolbar(page, true);
      if (await count(page, '.flow-toggle')) assert.equal(await page.locator('.flow-toggle').isDisabled(), true);
      await searchSelect(page, graph, target(graph));
      assert.ok(await page.locator('.selection-outline,.selection-outline *,.selection-feedback,.selection-feedback *,.playback-outline,.playback-outline *').evaluateAll(elements => elements.every(element => getComputedStyle(element).animationName === 'none')), 'Reduced motion suppresses selection recoil.');
      await button(page, '重置').click(); await assertPaused(page);
      assert.equal(await count(page, '.drawer-body h2'), 0, 'Reduced-motion reset keeps an empty Inspector.');
      await toolbar(page, true); await button(page, '下一步 →').click();
      const index = Number((await currentStep(page)).split('/')[0]) - 1;
      await assertInspector(page, graph.nodes.find(n => n.id === playbackPlan(graph).steps[index].nodeId));
      await assertFlow(page, false);
      return { staticSelection: true, pausedReset: true };
    }, true);
    await runCase(browser, `${graph.meta.diagramType}-offline`, viewports[0], {}, async (page, context) => {
      const offlineUrl = url + 'offline.html'; await page.route(offlineUrl, route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(inputRoot, 'index.html'), 'utf8') })); await context.setOffline(true);
      await page.goto(offlineUrl); await chooseGraph(page, graph, false); await searchSelect(page, graph, target(graph)); return { offline: true };
    }, true);
  }
  for (const { name, graph } of fixtures) await runCase(browser, `fixture-${name}`, viewports[0], {}, async page => {
    await page.goto(url + '__fixtures/' + encodeURIComponent(name) + '/'); await page.locator('.diagram-node').first().waitFor(); await playing(page, false);
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
