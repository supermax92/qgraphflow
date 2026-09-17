import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useViewport } from '@xyflow/react';
import { translate } from './i18n.js';
import Icon from './icons.jsx';
import TextEditor from './TextEditor.jsx';
import { sequenceExecutions, sequencePairs } from './sequence-executions.js';
import { sequenceFragment, segmentBoxes } from './sequence-fragments.js';
import { createEdgeRoutes, occupiedBox, visibleEdgeLabel } from './edge-routing.js';
import { readingRect } from './reading-area.js';
import { kindLabels, nodeAppearance, sequenceGroupColor } from './visual-style.js';

const CARD_WIDTH = 292, CARD_HEIGHT = 232, GAP = 14;

// One quick-look surface serves nodes and relations. It is anchored beside the selected geometry and tries
// right → left → below → above; sequence messages must remain unobscured.
export default function NodeCard({ node, edge, source, target, others = [], canvasRef, palette, moduleColors, locale, locked, editor, graph, isFullscreen, onDetails, onClose }) {
  const viewport = useViewport();
  const t = (message, values) => translate(locale, message, values);
  const relation = Boolean(edge);
  const label = relation ? (createEdgeRoutes(graph).get(edge.id)?.label ?? visibleEdgeLabel(edge, edge.diagramType)) || edge.kind : node.label;
  const ref = useRef(null), attemptedFallback = useRef(false);
  const [cardHeight, setCardHeight] = useState(CARD_HEIGHT);
  const [, setCanvasSize] = useState('');
  const [unsafe, setUnsafe] = useState(false);
  const unsafeRef = useRef(false);
  useEffect(() => { attemptedFallback.current = false; }, [node?.id, edge?.id, isFullscreen]);
  useEffect(() => {
    if (!unsafe) { attemptedFallback.current = false; return; }
    if (!unsafeRef.current || ref.current?.offsetHeight !== cardHeight) return;
    if (!attemptedFallback.current) { attemptedFallback.current = true; onDetails(); }
  }, [unsafe, onDetails, isFullscreen, cardHeight]);
  useLayoutEffect(() => { setUnsafe(unsafeRef.current); const height = ref.current?.offsetHeight; if (height && height !== cardHeight) setCardHeight(height); });
  useLayoutEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(() => {
      setCardHeight(ref.current?.offsetHeight ?? CARD_HEIGHT);
      setCanvasSize(`${canvasRef.current?.clientWidth}:${canvasRef.current?.clientHeight}`);
    });
    observer.observe(ref.current);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);
  const box = canvasRef.current?.getBoundingClientRect();
  if (!node || !box?.width) return null;
  const diagramType = edge?.diagramType ?? node.diagramType ?? 'architecture';
  const toScreen = (position, size) => ({ left: position.x * viewport.zoom + viewport.x, top: position.y * viewport.zoom + viewport.y, width: size.width * viewport.zoom, height: size.height * viewport.zoom });
  const anchor = relation ? node : occupiedBox(node, diagramType);
  const self = toScreen({ x: anchor.x ?? anchor.position.x, y: anchor.y ?? anchor.position.y }, { width: anchor.width ?? anchor.size.width, height: anchor.height ?? anchor.size.height });
  const area = readingRect(canvasRef.current, canvasRef.current.dataset.navOpen === 'true', canvasRef.current.dataset.drawerOpen === 'true');
  const candidates = [
    { side: 'right', x: self.left + self.width + GAP, y: self.top },
    { side: 'left', x: self.left - GAP - CARD_WIDTH, y: self.top },
    { side: 'below', x: self.left, y: self.top + self.height + GAP },
    { side: 'above', x: self.left, y: self.top - GAP - cardHeight }
  ];
  const fits = item => item.x >= area.left && item.x + CARD_WIDTH <= area.right && item.y >= area.top && item.y + cardHeight <= area.bottom;
  const neighbours = others.filter(item => item.type === 'diagram' && (!node.id || item.id !== node.id)).map(item => {
    const bounds = occupiedBox({ ...item.data, position: item.position, size: { width: item.measured?.width ?? item.style.width, height: item.measured?.height ?? item.style.height } }, diagramType);
    return toScreen({ x: bounds.x, y: bounds.y }, { width: bounds.width, height: bounds.height });
  });
  if (diagramType === 'sequence') {
    const routes = createEdgeRoutes(graph);
    const obstacles = [...routes.values()].flatMap(route => [route.labelBox, ...segmentBoxes(route)]);
    const executions = sequenceExecutions(graph);
    for (const group of graph.groups ?? []) {
      const fragment = sequenceFragment(group, routes, locale, graph.groups ?? [], executions);
      obstacles.push(...fragment.guards, ...(fragment.bodies ?? []), ...(fragment.heading ? [fragment.heading] : []));
    }
    neighbours.push(...obstacles.map(rect => toScreen(rect, rect)));
  }
  const covered = item => neighbours.reduce((sum, rect) => sum + Math.max(0, Math.min(item.x + CARD_WIDTH, rect.left + rect.width) - Math.max(item.x, rect.left)) * Math.max(0, Math.min(item.y + cardHeight, rect.top + rect.height) - Math.max(item.y, rect.top)), 0);
  const fitting = candidates.filter(fits);
  const safe = fitting.find(item => covered(item) === 0);
  const shouldFallback = diagramType === 'sequence' && !safe;
  unsafeRef.current = shouldFallback;
  const pick = safe ?? fitting.sort((a, b) => covered(a) - covered(b))[0] ?? candidates[2];
  const x = Math.min(Math.max(pick.x, area.left), Math.max(area.left, area.right - CARD_WIDTH));
  const y = Math.min(Math.max(pick.y, area.top), Math.max(area.top, area.bottom - cardHeight));
  const sourceAnchor = !relation && node.source ? `${node.source.file}:${node.source.lineStart}${node.source.lineEnd ? `-${node.source.lineEnd}` : ''}` : null;
  const color = relation ? sequenceGroupColor(sequencePairs(graph).get(edge.id), palette) ?? moduleColors?.get(edge.module ?? source?.module ?? target?.module) ?? palette.edge : nodeAppearance(node, palette, moduleColors).moduleColor ?? nodeAppearance(node, palette).stroke;
  return <aside ref={ref} className={`node-card ${relation ? 'relation-card' : ''} ${pick.side === 'left' ? 'is-flipped' : pick.side === 'below' ? 'is-below' : pick.side === 'above' ? 'is-above' : ''}`} style={{ left: x, top: y, width: CARD_WIDTH, visibility: shouldFallback ? 'hidden' : undefined }} role="dialog" aria-label={label} data-node-id={relation ? undefined : node.id} data-edge-id={relation ? edge.id : undefined}>
    <button className="card-close" onClick={onClose} aria-label={t('关闭')}><Icon name="close" /></button>
    {editor.editing ? <TextEditor editor={editor} relation={relation} locked={locked} locale={locale} /> : <>
      <p className="card-kicker"><span className="node-dot" style={{ backgroundColor: color }} />{relation ? `${t('关系')} · ${edge.kind}` : `${t(kindLabels[node.kind] ?? node.kind)}${node.module ? ` · ${node.module}` : ''}`}</p>
      <h4>{label}</h4>
      {relation ? <p className="card-subtitle">{source?.label} → {target?.label}</p> : node.subtitle && <p className="card-subtitle">{node.subtitle}</p>}
      {sourceAnchor && <p className="card-source" title={sourceAnchor}><Icon name="source" /><code>{sourceAnchor}</code></p>}
      {relation && edge.evidence && <p className="card-source">{t('证据')} · {edge.evidence}</p>}
      {!relation && node.tags?.length > 0 && <div className="card-tags">{node.tags.slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}</div>}
      <div className="card-actions"><TextEditor editor={editor} relation={relation} locked={locked} locale={locale} /><button className="card-action" onClick={onDetails}>{t('查看详情')}<Icon name="arrowRight" /></button></div>
    </>}
  </aside>;
}
