import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './styles.css';
import './effects.css';
import ViewerShell from './ViewerShell.jsx';
import { DIAGRAM_TYPES } from './diagrams/registry.js';
import { moduleColorMap, PALETTES, themeVariables } from './visual-style.js';
import { usePanels } from './features/usePanels.js';
import { graphInputWithEdits } from './session-graph.js';

const input = JSON.parse(document.querySelector('#graph-data').textContent);
const diagrams = [...(Array.isArray(input.diagrams) ? input.diagrams : [input])]
  .sort((left, right) => DIAGRAM_TYPES.indexOf(left.meta?.diagramType ?? 'architecture') - DIAGRAM_TYPES.indexOf(right.meta?.diagramType ?? 'architecture'));

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

// Appearance follows the system by default; a manual choice wins in both directions and survives switching diagrams.
function useAppearance() {
  const [preference, setPreference] = useState('system');
  const [systemDark, setSystemDark] = useState(darkQuery.matches);
  useEffect(() => {
    const sync = event => setSystemDark(event.matches);
    darkQuery.addEventListener('change', sync);
    return () => darkQuery.removeEventListener('change', sync);
  }, []);
  return { preference, setPreference, theme: preference === 'system' ? (systemDark ? 'dark' : 'light') : preference };
}

function Viewer() {
  const [activeType, setActiveType] = useState(diagrams[0].meta.diagramType ?? 'architecture');
  const drafts = useRef(new Map());
  const flowControl = useState(true);
  const { preference, setPreference, theme } = useAppearance();
  const panels = usePanels();
  const originalGraph = diagrams.find(item => (item.meta.diagramType ?? 'architecture') === activeType) ?? diagrams[0];
  const graph = drafts.current.get(activeType) ?? originalGraph;
  const switchDiagram = (type, currentGraph) => {
    drafts.current.set(activeType, currentGraph);
    setActiveType(type);
  };
  const graphForSave = currentGraph => graphInputWithEdits(input, drafts.current, currentGraph);
  const moduleColors = useMemo(() => moduleColorMap(diagrams, PALETTES[theme]), [theme]);
  useEffect(() => { document.documentElement.lang = graph.meta.locale ?? 'zh-CN'; }, [graph.meta.locale]);
  useEffect(() => { document.title = `${graph.meta.title} · QGraphFlow`; }, [graph.meta.title]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.appearance = preference;
    for (const [name, value] of Object.entries(themeVariables(PALETTES[theme]))) document.documentElement.style.setProperty(name, value);
  }, [theme, preference]);
  return <ReactFlowProvider><ViewerShell flowControl={flowControl} key={activeType} graph={graph} originalGraph={originalGraph} graphForSave={graphForSave} allDiagrams={diagrams} moduleColors={moduleColors} onDiagramChange={switchDiagram} theme={theme} appearance={preference} setAppearance={setPreference} panels={panels} /></ReactFlowProvider>;
}

createRoot(document.getElementById('root')).render(<Viewer />);
