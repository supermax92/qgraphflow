// 退款服务：只有已支付且未发货的订单可退，幂等键由会话 + 订单派生。
export class RefundService {
  constructor(orders) {
    this.orders = orders;
  }

  request(sessionId, orderId) {
    const order = this.orders.findById(orderId);
    if (!['paid', 'delayed'].includes(order.status)) throw new Error(`order ${orderId} is ${order.status}; refund not allowed`);
    return this.orders.saveRefund(orderId, `${sessionId}:${orderId}`, order.totalCents);
  }
}
