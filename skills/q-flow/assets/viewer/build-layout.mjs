import fs from 'node:fs/promises';
import { rolldown } from 'rolldown';

const worker = new URL('../layout-dist/worker.mjs', import.meta.url);
const bundle = await rolldown({ input: new URL('./layout-worker.js', import.meta.url).pathname, platform: 'node', external: ['web-worker'] });
try {
  await bundle.write({ file: worker.pathname, format: 'esm', minify: true });
  await fs.writeFile(worker, (await fs.readFile(worker, 'utf8')).replace(/[ \t]+$/gm, ''));
  await fs.copyFile(new URL('./node_modules/elkjs/LICENSE.md', import.meta.url), new URL('../layout-dist/ELK-LICENSE.md', import.meta.url));
} finally { await bundle.close(); }
