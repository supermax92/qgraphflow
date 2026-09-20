// 智能体编排器：一轮对话 = 意图识别 → 至多 maxToolCalls 次工具调用（每次调用后由模型决定下一步）→ 生成回复。
// 工具失败不重试，直接降级为兜底回答；回复推送与审计写入并行，互不等待。
import { config } from '../config.js';

export class AgentOrchestrator {
  constructor({ llm, tools, sessions, audit }) {
    this.llm = llm;
    this.tools = tools;
    this.sessions = sessions;
    this.audit = audit;
  }

  async handle(sessionId, text, push, customerId = 0) {
    const session = this.sessions.findOrCreate(sessionId, customerId);
    const userMessage = this.sessions.appendMessage(session.id, 'user', text);
    const history = this.sessions.history(session.id);
    let plan = await this.llm.complete(history, { tools: this.tools.describe() });
    const toolCalls = [];
    let degraded = false;
    for (let attempt = 0; attempt < config.maxToolCalls && plan.tool; attempt++) {
      const outcome = await this.tools.execute(plan.tool, { ...plan.arguments, sessionId: session.id });
      toolCalls.push(this.sessions.recordToolCall(userMessage.id, { tool: plan.tool, arguments: plan.arguments, result: outcome.result ?? null, ok: outcome.ok, latencyMs: outcome.latencyMs, orderId: plan.arguments?.orderId ?? null }));
      if (outcome.ok) {
        history.push({ role: 'tool', content: JSON.stringify({ tool: plan.tool, result: outcome.result }) });
        plan = await this.llm.complete(history, { tools: this.tools.describe() });
      } else {
        degraded = true;
        break;
      }
    }
    const answer = degraded ? { text: '抱歉，暂时查不到这条信息，已为您转接人工客服。' } : await this.llm.complete([...history, { role: 'system', content: 'compose the final reply' }]);
    this.sessions.appendMessage(session.id, 'assistant', answer.text);
    await Promise.all([
      push(answer.text),
      this.audit.record({ sessionId: session.id, toolCalls: toolCalls.length, degraded, model: config.llmModel })
    ]);
    return { sessionId: session.id, reply: answer.text, toolCalls: toolCalls.length, degraded };
  }
}
