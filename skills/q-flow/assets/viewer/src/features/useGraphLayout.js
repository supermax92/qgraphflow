import { translate } from '../i18n.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getViewportForBounds, useEdgesState, useNodesState, useReactFlow } from '@xyflow/react';
import { cubicBezier } from 'motion';
import { initialNodes, initialEdges } from '../DiagramCanvas.jsx';
import { graphBounds, occupiedBox } from '../edge-routing.js';
import { requireDiagramQuality } from '../layout-quality.js';
import { nudgeGraphLayout } from '../layout-nudge.js';
import { readingPadding, readingRect, locateViewport } from '../reading-area.js';
import { isCore } from '../visual-style.js';
import { constrainNodeChanges, currentGraphFromFlow } from '../session-graph.js';

// cubic-bezier(.32,.72,0,1) as an easing function, so viewport moves share the chrome's curve (--ease in styles.css).
export const appleEase = cubicBezier(.32, .72, 0, 1);

export function useGraphLayout(graph, reduceMotion, setStatus, originalGraph = graph) {
  const t = (message, values) => translate(graph.meta.locale, message, values);
  const diagramType = graph.meta.diagramType ?? 'architecture';
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
  const currentGraph = useMemo(() => currentGraphFromFlow(originalGraph, nodes, edges), [originalGraph, nodes, edges]);
  const [renderProblem, setRenderProblem] = useState(null);
  const onNodesChange = useCallback(changes => applyNodeChanges(constrainNodeChanges(changes, nodes, diagramType)), [applyNodeChanges, diagramType, nodes]);
  const layoutProblem = useMemo(() => {
    try { requireDiagramQuality(currentGraph); return renderProblem?.graph === currentGraph ? renderProblem : null; }
    catch (error) { return { message: error.message, diagnostics: error.diagnostics ?? [] }; }
  }, [currentGraph, renderProblem]);
  const updateNodeText = (id, label, subtitle) => {
    setNodes(current => current.map(node => node.id === id ? { ...node, data: { ...node.data, label, ...(Object.hasOwn(node.data, 'subtitle') || subtitle !== '' ? { subtitle } : {}) } } : node));
  };
  const updateEdgeText = (id, label) => {
    setEdges(current => current.map(edge => edge.id === id ? { ...edge, data: { ...edge.data, label } } : edge));
  };
  const readGraph = (targetGraph, duration = reduceMotion ? 0 : 320, overview = false) => {
    const canvas = canvasRef.current; if (!canvas) return;
    if (diagramType === 'sequence' && canvas.clientWidth <= 700 && !overview) {
      const node = targetGraph.nodes.find(isCore) ?? targetGraph.nodes[0];
      return setViewport(locateViewport(occupiedBox(node, diagramType), readingRect(canvas, false, false), { zoom: .75 }), { duration, ease: appleEase });
    }
    const viewport = getViewportForBounds(graphBounds(targetGraph), canvas.clientWidth, canvas.clientHeight, .08, 2,
      readingPadding(canvas, canvas.dataset.navOpen === 'true', canvas.dataset.drawerOpen === 'true'));
    return setViewport(viewport, { duration, ease: appleEase });
  };
  const focusNode = useCallback((id, panels = {}) => {
    const node = currentGraph.nodes.find(item => item.id === id);
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
  const resetLayout = () => { setNodes(initialNodes(originalGraph, diagramType)); setEdges(initialEdges(originalGraph, diagramType)); requestAnimationFrame(() => readGraph(originalGraph)); };
  const nudgeLayout = selectedId => {
    if (locked) { setStatus('Unlock the layout before arranging nodes'); return; }
    const result = nudgeGraphLayout(currentGraph, selectedId);
    if (result.rejected) { setStatus('Cannot arrange further within the current constraints'); return; }
    const positions = new Map(result.graph.nodes.map(node => [node.id, node.position]));
    setNodes(current => current.map(node => node.type === 'diagram' ? { ...node, position: positions.get(node.id) } : node));
    const movement = result.movedNodeIds.length, scope = t(selectedId ? 'Local' : 'Full diagram');
    setStatus(movement ? t('{scope} arranged: {count} nodes moved', { scope, count: movement }) : t('No spacing changes needed'));
  };
  const focusProblem = problem => {
    const rect = problem.bounds?.[0];
    if (rect) setCenter(rect.x + rect.width / 2, rect.y + rect.height / 2, { zoom: 1, duration: reduceMotion ? 0 : 320 });
  };
  return { nodes, edges, onNodesChange, setRenderProblem, updateNodeText, updateEdgeText, locked, setLocked, canvasRef, currentGraph, layoutProblem, focusProblem, readGraph, focusNode, resetLayout, nudgeLayout, focusDiagram: () => readGraph(currentGraph, reduceMotion ? 0 : 320, true) };
}
