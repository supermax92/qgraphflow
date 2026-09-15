import React from 'react';
import { renderSelection } from './node-svg.js';

export default function SelectionOutline({ data, pulse }) {
  const { markup, height } = renderSelection(data, data.diagramType);
  return <svg className={`selection-feedback selection-outline selection-node-outline ${pulse > 0 ? 'is-animated' : ''}`} data-selection-pulse={pulse} viewBox={`0 0 ${data.size.width} ${height}`} style={{ height }} aria-hidden="true">
    <g className="selection-node-halo" dangerouslySetInnerHTML={{ __html: markup }} />
    <g className="selection-node-shine" dangerouslySetInnerHTML={{ __html: markup }} />
  </svg>;
}
