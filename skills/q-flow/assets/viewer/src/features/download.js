import { translate } from '../i18n.js';
import { createDiagramSvg } from '../export-svg.js';
import { getDiagram, edgeMarkers } from '../diagrams/registry.js';
import { createEdgeRoutes, occupiedBox, cardinalityMarks } from '../edge-routing.js';
import { sequenceFragment } from '../sequence-fragments.js';
import { sequenceExecutions } from '../sequence-executions.js';
import { qualityFailure } from '../layout-quality.js';
import { groupHeadingLayout } from '../text-layout.js';
import { pageWithGraph } from '../session-graph.js';

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

// Rewrite the open page and its sibling graph.json in place. Chromium browsers can write both files after the user picks
// the page's own folder once; the page on disk is re-read there, so only its embedded data changes. Other browsers
// download graph.json so edits survive a regeneration.
export async function saveGraphJson(input, locale, setStatus, pageName = decodeURIComponent(window.location?.pathname?.split('/').pop() || 'index.html')) {
  const t = (message, values) => translate(locale, message, values);
  const contents = `${JSON.stringify(input, null, 2)}\n`;
  let writable;
  try {
    if (typeof window.showDirectoryPicker === 'function') {
      const directory = await window.showDirectoryPicker({ id: 'qgraphflow-page', mode: 'readwrite' });
      const existing = await directory.getFileHandle(pageName, { create: false }).catch(() => null);
      if (!existing) throw Object.assign(new Error('wrong directory'), { name: 'NotFoundError' });
      const page = pageWithGraph(await (await existing.getFile()).text(), input);
      // Write graph.json first: it is the regeneration input, so it must never lag behind the page.
      for (const [name, text] of [['graph.json', contents], [pageName, page]]) {
        const handle = await directory.getFileHandle(name, { create: true });
        writable = await handle.createWritable();
        await writable.write(text); await writable.close(); writable = null;
      }
      setStatus(t('已保存到当前页面和同级 graph.json'));
    } else if (typeof window.showSaveFilePicker === 'function') {
      const handle = await window.showSaveFilePicker({ suggestedName: 'graph.json', types: [{ description: 'Graph JSON', accept: { 'application/json': ['.json'] } }] });
      writable = await handle.createWritable();
      await writable.write(contents);
      await writable.close(); writable = null;
      setStatus(t('Graph JSON 已保存'));
    } else {
      downloadBlob(new Blob([contents], { type: 'application/json;charset=utf-8' }), 'graph.json');
      setStatus(t('Graph JSON 已下载，请保留文件以保存修改'));
    }
  } catch (error) {
    if (writable) await writable.abort().catch(() => {});
    setStatus(t(error.name === 'AbortError' ? '已取消保存，修改仍保留在当前页面'
      : error.name === 'NotFoundError' ? '请选择当前页面 {page} 所在的文件夹，修改仍保留在当前页面'
      : '保存失败，修改仍保留在当前页面', { page: pageName }));
  }
}

export async function verifyRenderedSvg(svg, graph) {
  let elementIds = [], bounds = [];
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) throw qualityFailure(graph, 'rendering', '导出 SVG 无法解析');
  const root = document.importNode(parsed.documentElement, true); host.append(root); document.body.append(host);
  try {
    await document.fonts.ready;
    const view = root.viewBox.baseVal, offsetX = Number(root.dataset.graphOffsetX), offsetY = Number(root.dataset.graphOffsetY);
    if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) throw new Error('导出 SVG 缺少几何偏移');
    const nodeGroups = new Map([...root.querySelectorAll('.node-drawing')].map(element => [element.dataset.diagramNodeId, element]));
    const normalize = value => String(value ?? '').replace(/\s+/gu, '');
    const inside = (a, b) => a.x >= b.x - .5 && a.y >= b.y - .5 && a.x + a.width <= b.x + b.width + .5 && a.y + a.height <= b.y + b.height + .5;
    const boxOf = element => {
      const box = element.getBBox(), matrix = element.getCTM(), points = [new DOMPoint(box.x, box.y), new DOMPoint(box.x + box.width, box.y), new DOMPoint(box.x, box.y + box.height), new DOMPoint(box.x + box.width, box.y + box.height)].map(point => point.matrixTransform(matrix));
      const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
      return { x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y };
    };
    for (const element of root.querySelectorAll('text')) {
      if (!element.textContent) continue;
      const rect = boxOf(element), font = parseFloat(getComputedStyle(element).fontSize) * Math.hypot(element.getCTM().a, element.getCTM().b);
      const owner = element.closest('[data-diagram-node-id],[data-diagram-edge-id],[data-diagram-group-id],[data-fragment-group-id]');
      elementIds = owner ? [owner.dataset.diagramNodeId ?? owner.dataset.diagramEdgeId ?? owner.dataset.diagramGroupId ?? owner.dataset.fragmentGroupId] : [];
      bounds = [{ ...rect, x: rect.x - offsetX, y: rect.y - offsetY }];
      const required = /(?:title|heading)/.test(element.getAttribute('class')) ? 20 : /^(body|operand-body|field-name|field-type|member|edge|cardinality)$/.test(element.getAttribute('class')) ? 16 : 14;
      if (!inside(rect, view) || font + .01 < required) throw new Error(`导出文字越界或字号不足：${element.textContent.slice(0, 80)}`);
    }
    for (const node of graph.nodes) {
      elementIds = [node.id]; bounds = [{ ...node.position, ...node.size }];
      const group = nodeGroups.get(node.id), diagram = getDiagram(graph.meta.diagramType ?? 'architecture');
      if (!group) throw new Error(`导出缺少节点：${node.id}`);
      const nodeBox = { x: node.position.x + offsetX, y: node.position.y + offsetY, width: node.size.width, height: diagram.selectionHeight?.(node) ?? node.size.height };
      const area = diagram.textArea && node.kind !== 'actor' ? diagram.textArea(node) : null;
      const safe = area ? { ...area, x: nodeBox.x + (area.x ?? (nodeBox.width - area.width) / 2), y: nodeBox.y + (area.y ?? (nodeBox.height - area.height) / 2) } : nodeBox;
      const textBoxes = [...group.querySelectorAll('text')].filter(element => element.textContent).map(element => ({ element, box: boxOf(element) }));
      const visible = normalize(textBoxes.map(item => item.element.textContent).join(''));
      const expected = [['initial', 'final'].includes(node.kind) && !node.subtitle ? '' : node.label, node.subtitle,
        ...(node.fields ?? []).flatMap(field => [field.name, field.type]), ...(node.attributes ?? []), ...(node.methods ?? [])];
      for (const value of expected) if (value && !visible.includes(normalize(value))) throw new Error(`节点文字未完整显示：${node.id} / ${node.label} / ${String(value).slice(0, 80)}`);
      for (const item of textBoxes) if (!inside(item.box, safe)) throw new Error(`节点文字超出安全区：${node.id} / ${node.label} / ${item.element.textContent.slice(0, 80)}`);
      for (let i = 0; i < textBoxes.length; i++) for (const other of textBoxes.slice(i + 1)) {
        const a = textBoxes[i].box, b = other.box;
        if (a.x < b.x + b.width - .5 && b.x < a.x + a.width - .5 && a.y < b.y + b.height - .5 && b.y < a.y + a.height - .5) throw new Error(`节点文字重叠：${node.id} / ${node.label}`);
      }
    }
    const type = graph.meta.diagramType ?? 'architecture', routes = createEdgeRoutes(graph);
    const edgeGroups = new Map([...root.querySelectorAll('[data-diagram-edge-id]')].map(element => [element.dataset.diagramEdgeId, element]));
    const shifted = box => ({ ...box, x: box.x + offsetX, y: box.y + offsetY });
    const overlaps = (a, b) => a.x < b.x + b.width - .5 && b.x < a.x + a.width - .5 && a.y < b.y + b.height - .5 && b.y < a.y + a.height - .5;
    const labels = [...routes.values()].flatMap(route => [...(route.label ? [shifted(route.labelBox)] : []), ...(route.endpointLabels ?? []).map(label => shifted(label.labelBox))]);
    const checkLabel = (elements, value, safe, id, label = '关系') => {
      bounds = [{ ...safe, x: safe.x - offsetX, y: safe.y - offsetY }];
      if (normalize(elements.map(element => element.textContent).join('')) !== normalize(value)) throw new Error(`${label}文字未完整显示：${id}`);
      if (elements.some(element => !inside(boxOf(element), safe))) throw new Error(`${label}文字超出安全区：${id}`);
    };
    const markerGeometry = new Map();
    const groupElements = new Map([...root.querySelectorAll('[data-diagram-group-id]')].map(element => [element.dataset.diagramGroupId, element]));
    const executions = sequenceExecutions(graph);
    for (const group of graph.groups ?? []) {
      elementIds = [group.id];
      const element = groupElements.get(group.id);
      const fragment = type === 'sequence' ? sequenceFragment(group, routes, graph.meta.locale, graph.groups, executions) : null;
      const heading = fragment?.heading ?? { x: group.position.x + 16, y: group.position.y + 6, width: group.size.width - 32, height: groupHeadingLayout(group).height };
      checkLabel([...(element?.querySelectorAll(':scope > text.group') ?? [])], group.label, shifted(heading), group.id, '分组');
      if (['alt', 'opt', 'loop', 'par'].includes(group.kind)) checkLabel([...(element?.querySelectorAll(':scope > text.group-kind') ?? [])], group.kind,
        shifted({ x: group.position.x + group.size.width - 60, y: group.position.y + 6, width: 48, height: 30 }), group.id);
      for (const [kind, boxes] of [['guard', fragment?.guards], ['body', fragment?.bodies]]) for (const box of boxes ?? []) {
        const elements = [...root.querySelectorAll(`.operand-${kind}[data-fragment-group-id="${CSS.escape(group.id)}"][data-operand-id="${CSS.escape(box.operandId)}"] text`)];
        checkLabel(elements, box.lines.join(''), shifted(box), `${group.id}/${box.operandId}/${kind}`, '片段');
      }
    }
    for (const edge of graph.edges) {
      elementIds = [edge.id, edge.source, edge.target];
      const group = edgeGroups.get(edge.id), route = routes.get(edge.id), line = group?.querySelector(':scope > path');
      if (!line) throw new Error(`导出缺少关系：${edge.id}`);
      checkLabel([...group.querySelectorAll(':scope > text.edge')], route.label, shifted(route.labelBox), edge.id);
      for (const label of route.endpointLabels ?? []) {
        const end = [...group.querySelectorAll('.edge-multiplicity')].find(item => item.dataset.endpoint === label.role);
        checkLabel([...(end?.querySelectorAll('text') ?? [])], label.label, shifted(label.labelBox), `${edge.id}/${label.role}`);
      }
      if (getDiagram(type).cardinalities) for (const [side, point, neighbor] of [['source', route.points[0], route.points[1]], ['target', route.points.at(-1), route.points.at(-2)]]) {
        const expected = cardinalityMarks(edge[`${side}Cardinality`], point, neighbor);
        const mark = group.querySelector(`[data-cardinality-endpoint="${side}"]`), path = mark?.querySelector('path'), circle = mark?.querySelector('circle');
        if (!path || path.getAttribute('d') !== expected.path || Boolean(circle) !== Boolean(expected.circle)
          || expected.circle && Object.entries(expected.circle).some(([key, value]) => Number(circle.getAttribute(key)) !== value)) throw new Error(`关系基数标记缺失或不匹配：${edge.id}/${side}`);
        const actual = boxOf(mark), safe = shifted(expected.bounds);
        if (!inside(actual, safe) || !inside(safe, actual) || !inside(actual, view)) throw new Error(`关系基数标记越界：${edge.id}/${side}`);
      }
      for (const [side, expected] of Object.entries(edgeMarkers(edge, type))) {
        const reference = line.getAttribute(`marker-${side}`), id = /^url\(#([^)]*)\)$/.exec(reference ?? '')?.[1];
        if (!expected && !reference) continue;
        if (!expected || !id || !(id === expected || expected === 'arrow' && /^arrow-(module|warn|ok|data)$/.test(id))) throw new Error(`关系标记不匹配：${edge.id}/${side}`);
        const marker = root.querySelector(`marker[id="${CSS.escape(id)}"]`);
        if (!marker) throw new Error(`关系标记缺失：${edge.id}/${side}/${id}`);
        if (!markerGeometry.has(id)) {
          const probe = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          for (const child of marker.childNodes) probe.append(child.cloneNode(true));
          root.append(probe);
          try {
            const box = probe.getBBox();
            const stroke = Math.max(0, ...[...probe.querySelectorAll('*')].map(element => getComputedStyle(element).stroke === 'none' ? 0 : parseFloat(getComputedStyle(element).strokeWidth) / 2));
            if (!box.width || !box.height) throw new Error(`关系标记为空：${edge.id}/${id}`);
            markerGeometry.set(id, { x: box.x - stroke, y: box.y - stroke, width: box.width + stroke * 2, height: box.height + stroke * 2 });
          } finally { probe.remove(); }
        }
        const box = markerGeometry.get(id), vb = marker.viewBox.baseVal;
        const width = marker.markerWidth.baseVal.value, height = marker.markerHeight.baseVal.value;
        if (!(width > 0 && height > 0 && vb.width > 0 && vb.height > 0) || !inside(box, vb)) throw new Error(`关系标记被裁切：${edge.id}/${id}`);
        const scale = Math.min(width / vb.width, height / vb.height) * (marker.getAttribute('markerUnits') === 'userSpaceOnUse' ? 1 : parseFloat(getComputedStyle(line).strokeWidth));
        const length = line.getTotalLength(), point = line.getPointAtLength(side === 'start' ? 0 : length), neighbor = line.getPointAtLength(side === 'start' ? Math.min(1, length) : Math.max(0, length - 1));
        const angle = Math.atan2(side === 'start' ? neighbor.y - point.y : point.y - neighbor.y, side === 'start' ? neighbor.x - point.x : point.x - neighbor.x) * 180 / Math.PI;
        const matrix = line.getCTM().translate(point.x, point.y).rotate(angle).scale(scale).translate(-marker.refX.baseVal.value, -marker.refY.baseVal.value);
        const points = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
        const x = Math.min(...points.map(point => point.x)), y = Math.min(...points.map(point => point.y));
        const actual = { x, y, width: Math.max(...points.map(point => point.x)) - x, height: Math.max(...points.map(point => point.y)) - y };
        if (!inside(actual, view) || labels.some(label => overlaps(actual, label)) || graph.nodes.some(node => node.id !== edge.source && node.id !== edge.target && overlaps(actual, shifted(occupiedBox(node, type))))) throw new Error(`关系标记越界或遮挡：${edge.id}/${side}/${id}`);
      }
    }
  } catch (error) { throw qualityFailure(graph, 'rendering', error.message, [{ ruleId: 'rendering.svg', severity: 'error', diagramType: graph.meta.diagramType ?? 'architecture', elementIds, bounds,
    measured: error.message, required: 'Complete visible text and notation within the measured safety regions and viewBox', remediation: 'Inspect the identified element and regenerate after correcting its text or geometry.' }]); }
  finally { host.remove(); }
}

function downloadPng(svg, name) {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.onload = () => {
      try {
        const width = image.naturalWidth, height = image.naturalHeight;
        // Explicit product limit: 64M RGBA pixels is already 256MB before encoder copies.
        if (!width || !height || width > 32767 || height > 32767 || width * height > 64_000_000) throw new Error('图片尺寸超过 PNG 导出上限，请导出 SVG');
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('浏览器无法创建 PNG 画布');
        context.drawImage(image, 0, 0);
        const preview = document.createElement('canvas'); preview.width = Math.min(128, width); preview.height = Math.min(128, height);
        const probe = preview.getContext('2d');
        if (!probe) throw new Error('浏览器无法检查 PNG 画布');
        probe.drawImage(canvas, 0, 0, preview.width, preview.height);
        const pixels = probe.getImageData(0, 0, preview.width, preview.height).data;
        if (!pixels.some((value, index) => value !== pixels[index % 4])) throw new Error('浏览器生成了空白 PNG 画布');
        canvas.toBlob(async blob => {
          if (!blob || !blob.size || blob.type !== 'image/png') return reject(new Error('浏览器未能生成 PNG'));
          try {
            const decoded = await createImageBitmap(blob), complete = decoded.width === width && decoded.height === height;
            decoded.close();
            if (!complete) throw new Error('PNG 编码尺寸与画布不一致');
            downloadBlob(blob, name); resolve();
          } catch (error) { reject(error); }
        }, 'image/png');
      } catch (error) { reject(error); }
      finally { URL.revokeObjectURL(url); }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('浏览器未能读取导出 SVG'));
    };
    image.src = url;
  });
}

export async function downloadDiagram(graph, theme, format, setStatus, moduleColors) {
    graph = structuredClone(graph);
    moduleColors = moduleColors && new Map(moduleColors);
    const t = (message, values) => translate(graph.meta.locale, message, values);
    try {
      setStatus(t('正在生成 {format}…', { format: format.toUpperCase() }));
      const svg = createDiagramSvg(graph, theme, moduleColors);
      const name = `${fileStem(graph.meta.title)}.${format}`;
      await verifyRenderedSvg(svg, graph);
      if (format === 'svg') downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), name);
      else await downloadPng(svg, name);
      setStatus(t('{format} 已下载', { format: format.toUpperCase() }));
    } catch (error) { setStatus(error.message); return error; }
}
