import { useCallback, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { PALETTES } from '../visual-style.js';
import { useGraphLayout } from './useGraphLayout.js';
import { hasArrow } from '../diagrams/registry.js';
import { useSelection } from './useSelection.js';
import { usePresentation } from './usePresentation.js';
import { useFullscreen } from './useFullscreen.js';
import { downloadDiagram, saveGraphJson } from './download.js';

export function useViewerController(graph, theme, panels, moduleColors, originalGraph, graphForSave) {
  const reduceMotion = useReducedMotion();
  const [exportStatus, setExportStatus] = useState(null);
  const setStatus = useCallback(message => setExportStatus({ message }), []);
  const palette = PALETTES[theme];
  const layout = useGraphLayout(graph, reduceMotion, setStatus, originalGraph);
  const [flowEnabled, setFlowEnabled] = useState(true);
  const flowRunning = flowEnabled && !reduceMotion;
  const fullscreen = useFullscreen(setStatus, () => layout.readGraph(layout.currentGraph, 0));
  const selection = useSelection(layout.currentGraph, {
    focusNode: layout.focusNode, panels,
    isFullscreen: fullscreen.isFullscreen, toggleFullscreen: fullscreen.toggleFullscreen
  });
  const presentation = usePresentation(graph, layout, selection, flowRunning, palette, moduleColors);
  const exportDiagram = format => downloadDiagram(layout.currentGraph, theme, format, setStatus, moduleColors);
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
