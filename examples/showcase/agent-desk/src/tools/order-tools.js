// 订单工具集：智能体可调用的三个工具，全部围绕订单库与物流平台。
export function orderTools({ orders, logistics, refunds }) {
  return [
    {
      name: 'lookupOrder',
      description: '按订单号查询状态与运单号',
      run: async ({ orderId }) => {
        const order = orders.findById(orderId);
        return { status: order.status, trackingNo: order.trackingNo, totalCents: order.totalCents };
      }
    },
    {
      name: 'trackShipment',
      description: '按运单号查询最新物流轨迹',
      run: async ({ trackingNo }) => logistics.track(trackingNo)
    },
    {
      name: 'requestRefund',
      description: '为未发货订单发起退款',
      run: async ({ sessionId, orderId }) => refunds.request(sessionId, orderId)
    }
  ];
}
