import { useCallback, useEffect, useState } from 'react';
import { PALETTES } from '../visual-style.js';
import { useGraphLayout } from './useGraphLayout.js';
import { hasArrow } from '../diagrams/registry.js';
import { useSelection } from './useSelection.js';
import { usePresentation } from './usePresentation.js';
import { useFullscreen } from './useFullscreen.js';
import { downloadDiagram, saveGraphJson } from './download.js';

export function useViewerController(graph, theme, panels, moduleColors, originalGraph, graphForSave, flowControl) {
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(preference.matches);
    sync(); preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);
  const [exportStatus, setExportStatus] = useState(null);
  const setStatus = useCallback(message => setExportStatus({ message }), []);
  const palette = PALETTES[theme];
  const layout = useGraphLayout(graph, reduceMotion, setStatus, originalGraph);
  const [flowEnabled, setFlowEnabled] = flowControl;
  const flowRunning = flowEnabled && !reduceMotion;
  const fullscreen = useFullscreen(setStatus, () => layout.readGraph(layout.currentGraph, 0));
  const selection = useSelection(layout.currentGraph, {
    focusNode: layout.focusNode, panels,
    isFullscreen: fullscreen.isFullscreen, toggleFullscreen: fullscreen.toggleFullscreen
  });
  const presentation = usePresentation(graph, layout, selection, flowRunning, palette, moduleColors);
  const exportDiagram = async format => {
    layout.setRenderProblem(null);
    const error = await downloadDiagram(layout.currentGraph, theme, format, setStatus, moduleColors);
    if (error?.diagnostics) layout.setRenderProblem({ graph: layout.currentGraph, message: error.message, diagnostics: error.diagnostics });
  };
  const saveGraph = () => saveGraphJson(graphForSave(layout.currentGraph), graph.meta.locale, setStatus);
  const reset = () => {
    layout.resetLayout(); selection.resetSelection(); setFlowEnabled(true);
    setStatus('已重置：恢复原始位置和阅读视角');
  };
  return { ...layout, ...selection, ...presentation, ...panels, ...fullscreen,
    diagramType: graph.meta.diagramType ?? 'architecture', palette, moduleColors, reduceMotion, exportStatus, exportDiagram, saveGraph, reset,
    inspectedNode: selection.selected, inspectedEdge: selection.selectedEdge, hasFlow: graph.edges.some(edge => hasArrow(edge, graph.meta.diagramType ?? 'architecture')), flowRunning, setFlowEnabled,
    nudgeLayout: () => layout.nudgeLayout(selection.selectedId),
    // Apple's default spring: critically damped (no bounce) with a ~0.36s visible duration. Reduced motion lands immediately.
    panelTransition: reduceMotion ? { duration: 0 } : { type: 'spring', visualDuration: .36, bounce: 0 }
  };
}
