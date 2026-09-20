// Bearer token 校验：不在白名单直接 401。
import { config } from '../config.js';

export function authenticate(request) {
  const header = request.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!config.authTokens.includes(token)) {
    const error = new Error('unauthorized');
    error.status = 401;
    throw error;
  }
  return { token };
}
