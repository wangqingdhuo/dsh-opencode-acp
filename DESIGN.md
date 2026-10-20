# OpenCode ACP 委派 — 设计说明

2026-10-20 · 范围 B（配置面板 + 运行记录）

## 目标

把 opencode 接成 DSH 的子代理，并给一个图形化页面：改模型/权限/目录等设置即时生效，能看到每次委派的运行记录（opencode 会话 id、模型、耗时、token）。

## 决策

1. **自己实现 ACP 客户端**，不再依赖 `@deepseek-ai/dsh-subagent-acp`。
   理由：第三方 provider 只回传最终文本，拿不到远端 session id 和 usage；而"会话匹配"和"用量"正是范围 B 的核心。协议本身很小（`initialize` / `session/new` / `session/prompt` + NDJSON），成本可控。
2. **设置由本插件持有**（`$DSH_HOME/opencode-acp/settings.json`），provider 每次运行时读取，
   所以改设置**下一次委派即生效**，不需要改 profile 补丁、不需要重启。
3. **面板挂在 `settings.section`**（设置里一整页，和 dsh-wechat 同一座位），
   数据走宿主注册的 HTTP 路由 `/.dsh-opencode-acp/*`（与 dsh-wechat 同一套路）。
4. **模型只能由 opencode 侧决定**：ACP 协议不带模型参数，因此每次运行注入
   `OPENCODE_CONFIG_CONTENT`（实测 `OPENCODE_CONFIG` 在 acp 模式下被忽略）。

## 结构

```
bundles/opencode-acp/
  index.js          宿主半：ACP 客户端 / provider / 设置与记录存储 / HTTP 路由
  client.js         浏览器半：settings.section 页面
  cordis.patch.yml  两行：本插件 + subagent_opencode 工具
```

## 数据

`settings.json`：model, smallModel, permission, cwdMode, cwdFixed, command, args, env, graceMs
`runs.json`：最近 100 条 `{ id, at, ms, cwd, model, status, stopReason, sessionId, tokens, toolCalls, promptPreview, diagnostic }`

## 失败与边界

- 启动阶段（spawn / 握手）失败 → 委派工具返回错误结果，不产生幽灵子进程；记录 `status: error`。
- 运行中失败 → 结果 `stopReason: error` 带固定诊断行；本地取消 → `aborted`。
- 子进程不受 DSH 沙箱约束（与官方 ACP provider 一致），权限自动应答由设置里的 `permission` 决定。
- 一次性执行：不支持 `send_message` 追问。

## 验证

1. 装好后 `Config.listConfigs` 能看到 `include:opencode-acp` 且 active。
2. `GET /.dsh-opencode-acp/state` 返回设置与记录。
3. 真实委派一次：文件写出 + 记录里出现 session id / 模型 / token。
4. 面板截图确认渲染。
