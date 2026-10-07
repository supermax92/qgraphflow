# 电商下单与异步支付演示

这是独立编写的虚构场景，用于展示 QGraphFlow 时序图与逐笔绘制动画。不是任何真实系统的实现说明。

1. 买家经入口提交订单；订单服务完成校验与计价。
2. 库存服务尝试预占库存，遇到可重试错误时最多尝试三次。
3. 库存预占成功后，支付服务向外部支付渠道申请授权，返回授权成功或拒绝。
4. 授权成功时发布订单确认事件，履约与通知消费者并行处理。履约服务确认库存预占并发布履约就绪事件；通知服务向买家发送确认。
5. 授权失败时释放库存并发布订单取消事件；库存不足时发布订单拒绝事件。
6. 订单服务与入口依次向买家返回订单状态。
7. 支付渠道异步回调支付结果。签名有效时检查事件幂等性；新事件更新订单已支付并发布支付结算事件，重复事件忽略。最后向渠道返回 ACK。

覆盖：9 个参与者、29 条消息、loop / alt / par / opt 组合片段、嵌套分支、自调用、同步调用、异步事件、成对返回与激活条。绘图动画是对已生成图形的分步呈现，不代表模型内部推理过程。

## 重新生成与录制

在仓库根目录运行（录制需要已安装的 Playwright Chromium、Node.js 与 ffmpeg）：

```sh
node skills/q-flow/scripts/validate-graph.mjs examples/showcase/checkout-sequence.graph.json --input-only
node skills/q-flow/scripts/generate-viewer.mjs examples/showcase/checkout-sequence.graph.json output/playwright/checkout-sequence/viewer
node skills/q-flow/scripts/validate-graph.mjs output/playwright/checkout-sequence/viewer/graph.json
node scripts/record-sequence-drawing.mjs --view output/playwright/checkout-sequence/viewer --out output/playwright/checkout-sequence/recording
```

如果使用已有输出目录，显式更新时为生成命令添加 `--force`。可用 `--preview` 只生成播放器与关键截图，跳过视频编码；`PLAYWRIGHT_MODULE` 可指定本机已有的 Playwright 模块位置。

录制输出为可离线重播的 `drawing.html`、循环 GIF、MP4、关键截图与 `record.json`。播放器通过遮罩逐步展示生成器输出的 SVG；图形结构与最终线型不会改写。大图保留在同一视图中，使用镜头平移和缩放逐步展示。
