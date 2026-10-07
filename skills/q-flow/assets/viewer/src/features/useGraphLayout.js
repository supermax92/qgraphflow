import { affectedRouteIds } from '../route-clearance.js';
import LayoutWorker from '../layout-browser-worker.js?worker&inline';
import { minimumNodeSize } from '../layout-measure.js';
import { isArchitectureOverview } from '../view-identity.js';
import { overviewSections, reorderOverview } from '../architecture-overview.js';
import { translate } from '../i18n.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getViewportForBounds, useEdgesState, useNodesState, useReactFlow } from '@xyflow/react';
import { compactCards, diagramTypeOf } from '../diagrams/registry.js';
import { initialNodes, initialEdges } from '../DiagramCanvas.jsx';
import { graphBounds, occupiedBox } from '../edge-routing.js';
import { qualityFailure, requireDiagramQuality } from '../layout-quality.js';
import { nudgeGraphLayout } from '../layout-nudge.js';
import { appleEase, readingPadding, readingRect, locateViewport, readableViewport, readingStart } from '../reading-area.js';
import { constrainNodeChanges, currentGraphFromFlow, fitCard, placed } from '../session-graph.js';

export function useGraphLayout(graph, reduceMotion, setStatus, originalGraph = graph) {
  const t = (message, values) => translate(graph.meta.locale, message, values);
  const diagramType = diagramTypeOf(graph);
  const [nodes, setNodes, applyNodeChanges] = useNodesState(initialNodes(graph, diagramType));
  const [edges, setEdges] = useEdgesState(initialEdges(graph, diagramType));
  const [locked, setLocked] = useState(true);
  const canvasRef = useRef(null);
  const { getViewport, setCenter, setViewport } = useReactFlow();
  // Recording and QA drivers steer the camera through the same viewport API as the page when it is opened with
  // ?automation=1; ordinary pages expose nothing.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('automation')) return undefined;
    window.__qgraphflowAutomation = { getViewport, setViewport, setCenter, ease: appleEase };
    return () => { delete window.__qgraphflowAutomation; };
  }, [getViewport, setViewport, setCenter]);
  const [graphDraft, setGraphDraft] = useState(graph);
  const currentGraph = useMemo(() => currentGraphFromFlow(graphDraft, nodes, edges), [graphDraft, nodes, edges]);
  const installOverview = next => { setGraphDraft(next); setNodes(initialNodes(next, diagramType)); setEdges(initialEdges(next, diagramType)); };
  const pendingLayout = useRef(null);
  const layoutRevision = useRef(0);
  const [layoutPending, setLayoutPending] = useState(false);
  const cancelLayout = ({ superseded = false } = {}) => {
    layoutRevision.current++;
    if (!pendingLayout.current) return;
    const operation = pendingLayout.current; pendingLayout.current = null;
    operation.worker.terminate(); setLayoutPending(false); operation.reject(Object.assign(new Error('Cancelled'), { cancelled: true, superseded }));
  };
  useEffect(() => () => cancelLayout({ superseded: true }), []);
  const runLayout = (input, options = {}, overview = false) => new Promise((resolve, reject) => {
    cancelLayout({ superseded: true });
    const worker = new LayoutWorker(), operation = { worker, reject };
    pendingLayout.current = operation; setLayoutPending(true);
    const finish = (result, error) => {
      if (pendingLayout.current !== operation) return;
      pendingLayout.current = null; setLayoutPending(false); worker.terminate();
      if (error) reject(error); else resolve(result);
    };
    worker.onmessage = ({ data }) => finish(data.result, data.error && Object.assign(new Error(data.error.message), data.error));
    worker.onerror = event => finish(null, new Error(event.message));
    if (!options.relayout) options = { ...options, edgeIds: [...affectedRouteIds(graphDraft, input, options.edgeIds)] };
    worker.postMessage({ graph: input, reference: graphDraft, options, overview });
  });
  const applyShared = async (input, options = {}, overview = false) => {
    let revision;
    try {
      const task = runLayout(input, { move: false, evaluations: 1, passes: 2, ...options }, overview);
      revision = layoutRevision.current;
      const result = await task;
      if (revision !== layoutRevision.current) return { error: t('Cancelled'), cancelled: true, superseded: true };
      installOverview(result.graph); setRenderProblem(null); return result;
    } catch (error) {
      if (!error.cancelled && revision !== layoutRevision.current) return { error: t('Cancelled'), cancelled: true, superseded: true };
      if (error.cancelled) return { error: t('Cancelled'), cancelled: true, superseded: error.superseded };
      const problem = error.diagnostics?.length ? error : qualityFailure(input, 'geometry', error.message);
      setRenderProblem({ graph: currentGraph, message: problem.message, diagnostics: problem.diagnostics });
      return { error: problem.message };
    }
  };
  const applyOverview = async (input, options = {}) => (await applyShared(input, options, true)).error;
  const onNodeDragStop = async (_, node) => {
    if (node.type !== 'diagram') return;
    if (isArchitectureOverview(currentGraph)) {
      try { const result = await applyShared(currentGraph, {}, true); if (result.error && !result.superseded) { installOverview(graphDraft); if (!result.cancelled) setStatus(result.error); } }
      catch (error) { installOverview(graphDraft); setStatus(error.message); }
    } else {
      const result = await applyShared(currentGraph, { growBoundaries: true });
      if (result.error && !result.superseded) { installOverview(graphDraft); if (!result.cancelled) setStatus(result.error); }
    }
  };
  const onOverviewKeyDown = async event => {
    const direction = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const element = event.target.closest('.react-flow__node-diagram');
    if (!isArchitectureOverview(currentGraph) || !direction || !element) return;
    event.preventDefault(); event.stopPropagation();
    if (locked || event.repeat) return;
    const id = element.dataset.id, node = graphDraft.nodes.find(item => item.id === id);
    const section = overviewSections(graphDraft).find(item => item.items?.some(child => child.nodeId === id));
    const peers = section ? section.items.filter(item => item.nodeId).map(item => graphDraft.nodes.find(node => node.id === item.nodeId)) : graphDraft.nodes.filter(item => item.groupId && item.groupId === node?.groupId);
    const next = peers[peers.findIndex(item => item.id === id) + direction];
    if (next) { const error = await applyOverview(reorderOverview(graphDraft, id, next.position)); if (error) setStatus(error); }
  };
  const [renderProblem, setRenderProblem] = useState(null);
  const onNodesChange = useCallback(changes => applyNodeChanges(constrainNodeChanges(changes, nodes, diagramType)), [applyNodeChanges, diagramType, nodes]);
  const layoutProblem = useMemo(() => {
    try { requireDiagramQuality(currentGraph); return renderProblem?.graph === currentGraph ? renderProblem : null; }
    catch (error) { return { message: error.message, diagnostics: error.diagnostics ?? [] }; }
  }, [currentGraph, renderProblem]);
  const layoutWarnings = useMemo(() => {
    try { return requireDiagramQuality(currentGraph).diagnostics.filter(item => item.severity === 'warning'); }
    catch { return []; }
  }, [currentGraph]);
  const updateNodeText = async (id, label, subtitle, extra = {}) => {
    if (isArchitectureOverview(currentGraph)) {
      const edited = structuredClone(currentGraph), section = overviewSections(edited).find(item => item.id === id);
      if (section) { section.title = label; section.text = extra.overviewText ?? section.text; }
      else edited.nodes = edited.nodes.map(node => node.id === id ? { ...node, label, subtitle, ...extra } : node);
      return applyOverview(edited);
    }
    const edited = { ...currentGraph, nodes: currentGraph.nodes.map(node => node.id === id ? { ...node, label, subtitle } : node) };
    const fitted = placed(edited, fitCard(edited, id, !compactCards(currentGraph)));
    const target = fitted.nodes.find(node => node.id === id);
    if (!target) return;
    if (!compactCards(fitted) || !['architecture', 'deployment'].includes(diagramType)) {
      const minimum = minimumNodeSize(target, diagramType, fitted.meta.locale);
      target.size = { width: Math.max(target.size.width, minimum.width), height: Math.max(target.size.height, minimum.height) };
    }
    let result = await applyShared(fitted);
    if (result.error && !result.cancelled) result = await applyShared(fitted, { move: true, focusId: id, evaluations: 12, passes: 1 });
    return result.error;
  };
  const updateEdgeText = async (id, label) => {
    if (isArchitectureOverview(currentGraph)) return applyOverview({ ...currentGraph, edges: currentGraph.edges.map(edge => edge.id === id ? { ...edge, label } : edge) });
    return (await applyShared({ ...currentGraph, edges: currentGraph.edges.map(edge => edge.id === id ? { ...edge, label } : edge) })).error;
  };

  const readGraph = (targetGraph, duration = reduceMotion ? 0 : 320, overview = false) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const bounds = graphBounds(targetGraph), navOpen = canvas.dataset.navOpen === 'true', drawerOpen = canvas.dataset.drawerOpen === 'true';
    // Fit canvas (overview) always shows everything; every other re-fit opens at the readable floor when everything is too small.
    const viewport = (!overview && readableViewport(bounds, readingStart(targetGraph), readingRect(canvas, navOpen, drawerOpen)))
      || getViewportForBounds(bounds, canvas.clientWidth, canvas.clientHeight, .08, 2, readingPadding(canvas, navOpen, drawerOpen));
    return setViewport(viewport, { duration, ease: appleEase });
  };
  const focusNode = useCallback((id, panels = {}) => {
    const node = currentGraph.nodes.find(item => item.id === id) ?? overviewSections(currentGraph).find(item => item.id === id);
    if (!node) return;
    if (diagramType !== 'sequence') {
      setCenter(node.position.x + node.size.width / 2, node.position.y + node.size.height / 2, { zoom: 1.1, duration: reduceMotion ? 0 : 420, ease: appleEase });
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const area = readingRect(canvas, panels.navOpen ?? canvas.dataset.navOpen === 'true', panels.drawerOpen ?? canvas.dataset.drawerOpen === 'true');
    const viewport = locateViewport(occupiedBox(node, diagramType), area, getViewport());
    setViewport(viewport, { duration: reduceMotion ? 0 : 420, ease: appleEase });
  }, [currentGraph, diagramType, getViewport, reduceMotion, setCenter, setViewport]);
  const resetLayout = () => {
    cancelLayout({ superseded: true });
    setGraphDraft(originalGraph); setRenderProblem(null); setNodes(initialNodes(originalGraph, diagramType)); setEdges(initialEdges(originalGraph, diagramType)); requestAnimationFrame(() => readGraph(originalGraph)); };
  const nudgeLayout = async selectedId => {
    if (locked) { setStatus('Unlock the layout before arranging nodes'); return; }
    if (isArchitectureOverview(currentGraph)) { const error = await applyOverview(currentGraph, { relayout: !selectedId }); if (!error) setStatus('Overview aligned'); return; }
    const nudged = nudgeGraphLayout(currentGraph, selectedId);
    const input = nudged.rejected ? currentGraph : nudged.graph;
    const result = await applyShared(input, { move: true, relayout: !selectedId, focusId: selectedId, evaluations: 20, passes: 1 });
    if (result.cancelled) return;
    if (result.error) { setStatus('Cannot arrange further within the current constraints'); return; }
    result.movedNodeIds = result.graph.nodes.filter(node => {
      const before = currentGraph.nodes.find(item => item.id === node.id);
      return before.position.x !== node.position.x || before.position.y !== node.position.y;
    }).map(node => node.id);

    const movement = result.movedNodeIds.length, scope = t(selectedId ? 'Local' : 'Full diagram');
    setStatus(movement ? t('{scope} arranged: {count} nodes moved', { scope, count: movement }) : t('No spacing changes needed'));
  };
  const focusProblem = problem => {
    const rect = problem.bounds?.[0];
    if (rect) setCenter(rect.x + rect.width / 2, rect.y + rect.height / 2, { zoom: 1, duration: reduceMotion ? 0 : 320 });
  };
  return { layoutPending, cancelLayout, nodes, edges, onNodesChange, onNodeDragStop, onOverviewKeyDown, setRenderProblem, updateNodeText, updateEdgeText, locked, setLocked, canvasRef, currentGraph, acceptedGraph: graphDraft, layoutProblem, layoutWarnings, focusProblem, readGraph, focusNode, resetLayout, nudgeLayout, focusDiagram: () => readGraph(currentGraph, reduceMotion ? 0 : 320, true) };
}
