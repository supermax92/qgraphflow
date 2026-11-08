#!/usr/bin/env node
// The "this update" example shared by the README clip and the online demo: the Jeepay component relations view (the
// Chinese corpus or its English showcase translation) and a believable earlier version of it. In the earlier version
// the merchant notification does not exist yet, one call has its old name, and a retired reconciliation job is still
// there. The earlier version is derived, so it always matches the corpus.
// node scripts/showcase-changes.mjs zh-CN|en <directory>   writes current.graph.json and earlier.graph.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');

export function showcaseChanges(locale) {
  const file = locale === 'en' ? 'examples/showcase/jeepay.en.hero.graph.json' : 'examples/jeepay/collection.graph.json';
  const corpus = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const current = structuredClone(corpus.diagrams.find(graph => graph.meta.viewId === 'jeepay-relations')), earlier = structuredClone(current);
  earlier.nodes = earlier.nodes.filter(node => node.id !== 'notify');
  earlier.edges = earlier.edges.filter(edge => edge.source !== 'notify' && edge.target !== 'notify');
  earlier.edges.find(edge => edge.id === 'r6').label = locale === 'en' ? 'Save order' : '保存订单';
  earlier.nodes.push({ ...structuredClone(current.nodes.find(node => node.id === 'orders')), id: 'reconcile', label: 'PayOrderReconcileJob', subtitle: locale === 'en' ? 'Legacy reconciliation' : '旧版对账任务' });
  earlier.edges.push({ ...structuredClone(earlier.edges.find(edge => edge.id === 'r9')), id: 'r-reconcile', source: 'reconcile', label: locale === 'en' ? 'Reconcile orders' : '对账订单' });
  return { current, earlier };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [locale, directory] = process.argv.slice(2);
  if (!['zh-CN', 'en'].includes(locale) || !directory) throw new Error('Usage: node scripts/showcase-changes.mjs zh-CN|en <directory>');
  const { current, earlier } = showcaseChanges(locale);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'current.graph.json'), `${JSON.stringify(current, null, 2)}\n`);
  fs.writeFileSync(path.join(directory, 'earlier.graph.json'), `${JSON.stringify(earlier, null, 2)}\n`);
}
