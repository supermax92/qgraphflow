export const DEPLOYMENT_TIERS = Object.freeze(['external', 'application', 'infrastructure', 'data']);
export function deploymentTierOf(node) {
  if (node.layout?.tier) return DEPLOYMENT_TIERS.indexOf(node.layout.tier);
  if (['external', 'actor', 'client'].includes(node.kind)) return 0;
  if (node.kind === 'database') return 3;
  if (['queue', 'cache'].includes(node.kind)) return 2;
  return 1;
}
