import { useCallback, useEffect, useState } from 'react';
import { PALETTES } from '../visual-style.js';
import { useGraphLayout } from './useGraphLayout.js';
import { diagramTypeOf, hasArrow } from '../diagrams/registry.js';
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
    layout.resetLayout(); selection.resetSelection(); setFlowEnabled(false);
    setStatus('Reset: original positions and reading view restored');
  };
  return { ...layout, ...selection, ...presentation, ...panels, ...fullscreen,
    diagramType: diagramTypeOf(graph), palette, moduleColors, reduceMotion, exportStatus, exportDiagram, saveGraph, reset,
    inspectedNode: selection.selected, inspectedEdge: selection.selectedEdge, hasFlow: graph.edges.some(edge => hasArrow(edge, diagramTypeOf(graph))), flowRunning, setFlowEnabled,
    nudgeLayout: () => layout.nudgeLayout(selection.selectedId)
  };
}
