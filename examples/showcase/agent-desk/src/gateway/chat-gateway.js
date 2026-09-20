// 客服网关：POST /chat 收用户消息，先认证，再交给智能体编排器；回复分片通过 push 推送给客户端。
import http from 'node:http';
import { authenticate } from '../security/auth.js';

export function createChatGateway(orchestrator, pusher) {
  return http.createServer(async (request, response) => {
    try {
      authenticate(request);
      if (request.method !== 'POST' || request.url !== '/chat') return reply(response, 404, { error: 'not found' });
      const { sessionId, text } = await readJson(request);
      const result = await orchestrator.handle(sessionId, text, chunk => pusher.push(sessionId, chunk));
      reply(response, 200, result);
    } catch (error) {
      reply(response, error.status ?? 500, { error: error.message });
    }
  });
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
}

function reply(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
}
