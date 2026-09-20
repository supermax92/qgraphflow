// 冒烟入口：不开网络，用假的 LLM 与物流服务走一遍"订单为什么还没发货"的对话。
import { AgentOrchestrator } from './agent/orchestrator.js';
import { ToolRegistry } from './agent/tool-registry.js';
import { orderTools } from './tools/order-tools.js';
import { SessionRepository } from './repo/session-repository.js';
import { OrderRepository } from './repo/order-repository.js';
import { RefundService } from './services/refund-service.js';
import { AuditLog } from './audit/audit-log.js';

const orders = new OrderRepository([{ id: 'o-1001', customerId: 7, status: 'delayed', trackingNo: null, totalCents: 25900 }]);
const tools = new ToolRegistry(orderTools({ orders, logistics: { track: async () => ({ status: 'in_transit', lastEvent: null }) }, refunds: new RefundService(orders) }));
const fakeLlm = { calls: 0, async complete(history) { this.calls += 1; const last = history.at(-1);
  if (last.role === 'user') return { tool: 'lookupOrder', arguments: { orderId: 'o-1001' } };
  if (last.role === 'tool') return { tool: null };
  return { text: '您的订单 o-1001 因仓库缺货延迟，预计 2 天内发出；如需退款可以直接回复"退款"。' }; } };
const sessions = new SessionRepository(), audit = new AuditLog();
const orchestrator = new AgentOrchestrator({ llm: fakeLlm, tools, sessions, audit });
const pushed = [];
const result = await orchestrator.handle('s-1', '我的订单 o-1001 怎么还没发货？', async chunk => pushed.push(chunk), 7);
console.log('reply', result.reply);
console.log('tool calls', result.toolCalls, 'degraded', result.degraded, 'llm calls', fakeLlm.calls);
console.log('pushed', pushed.length, 'audit', audit.sink);
console.log('tool_calls rows', sessions.toolCalls.map(row => [row.tool, row.ok, row.orderId]));
