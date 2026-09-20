// 会话仓储：对应 sessions / messages / tool_calls 三张表；内存实现，方法按 SQL 语义命名。
export class SessionRepository {
  constructor() {
    this.sessions = new Map();
    this.messages = [];
    this.toolCalls = [];
  }

  findOrCreate(sessionId, customerId, channel = 'miniapp') {
    if (!this.sessions.has(sessionId)) this.sessions.set(sessionId, { id: sessionId, customerId, channel, status: 'open', createdAt: new Date() });
    return this.sessions.get(sessionId);
  }

  appendMessage(sessionId, role, content) {
    const message = { id: this.messages.length + 1, sessionId, role, content, createdAt: new Date() };
    this.messages.push(message);
    return message;
  }

  recordToolCall(messageId, call) {
    const row = { id: this.toolCalls.length + 1, messageId, ...call };
    this.toolCalls.push(row);
    return row;
  }

  history(sessionId) {
    return this.messages.filter(message => message.sessionId === sessionId).map(({ role, content }) => ({ role, content }));
  }
}
