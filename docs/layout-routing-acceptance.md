# 布局与连线优化验收

日期：2026-10-07。当前分支 `feature/architecture/20261006-platform-engineering-overviews`，HEAD `f86325c`。本轮只优化布局、连线与相关编辑/验收路径，并按用户要求删除移动端专用实现。未使用 OpenSpec，未暂存、提交、推送或创建 PR；`main` 仍为 `d6e54dd`。

## 实现范围

九种图类型全部纳入：组件关系架构图、流程图、时序图、ER 图、部署图、类图、状态图、用例图和数据流图；另包含平台能力架构图、工程分层架构图。完整的八步与七项约束见 [共享算法契约](../skills/q-flow/references/layout-routing.md)。

- 完整测量标题、正文、徽章、关系说明和真实轮廓；先保持类别、流程、层级与归属，再收紧合适的间距。
- 优先从最近的可行轮廓边正交连线。避开节点、标题、分组边框重合及已有平行线；标签独立测量和避让。有界优先级与拆线重排减少绕行和交叉。
- 编辑增长、同层排序和局部整理使用共享求解器。拖动保持用户位置，按真实归属扩展必要边界；编辑增长触及相邻归属边界时可在上限内整体移动边界与其成员，保留 `groupId` / `parentId`；失败保留表单草稿及上一次有效画布。取消或重置使未完成的 Worker 结果失效。
- 普通图保留自身符号与关系方向。时序图保持参与者次序、消息顺序、调用/返回配对、激活与组合片段，使用专用跨度及行高约束。
- 生成器与离线 Viewer 共用算法；页面、SVG、PNG 读取同一份路由和标签位置。预算及失败搜索报告保留，不把搜索耗尽当成无解证明。

## 配色与移动端

本轮开始时工作区已有参考图配色修订。对照修改前快照，`visual-style.js`、`radix-colors.js`、`architecture-overview-theme.js` 和 `node-svg.js` 均逐字节未变；详见 [配色保留证明](../output/demos/layout-routing-20261007/palette-preservation.json)。本轮 `styles.css` 仅删除两段窄屏断点，没有调整字体、颜色或卡片绘制方案。

已删除移动端断点布局、单面板切换、窄屏初始缩放/定位分支及移动端浏览器验收入口；当前维持桌面工具栏与面板。旧日期的验收截图与报告保留为历史证据，旧设计中的小屏承诺已标明被本轮范围取代。

## 验证结果

环境：macOS arm64，Node 22.23.2，Chrome 154.0.8037.98。桌面尺寸为 `1440×900` 和 `1920×1080`，浅色和深色主题。

| 验证层 | 最终结果 | 可复核证据 |
| --- | --- | --- |
| 源码与兼容 | 255/255；0 失败、0 跳过（审计修复后复跑） | [全部测试日志](../output/demos/layout-routing-20261007/fix-audit/evidence/source-tests.log) |
| Viewer 构建 | 成功，离线 Worker 内联 | [构建日志](../output/demos/layout-routing-20261007/evidence/viewer-build.log) |
| 完整 SVG 绘制 | 九类基准 + 三图示例共 12 张；文字越界清单为空，并已查看完整截图 | [九类边界检查](../output/demos/layout-routing-20261007/goldens-review-complete/render-check.json)、[三图检查](../output/demos/layout-routing-20261007/review-complete/render-check.json) |
| 双主题桌面矩阵 | 44/44；22 组实际 SVG/PNG 下载，共 44 个文件（最终 Viewer 构建复跑） | [桌面报告](../output/demos/layout-routing-20261007/fix-audit/qa-matrix-all/browser-interactions-report.json) |
| 完整交互 | 九类图各 1 个完整桌面流程 + 两种总览各 2 个主题，共 13 个最终有效场景 | [逐步记录](../output/demos/layout-routing-20261007/qa-reviewed-interactions/browser-interactions-report.json)、[部署图修复复验](../output/demos/layout-routing-20261007/qa-deployment-edit-reviewed/browser-interactions-report.json)、[总览专项](../output/demos/layout-routing-20261007/qa-final-overview/browser-interactions-report.json) |
| Worker、失败与恢复 | 23/23：11 个视图的取消/过期结果/应用/重置、11 个失败草稿保留与恢复、1 个保存失败专项 （最终构建复跑）| [专项报告](../output/demos/layout-routing-20261007/fix-audit/qa-worker/browser-interactions-report.json) |
| 拖动与归属边界 | 9/9；检查合法移动或碰撞回退、跨视图隔离、实际下载和重置 （最终构建复跑）| [拖动报告](../output/demos/layout-routing-20261007/fix-audit/qa-manual/browser-interactions-report.json) |
| 原生窗口全屏 | 10/10；包括退出、拒绝与恢复路径 | [全屏报告](../output/demos/layout-routing-20261007/qa-native-ownership-accepted/browser-interactions-report.json) |
| 最终分发包 | TGZ、ZIP 已按修复后的源码重建；包内 94 个文件与工作树逐字节一致；工程外离线 CLI 生成的 JSON、HTML 与 9 张 SVG 和源码版逐字节一致 | [包与 CLI 记录](../output/demos/layout-routing-20261007/fix-audit/evidence/package-check.json) |

完整交互包括搜索、详情、锁定、指针拖动、键盘操作、中文组合事件、长文字、连续编辑、应用/取消、跨视图切换、当前视图重置、保存后重开、动效设置和实际下载。初跑发现部署图连续编辑会让连线沿分组边框走；修复后的完整部署图流程已经单独重跑通过。原失败报告保留，汇总记录明确替换该旧结果，不隐藏失败。

保存失败专项注入了文件选择取消、打开、写入和关闭失败，随后通过真实下载验证恢复；它不证明系统原生文件选择器全部交互。失败草稿专项向真实离线 Worker 提交错位或错误端点候选，验证候选被拒绝时原画布与其他视图不变。浏览器组合事件与 CDP 输入测试不等同于原生 macOS 中文输入法候选选择，后者未验收。

## 审计后修复（2026-10-07）

独立审计后修复了下列问题。本节的浏览器复验都使用修复后重建的 Viewer；证据集中在 [fix-audit](../output/demos/layout-routing-20261007/fix-audit/)。

| 问题 | 修复 | 复验 |
| --- | --- | --- |
| 浏览器内加宽时序图参与者名称后无法顺移，生成时却可以 | `repairSequenceRow` 把后续参与者、片段框和已存 x 坐标整体右移（不超过 156），并用生成器共用的 `spreadParticipants` 恢复消息跨度；该函数从 `compile-sequence.mjs` 抽出，11 视图矩阵的生成结果仍逐字节一致 | 新增单测（修复前会失败）；验收驱动新增 I14.16“中等增长必须成功”，加入完整交互和编辑边界两处流程 |
| 验收驱动对长文本“成功或失败都算通过” | 保留超长文本的失败恢复检查，另加中等增长必须成功的检查 | 九类图加两种总览共 13 个场景通过：[报告](../output/demos/layout-routing-20261007/fix-audit/qa-acceptance-final/browser-interactions-report.json) |
| 宽范围图生成耗时长且不可复现 | 路由器加入不改变结果的预过滤（节点带、近邻路线、长度下界、标签预计算）；确定性的访问次数预算不变，不加墙钟上限（会使结果依赖机器）；浏览器求解仍可取消 | 合成的 36 节点、55 关系输入 `tests/fixtures/stress-wide-relations.graph.json` 由 121 秒降到 53 秒，输出逐字节一致：[记录](../output/demos/layout-routing-20261007/fix-audit/evidence/stress-wide-relations.json) |
| 44 矩阵、完整交互与 Jeepay 浏览器证据早于最终 Viewer 构建 | 用最终构建复跑 | 44/44、Jeepay 12/12、Worker 23/23、拖动 9/9、完整交互 13/13，见上表和 [evidence](../output/demos/layout-routing-20261007/fix-audit/evidence/) |
| “质量门槛不变”与代码、测试不符 | 文档改为：阈值不变，端点引导段规则按直线的实际长度度量；类图继承层距断言收紧为推荐层间距 80，删除一处空转的条件断言 | 全量测试 255/255 |
| 各类型说明未更新 | 8 个类型页各加一行布局约束；`SKILL.md` 恢复被删的路径限定。`graph-common.md` 受 6KB 上限限制，其中被压缩的文案没有恢复 | 技能契约测试通过 |

边界：原 Jeepay 宽范围工程压力输入（sha256 `073e3068…`）从未归档，无法复现，其 90 秒未完成的结果仍然成立，上面的合成输入不替代它。原生 macOS 窗口全屏（10/10）和原生中文输入法没有重跑。

## Jeepay 源码验证

采用本地源码快照 `jeequan/jeepay@e1ac9086d679826bab593f20431b7ecd292eb685`，重新生成 [统一下单三图](../output/demos/layout-routing-20261007/jeepay-source-review/complete/index.html)。每图保留相同的 13 个节点与 14 条关系，范围明确为统一下单关键组件，包含工程模块与内部剖面；不是全仓库完整架构。

来源核验：93/93 锚点、13 个文件、42/42 关系调用/声明位置、84 个符号；[生成记录](../output/demos/layout-routing-20261007/evidence/jeepay-source-generation.log)。源码 POM 中 Java 17、Spring Boot 3.3.7 等字段独立核验，未借用参考图片中的版本或规则。三图的 12 个桌面场景及 6 组实际 SVG/PNG 下载，共 12 个文件通过：[Jeepay 浏览器报告](../output/demos/layout-routing-20261007/qa-final-jeepay/browser-interactions-report.json)。未启动 Jeepay、未运行其 Java 测试或验证真实支付通道。

最终算法的 36 节点、55 关系宽范围工程压力图未在 90 秒测试限时内完成，未计为通过，也未删减事实或宣称无解。 [压力测试记录](../output/demos/layout-routing-20261007/evidence/jeepay-full-stress.json)。

## 审核入口与效果

- [同一交易系统的三类示例](../output/demos/layout-routing-20261007/examples.html)：沿用原有样式，审核间距、最近边连接及避让。
- [九类图与两种总览画布](../output/demos/layout-routing-20261007/matrix-review-complete/index.html)：同页按视图标识切换。
- [Jeepay 多类型示例（9 个视图）](../output/demos/jeepay-examples-20261007/out/index.html)：统一下单的三类架构图、流程图、时序图、ER 图、部署图、类图和状态图，源码锚点 194/194、关系位置 97/97 通过 `--repo-root` 核验；预览图在同目录 `png/`。
- [机器可读汇总与产物散列](../output/demos/layout-routing-20261007/acceptance.json)。

基准样例的几何统计见 [对比数据](../output/demos/layout-routing-20261007/layout-metrics.json)：组件关系架构图总线长约下降 46%，面积约下降 6%；流程图约下降 60% 和 27%，其交叉由 1 降到 0。时序图保持原有时间与调用记法。这些是固定样例的观测结果，不保证所有图都达到相同比例或全局最短路径。

最终算法从原始输入重新生成教学三图、九类验收集合和 Jeepay 三图，其 JSON 与全部 SVG 与审核版逐字节一致：[自动重建对比](../output/demos/layout-routing-20261007/auto-rebuild-comparison.json)。所有验收与分发均为本地记录，不表示发布、安装或外部集成已完成。
