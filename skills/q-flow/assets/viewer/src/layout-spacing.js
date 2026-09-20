// Graph units: safety limits are shared by generation, editing and export.
export const LAYOUT_LIMITS = Object.freeze({ nodeGap: 48, labelGap: 24, labelEdgeGap: 6, groupHeadingGap: 24, groupInset: 32, groupGap: 48, endpoint: 12, erEndpoint: 28, parallelGap: 24, messageGap: 6 });
export const LAYOUT_TARGETS = Object.freeze({ nodeGap: 64, layerGap: 80, edgeNodeGap: 24, labelWidth: 320, headingWidth: 360 });
// A finished diagram keeps its width/height ratio between 1/ASPECT_BAND (portrait) and ASPECT_BAND (landscape); the graph's
// own shape decides which side. Type budgets only express a preferred orientation inside this band.
export const ASPECT_BAND = 1.6;
// A shape within this factor of the band counts as acceptable: it triggers no fold, and among folds the fewest segments
// within it win. Without the slack a one-percent overshoot could trigger a fold that costs far more than it fixes.
export const ASPECT_SLACK = 1.1;
// How far a width/height ratio sits outside the band, as a factor ≥ 1; 1 means inside. Callers compare it to two decimals,
// so a shape within one percent of the band edge counts as inside.
export const ratioExcess = ratio => Math.max(ratio / ASPECT_BAND, 1 / (ratio * ASPECT_BAND), 1);
