import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './styles.css';
import ViewerShell from './ViewerShell.jsx';
import { DIAGRAM_TYPES } from './diagrams/registry.js';
import { PALETTES, themeVariables } from './visual-style.js';
import { usePanels } from './features/usePanels.js';

const input = JSON.parse(document.querySelector('#graph-data').textContent);
const diagrams = [...(Array.isArray(input.diagrams) ? input.diagrams : [input])]
  .sort((left, right) => DIAGRAM_TYPES.indexOf(left.meta?.diagramType ?? 'architecture') - DIAGRAM_TYPES.indexOf(right.meta?.diagramType ?? 'architecture'));

function Viewer() {
  const [activeType, setActiveType] = useState(diagrams[0].meta.diagramType ?? 'architecture');
  const [theme, setTheme] = useState('light');
  const panels = usePanels();
  const graph = diagrams.find(item => (item.meta.diagramType ?? 'architecture') === activeType) ?? diagrams[0];
  useEffect(() => { document.title = `${graph.meta.title} · QGraphFlow`; }, [graph.meta.title]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    for (const [name, value] of Object.entries(themeVariables(PALETTES[theme]))) document.documentElement.style.setProperty(name, value);
  }, [theme]);
  return <ReactFlowProvider><ViewerShell key={activeType} graph={graph} allDiagrams={diagrams} onDiagramChange={setActiveType} theme={theme} setTheme={setTheme} panels={panels} /></ReactFlowProvider>;
}

createRoot(document.getElementById('root')).render(<Viewer />);
