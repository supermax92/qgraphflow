export function searchRank(node, query) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return 0;
  const label = node.label.trim().toLowerCase();
  if (label === keyword) return 5;
  if (label.startsWith(keyword)) return 4;
  if (label.includes(keyword)) return 3;
  const includes = values => values.some(value => String(value ?? '').toLowerCase().includes(keyword));
  if (includes([node.subtitle, ...(node.tags ?? [])])) return 2;
  return includes([
    ...(node.facts ?? []), ...(node.attributes ?? []), ...(node.methods ?? []),
    ...(node.fields ?? []).flatMap(field => [field.key, field.name, field.type])
  ]) ? 1 : 0;
}

export function searchNodes(nodes, query) {
  return nodes.map(node => ({ node, rank: searchRank(node, query) }))
    .filter(item => item.rank > 0)
    .sort((left, right) => right.rank - left.rank)
    .slice(0, 8)
    .map(item => item.node);
}
