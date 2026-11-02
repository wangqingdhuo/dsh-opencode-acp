# OpenCode ACP 委派 — 设计说明

把 opencode 接成 DSH 的子代理，并给一个图形化页面：改模型/权限/目录等设置即时生效，能看到每次委派的运行记录（opencode 会话 id、模型、耗时、token）。

## 决策

1. **自己实现 ACP 客户端**，不依赖 `@deepseek-ai/dsh-subagent-acp`：官方 provider 只回传最终文本，拿不到远端 session id 和 usage，而"会话匹配"和"用量"正是这个页面的核心。
2. **设置由本插件持有**（`$DSH_HOME/opencode-acp/settings.json`），provider 每次运行读取，所以改设置**下一次委派即生效**，不需要改 profile 补丁或重启。
3. **面板挂在 `settings.section`**，数据走宿主注册的 HTTP 路由 `/.dsh-opencode-acp/*`。
4. **模型只能由 opencode 侧决定**：ACP 协议不带模型参数，因此每次运行注入 `OPENCODE_CONFIG_CONTENT`（实测 `OPENCODE_CONFIG` 在 `acp` 模式下被忽略）。

## 结构

```
index.js          宿主半：ACP 客户端 / provider / 设置与记录存储 / HTTP 路由
client.js         浏览器半：settings.section 页面
cordis.patch.yml  两行：本插件 + subagent_opencode 工具
```

## 数据

`settings.json`：model, smallModel, permission, cwdMode, cwdFixed, command, args, env, graceMs
`runs.json`：最近 100 条 `{ id, at, ms, cwd, model, status, stopReason, sessionId, tokens, toolCalls, promptPreview, diagnostic, errorName, detail }`

## 依赖与失败

- `inject = ['subagents', 'subprocess', 'webServer']`：三者都是硬依赖。`webServer` 曾被写成"用到才查"，在 web 层晚于本插件挂载的那次启动里导致所有路由 404（面板打不开、委派却仍可用）；声明成依赖后由 Loader 等待。
- 启动阶段（spawn / 握手）失败 → 委派工具返回错误结果，不产生幽灵子进程；记录 `status: error`。
- 运行中失败 → 结果 `stopReason: error`，诊断行保留 ACP 的 `errorName` 与 message（例如 `provider.free-limit` → "免费额度用完"），而不是笼统的 `transport`。
- 子进程不受 DSH 沙箱约束；权限自动应答由设置里的 `permission` 决定。
- 一次性执行：不支持 `send_message` 追问。

## 验证

1. `GET /.dsh-opencode-acp/state` 返回设置、模型列表、运行记录，以及上次 `health`/`probe` 结果。
2. 真实委派一次：文件写出 + 记录里出现 session id / 模型 / token。
3. 额度用尽的模型 → 记录里 `errorName: provider.free-limit`，且 `diagnostic` 带原文；换一个免费模型可正常完成。
4. `npm test`：用桩运行时加载两半，校验 provider/路由/页面注册与关键失败路径（CI 每个 push 跑）。

## 0.3.0 的加固（团队评审产出）

- **不再挂起**：请求进行中子进程退出 → 立即 reject 所有等待中的请求并给出 `process-exit` 诊断；握手期间 abort 也生效。
- **不炸进程**：stdin/stdout 的 `error` 监听 + 可写性守卫（此前一次 EPIPE 就能让 Host 抛未捕获异常）。
- **中文不花**：用 `StringDecoder` 解码 NDJSON，多字节字符跨 chunk 不再变成 U+FFFD。
- **存储原子化**：settings/runs 走临时文件 + rename；读坏文件留警告；写失败返回 500 而不是假装保存；启动时把残留的 `running` 记录和解成 `error / host restart`。
- **诊断带原因**：收集子进程 stderr 尾部并附到失败诊断；握手/启动失败把 ACP 原文（未知模型、需要登录、ENOENT）带给模型。
- **探针可用**：`probeVersion` 真正受 15s 约束、要求退出码为 0；`probeModel` 观察 `child.done`（不可执行文件秒回 `stage: process`），且不再回复 notification。
- **路由收紧**：POST 要求 `application/json`（415）且同源（403，回环别名放行）；`/state` 附带 health/probe。
- **配置合并**：`OPENCODE_CONFIG_CONTENT` 由插件默认值与用户 JSON 浅合并，不再互相覆盖。
- **生命周期**：路由注册放进嵌套 `ctx.effect`，注册失败会回滚已注册的 provider。
- **界面**：暗色主题下主按钮白底白字（改用 `bg-base` 作前景）、载荷形状校验（坏数据不再让整页空白）、加载失败可重试、草稿不被刷新覆盖、耗时/表头/键盘可达性、中英双语、运行表 30 条 + 显示全部。

