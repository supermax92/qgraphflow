// 订单仓储：orders 与 refunds 两张表；退款按 idempotency_key 去重。
export class OrderRepository {
  constructor(orders = []) {
    this.orders = new Map(orders.map(order => [order.id, order]));
    this.refunds = new Map();
  }

  findById(id) {
    const order = this.orders.get(id);
    if (!order) {
      const error = new Error(`order ${id} not found`);
      error.status = 404;
      throw error;
    }
    return order;
  }

  findByCustomer(customerId) {
    return [...this.orders.values()].filter(order => order.customerId === customerId);
  }

  saveRefund(orderId, idempotencyKey, amountCents) {
    const existing = [...this.refunds.values()].find(item => item.idempotencyKey === idempotencyKey);
    if (existing) return existing;
    const refund = { id: this.refunds.size + 1, orderId, idempotencyKey, amountCents, status: 'requested', requestedAt: new Date() };
    this.refunds.set(orderId, refund);
    return refund;
  }
}
