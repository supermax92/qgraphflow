import fs from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const licenseNotices = ['LICENSE', 'THIRD_PARTY_NOTICES.md']
  .map(name => fs.readFileSync(new URL(`../../../../${name}`, import.meta.url), 'utf8').trim()).join('\n\n');

export default defineConfig({
  plugins: [
    {
      name: 'third-party-notices',
      transformIndexHtml: html => html.replace('<head>', `<head>\n    <script type="text/plain" id="third-party-notices">\n${licenseNotices}\n    </script>`)
    },
    react(),
    viteSingleFile()
  ],
  build: {
    outDir: '../viewer-dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000
  }
});
