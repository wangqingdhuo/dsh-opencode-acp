# dsh-opencode-acp

把 [opencode](https://opencode.ai) 接成 DeepSeek Harness（DSH）的子代理。

主代理继续用自己的模型和上下文；`subagent_opencode` 把一件独立的任务交给另一个进程里的
opencode，由它用**自己的模型、工具和免费额度**干活，只把最终答案带回来。设置页里可以切换模型、
选择权限策略和工作目录，并查看每一次运行——包括 opencode 那边的会话 id、耗时和 token 用量。

[English](README.md)

## 为什么值得装

- **两个 harness，一次对话。** DSH 负责调度，opencode 出模型和手脚；它干活的中间过程不进你的
  上下文，也不进你的账单。
- **看得见发生了什么。** 这个插件自己说 ACP，所以每次运行都会记下远端会话 id、模型、耗时、
  工具调用次数和 token——"刚才那次是 opencode 里的哪个会话"有答案。
- **改设置不用重启。** 设置在每次委派开始时读取，保存后下一次委派就生效。

## 前置条件

| | |
|---|---|
| DeepSeek Harness | `>=0.2.1-rc.1 <0.3.0`（写在 `engines.dsh` 里，不匹配会拒绝安装） |
| opencode | v2，带 `acp` 子命令（`opencode --version`、`opencode acp --help` 能跑） |
| opencode 登录 | 已登录（`opencode auth login`）；子进程复用它，包括免费模型 |

## 安装

在 DSH 的插件页面安装，或者用命令行：

```sh
# 从 npm（预构建，无需构建步骤）
dsh plugin --profile default add dsh-opencode-acp

# 或者从 tarball
dsh plugin --profile default add ./dsh-opencode-acp-0.1.2.tgz
```

装完重启或刷新 DSH，会出现两样东西：

- 一个叫 `subagent_opencode` 的**委派工具**，该 profile 下所有 agent 都能用；
- **设置 → OpenCode 委派** 配置页。

## 怎么用

直接说，或者调工具：

```
交给 subagent_opencode：在这个仓库里给 parseDuration 补一个单元测试，并说明你改了什么。
```

调用立刻返回一个子代理 id，完成通知里带 opencode 的最终答复。子进程只拿到你的任务文本和工作
目录，拿不到你的对话历史。

## 设置项

| 分组 | 设置 | 含义 |
|---|---|---|
| 模型 | 主模型 | 下拉列出你 opencode 用过的模型，也允许手填 id |
| 模型 | 小模型 | opencode 生成标题/小任务用的模型（留空让它自己挑） |
| 模型 | 健康检查 | 跑一次 `opencode --version`，确认可执行文件找得到 |
| 执行 | 权限应答 | `allow` 自动放行权限请求，`reject` 一律拒绝 |
| 执行 | 工作目录 | 跟随调用方会话，或固定一个路径 |
| 高级 | 命令 / 参数 | opencode 可执行文件 + `acp` 参数 |
| 高级 | 收尾宽限 | 子进程退出等待，毫秒 |
| 高级 | 环境变量 | 额外环境变量（JSON 对象） |

设置存在 `$DSH_HOME/opencode-acp/settings.json`，运行记录在同目录的 `runs.json`（最近 100 条）。

## 原理

```
DSH agent ── subagent_opencode ──► ctx.subagents ──► dsh-opencode-acp（provider 名 "opencode"）
                                                        │ spawn: opencode acp
                                                        ▼
                                              ACP over stdio（NDJSON JSON-RPC）
                                       initialize → session/new → session/prompt
                                                        │
                                     ◄── agent_message_chunk、usage_update
```

- ACP 协议不带模型参数，所以模型只能在 opencode 侧决定。这个插件向子进程注入
  `OPENCODE_CONFIG_CONTENT`；`OPENCODE_CONFIG`（文件路径）在 v2 的 `acp` 模式下会被忽略——这是
  实测结论，不是猜的。
- 一次性执行：外部 ACP 子代理收不到后续消息，所以不可追问。需要多轮请用 DSH 自带的 `subagent`。
- 子进程用你的用户账号运行，**不受 DSH 沙箱约束**，和 DSH 官方的
  `@deepseek-ai/dsh-subagent-acp` 行为一致。把它当成"opencode 能干你本人能干的事"。

## 已知限制

- 只回传 assistant 文本；opencode 的工具调用、思考、计划都留在它自己的会话里。
- 每次运行新起一个进程，有数秒启动开销。
- Windows / macOS / Linux 都支持。默认命令在 Windows 上是 npm 全局安装的
  `%APPDATA%\npm\node_modules\@opencode\cli\bin\opencode.exe`，其他平台是 `PATH` 里的
  `opencode`；装法不同就在 **高级 → 启动命令** 改掉。

## 卸载

```sh
dsh plugin --profile default remove dsh-opencode-acp
```

移除后工具和设置页一起消失；`$DSH_HOME/opencode-acp` 里的数据要手动删。

## 开发

纯 JavaScript，没有构建步骤。

```sh
node --check index.js
node --check client.js
npm pack --dry-run
```

宿主半是 `index.js`（ACP 客户端、provider、存储、`/.dsh-opencode-acp` 下的 HTTP 路由），
浏览器半是 `client.js`（通过客户端模块表注册的 `settings.section` 页面）。两半都是具名导出，
`cordis.patch.yml` 插入两行。

## 许可

MIT
