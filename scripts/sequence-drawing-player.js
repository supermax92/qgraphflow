// Presentation-only timeline over a validated, exported sequence SVG.
// All source shapes, labels, dash patterns and arrow markers remain intact.
(() => {
  const graph = window.__sequenceGraph;
  const text = graph.meta.locale === 'en' ? {
    head: 'Build participant', name: 'Write name', life: 'Draw lifeline',
    extend: 'Extend lifelines and activations', finish: 'Complete lifelines and fragments',
    complete: 'From a blank canvas to a complete, detailed flow.',
    forming: 'The sequence is taking shape', start: 'Start with the first element',
    replay: 'Replay', resume: 'Resume', pause: 'Pause',
  } : {
    head: '构建参与者', name: '写入名称', life: '绘制生命线',
    extend: '延伸生命线与激活条', finish: '完成生命线与组合片段',
    complete: '从空白画布，到完整复杂流程。', forming: '时序正在成形', start: '从第一个元素开始',
    replay: '重播', resume: '继续', pause: '暂停',
  };
  const svg = document.querySelector('#paper svg');
  const paper = document.querySelector('#paper');
  const stage = document.querySelector('#stage');
  const caption = document.querySelector('#caption');
  const progress = document.querySelector('#progress');
  const labels = document.querySelector('#lifeline-labels');
  const ending = document.querySelector('#ending');
  const NS = 'http://www.w3.org/2000/svg';
  const defs = svg.querySelector('defs');
  const actions = [], cameras = [];
  const nodes = new Map(), edges = new Map(), groups = new Map();
  const ease = p => p < .5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
  const clamp = p => Math.min(1, Math.max(0, p));
  let nextId = 0, t = .55, currentCamera;
  const ox = Number(svg.dataset.graphOffsetX), oy = Number(svg.dataset.graphOffsetY);
  const bounds = () => ({ width: stage.clientWidth, height: stage.clientHeight });
  function shape(name, attributes) {
    const element = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
  }
  // Remove export framing only; diagram facts stay in the original SVG elements.
  for (const element of [...svg.children]) {
    if (element.tagName === 'rect' || element.matches('text.heading,text.meta,[data-notes]')) element.remove();
  }
  function clip(element, box) {
    const id = `drawing-clip-${nextId++}`;
    const definition = shape('clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
    const rect = shape('rect', { x: box.x - 3, y: box.y - 3, width: 0, height: box.height + 6 });
    definition.append(rect); defs.append(definition); element.setAttribute('clip-path', `url(#${id})`);
    return { element, rect, box };
  }
  function reveal(item, p) {
    item.rect.setAttribute('width', (item.box.width + 6) * clamp(p));
    item.element.style.opacity = p > 0 ? '1' : '0';
  }
  function stroke(element) {
    const id = `drawing-mask-${nextId++}`;
    const mask = shape('mask', { id, maskUnits: 'userSpaceOnUse', x: -100, y: -100, width: 10000, height: 10000 });
    const brush = element.cloneNode(false);
    for (const key of ['class', 'style', 'marker-end', 'stroke-dasharray', 'mask', 'fill']) brush.removeAttribute(key);
    brush.setAttribute('fill', 'none'); brush.setAttribute('stroke', 'white'); brush.setAttribute('stroke-width', '12');
    brush.setAttribute('stroke-linecap', 'round');
    const length = element.getTotalLength();
    brush.setAttribute('stroke-dasharray', length); brush.setAttribute('stroke-dashoffset', length);
    mask.append(brush); defs.append(mask);
    const marker = element.getAttribute('marker-end');
    element.setAttribute('mask', `url(#${id})`); element.style.opacity = '0';
    return { element, brush, length, marker, maskId: id };
  }
  function draw(item, p) {
    item.element.style.opacity = p > 0 ? '1' : '0';
    item.brush.setAttribute('stroke-dashoffset', item.length * (1 - clamp(p)));
    if (p >= 1) item.element.removeAttribute('mask');
    else item.element.setAttribute('mask', `url(#${item.maskId})`);
    if (item.marker) item.element.setAttribute('marker-end', p >= 1 ? item.marker : 'none');
  }
  function point(item, p) { return item.element.getPointAtLength(item.length * clamp(p)); }
  function boxOf(element) {
    const box = element.getBBox();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }
  function cameraFor(x, y, width = 1100, height = 620, maxZoom = .92) {
    const size = bounds();
    const zoom = Math.min(maxZoom, (size.width - 120) / width, (size.height - 160) / height);
    return { x: size.width / 2 - x * zoom, y: size.height / 2 - y * zoom, zoom };
  }
  function focus(to, duration = .25) {
    cameras.push({ start: t, duration, from: currentCamera || to, to });
    currentCamera = to; t += duration;
  }
  function action(kind, duration, items, title, target) {
    const entry = { kind, start: t, duration, items, title, target };
    actions.push(entry); t += duration; return entry;
  }
  for (const node of graph.nodes) {
    const element = svg.querySelector(`[data-diagram-node-id="${node.id}"]`);
    const head = element.querySelector('.sequence-head');
    const figures = [...head.querySelectorAll('path,rect,circle,line,polyline,ellipse')];
    const geometries = figures.map(element => ({ ...stroke(element), fill: element.getAttribute('fill') }));
    const texts = [...head.querySelectorAll('text')].map(element => clip(element, boxOf(element)));
    const life = stroke(element.querySelector('.lifeline'));
    const start = point(life, 0), end = point(life, 1);
    const activations = [...element.querySelectorAll('.sequence-execution')].map(element => ({
      element, y: Number(element.getAttribute('y')), height: Number(element.getAttribute('height')),
      id: element.dataset.executionId,
    }));
    for (const activation of activations) { activation.element.style.opacity = '0'; activation.element.setAttribute('height', 0); }
    const label = document.createElement('div');
    label.className = 'participant-label'; label.textContent = node.label; labels.append(label);
    nodes.set(node.id, { node, element, head, geometries, texts, life, start, end, activations, label,
      x: node.position.x + node.size.width / 2 + ox });
  }
  for (const edge of graph.edges.toSorted((a, b) => a.order - b.order)) {
    const element = svg.querySelector(`[data-diagram-edge-id="${edge.id}"]`);
    const route = stroke(element.querySelector('path'));
    const annotations = [...element.children].filter(child => child !== route.element && child.tagName !== 'title')
      .map(element => clip(element, boxOf(element)));
    const box = boxOf(element);
    const start = point(route, 0), end = point(route, 1);
    edges.set(edge.id, { edge, element, route, annotations, box, start, end });
  }
  const separators = [...svg.querySelectorAll('.operand-separator')];
  for (const group of graph.groups) {
    const element = svg.querySelector(`[data-diagram-group-id="${group.id}"]`);
    const rect = element.querySelector('rect');
    const box = boxOf(rect);
    const groupClip = clip(element, box);
    // A fragment frame extends downward as its messages are constructed.
    groupClip.rect.setAttribute('width', box.width + 6); groupClip.rect.setAttribute('height', 0);
    const firstEdges = group.operands.flatMap(operand => operand.edgeIds || []);
    function descendantEdges(id) {
      return graph.groups.filter(child => child.parentId === id).flatMap(child => [
        ...child.operands.flatMap(operand => operand.edgeIds || []), ...descendantEdges(child.id),
      ]);
    }
    const allEdges = [...firstEdges, ...descendantEdges(group.id)].map(id => edges.get(id));
    const first = Math.min(...allEdges.map(item => item.edge.order));
    const last = Math.max(...allEdges.map(item => item.edge.order));
    const guards = group.operands.map((operand, index) => {
      const element = svg.querySelector(`[data-fragment-group-id="${group.id}"][data-operand-id="${operand.id}"]`);
      const children = graph.groups.filter(child => child.parentId === group.id && child.parentOperandId === operand.id);
      const ids = [...(operand.edgeIds || []), ...children.flatMap(child => [
        ...child.operands.flatMap(o => o.edgeIds || []), ...descendantEdges(child.id),
      ])];
      const first = Math.min(...ids.map(id => edges.get(id).edge.order));
      const entry = { item: clip(element, boxOf(element)), first };
      if (index > 0) {
        const guardY = entry.item.box.y;
        const separator = separators.find(path => {
          const b = path.getBBox(); return Math.abs(b.x - box.x) < 1 && b.y > box.y && b.y < guardY;
        });
        if (separator) { entry.separator = stroke(separator); separators.splice(separators.indexOf(separator), 1); }
      }
      return entry;
    });
    groups.set(group.id, { group, element, rect, box, groupClip, first, last, guards });
    element.style.opacity = '0';
  }
  if (separators.length) throw new Error('Unassigned sequence operand separator');
  const headLeft = Math.min(...graph.nodes.map(node => node.position.x + ox));
  const headRight = Math.max(...graph.nodes.map(node => node.position.x + node.size.width + ox));
  const firstNode = nodes.values().next().value;
  focus(cameraFor(firstNode.x + 300, 350, 1300, 650), 0);
  for (const [id, node] of nodes) {
    const focusX = Math.max(headLeft + 290, Math.min(headRight - 290, node.x));
    focus(cameraFor(focusX, 380, 1350, 650), .16);
    action('head', .38, node.geometries, `${text.head} · ${node.node.label}`, { node: id });
    action('text', .23, node.texts, `${text.name} · ${node.node.label}`, { node: id });
    action('life', .23, [node.life], text.life, { node: id, y: 420 });
  }
  focus(cameraFor((headLeft + headRight) / 2, 350, headRight - headLeft + 120, 560, .7), .55); t += .45;
  let level = 420;
  for (const [id, edge] of edges) {
    const span = Math.max(1000, edge.box.width + 260);
    focus(cameraFor(edge.box.x + edge.box.width / 2, edge.start.y - 110, span, 720, .92), .23);
    for (const group of groups.values()) {
      if (group.first === edge.edge.order) {
        action('fragment', .35, [group], `${group.group.kind} · ${group.group.label}`, { group: group.group.id });
      }
      for (const guard of group.guards) {
        if (guard.first === edge.edge.order) action('guard', .18, [guard], `${group.group.kind} · ${group.group.label}`);
      }
    }
    action('extend', .13, [], text.extend, { from: level, to: Math.max(level, edge.end.y + 35) });
    level = Math.max(level, edge.end.y + 35);
    action('text', .22, edge.annotations, `${String(edge.edge.order).padStart(2, '0')} / ${graph.edges.length} · ${edge.edge.label}`, { edge: id });
    action('message', edge.route.length > 1800 ? .55 : .38, [edge.route],
      `${String(edge.edge.order).padStart(2, '0')} / ${graph.edges.length} · ${edge.edge.label}`, { edge: id });
    t += .1;
  }
  action('extend', .25, [], text.finish, { from: level, to: Math.max(...[...nodes.values()].map(node => node.end.y)) + 35 });
  t += .35;
  const size = bounds();
  const diagramBox = svg.querySelector('[data-diagram-node-id]').parentElement.getBBox();
  const fit = Math.min((size.height - 54) / diagramBox.height, (size.width * .52 - 50) / diagramBox.width);
  focus({ x: size.width * .28 - (diagramBox.x + diagramBox.width / 2) * fit, y: 25 - diagramBox.y * fit, zoom: fit }, 1.25);
  const completeAt = t; t += 3.25;
  const fadeAt = t; t += .65;
  const duration = t + .35;
  const totals = { nodes: graph.nodes.length, messages: graph.edges.length, fragments: graph.groups.length, activations: graph.executions.length };
  function render(time) {
    time = Math.max(0, Math.min(duration, time));
    let camera = cameras[0].to;
    for (const entry of cameras) {
      if (time < entry.start) break;
      const p = ease(clamp((time - entry.start) / Math.max(.001, entry.duration)));
      camera = Object.fromEntries(['x', 'y', 'zoom'].map(key => [key, entry.from[key] + (entry.to[key] - entry.from[key]) * p]));
    }
    paper.style.transform = `translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})`;
    let active, level = 0, drawnMessages = 0;
    const visibleNodes = new Set();
    for (const node of nodes.values()) {
      for (const item of node.geometries) { draw(item, 0); if (item.fill) item.element.setAttribute('fill', 'none'); }
      node.texts.forEach(item => reveal(item, 0)); draw(node.life, 0);
      node.activations.forEach(item => { item.element.style.opacity = '0'; item.element.setAttribute('height', 0); });
    }
    for (const edge of edges.values()) { draw(edge.route, 0); edge.annotations.forEach(item => reveal(item, 0)); }
    for (const group of groups.values()) {
      group.element.style.opacity = '0'; group.groupClip.rect.setAttribute('height', 0);
      for (const guard of group.guards) { reveal(guard.item, 0); if (guard.separator) draw(guard.separator, 0); }
    }
    for (const entry of actions) {
      const p = clamp((time - entry.start) / entry.duration);
      if (!p) continue;
      if (p < 1) active = entry;
      if (entry.kind === 'head') {
        visibleNodes.add(entry.target.node);
        const fraction = p * entry.items.length;
        entry.items.forEach((item, index) => {
          const part = clamp(fraction - index); draw(item, part);
          if (item.fill && p > .92) item.element.setAttribute('fill', item.fill);
        });
      } else if (entry.kind === 'text') {
        entry.items.forEach(item => reveal(item, p));
      } else if (entry.kind === 'life') {
        const node = nodes.get(entry.target.node);
        const fraction = (entry.target.y - node.start.y) / (node.end.y - node.start.y) * p;
        draw(node.life, fraction);
      } else if (entry.kind === 'extend') {
        level = entry.target.from + (entry.target.to - entry.target.from) * p;
      } else if (entry.kind === 'message') {
        draw(entry.items[0], p);
        if (p === 1) drawnMessages++;
      } else if (entry.kind === 'fragment') {
        const group = entry.items[0]; group.element.style.opacity = '1';
        group.groupClip.rect.setAttribute('height', 72 * p);
      } else if (entry.kind === 'guard') {
        const guard = entry.items[0]; reveal(guard.item, p);
        if (guard.separator) draw(guard.separator, p);
      }
    }
    if (level > 0) {
      for (const node of nodes.values()) {
        draw(node.life, (level - node.start.y) / (node.end.y - node.start.y));
        for (const activation of node.activations) {
          const height = Math.min(activation.height, Math.max(0, level - 35 - activation.y));
          activation.element.setAttribute('height', height); activation.element.style.opacity = height > 0 ? '1' : '0';
        }
      }
      for (const group of groups.values()) {
        if (group.element.style.opacity === '1') {
          group.groupClip.rect.setAttribute('height', Math.min(group.box.height + 6, Math.max(72, level - group.box.y + 15)));
        }
      }
    }
    const isComplete = time >= completeAt;
    const terminal = clamp((time - fadeAt) / .65);
    stage.style.opacity = String(1 - terminal);
    ending.style.opacity = String(clamp((time - completeAt + .3) / .5) * (1 - terminal));
    caption.textContent = isComplete ? text.complete : active?.title || (drawnMessages ? text.forming : text.start);
    progress.style.width = `${Math.min(1, time / completeAt) * 100}%`;
    document.querySelector('#counter').textContent = `${String(drawnMessages).padStart(2, '0')} / ${totals.messages}`;
    const sticky = !isComplete && camera.y < -120;
    labels.style.opacity = sticky ? '1' : '0';
    for (const [id, node] of nodes) {
      node.label.style.opacity = visibleNodes.has(id) ? '1' : '0';
      node.label.style.left = `${node.x * camera.zoom + camera.x}px`;
      node.label.style.width = `${Math.max(80, node.node.size.width * camera.zoom)}px`;
    }
    window.__drawingState = { time, camera, drawnMessages, visibleNodes: visibleNodes.size, complete: isComplete,
      active: active?.kind || null };
    return window.__drawingState;
  }
  window.__drawing = { render, duration, completeAt, totals, actions: actions.map(({ kind, start, duration, target }) => ({ kind, start, duration, target })) };
  let start = 0, pausedTime = 0, playing = false, raf;
  const button = document.querySelector('#play');
  function tick(now) {
    const time = (now - start) / 1000;
    if (time >= duration) { render(duration); playing = false; button.textContent = text.replay; return; }
    render(time); raf = requestAnimationFrame(tick);
  }
  button.addEventListener('click', () => {
    if (playing) { pausedTime = window.__drawingState.time; cancelAnimationFrame(raf); playing = false; button.textContent = text.resume; }
    else { if (pausedTime >= duration || button.textContent === text.replay) pausedTime = 0;
      playing = true; start = performance.now() - pausedTime * 1000; button.textContent = text.pause; raf = requestAnimationFrame(tick); }
  });
  render(0);
  if (!new URLSearchParams(location.search).has('record')) button.click();
})();
