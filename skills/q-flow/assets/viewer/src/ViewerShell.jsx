import { isArchitectureOverview, viewIdOf, viewTypeOf, viewTypeLabel } from './view-identity.js';
import { translate } from './i18n.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ControlButton, Controls, MiniMap, ReactFlow, useReactFlow, useStore } from '@xyflow/react';
import { nodeTypes, edgeTypes } from './DiagramCanvas.jsx';
import { renderMiniMapNode } from './node-svg.js';
import { diagramLabels, diagramTypeOf } from './diagrams/registry.js';
import { visibleEdgeLabel, createEdgeRoutes } from './edge-routing.js';
import { svgStyles, groupFrameSvg } from './diagrams/drawing.js';
import { anchorText, evidenceLabels, kindLabels, nodeAppearance } from './visual-style.js';
import { graphLegend, rampGradient } from './legend.js';
import { useViewerController } from './features/useViewerController.js';
import { usePopover } from './features/usePopover.js';
import { useReveal } from './features/useReveal.js';
import Icon from './icons.jsx';
import NodeCard from './NodeCard.jsx';
import TextEditor, { useTextEditor } from './TextEditor.jsx';


const APPEARANCES = ['system', 'light', 'dark'];
const appearanceLabels = { system: 'Follow system', light: 'Light', dark: 'Dark' };

// Keeps a closing panel mounted until its slide-out animation has finished; a panel that opens with the page, or that
// closes under reduced motion, skips the animation. A panel closed before its first frame has nothing to animate, so it
// has no animations and unmounts at once (transitionend would never come).
function usePresence(open, reduceMotion, ref) {
  const [shown, setShown] = useState(open ? 'still' : '');
  if (open && !shown) setShown('in'); else if (!open && shown && reduceMotion) setShown('');
  useEffect(() => {
    if (open || !shown) return undefined;
    let live = true;
    Promise.allSettled((ref.current?.getAnimations() ?? []).map(animation => animation.finished)).then(() => { if (live) setShown(''); });
    return () => { live = false; };
  }, [open, shown, ref]);
  return [shown, `${shown === 'still' ? ' is-still' : ''}${open ? '' : ' is-closing'}`];
}

export default function ViewerShell({ graph, originalGraph, graphForSave, allDiagrams, moduleColors, wash, setWash, onDiagramChange, theme, appearance, setAppearance, panels, flowControl }) {
  const zoom = useStore(state => state.transform[2]);
  const { setCenter } = useReactFlow();
  const t = (message, values) => translate(graph.meta.locale, message, values);
  const {
    diagramType, palette, reduceMotion,
    hasFlow, flowRunning, setFlowEnabled,
    inspectedNode, inspectedEdge, selectedId, selectedEdgeId, selectionPulse, query, setQuery, normalizedQuery, results, selectNode, selectEdge, clearSelectedNode, handleCanvasKeyDown,
    locked, setLocked, canvasRef, currentGraph, acceptedGraph, nodes, onNodesChange, onNodeDragStop, onOverviewKeyDown, layoutPending, cancelLayout, updateNodeText, updateEdgeText, readGraph, focusDiagram, nudgeLayout,
    visibleNodes, visibleEdges, reset, exportDiagram, saveGraph, exportStatus, layoutProblem, layoutWarnings, focusProblem,
    boardRef, fullscreenButtonRef, isFullscreen, fullscreenPending, fullscreenSupported, toggleFullscreen,
    toolbarOpen, drawerOpen, toolbarButtonRef, drawerButtonRef, searchInputRef, inspectorRef, panelRef, toggleToolbar, toggleDrawer, openDetails
  } = useViewerController(graph, theme, panels, moduleColors, originalGraph, graphForSave, flowControl);
  const [navShown, navState] = usePresence(toolbarOpen, reduceMotion, panelRef);
  const [drawerShown, drawerState] = usePresence(drawerOpen, reduceMotion, inspectorRef);
  const drawerFrozen = useRef(null);
  const editor = useTextEditor(inspectedNode, inspectedEdge, updateNodeText, updateEdgeText, graph.meta.locale, isArchitectureOverview(graph), cancelLayout);
  const { open, toggle, close } = usePopover();
  // meta.notes: a card over the top of the right side, open on wide screens until the reader hides it. It is a panel in
  // everything but name: while it shows, the reading area gives up the right edge exactly as it does for the details drawer,
  // and it waits for that drawer (even while it slides out) to be gone before it appears. Fullscreen has no panels, so
  // there it simply floats over the canvas until it is hidden.
  const notes = graph.meta.notes ?? [];
  const [notesOpen, setNotesOpen] = useState(true);
  const notesShown = notes.length > 0 && notesOpen && !drawerShown;
  const rightReserved = drawerOpen || (notesShown && !isFullscreen);
  // The hide and show buttons replace each other, so a reader's toggle hands focus to whichever one appears.
  const notesToggled = useRef(false), notesFocusRef = useRef(null);
  useEffect(() => { if (notesToggled.current) notesFocusRef.current?.focus({ preventScroll: true }); }, [notesOpen]);
  const reveal = useReveal(canvasRef, nodes, currentGraph, diagramType, reduceMotion);
  const [searchActive, setSearchActive] = useState(false);
  const [toast, setToast] = useState('');
  const [inspectedPulse, setInspectedPulse] = useState(0);
  useEffect(() => { if (drawerOpen || selectionPulse === 0) setInspectedPulse(selectionPulse); }, [drawerOpen, selectionPulse]);
  const MiniMapNode = useMemo(() => {
    const byId = new Map(visibleNodes.map(node => [node.id, node]));
    return function SharedMiniMapNode({ id, x, y, width, height, color, strokeColor, strokeWidth, className, selected, shapeRendering, onClick }) {
      const node = byId.get(id);
      const classes = `react-flow__minimap-node${className ? ` ${className}` : ''}${selected ? ' selected' : ''}`;
      if (node?.type === 'boundary') return <g className={classes} data-group-id={id} shapeRendering={shapeRendering} onClick={onClick ? event => onClick(event, id) : undefined} dangerouslySetInnerHTML={{ __html: groupFrameSvg({ ...node.data, size: { width, height } }, node.data.appearance, x, y) }} />;
      if (!node) return <rect className={classes} x={x} y={y} width={width} height={height} rx="14" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} shapeRendering={shapeRendering} onClick={onClick ? event => onClick(event, id) : undefined} />;
      const markup = renderMiniMapNode(node.data, diagramType, x, y, width, height, color, strokeColor, strokeWidth);
      return <g className={classes} data-node-id={id} shapeRendering={shapeRendering} onClick={onClick ? event => onClick(event, id) : undefined} dangerouslySetInnerHTML={{ __html: markup }} />;
    };
  }, [diagramType, visibleNodes]);
  useEffect(() => {
    if (!exportStatus) return undefined;
    setToast(t(exportStatus.message));
    const timer = window.setTimeout(() => setToast(''), 4500);
    return () => window.clearTimeout(timer);
  }, [exportStatus]);

  // Initial core emphasis does not open a card; an explicit selection does.
  const showQuickLook = selectionPulse > 0 && !drawerOpen && (diagramType !== 'sequence' || selectionPulse !== inspectedPulse) && !nodes.some(node => node.dragging);
  const cardNode = showQuickLook ? nodes.find(node => node.id === selectedId && node.type === 'diagram') : null;
  const cardEdgeView = showQuickLook ? visibleEdges.find(edge => edge.id === selectedEdgeId) : null;
  const cardEdge = cardEdgeView ? currentGraph.edges.find(edge => edge.id === cardEdgeView.id) : null;
  const cardEdgeAnchor = cardEdgeView ? { position: cardEdgeView.data.route.labelPoint, size: { width: 0, height: 0 } } : null;
  const edgeSource = cardEdge ? currentGraph.nodes.find(node => node.id === cardEdge.source) : null;
  const edgeTarget = cardEdge ? currentGraph.nodes.find(node => node.id === cardEdge.target) : null;
  const inspectedSource = inspectedEdge ? currentGraph.nodes.find(node => node.id === inspectedEdge.source) : null;
  const inspectedTarget = inspectedEdge ? currentGraph.nodes.find(node => node.id === inspectedEdge.target) : null;
  const directoryEntry = (node, index) => <button key={node.id} onClick={() => selectNode(node)}><span><i>{String(index + 1).padStart(2, '0')}</i>{node.label}</span><small>{node.subtitle ?? t(kindLabels[node.kind] ?? node.kind)}</small></button>;

  // The details panel keeps its last open content while it slides out, so closing it never flashes the empty state.
  const drawerBody = <>
    <div className="side-head"><p className="panel-title">{t('Details')}</p><button className="side-close" onClick={() => clearSelectedNode(true)} aria-label={t('Close details')} title={t('Close details')}><Icon name="close" /></button></div>
    <section className="inspector-card drawer-body" data-node-id={inspectedNode?.id} data-edge-id={inspectedEdge?.id}>{inspectedNode ? <>
        <div className="node-kicker"><span className="node-dot" style={{ backgroundColor: nodeAppearance(inspectedNode, palette, moduleColors).stroke }} />{t(inspectedNode.section ? 'Section' : kindLabels[inspectedNode.kind] ?? inspectedNode.kind)}{inspectedNode.module ? ` · ${inspectedNode.module}` : ''}</div>
        <h2>{inspectedNode.label}</h2>
        <p className="drawer-subtitle">{inspectedNode.subtitle}</p>
        {inspectedNode.overviewText?.length > 0 && <><h3>{t('Overview text')}</h3><ul>{inspectedNode.overviewText.map((line, i) => <li key={i}>{line}</li>)}</ul></>}
        {inspectedNode.badges?.length > 0 && <><h3>{t('Badges')}</h3><ul>{inspectedNode.badges.map((badge, i) => <li key={i}>{badge.label} · {t(evidenceLabels[badge.evidence])}{badge.source && <code className="source-path">{anchorText(badge.source)}</code>}</li>)}</ul></>}
        {inspectedNode.fields?.length > 0 && <><h3>{t('Fields')}</h3><ul>{inspectedNode.fields.map(field => <li key={field.name}><code>{field.key} {field.name}: {field.type}{field.nullable === false ? ' · NOT NULL' : field.nullable === true ? ' · NULL' : ''}</code></li>)}</ul></>}
        {inspectedNode.attributes?.length > 0 && <><h3>{t('Attributes')}</h3><ul>{inspectedNode.attributes.map(item => <li key={item}><code>{item}</code></li>)}</ul></>}
        {inspectedNode.methods?.length > 0 && <><h3>{t('Methods')}</h3><ul>{inspectedNode.methods.map(item => <li key={item}><code>{item}</code></li>)}</ul></>}
        {inspectedNode.source && <><h3>{t('Source')} · {t(evidenceLabels[inspectedNode.source.kind ?? 'source'] ?? inspectedNode.source.kind)}</h3><code className="source-path">{anchorText(inspectedNode.source)}</code>{inspectedNode.source.symbol && <p className="symbol">{inspectedNode.source.symbol}</p>}</>}
        {inspectedNode.tags?.length > 0 && <div className="tags">{inspectedNode.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
      </> : inspectedEdge ? <>
        <div className="node-kicker"><span className="node-dot" style={{ backgroundColor: visibleEdges.find(edge => edge.id === inspectedEdge.id)?.style.stroke ?? palette.edge }} />{t('Edges')} · {inspectedEdge.kind}</div>
        <h2>{(createEdgeRoutes(currentGraph).get(inspectedEdge.id)?.label ?? visibleEdgeLabel(inspectedEdge, diagramType, graph.meta.locale)) || inspectedEdge.kind}</h2>
        <p className="drawer-subtitle">{inspectedSource?.label} → {inspectedTarget?.label}</p>
        <h3>{t('Evidence')} · {t(evidenceLabels[inspectedEdge.evidence] ?? inspectedEdge.evidence)}</h3>
        {inspectedEdge.site && <><code className="source-path">{anchorText(inspectedEdge.site)}</code>{inspectedEdge.site.symbol && <p className="symbol">{inspectedEdge.site.symbol}</p>}</>}
        {inspectedEdge.facts?.length > 0 && <><h3>{t('Evidence facts')}</h3><ul>{inspectedEdge.facts.map(fact => <li key={fact}>{fact}</li>)}</ul></>}
      </> : <div className="drawer-empty"><span className="empty-icon"><Icon name="fit" /></span><span>{t('Start with a node')}</span><p>{t('Select a component or a list entry to explore its role, fields, methods and source.')}</p></div>}
    </section>
    {(inspectedNode || inspectedEdge) && <section className="inspector-card"><div className={editor.editing ? '' : 'card-actions'}><TextEditor editor={editor} relation={Boolean(inspectedEdge)} locked={locked} locale={graph.meta.locale} /></div></section>}
    {inspectedNode?.facts?.length > 0 && <section className="inspector-card inspector-facts" data-node-id={inspectedNode.id}><h3>{inspectedNode.source ? t('Evidence facts') : t('Node notes')}</h3><ul>{inspectedNode.facts.map(fact => <li key={fact}>{fact}</li>)}</ul></section>}
  </>;
  if (drawerOpen) drawerFrozen.current = drawerBody;

  return <main className="app-shell" data-view-id={viewIdOf(graph)}>
    <header className="toolbar">
      <div className="tb-group tb-left">
        <button className="tb" ref={toolbarButtonRef} onClick={() => { toggleToolbar(); if (!toolbarOpen) reveal(selectedId, selectedEdgeId, true, rightReserved); }} aria-controls="graph-tools" aria-expanded={toolbarOpen} aria-pressed={toolbarOpen} aria-label={toolbarOpen ? t('Hide graph navigation') : t('Show graph navigation')} title={toolbarOpen ? t('Hide graph navigation') : t('Show graph navigation')}><Icon name="panel-left" /></button>
        <div className="tb-title"><b>{graph.meta.title}</b><span>{t(viewTypeLabel(graph))} · {graph.meta.sourceRef}</span></div>
      </div>

      <div className="tb-group tb-center">
        {/* Results stay open while focus is anywhere inside the search (input or a result); Escape only blurs, so the query survives. */}
        <div className="tb-search" data-popover-root="search" onFocus={() => setSearchActive(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchActive(false); }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); event.currentTarget.contains(document.activeElement) && document.activeElement.blur(); } }}>
          <Icon name="search" />
          <input ref={searchInputRef} id="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Search nodes')} aria-label={t('Search nodes')} autoComplete="off" />
          {searchActive && normalizedQuery && <div className="popover results" role="listbox" aria-label={t('Matches · {count}', { count: results.length })} onMouseDown={event => event.preventDefault()}>
            <p className="pop-title">{t('Matches · {count}', { count: results.length })}</p>
            {results.length > 0 ? results.map((node, index) => <button key={node.id} role="option" aria-selected="false" onClick={() => selectNode(node)}><span><i>{String(index + 1).padStart(2, '0')}</i>{node.label}</span><small>{node.subtitle ?? t(kindLabels[node.kind] ?? node.kind)}</small></button>)
              : <p className="pop-empty">{t('No matches. Try a name or responsibility.')}</p>}
          </div>}
        </div>
      </div>

      <div className="tb-group tb-right">
        {allDiagrams.length > 1 && <div className="menu-anchor" data-popover-root="views">
          <button id="view-menu-button" className="tb tb-wide" onClick={() => toggle('views')} aria-haspopup="menu" aria-expanded={open === 'views'} title={t('Diagram types')}><Icon name="views" /><span>{t(viewTypeLabel(graph))}</span><Icon name="chevron" /></button>
          {open === 'views' && <div className="popover menu is-right" role="menu" aria-labelledby="view-menu-button">{allDiagrams.map(item => {
            const type = diagramTypeOf(item), viewId = viewIdOf(item), active = viewId === viewIdOf(graph);
            return <button key={viewId} data-view-id={viewId} role="menuitemradio" aria-checked={active} className={active ? 'is-current' : ''} onClick={() => { onDiagramChange(viewId, acceptedGraph); close(); }}>
              <span className="menu-mark">{active ? <Icon name="check" /> : null}</span>{`${t(viewTypeLabel(item))}${allDiagrams.filter(view => viewTypeOf(view) === viewTypeOf(item)).length > 1 ? ` · ${item.meta.title}` : ''}`}<small>{t('{count} relations', { count: item.edges.length })}</small>
            </button>;
          })}</div>}
        </div>}

        <button className="tb tb-wash" role="switch" aria-checked={wash} onClick={() => setWash(value => !value)} title={t('Card wash')} aria-label={t('Card wash')}><Icon name="wash" /></button>
        <div className="menu-anchor" data-popover-root="more">
          <button id="more-menu-button" className="tb" onClick={() => toggle('more')} aria-haspopup="menu" aria-expanded={open === 'more'} title={t('More')} aria-label={t('More')}><Icon name="more" /></button>
          {open === 'more' && <div className="popover menu is-right" role="menu" aria-labelledby="more-menu-button">
            <button role="menuitem" disabled={layoutPending} onClick={() => { exportDiagram('svg'); close(); }}><span className="menu-mark"><Icon name="download" /></span>{t('Export SVG')}</button>
            <button role="menuitem" disabled={layoutPending} onClick={() => { exportDiagram('png'); close(); }}><span className="menu-mark"><Icon name="download" /></span>{t('Export PNG')}</button>
            <button role="menuitem" disabled={layoutPending} onClick={() => { saveGraph(); close(); }}><span className="menu-mark"><Icon name="download" /></span>{t('Save changes')}</button>
            <div className="menu-sep" />
            <button role="menuitem" onClick={() => { reset(); close(); }} title={t('Restore the original layout and view, and clear search and selection.')}><span className="menu-mark"><Icon name="reset" /></span>{t('Reset')}</button>
            <div className="menu-row"><span className="menu-lead"><span className="menu-mark"><Icon name={locked ? 'lock' : 'unlock'} /></span>{t('Locked')}</span><button className="switch" role="switch" aria-checked={locked} aria-label={locked ? t('Locked') : t('Draggable')} onClick={() => setLocked(value => !value)}><i /></button></div>
            <button role="menuitem" aria-disabled={locked} title={locked ? t('Unlock the layout first') : selectedId ? t('Space the selected node and its direct neighbors') : t('Space all nodes')} onClick={() => { nudgeLayout(); close(); }}><span className="menu-mark"><Icon name="spacing" /></span>{t('Arrange')}</button>
            <div className="menu-sep" />
            <div className="menu-row menu-row-stack"><span className="menu-lead"><span className="menu-mark"><Icon name={theme === 'light' ? 'sun' : 'moon'} /></span>{t('Appearance')}</span>
              <div className="seg" role="radiogroup" aria-label={t('Appearance')} style={{ '--seg-n': APPEARANCES.length }}>
                <span className="seg-knob" aria-hidden="true" style={{ transform: `translateX(${APPEARANCES.indexOf(appearance) * 100}%)` }} />
                {APPEARANCES.map(value => <button key={value} role="radio" aria-checked={appearance === value} onClick={() => setAppearance(value)}>{t(appearanceLabels[value])}</button>)}
              </div>
            </div>
          </div>}
        </div>
        <button className="tb" ref={drawerButtonRef} onClick={() => { toggleDrawer(); if (!drawerOpen) reveal(selectedId, selectedEdgeId, toolbarOpen, true); }} aria-controls="node-inspector" aria-expanded={drawerOpen} aria-pressed={drawerOpen} title={drawerOpen ? t('Hide details') : t('Show details')} aria-label={drawerOpen ? t('Hide details') : t('Show details')}><Icon name="panel-right" /></button>
      </div>
    </header>

    <section className={`workspace ${toolbarOpen ? 'nav-open' : ''} ${drawerOpen ? 'drawer-open' : ''}`}>
      {navShown && <aside id="graph-tools" ref={panelRef} tabIndex={-1} className={`sidebar nav${navState}`} aria-label={t('Graph navigation')}>
        <div className="side-head"><p className="panel-title">{t('Graph navigation')}</p><button className="side-close" onClick={toggleToolbar} aria-label={t('Close')} title={t('Close')}><Icon name="close" /></button></div>
        <div className="project-summary"><p className="panel-title">{t('Overview')}</p>{graph.meta.scope && <p>{graph.meta.scope}</p>}<div className="stat-grid"><span><strong>{graph.nodes.length}</strong>{t('Nodes')}</span><span><strong>{graph.edges.length}</strong>{t('Edges')}</span><span><strong>{graph.groups?.length ?? 0}</strong>{t('Groups')}</span></div></div>
        <p className="result-heading">{t('Nodes · {count}', { count: graph.nodes.length })}</p>
        <div className="search-results">{currentGraph.nodes.map(directoryEntry)}</div>
      </aside>}

      <figure ref={boardRef} className="board diagram-board">
        <svg className="relation-defs" width="0" height="0" aria-hidden="true"><style>{svgStyles(palette, ':is(.node-visual,.fragment-visual,.fragment-text) ')}</style><defs><filter id="node-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="7" floodColor={palette.ink} floodOpacity=".045"/></filter><marker id="codegraph-arrow-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L9 5L1 9" fill="none" stroke="context-stroke" strokeWidth="1.5" /></marker><marker id="codegraph-triangle" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M1 1L11 6L1 11Z" fill="var(--canvas)" stroke="context-stroke"/></marker><marker id="codegraph-diamond-filled" viewBox="0 0 14 10" refX="1" refY="5" markerWidth="12" markerHeight="10" orient="auto"><path d="M1 5L7 1L13 5L7 9Z" fill="context-stroke"/></marker><marker id="codegraph-diamond-open" viewBox="0 0 14 10" refX="1" refY="5" markerWidth="12" markerHeight="10" orient="auto"><path d="M1 5L7 1L13 5L7 9Z" fill="var(--canvas)" stroke="context-stroke"/></marker></defs></svg>
        <div ref={canvasRef} aria-busy={layoutPending} className="canvas" style={{ '--sequence-flow-unit': `${Math.max(1, .6 / zoom)}px` }} data-nav-open={toolbarOpen} data-drawer-open={rightReserved} onKeyDownCapture={event => { onOverviewKeyDown(event); if (!event.defaultPrevented) handleCanvasKeyDown(event); }} aria-label={t('Interactive {type}', { type: t(viewTypeLabel(graph)) })}>
          <ReactFlow
            nodes={visibleNodes}
            edges={visibleEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onPaneClick={() => { clearSelectedNode(); close(); }}
            onNodeClick={(_, node) => { if (node.type === 'diagram') selectNode(node, false); }}
            onEdgeClick={(_, edge) => selectEdge(edge.data)}
            onNodeDragStart={(_, node) => { if (node.type === 'diagram') selectNode(node, false); }}
            onInit={() => requestAnimationFrame(() => readGraph(currentGraph, 0))}
            nodesDraggable={!locked && !layoutPending}
            nodesConnectable={false}
            deleteKeyCode={null}
            elementsSelectable
            minZoom={0.08}
            maxZoom={2}
            colorMode={theme}
            ariaLabelConfig={{ 'controls.zoomIn.ariaLabel': t('Zoom in'), 'controls.zoomOut.ariaLabel': t('Zoom out'), 'minimap.ariaLabel': t('Minimap') }}
            proOptions={{ hideAttribution: true }}
          >
            <Controls position="bottom-left" showInteractive={false} showFitView={false}>
              <ControlButton className="react-flow__controls-fitview" onClick={focusDiagram} title={t('Fit canvas')} aria-label={t('Fit canvas')}><Icon name="fit" /></ControlButton>
              <ControlButton className="react-flow__controls-fullscreen" ref={fullscreenButtonRef} onClick={toggleFullscreen} aria-pressed={isFullscreen} aria-busy={fullscreenPending} aria-disabled={fullscreenPending || (!fullscreenSupported && !isFullscreen)} aria-label={isFullscreen ? t('Exit fullscreen') : t('Enter fullscreen')} title={!fullscreenSupported && !isFullscreen ? t('Fullscreen is not available in this browser or page') : isFullscreen ? t('Exit fullscreen (Esc)') : t('Enter fullscreen')}>
                <Icon name={isFullscreen ? 'collapse' : 'expand'} />
              </ControlButton>
            </Controls>
            <MiniMap pannable zoomable onClick={(_, point) => setCenter(point.x, point.y, { zoom })} nodeComponent={MiniMapNode} nodeStrokeColor={node => node.type === 'boundary' ? 'none' : nodeAppearance(node.data, palette, moduleColors).stroke} nodeStrokeWidth={2} nodeColor={node => node.type === 'boundary' ? node.data.appearance.fill : nodeAppearance(node.data, palette, moduleColors).fill} maskColor={palette.mask} />
          </ReactFlow>

          <div className="float legend-anchor" data-popover-root="legend">
            <button className="float-btn" onClick={() => toggle('legend')} aria-expanded={open === 'legend'} aria-haspopup="true" title={t('Legend')}><Icon name="legend" /><span>{t('Legend')}</span></button>
            {open === 'legend' && <div className="popover legend-pop">
              <p className="pop-title">{t('Legend')}</p>
              <div className="legend" role="group" aria-label={t('Legend')}>{graphLegend(currentGraph, palette, moduleColors).map(entry => <span key={entry.id} data-legend-role={entry.role} data-legend-shape={entry.shape}>{entry.shape === 'ramp' ? <i className="legend-ramp" style={{ backgroundColor: entry.fill, borderColor: entry.stroke, backgroundImage: rampGradient(entry.ramp) }} /> : entry.shape === 'self' ? <svg style={{ color: entry.stroke }} width="28" height="14" viewBox="0 0 28 14" aria-hidden="true"><path d="M5 3C22 0 22 13 6 11" fill="none" stroke="currentColor" /><path d="M10 8L5.5 11L10.5 13.4" fill="none" stroke="currentColor" /></svg> : ['sync', 'async', 'return'].includes(entry.shape) ? <svg style={{ color: entry.stroke }} width="28" height="14" viewBox="0 0 28 14" aria-hidden="true"><path d="M1 7H25" stroke="currentColor" strokeDasharray={entry.shape === 'return' ? '4 3' : undefined} /><path d={entry.shape === 'sync' ? 'M19 2L26 7L19 12Z' : 'M19 2L26 7L19 12'} fill={entry.shape === 'sync' ? 'currentColor' : 'none'} stroke="currentColor" /></svg> : <i className={`legend-${entry.shape}`} style={{ backgroundColor: entry.fill ?? 'transparent', borderColor: entry.stroke, color: entry.stroke, '--legend-body': palette.surface2 }} />}{entry.label}</span>)}</div>
              {hasFlow && <div className="pop-opt"><span>{t('Edge animation')}</span><button className="switch" role="switch" aria-checked={flowRunning} disabled={Boolean(reduceMotion)} onClick={() => setFlowEnabled(value => !value)} aria-label={t('Edge animation')}><i /></button></div>}
              {reduceMotion && <p className="pop-note">{t('System reduced-motion preference is respected')}</p>}
            </div>}
          </div>

          {notes.length > 0 && !drawerShown && (notesShown
            ? <section className="float notes-anchor notes-card" aria-label={t('Key points')}>
              <div className="side-head"><p className="panel-title">{t('Key points')} · {notes.length}</p><button className="side-close" ref={notesFocusRef} onClick={() => { notesToggled.current = true; setNotesOpen(false); }} aria-label={t('Hide key points')} title={t('Hide key points')}><Icon name="close" /></button></div>
              <ul>{notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
            </section>
            : <button className="float notes-anchor float-btn" ref={notesFocusRef} aria-expanded="false" onClick={() => { notesToggled.current = true; setNotesOpen(true); if (!isFullscreen) reveal(selectedId, selectedEdgeId, toolbarOpen, true); }} aria-label={t('Show key points')} title={t('Show key points')}><Icon name="notes" /><span>{t('Key points')} · {notes.length}</span></button>)}

          {cardNode && <NodeCard node={{ ...cardNode.data, position: cardNode.position }} others={nodes} canvasRef={canvasRef} palette={palette} moduleColors={moduleColors} locale={graph.meta.locale} locked={locked} editor={editor} graph={currentGraph} isFullscreen={isFullscreen} onDetails={async () => {
            if (isFullscreen && !await toggleFullscreen()) return;
            openDetails(); reveal(selectedId, selectedEdgeId, toolbarOpen, true);
          }} onClose={() => clearSelectedNode()} />}
          {cardEdge && <NodeCard node={cardEdgeAnchor} edge={{ ...cardEdge, diagramType }} source={edgeSource} target={edgeTarget} others={nodes} canvasRef={canvasRef} palette={palette} moduleColors={moduleColors} locale={graph.meta.locale} locked={locked} editor={editor} graph={currentGraph} isFullscreen={isFullscreen} onDetails={async () => {
            if (isFullscreen && !await toggleFullscreen()) return;
            openDetails();
            reveal(selectedId, selectedEdgeId, toolbarOpen, true);
          }} onClose={() => clearSelectedNode()} />}

          {!layoutProblem && layoutWarnings.length > 0 && <details className="layout-problems"><summary>{t('Layout suggestions')}</summary>
            <p>{t('Arrange this view to improve connector clearance and spacing. Existing positions are preserved until then.')}</p>
            <ul>{[...new Set(layoutWarnings.flatMap(item => item.elementIds).filter(id => currentGraph.edges.some(edge=>edge.id===id)))].map(id => <li key={id}><button onClick={() => focusProblem(layoutWarnings.find(item=>item.elementIds.includes(id)))}>{currentGraph.edges.find(edge=>edge.id===id)?.label || t('Relationship')}</button></li>)}</ul>
          </details>}
          {layoutProblem && <details className="layout-problems"><summary>{t('Layout needs adjustment; JSON drafts can still be saved')}</summary>
            <ul>{layoutProblem.diagnostics.filter(item => item.severity === 'error').map((item, index) => <li key={index}><button onClick={() => focusProblem(item)}>{item.elementIds.join(', ')} · {item.ruleId}</button></li>)}</ul>
            <pre>{layoutProblem.message}</pre>
          </details>}
          <div className={`toast ${toast ? 'is-on' : ''}`} role="status" aria-live="polite">{toast}</div>
        </div>
      </figure>

      {drawerShown && <aside id="node-inspector" ref={inspectorRef} tabIndex={-1} className={`sidebar drawer inspector${inspectedNode || inspectedEdge ? ' is-open' : ''}${drawerState}`} aria-label={t('Details')}>
        {drawerFrozen.current}
      </aside>}
    </section>
  </main>;
}
