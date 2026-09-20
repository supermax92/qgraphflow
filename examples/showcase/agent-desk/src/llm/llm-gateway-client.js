// LLM 网关客户端：调用外部模型服务；429 / 网络错误按 config.llmRetries 重试，其他错误直接抛出。
import { config } from '../config.js';

export class LlmGatewayClient {
  constructor(fetchImpl = globalThis.fetch) {
    this.fetch = fetchImpl;
  }

  async complete(messages, { tools = [] } = {}) {
    let attempt = 0;
    while (true) {
      attempt += 1;
      try {
        const response = await this.fetch(config.llmGatewayUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ model: config.llmModel, messages, tools })
        });
        if (response.status === 429 && attempt <= config.llmRetries) continue;
        if (!response.ok) throw new Error(`llm gateway ${response.status}`);
        return await response.json();
      } catch (error) {
        if (attempt > config.llmRetries) throw error;
      }
    }
  }
}
