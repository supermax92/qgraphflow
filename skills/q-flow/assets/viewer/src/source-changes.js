// meta.sourceDrift: source changes validate --fix listed and the author has not resolved yet. Until each item is deleted
// the Viewer marks the elements it names and lists it beside the key points; validation keeps failing meanwhile.
export const sourceChanges = graph => Array.isArray(graph.meta?.sourceDrift) ? graph.meta.sourceDrift : [];
export const driftedElements = graph => new Set(sourceChanges(graph).flatMap(item => Array.isArray(item?.elements) ? item.elements : []));
