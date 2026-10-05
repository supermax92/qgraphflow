// Graph units: safety limits are shared by generation, editing and export.
export const LAYOUT_LIMITS = Object.freeze({ nodeGap: 48, labelGap: 24, labelEdgeGap: 6, groupHeadingGap: 24, groupInset: 32, groupGap: 48, endpoint: 12, parallelGap: 24 });
export const LAYOUT_TARGETS = Object.freeze({ nodeGap: 64, layerGap: 80, edgeNodeGap: 24, labelWidth: 320, headingWidth: 360 });
// Compact component cards (architecture, deployment) stack closer and sit closer to their boundary; the target keeps 8 units
// of drag room above the limit.
const CARD_LIMITS = Object.freeze({ ...LAYOUT_LIMITS, nodeGap: 32, groupInset: 24, groupGap: 32 }), CARD_TARGETS = Object.freeze({ ...LAYOUT_TARGETS, nodeGap: 40, layerGap: 48 });
export const layoutLimits = diagram => diagram?.cardLayout ? CARD_LIMITS : LAYOUT_LIMITS;
export const layoutTargets = diagram => diagram?.cardLayout ? CARD_TARGETS : LAYOUT_TARGETS;
// A finished diagram keeps its width/height ratio between 1/ASPECT_BAND (portrait) and ASPECT_BAND (landscape); the graph's
// own shape decides which side. Type budgets only express a preferred orientation inside this band.
export const ASPECT_BAND = 1.6;
// A shape within this factor of the band counts as acceptable: it triggers no fold, and among folds the fewest segments
// within it win. Without the slack a one-percent overshoot could trigger a fold that costs far more than it fixes.
export const ASPECT_SLACK = 1.1;
// How far a width/height ratio sits outside the band, as a factor ≥ 1; 1 means inside. Callers compare it to two decimals,
// so a shape within one percent of the band edge counts as inside.
export const ratioExcess = ratio => Math.max(ratio / ASPECT_BAND, 1 / (ratio * ASPECT_BAND), 1);
// First-screen zoom floor: fitting everything below it would shrink the 14/16/20px text under about 10px, so the Viewer opens
// at this scale on the start of the reading flow instead (14/16/20px read as 10.5/12/15px).
export const READABLE_ZOOM = .75;
// Whole-view floor: a view that fits the screen at this zoom or more opens whole, its 20/16px text read as at least 9/7.2px
// like a printed overview; a larger view opens at READABLE_ZOOM on the start of the reading flow.
export const OVERVIEW_ZOOM = .45;
// What "one screen" means for the size advisory: the reading rectangle of a 1440×900 window with both panels closed
// (readingRect), and how many such screens a view may need at READABLE_ZOOM before generation suggests splitting it.
export const OVERVIEW_AREA = Object.freeze({ width: 1392, height: 688 });
export const MAX_SCREENS = 4;
// Layered direction. ER, deployment, data flow and use case read left to right; architecture is laid out both ways and keeps the
// result that shows the whole view on one OVERVIEW_AREA at the larger zoom. The compiler records its choice in layout.direction,
// and a direction already there is kept.
const RIGHT_TYPES = ['er', 'deployment', 'dataflow', 'usecase'];
export const layeredDirections = type => type === 'architecture' ? ['down', 'right'] : [RIGHT_TYPES.includes(type) ? 'right' : 'down'];
export const layeredDown = (type, layout) => (layout?.direction ?? layeredDirections(type)[0]) === 'down';
