import React from 'react';
import { renderSelection } from './node-svg.js';

export default function SelectionOutline({ data, pulse, playback = false }) {
  const { markup, height } = renderSelection(data, data.diagramType);
  return <svg className={`${playback ? 'playback-feedback playback-outline' : 'selection-feedback selection-outline'} selection-node-outline ${pulse > 0 ? 'is-animated' : ''}`} data-selection-pulse={playback ? undefined : pulse} data-playback-pulse={playback ? pulse : undefined} viewBox={`0 0 ${data.size.width} ${height}`} style={{ height }} aria-hidden="true">
    <g className="selection-node-halo" dangerouslySetInnerHTML={{ __html: markup }} />
    <g className="selection-node-shine" dangerouslySetInnerHTML={{ __html: markup }} />
  </svg>;
}
