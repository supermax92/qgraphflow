import { genericCard, cardOutline } from './card.js';

export default {
  id: 'deployment', label: '部署图',
  nodeKinds: ["device", "node", "container", "artifact", "service", "database", "external"],
  groupKinds: ["host", "network", "cluster", "namespace"],
  edgeKinds: ["deploy", "network", "depends"],
  render: genericCard, outline: cardOutline,
  cardLayout: true,
};
