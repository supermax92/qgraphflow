// Persist only the layout version; callers of preserve never upgrade it implicitly.
export const LAYOUT_VERSION = 'templates-v4-clearance-compact-elkjs-0.11.0';
export const currentLayout = graph => /^templates-v([4-9]|\d{2,})-/.test(graph.layout?.version ?? '');
export const alignedLayout = graph => /^templates-v([3-9]|\d{2,})-/.test(graph.layout?.version ?? '');
export const tieredLayout = graph => /^templates-v([2-9]|\d{2,})-/.test(graph.layout?.version ?? '');
export const layoutWeights = Object.freeze({ bends: .5, crossings: 2 });
