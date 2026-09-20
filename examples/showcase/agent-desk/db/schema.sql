-- 客服智能体数据库：会话、消息、工具调用、订单、退款。
CREATE TABLE sessions (
  id           VARCHAR(32) PRIMARY KEY,
  customer_id  BIGINT NOT NULL,
  channel      VARCHAR(16) NOT NULL,
  status       VARCHAR(16) NOT NULL DEFAULT 'open',
  created_at   TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id           BIGSERIAL PRIMARY KEY,
  session_id   VARCHAR(32) NOT NULL REFERENCES sessions(id),
  role         VARCHAR(16) NOT NULL,
  content      TEXT NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id           VARCHAR(32) PRIMARY KEY,
  customer_id  BIGINT NOT NULL,
  status       VARCHAR(16) NOT NULL,
  tracking_no  VARCHAR(64) NULL,
  total_cents  INTEGER NOT NULL
);

CREATE TABLE tool_calls (
  id           BIGSERIAL PRIMARY KEY,
  message_id   BIGINT NOT NULL REFERENCES messages(id),
  order_id     VARCHAR(32) NULL REFERENCES orders(id),
  tool         VARCHAR(32) NOT NULL,
  arguments    JSONB NOT NULL,
  result       JSONB NULL,
  ok           BOOLEAN NOT NULL,
  latency_ms   INTEGER NOT NULL
);

CREATE TABLE refunds (
  id               BIGSERIAL PRIMARY KEY,
  order_id         VARCHAR(32) NOT NULL UNIQUE REFERENCES orders(id),
  idempotency_key  VARCHAR(64) NOT NULL UNIQUE,
  amount_cents     INTEGER NOT NULL,
  status           VARCHAR(16) NOT NULL,
  requested_at     TIMESTAMP NOT NULL DEFAULT now()
);
