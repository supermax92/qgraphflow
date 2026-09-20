#!/usr/bin/env node
// Records the README showcase from real generated pages, frame by frame, once per locale found under --graphs:
//   hero     4.5 s  architecture → sequence → ER, 1.5 s each (no cursor)
//   explore  6.5 s  search locates, jump, zoom out to upstream / downstream, pan       (architecture)
//   verify   6.5 s  quick-look card → details with file:line and symbol → inferred edge  (architecture)
//   edit     8.5 s  unlock, rename from the card, drag with edges following, reset      (architecture)
//   share    6.5 s  page opens, Export PNG, then the exported file itself                (ER)
// Every frame is deterministic: the page runs under a fake clock, the camera moves through the Viewer's own
// viewport API (?automation=1), CSS animations are stepped by hand, and clicks, typing and drags are real input
// events at a synthetic cursor drawn into the page. Not part of the plugin package; GIFs ship as Release assets.
// Usage: node scripts/showcase-record.mjs --graphs <dir with <locale>/{architecture,sequence,er}.graph.json>
//        --repo-root <sample repo> --out <output dir> [--locales en,zh-CN] [--clips hero,explore,verify,edit,share]
//        [--width 1200] [--height 675] [--fps 12] [--skip-gif]
// Needs the Playwright module (PLAYWRIGHT_MODULE or npx cache) and ffmpeg on PATH.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generator = path.join(root, 'skills/q-flow/scripts/generate-viewer.mjs');

function playwright() {
  if (process.env.PLAYWRIGHT_MODULE) return require(process.env.PLAYWRIGHT_MODULE);
  const cache = path.join(os.homedir(), '.npm', '_npx');
  const candidates = ['playwright', ...(fs.existsSync(cache) ? fs.readdirSync(cache).sort() : []).map(directory => path.join(cache, directory, 'node_modules', 'playwright'))];
  for (const candidate of candidates) {
    // An npx cache can hold several Playwright builds; only one with a downloaded Chromium is usable.
    try { const module = require(candidate); if (fs.existsSync(module.chromium.executablePath())) return module; } catch { /* not installed here */ }
  }
  throw new Error('No Playwright build with a downloaded Chromium was found; set PLAYWRIGHT_MODULE');
}

const { values } = parseArgs({ options: {
  graphs: { type: 'string' }, 'repo-root': { type: 'string' }, out: { type: 'string' },
  locales: { type: 'string' }, clips: { type: 'string' },
  width: { type: 'string', default: '1200' }, height: { type: 'string', default: '675' }, fps: { type: 'string', default: '12' },
  'skip-gif': { type: 'boolean', default: false }
} });
if (!values.graphs || !values.out) { console.error('Usage: node scripts/showcase-record.mjs --graphs <dir> --repo-root <dir> --out <dir>'); process.exit(2); }
const width = Number(values.width), height = Number(values.height), fps = Number(values.fps), frameMs = 1000 / fps;
const F = seconds => Math.round(seconds * fps);
const graphsDir = path.resolve(values.graphs), outDir = path.resolve(values.out), releaseDir = path.join(outDir, 'release');
const locales = values.locales ? values.locales.split(',') : fs.readdirSync(graphsDir).filter(name => fs.existsSync(path.join(graphsDir, name, 'architecture.graph.json'))).sort();
if (!locales.length) { console.error(`no <locale>/architecture.graph.json under ${graphsDir}`); process.exit(2); }

// ---------- locale text ----------
// The search term hits in every locale because node subtitles keep the code identifiers (requestRefund, refunds).
const SEARCH_TERM = 'refund';
// The rename corrects "LLM provider" to what the source symbol (LlmGatewayClient) actually is.
const RENAME = { en: 'LLM gateway', 'zh-CN': 'LLM 网关', ja: 'LLM ゲートウェイ', de: 'LLM-Gateway', es: 'Pasarela LLM', pt: 'Gateway LLM', ru: 'LLM-шлюз' };

// ---------- synthetic cursor ----------
const CURSOR_SVG = '<svg width="24" height="28" viewBox="0 0 24 28" aria-hidden="true"><path d="M4 2v19.8l5.2-4.7 3.6 7.9 3.2-1.4-3.6-7.8h6.7z" fill="#1c1c1e" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
const RIPPLE = [{ opacity: .85, scale: .6 }, { opacity: .45, scale: 1.05 }, { opacity: .15, scale: 1.4 }];
async function installCursor(page, x, y) {
  await page.evaluate(({ svg, x, y }) => {
    const el = document.createElement('div');
    el.id = '__cursor';
    el.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.35))';
    el.innerHTML = `${svg}<i style="position:absolute;left:-8px;top:-10px;width:24px;height:24px;box-sizing:border-box;border:2px solid #5b5bd6;border-radius:50%;opacity:0"></i>`;
    document.body.append(el);
    window.__cursor = (x, y, ripple) => {
      el.style.transform = `translate(${x - 4}px,${y - 2}px)`;
      el.lastElementChild.style.opacity = ripple ? String(ripple.opacity) : '0';
      el.lastElementChild.style.transform = `scale(${ripple ? ripple.scale : .4})`;
    };
    window.__cursor(x, y);
  }, { svg: CURSOR_SVG, x, y });
}

const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

async function stepAnimations(page, now) {
  // CSS animations and transitions are not driven by the fake clock: pin each one to the frame time since it began.
  await page.evaluate(now => {
    window.__animStart ??= new Map();
    for (const animation of document.getAnimations()) {
      if (!window.__animStart.has(animation)) window.__animStart.set(animation, now);
      const local = now - window.__animStart.get(animation);
      try { animation.pause(); animation.currentTime = local; } catch { /* finished or detached */ }
    }
  }, now);
}

// One scene = one generated page. Frames are captured by the helpers as time passes, so a clip reads like its storyboard.
class Scene {
  constructor(page, type, recorder) {
    this.page = page; this.diagramType = type; this.recorder = recorder;
    this.now = 0; this.local = 0; this.cursor = { x: width * .56, y: height * .6 }; this.ripple = 0; this.cursorOn = false;
  }
  async frame(note = 'hold') {
    if (this.cursorOn) {
      await this.page.evaluate(({ x, y, ripple }) => window.__cursor(x, y, ripple), { ...this.cursor, ripple: this.ripple > 0 ? RIPPLE[RIPPLE.length - this.ripple] : null });
      if (this.ripple > 0) this.ripple--;
    }
    await this.page.clock.runFor(frameMs);
    this.now += frameMs;
    await stepAnimations(this.page, this.now);
    await this.recorder.capture(this.page, this.diagramType, note);
    this.local++;
  }
  async hold(frames, note = 'hold') { for (let i = 0; i < frames; i++) await this.frame(note); }
  async until(frame, note = 'hold') { while (this.local < frame) await this.frame(note); }
  async showCursor() { this.cursorOn = true; await installCursor(this.page, this.cursor.x, this.cursor.y); await this.page.mouse.move(this.cursor.x, this.cursor.y); }
  async fade(selector, frames) {
    for (let i = 0; i < frames; i++) {
      await this.page.evaluate(({ selector, opacity }) => { document.querySelector(selector).style.opacity = String(opacity); }, { selector, opacity: (i + 1) / (frames + 1) });
      await this.frame('fade-in');
    }
    await this.page.evaluate(selector => { document.querySelector(selector).style.opacity = ''; }, selector);
  }
  selector(target) {
    if (target.startsWith('node:')) return `.react-flow__node[data-id="${target.slice(5)}"] .node-visual`;
    if (target.startsWith('edge:')) return `.edge-label[data-edge-id="${target.slice(5)}"]`;
    return target;
  }
  async point(target, offset = { x: .5, y: .5 }) {
    const box = await this.page.locator(this.selector(target)).first().boundingBox();
    if (!box) throw new Error(`${target} is not on screen`);
    return { x: box.x + box.width * offset.x, y: box.y + box.height * offset.y };
  }
  async cursorTo(target, frames, offset) {
    const to = typeof target === 'string' ? await this.point(target, offset) : target, from = { ...this.cursor };
    for (let i = 1; i <= frames; i++) {
      const t = easeInOut(i / frames);
      this.cursor = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      await this.page.mouse.move(this.cursor.x, this.cursor.y);
      await this.frame('cursor');
    }
  }
  async click(frames = 2) {
    await this.page.mouse.down(); await this.page.mouse.up();
    this.ripple = RIPPLE.length;
    await this.hold(frames, 'click');
  }
  // The hero keeps its original cursor-less clicks: a forced DOM click on the element itself.
  async rawClick(target) { await this.page.locator(this.selector(target)).first().click({ force: true, noWaitAfter: true }); }
  async type(text, framesPerChar = 1) {
    for (const char of text) { await this.page.keyboard.type(char); await this.hold(framesPerChar, 'type'); }
  }
  async drag(dx, dy, frames) {
    const from = { ...this.cursor };
    await this.page.mouse.down();
    for (let i = 1; i <= frames; i++) {
      const t = easeInOut(i / frames);
      this.cursor = { x: from.x + dx * t, y: from.y + dy * t };
      await this.page.mouse.move(this.cursor.x, this.cursor.y);
      await this.frame('drag');
    }
    await this.page.mouse.up();
  }
  async viewport() { return this.page.evaluate(() => window.__qgraphflowAutomation.getViewport()); }
  // Target viewport that centres a node / group / the whole diagram at a zoom (absolute, or { times } the current one),
  // in the canvas or, with reading, in the area the open panels leave free; bias shifts by a fraction of the frame.
  async viewportFor(spec) {
    return this.page.evaluate(({ spec, width, height }) => {
      const api = window.__qgraphflowAutomation, view = api.getViewport();
      const canvas = document.querySelector('.react-flow').getBoundingClientRect();
      const rects = spec.bounds ? [...document.querySelectorAll('.react-flow__node')].map(node => node.getBoundingClientRect())
        : [document.querySelector(`.react-flow__node[data-id="${spec.node ?? spec.group}"]`).getBoundingClientRect()];
      const left = Math.min(...rects.map(r => r.x)), right = Math.max(...rects.map(r => r.right)), top = Math.min(...rects.map(r => r.y)), bottom = Math.max(...rects.map(r => r.bottom));
      const cx = ((left + right) / 2 - canvas.x - view.x) / view.zoom, cy = ((top + bottom) / 2 - canvas.y - view.y) / view.zoom;
      const zoom = Math.min(2, typeof spec.zoom === 'number' ? spec.zoom : view.zoom * spec.zoom.times);
      const panels = document.querySelector('.canvas').dataset;
      const navInset = spec.reading && panels.navOpen === 'true' ? 316 : 0, drawerInset = spec.reading && panels.drawerOpen === 'true' ? 316 : 0;
      const centerX = (navInset + 24 + width - drawerInset - 24) / 2, centerY = height / 2 + 26;
      return { zoom, x: centerX - cx * zoom - (spec.bias?.x ?? 0) * width, y: centerY - cy * zoom - (spec.bias?.y ?? 0) * height, fitZoom: view.zoom };
    }, { spec, width, height });
  }
  async jumpTo(spec) { const target = await this.viewportFor(spec); await this.setViewport(target); }
  async setViewport(view) { await this.page.evaluate(view => window.__qgraphflowAutomation.setViewport(view, { duration: 0 }), { x: view.x, y: view.y, zoom: view.zoom }); }
  async camera(spec, frames, hook) {
    const target = await this.viewportFor(spec), from = await this.viewport();
    for (let i = 0; i < frames; i++) {
      const t = frames > 1 ? easeOut(i / (frames - 1)) : 1;
      await this.setViewport({ x: from.x + (target.x - from.x) * t, y: from.y + (target.y - from.y) * t, zoom: from.zoom + (target.zoom - from.zoom) * t });
      if (hook) await hook(i);
      await this.frame('camera');
    }
    return target;
  }
  async text(selector) { return (await this.page.locator(selector).first().textContent({ timeout: 2000 }).catch(() => null))?.trim() ?? null; }
  // SVG labels wrap into tspans without spaces between lines, so node text is compared without whitespace.
  async nodeSays(id, label) { return ((await this.text(`.react-flow__node[data-id="${id}"] .node-visual`)) ?? '').replace(/\s+/g, '').includes(label.replace(/\s+/g, '')); }
  async count(selector) { return this.page.locator(selector).count(); }
  // Smallest visible text on screen, in screen pixels at 1× — the legibility floor of the current frame.
  async legibility() {
    return this.page.evaluate(() => {
      const zoom = window.__qgraphflowAutomation.getViewport().zoom;
      const sizes = [...document.querySelectorAll('.react-flow__node text, .edge-label, .node-card, .inspector, .popover')].map(element => {
        const box = element.getBoundingClientRect();
        const visible = box.width > 0 && box.height > 0 && box.right > 0 && box.bottom > 0 && box.left < innerWidth && box.top < innerHeight;
        return visible ? parseFloat(getComputedStyle(element).fontSize) * (element.closest('.react-flow__viewport') ? zoom : 1) : null;
      }).filter(Boolean);
      return { minFontPx: sizes.length ? Number(Math.min(...sizes).toFixed(1)) : null, zoom: Number(zoom.toFixed(3)) };
    });
  }
  async check(label, condition) {
    if (!condition) { console.error(`check failed: ${label}`); process.exitCode = 1; }
    this.recorder.checks.push({ label, ok: Boolean(condition) });
  }
  // Export PNG with the encoder held back until the "Generating…" toast has been on screen for a few frames.
  async exportPng(menuItem, toastFrames) {
    await this.page.evaluate(() => {
      const original = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (...args) { window.__pendingExport = () => original.apply(this, args); };
      window.__releaseExport = () => { HTMLCanvasElement.prototype.toBlob = original; window.__pendingExport?.(); };
    });
    await this.cursorTo(menuItem, 4);
    const downloaded = this.page.waitForEvent('download');
    await this.click(1);
    await this.hold(toastFrames, 'generating');
    await this.page.waitForFunction(() => Boolean(window.__pendingExport));
    await this.page.evaluate(() => window.__releaseExport());
    const download = await downloaded;
    const file = await download.path(), bytes = fs.readFileSync(file);
    return { name: download.suggestedFilename(), bytes: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), dataUrl: `data:image/png;base64,${bytes.toString('base64')}` };
  }
  // The exported file itself, shown on a neutral stage that fades over the page; the cursor leaves with the page.
  async showExport(exported, frames) {
    await this.page.evaluate(({ exported }) => {
      const stage = document.createElement('div');
      stage.id = '__stage';
      stage.style.cssText = 'position:fixed;inset:0;z-index:2147483600;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#f2f2f7;opacity:0;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Segoe UI",system-ui,sans-serif';
      stage.innerHTML = `<img src="${exported.dataUrl}" alt="" style="max-height:82%;max-width:88%;border-radius:8px;background:#fff;box-shadow:0 0 0 .5px rgba(0,0,0,.14),0 18px 44px rgba(0,0,0,.14)">`
        + `<p style="margin:0;display:flex;gap:12px;align-items:baseline;font-size:13px;color:#3c3c43"><span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${exported.name}</span><span style="color:#8e8e93">${exported.width} × ${exported.height}</span></p>`;
      document.body.append(stage);
    }, { exported });
    await this.page.waitForFunction(() => document.querySelector('#__stage img')?.complete);
    this.cursorOn = false;
    for (let i = 1; i <= frames; i++) {
      await this.page.evaluate(opacity => { document.querySelector('#__stage').style.opacity = String(opacity); document.querySelector('#__cursor').style.opacity = String(1 - opacity); }, i / frames);
      await this.frame('stage');
    }
  }
}

// ---------- clips (12 fps frame counts are written as seconds through F) ----------
const CLIPS = {
  hero: [
    { type: 'architecture', run: async s => {
      await s.fade('.react-flow', F(.25));
      await s.until(F(.5));
      await s.rawClick('node:orchestrator');
      await s.camera({ node: 'orchestrator', zoom: { times: 1.55 }, bias: { x: -.06, y: .10 } }, F(1.1) - F(.5) + 1);
      await s.until(F(1.5));
    } },
    // Selecting a message opens the Inspector drawer, which would cover the fragment: the sequence beat is the push-in alone.
    { type: 'sequence', run: async s => {
      await s.until(F(.4));
      await s.camera({ group: 'loop', zoom: { times: 2.1 }, bias: { x: .02, y: 0 } }, F(1.0) - F(.4) + 1);
      await s.until(F(1.5));
    } },
    { type: 'er', run: async s => {
      await s.until(F(.4));
      await s.camera({ node: 'orders', zoom: { times: 1.9 }, bias: { x: -.08, y: -.06 } }, F(1.0) - F(.4) + 1, async i => { if (i === F(.65) - F(.4)) await s.rawClick('node:orders'); });
      await s.until(F(1.5));
    } }
  ],
  explore: [{ type: 'architecture', run: async s => {
    await s.showCursor();
    await s.fade('.app-shell', F(.25));
    await s.until(F(.5));
    await s.cursorTo('#search', 5); await s.click(2);
    await s.type(SEARCH_TERM, 2);
    await s.check('explore: two matches', await s.text('.popover.results .pop-title') !== null && await s.count('.popover.results [role="option"]') === 2);
    await s.until(F(2.5));
    await s.cursorTo('.popover.results [role="option"] >> nth=0', 5); await s.click(F(.5));
    await s.check('explore: details open on the searched node', await s.count('.inspector.is-open') === 1 && await s.count('.react-flow__node[data-id="tools"].selected') === 1);
    await s.until(F(4.2));
    s.recorder.marks.push({ frame: s.local, ...(await s.legibility()) });
    await s.camera({ node: 'tools', zoom: .6, reading: true, bias: { x: -.045, y: .04 } }, F(.9));
    await s.camera({ node: 'tools', zoom: .6, reading: true, bias: { x: -.092, y: .08 } }, F(.7));
    await s.until(F(6.5));
  } }],
  verify: [{ type: 'architecture', run: async s => {
    await s.jumpTo({ node: 'gateway', zoom: .8, bias: { x: 0, y: -.04 } });
    await s.showCursor();
    await s.fade('.app-shell', F(.25));
    await s.until(F(.4));
    await s.cursorTo('node:gateway', 5, { x: .5, y: .35 }); await s.click(3);
    await s.check('verify: quick-look card with a source anchor', (await s.text('.node-card .card-source code'))?.startsWith('src/gateway/chat-gateway.js:5'));
    await s.until(F(2.2));
    s.recorder.marks.push({ frame: s.local, ...(await s.legibility()) });
    await s.cursorTo('.node-card .card-action', 4); await s.click(4);
    await s.check('verify: details show path and symbol', (await s.text('.inspector .source-path'))?.startsWith('src/gateway/chat-gateway.js:5') && await s.text('.inspector .symbol') === 'createChatGateway');
    await s.cursorTo({ x: width * .69, y: height * .68 }, 5); // park off the text while it is read
    await s.until(F(4.2));
    await s.cursorTo('edge:e1', 5); await s.click(3);
    await s.check('verify: inferred edge in details', await s.count('.inspector-card[data-edge-id="e1"]') === 1 && (await s.text('.inspector-card[data-edge-id="e1"]'))?.includes('inference'));
    await s.until(F(6.5));
  } }],
  edit: [{ type: 'architecture', run: async s => {
    const locale = s.recorder.locale;
    await s.jumpTo({ node: 'llm', zoom: .7, bias: { x: 0, y: -.1 } });
    await s.showCursor();
    await s.fade('.app-shell', F(.25));
    await s.until(F(.4));
    await s.cursorTo('#more-menu-button', 5); await s.click(2);
    await s.cursorTo('.popover.menu .switch', 4); await s.click(3);
    await s.check('edit: layout unlocked', await s.page.locator('.popover.menu .switch').getAttribute('aria-checked') === 'false');
    await s.page.keyboard.press('Escape'); // an open menu swallows the next canvas click by design
    await s.hold(2);
    await s.cursorTo('node:llm', 5, { x: .5, y: .35 }); await s.click(3);
    await s.cursorTo('.node-card .card-actions button:not(.card-action)', 4); await s.click(3);
    await s.check('edit: text form open', await s.count('.node-card form input') === 1);
    await s.cursorTo('.node-card form input', 3, { x: .8, y: .5 });
    await s.page.keyboard.press('ControlOrMeta+a');
    await s.type(RENAME[locale] ?? RENAME.en, 1);
    await s.until(F(4.0));
    await s.cursorTo('.node-card form button[type="submit"]', 4); await s.click(3);
    await s.check('edit: node renamed on the canvas', await s.nodeSays('llm', RENAME[locale] ?? RENAME.en));
    await s.hold(2);
    await s.cursorTo('node:llm', 4, { x: .5, y: .35 });
    await s.drag(0, 80, F(1.0));
    await s.check('edit: drag keeps the layout valid', await s.count('.layout-problems') === 0);
    await s.hold(F(.5));
    await s.cursorTo('#more-menu-button', 5); await s.click(2);
    await s.cursorTo('.popover.menu [role="menuitem"] >> nth=3', 4); await s.click(3);
    await s.check('edit: reset restores the name and shows a toast', !await s.nodeSays('llm', RENAME[locale] ?? RENAME.en) && Boolean(await s.text('.toast.is-on')));
    await s.until(F(8.5));
  } }],
  share: [{ type: 'er', run: async s => {
    await s.showCursor();
    await s.fade('.app-shell', F(.4));
    await s.until(F(.6));
    await s.camera({ bounds: true, zoom: .42 }, F(1.0));
    await s.until(F(2.0));
    await s.cursorTo('#more-menu-button', 5); await s.click(2);
    const exported = await s.exportPng('.popover.menu [role="menuitem"] >> nth=1', 3);
    s.recorder.exported = { name: exported.name, bytes: exported.bytes, width: exported.width, height: exported.height };
    await s.check('share: PNG exported', exported.name.endsWith('.png') && exported.bytes > 10_000);
    await s.check('share: downloaded toast', Boolean(await s.text('.toast.is-on')));
    await s.until(F(4.2));
    await s.showExport(exported, F(.4));
    await s.until(F(6.5));
  } }]
};
const clipNames = values.clips ? values.clips.split(',') : Object.keys(CLIPS);
for (const name of clipNames) if (!CLIPS[name]) { console.error(`unknown clip ${name}; known: ${Object.keys(CLIPS).join(', ')}`); process.exit(2); }

// ---------- pages ----------
function generatePages(locale) {
  const pagesDir = path.join(outDir, locale, 'pages');
  const types = [...new Set(clipNames.flatMap(name => CLIPS[name].map(scene => scene.type)))];
  for (const type of types) {
    const page = path.join(pagesDir, type);
    fs.rmSync(page, { recursive: true, force: true });
    const args = [generator, path.join(graphsDir, locale, `${type}.graph.json`), page, ...(values['repo-root'] ? ['--repo-root', values['repo-root']] : [])];
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    if (result.status !== 0) { console.error(result.stderr); process.exit(1); }
    console.log(`${locale} ${type}: ${result.stdout.trim().slice(0, 100)}…`);
  }
  return pagesDir;
}

// ---------- recording ----------
const ffmpeg = (args, label) => { const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8' }); if (result.status !== 0) throw new Error(`${label}: ${result.stderr}`); };
const frameFile = (dir, index) => path.join(dir, `frame-${String(index).padStart(3, '0')}.png`);

class Recorder {
  constructor(locale, clip) {
    this.locale = locale; this.clip = clip; this.frames = []; this.checks = []; this.marks = [];
    this.framesDir = path.join(outDir, locale, 'frames', clip);
    fs.rmSync(this.framesDir, { recursive: true, force: true });
    fs.mkdirSync(this.framesDir, { recursive: true });
  }
  async capture(page, type, note) {
    await page.screenshot({ path: frameFile(this.framesDir, this.frames.length), animations: 'allow', caret: 'hide' });
    this.frames.push({ type, note });
  }
  encode() {
    const pattern = path.join(this.framesDir, 'frame-%03d.png');
    const keyFrames = Array.from({ length: 8 }, (_, i) => Math.round(i * (this.frames.length - 1) / 7));
    const inputs = keyFrames.flatMap(index => ['-i', frameFile(this.framesDir, index)]);
    ffmpeg([...inputs, '-filter_complex', `${keyFrames.map((_, i) => `[${i}:v]scale=600:-1[s${i}]`).join(';')};${keyFrames.map((_, i) => `[s${i}]`).join('')}xstack=inputs=8:layout=${keyFrames.map((_, i) => `${(i % 4) * 600}_${Math.floor(i / 4) * Math.round(600 * height / width)}`).join('|')}[v]`, '-map', '[v]', path.join(outDir, this.locale, `${this.clip}-contact.png`)], 'contact sheet');
    if (values['skip-gif']) return null;
    fs.mkdirSync(releaseDir, { recursive: true });
    const gif = path.join(releaseDir, `agent-desk.${this.locale}.${this.clip}.gif`), palette = path.join(outDir, this.locale, `${this.clip}-palette.png`);
    ffmpeg(['-framerate', String(fps), '-i', pattern, '-vf', `scale=${width}:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=200`, palette], 'palette');
    ffmpeg(['-framerate', String(fps), '-i', pattern, '-i', palette, '-lavfi', `scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, '-loop', '0', gif], 'gif');
    ffmpeg(['-framerate', String(fps), '-i', pattern, '-vf', `scale=${width}:-2:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '20', '-movflags', '+faststart', path.join(outDir, this.locale, `${this.clip}.mp4`)], 'mp4');
    return fs.statSync(gif).size;
  }
}

const { chromium } = playwright();
const browser = await chromium.launch();
const recordPath = path.join(outDir, 'record.json');
const record = fs.existsSync(recordPath) ? JSON.parse(fs.readFileSync(recordPath, 'utf8')) : {};
Object.assign(record, { width, height, fps, locales: record.locales ?? {} });

for (const locale of locales) {
  const pagesDir = generatePages(locale);
  record.locales[locale] ??= {};
  for (const clip of clipNames) {
    const recorder = new Recorder(locale, clip);
    for (const scene of CLIPS[clip]) {
      const url = `${pathToFileURL(path.join(pagesDir, scene.type, 'index.html')).href}?automation=1`;
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, reducedMotion: 'no-preference', colorScheme: 'light' });
      const page = await context.newPage();
      await page.clock.install({ time: new Date('2026-09-20T09:00:00Z') });
      page.on('pageerror', error => { console.error(`page error in ${locale}/${clip}/${scene.type}: ${error.message}`); process.exitCode = 1; });
      await page.goto(url);
      await page.locator('.diagram-node').first().waitFor();
      await page.waitForFunction(() => Boolean(window.__qgraphflowAutomation) && document.fonts.status === 'loaded');
      await page.clock.runFor(1500); // initial fit animation settles under the fake clock
      await page.evaluate(() => { for (const animation of document.getAnimations()) animation.pause(); });
      const started = recorder.frames.length;
      const s = new Scene(page, scene.type, recorder);
      await scene.run(s);
      const final = await s.legibility();
      recorder.marks.push({ frame: recorder.frames.length - 1, final: true, ...final });
      console.log(`${locale}/${clip}/${scene.type}: frames ${started}-${recorder.frames.length - 1}, zoom ${final.zoom}, min font ${final.minFontPx}px`);
      await context.close();
    }
    const gifBytes = recorder.encode();
    record.locales[locale][clip] = { frames: recorder.frames.length, seconds: Number((recorder.frames.length / fps).toFixed(2)), gifBytes, checks: recorder.checks, marks: recorder.marks, ...(recorder.exported ? { exported: recorder.exported } : {}) };
    fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
    console.log(`${locale}/${clip}: ${recorder.frames.length} frames${gifBytes ? `, ${(gifBytes / 1024 / 1024).toFixed(2)} MB` : ''}, checks ${recorder.checks.filter(item => item.ok).length}/${recorder.checks.length}`);
  }
}
await browser.close();
