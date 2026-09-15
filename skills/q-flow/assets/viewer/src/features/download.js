import { translate } from '../i18n.js';
import { createDiagramSvg } from '../export-svg.js';

function fileStem(title) {
  return title.trim().replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'diagram';
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function saveGraphJson(input, locale, setStatus) {
  const t = (message, values) => translate(locale, message, values);
  let writable;
  try {
    const contents = `${JSON.stringify(input, null, 2)}\n`;
    if (typeof window.showSaveFilePicker === 'function') {
      const handle = await window.showSaveFilePicker({ suggestedName: 'graph.json', types: [{ description: 'Graph JSON', accept: { 'application/json': ['.json'] } }] });
      writable = await handle.createWritable();
      await writable.write(contents);
      await writable.close();
      setStatus(t('Graph JSON 已保存'));
    } else {
      downloadBlob(new Blob([contents], { type: 'application/json;charset=utf-8' }), 'graph.json');
      setStatus(t('Graph JSON 已下载，请保留文件以保存修改'));
    }
  } catch (error) {
    if (writable) await writable.abort().catch(() => {});
    setStatus(t(error.name === 'AbortError' ? '已取消保存，修改仍保留在当前页面' : '保存失败，修改仍保留在当前页面'));
  }
}

function downloadPng(svg, name) {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('浏览器未能生成 PNG'));
        downloadBlob(blob, name);
        resolve();
      }, 'image/png');
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('浏览器未能读取导出 SVG'));
    };
    image.src = url;
  });
}

export async function downloadDiagram(graph, theme, format, setStatus, moduleColors) {
    const t = (message, values) => translate(graph.meta.locale, message, values);
    try {
      setStatus(t('正在生成 {format}…', { format: format.toUpperCase() }));
      const svg = createDiagramSvg(graph, theme, moduleColors);
      const name = `${fileStem(graph.meta.title)}.${format}`;
      if (format === 'svg') downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), name);
      else await downloadPng(svg, name);
      setStatus(t('{format} 已下载', { format: format.toUpperCase() }));
    } catch (error) { setStatus(error.message); }
}
