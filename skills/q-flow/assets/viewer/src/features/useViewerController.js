import { useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { PALETTES } from '../visual-style.js';
import { useGraphLayout } from './useGraphLayout.js';
import { usePlayback } from './usePlayback.js';
import { useSelection } from './useSelection.js';
import { usePresentation } from './usePresentation.js';
import { useFullscreen } from './useFullscreen.js';
import { downloadDiagram } from './download.js';

export function useViewerController(graph, theme, panels) {
  const reduceMotion = useReducedMotion();
  const [exportStatus, setStatus] = useState('');
  const palette = PALETTES[theme];
  const layout = useGraphLayout(graph, reduceMotion, setStatus);
  const playback = usePlayback(graph, reduceMotion);
  const fullscreen = useFullscreen(setStatus, () => layout.fitGraph(layout.currentGraph, 0));
  const selection = useSelection(graph, {
    pausePlayback: playback.pausePlayback, focusNode: layout.focusNode, panels,
    initialFollowPlayback: playback.playing, isFullscreen: fullscreen.isFullscreen, toggleFullscreen: fullscreen.toggleFullscreen
  });
  const inspectedNode = selection.followPlayback
    ? graph.nodes.find(node => node.id === playback.playbackNodeId)
    : selection.selected;
  const startPlayback = () => {
    selection.setFollowPlayback(true);
    playback.setPlaying(true);
  };
  const stepPlayback = delta => {
    selection.setFollowPlayback(true);
    playback.stepPlayback(delta);
  };
  const presentation = usePresentation(graph, layout, selection, playback, palette);
  const exportDiagram = format => downloadDiagram(layout.currentGraph, theme, format, setStatus);
  const reset = () => {
    layout.resetLayout(); selection.resetSelection(playback.playbackCount > 1 && !reduceMotion); playback.resetPlayback();
    setStatus('已重置：恢复原始位置和第一步');
  };
  return { ...layout, ...playback, ...selection, ...presentation, ...panels, ...fullscreen,
    diagramType: graph.meta.diagramType ?? 'architecture', palette, reduceMotion, exportStatus, exportDiagram, reset,
    inspectedNode, startPlayback, stepPlayback,
    nudgeLayout: () => layout.nudgeLayout(selection.selectedId),
    panelTransition: reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34, mass: .75 }
  };
}
