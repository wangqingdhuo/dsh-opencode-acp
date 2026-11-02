#!/usr/bin/env node
/**
 * Contract smoke test for both halves of dsh-opencode-acp.
 *
 * It loads the real files with stubs for the two runtimes they expect — the
 * browser module table for client.js, a Cordis context for index.js — and
 * asserts the parts a user feels: the plugin still registers its provider, its
 * routes, and its settings page, and a malformed host payload cannot throw
 * during render.
 *
 * `npm test` runs it; CI runs it on every push.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

/* ── browser half ────────────────────────────────────────────────────────── */

function createStubReact() {
  const noop = () => {}
  return {
    Fragment: Symbol('Fragment'),
    createElement(type, props, ...children) {
      return { type, props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children } }
    },
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, noop]
    },
    useEffect(fn) {
      try {
        const out = fn()
        if (out && typeof out.then === 'function') out.then(noop, noop)
      } catch {
        /* a component reports its own load failure */
      }
    },
    useCallback(fn) {
      return fn
    },
    useMemo(fn) {
      return fn()
    },
    useRef(value) {
      return { current: value }
    },
  }
}

function walkTree(node, visit) {
  if (node === null || node === undefined || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) walkTree(item, visit)
    return
  }
  visit(node)
  walkTree(node.props?.children, visit)
}

async function testClient() {
  const source = fs.readFileSync(path.join(root, 'client.js'), 'utf8')
  const captured = []
  globalThis.window = { __ModuleLoader__: { load: (entry) => captured.push(entry) } }

  new Function(source)()
  assert.equal(captured.length, 1, 'client.js must call __ModuleLoader__.load exactly once')
  const entry = captured[0]
  assert.equal(entry.id, 'dsh-opencode-acp', 'client module id must match the package name')

  const React = createStubReact()
  const exports_ = entry.factory((id) => {
    if (id === 'react') return React
    throw new Error(`client requires an unexpected module: ${id}`)
  })
  assert.equal(exports_.name, 'dsh-opencode-acp')
  assert.ok(Array.isArray(exports_.inject) && exports_.inject.includes('slots'), 'client must inject slots')
  assert.equal(typeof exports_.apply, 'function')

  const registered = []
  const ctx = {
    slots: {
      inject: (key, contribute) => contribute(),
      register: (options, component) => {
        registered.push({ options, component })
        return () => {}
      },
    },
  }
  exports_.apply(ctx)
  assert.equal(registered.length, 1, 'client must register exactly one settings page')
  const { options, component } = registered[0]
  assert.equal(options.name, 'settings.section')
  assert.equal(options.id, 'opencode')
  assert.equal(typeof options.label, 'function')

  const validState = {
    settings: {
      model: 'opencode/deepseek-v4.1-flash-free',
      smallModel: '',
      permission: 'allow',
      cwdMode: 'inherit',
      cwdFixed: '',
      command: 'opencode',
      args: ['acp'],
      env: {},
      graceMs: 6000,
    },
    models: ['opencode/deepseek-v4.1-flash-free'],
    runs: [
      {
        id: 'r1',
        at: Date.now(),
        cwd: 'D:\\demo',
        model: 'opencode/deepseek-v4.1-flash-free',
        status: 'completed',
        stopReason: 'completed',
        ms: 4200,
        sessionId: 'ses_smoke',
        tokens: { input: 10, output: 2, total: 12, cacheRead: 0, cacheWrite: 0 },
        toolCalls: 1,
        promptPreview: 'smoke',
        diagnostic: null,
      },
    ],
    home: path.join(os.homedir(), '.dsh'),
  }

  const render = (payload, label) => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      async text() {
        return typeof payload === 'string' ? payload : JSON.stringify(payload)
      },
    })
    const tree = component({ close() {} })
    let nodes = 0
    walkTree(tree, () => {
      nodes += 1
    })
    assert.ok(nodes > 0, `client must render something (${label})`)
  }

  render(validState, 'valid payload')
  // A host that answers 200 with an unexpected shape must not blank the pane by
  // throwing inside the shell's error boundary.
  render({}, 'empty payload')
  render('{not json', 'malformed payload')
  delete globalThis.window
}

/* ── host half ───────────────────────────────────────────────────────────── */

async function testHost() {
  // Keep the test away from the user's real settings and run history.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-opencode-acp-smoke-'))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
  try {
    const module = await import(pathToFileURL(path.join(root, 'index.js')).href)
    assert.equal(module.name, 'dsh-opencode-acp')
    assert.ok(Array.isArray(module.inject), 'host must declare inject')
    for (const service of ['subagents', 'subprocess', 'webServer']) {
      assert.ok(module.inject.includes(service), `host must inject ${service}`)
    }
    assert.equal(typeof module.apply, 'function')

    const routes = []
    const providers = []
    const disposers = []
    const ctx = {
      logger: { warn() {}, info() {}, debug() {} },
      effect(fn) {
        const disposer = fn()
        disposers.push(disposer)
        return () => {}
      },
      get(name) {
        if (name === 'webServer') {
          return {
            register(route) {
              routes.push(route)
              return () => {}
            },
            getOrigin() {
              return 'http://127.0.0.1:0'
            },
          }
        }
        return undefined
      },
      subagents: {
        registerProvider(provider) {
          providers.push(provider)
          return () => {}
        },
      },
      subprocess: {
        spawn() {
          throw new Error('smoke test never spawns a child')
        },
      },
    }

    module.apply(ctx)

    assert.equal(providers.length, 1, 'host must register one subagent provider')
    assert.equal(providers[0].name, 'opencode')
    assert.equal(providers[0].inheritsParentContext, false)
    assert.deepEqual(providers[0].capabilities, {
      agentOptions: false,
      agentPreset: false,
      outputSchema: false,
      depthLimit: false,
    })

    assert.equal(routes.length, 1, 'host must register one route')
    const route = routes[0]
    assert.equal(route.kind, 'prefix')
    assert.equal(route.path, '/.dsh-opencode-acp')

    const call = async (method, url, body, headers = {}) => {
      const chunks = []
      const req = {
        method,
        url,
        headers: { host: '127.0.0.1', ...headers },
        async *[Symbol.asyncIterator]() {
          if (body !== undefined) chunks.push(Buffer.from(body))
          for (const chunk of chunks) yield chunk
        },
      }
      const response = {
        statusCode: 0,
        headers: {},
        body: '',
        setHeader(k, v) {
          this.headers[k] = v
        },
        end(text) {
          this.body = text ?? ''
        },
      }
      await route.handler(req, response)
      let json = null
      try {
        json = response.body === '' ? null : JSON.parse(response.body)
      } catch {
        json = null
      }
      return { status: response.statusCode, headers: response.headers, json }
    }

    const state = await call('GET', '/.dsh-opencode-acp/state')
    assert.equal(state.status, 200, 'GET /state must answer 200')
    assert.ok(state.json && typeof state.json.settings === 'object', 'GET /state must return settings')
    assert.equal(state.json.settings.model, 'opencode/deepseek-v4.1-flash-free')
    assert.ok(Array.isArray(state.json.runs), 'GET /state must return runs')
    assert.ok(Array.isArray(state.json.models), 'GET /state must return models')
    assert.equal(state.json.settings.command.includes('opencode'), true)

    const unknown = await call('GET', '/.dsh-opencode-acp/nope')
    assert.equal(unknown.status, 404)

    const badJson = await call('POST', '/.dsh-opencode-acp/settings', '{oops', {
      'content-type': 'application/json',
    })
    assert.ok(badJson.status >= 400, 'malformed JSON must be rejected')

    const saved = await call(
      'POST',
      '/.dsh-opencode-acp/settings',
      JSON.stringify({ model: 'opencode/step-5-preview-free' }),
      { 'content-type': 'application/json' },
    )
    assert.equal(saved.status, 200, 'a valid settings POST must answer 200')
    assert.equal(saved.json.settings.model, 'opencode/step-5-preview-free')

    const persisted = JSON.parse(fs.readFileSync(path.join(home, 'opencode-acp', 'settings.json'), 'utf8'))
    assert.equal(persisted.model, 'opencode/step-5-preview-free', 'settings must persist')

    for (const disposer of disposers) {
      if (typeof disposer === 'function') await disposer()
    }
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    fs.rmSync(home, { recursive: true, force: true })
  }
}

await testClient()
await testHost()
console.log('smoke: client and host contracts hold')
