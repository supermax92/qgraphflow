#!/usr/bin/env node
// Record the actual source-built Viewer with a cursor following real mouse input.
// The cursor is recording-only; graph content, layout and generated HTML are never altered.
// Build/generate the three-view Jeepay collection before running this development helper.
// node scripts/record-showcase-hero.mjs --page <index.html> --out <recording directory>
// PLAYWRIGHT_MODULE optionally points to an existing Playwright installation.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const require = createRequire(import.meta.url);
const { values } = parseArgs({ options: {
  page: { type: 'string' }, out: { type: 'string' },
  width: { type: 'string', default: '1440' }, height: { type: 'string', default: '900' },
  fps: { type: 'string', default: '12' }, preview: { type: 'boolean', default: false },
} });
if (!values.page || !values.out) throw new Error('Required: --page <index.html> --out <directory>');
const pagePath = path.resolve(values.page), out = path.resolve(values.out);
const width = Number(values.width), height = Number(values.height), fps = Number(values.fps);
for (const value of [width, height, fps]) assert.ok(Number.isInteger(value) && value > 0);
const graphPath = path.join(path.dirname(pagePath), 'graph.json');
const graphBytesBefore = fs.readFileSync(graphPath, 'utf8');
const graphs = JSON.parse(graphBytesBefore).diagrams;
assert.deepEqual(graphs.map(graph => graph.meta.viewId), ['jeepay-relations', 'jeepay-sequence', 'jeepay-er']);
const byId = Object.fromEntries(graphs.map(graph => [graph.meta.viewId, graph]));
const locale = graphs[0].meta.locale;
assert.ok(['en', 'zh-CN'].includes(locale), 'Supported recording languages: en, zh-CN');
assert.ok(graphs.every(graph => graph.meta.locale === locale));
const ui = locale === 'en'
  ? { hideNotes: 'Hide key points', fit: 'Fit canvas', details: 'View details', hideDetails: 'Hide details' }
  : { hideNotes: '隐藏要点', fit: '适应画布', details: '查看详情', hideDetails: '隐藏右侧详情栏' };
fs.mkdirSync(out, { recursive: true });
const framesDir = fs.mkdtempSync(path.join(out, 'frames-'));
const candidates = process.env.PLAYWRIGHT_MODULE ? [process.env.PLAYWRIGHT_MODULE] : [
  'playwright', ...fs.readdirSync(path.join(os.homedir(), '.npm/_npx')).sort()
    .map(name => path.join(os.homedir(), '.npm/_npx', name, 'node_modules/playwright')),
];
let chromium;
for (const candidate of candidates) {
  try { const api = require(candidate); if (fs.existsSync(api.chromium.executablePath())) { chromium = api.chromium; break; } } catch { /* try the next installed build */ }
}
if (!chromium) throw new Error('An installed Playwright build with downloaded Chromium is required.');
const html = fs.readFileSync(pagePath);
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname !== '/') { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser, frame = 0, time = 0;
const record = { width, height, fps, page: path.relative(path.resolve(import.meta.dirname, '..'), pagePath),
  commit: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(),
  viewerSha256: (await import('node:crypto')).createHash('sha256').update(html).digest('hex'),
  sourceRef: graphs[0].meta.sourceRef, views: [], errors: [], remoteRequests: [],
  cursor: { style: 'arrow', clicks: [], moves: 0 } };
const F = seconds => Math.round(seconds * fps);
function encode(args) {
  const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'ffmpeg failed');
}
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1,
    colorScheme: 'light', reducedMotion: 'no-preference' });
  const page = await context.newPage();
  page.on('pageerror', error => record.errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:')) record.remoteRequests.push(request.url()); });
  await page.clock.install();
  await page.goto(`http://127.0.0.1:${server.address().port}/?automation=1`);
  await page.clock.runFor(1600);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => Boolean(window.__qgraphflowAutomation));
  let recording = false;
  const parkedPointer = { x: width - 110, y: Math.round(height * .66) };
  let pointer = { ...parkedPointer };
  async function installCursor() {
    await page.evaluate(() => {
      const element = document.createElement('div');
      element.id = '__recording-cursor'; element.setAttribute('aria-hidden', 'true');
      element.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;z-index:2147483647;pointer-events:none';
      element.innerHTML = '<i style="position:absolute;left:-12px;top:-12px;width:24px;height:24px;border:2px solid #2563eb;border-radius:50%;box-sizing:border-box;opacity:0"></i><svg width="24" height="28" viewBox="0 0 24 28" style="position:absolute;left:-3px;top:-2px;filter:drop-shadow(0 1px 1px #0005)"><path d="M3 2v20l5.2-4.6 3.7 8 3.1-1.4-3.6-7.9h6.8z" fill="#1c1c1e" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      document.body.append(element);
      window.__recordingPointer = { x: 0, y: 0, pressed: false, clickedAt: -1000 };
      addEventListener('mousemove', event => {
        Object.assign(window.__recordingPointer, { x: event.clientX, y: event.clientY });
        element.style.transform = `translate(${event.clientX}px,${event.clientY}px)`;
      });
      addEventListener('mousedown', () => Object.assign(window.__recordingPointer, { pressed: true, clickedAt: window.__recordingNow ?? 0 }));
      addEventListener('mouseup', () => { window.__recordingPointer.pressed = false; });
    });
    await page.mouse.move(pointer.x, pointer.y);
  }
  async function moveTo(x, y) {
    const from = { ...pointer };
    const count = F(Math.min(.45, Math.max(.2, Math.hypot(x - from.x, y - from.y) / 3000)));
    for (let i = 1; i <= count; i++) {
      const t = 1 - (1 - i / count) ** 3;
      pointer = { x: from.x + (x - from.x) * t, y: from.y + (y - from.y) * t };
      await page.mouse.move(pointer.x, pointer.y); await capture();
    }
    record.cursor.moves++;
  }
  async function click(locator, { position } = {}) {
    if (!recording) { await locator.click(position ? { position } : {}); return; }
    await locator.waitFor({ state: 'visible' });
    const box = await locator.boundingBox(); assert.ok(box, 'Mouse target has no bounds');
    const x = box.x + (position?.x ?? box.width / 2), y = box.y + (position?.y ?? box.height / 2);
    assert.ok(x >= 0 && x < width && y >= 0 && y < height, 'Mouse target is outside the viewport');
    await moveTo(x, y);
    record.cursor.clicks.push({ frame, x, y, target: (await locator.getAttribute('aria-label')) || (await locator.getAttribute('title')) || (await locator.innerText()).trim().slice(0, 80) });
    await page.mouse.down(); await capture();
    await page.mouse.up(); await hold(.08);
  }
  async function settle() { await page.clock.runFor(800); }
  async function closeNotes() {
    const button = page.getByRole('button', { name: ui.hideNotes, exact: true });
    if (await button.count()) { await click(button); await settle(); }
  }
  async function capture() {
    await page.clock.runFor(1000 / fps); time += 1000 / fps;
    await page.evaluate(now => {
      window.__recordingNow = now;
      const pointer = window.__recordingPointer, cursor = document.querySelector('#__recording-cursor');
      if (pointer && cursor) {
        const elapsed = now - pointer.clickedAt;
        cursor.firstElementChild.style.opacity = elapsed < 330 ? String(.65 * (1 - elapsed / 330)) : '0';
        cursor.firstElementChild.style.transform = `scale(${.65 + Math.min(330, elapsed) / 330})`;
        cursor.lastElementChild.style.transform = pointer.pressed ? 'scale(.95)' : '';
      }
      window.__recordingAnimations ??= new Map();
      for (const animation of document.getAnimations()) {
        if (!window.__recordingAnimations.has(animation)) window.__recordingAnimations.set(animation, now);
        animation.pause(); animation.currentTime = now - window.__recordingAnimations.get(animation);
      }
    }, time);
    await page.screenshot({ path: path.join(framesDir, `frame-${String(frame++).padStart(4, '0')}.png`), scale: 'css' });
  }
  async function hold(seconds) { for (let i = 0; i < F(seconds); i++) await capture(); }
  async function viewport() { return page.evaluate(() => window.__qgraphflowAutomation.getViewport()); }
  async function camera(x, y, zoom, seconds) {
    const from = await viewport();
    const canvas = await page.locator('.react-flow').boundingBox();
    const insets = await page.evaluate(() => ({
      top: Math.max(0, document.querySelector('header').getBoundingClientRect().bottom - document.querySelector('.react-flow').getBoundingClientRect().y),
      left: document.querySelector('.canvas').dataset.navOpen === 'true' ? 316 : 0,
      right: document.querySelector('.canvas').dataset.drawerOpen === 'true' ? 316 : 0,
    }));
    const to = { zoom, x: (insets.left + canvas.width - insets.right) / 2 - x * zoom,
      y: (insets.top + canvas.height) / 2 - y * zoom };
    const count = F(seconds);
    for (let i = 1; i <= count; i++) {
      const t = i / count, eased = t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      await page.evaluate(({ from, to, eased }) => window.__qgraphflowAutomation.setViewport({
        x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased,
        zoom: from.zoom + (to.zoom - from.zoom) * eased,
      }, { duration: 0 }), { from, to, eased });
      await capture();
    }
  }
  async function fit() { await click(page.getByRole('button', { name: ui.fit, exact: true })); await settle(); }
  async function mark(name, { allNodes = false, containedNodes = [] } = {}) {
    const view = await viewport();
    const bounds = await page.evaluate(() => {
      const canvas = document.querySelector('.react-flow').getBoundingClientRect();
      const visibleTop = Math.max(canvas.y, document.querySelector('header').getBoundingClientRect().bottom);
      const nodes = [...document.querySelectorAll('.react-flow__node[data-id]')].map(element => {
        const r = element.getBoundingClientRect(); return { id: element.dataset.id, x: r.x, y: r.y, right: r.right, bottom: r.bottom,
          contained: r.x >= canvas.x - 1 && r.y >= visibleTop - 1 && r.right <= canvas.right + 1 && r.bottom <= canvas.bottom + 1 };
      });
      const pointer = window.__recordingPointer;
      return { nodes, cursor: pointer ? { x: pointer.x, y: pointer.y } : null,
        scrollX: document.documentElement.scrollWidth > innerWidth, scrollY: document.documentElement.scrollHeight > innerHeight };
    });
    assert.equal(bounds.scrollX || bounds.scrollY, false, `${name}: unintended page scroll`);
    if (allNodes) assert.ok(bounds.nodes.every(node => node.contained), `${name}: full view clips a node`);
    for (const id of containedNodes) assert.ok(bounds.nodes.find(node => node.id === id)?.contained, `${name}: clips ${id}`);
    await page.screenshot({ path: path.join(out, `${name}.png`), scale: 'css' });
    record.views.push({ name, frame, viewport: view, ...bounds });
    console.log(`${name}: frame ${frame}, zoom ${view.zoom.toFixed(3)}`);
  }
  async function switchTo(id) {
    await click(page.locator('#view-menu-button')); await hold(.25);
    await click(page.locator(`[data-view-id="${id}"]`)); await settle();
    await closeNotes(); await fit();
    assert.equal(await page.locator('.react-flow__node[data-id]').count(), byId[id].nodes.length + (byId[id].groups?.length ?? 0));
  }
  await closeNotes(); await fit();
  await installCursor(); recording = true;
  await mark('architecture-overview', { allNodes: true });
  await hold(.75);
  await camera(470, 370, 1, .75);
  await click(page.locator('.react-flow__node[data-id="abstract"] .diagram-node')); await settle();
  await hold(.4);
  await click(page.getByRole('button', { name: ui.details, exact: true })); await settle();
  assert.match(await page.locator('.inspector .source-path').innerText(), /AbstractPayOrderController\.java/);
  await camera(470, 370, .9, .4);
  await hold(.5); await mark('architecture-evidence'); await hold(.75);
  await click(page.getByRole('button', { name: ui.hideDetails, exact: true })); await settle();
  await fit(); await hold(.25);
  await switchTo('jeepay-sequence');
  await mark('sequence-overview', { allNodes: true }); await hold(.5);
  await camera(810, 390, .88, 1); await mark('sequence-order'); await hold(.75);
  // Keep participant headers, the guarded fragment and all callback messages in one shot.
  const callbackNodes = ['orders', 'channelapi', 'channel', 'callback', 'process', 'notify'];
  const span = byId['jeepay-sequence'].nodes.filter(node => callbackNodes.includes(node.id));
  const left = Math.min(...span.map(node => node.position.x)), right = Math.max(...span.map(node => node.position.x + node.size.width));
  const top = Math.min(...span.map(node => node.position.y)), bottom = Math.max(...span.map(node => node.position.y + node.size.height));
  const callbackZoom = Math.min((width - 80) / (right - left), (height - 100) / (bottom - top));
  await camera((left + right) / 2, (top + bottom) / 2, callbackZoom, 1.15);
  await mark('sequence-callback', { containedNodes: callbackNodes }); await hold(1);
  await fit(); await hold(.25);
  await switchTo('jeepay-er');
  await mark('er-overview', { allNodes: true }); await hold(.5);
  await camera(1095, 900, .85, 1); await mark('er-fields'); await hold(1.25);
  await click(page.locator('.react-flow__node[data-id="t_pay_order"] .diagram-node'), { position: { x: 180, y: 25 } }); await settle();
  assert.match(await page.locator('.node-card .card-source').innerText(), /init\.sql/);
  await hold(.5); await mark('er-evidence'); await hold(.5);
  await page.keyboard.press('Escape'); await settle(); await fit(); await hold(.25);
  await switchTo('jeepay-relations'); await moveTo(parkedPointer.x, parkedPointer.y); await hold(.5);
  assert.ok(record.cursor.clicks.length >= 10, 'Missing recorded mouse actions');
  assert.deepEqual(record.errors, [], 'Browser runtime errors');
  assert.deepEqual(record.remoteRequests, [], 'Viewer requested external resources');
  assert.equal(fs.readFileSync(graphPath, 'utf8'), graphBytesBefore, 'Recording changed the generated graph');
  if (!values.preview) {
    const pattern = path.join(framesDir, 'frame-%04d.png');
    const palette = path.join(out, 'palette.png');
    encode(['-framerate', String(fps), '-i', pattern, '-vf', 'palettegen=stats_mode=diff:max_colors=256', palette]);
    encode(['-framerate', String(fps), '-i', pattern, '-i', palette, '-lavfi', 'paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle', '-loop', '0', path.join(out, `jeepay.${locale}.hero.gif`)]);
    encode(['-framerate', String(fps), '-i', pattern, '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, `jeepay.${locale}.hero.mp4`)]);
  }
  Object.assign(record, { frames: frame, seconds: frame / fps, framesDir });
  fs.writeFileSync(path.join(out, 'record.json'), JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify({ frames: frame, seconds: frame / fps, out, errors: record.errors }));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
