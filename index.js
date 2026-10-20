/**
 * OpenCode ACP 委派 — 宿主半。
 *
 * Registers one subagent provider named `opencode` that drives
 * `opencode acp` (Agent Client Protocol over stdio) in a fresh subprocess, and
 * serves the settings page's JSON routes on the DSH web server.
 *
 * Why a local ACP client instead of `@deepseek-ai/dsh-subagent-acp`: that
 * provider returns only the final assistant text, while this page needs the
 * remote session id and token usage of every run. The protocol surface used
 * here is small: `initialize`, `session/new`, `session/prompt`,
 * `session/cancel`, `session/update`, `session/request_permission`.
 *
 * Settings live in `$DSH_HOME/opencode-acp/settings.json` and are read at the
 * start of every run, so a saved change applies to the next delegation without
 * touching the profile patch or restarting the Host.
 */
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const name = 'dsh-opencode-acp'
export const inject = ['subagents', 'subprocess']

const ROUTE_PREFIX = '/.dsh-opencode-acp'
const PROVIDER_NAME = 'opencode'
const MAX_RUNS = 100
const DEFAULT_COMMAND =
  'C:\\Users\\XWZJ93\\AppData\\Roaming\\npm\\node_modules\\@opencode\\cli\\bin\\opencode.exe'
const DEFAULT_MODEL = 'opencode/deepseek-v4.1-flash-free'
const FALLBACK_MODELS = [
  'opencode/deepseek-v4.1-flash-free',
  'opencode/minimax-m3.1-flash-free',
  'opencode/step-5-preview-free',
  'opencode/mimo-v2.6-flash-free',
  'opencode/mimo-v2.5-free',
]
const DEFAULT_SETTINGS = {
  model: DEFAULT_MODEL,
  smallModel: '',
  permission: 'allow',
  cwdMode: 'inherit',
  cwdFixed: '',
  command: DEFAULT_COMMAND,
  args: ['acp'],
  env: {},
  graceMs: 6000,
}

const ACP_TOOL_KINDS = new Set([
  'read', 'edit', 'delete', 'move', 'search', 'execute', 'think', 'fetch', 'switch_mode', 'other',
])

/* ── storage ─────────────────────────────────────────────────────────────── */

function homeDirectory() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

function readJsonFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJsonFile(file, value) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  } catch {
    /* a read-only home must not break delegation */
  }
}

function normalizeSettings(raw) {
  const next = { ...DEFAULT_SETTINGS }
  if (raw && typeof raw === 'object') {
    if (typeof raw.model === 'string') next.model = raw.model.trim()
    if (typeof raw.smallModel === 'string') next.smallModel = raw.smallModel.trim()
    if (raw.permission === 'allow' || raw.permission === 'reject') next.permission = raw.permission
    if (raw.cwdMode === 'fixed' || raw.cwdMode === 'inherit') next.cwdMode = raw.cwdMode
    if (typeof raw.cwdFixed === 'string') next.cwdFixed = raw.cwdFixed.trim()
    if (typeof raw.command === 'string' && raw.command.trim() !== '') next.command = raw.command.trim()
    if (Array.isArray(raw.args)) next.args = raw.args.filter((a) => typeof a === 'string')
    if (raw.env && typeof raw.env === 'object') {
      const env = {}
      for (const [k, v] of Object.entries(raw.env)) {
        if (typeof k === 'string' && k !== '' && typeof v === 'string') env[k] = v
      }
      next.env = env
    }
    const grace = Number(raw.graceMs)
    if (Number.isFinite(grace) && grace >= 500 && grace <= 120000) next.graceMs = Math.round(grace)
  }
  return next
}

function createStore() {
  const dir = path.join(homeDirectory(), 'opencode-acp')
  const settingsFile = path.join(dir, 'settings.json')
  const runsFile = path.join(dir, 'runs.json')
  const settings = normalizeSettings(readJsonFile(settingsFile, {}))
  const loaded = readJsonFile(runsFile, [])
  const runs = Array.isArray(loaded) ? loaded.filter((r) => r && typeof r === 'object') : []

  return {
    dir,
    settings,
    runs,
    saveSettings(patch) {
      this.settings = normalizeSettings({ ...this.settings, ...patch })
      writeJsonFile(settingsFile, this.settings)
      return this.settings
    },
    startRun(run) {
      this.runs = [run, ...this.runs].slice(0, MAX_RUNS)
      writeJsonFile(runsFile, this.runs)
    },
    finishRun(id, patch) {
      this.runs = this.runs.map((r) => (r.id === id ? { ...r, ...patch } : r))
      writeJsonFile(runsFile, this.runs)
    },
    clearRuns() {
      this.runs = []
      writeJsonFile(runsFile, this.runs)
    },
  }
}

/** Models opencode has used, read from its own state file (no subprocess). */
function opencodeModels() {
  const stateHome = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state')
  const file = path.join(stateHome, 'opencode', 'model.json')
  const raw = readJsonFile(file, undefined)
  const found = []
  for (const key of ['recent', 'favorite']) {
    const list = raw && Array.isArray(raw[key]) ? raw[key] : []
    for (const item of list) {
      if (!item || typeof item.providerID !== 'string' || typeof item.modelID !== 'string') continue
      const id = `${item.providerID}/${item.modelID}`
      if (!found.includes(id)) found.push(id)
    }
  }
  for (const id of FALLBACK_MODELS) if (!found.includes(id)) found.push(id)
  return found
}

/* ── ACP run ─────────────────────────────────────────────────────────────── */

function stopReasonOf(reason) {
  switch (reason) {
    case 'end_turn':
      return 'completed'
    case 'max_tokens':
      return 'max-tokens'
    case 'refusal':
      return 'refusal'
    case 'cancelled':
      return 'aborted'
    default:
      return 'error'
  }
}

function failureDiagnostic(stage, category) {
  return `Subagent failure (provider: opencode; stage: ${stage}; category: ${category})`
}

function promptText(prompt) {
  const parts = []
  for (const block of Array.isArray(prompt) ? prompt : []) {
    if (block && block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join('\n\n')
}

/**
 * Start one ACP child, complete the handshake, then run the prompt.
 * A handshake failure rejects so the delegation tool reports an error instead
 * of publishing an empty child.
 */
async function startAcpRun({ ctx, store, settings, cwd, prompt, signal }) {
  const runId = randomUUID()
  const startedAt = Date.now()
  const record = {
    id: runId,
    at: startedAt,
    cwd,
    model: settings.model,
    status: 'running',
    stopReason: null,
    ms: null,
    sessionId: null,
    tokens: null,
    toolCalls: 0,
    promptPreview: prompt.slice(0, 160),
    diagnostic: null,
  }
  store.startRun(record)

  const env = { ...process.env, ...settings.env }
  const inline = { autoupdate: false }
  if (settings.model !== '') inline.model = settings.model
  if (settings.smallModel !== '') inline.small_model = settings.smallModel
  env.OPENCODE_CONFIG_CONTENT = JSON.stringify(inline)

  let child
  try {
    child = ctx.subprocess.spawn({
      argv: [settings.command, ...settings.args],
      cwd,
      stdio: { stdin: 'pipe', stdout: 'pipe', stderr: 'inherit' },
      graceMs: settings.graceMs,
      env,
    })
  } catch (error) {
    store.finishRun(runId, {
      status: 'error',
      stopReason: 'error',
      ms: Date.now() - startedAt,
      diagnostic: failureDiagnostic('process', 'process-start'),
    })
    throw new Error(failureDiagnostic('process', 'process-start'), { cause: error })
  }

  const text = []
  let tokens = null
  let sessionId = null
  let toolCalls = 0
  let exitSeen = null
  const pending = new Map()
  let nextId = 1
  let buffer = ''
  let disposed = false
  let disposedPromise

  child.done.then(
    (outcome) => {
      exitSeen = outcome
    },
    () => {
      exitSeen = { exitCode: null, signal: null }
    },
  )

  const send = (message) => {
    try {
      child.stdin?.write(`${JSON.stringify(message)}\n`)
    } catch {
      /* the exit path reports the failure */
    }
  }
  const notify = (method, params) => send({ jsonrpc: '2.0', method, params })
  const request = (method, params) => {
    const id = nextId++
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      send({ jsonrpc: '2.0', id, method, params })
    })
  }

  const reply = (id, result) => send({ jsonrpc: '2.0', id, result })
  const replyError = (id, message) =>
    send({ jsonrpc: '2.0', id, error: { code: -32601, message } })

  const handleUpdate = (update) => {
    if (!update || typeof update !== 'object') return
    const kind = update.sessionUpdate
    if (kind === 'agent_message_chunk') {
      const part = update.content
      if (part && part.type === 'text' && typeof part.text === 'string') text.push(part.text)
      return
    }
    if (kind === 'tool_call' || kind === 'tool_call_update') {
      if (kind === 'tool_call') toolCalls += 1
      return
    }
    if (kind === 'usage_update') {
      const usage = update.usage ?? update.tokens ?? update
      if (usage && typeof usage === 'object') tokens = readTokens(usage)
    }
  }

  const handleLine = (line) => {
    let message
    try {
      message = JSON.parse(line)
    } catch {
      return
    }
    if (!message || typeof message !== 'object') return

    if (typeof message.method === 'string' && message.id !== undefined) {
      const method = message.method
      if (method === 'session/request_permission') {
        const params = message.params ?? {}
        const options = Array.isArray(params.options) ? params.options : []
        const kind = ACP_TOOL_KINDS.has(params.toolCall?.kind) ? params.toolCall.kind : 'unknown'
        if (settings.permission === 'allow') {
          const allow = options.find((o) => o && (o.kind === 'allow_once' || o.kind === 'allow_always'))
          if (allow) {
            reply(message.id, { outcome: { outcome: 'selected', optionId: allow.optionId } })
            return
          }
        }
        reply(message.id, { outcome: { outcome: 'cancelled' } })
        if (settings.permission !== 'allow' || !options.length) {
          store.finishRun(runId, { diagnostic: `permission denied (kind: ${kind})` })
        }
        return
      }
      if (method === 'fs/read_text_file' || method === 'fs/write_text_file') {
        replyError(message.id, 'client file access is not offered')
        return
      }
      replyError(message.id, `unsupported client method: ${method}`)
      return
    }

    if (typeof message.method === 'string') {
      if (message.method === 'session/update') handleUpdate(message.params?.update)
      return
    }

    const waiter = pending.get(message.id)
    if (waiter === undefined) return
    pending.delete(message.id)
    if (message.error) {
      const textPart = typeof message.error.message === 'string' ? message.error.message : 'ACP error'
      waiter.reject(new Error(textPart))
    } else {
      waiter.resolve(message.result)
    }
  }

  child.stdout?.on('data', (chunk) => {
    buffer += chunk.toString('utf8')
    let index
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (line !== '') handleLine(line)
    }
    if (buffer.length > 8 * 1024 * 1024) buffer = ''
  })

  const dispose = () => {
    if (disposedPromise !== undefined) return disposedPromise
    disposed = true
    disposedPromise = (async () => {
      try {
        child.stdin?.end()
      } catch {
        /* already closed */
      }
      let exited = false
      try {
        const bound = AbortSignal.timeout(settings.graceMs)
        exited = await child.waitForExit(bound)
      } catch {
        exited = false
      }
      if (!exited) {
        try {
          child.terminate()
        } catch {
          /* already gone */
        }
        try {
          await child.waitForExit(AbortSignal.timeout(settings.graceMs))
        } catch {
          /* bounded anyway */
        }
      }
      for (const waiter of pending.values()) waiter.reject(new Error('ACP child disposed'))
      pending.clear()
    })()
    return disposedPromise
  }

  const onAbort = () => {
    if (sessionId !== null) notify('session/cancel', { sessionId })
  }
  signal?.addEventListener('abort', onAbort, { once: true })

  const settle = (stopReason, diagnostic) => {
    const ms = Date.now() - startedAt
    store.finishRun(runId, {
      status: stopReason === 'completed' ? 'completed' : stopReason,
      stopReason,
      ms,
      sessionId,
      tokens,
      toolCalls,
      diagnostic: diagnostic ?? null,
    })
    signal?.removeEventListener('abort', onAbort)
  }

  /* handshake — failures reject before the child is published */
  try {
    await request('initialize', { protocolVersion: 1, clientCapabilities: {} })
    const session = await request('session/new', { cwd, mcpServers: [] })
    const id = session && typeof session.sessionId === 'string' ? session.sessionId : undefined
    if (id === undefined) throw new Error('child published without a session id')
    sessionId = id
    store.finishRun(runId, { sessionId })
  } catch (error) {
    settle('error', failureDiagnostic('initialize', 'handshake'))
    await dispose().catch(() => {})
    throw new Error(failureDiagnostic('initialize', 'handshake'), { cause: error })
  }

  const result = (async () => {
    let stopReason = 'error'
    let diagnostic = null
    try {
      if (signal?.aborted) throw new Error('cancelled before the prompt started')
      const answered = await request('session/prompt', {
        sessionId,
        prompt: [{ type: 'text', text: prompt }],
      })
      stopReason = stopReasonOf(answered?.stopReason)
      if (answered?.usage && typeof answered.usage === 'object') {
        tokens = readTokens(answered.usage)
      }
      if (stopReason === 'error') {
        diagnostic = `Subagent failure (provider: opencode; stage: prompt; category: remote-limit)`
      }
    } catch (error) {
      stopReason = signal?.aborted ? 'aborted' : 'error'
      if (!signal?.aborted) {
        const category = exitSeen === null ? 'transport' : 'process-exit'
        const suffix = exitSeen && typeof exitSeen.exitCode === 'number' ? `; exit code: ${exitSeen.exitCode}` : ''
        diagnostic = `Subagent failure (provider: opencode; stage: prompt; category: ${category}${suffix})`
      }
      void error
    } finally {
      settle(stopReason, diagnostic)
      await dispose().catch(() => {})
    }
    return {
      output: text.length === 0 ? [] : [{ type: 'text', text: text.join('') }],
      stopReason,
      ...(diagnostic === null ? {} : { diagnostic }),
    }
  })()

  return {
    id: runId,
    result,
    dispose,
    /* used by the plugin's unload cleanup */
    get disposed() {
      return disposed
    },
  }
}

function readTokens(usage) {
  const num = (value) => (Number.isFinite(value) ? value : 0)
  return {
    input: num(usage.inputTokens ?? usage.input ?? 0),
    output: num(usage.outputTokens ?? usage.output ?? 0),
    total: num(usage.totalTokens ?? usage.total ?? 0),
    cacheRead: num(usage.cachedReadTokens ?? usage.cacheRead ?? 0),
    cacheWrite: num(usage.cachedWriteTokens ?? usage.cacheWrite ?? 0),
  }
}

class OpencodeProvider {
  constructor(ctx, store, live) {
    this.name = PROVIDER_NAME
    this.capabilities = {
      agentOptions: false,
      agentPreset: false,
      outputSchema: false,
      depthLimit: false,
    }
    this.inheritsParentContext = false
    this.ctx = ctx
    this.store = store
    this.live = live
  }

  async start(request) {
    if (request.signal?.aborted) throw new Error('subagent request was aborted before start')
    const settings = this.store.settings
    const cwd =
      settings.cwdMode === 'fixed' && settings.cwdFixed !== ''
        ? settings.cwdFixed
        : typeof request.cwd === 'string' && request.cwd !== ''
          ? request.cwd
          : process.cwd()
    let stat
    try {
      stat = fs.statSync(cwd)
    } catch {
      throw new Error(failureDiagnostic('initialize', 'configuration'))
    }
    if (!stat.isDirectory()) throw new Error(failureDiagnostic('initialize', 'configuration'))

    const run = await startAcpRun({
      ctx: this.ctx,
      store: this.store,
      settings,
      cwd,
      prompt: promptText(request.prompt),
      signal: request.signal,
    })
    this.live.add(run)
    const release = () => this.live.delete(run)
    run.result.then(release, release)
    return { id: run.id, result: run.result, dispose: run.dispose }
  }
}

/* ── web routes ──────────────────────────────────────────────────────────── */

function writeJson(res, status, value) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(value))
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 1_000_000) throw new Error('body too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    throw new Error('invalid JSON body')
  }
}

/**
 * Spawn `opencode --version` in collect mode: proves the executable resolves and
 * returns the version string, without starting a server.
 */
async function probeVersion(ctx, settings) {
  const child = ctx.subprocess.spawn({
    argv: [settings.command, '--version'],
    cwd: homeDirectory(),
    stdio: { stdin: 'ignore', stdout: { maxBytes: 65536 }, stderr: { maxBytes: 65536 } },
    graceMs: 8000,
    env: { ...process.env },
  })
  const timeout = AbortSignal.timeout(15000)
  try {
    await child.done
  } catch {
    /* outcome below carries the facts */
  }
  let outcome = null
  try {
    outcome = await child.waitForExit(timeout)
  } catch {
    outcome = null
  }
  if (outcome === false) {
    try {
      child.terminate()
    } catch {
      /* already gone */
    }
  }
  const stdout = child.collected?.stdout?.readFrom(0).text ?? ''
  const stderr = child.collected?.stderr?.readFrom(0).text ?? ''
  const version = (stdout || stderr).trim().split(/\r?\n/).filter(Boolean)[0] ?? ''
  return { ok: version !== '', version }
}

function registerRoutes(ctx, store, state) {
  const webServer = ctx.get('webServer')
  if (webServer === undefined) return () => {}

  return webServer.register({
    kind: 'prefix',
    path: ROUTE_PREFIX,
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const route = url.pathname
      try {
        if (route === `${ROUTE_PREFIX}/state` && req.method === 'GET') {
          return writeJson(res, 200, {
            settings: store.settings,
            models: opencodeModels(),
            runs: store.runs,
            home: homeDirectory(),
          })
        }
        if (route === `${ROUTE_PREFIX}/settings` && req.method === 'POST') {
          const body = await readBody(req)
          const settings = store.saveSettings(body)
          return writeJson(res, 200, { settings })
        }
        if (route === `${ROUTE_PREFIX}/health` && req.method === 'POST') {
          const probe = await probeVersion(ctx, store.settings)
          state.health = { ...probe, at: Date.now() }
          return writeJson(res, 200, state.health)
        }
        if (route === `${ROUTE_PREFIX}/runs/clear` && req.method === 'POST') {
          store.clearRuns()
          return writeJson(res, 200, { runs: [] })
        }
        return writeJson(res, 404, { error: 'not found' })
      } catch (error) {
        return writeJson(res, 500, { error: error instanceof Error ? error.message : 'internal error' })
      }
    },
  })
}

/* ── plugin ──────────────────────────────────────────────────────────────── */

export function apply(ctx) {
  const store = createStore()
  const live = new Set()
  const state = { health: null }
  const provider = new OpencodeProvider(ctx, store, live)

  ctx.effect(() => {
    const disposeProvider = ctx.subagents.registerProvider(provider)
    const disposeRoutes = registerRoutes(ctx, store, state)
    return async () => {
      try {
        disposeRoutes()
      } catch {
        /* already disposed */
      }
      disposeProvider()
      await Promise.all([...live].map((run) => run.dispose().catch(() => {})))
      live.clear()
    }
  })
}
