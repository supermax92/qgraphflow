# 多客户端安装与分发

先从 [GitHub Releases](https://github.com/supermax92/qgraphflow/releases) 下载 `qgraphflow-0.0.1.zip`，解压后的根目录应同时包含 `skills/`、`LICENSE` 及各客户端的隐藏清单目录。保留完整目录，不要只复制 `SKILL.md`。

生成器的独立使用方法见 [README](../README.md#先运行一个示例)。安装插件后，客户端读取项目和调用模型的权限仍由客户端管理。

## Codex App / CLI

以下命令已核对本地 Codex CLI 0.144.1 的 `--help`。在插件根目录执行：

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@qgraphflow-local
```

仓库发布后，也可以将第一条命令改为 `codex plugin marketplace add supermax92/qgraphflow`，从 GitHub 添加市场。仓库中的 `.agents/plugins/marketplace.json` 使用相对路径指向自身；`qgraphflow-local` 是市场标识，在本地和 Git 安装中保持一致。

重新打开任务后选择 `$q-flow`。如果 CLI 没有 `plugin` 子命令，请先升级到支持插件的版本；App 使用其插件管理入口，CLI 和 App 的安装状态需分别确认。入口清单为 `.codex-plugin/plugin.json`。[OpenAI 插件文档](https://learn.chatgpt.com/docs/plugins)。

Git 市场更新：先执行 `codex plugin marketplace upgrade qgraphflow-local`，再执行上面的 `plugin add`。本地安装更新：替换为新版本目录后重新执行安装命令。卸载：`codex plugin remove qgraphflow@qgraphflow-local`。

## Claude Code

在插件根目录执行：

```bash
claude plugin marketplace add .
claude plugin install qgraphflow@qgraphflow-local
```

仓库发布后，第一条命令也可使用 `claude plugin marketplace add supermax92/qgraphflow`。重新加载插件或新建会话，调用 `/qgraphflow:q-flow`。

入口清单为 `.claude-plugin/plugin.json`，市场文件为 `.claude-plugin/marketplace.json`。命令已核对本地 Claude Code 2.1.227 帮助及[官方安装文档](https://code.claude.com/docs/en/discover-plugins)。更新与卸载在 `/plugin` 的 Installed / Marketplaces 页面操作。

## Qoder CLI / IDE

Qoder CLI 可以按当前帮助所示，为本次会话加载本地目录：

```bash
qodercli --plugin-dir /absolute/path/to/qgraphflow
```

请将路径替换为解压后的插件根目录；路径含空格时加双引号。入口清单为 `.qoder-plugin/plugin.json`。

Qoder IDE：在 Settings → Plugins 中使用 Import，或在插件市场的 Create Plugin 中选择导入本地目录。选择完整插件根目录，再确认 `q-flow` 出现在技能入口。更新和卸载使用同一插件管理页。[Qoder IDE 官方说明](https://docs.qoder.com/extensions/plugins)。

Qoder 桌面 / QoderWork 的导入能力与 IDE 不等同，本版尚未完成该入口的安装验证。

## Cursor

将完整插件目录放入 `~/.cursor/plugins/local/qgraphflow/`，确认其中存在 `.cursor-plugin/plugin.json`，然后运行 Developer: Reload Window，在 Customize 中检查 `q-flow`。此入口属于本地插件加载。[Cursor 官方说明](https://cursor.com/docs/plugins)。

更新时替换该目录并重新加载；卸载时通过文件管理器将该插件目录移到回收站，再重新加载。组织策略可能限制本地插件导入；同名市场插件也可能优先于本地副本。

## 本版验证状态

| 范围 | 状态 |
| --- | --- |
| 四类清单、版本一致性、打包文件完整性 | 由本仓库自动测试检查 |
| ZIP / npm 压缩包解压后的校验与独立生成 | 由本仓库自动测试检查，覆盖中文和空格路径、不同工作目录及防覆盖 |
| Codex / Claude Code / Qoder CLI 命令形式 | 已核对本机 CLI 帮助；不代表原生绘图验收通过 |
| Qoder IDE / Cursor 本地导入入口 | 已核对官方文档；尚未完成本版原生端到端验收 |
| 各客户端发现技能 → 模型取证 → 生成 → 页面检查 → 导出 | 本版尚未完成全客户端端到端验收 |
| npm、客户端官方插件市场 | 本次未上架 |

每个客户端完成验收时，应记录客户端版本及上述完整链路；清单存在或命令成功不足以证明模型实际使用了插件。

## 本地打包

在仓库根目录预览发布文件：

```bash
npm pack --ignore-scripts --dry-run
```

生成 npm 格式压缩包（本地打包，不会上传 npm）：

```bash
npm pack --ignore-scripts
```

生成的 `.tgz` 带有 `package/` 顶层目录；插件根目录是解压后的 `package/`。Release ZIP 从插件根目录打包，直接包含隐藏清单目录。安装包必须包含四个客户端清单、市场文件、`skills/q-flow/`、示例、README 和许可证；不得包含 `node_modules`、测试输出或 IDE 配置。

版本需同步根 `package.json`、四个插件清单、Claude 市场条目及 Viewer 包/锁文件根版本。
