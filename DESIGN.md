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

1. `GET /.dsh-opencode-acp/state` 返回设置、模型列表与运行记录。
2. 真实委派一次：文件写出 + 记录里出现 session id / 模型 / token。
3. 额度用尽的模型 → 记录里 `errorName: provider.free-limit`，且 `diagnostic` 带原文；换一个免费模型可正常完成。
