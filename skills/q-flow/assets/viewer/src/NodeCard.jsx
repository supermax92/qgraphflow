import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useViewport } from '@xyflow/react';
import { translate } from './i18n.js';
import Icon from './icons.jsx';
import { visibleEdgeLabel } from './edge-routing.js';
import { kindLabels, nodeAppearance } from './visual-style.js';

const CARD_WIDTH = 292, CARD_HEIGHT = 232, GAP = 14, EDGE = 14, TOOLBAR = 52;

// One quick-look surface serves nodes and relations. It is anchored beside the selected geometry and tries
// right → left → below → above before accepting the least node overlap.
export default function NodeCard({ node, edge, source, target, others = [], canvasRef, palette, moduleColors, locale, locked, onSaveNode, onSaveEdge, onDetails, onClose }) {
  const viewport = useViewport();
  const t = (message, values) => translate(locale, message, values);
  const relation = Boolean(edge);
  const label = relation ? visibleEdgeLabel(edge, edge.diagramType) || edge.kind : node.label;
  const ref = useRef(null), editButtonRef = useRef(null), labelRef = useRef(null), returnFocus = useRef(false);
  const [cardHeight, setCardHeight] = useState(CARD_HEIGHT);
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(relation ? edge.label ?? '' : node.label);
  const [draftSubtitle, setDraftSubtitle] = useState(node?.subtitle ?? '');
  const [error, setError] = useState('');
  useEffect(() => {
    setEditing(false); setError('');
    setDraftLabel(relation ? edge.label ?? '' : node.label);
    setDraftSubtitle(node?.subtitle ?? '');
  }, [relation ? edge.id : node.id]);
  useEffect(() => {
    if (!editing && returnFocus.current) { returnFocus.current = false; editButtonRef.current?.focus(); }
  }, [editing]);
  useLayoutEffect(() => { const height = ref.current?.offsetHeight; if (height && height !== cardHeight) setCardHeight(height); });
  const box = canvasRef.current?.getBoundingClientRect();
  if (!node || !box?.width) return null;
  const toScreen = (position, size) => ({ left: position.x * viewport.zoom + viewport.x, top: position.y * viewport.zoom + viewport.y, width: size.width * viewport.zoom, height: size.height * viewport.zoom });
  const self = toScreen(node.position, node.size);
  const top = TOOLBAR + EDGE;
  const candidates = [
    { side: 'right', x: self.left + self.width + GAP, y: self.top },
    { side: 'left', x: self.left - GAP - CARD_WIDTH, y: self.top },
    { side: 'below', x: self.left, y: self.top + self.height + GAP },
    { side: 'above', x: self.left, y: self.top - GAP - cardHeight }
  ];
  const fits = item => item.x >= EDGE && item.x + CARD_WIDTH <= box.width - EDGE && item.y >= top && item.y + cardHeight <= box.height - EDGE;
  const neighbours = others.filter(item => item.type === 'diagram' && (!node.id || item.id !== node.id)).map(item => toScreen(item.position, { width: item.measured?.width ?? item.style.width, height: item.measured?.height ?? item.style.height }));
  const covered = item => neighbours.reduce((sum, rect) => sum + Math.max(0, Math.min(item.x + CARD_WIDTH, rect.left + rect.width) - Math.max(item.x, rect.left)) * Math.max(0, Math.min(item.y + cardHeight, rect.top + rect.height) - Math.max(item.y, rect.top)), 0);
  const fitting = candidates.filter(fits);
  const pick = fitting.find(item => covered(item) === 0) ?? fitting.sort((a, b) => covered(a) - covered(b))[0] ?? candidates[2];
  const x = Math.min(Math.max(pick.x, EDGE), Math.max(EDGE, box.width - CARD_WIDTH - EDGE));
  const y = Math.min(Math.max(pick.y, top), Math.max(top, box.height - cardHeight - EDGE));
  const anchor = !relation && node.source ? `${node.source.file}:${node.source.lineStart}${node.source.lineEnd ? `-${node.source.lineEnd}` : ''}` : null;
  const cancel = () => { returnFocus.current = true; setEditing(false); setError(''); };
  const save = event => {
    event.preventDefault();
    const nextLabel = draftLabel.trim();
    if (!nextLabel) { setError(t('名称不能为空')); labelRef.current?.focus(); return; }
    if (relation) onSaveEdge(edge.id, nextLabel); else onSaveNode(node.id, nextLabel, draftSubtitle.trim());
    setEditing(false); setError('');
  };
  const color = relation ? moduleColors?.get(edge.module ?? source?.module ?? target?.module) ?? palette.edge : nodeAppearance(node, palette, moduleColors).moduleColor ?? nodeAppearance(node, palette).stroke;
  return <aside ref={ref} className={`node-card ${relation ? 'relation-card' : ''} ${pick.side === 'left' ? 'is-flipped' : pick.side === 'below' ? 'is-below' : pick.side === 'above' ? 'is-above' : ''}`} style={{ left: x, top: y, width: CARD_WIDTH }} role="dialog" aria-label={label} data-node-id={relation ? undefined : node.id} data-edge-id={relation ? edge.id : undefined}>
    <button className="card-close" onClick={onClose} aria-label={t('关闭')}><Icon name="close" /></button>
    {editing ? <form className="card-form" onSubmit={save} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); } }}>
      <label>{t('名称')}<input ref={labelRef} autoFocus required value={draftLabel} onChange={event => { setDraftLabel(event.target.value); setError(''); }} aria-invalid={Boolean(error)} /></label>
      {!relation && <label>{t('说明')}<textarea value={draftSubtitle} onChange={event => setDraftSubtitle(event.target.value)} /></label>}
      {error && <p className="card-error" role="alert">{error}</p>}
      <div className="card-actions"><button type="button" onClick={cancel}>{t('取消')}</button><button type="submit">{t('保存')}</button></div>
    </form> : <>
      <p className="card-kicker"><span className="node-dot" style={{ backgroundColor: color }} />{relation ? `${t('关系')} · ${edge.kind}` : `${t(kindLabels[node.kind] ?? node.kind)}${node.module ? ` · ${node.module}` : ''}`}</p>
      <h4>{label}</h4>
      {relation ? <p className="card-subtitle">{source?.label} → {target?.label}</p> : node.subtitle && <p className="card-subtitle">{node.subtitle}</p>}
      {anchor && <p className="card-source" title={anchor}><Icon name="source" /><code>{anchor}</code></p>}
      {relation && edge.evidence && <p className="card-source">{t('证据')} · {edge.evidence}</p>}
      {!relation && node.tags?.length > 0 && <div className="card-tags">{node.tags.slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}</div>}
      <div className="card-actions"><button ref={editButtonRef} disabled={locked} title={locked ? t('请先解除布局锁定') : ''} onClick={() => setEditing(true)}>{t('编辑文字')}</button><button className="card-action" onClick={onDetails}>{t('查看详情')}<Icon name="arrowRight" /></button></div>
    </>}
  </aside>;
}
