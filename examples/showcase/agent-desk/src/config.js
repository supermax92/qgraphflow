// 运行配置：全部来自环境变量并带默认值。
export const config = {
  port: Number(process.env.PORT ?? 3100),
  llmGatewayUrl: process.env.LLM_GATEWAY_URL ?? 'https://llm.example.test/v1/chat/completions',
  llmModel: process.env.LLM_MODEL ?? 'agent-desk-2026',
  llmRetries: Number(process.env.LLM_RETRIES ?? 2),
  maxToolCalls: Number(process.env.MAX_TOOL_CALLS ?? 3),
  logisticsUrl: process.env.LOGISTICS_URL ?? 'https://track.example.test/v2/shipments',
  authTokens: (process.env.AUTH_TOKENS ?? 'miniapp-token,agent-console-token').split(',')
};
