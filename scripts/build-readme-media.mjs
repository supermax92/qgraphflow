#!/usr/bin/env node
// Re-record the localized README from the real Viewer. Reuses an installed Playwright and ffmpeg.
// Usage: node scripts/build-readme-media.mjs NEW_WORK_DIRECTORY [en,zh-CN,ru,pt,ja,de,es] [--views-only]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { translate } from '../skills/q-flow/assets/viewer/src/i18n.js';
import { renderNode } from '../skills/q-flow/assets/viewer/src/node-svg.js';
import { PALETTES } from '../skills/q-flow/assets/viewer/src/visual-style.js';

const root = path.resolve(import.meta.dirname, '..');
const work = path.resolve(process.argv[2] || 'output/readme-media');
if (fs.existsSync(work)) throw new Error('Choose a new work directory to preserve earlier evidence.');
const locales = (process.argv[3] || 'en,zh-CN,ru,pt,ja,de,es').split(',');
const copy = JSON.parse(fs.readFileSync(path.join(root, 'docs/readme/media-copy.json')));
for (const locale of locales) assert.ok(copy[locale], `Unsupported locale: ${locale}`);
const media = path.join(root, 'docs/images/showcase');
const manifestFile = path.join(root, 'docs/showcase-media.json');
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const viewerSha256 = sha(path.join(root, 'skills/q-flow/assets/viewer-dist/index.html'));
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile)) : {};
if (manifest.viewerSha256 && manifest.viewerSha256 !== viewerSha256 && locales.length !== Object.keys(copy).length) throw new Error('Viewer changed: rebuild media for every README language.');
Object.assign(manifest, { status: 'local-review', directory: 'docs/images/showcase', viewerSha256, locales: manifest.locales || [] });
delete manifest.release;
fs.mkdirSync(media, { recursive: true });
fs.mkdirSync(work, { recursive: true });
const require = createRequire(import.meta.url);
const cache = path.join(os.homedir(), '.npm/_npx');
const modulePath = process.env.PLAYWRIGHT_MODULE || fs.readdirSync(cache).map(dir => path.join(cache, dir, 'node_modules/playwright')).find(dir => fs.existsSync(path.join(dir, 'package.json')));
const { chromium } = require(modulePath || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const report = { startedAt: new Date().toISOString(), locales: [] };
const script = name => path.join(root, `skills/q-flow/scripts/${name}.mjs`);
const encode = (frames, destination) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '10', '-i', path.join(frames, '%04d.png'), '-filter_complex', '[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3', '-loop', '0', destination]);
try {
  for (const locale of locales) {
    const dir = path.join(work, locale), texts = copy[locale];
    const t = message => translate(locale, message);
    fs.mkdirSync(dir);
    const original = path.join(root, `examples/showcase/ecommerce.${locale}.graph.json`);
    const collection = JSON.parse(fs.readFileSync(original));
    for (const graph of collection.diagrams) for (const node of graph.nodes) {
      assert.ok(!renderNode(node, graph.meta.diagramType, 0, 0, PALETTES.light, locale).includes('…'), `${locale}/${graph.meta.diagramType}/${node.id}: truncated text`);
    }
    execFileSync(process.execPath, [script('generate-viewer'), original, path.join(dir, 'collection')]);
    const demo = structuredClone(collection.diagrams[0]);
    Object.assign(demo.meta, { sourceRef: texts.sourceRef, scope: texts.scope });
    const checkout = demo.nodes.find(n => n.id === 'checkout');
    checkout.source = { kind: 'source', file: 'demo-only/checkout/src/main/java/com/example/CheckoutService.java', lineStart: 42, lineEnd: 86, symbol: 'CheckoutService#checkout(CheckoutCommand)' };
    checkout.tags.push(texts.fictionTag);
    checkout.facts.unshift(texts.fictionFact);
    demo.edges.find(e => e.id === 'quote').facts = [texts.inferenceFact, texts.unverifiedFact];
    const demoFile = path.join(dir, 'demo.graph.json');
    fs.writeFileSync(demoFile, JSON.stringify(demo, null, 2) + '\n');
    execFileSync(process.execPath, [script('generate-viewer'), demoFile, path.join(dir, 'demo')]);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const wait = ms => page.waitForTimeout(ms);
    const button = label => page.getByRole('button', { name: t(label), exact: true });
    const click = async (role, label) => { const item = page.getByRole(role, { name: t(label), exact: true }); await item.hover(); await wait(120); await item.click(); };
    const ready = async url => { await page.goto(url); await page.locator('.react-flow__node-diagram').last().waitFor(); await wait(800); };
    const select = async graph => {
      await page.locator('#view-menu-button').click();
      await page.getByRole('menuitemradio').nth(collection.diagrams.indexOf(graph)).click();
      await wait(550);
    };
    const downloads = path.join(dir, 'downloads');
    fs.mkdirSync(downloads);
    const exported = async (format, destination) => {
      await click('button', '更多'); await wait(500);
      const pending = page.waitForEvent('download');
      await click('menuitem', `导出 ${format}`);
      const download = await pending;
      await download.saveAs(destination);
      assert.equal(await download.failure(), null);
    };
    const framesFor = name => { const result = path.join(dir, name); fs.mkdirSync(result); return result; };
    const fileFor = name => path.join(media, `ecommerce.${locale}.${name}`);
    const entry = { locale, png: [], recordings: [], screenshots: [], errors };
    try {
      await ready(pathToFileURL(path.join(dir, 'collection/index.html')).href);
      assert.equal(await page.locator('html').getAttribute('lang'), locale);
      const frames = framesFor('core-three'); let frame = 0;
      for (const graph of collection.diagrams) {
        await select(graph);
        const name = graph.meta.diagramType;
        if (['architecture', 'flowchart', 'sequence'].includes(name)) {
          for (let i = 0; i < 8; i++) {
            const started = Date.now();
            await page.screenshot({ path: path.join(frames, `${String(frame++).padStart(4, '0')}.png`) });
            await wait(Math.max(1, 100 - (Date.now() - started)));
          }
        }
        await exported('SVG', path.join(downloads, `${name}.svg`));
        await exported('PNG', fileFor(`${name}.png`));
        await page.screenshot({ path: path.join(dir, `${name}.png`) });
        entry.png.push(fileFor(`${name}.png`));
        entry.screenshots.push(path.join(dir, `${name}.png`));
      }
      encode(frames, fileFor('core-three.gif'));
      entry.recordings.push({ name: 'core-three', frames: frame, seconds: frame / 10 });
      fs.rmSync(frames, { recursive: true });

      for (const name of process.argv.includes('--views-only') ? [] : ['explore', 'verify', 'edit', 'share']) {
        await ready(pathToFileURL(path.join(dir, 'demo/index.html')).href);
        const flowOffset = () => page.locator('.edge-flow').first().evaluate(el => getComputedStyle(el).strokeDashoffset);
        const offset = await flowOffset(); await wait(150); assert.notEqual(await flowOffset(), offset);
        const frames = framesFor(name); let recording = true, count = 0, captureError, retries = 0;
        const started = Date.now();
        const capture = (async () => {
          while (recording) {
            try {
              await page.screenshot({ path: path.join(frames, `${String(count).padStart(4, '0')}.png`) });
              count++; retries = 0;
            } catch (error) {
              if (!error.message.includes('Unable to capture screenshot') || ++retries > 3) throw error;
              await wait(100);
            }
            await wait(Math.max(1, started + count * 100 - Date.now()));
          }
        })().catch(error => { captureError = error; recording = false; });
        try {
          await wait(800);
          if (name === 'explore') {
            await click('button', '显示图谱导航'); await wait(1100);
            await page.getByRole('textbox', { name: t('搜索节点') }).fill(checkout.label);
            await wait(1000);
            await page.getByRole('option').filter({ hasText: checkout.label }).first().click(); await wait(1600);
            assert.ok(await page.locator('.inspector').isVisible());
            await click('button', '隐藏右侧详情栏'); await click('button', '隐藏图谱导航');
            await click('button', '适应画布'); await wait(600);
            await page.getByRole('article', { name: checkout.label, exact: true }).click(); await wait(1700);
            assert.ok(await page.locator('.node-card').isVisible());
            assert.ok(await page.locator('.selection-edge-halo').count() >= 2);
            await page.screenshot({ path: path.join(dir, 'explore-detail.png') });
            await page.locator('.node-card').getByRole('button', { name: t('关闭'), exact: true }).click();
            await click('button', '放大'); await wait(600);
            await page.mouse.move(1070, 580); await page.mouse.down(); await page.mouse.move(990, 630, { steps: 18 }); await page.mouse.up();
            await wait(600); await click('button', '适应画布'); await wait(1000);
          } else if (name === 'verify') {
            await page.getByRole('article', { name: checkout.label, exact: true }).click(); await wait(1000);
            await click('button', '查看详情'); await wait(2600);
            const content = await page.locator('.inspector').innerText();
            assert.ok(content.includes('CheckoutService.java:42-86') && content.includes(texts.fictionFact));
            await page.screenshot({ path: path.join(dir, 'verify-source.png') });
            await click('button', '隐藏右侧详情栏'); await click('button', '适应画布'); await wait(600);
            if (await page.locator('.node-card').isVisible()) await page.locator('.node-card').getByRole('button', { name: t('关闭'), exact: true }).click();
            const point = await page.locator('.react-flow__edge[data-id="quote"] .react-flow__edge-interaction').evaluate(el => {
              const p = el.getPointAtLength(el.getTotalLength() * .2), q = new DOMPoint(p.x, p.y).matrixTransform(el.getScreenCTM());
              return { x: q.x, y: q.y };
            });
            await page.mouse.click(point.x, point.y); await wait(900);
            assert.ok(await page.locator('.relation-card').isVisible());
            await click('button', '查看详情'); await wait(2300);
            assert.ok((await page.locator('.inspector').innerText()).includes(texts.inferenceFact));
            await page.screenshot({ path: path.join(dir, 'verify-relation.png') });
          } else if (name === 'edit') {
            const node = page.locator('.react-flow__node-diagram[data-id="fulfillment"]');
            const before = await node.getAttribute('style');
            const label = demo.nodes.find(n => n.id === 'fulfillment').label;
            await click('button', '更多'); await wait(900); await click('switch', '布局锁定'); await wait(700); await click('button', '更多');
            await page.getByRole('article', { name: label, exact: true }).click(); await wait(600);
            await click('button', '编辑文字');
            await page.getByRole('textbox', { name: t('名称'), exact: true }).fill(texts.editedLabel);
            await page.getByRole('textbox', { name: t('说明'), exact: true }).fill(texts.editedSubtitle);
            await wait(1100); await click('button', '保存'); await wait(1200);
            assert.ok(await page.getByRole('article', { name: texts.editedLabel, exact: true }).isVisible());
            const bounds = await node.boundingBox();
            const routes = () => page.locator('.edge-flow').evaluateAll(items => items.map(el => el.getAttribute('d')).join('|'));
            const beforeRoutes = await routes();
            await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 25); await page.mouse.down();
            for (let i = 1; i <= 18; i++) { await page.mouse.move(bounds.x + bounds.width / 2 + i * 4, bounds.y + 25 + i * 2); await wait(65); }
            await page.mouse.up(); await wait(1300);
            assert.notEqual(await node.getAttribute('style'), before); assert.notEqual(await routes(), beforeRoutes);
            await page.screenshot({ path: path.join(dir, 'edit-drag.png') });
            await click('button', '更多'); await wait(700); await click('menuitem', '重置'); await wait(1700);
            assert.equal(await node.getAttribute('style'), before);
            assert.ok(await page.getByRole('article', { name: label, exact: true }).isVisible());
          } else {
            await context.setOffline(true); await page.reload(); await wait(1000);
            assert.equal(await page.locator('.react-flow__node-diagram').count(), demo.nodes.length);
            await exported('SVG', path.join(downloads, 'demo.svg')); await wait(1000);
            const png = path.join(downloads, 'demo.png');
            await exported('PNG', png); await wait(1000);
            await page.goto(pathToFileURL(png).href); await wait(2200);
            assert.ok(await page.locator('img').evaluate(el => el.naturalWidth > 1000 && el.naturalHeight > 500));
            await page.screenshot({ path: path.join(dir, 'share-export.png') });
          }
        } finally { recording = false; await capture; await context.setOffline(false); if (captureError) throw captureError; }
        encode(frames, fileFor(`${name}.gif`));
        entry.recordings.push({ name, frames: count, seconds: count / 10 });
        fs.rmSync(frames, { recursive: true });
        console.log(`${locale}: ${name} (${count} frames)`);
      }
      assert.deepEqual(errors, []);
      report.locales.push(entry);
      fs.writeFileSync(path.join(work, 'report.json'), JSON.stringify(report, null, 2) + '\n');
      const assets = [];
      for (const suffix of [...collection.diagrams.map(graph => `${graph.meta.diagramType}.png`), ...['core-three', 'explore', 'verify', 'edit', 'share'].map(name => `${name}.gif`)]) {
        const file = fileFor(suffix);
        const { streams: [stream] } = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,nb_frames,duration', '-of', 'json', file]));
        assets.push({ name: path.basename(file), bytes: fs.statSync(file).size, sha256: sha(file), width: stream.width, height: stream.height,
          ...(suffix.endsWith('.gif') ? { frames: Number(stream.nb_frames), durationMs: Math.round(Number(stream.duration) * 1000) } : {}) });
      }
      const receipt = { locale, graph: `examples/showcase/ecommerce.${locale}.graph.json`, graphSha256: sha(original), assets };
      manifest.locales = [...manifest.locales.filter(entry => entry.locale !== locale), receipt].sort((a, b) => ['en', 'zh-CN', 'ru', 'pt', 'ja', 'de', 'es'].indexOf(a.locale) - ['en', 'zh-CN', 'ru', 'pt', 'ja', 'de', 'es'].indexOf(b.locale));
      fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
      console.log(`${locale}: ${entry.png.length} PNG + ${entry.recordings.length} GIF generated`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
