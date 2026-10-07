import fs from 'node:fs';
import path from 'node:path';
import { compileGraphLayout } from '../skills/q-flow/scripts/compile-layout.mjs';

export const root = path.resolve(import.meta.dirname, '..');
export const corpusDir = path.join(root, 'examples/jeepay');
export const collectionPath = path.join(corpusDir, 'collection.graph.json');
export const source = JSON.parse(fs.readFileSync(path.join(corpusDir, 'source.json'), 'utf8'));
export const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
export const repoRoot = process.env.JEEPAY_REPO_ROOT || path.join(root, 'output/jeepay-source');
export const jeepay = id => {
  const graph = collection.diagrams.find(graph => graph.meta.viewId === `jeepay-${id}`);
  if (!graph) throw new Error(`Unknown Jeepay view: ${id}`);
  return structuredClone(graph);
};
const cache = new Map();
export async function compiled(id) {
  if (!cache.has(id)) cache.set(id, compileGraphLayout(jeepay(id)));
  return structuredClone(await cache.get(id));
}
// Semantic comparisons intentionally omit generated geometry and solver receipts.
export function facts(graph) {
  const clean = value => Array.isArray(value) ? value.map(clean) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([key]) => !['position', 'size', 'route'].includes(key)).map(([key, item]) => [key, clean(item)])) : value;
  const model = clean(graph);
  if (model.layout) {
    for (const key of ['version', 'strategy', 'direction']) delete model.layout[key];
    if (!Object.keys(model.layout).length) delete model.layout;
  }
  return model;
}
