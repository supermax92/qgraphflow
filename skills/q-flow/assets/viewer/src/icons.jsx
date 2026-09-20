import React from 'react';

// Icon geometry from Lucide (MIT); see THIRD_PARTY_NOTICES.md.
const GLYPHS = {
  'panel-left': <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></>,
  'panel-right': <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" /></>,
  views: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  spacing: <><path d="m18 8 4 4-4 4" /><path d="m6 8-4 4 4 4" /><path d="M2 12h20" /></>,
  wash: <path d="M12 2.5c-.6 2.6-2.2 5-4.3 6.9C5.9 11 5 13 5 15a7 7 0 0 0 14 0c0-2-.9-4-2.7-5.6C14.2 7.5 12.6 5.1 12 2.5Z" />,
  more: <><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  unlock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></>,
  reset: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></>,
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></>,
  close: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  legend: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 5h7" /><path d="M14 9h5" /><path d="M14 16h7" /><path d="M14 20h5" /></>,
  source: <><path d="M10 12.5 8 15l2 2.5" /><path d="m14 12.5 2 2.5-2 2.5" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /></>,
  arrowRight: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  fit: <><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></>,
  expand: <><path d="m15 3 6 0 0 6" /><path d="m9 21-6 0 0-6" /><path d="M21 3 14 10" /><path d="M3 21l7-7" /></>,
  collapse: <><path d="M10 14H4v6" /><path d="M20 4h-6v6" /><path d="m4 20 6-6" /><path d="m20 4-6 6" /></>
};

export default function Icon({ name }) {
  return <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{GLYPHS[name]}</svg>;
}
