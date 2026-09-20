// 物流查询客户端：按运单号查外部物流平台，返回最新轨迹。
import { config } from '../config.js';

export class LogisticsClient {
  constructor(fetchImpl = globalThis.fetch) {
    this.fetch = fetchImpl;
  }

  async track(trackingNo) {
    const response = await this.fetch(`${config.logisticsUrl}/${encodeURIComponent(trackingNo)}`);
    if (!response.ok) throw new Error(`logistics ${response.status}`);
    const data = await response.json();
    return { status: data.status, lastEvent: data.events?.at(-1) ?? null };
  }
}
