// 审计日志：每轮对话记录工具调用与模型调用次数，追加写，不阻塞回复。
export class AuditLog {
  constructor(sink = []) {
    this.sink = sink;
  }

  async record(entry) {
    this.sink.push({ at: new Date().toISOString(), ...entry });
  }
}
