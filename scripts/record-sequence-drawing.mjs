#!/usr/bin/env node
// Render a staged drawing animation from the current generator's SVG and graph.
// node scripts/record-sequence-drawing.mjs --view <generated directory> --out <directory>
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const { values } = parseArgs({ options: {
  view: { type: 'string' }, out: { type: 'string' }, fps: { type: 'string', default: '15' },
  width: { type: 'string', default: '1600' }, height: { type: 'string', default: '1000' },
  preview: { type: 'boolean', default: false },
} });
assert.ok(values.view && values.out, 'Required: --view <directory> --out <directory>');
const view = path.resolve(values.view), out = path.resolve(values.out);
const width = Number(values.width), height = Number(values.height), fps = Number(values.fps);
for (const n of [width, height, fps]) assert.ok(Number.isInteger(n) && n > 0);
const svgBytes = fs.readFileSync(path.join(view, 'diagram.svg'), 'utf8');
const graphBytes = fs.readFileSync(path.join(view, 'graph.json'), 'utf8');
const graph = JSON.parse(graphBytes);
assert.equal(graph.meta.diagramType, 'sequence');
const locale = graph.meta.locale;
assert.ok(['en', 'zh-CN'].includes(locale), 'Supported recording languages: en, zh-CN');
const text = locale === 'en' ? {
  title: 'Sequence drawing', heading: 'Checkout · Asynchronous payment and fulfillment',
  subtitle: 'Independently authored fictional demo scenario',
  ending: 'Complex flows,<br>drawn stroke by stroke.',
  participants: 'Participants', messages: 'Messages', fragments: 'Fragments',
  features: 'Nested branches · Failure compensation · Async callbacks<br>Paired returns · Activations · Idempotency',
  play: 'Play', pause: 'Pause', resume: 'Resume', replay: 'Replay',
} : {
  title: '时序图绘制', heading: '电商下单 · 异步支付与履约', subtitle: '独立编写的虚构演示场景',
  ending: '复杂流程，<br>一笔一笔成形。', participants: '参与者', messages: '消息', fragments: '组合片段',
  features: '嵌套分支 · 失败补偿 · 异步回调<br>成对返回 · 激活条 · 幂等处理',
  play: '播放', pause: '暂停', resume: '继续', replay: '重播',
};
fs.mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
const candidates = process.env.PLAYWRIGHT_MODULE ? [process.env.PLAYWRIGHT_MODULE] : [
  'playwright', ...fs.readdirSync(path.join(os.homedir(), '.npm/_npx')).sort()
    .map(name => path.join(os.homedir(), '.npm/_npx', name, 'node_modules/playwright')),
];
let chromium;
for (const candidate of candidates) {
  try { const api = require(candidate); if (fs.existsSync(api.chromium.executablePath())) { chromium = api.chromium; break; } } catch { /* use a downloaded browser */ }
}
assert.ok(chromium, 'An installed Playwright build with Chromium is required.');
const css = `*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:Inter,-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:#20242c;background:#edf1f6}header{position:absolute;top:27px;left:38px;right:38px;display:flex;align-items:center;gap:15px;height:47px}#brand{width:43px;height:43px;border-radius:13px;background:#1677eb;color:white;display:grid;place-items:center;font-size:24px;font-weight:800;box-shadow:0 5px 18px #1677eb22}.brand-name{font-size:19px;font-weight:730;letter-spacing:-.5px}.brand-name span{font-size:11px;letter-spacing:2px;font-weight:600;color:#8390a5;margin-left:18px}.heading{margin-left:auto;text-align:right;font-size:17px;font-weight:650}.heading small{display:block;font-size:11px;color:#8390a5;font-weight:500;margin-top:5px}#stage{position:absolute;left:24px;right:24px;top:94px;bottom:74px;overflow:hidden;border:1px solid #e2e7ee;border-radius:20px;background:#fcfcfd;box-shadow:0 18px 55px #203c6b0b}#paper{position:absolute;left:0;top:0;transform-origin:0 0}#paper svg{display:block;overflow:visible}#lifeline-labels{position:absolute;inset:0 0 auto;height:60px;overflow:hidden;background:linear-gradient(#fcfcfd 82%,#fcfcfd00);opacity:0;z-index:2;pointer-events:none}.participant-label{position:absolute;top:12px;transform:translateX(-50%);font-size:13px;font-weight:650;text-align:center;line-height:17px;color:#506179;padding:0 5px;overflow-wrap:anywhere}footer{position:absolute;bottom:23px;left:40px;right:40px;display:flex;align-items:center;gap:18px;height:26px}#caption{font-size:14px;font-weight:600;flex:1}#counter{font-size:12px;font-variant-numeric:tabular-nums;color:#7b879a}#play{border:1px solid #d8e1ed;background:#f9fbff;border-radius:7px;min-width:52px;height:27px;color:#506179;font-size:12px;cursor:pointer}.track{position:absolute;bottom:64px;left:40px;right:40px;height:2px;background:#dfe5ef;border-radius:2px;overflow:hidden}#progress{height:100%;background:#1677eb;width:0}#ending{position:absolute;top:31%;left:58%;width:36%;opacity:0;pointer-events:none}#ending .eyebrow{font-size:12px;letter-spacing:2px;color:#1677eb;font-weight:700}#ending h1{font-size:36px;letter-spacing:-1.5px;line-height:1.35;margin:18px 0 30px}#ending .stats{display:flex;gap:38px}#ending strong{display:block;font-size:42px;line-height:1.3;font-weight:650;color:#20242c}#ending .stats span{font-size:12px;color:#8390a5}#ending .tags{margin-top:32px;display:flex;gap:9px}#ending .tags span{font-size:12px;padding:7px 12px;border:1px solid #dfe5ef;border-radius:7px;color:#506179}#ending p{font-size:13px;color:#8390a5;line-height:1.8;margin-top:22px}`;
const player = fs.readFileSync(path.join(import.meta.dirname, 'sequence-drawing-player.js'), 'utf8');
const html = `<!doctype html><html lang="${locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QGraphFlow · ${text.title}</title><style>${css}</style><body><header><div id="brand">Q</div><div class="brand-name">QGraphFlow <span>SEQUENCE</span></div><div class="heading">${text.heading}<small>${text.subtitle}</small></div></header><main id="stage"><div id="paper">${svgBytes}</div><div id="lifeline-labels"></div><aside id="ending"><div class="eyebrow">DRAWN WITH QGRAPHFLOW</div><h1>${text.ending}</h1><div class="stats"><div><strong>${graph.nodes.length}</strong><span>${text.participants}</span></div><div><strong>${graph.edges.length}</strong><span>${text.messages}</span></div><div><strong>${graph.groups.length}</strong><span>${text.fragments}</span></div></div><div class="tags"><span>loop</span><span>alt</span><span>par</span><span>opt</span></div><p>${text.features}</p></aside></main><div class="track"><div id="progress"></div></div><footer><div id="caption"></div><div id="counter"></div><button id="play" type="button">${text.play}</button></footer><script>window.__sequenceGraph=${JSON.stringify(graph).replaceAll('<', '\\u003c')};</script><script>${player}</script></body></html>`;
fs.writeFileSync(path.join(out, 'drawing.html'), html);
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const body = url.pathname === '/' ? html : url.pathname === '/viewer' ? fs.readFileSync(path.join(view, 'index.html')) : url.pathname === '/svg' ? svgBytes : null;
  if (!body) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': url.pathname === '/svg' ? 'image/svg+xml' : 'text/html; charset=utf-8' }); response.end(body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const record = { width, height, fps, svgSha256: createHash('sha256').update(svgBytes).digest('hex'),
  graphSha256: createHash('sha256').update(graphBytes).digest('hex'), sourceRef: graph.meta.sourceRef,
  commit: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(), cursor: false, errors: [], remoteRequests: [], checkpoints: [] };
let browser;
function encode(args) {
  const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: 'light' });
  const page = await context.newPage();
  page.on('pageerror', error => record.errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(base)) record.remoteRequests.push(request.url()); });
  await page.goto(`${base}/?record`); await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => Boolean(window.__drawing));
  const timeline = await page.evaluate(() => ({ ...window.__drawing, render: undefined }));
  Object.assign(record, { duration: timeline.duration, totals: timeline.totals });
  const checkpoints = [['blank', 0], ['first-element', timeline.actions[0].start + .2],
    ['participants', timeline.actions.find(a => a.kind === 'message').start - .8],
    ['nested-parallel', timeline.actions.find(a => a.kind === 'message' && a.target.edge === 'm13').start + .38],
    ['webhook', timeline.actions.find(a => a.kind === 'message' && a.target.edge === 'm26').start + .38],
    ['complete', timeline.completeAt + 1]];
  for (const [name, time] of checkpoints) {
    const state = await page.evaluate(time => window.__drawing.render(time), time);
    await page.screenshot({ path: path.join(out, `${name}.png`), scale: 'css' });
    record.checkpoints.push({ name, ...state });
  }
  // Verify the final presentation retains every generated relationship and notation.
  const completed = await page.evaluate(time => {
    window.__drawing.render(time);
    const svg = document.querySelector('#paper svg');
    return {
      nodes: svg.querySelectorAll('[data-diagram-node-id]').length,
      messages: [...svg.querySelectorAll('[data-diagram-edge-id]')].map(element => ({
        id: element.dataset.diagramEdgeId, dash: element.querySelector('path').getAttribute('stroke-dasharray'),
        marker: element.querySelector('path').getAttribute('marker-end'), opacity: element.querySelector('path').style.opacity,
      })),
      activations: [...svg.querySelectorAll('.sequence-execution')].map(element => ({ id: element.dataset.executionId, height: Number(element.getAttribute('height')) })),
      fragments: svg.querySelectorAll('[data-diagram-group-id]').length,
      clipped: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
    };
  }, timeline.completeAt + 1);
  assert.equal(completed.nodes, graph.nodes.length); assert.equal(completed.fragments, graph.groups.length);
  assert.equal(completed.messages.length, graph.edges.length); assert.ok(completed.activations.every(a => a.height > 0));
  assert.equal(completed.activations.length, graph.executions.length); assert.equal(completed.clipped, false);
  for (const edge of graph.edges) {
    const item = completed.messages.find(item => item.id === edge.id);
    assert.equal(item.opacity, '1'); assert.ok(item.marker.startsWith('url(#arrow-'));
    assert.equal(Boolean(item.dash), edge.kind === 'return');
  }
  record.finalNotation = completed;
  // Readability acceptance also opens the real Viewer and the unmodified static SVG.
  const acceptance = await context.newPage();
  await acceptance.setViewportSize({ width: 1440, height: 900 });
  acceptance.on('pageerror', error => record.errors.push(error.message));
  await acceptance.goto(`${base}/viewer`); await acceptance.evaluate(() => document.fonts.ready);
  await acceptance.screenshot({ path: path.join(out, 'viewer-1440.png') });
  await acceptance.goto(`${base}/svg`); await acceptance.screenshot({ path: path.join(out, 'export-svg.png') });
  const originalNotation = await acceptance.evaluate(() => ({
    routes: [...document.querySelectorAll('[data-diagram-edge-id]')].map(element => ({
      id: element.dataset.diagramEdgeId, d: element.querySelector('path').getAttribute('d'),
      dash: element.querySelector('path').getAttribute('stroke-dasharray'), marker: element.querySelector('path').getAttribute('marker-end'),
      text: element.textContent,
    })),
    bars: [...document.querySelectorAll('.sequence-execution')].map(element => ({ id: element.dataset.executionId, height: Number(element.getAttribute('height')) })),
  }));
  const presentedNotation = await page.evaluate(() => ({
    routes: [...document.querySelectorAll('#paper [data-diagram-edge-id]')].map(element => ({
      id: element.dataset.diagramEdgeId, d: element.querySelector('path').getAttribute('d'),
      dash: element.querySelector('path').getAttribute('stroke-dasharray'), marker: element.querySelector('path').getAttribute('marker-end'),
      text: element.textContent,
    })),
    bars: [...document.querySelectorAll('#paper .sequence-execution')].map(element => ({ id: element.dataset.executionId, height: Number(element.getAttribute('height')) })),
  }));
  assert.deepEqual(presentedNotation, originalNotation, 'The finished animation must preserve the exported geometry and notation');
  // Exercise the downloadable player's pause / resume / replay controls.
  await acceptance.clock.install();
  await acceptance.goto(`${base}/?record`); await acceptance.evaluate(() => document.fonts.ready);
  await acceptance.getByRole('button', { name: text.play, exact: true }).click();
  await acceptance.clock.runFor(600);
  await acceptance.getByRole('button', { name: text.pause, exact: true }).click();
  const paused = await acceptance.evaluate(() => window.__drawingState.time);
  await acceptance.clock.runFor(400);
  assert.equal(await acceptance.evaluate(() => window.__drawingState.time), paused);
  await acceptance.getByRole('button', { name: text.resume, exact: true }).click();
  await acceptance.clock.runFor(500);
  assert.ok(await acceptance.evaluate(() => window.__drawingState.time) > paused);
  await acceptance.clock.runFor(timeline.duration * 1000);
  await acceptance.getByRole('button', { name: text.replay, exact: true }).click();
  await acceptance.clock.runFor(150);
  assert.ok(await acceptance.evaluate(() => window.__drawingState.time) < 1);
  record.playerControls = 'pause / resume / replay passed';
  record.viewerAcceptance = { width: 1440, height: 900, originalNotationRetained: true };
  await acceptance.close();
  if (!values.preview) {
    const framesDir = fs.mkdtempSync(path.join(out, 'frames-'));
    const count = Math.ceil(timeline.duration * fps);
    for (let frame = 0; frame < count; frame++) {
      await page.evaluate(time => window.__drawing.render(time), frame / fps);
      await page.screenshot({ path: path.join(framesDir, `frame-${String(frame).padStart(4, '0')}.png`), scale: 'css' });
      if (frame % (fps * 10) === 0) console.log(`Recording ${Math.floor(frame / fps)} / ${Math.ceil(timeline.duration)} seconds`);
    }
    record.frames = count; record.duration = count / fps;
    const input = path.join(framesDir, 'frame-%04d.png'), palette = path.join(out, 'palette.png');
    encode(['-framerate', String(fps), '-i', input, '-vf', 'palettegen=stats_mode=diff:max_colors=256', palette]);
    encode(['-framerate', String(fps), '-i', input, '-i', palette, '-lavfi', 'paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle', '-loop', '0', path.join(out, 'checkout.sequence-drawing.gif')]);
    encode(['-framerate', String(fps), '-i', input, '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, 'checkout.sequence-drawing.mp4')]);
  }
  assert.deepEqual(record.errors, []); assert.deepEqual(record.remoteRequests, []);
  assert.equal(fs.readFileSync(path.join(view, 'diagram.svg'), 'utf8'), svgBytes);
  assert.equal(fs.readFileSync(path.join(view, 'graph.json'), 'utf8'), graphBytes);
  fs.writeFileSync(path.join(out, 'record.json'), JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify({ output: out, duration: record.duration, frames: record.frames, totals: record.totals, errors: record.errors }));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
