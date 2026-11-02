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
import { StringDecoder } from 'node:string_decoder'

export const name = 'dsh-opencode-acp'
/*
 * `webServer` is a declared dependency, not merely a lookup. Routes used to be
 * registered only when the service happened to exist at activation time, which
 * is a race: on a boot where the web layer mounted later the settings page got
 * 404 on every route while delegation itself kept working. Declaring it makes
 * the Loader wait instead of silently skipping the routes.
 */
export const inject = ['subagents', 'subprocess', 'webServer']

const ROUTE_PREFIX = '/.dsh-opencode-acp'
const PROVIDER_NAME = 'opencode'
const MAX_RUNS = 100
/** npm's global install of opencode on Windows; a bare name elsewhere. */
function defaultCommand() {
  if (process.platform === 'win32' && typeof process.env.APPDATA === 'string') {
    return path.join(process.env.APPDATA, 'npm', 'node_modules', '@opencode', 'cli', 'bin', 'opencode.exe')
  }
  return 'opencode'
}

const DEFAULT_MODEL = 'opencode/deepseek-v4.1-flash-free'
/*
 * Free-tier ids that exist in opencode's catalog. Kept here so the picker shows
 * them even on a machine that has never run them; availability still varies
 * (per-account free quota, model endpoints), which is what 测试当前模型 answers.
 */
const FALLBACK_MODELS = [
  'opencode-go/iceman-contributor-free',
  'opencode/deepseek-v4.1-flash-free',
  'opencode/glm-5.3-flash-free',
  'opencode/mimo-v2.6-flash-free',
  'opencode/flint-40b-free',
  'opencode/nemotron-3.5-lightning-free',
  'opencode/nemotron-3-ultra-free',
  'opencode/beam-free',
]
const DEFAULT_SETTINGS = {
  model: DEFAULT_MODEL,
  smallModel: '',
  permission: 'allow',
  cwdMode: 'inherit',
  cwdFixed: '',
  command: defaultCommand(),
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

function readJsonFile(file, fallback, label = file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    /* A missing file is the normal first-run case; anything else means stored
     * state is unreadable and the caller is silently about to run on defaults. */
    if (error?.code !== 'ENOENT') {
      console.warn(`dsh-opencode-acp: ${label} could not be read (${error?.message ?? error}); using defaults`)
    }
    return fallback
  }
}

/**
 * Persist through a sibling temp file and rename, so a crash or a concurrent
 * reader never observes a truncated JSON document.
 * @returns whether the file was written.
 */
function writeJsonFile(file, value) {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    fs.renameSync(temp, file)
    return true
  } catch {
    /* a read-only home must not break delegation; the settings route reports it */
    try {
      fs.unlinkSync(temp)
    } catch {
      /* nothing to clean up */
    }
    return false
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

/** Environment for every opencode child: the Host environment plus settings overrides. */
function opencodeEnv(settings) {
  return { ...process.env, ...settings.env }
}

/**
 * `OPENCODE_CONFIG_CONTENT` for one child: Harness-owned keys shallow-merged
 * with any JSON object the user supplied through settings.env, so a user's own
 * extra config survives instead of being clobbered.
 * @param settings - live settings whose env may carry a user document.
 * @param managed - keys this plugin owns (autoupdate, model, small_model).
 * @returns the JSON string to export.
 */
function opencodeConfig(settings, managed) {
  const user = settings.env?.OPENCODE_CONFIG_CONTENT
  if (typeof user === 'string' && user.trim() !== '') {
    try {
      const parsed = JSON.parse(user)
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return JSON.stringify({ ...managed, ...parsed })
      }
    } catch {
      /* invalid user JSON: keep the managed document, the child reports its own error */
    }
  }
  return JSON.stringify(managed)
}

function createStore() {
  const dir = path.join(homeDirectory(), 'opencode-acp')
  const settingsFile = path.join(dir, 'settings.json')
  const runsFile = path.join(dir, 'runs.json')
  const settings = normalizeSettings(readJsonFile(settingsFile, {}, settingsFile))
  const loaded = readJsonFile(runsFile, [], runsFile)
  const stored = Array.isArray(loaded) ? loaded.filter((r) => r && typeof r === 'object') : []
  /* A run that was still running when the Host exited can never finish; record
   * the restart explicitly instead of leaving a permanent "running" row. */
  let reconciled = false
  const runs = stored.map((run) => {
    if (run.status !== 'running') return run
    reconciled = true
    return { ...run, status: 'error', stopReason: 'error', diagnostic: 'host restart' }
  })
  if (reconciled) writeJsonFile(runsFile, runs)

  return {
    dir,
    settings,
    runs,
    saveSettings(patch) {
      const next = normalizeSettings({ ...this.settings, ...patch })
      /* A settings route must not answer 200 for a change it could not store. */
      if (!writeJsonFile(settingsFile, next)) throw new Error('settings could not be persisted')
      this.settings = next
      return next
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

/** One line, bounded: an ACP error message is safe to show, but never unbounded. */
function boundedDetail(text) {
  if (typeof text !== 'string') return ''
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > 180 ? `${flat.slice(0, 177)}…` : flat
}

/**
 * Last-resort failure detail from a collected child stderr: one bounded line.
 * @param child - the subprocess handle whose stderr was collected.
 * @param limit - maximum characters kept from the tail.
 * @returns flattened tail, or '' when nothing was collected.
 */
function stderrTail(child, limit = 300) {
  try {
    const text = child?.collected?.stderr?.readFrom(0).text ?? ''
    const flat = text.replace(/\s+/g, ' ').trim()
    if (flat === '') return ''
    return flat.length > limit ? flat.slice(-limit) : flat
  } catch {
    return ''
  }
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
    errorName: null,
    detail: null,
    note: null,
  }
  store.startRun(record)

  const env = opencodeEnv(settings)
  const inline = { autoupdate: false }
  if (settings.model !== '') inline.model = settings.model
  if (settings.smallModel !== '') inline.small_model = settings.smallModel
  env.OPENCODE_CONFIG_CONTENT = opencodeConfig(settings, inline)

  let child
  try {
    child = ctx.subprocess.spawn({
      argv: [settings.command, ...settings.args],
      cwd,
      /*
       * stderr is collected, not inherited: an ACP-level failure usually only
       * explains itself there, and the diagnostic needs it. Collection also
       * keeps an unread pipe from blocking a chatty child.
       */
      stdio: { stdin: 'pipe', stdout: 'pipe', stderr: { maxBytes: 65536 } },
      graceMs: settings.graceMs,
      env,
    })
  } catch (error) {
    const detail = boundedDetail(String(error?.message ?? error))
    const diagnostic = `${failureDiagnostic('process', 'process-start')}${
      detail === '' ? '' : `; detail: ${detail}`
    }`
    store.finishRun(runId, {
      status: 'error',
      stopReason: 'error',
      ms: Date.now() - startedAt,
      diagnostic,
    })
    throw new Error(diagnostic, { cause: error })
  }

  /*
   * A pipe can fail asynchronously (a write after the child died raises EPIPE).
   * Without a listener that becomes an uncaught exception in the Host process.
   */
  child.stdin?.on('error', () => {})
  child.stdout?.on('error', () => {})

  const text = []
  let tokens = null
  let sessionId = null
  let toolCalls = 0
  let exitSeen = null
  let policyRefusal = null
  const decoder = new StringDecoder('utf8')
  const pending = new Map()
  let nextId = 1
  let buffer = ''
  let disposed = false
  let disposedPromise

  /**
   * A child that exits while a request is in flight can never answer it. Without
   * this, the `session/prompt` promise stays pending forever and the delegation
   * hangs until the caller's tool timeout instead of failing with a diagnostic.
   */
  const rejectPending = (message) => {
    for (const [id, waiter] of pending) {
      pending.delete(id)
      waiter.reject(new Error(message))
    }
  }

  child.done.then(
    (outcome) => {
      exitSeen = outcome
      rejectPending('ACP child exited before answering')
    },
    () => {
      exitSeen = { exitCode: null, signal: null }
      rejectPending('ACP child exited before answering')
    },
  )

  const send = (message) => {
    const stdin = child.stdin
    if (stdin === undefined || stdin.destroyed === true || stdin.writable !== true) return
    try {
      stdin.write(`${JSON.stringify(message)}\n`)
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
          /* Kept in its own field: settle() must not overwrite it later. */
          policyRefusal = `permission denied (kind: ${kind})`
          store.finishRun(runId, { note: policyRefusal })
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
      const error = new Error(textPart)
      error.acp = {
        message: textPart,
        errorName:
          message.error.data && typeof message.error.data.errorName === 'string'
            ? message.error.data.errorName
            : undefined,
      }
      waiter.reject(error)
    } else {
      waiter.resolve(message.result)
    }
  }

  child.stdout?.on('data', (chunk) => {
    buffer += typeof chunk === 'string' ? chunk : decoder.write(chunk)
    let index
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (line !== '') handleLine(line)
    }
    if (buffer.length > 8 * 1024 * 1024) {
      // One NDJSON line this large is protocol abuse or corruption; keeping it
      // would grow without bound, dropping it would parse a broken frame.
      buffer = ''
      store.finishRun(runId, { detail: 'protocol buffer overflow (line longer than 8 MiB)' })
      rejectPending('ACP protocol line exceeded 8 MiB')
    }
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
    if (sessionId !== null) {
      notify('session/cancel', { sessionId })
      return
    }
    /*
     * The handshake has no session to cancel. Reject the in-flight request and
     * tear the child down, or an aborted delegation keeps waiting for a reply
     * that may never come.
     */
    for (const waiter of pending.values()) waiter.reject(new Error('ACP run aborted during the handshake'))
    pending.clear()
    void dispose().catch(() => {})
  }
  signal?.addEventListener('abort', onAbort, { once: true })

  const settle = (stopReason, diagnostic) => {
    const ms = Date.now() - startedAt
    /* A policy refusal is not a user cancellation: give it its own status. */
    const status =
      policyRefusal !== null && stopReason === 'aborted'
        ? 'refusal'
        : stopReason === 'completed'
          ? 'completed'
          : stopReason
    store.finishRun(runId, {
      status,
      stopReason,
      ms,
      sessionId,
      tokens,
      toolCalls,
      diagnostic: diagnostic ?? (policyRefusal !== null && stopReason !== 'completed' ? policyRefusal : null),
      note: policyRefusal,
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
    if (signal?.aborted) {
      settle('aborted', null)
      await dispose().catch(() => {})
      throw new Error(failureDiagnostic('initialize', 'aborted'), { cause: error })
    }
    const acp = error && typeof error === 'object' ? error.acp : undefined
    const parts = [acp === undefined ? boundedDetail(String(error?.message ?? '')) : boundedDetail(acp.message)]
    if (exitSeen !== null && typeof exitSeen.exitCode === 'number') parts.push(`exit code ${exitSeen.exitCode}`)
    const tail = stderrTail(child)
    if (tail !== '') parts.push(`stderr: ${tail}`)
    const detail = parts.filter((part) => part !== '').join('; ')
    const diagnostic = `Subagent failure (provider: opencode; stage: initialize; category: ${
      acp?.errorName ?? (exitSeen === null ? 'handshake' : 'process-exit')
    }${detail === '' ? '' : `; detail: ${detail}`})`
    settle('error', diagnostic)
    await dispose().catch(() => {})
    /* The model must see the reason (unknown model, auth required, ENOENT). */
    throw new Error(diagnostic, { cause: error })
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
        const acp = error && typeof error === 'object' ? error.acp : undefined
        const suffix =
          exitSeen && typeof exitSeen.exitCode === 'number' ? `; exit code: ${exitSeen.exitCode}` : ''
        if (acp !== undefined) {
          /*
           * The child answered with a JSON-RPC error, which is the normal shape
           * for "your provider refused this": keep its own name and message, so
           * an exhausted free tier reads as `free-limit`, not `transport`.
           */
          const category =
            acp.errorName === 'provider.free-limit'
              ? 'free-limit'
              : acp.errorName === undefined
                ? 'provider'
                : acp.errorName
          const detail = boundedDetail(acp.message)
          const tail = stderrTail(child)
          diagnostic = `Subagent failure (provider: opencode; stage: prompt; category: ${category}${
            detail === '' ? '' : `; detail: ${detail}`
          }${tail === '' ? '' : `; stderr: ${tail}`})`
          store.finishRun(runId, { errorName: acp.errorName ?? null, detail: detail || null })
        } else {
          const category = exitSeen === null ? 'transport' : 'process-exit'
          const tail = stderrTail(child)
          diagnostic = `Subagent failure (provider: opencode; stage: prompt; category: ${category}${suffix}${
            tail === '' ? '' : `; stderr: ${tail}`
          })`
        }
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
  let child
  try {
    child = ctx.subprocess.spawn({
      argv: [settings.command, '--version'],
      cwd: homeDirectory(),
      stdio: { stdin: 'ignore', stdout: { maxBytes: 65536 }, stderr: { maxBytes: 65536 } },
      graceMs: 8000,
      env: opencodeEnv(settings),
    })
  } catch (error) {
    return { ok: false, version: '', detail: boundedDetail(String(error?.message ?? error)) }
  }
  child.stdin?.on('error', () => {})
  child.stdout?.on('error', () => {})

  /* waitForExit is the timeout: awaiting child.done first would be unbounded. */
  let exited = false
  try {
    exited = await child.waitForExit(AbortSignal.timeout(15000))
  } catch {
    exited = false
  }
  let outcome = null
  if (exited) {
    outcome = await child.done.then(
      (value) => value,
      () => null,
    )
  } else {
    try {
      child.terminate()
    } catch {
      /* already gone */
    }
    try {
      await child.waitForExit(AbortSignal.timeout(5000))
    } catch {
      /* bounded anyway */
    }
  }

  const stdout = child.collected?.stdout?.readFrom(0).text ?? ''
  const stderr = child.collected?.stderr?.readFrom(0).text ?? ''
  const version = (stdout || stderr).trim().split(/\r?\n/).filter(Boolean)[0] ?? ''
  /* A resolved executable is not a working one: a non-zero exit is a failure. */
  const ok = exited && outcome !== null && outcome.exitCode === 0 && version !== ''
  if (ok) return { ok: true, version }
  const stderrDetail = stderr.trim() === '' ? '' : `; stderr: ${boundedDetail(stderr)}`
  const failure = [
    outcome === null
      ? exited
        ? 'the command could not be started'
        : 'command did not exit within 15s'
      : outcome.exitCode === null
        ? `killed by ${String(outcome.signal ?? 'a signal')}`
        : outcome.exitCode !== 0
          ? `exit code ${String(outcome.exitCode)}`
          : 'no version output',
    stderrDetail,
  ]
    .filter((part) => part !== '')
    .join('')
  return { ok: false, version, detail: boundedDetail(failure) }
}

/**
 * One throwaway ACP run against one model: `initialize`, `session/new`, and a
 * one-word prompt. Free tiers expire per account and model endpoints disappear
 * without notice, so "does this model answer right now" has to be asked, not
 * inferred from the catalog.
 */
async function probeModel(ctx, settings, model) {
  const startedAt = Date.now()
  const env = opencodeEnv(settings)
  const inline = { autoupdate: false }
  if (model !== '') inline.model = model
  env.OPENCODE_CONFIG_CONTENT = opencodeConfig(settings, inline)

  let child
  try {
    child = ctx.subprocess.spawn({
      argv: [settings.command, ...settings.args],
      /* Same resolution as a real run: a pinned directory only when the mode says so. */
      cwd: settings.cwdMode === 'fixed' && settings.cwdFixed !== '' ? settings.cwdFixed : process.cwd(),
      /*
       * stderr must be drained: opencode is chatty on it, and an unread pipe
       * fills at ~64 KiB and blocks the child mid-handshake, which looks exactly
       * like a dead model.
       */
      stdio: { stdin: 'pipe', stdout: 'pipe', stderr: { maxBytes: 65536 } },
      graceMs: 5000,
      env,
    })
  } catch (error) {
    return { ok: false, model, stage: 'process', detail: boundedDetail(String(error?.message ?? error)) }
  }
  child.stdin?.on('error', () => {})
  child.stdout?.on('error', () => {})

  const pending = new Map()
  let nextId = 0
  let buffer = ''
  let closed = false
  const decoder = new StringDecoder('utf8')
  /* A child that cannot start (or dies) never answers: race every call with it. */
  const childDone = child.done.then(
    (outcome) => ({ childOutcome: outcome }),
    (error) => ({ childError: error }),
  )
  const childFailure = (result) => {
    const error = result.childError
    const detail =
      error !== undefined
        ? boundedDetail(String(error?.message ?? error))
        : `the child exited (code ${String(result.childOutcome?.exitCode ?? 'null')}) before answering`
    return { ok: false, model, stage: 'process', detail }
  }
  const send = (message) => {
    const stdin = child.stdin
    if (stdin === undefined || stdin.destroyed === true || stdin.writable !== true) return
    try {
      stdin.write(`${JSON.stringify(message)}\n`)
    } catch {
      /* reported by the child-exit path */
    }
  }
  const call = (method, params) =>
    Promise.race([
      new Promise((resolve) => {
        const id = ++nextId
        pending.set(id, resolve)
        send({ jsonrpc: '2.0', id, method, params })
      }),
      childDone,
    ])

  child.stdout?.on('data', (chunk) => {
    buffer += typeof chunk === 'string' ? chunk : decoder.write(chunk)
    let index
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (line === '') continue
      let message
      try {
        message = JSON.parse(line)
      } catch {
        continue
      }
      /* Only a message carrying an id is a request; notifications get no reply. */
      if (typeof message.method === 'string' && message.id !== undefined) {
        if (message.method === 'session/request_permission') {
          send({ jsonrpc: '2.0', id: message.id, result: { outcome: { outcome: 'cancelled' } } })
        } else {
          send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'probe: unsupported' } })
        }
        continue
      }
      const settleWaiter = pending.get(message.id)
      if (settleWaiter !== undefined) {
        pending.delete(message.id)
        settleWaiter(message)
      }
    }
  })

  const cleanup = () => {
    if (closed) return
    closed = true
    try {
      child.stdin?.end()
    } catch {
      /* already closed */
    }
    setTimeout(() => {
      try {
        child.terminate()
      } catch {
        /* already gone */
      }
    }, 1500).unref?.()
  }

  const deadline = new AbortController()
  const timer = setTimeout(() => deadline.abort(), 75000)
  const timedOut = new Promise((resolve) => {
    deadline.signal.addEventListener('abort', () => resolve({ probeTimeout: true }), { once: true })
  })

  try {
    const init = await Promise.race([call('initialize', { protocolVersion: 1, clientCapabilities: {} }), timedOut])
    if (init.childOutcome !== undefined || init.childError !== undefined) return childFailure(init)
    if (init.probeTimeout === true) return { ok: false, model, stage: 'initialize', detail: 'probe timed out' }
    if (init.error) {
      return { ok: false, model, stage: 'initialize', detail: boundedDetail(init.error.message) }
    }
    const session = await Promise.race([call('session/new', { cwd: homeDirectory(), mcpServers: [] }), timedOut])
    if (session.childOutcome !== undefined || session.childError !== undefined) return childFailure(session)
    if (session.probeTimeout === true) return { ok: false, model, stage: 'new-session', detail: 'probe timed out' }
    if (session.error) {
      return { ok: false, model, stage: 'new-session', detail: boundedDetail(session.error.message) }
    }
    const answered = await Promise.race([
      call('session/prompt', {
        sessionId: session.result?.sessionId,
        prompt: [{ type: 'text', text: 'Reply with exactly: PONG' }],
      }),
      timedOut,
    ])
    if (answered.childOutcome !== undefined || answered.childError !== undefined) return childFailure(answered)
    if (answered.probeTimeout === true) {
      return { ok: false, model, stage: 'prompt', detail: 'probe timed out' }
    }
    if (answered.error) {
      const name = answered.error.data?.errorName
      return {
        ok: false,
        model,
        stage: 'prompt',
        errorName: typeof name === 'string' ? name : null,
        detail: boundedDetail(answered.error.message),
        ms: Date.now() - startedAt,
      }
    }
    return {
      ok: true,
      model,
      stage: 'prompt',
      stopReason: answered.result?.stopReason ?? null,
      ms: Date.now() - startedAt,
    }
  } finally {
    clearTimeout(timer)
    cleanup()
  }
}

function registerRoutes(ctx, store, state) {
  const webServer = ctx.get('webServer')
  if (webServer === undefined) {
    // Unreachable with `webServer` declared in `inject`; loud rather than silent.
    console.warn('dsh-opencode-acp: no webServer service, settings routes unavailable')
    return () => {}
  }

  /**
   * Browsers send Origin on cross-origin-capable requests. Only this listener's
   * own origin may drive the settings routes, so another site cannot reconfigure
   * the delegation command through a plain form/`text/plain` POST. Loopback
   * spellings of the same authority are accepted: a page opened as `localhost`
   * is still this server.
   */
  const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])
  const originAllowed = (req) => {
    const header = req.headers.origin
    if (header === undefined) return true
    if (header === 'null') return false
    let own
    try {
      own = webServer.getOrigin()
    } catch {
      /* the listener has not bound yet: refuse rather than guess */
      return false
    }
    if (header === own) return true
    try {
      const seen = new URL(header)
      const self = new URL(own)
      return (
        seen.protocol === self.protocol &&
        seen.port === self.port &&
        LOOPBACK_HOSTS.has(seen.hostname) &&
        LOOPBACK_HOSTS.has(self.hostname)
      )
    } catch {
      return false
    }
  }

  const isJsonRequest = (req) => {
    const type = req.headers['content-type']
    if (typeof type !== 'string') return false
    return type.split(';', 1)[0].trim().toLowerCase() === 'application/json'
  }

  /**
   * Apply the POST admission checks.
   * @returns whether the handler may proceed; the failure response is written otherwise.
   */
  const admitPost = (req, res) => {
    if (!originAllowed(req)) {
      writeJson(res, 403, { error: 'cross-origin request rejected' })
      return false
    }
    if (!isJsonRequest(req)) {
      writeJson(res, 415, { error: 'content-type must be application/json' })
      return false
    }
    return true
  }

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
            health: state.health,
            probe: state.probe,
          })
        }
        if (route === `${ROUTE_PREFIX}/settings` && req.method === 'POST') {
          if (!admitPost(req, res)) return undefined
          const body = await readBody(req)
          const settings = store.saveSettings(body)
          return writeJson(res, 200, { settings })
        }
        if (route === `${ROUTE_PREFIX}/health` && req.method === 'POST') {
          if (!admitPost(req, res)) return undefined
          const probe = await probeVersion(ctx, store.settings)
          state.health = { ...probe, at: Date.now() }
          return writeJson(res, 200, state.health)
        }
        if (route === `${ROUTE_PREFIX}/probe` && req.method === 'POST') {
          if (!admitPost(req, res)) return undefined
          const body = await readBody(req)
          const model =
            typeof body.model === 'string' && body.model.trim() !== ''
              ? body.model.trim()
              : store.settings.model
          const result = await probeModel(ctx, store.settings, model)
          state.probe = { ...result, at: Date.now() }
          return writeJson(res, 200, state.probe)
        }
        if (route === `${ROUTE_PREFIX}/runs/clear` && req.method === 'POST') {
          if (!admitPost(req, res)) return undefined
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
  const state = { health: null, probe: null }
  const provider = new OpencodeProvider(ctx, store, live)

  ctx.effect(() => {
    const disposeProvider = ctx.subagents.registerProvider(provider)
    try {
      /*
       * Routes live in their own effect so their disposal is independent; the
       * try/catch rolls the provider back if registration throws, instead of
       * stranding a registered provider on a failed fiber.
       */
      ctx.effect(() => {
        const disposeRoutes = registerRoutes(ctx, store, state)
        return () => {
          try {
            disposeRoutes()
          } catch {
            /* already disposed */
          }
        }
      }, 'opencode-acp.routes')
    } catch (error) {
      disposeProvider()
      throw error
    }
    return async () => {
      disposeProvider()
      await Promise.all([...live].map((run) => run.dispose().catch(() => {})))
      live.clear()
    }
  }, 'opencode-acp.provider')
}
