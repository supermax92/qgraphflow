// 工具注册表：按名称分发工具调用，统一计时与错误包装；失败不抛出，返回 ok=false 交给编排器决定降级。
export class ToolRegistry {
  constructor(tools = []) {
    this.tools = new Map(tools.map(tool => [tool.name, tool]));
  }

  describe() {
    return [...this.tools.values()].map(({ name, description }) => ({ name, description }));
  }

  async execute(name, args) {
    const started = Date.now();
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, error: `unknown tool ${name}`, latencyMs: 0 };
    try {
      return { ok: true, result: await tool.run(args), latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, error: error.message, latencyMs: Date.now() - started };
    }
  }
}
