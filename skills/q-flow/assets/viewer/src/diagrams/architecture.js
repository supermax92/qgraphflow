import { genericCard, cardOutline } from './card.js';

export default {
  dashedKinds: ['framework', 'optional'],
  id: 'architecture', label: '架构图',
  nodeKinds: ["external", "config", "framework", "security", "service", "business", "data", "failure", "system", "component", "database"],
  groupKinds: ["runtime", "security", "ownership", "external"],
  edgeKinds: ["request", "call", "data", "success", "failure", "framework", "optional", "depends"],
  render: genericCard, outline: cardOutline,
  cardLayout: true,
};
