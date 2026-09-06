import React from 'react';
import { Background, ControlButton, Controls, MiniMap, ReactFlow } from '@xyflow/react';
import { AnimatePresence, motion } from 'motion/react';
import { nodeTypes, edgeTypes } from './DiagramCanvas.jsx';
import { diagramLabels } from './diagrams/registry.js';
import { svgStyles } from './diagrams/drawing.js';
import { kindLabels, nodeAppearance } from './visual-style.js';
import { graphLegend } from './legend.js';
import { useViewerController } from './features/useViewerController.js';

const evidenceLabels = { source: '源码', code: '代码', config: '配置', schema: '数据结构', test: '测试', document: '文档', framework: '框架约定', inference: '推断' };

// RotateCcw and Focus geometry from Lucide; see THIRD_PARTY_NOTICES.md.
function ViewIcon({ type }) {
  if (type === 'layout') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /></svg>;
}

export default function ViewerShell({ graph, allDiagrams, onDiagramChange, theme, setTheme, panels }) {
  const {
    diagramType, palette, reduceMotion, panelTransition,
    hasFlow, hasPlayback, playing, pausePlayback, startPlayback, playbackStep, playbackCount, playbackMode, playbackDescription, flowCopy, flowStatus, stepPlayback, flowRunning, setFlowEnabled,
    inspectedNode, selectedId, query, setQuery, normalizedQuery, results, selectNode, clearSelectedNode, handleCanvasKeyDown,
    locked, setLocked, canvasRef, currentGraph, onNodesChange, readGraph, focusDiagram, nudgeLayout,
    visibleNodes, visibleEdges, reset, exportDiagram, exportStatus,
    boardRef, fullscreenButtonRef, isFullscreen, fullscreenPending, fullscreenSupported, toggleFullscreen,
    toolbarOpen, drawerOpen, toolbarButtonRef, drawerButtonRef, searchInputRef, inspectorRef, toggleToolbar, toggleDrawer
  } = useViewerController(graph, theme, panels);
  return <main className="app-shell">
    <header className="topbar">
      <div className="brand" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M24 18A10 10 0 1 0 18 24"/><path className="brand-flow" d="M16 16l7.5 7.5C24.9 24.9 26 26 28 26"/></svg></div>
      <div className="heading">
        <p className="eyebrow">QGraphFlow</p><h1>{graph.meta.title}</h1>
        <p>{diagramLabels[diagramType]} · {graph.meta.sourceRef}</p>
      </div>
      <div className="top-actions">
        {hasPlayback && <motion.button className={`soft-button ${playing ? 'is-on' : ''}`} title="播放或暂停逐步演示；连线流动由左栏开关独立控制" whileTap={reduceMotion ? undefined : { scale: 0.96 }} onClick={() => playing ? pausePlayback() : startPlayback()} aria-pressed={playing}>{playing ? 'Ⅱ 暂停' : '▶ 播放'}</motion.button>}
        <motion.button className="soft-button" whileTap={reduceMotion ? undefined : { scale: 0.96 }} onClick={reset} title="恢复原始位置和阅读视角，清除搜索与选择，从第一步恢复默认播放">重置</motion.button>
        <motion.button className="soft-button" whileTap={reduceMotion ? undefined : { scale: 0.96 }} onClick={focusDiagram}>适应窗口</motion.button>
        <motion.button className="soft-button" whileTap={reduceMotion ? undefined : { scale: 0.96 }} onClick={() => setTheme(value => value === 'light' ? 'dark' : 'light')}>{theme === 'light' ? '深色' : '浅色'}</motion.button>
        <motion.button className="soft-button" whileTap={reduceMotion ? undefined : { scale: 0.96 }} onClick={() => exportDiagram('svg')}>SVG</motion.button>
        <motion.button className="soft-button" whileTap={reduceMotion ? undefined : { scale: 0.96 }} onClick={() => exportDiagram('png')}>PNG</motion.button>
        <motion.button className={`soft-button ${locked ? 'is-on' : ''}`} whileTap={reduceMotion ? undefined : { scale: 0.96 }} onClick={() => setLocked(value => !value)} aria-pressed={locked}>{locked ? '布局锁定' : '可拖动'}</motion.button>
        <motion.button className="soft-button icon-button" whileTap={reduceMotion || locked ? undefined : { scale: 0.96 }} onClick={nudgeLayout} aria-disabled={locked} title={locked ? '请先解除布局锁定' : selectedId ? '整理选中节点及直接邻居的间距' : '整理全部节点的间距'}><ViewIcon type="layout" />整理间距</motion.button>
        <div className="panel-switcher" role="group" aria-label="面板显示">
          <motion.button whileTap={reduceMotion ? undefined : { scale: 0.88 }} className={toolbarOpen ? 'is-on' : ''} ref={toolbarButtonRef} onClick={toggleToolbar} aria-controls="graph-tools" aria-expanded={toolbarOpen} aria-label={toolbarOpen ? '隐藏左侧工具栏' : '显示左侧工具栏'} aria-pressed={toolbarOpen} title={toolbarOpen ? '隐藏左侧工具栏' : '显示左侧工具栏'}>
            <span className="panel-icon panel-icon-left" aria-hidden="true" />
          </motion.button>
          <motion.button whileTap={reduceMotion ? undefined : { scale: 0.88 }} className={drawerOpen ? 'is-on' : ''} ref={drawerButtonRef} onClick={toggleDrawer} aria-controls="node-inspector" aria-expanded={drawerOpen} aria-label={drawerOpen ? '隐藏右侧详情栏' : '显示右侧详情栏'} aria-pressed={drawerOpen} title={drawerOpen ? '隐藏右侧详情栏' : '显示右侧详情栏'}>
            <span className="panel-icon panel-icon-right" aria-hidden="true" />
          </motion.button>
        </div>
      </div>
    </header>

    <section className={`workspace ${toolbarOpen ? '' : 'without-toolbar'} ${drawerOpen ? '' : 'without-drawer'}`}>
      <AnimatePresence initial={false} mode="popLayout">
        {toolbarOpen && <motion.aside key="toolbar" id="graph-tools" className="panel toolbar navigator" aria-label="图谱工具" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={panelTransition}>
          <div className="project-summary"><p className="panel-title">模型概览</p>{graph.meta.scope && <p>{graph.meta.scope}</p>}<div className="stat-grid"><span><strong>{graph.nodes.length}</strong>节点</span><span><strong>{graph.edges.length}</strong>关系</span><span><strong>{graph.groups?.length ?? 0}</strong>边界</span></div></div>
          {allDiagrams.length > 1 && <nav className="tabs" aria-label="图类型">{allDiagrams.map((item, index) => {
            const type = item.meta.diagramType ?? 'architecture';
            return <button key={type} className={`tab ${type === diagramType ? 'is-active' : ''}`} onClick={() => { onDiagramChange(type); panels.closeMobile(); }} aria-current={type === diagramType ? 'page' : undefined}><i>{String(index + 1).padStart(2, '0')}</i>{diagramLabels[type]}</button>;
          })}</nav>}
          <div className="demo-controls">
            <label className="field" htmlFor="search">搜索节点<input ref={searchInputRef} id="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="名称、职责、字段…" /></label>
            <div className="field playback-controls" data-playback-mode={playbackMode}>逐步演示<p className="step-description playback-notice">{playbackDescription}</p>{hasPlayback ? <><div className="step-actions"><button onClick={() => stepPlayback(-1)}>← 上一步</button><button onClick={() => stepPlayback(1)}>下一步 →</button></div><p className="step-description">{playbackStep + 1} / {playbackCount} · {flowCopy}</p></> : <p className="step-description">暂无可演示节点</p>}{hasFlow && <><button className="flow-toggle" role="switch" aria-checked={flowRunning} disabled={Boolean(reduceMotion)} onClick={() => setFlowEnabled(value => !value)}>连线流动<span>{flowRunning ? '开' : '关'}</span></button>{reduceMotion && <p className="step-description">已遵循系统减少动态效果设置</p>}</>}</div>
            <p className="result-heading">{normalizedQuery ? `匹配结果 · ${results.length}` : `节点目录 · ${results.length}`}</p>
            {results.length > 0 ? <div className="search-results">{results.map((node, index) => <button key={node.id} onClick={() => selectNode({ ...node, width: node.size.width, height: node.size.height })}><span><i>{String(index + 1).padStart(2, '0')}</i>{node.label}</span><small>{node.subtitle ?? kindLabels[node.kind]}</small></button>)}</div> : <p className="search-empty">未找到匹配节点，请试试名称或职责。</p>}

          </div>
        </motion.aside>}
      </AnimatePresence>

      <figure ref={boardRef} className="board diagram-board">
        <svg className="relation-defs" width="0" height="0" aria-hidden="true"><style>{svgStyles(palette, '.node-visual ')}</style><defs><filter id="node-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="7" floodColor={palette.ink} floodOpacity=".045"/></filter><marker id="codegraph-triangle" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M1 1L11 6L1 11Z" fill="var(--canvas)" stroke="var(--edge)"/></marker><marker id="codegraph-diamond-filled" viewBox="0 0 14 10" refX="1" refY="5" markerWidth="12" markerHeight="10" orient="auto"><path d="M1 5L7 1L13 5L7 9Z" fill="var(--edge)"/></marker><marker id="codegraph-diamond-open" viewBox="0 0 14 10" refX="1" refY="5" markerWidth="12" markerHeight="10" orient="auto"><path d="M1 5L7 1L13 5L7 9Z" fill="var(--canvas)" stroke="var(--edge)"/></marker></defs></svg>
        <header className="board-head">
          <h2>{diagramLabels[diagramType]}</h2>
          <div className="legend" role="group" aria-label="阅读图例">阅读图例：{graphLegend(graph, palette).map(entry => <span key={entry.id} data-legend-role={entry.role} data-legend-shape={entry.shape}><i className={`legend-${entry.shape}`} style={{ backgroundColor: entry.fill ?? 'transparent', borderColor: entry.stroke, color: entry.stroke, '--legend-body': palette.surface2 }} />{entry.label}</span>)}</div>
          <span className="status-pill" role="status">{flowStatus}</span>
        </header>
        <div ref={canvasRef} className="canvas" onKeyDownCapture={handleCanvasKeyDown} aria-label={`可交互${diagramLabels[diagramType]}`}>
          <ReactFlow
            nodes={visibleNodes}
            edges={visibleEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onPaneClick={() => clearSelectedNode()}
            onNodeClick={(_, node) => { if (node.type === 'diagram') selectNode(node); }}
            onNodeDragStart={(_, node) => { if (node.type === 'diagram') selectNode(node, false); }}
            onEdgeClick={pausePlayback}
            onInit={() => requestAnimationFrame(() => readGraph(currentGraph, 0))}
            nodesDraggable={!locked}
            nodesConnectable={false}
            deleteKeyCode={null}
            elementsSelectable
            minZoom={0.08}
            maxZoom={2}
            colorMode={theme}
            proOptions={{ hideAttribution: true }}
          >
            <Background color={palette.ruleSoft} gap={24} size={0.65} />
            <Controls position="bottom-left" showInteractive={false} showFitView={false}>
              <ControlButton className="react-flow__controls-fitview" onClick={focusDiagram} title="适应画布" aria-label="适应画布"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="2" /></svg></ControlButton>
              <ControlButton className="react-flow__controls-fullscreen" ref={fullscreenButtonRef} onClick={toggleFullscreen} aria-pressed={isFullscreen} aria-busy={fullscreenPending} aria-disabled={fullscreenPending || (!fullscreenSupported && !isFullscreen)} aria-label={isFullscreen ? '退出全屏' : '进入全屏'} title={!fullscreenSupported && !isFullscreen ? '当前浏览器或页面不支持全屏' : isFullscreen ? '退出全屏（Esc）' : '进入全屏'}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d={isFullscreen ? 'M8 2v6H2v2h8V2zm6 0v8h8V8h-6V2zM2 14v2h6v6h2v-8zm12 0v8h2v-6h6v-2z' : 'M2 2v8h2V4h6V2zm12 0v2h6v6h2V2zM2 14v8h8v-2H4v-6zm18 0v6h-6v2h8v-8z'} /></svg>
              </ControlButton>
            </Controls>
            <MiniMap pannable zoomable nodeStrokeColor={palette.ink3} nodeStrokeWidth={1} nodeColor={node => node.type === 'boundary' ? palette.surface2 : nodeAppearance(node.data, palette).fill} maskColor={palette.mask} />
          </ReactFlow>
          {hasPlayback && <div className={`flow-hud ${playing ? '' : 'is-paused'}`}><i /><strong>{flowCopy}</strong></div>}
        </div>
        <figcaption className="board-foot"><span role="status">{exportStatus || `${graph.nodes.length} 个节点 · ${graph.edges.length} 条关系`}</span><span>{isFullscreen ? '滚轮缩放 · 拖动画布 · Esc 退出全屏' : '滚轮缩放 · 拖动画布 · 点击节点查看详情'}</span></figcaption>
      </figure>

      <AnimatePresence initial={false} mode="popLayout">
        {drawerOpen && <motion.aside key="drawer" id="node-inspector" ref={inspectorRef} tabIndex={-1} className={`panel drawer inspector ${inspectedNode ? 'is-open' : ''}`} aria-label="节点说明" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={panelTransition}>
          <p className="panel-title">节点详情</p>
          <section className="inspector-card drawer-body" data-node-id={inspectedNode?.id}>{inspectedNode ? <>
              <button className="drawer-close" onClick={() => clearSelectedNode(true)} aria-label="关闭详情">×</button>
              <div className="node-kicker"><span className="node-dot" style={{ backgroundColor: nodeAppearance(inspectedNode, palette).stroke }} />{kindLabels[inspectedNode.kind] ?? inspectedNode.kind}</div>
              <h2>{inspectedNode.label}</h2>
              <p className="drawer-subtitle">{inspectedNode.subtitle}</p>
              {inspectedNode.fields?.length > 0 && <><h3>字段</h3><ul>{inspectedNode.fields.map(field => <li key={field.name}><code>{field.key} {field.name}: {field.type}{field.nullable === false ? ' · NOT NULL' : field.nullable === true ? ' · NULL' : ''}</code></li>)}</ul></>}
              {inspectedNode.attributes?.length > 0 && <><h3>属性</h3><ul>{inspectedNode.attributes.map(item => <li key={item}><code>{item}</code></li>)}</ul></>}
              {inspectedNode.methods?.length > 0 && <><h3>方法</h3><ul>{inspectedNode.methods.map(item => <li key={item}><code>{item}</code></li>)}</ul></>}
              {inspectedNode.source && <><h3>来源 · {evidenceLabels[inspectedNode.source.kind ?? 'source'] ?? inspectedNode.source.kind}</h3><code className="source-path">{inspectedNode.source.file}:{inspectedNode.source.lineStart}{inspectedNode.source.lineEnd ? `-${inspectedNode.source.lineEnd}` : ''}</code>{inspectedNode.source.symbol && <p className="symbol">{inspectedNode.source.symbol}</p>}</>}
              {inspectedNode.tags?.length > 0 && <div className="tags">{inspectedNode.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
            </> : <div className="drawer-empty"><span className="empty-icon"><ViewIcon type="focus" /></span><span>从一个节点开始</span><p>点击图中组件或左侧目录，查看职责、字段、方法与来源。</p></div>}
          </section>
          {hasPlayback && <section className="inspector-card"><strong>当前步骤</strong><p>{flowCopy}</p></section>}
          {inspectedNode?.facts?.length > 0 && <section className="inspector-card inspector-facts" data-node-id={inspectedNode.id}><h3>{inspectedNode.source ? '证据事实' : '节点说明'}</h3><ul>{inspectedNode.facts.map(fact => <li key={fact}>{fact}</li>)}</ul></section>}
        </motion.aside>}
      </AnimatePresence>
    </section>
  </main>;
}
