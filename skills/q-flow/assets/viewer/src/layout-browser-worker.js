import { LAYOUT_VERSION } from './layout-policy.js';
import { templateDraft, templateOf } from './layout-templates.js';
import { routeOrthogonal } from './orthogonal-routing.js';
import { compileSequence } from '../../../scripts/compile-sequence.mjs';
import { layoutMetrics } from './layout-refinement.js';
import { refineDiagramLayout, refineWithLegacySeed } from './layout-refinement.js';
import { fitArchitectureOverview, maintainArchitectureOverview } from './architecture-overview.js';
import { requireDiagramQuality } from './layout-quality.js';

// Bundled inline into the offline page. The algorithm is exactly the generator's pure source.
self.onmessage = ({ data }) => {
  try {
    let result;
    if (data.overview) result = { graph: data.options?.relayout ? fitArchitectureOverview(data.graph, requireDiagramQuality) : maintainArchitectureOverview(data.graph, data.reference ?? data.graph, requireDiagramQuality) };
    else if (data.options?.relayout && data.graph.meta.diagramType === 'sequence') {
      const candidates = [];
      for (let i = 0; i < 6; i++) { try { const graph = compileSequence(data.graph, i); graph.layout = { ...graph.layout, version: LAYOUT_VERSION }; requireDiagramQuality(graph); candidates.push({ graph }); } catch { /* Retain the original on complete failure. */ } }
      candidates.sort((a, b) => layoutMetrics(a.graph).cost - layoutMetrics(b.graph).cost);
      if (!candidates.length) throw new Error('No valid sequence layout');
      result = candidates[0];
    } else if (data.options?.relayout && templateDraft(data.graph)) {
      const candidates = [];
      for (let i = 0; i < 4; i++) { try {
        const graph = templateDraft(data.graph, i); graph.layout = { ...graph.layout, version: LAYOUT_VERSION, strategy: `template-${templateOf(graph).structure}-${i}` };
        candidates.push(routeOrthogonal(graph, { passes: 3, accept: requireDiagramQuality }));
      } catch { /* Try another measured spacing/order, never drop semantic facts. */ } }
      candidates.sort((a, b) => layoutMetrics(a.graph).cost - layoutMetrics(b.graph).cost);
      if (!candidates.length) throw new Error('No valid semantic layout');
      result = refineWithLegacySeed(candidates[0].graph, data.graph, { global: true, evaluations: 60 });
    } else result = refineDiagramLayout(data.options?.relayout ? { ...data.graph, layout: { ...data.graph.layout, version: LAYOUT_VERSION } } : data.graph, { ...data.options, global: Boolean(data.options?.relayout) });
    self.postMessage({ result: { graph: result.graph, movedNodeIds: result.movedNodeIds ?? [] } });
  } catch (error) {
    self.postMessage({ error: { message: error.message, diagnostics: error.diagnostics ?? [], routingReport: error.routingReport } });
  }
};
