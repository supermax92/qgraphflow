import { translate } from './i18n.js';
import React, { useEffect, useMemo, useState } from 'react';
import { Background, ControlButton, Controls, MiniMap, ReactFlow, useReactFlow, useStore } from '@xyflow/react';
import { AnimatePresence, motion } from 'motion/react';
import { nodeTypes, edgeTypes } from './DiagramCanvas.jsx';
import { renderMiniMapNode } from './node-svg.js';
import { diagramLabels } from './diagrams/registry.js';
import { visibleEdgeLabel, createEdgeRoutes } from './edge-routing.js';
import { svgStyles } from './diagrams/drawing.js';
import { kindLabels, nodeAppearance } from './visual-style.js';
import { graphLegend } from './legend.js';
import { useViewerController } from './features/useViewerController.js';
import { usePopover } from './features/usePopover.js';
import { useReveal } from './features/useReveal.js';
import Icon from './icons.jsx';
import NodeCard from './NodeCard.jsx';
import TextEditor, { useTextEditor } from './TextEditor.jsx';

const evidenceLabels = { source: '源码', code: '代码', config: '配置', schema: '数据结构', test: '测试', document: '文档', framework: '框架约定', inference: '推断' };

const APPEARANCES = ['system', 'light', 'dark'];
const appearanceLabels = { system: '跟随系统', light: '浅色', dark: '深色' };

export default function ViewerShell({ graph, originalGraph, graphForSave, allDiagrams, moduleColors, onDiagramChange, theme, appearance, setAppearance, panels, flowControl }) {
  const zoom = useStore(state => state.transform[2]);
  const { setCenter } = useReactFlow();
  const t = (message, values) => translate(graph.meta.locale, message, values);
  const {
    diagramType, palette, reduceMotion, panelTransition,
    hasFlow, flowRunning, setFlowEnabled,
    inspectedNode, inspectedEdge, selectedId, selectedEdgeId, selectionPulse, query, setQuery, normalizedQuery, results, selectNode, selectEdge, clearSelectedNode, handleCanvasKeyDown,
    locked, setLocked, canvasRef, currentGraph, nodes, onNodesChange, updateNodeText, updateEdgeText, readGraph, focusDiagram, nudgeLayout,
    visibleNodes, visibleEdges, reset, exportDiagram, saveGraph, exportStatus, layoutProblem, focusProblem,
    boardRef, fullscreenButtonRef, isFullscreen, fullscreenPending, fullscreenSupported, toggleFullscreen,
    toolbarOpen, drawerOpen, toolbarButtonRef, drawerButtonRef, searchInputRef, inspectorRef, panelRef, toggleToolbar, toggleDrawer, openDetails
  } = useViewerController(graph, theme, panels, moduleColors, originalGraph, graphForSave, flowControl);
  const editor = useTextEditor(inspectedNode, inspectedEdge, updateNodeText, updateEdgeText, graph.meta.locale);
  const { open, toggle, close } = usePopover();
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
      if (!node || node.type === 'boundary') return <rect className={classes} x={x} y={y} width={width} height={height} rx="14" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} shapeRendering={shapeRendering} onClick={onClick ? event => onClick(event, id) : undefined} />;
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
  // Panels slide in from their own edge; under reduced motion they mount already at rest so no frame ever shows them off-screen.
  const slideFrom = offset => reduceMotion ? false : { x: offset };
  const directoryEntry = (node, index) => <button key={node.id} onClick={() => selectNode(node)}><span><i>{String(index + 1).padStart(2, '0')}</i>{node.label}</span><small>{node.subtitle ?? t(kindLabels[node.kind] ?? node.kind)}</small></button>;

  return <main className="app-shell">
    <header className="toolbar">
      <div className="tb-group tb-left">
        <button className="tb" ref={toolbarButtonRef} onClick={() => { toggleToolbar(); if (!toolbarOpen) reveal(selectedId, selectedEdgeId, true, drawerOpen); }} aria-controls="graph-tools" aria-expanded={toolbarOpen} aria-pressed={toolbarOpen} aria-label={toolbarOpen ? t('隐藏图谱导航') : t('显示图谱导航')} title={toolbarOpen ? t('隐藏图谱导航') : t('显示图谱导航')}><Icon name="panel-left" /></button>
        {allDiagrams.length > 1 && <div className="menu-anchor" data-popover-root="views">
          <button id="view-menu-button" className="tb tb-wide" onClick={() => toggle('views')} aria-haspopup="menu" aria-expanded={open === 'views'} title={t('图类型')}><Icon name="views" /><span>{t(diagramLabels[diagramType])}</span><Icon name="chevron" /></button>
          {open === 'views' && <div className="popover menu" role="menu" aria-labelledby="view-menu-button">{allDiagrams.map(item => {
            const type = item.meta.diagramType ?? 'architecture';
            return <button key={type} role="menuitemradio" aria-checked={type === diagramType} className={type === diagramType ? 'is-current' : ''} onClick={() => { onDiagramChange(type, currentGraph); close(); panels.closeMobile(); }}>
              <span className="menu-mark">{type === diagramType ? <Icon name="check" /> : null}</span>{t(diagramLabels[type])}<small>{t('{count} 条关系', { count: item.edges.length })}</small>
            </button>;
          })}</div>}
        </div>}
        <div className="tb-title"><b>{graph.meta.title}</b><span>{t(diagramLabels[diagramType])} · {graph.meta.sourceRef}</span></div>
      </div>

      <div className="tb-group tb-center">
        {/* Results stay open while focus is anywhere inside the search (input or a result); Escape only blurs, so the query survives. */}
        <div className="tb-search" data-popover-root="search" onFocus={() => setSearchActive(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchActive(false); }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); event.currentTarget.contains(document.activeElement) && document.activeElement.blur(); } }}>
          <Icon name="search" />
          <input ref={searchInputRef} id="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('搜索节点')} aria-label={t('搜索节点')} autoComplete="off" />
          {searchActive && normalizedQuery && <div className="popover results" role="listbox" aria-label={t('匹配结果 · {count}', { count: results.length })} onMouseDown={event => event.preventDefault()}>
            <p className="pop-title">{t('匹配结果 · {count}', { count: results.length })}</p>
            {results.length > 0 ? results.map((node, index) => <button key={node.id} role="option" aria-selected="false" onClick={() => selectNode(node)}><span><i>{String(index + 1).padStart(2, '0')}</i>{node.label}</span><small>{node.subtitle ?? t(kindLabels[node.kind] ?? node.kind)}</small></button>)
              : <p className="pop-empty">{t('未找到匹配节点，请试试名称或职责。')}</p>}
          </div>}
        </div>
      </div>

      <div className="tb-group tb-right">
        <div className="menu-anchor" data-popover-root="more">
          <button id="more-menu-button" className="tb" onClick={() => toggle('more')} aria-haspopup="menu" aria-expanded={open === 'more'} title={t('更多')} aria-label={t('更多')}><Icon name="more" /></button>
          {open === 'more' && <div className="popover menu is-right" role="menu" aria-labelledby="more-menu-button">
            <button role="menuitem" onClick={() => { exportDiagram('svg'); close(); }}><span className="menu-mark"><Icon name="download" /></span>{t('导出 SVG')}</button>
            <button role="menuitem" onClick={() => { exportDiagram('png'); close(); }}><span className="menu-mark"><Icon name="download" /></span>{t('导出 PNG')}</button>
            <button role="menuitem" onClick={() => { saveGraph(); close(); }}><span className="menu-mark"><Icon name="download" /></span>{t('保存 Graph JSON')}</button>
            <div className="menu-sep" />
            <button role="menuitem" onClick={() => { reset(); close(); }} title={t('恢复原始位置和阅读视角，清除搜索与选择')}><span className="menu-mark"><Icon name="reset" /></span>{t('重置')}</button>
            <div className="menu-row"><span className="menu-lead"><span className="menu-mark"><Icon name={locked ? 'lock' : 'unlock'} /></span>{t('布局锁定')}</span><button className="switch" role="switch" aria-checked={locked} aria-label={locked ? t('布局锁定') : t('可拖动')} onClick={() => setLocked(value => !value)}><i /></button></div>
            <button role="menuitem" aria-disabled={locked} title={locked ? t('请先解除布局锁定') : selectedId ? t('整理选中节点及直接邻居的间距') : t('整理全部节点的间距')} onClick={() => { nudgeLayout(); close(); }}><span className="menu-mark"><Icon name="spacing" /></span>{t('整理间距')}</button>
            <div className="menu-sep" />
            <div className="menu-row menu-row-stack"><span className="menu-lead"><span className="menu-mark"><Icon name={theme === 'light' ? 'sun' : 'moon'} /></span>{t('外观')}</span>
              <div className="seg" role="radiogroup" aria-label={t('外观')} style={{ '--seg-n': APPEARANCES.length }}>
                <span className="seg-knob" aria-hidden="true" style={{ transform: `translateX(${APPEARANCES.indexOf(appearance) * 100}%)` }} />
                {APPEARANCES.map(value => <button key={value} role="radio" aria-checked={appearance === value} onClick={() => setAppearance(value)}>{t(appearanceLabels[value])}</button>)}
              </div>
            </div>
          </div>}
        </div>
        <button className="tb" ref={drawerButtonRef} onClick={() => { toggleDrawer(); if (!drawerOpen) reveal(selectedId, selectedEdgeId, toolbarOpen, true); }} aria-controls="node-inspector" aria-expanded={drawerOpen} aria-pressed={drawerOpen} title={drawerOpen ? t('隐藏右侧详情栏') : t('显示右侧详情栏')} aria-label={drawerOpen ? t('隐藏右侧详情栏') : t('显示右侧详情栏')}><Icon name="panel-right" /></button>
      </div>
    </header>

    <section className={`workspace ${toolbarOpen ? 'nav-open' : ''} ${drawerOpen ? 'drawer-open' : ''}`}>
      <AnimatePresence initial={false}>
        {toolbarOpen && <motion.aside key="nav" id="graph-tools" ref={panelRef} tabIndex={-1} className="sidebar nav" aria-label={t('图谱导航')} initial={slideFrom('-115%')} animate={{ x: 0 }} exit={{ x: '-115%' }} transition={panelTransition}>
          <div className="side-head"><p className="panel-title">{t('图谱导航')}</p><button className="side-close" onClick={toggleToolbar} aria-label={t('关闭')} title={t('关闭')}><Icon name="close" /></button></div>
          <div className="project-summary"><p className="panel-title">{t('模型概览')}</p>{graph.meta.scope && <p>{graph.meta.scope}</p>}<div className="stat-grid"><span><strong>{graph.nodes.length}</strong>{t('节点')}</span><span><strong>{graph.edges.length}</strong>{t('关系')}</span><span><strong>{graph.groups?.length ?? 0}</strong>{t('边界')}</span></div></div>
          <p className="result-heading">{t('节点目录 · {count}', { count: graph.nodes.length })}</p>
          <div className="search-results">{currentGraph.nodes.map(directoryEntry)}</div>
        </motion.aside>}
      </AnimatePresence>

      <figure ref={boardRef} className="board diagram-board">
        <svg className="relation-defs" width="0" height="0" aria-hidden="true"><style>{svgStyles(palette, ':is(.node-visual,.fragment-visual,.fragment-text) ')}</style><defs><filter id="node-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="7" floodColor={palette.ink} floodOpacity=".045"/></filter><marker id="codegraph-arrow-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L9 5L1 9" fill="none" stroke="context-stroke" strokeWidth="1.5" /></marker><marker id="codegraph-triangle" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M1 1L11 6L1 11Z" fill="var(--canvas)" stroke="var(--edge)"/></marker><marker id="codegraph-diamond-filled" viewBox="0 0 14 10" refX="1" refY="5" markerWidth="12" markerHeight="10" orient="auto"><path d="M1 5L7 1L13 5L7 9Z" fill="var(--edge)"/></marker><marker id="codegraph-diamond-open" viewBox="0 0 14 10" refX="1" refY="5" markerWidth="12" markerHeight="10" orient="auto"><path d="M1 5L7 1L13 5L7 9Z" fill="var(--canvas)" stroke="var(--edge)"/></marker></defs></svg>
        <div ref={canvasRef} className="canvas" style={{ '--sequence-flow-unit': `${Math.max(1, .6 / zoom)}px` }} data-nav-open={toolbarOpen} data-drawer-open={drawerOpen} onKeyDownCapture={handleCanvasKeyDown} aria-label={t('可交互{type}', { type: t(diagramLabels[diagramType]) })}>
          <ReactFlow
            nodes={visibleNodes}
            edges={visibleEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onPaneClick={() => { clearSelectedNode(); close(); }}
            onNodeClick={(_, node) => { if (node.type === 'diagram') selectNode(node, false); }}
            onEdgeClick={(_, edge) => selectEdge(edge.data)}
            onNodeDragStart={(_, node) => { if (node.type === 'diagram') selectNode(node, false); }}
            onInit={() => requestAnimationFrame(() => readGraph(currentGraph, 0))}
            nodesDraggable={!locked}
            nodesConnectable={false}
            deleteKeyCode={null}
            elementsSelectable
            minZoom={0.08}
            maxZoom={2}
            colorMode={theme}
            ariaLabelConfig={{ 'controls.zoomIn.ariaLabel': t('放大'), 'controls.zoomOut.ariaLabel': t('缩小'), 'minimap.ariaLabel': t('小地图') }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color={palette.ruleSoft} gap={24} size={0.65} />
            <Controls position="bottom-left" showInteractive={false} showFitView={false}>
              <ControlButton className="react-flow__controls-fitview" onClick={focusDiagram} title={t('适应画布')} aria-label={t('适应画布')}><Icon name="fit" /></ControlButton>
              <ControlButton className="react-flow__controls-fullscreen" ref={fullscreenButtonRef} onClick={toggleFullscreen} aria-pressed={isFullscreen} aria-busy={fullscreenPending} aria-disabled={fullscreenPending || (!fullscreenSupported && !isFullscreen)} aria-label={isFullscreen ? t('退出全屏') : t('进入全屏')} title={!fullscreenSupported && !isFullscreen ? t('当前浏览器或页面不支持全屏') : isFullscreen ? t('退出全屏（Esc）') : t('进入全屏')}>
                <Icon name={isFullscreen ? 'collapse' : 'expand'} />
              </ControlButton>
            </Controls>
            <MiniMap pannable zoomable onClick={(_, point) => setCenter(point.x, point.y, { zoom })} nodeComponent={MiniMapNode} nodeStrokeColor={node => node.type === 'boundary' ? palette.rule : nodeAppearance(node.data, palette, moduleColors).moduleColor ?? palette.ink3} nodeStrokeWidth={2} nodeColor={node => node.type === 'boundary' ? palette.surface2 : nodeAppearance(node.data, palette, moduleColors).fill} maskColor={palette.mask} />
          </ReactFlow>

          <div className="float legend-anchor" data-popover-root="legend">
            <button className="float-btn" onClick={() => toggle('legend')} aria-expanded={open === 'legend'} aria-haspopup="true" title={t('阅读图例')}><Icon name="legend" /><span>{t('图例')}</span></button>
            {open === 'legend' && <div className="popover legend-pop">
              <p className="pop-title">{t('阅读图例')}</p>
              <div className="legend" role="group" aria-label={t('阅读图例')}>{graphLegend(currentGraph, palette, moduleColors).map(entry => <span key={entry.id} data-legend-role={entry.role} data-legend-shape={entry.shape}>{['sync', 'async', 'return'].includes(entry.shape) ? <svg style={{ color: entry.stroke }} width="28" height="14" viewBox="0 0 28 14" aria-hidden="true"><path d="M1 7H25" stroke="currentColor" strokeDasharray={entry.shape === 'return' ? '4 3' : undefined} /><path d={entry.shape === 'sync' ? 'M19 2L26 7L19 12Z' : 'M19 2L26 7L19 12'} fill={entry.shape === 'sync' ? 'currentColor' : 'none'} stroke="currentColor" /></svg> : <i className={`legend-${entry.shape}`} style={{ backgroundColor: entry.fill ?? 'transparent', borderColor: entry.stroke, color: entry.stroke, '--legend-body': palette.surface2 }} />}{entry.label}</span>)}</div>
              {hasFlow && <div className="pop-opt"><span>{t('连线流动')}</span><button className="switch" role="switch" aria-checked={flowRunning} disabled={Boolean(reduceMotion)} onClick={() => setFlowEnabled(value => !value)} aria-label={t('连线流动')}><i /></button></div>}
              {reduceMotion && <p className="pop-note">{t('已遵循系统减少动态效果设置')}</p>}
            </div>}
          </div>


          {cardNode && <NodeCard node={{ ...cardNode.data, position: cardNode.position }} others={nodes} canvasRef={canvasRef} palette={palette} moduleColors={moduleColors} locale={graph.meta.locale} locked={locked} editor={editor} graph={currentGraph} isFullscreen={isFullscreen} onDetails={async () => {
            if (isFullscreen && !await toggleFullscreen()) return;
            openDetails(); reveal(selectedId, selectedEdgeId, toolbarOpen, true);
          }} onClose={() => clearSelectedNode()} />}
          {cardEdge && <NodeCard node={cardEdgeAnchor} edge={{ ...cardEdge, diagramType }} source={edgeSource} target={edgeTarget} others={nodes} canvasRef={canvasRef} palette={palette} moduleColors={moduleColors} locale={graph.meta.locale} locked={locked} editor={editor} graph={currentGraph} isFullscreen={isFullscreen} onDetails={async () => {
            if (isFullscreen && !await toggleFullscreen()) return;
            openDetails();
            reveal(selectedId, selectedEdgeId, toolbarOpen, true);
          }} onClose={() => clearSelectedNode()} />}

          {layoutProblem && <details className="layout-problems"><summary>{t('布局需要调整，仍可保存 JSON 草稿')}</summary>
            <ul>{layoutProblem.diagnostics.filter(item => item.severity === 'error').map((item, index) => <li key={index}><button onClick={() => focusProblem(item)}>{item.elementIds.join(', ')} · {item.ruleId}</button></li>)}</ul>
            <pre>{layoutProblem.message}</pre>
          </details>}
          <div className={`toast ${toast ? 'is-on' : ''}`} role="status" aria-live="polite">{toast}</div>
        </div>
      </figure>

      <AnimatePresence initial={false}>
        {drawerOpen && <motion.aside key="drawer" id="node-inspector" ref={inspectorRef} tabIndex={-1} className={`sidebar drawer inspector ${inspectedNode || inspectedEdge ? 'is-open' : ''}`} aria-label={t('详情')} initial={slideFrom('115%')} animate={{ x: 0 }} exit={{ x: '115%' }} transition={panelTransition}>
          <div className="side-head"><p className="panel-title">{t('详情')}</p><button className="side-close" onClick={() => clearSelectedNode(true)} aria-label={t('关闭详情')} title={t('关闭详情')}><Icon name="close" /></button></div>
          <section className="inspector-card drawer-body" data-node-id={inspectedNode?.id} data-edge-id={inspectedEdge?.id}>{inspectedNode ? <>
              <div className="node-kicker"><span className="node-dot" style={{ backgroundColor: nodeAppearance(inspectedNode, palette, moduleColors).moduleColor ?? nodeAppearance(inspectedNode, palette).stroke }} />{t(kindLabels[inspectedNode.kind] ?? inspectedNode.kind)}{inspectedNode.module ? ` · ${inspectedNode.module}` : ''}</div>
              <h2>{inspectedNode.label}</h2>
              <p className="drawer-subtitle">{inspectedNode.subtitle}</p>
              {inspectedNode.fields?.length > 0 && <><h3>{t('字段')}</h3><ul>{inspectedNode.fields.map(field => <li key={field.name}><code>{field.key} {field.name}: {field.type}{field.nullable === false ? ' · NOT NULL' : field.nullable === true ? ' · NULL' : ''}</code></li>)}</ul></>}
              {inspectedNode.attributes?.length > 0 && <><h3>{t('属性')}</h3><ul>{inspectedNode.attributes.map(item => <li key={item}><code>{item}</code></li>)}</ul></>}
              {inspectedNode.methods?.length > 0 && <><h3>{t('方法')}</h3><ul>{inspectedNode.methods.map(item => <li key={item}><code>{item}</code></li>)}</ul></>}
              {inspectedNode.source && <><h3>{t('来源')} · {t(evidenceLabels[inspectedNode.source.kind ?? 'source'] ?? inspectedNode.source.kind)}</h3><code className="source-path">{inspectedNode.source.file}:{inspectedNode.source.lineStart}{inspectedNode.source.lineEnd ? `-${inspectedNode.source.lineEnd}` : ''}</code>{inspectedNode.source.symbol && <p className="symbol">{inspectedNode.source.symbol}</p>}</>}
              {inspectedNode.tags?.length > 0 && <div className="tags">{inspectedNode.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
            </> : inspectedEdge ? <>
              <div className="node-kicker"><span className="node-dot" style={{ backgroundColor: visibleEdges.find(edge => edge.id === inspectedEdge.id)?.style.stroke ?? palette.edge }} />{t('关系')} · {inspectedEdge.kind}</div>
              <h2>{(createEdgeRoutes(currentGraph).get(inspectedEdge.id)?.label ?? visibleEdgeLabel(inspectedEdge, diagramType)) || inspectedEdge.kind}</h2>
              <p className="drawer-subtitle">{inspectedSource?.label} → {inspectedTarget?.label}</p>
              <h3>{t('证据')}</h3><p>{inspectedEdge.evidence}</p>
              {inspectedEdge.facts?.length > 0 && <><h3>{t('证据事实')}</h3><ul>{inspectedEdge.facts.map(fact => <li key={fact}>{fact}</li>)}</ul></>}
            </> : <div className="drawer-empty"><span className="empty-icon"><Icon name="fit" /></span><span>{t('从一个节点开始')}</span><p>{t('点击图中组件或左侧目录，查看职责、字段、方法与来源。')}</p></div>}
          </section>
          {(inspectedNode || inspectedEdge) && <section className="inspector-card"><div className={editor.editing ? '' : 'card-actions'}><TextEditor editor={editor} relation={Boolean(inspectedEdge)} locked={locked} locale={graph.meta.locale} /></div></section>}
          {inspectedNode?.facts?.length > 0 && <section className="inspector-card inspector-facts" data-node-id={inspectedNode.id}><h3>{inspectedNode.source ? t('证据事实') : t('节点说明')}</h3><ul>{inspectedNode.facts.map(fact => <li key={fact}>{fact}</li>)}</ul></section>}
        </motion.aside>}
      </AnimatePresence>
    </section>
  </main>;
}
