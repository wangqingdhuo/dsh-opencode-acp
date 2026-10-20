window.__ModuleLoader__.load({
  id: 'dsh-opencode-acp',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback } = React

    const PREFIX = '/.dsh-opencode-acp'
    const MODULE_NAME = 'dsh-opencode-acp'

    /** Every page falls back to this when a theme token is missing. */
    const T = {
      base: 'var(--dsw-alias-bg-base)',
      layer1: 'var(--dsw-alias-bg-layer-1)',
      layer2: 'var(--dsw-alias-bg-layer-2)',
      border1: 'var(--dsw-alias-border-l1)',
      border2: 'var(--dsw-alias-border-l2)',
      text: 'var(--dsw-alias-label-primary)',
      dim: 'var(--dsw-alias-label-secondary)',
      brand: 'var(--dsw-alias-brand-primary)',
      ok: 'var(--dsw-alias-state-success-primary)',
      err: 'var(--dsw-alias-state-error-primary)',
      warn: 'var(--dsw-alias-state-warn-primary)',
      idle: 'var(--dsw-alias-state-idle-primary)',
    }

    const S = {
      page: { display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 2px 32px', color: T.text },
      card: {
        background: T.layer1,
        border: `1px solid ${T.border1}`,
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      },
      cardTitle: { fontSize: 13, fontWeight: 600, color: T.text, margin: 0 },
      hint: { fontSize: 12, color: T.dim, lineHeight: 1.5, margin: 0 },
      row: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
      label: { fontSize: 13, color: T.text, minWidth: 96 },
      input: {
        flex: 1,
        minWidth: 220,
        fontSize: 13,
        padding: '7px 10px',
        borderRadius: 8,
        border: `1px solid ${T.border2}`,
        background: T.base,
        color: T.text,
        fontFamily: 'inherit',
      },
      select: {
        flex: 1,
        minWidth: 220,
        fontSize: 13,
        padding: '7px 10px',
        borderRadius: 8,
        border: `1px solid ${T.border2}`,
        background: T.layer1,
        color: T.text,
        fontFamily: 'inherit',
      },
      button: {
        fontSize: 13,
        padding: '7px 14px',
        borderRadius: 8,
        border: `1px solid ${T.border2}`,
        background: T.layer2,
        color: T.text,
        cursor: 'pointer',
        fontFamily: 'inherit',
      },
      primary: {
        fontSize: 13,
        padding: '7px 16px',
        borderRadius: 8,
        border: `1px solid ${T.brand}`,
        background: T.brand,
        color: '#fff',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontWeight: 600,
      },
      table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
      th: {
        textAlign: 'left',
        fontWeight: 600,
        color: T.dim,
        padding: '6px 8px',
        borderBottom: `1px solid ${T.border1}`,
        whiteSpace: 'nowrap',
      },
      td: { padding: '6px 8px', borderBottom: `1px solid ${T.border1}`, verticalAlign: 'top' },
      mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5 },
    }

    async function call(path, init) {
      const response = await fetch(path, {
        ...init,
        headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      })
      const text = await response.text()
      let body = null
      try {
        body = text === '' ? null : JSON.parse(text)
      } catch {
        body = null
      }
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
      return body
    }

    function stamp(ms) {
      if (!Number.isFinite(ms)) return '—'
      const date = new Date(ms)
      const pad = (n) => String(n).padStart(2, '0')
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    }

    function duration(ms) {
      if (!Number.isFinite(ms)) return '—'
      if (ms < 1000) return `${ms}ms`
      const seconds = ms / 1000
      if (seconds < 60) return `${seconds.toFixed(1)}s`
      return `${Math.floor(seconds / 60)}m${String(Math.round(seconds % 60)).padStart(2, '0')}s`
    }

    function statusColor(status) {
      if (status === 'completed') return T.ok
      if (status === 'running') return T.brand
      if (status === 'aborted') return T.idle
      return T.err
    }

    function statusText(status) {
      switch (status) {
        case 'completed':
          return '完成'
        case 'running':
          return '运行中'
        case 'aborted':
          return '已取消'
        case 'error':
          return '失败'
        case 'max-tokens':
          return '超长截断'
        case 'refusal':
          return '拒绝'
        default:
          return status ?? '—'
      }
    }

    function tokensText(tokens) {
      if (!tokens) return '—'
      const parts = [`↑${tokens.input ?? 0}`, `↓${tokens.output ?? 0}`]
      if (tokens.cacheRead) parts.push(`cache ${tokens.cacheRead}`)
      return parts.join(' · ')
    }

    function Field({ label, children }) {
      return h('div', { style: S.row }, h('div', { style: S.label }, label), children)
    }

    function Section({ title, hint, children, extra }) {
      return h(
        'section',
        { style: S.card },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          h('h3', { style: S.cardTitle }, title),
          extra ? h('div', { style: { marginLeft: 'auto', display: 'flex', gap: 8 } }, extra) : null,
        ),
        hint ? h('p', { style: S.hint }, hint) : null,
        children,
      )
    }

    function OpencodeSettings() {
      const [data, setData] = useState(null)
      const [draft, setDraft] = useState(null)
      const [envText, setEnvText] = useState('{}')
      const [note, setNote] = useState('')
      const [error, setError] = useState('')
      const [busy, setBusy] = useState('')
      const [health, setHealth] = useState(null)
      const [openRun, setOpenRun] = useState(null)

      const load = useCallback(async () => {
        setError('')
        try {
          const state = await call(`${PREFIX}/state`)
          setData(state)
          setDraft(state.settings)
          setEnvText(JSON.stringify(state.settings.env ?? {}, null, 2))
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      }, [])

      useEffect(() => {
        void load()
      }, [load])

      const update = (patch) => setDraft((current) => ({ ...current, ...patch }))

      const save = async () => {
        setBusy('save')
        setNote('')
        setError('')
        try {
          let env = {}
          const trimmed = envText.trim()
          if (trimmed !== '') {
            const parsed = JSON.parse(trimmed)
            if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
              throw new Error('环境变量必须是 JSON 对象')
            }
            env = parsed
          }
          const payload = {
            ...draft,
            args: String(draft.argsText ?? draft.args.join(' '))
              .split(/\s+/)
              .filter(Boolean),
            env,
          }
          delete payload.argsText
          const body = await call(`${PREFIX}/settings`, { method: 'POST', body: JSON.stringify(payload) })
          setDraft(body.settings)
          setNote('已保存，下一次委派即生效')
          void load()
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setBusy('')
        }
      }

      const runHealth = async () => {
        setBusy('health')
        setError('')
        try {
          const result = await call(`${PREFIX}/health`, { method: 'POST', body: '{}' })
          setHealth(result)
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setBusy('')
        }
      }

      const clearRuns = async () => {
        setBusy('clear')
        try {
          await call(`${PREFIX}/runs/clear`, { method: 'POST', body: '{}' })
          await load()
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setBusy('')
        }
      }

      if (draft === null) {
        return h(
          'div',
          { style: S.page },
          h('p', { style: S.hint }, error === '' ? '正在读取 OpenCode 设置…' : `读取失败：${error}`),
        )
      }

      const models = Array.isArray(data?.models) ? data.models : []
      const known = models.includes(draft.model)
      const runs = Array.isArray(data?.runs) ? data.runs : []

      return h(
        'div',
        { style: S.page },
        h(
          'div',
          null,
          h('h2', { style: { fontSize: 16, fontWeight: 600, margin: '0 0 4px' } }, 'OpenCode 委派'),
          h(
            'p',
            { style: S.hint },
            '每次委派在独立进程里启动 ', h('code', { style: S.mono }, 'opencode acp'),
            '，用你自己的 opencode 登录与免费模型干活。设置保存在 ',
            h('code', { style: S.mono }, data?.home ?? ''),
            '/opencode-acp。',
          ),
        ),

        error !== '' ? h('p', { style: { ...S.hint, color: T.err } }, `出错了：${error}`) : null,

        h(
          Section,
          {
            title: '模型',
            hint: 'opencode 侧的模型选择：ACP 协议不带模型参数，所以在这里改，并通过 OPENCODE_CONFIG_CONTENT 注入子进程。',
            extra: h(
              'button',
              { style: S.button, onClick: runHealth, disabled: busy !== '' },
              busy === 'health' ? '检查中…' : '健康检查',
            ),
          },
          health !== null
            ? h(
                'p',
                { style: { ...S.hint, color: health.ok ? T.ok : T.err } },
                health.ok
                  ? `opencode 可用：${health.version || '版本未知'}`
                  : 'opencode 不可用：请检查下面的命令路径',
              )
            : null,
          h(
            Field,
            { label: '主模型' },
            h(
              'select',
              {
                style: S.select,
                value: known ? draft.model : '__custom',
                onChange: (event) => {
                  const value = event.target.value
                  if (value === '__custom') update({ model: '' })
                  else update({ model: value })
                },
              },
              models.map((id) => h('option', { key: id, value: id }, id)),
              h('option', { value: '__custom' }, '自定义 / 手填…'),
            ),
          ),
          known
            ? null
            : h(
                Field,
                { label: '模型 id' },
                h('input', {
                  style: S.input,
                  value: draft.model,
                  placeholder: 'provider/model，例如 opencode/deepseek-v4.1-flash-free',
                  onChange: (event) => update({ model: event.target.value }),
                }),
              ),
          h(
            Field,
            { label: '小模型' },
            h('input', {
              style: S.input,
              value: draft.smallModel ?? '',
              placeholder: '留空则让 opencode 自己挑（标题、小任务用）',
              onChange: (event) => update({ smallModel: event.target.value }),
            }),
          ),
        ),

        h(
          Section,
          { title: '执行方式' },
          h(
            Field,
            { label: '权限应答' },
            h(
              'select',
              {
                style: S.select,
                value: draft.permission,
                onChange: (event) => update({ permission: event.target.value }),
              },
              h('option', { value: 'allow' }, 'allow — 自动放行（能干真活）'),
              h('option', { value: 'reject' }, 'reject — 一律拒绝（只读试探）'),
            ),
          ),
          h(
            Field,
            { label: '工作目录' },
            h(
              'select',
              {
                style: S.select,
                value: draft.cwdMode,
                onChange: (event) => update({ cwdMode: event.target.value }),
              },
              h('option', { value: 'inherit' }, '跟随调用方会话的目录'),
              h('option', { value: 'fixed' }, '固定目录'),
            ),
          ),
          draft.cwdMode === 'fixed'
            ? h(
                Field,
                { label: '固定路径' },
                h('input', {
                  style: S.input,
                  value: draft.cwdFixed ?? '',
                  placeholder: 'D:\\项目\\某个仓库',
                  onChange: (event) => update({ cwdFixed: event.target.value }),
                }),
              )
            : null,
        ),

        h(
          'details',
          { style: { ...S.card, gap: 10 } },
          h('summary', { style: { ...S.cardTitle, cursor: 'pointer' } }, '高级'),
          h(
            Field,
            { label: '启动命令' },
            h('input', {
              style: { ...S.input, ...S.mono },
              value: draft.command,
              onChange: (event) => update({ command: event.target.value }),
            }),
          ),
          h(
            Field,
            { label: '参数' },
            h('input', {
              style: { ...S.input, ...S.mono },
              value: draft.argsText ?? draft.args.join(' '),
              onChange: (event) => update({ argsText: event.target.value }),
            }),
          ),
          h(
            Field,
            { label: '收尾宽限' },
            h('input', {
              style: { ...S.input, maxWidth: 140 },
              type: 'number',
              min: 500,
              max: 120000,
              step: 500,
              value: draft.graceMs,
              onChange: (event) => update({ graceMs: Number(event.target.value) }),
            }),
            h('span', { style: S.hint }, '毫秒'),
          ),
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            h('div', { style: S.label }, '额外环境变量（JSON 对象）'),
            h('textarea', {
              style: { ...S.input, ...S.mono, minHeight: 72, resize: 'vertical' },
              value: envText,
              onChange: (event) => setEnvText(event.target.value),
            }),
          ),
        ),

        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 12 } },
          h(
            'button',
            { style: S.primary, onClick: save, disabled: busy !== '' },
            busy === 'save' ? '保存中…' : '保存设置',
          ),
          note !== '' ? h('span', { style: { ...S.hint, color: T.ok } }, note) : null,
        ),

        h(
          Section,
          {
            title: `运行记录${runs.length === 0 ? '' : `（最近 ${runs.length} 次）`}`,
            hint: '每次委派一行；“会话”是 opencode 里那条会话的 id，可以直接在 opencode 里找。',
            extra: h(
              'button',
              { style: S.button, onClick: clearRuns, disabled: busy !== '' || runs.length === 0 },
              '清空',
            ),
          },
          runs.length === 0
            ? h('p', { style: S.hint }, '还没有记录。让 DSH 用 subagent_opencode 委派一次试试。')
            : h(
                'table',
                { style: S.table },
                h(
                  'thead',
                  null,
                  h(
                    'tr',
                    null,
                    ['时间', '状态', '模型', '目录', '耗时', 'token', '会话'].map((label) =>
                      h('th', { key: label, style: S.th }, label),
                    ),
                  ),
                ),
                h(
                  'tbody',
                  null,
                  runs.slice(0, 30).map((run) =>
                    h(
                      React.Fragment,
                      { key: run.id },
                      h(
                        'tr',
                        {
                          style: { cursor: 'pointer' },
                          onClick: () => setOpenRun(openRun === run.id ? null : run.id),
                        },
                        h('td', { style: S.td }, stamp(run.at)),
                        h('td', { style: { ...S.td, color: statusColor(run.status) } }, statusText(run.status)),
                        h('td', { style: { ...S.td, ...S.mono } }, run.model || '—'),
                        h(
                          'td',
                          { style: { ...S.td, ...S.mono }, title: run.cwd },
                          String(run.cwd ?? '').split(/[\\/]/).filter(Boolean).pop() || '—',
                        ),
                        h('td', { style: S.td }, duration(run.ms)),
                        h('td', { style: { ...S.td, ...S.mono } }, tokensText(run.tokens)),
                        h(
                          'td',
                          { style: { ...S.td, ...S.mono, color: T.dim } },
                          run.sessionId === null || run.sessionId === undefined
                            ? '—'
                            : String(run.sessionId).slice(0, 18),
                        ),
                      ),
                      openRun === run.id
                        ? h(
                            'tr',
                            null,
                            h(
                              'td',
                              { style: { ...S.td, background: T.layer2 }, colSpan: 7 },
                              h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
                                h('div', { style: S.mono }, `cwd: ${run.cwd}`),
                                h('div', { style: S.mono }, `session: ${run.sessionId ?? '—'}`),
                                h('div', { style: S.mono }, `工具调用: ${run.toolCalls ?? 0}`),
                                h('div', { style: S.mono }, `任务: ${run.promptPreview ?? ''}`),
                                run.diagnostic
                                  ? h('div', { style: { ...S.mono, color: T.err } }, run.diagnostic)
                                  : null,
                              ),
                            ),
                          )
                        : null,
                    ),
                  ),
                ),
              ),
        ),
      )
    }

    const inject = ['slots']

    function apply(ctx) {
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'opencode',
            order: 42,
            label: () => 'OpenCode 委派',
            inject: () => ({}),
          },
          OpencodeSettings,
        ),
      )
    }

    return { name: MODULE_NAME, inject, apply }
  },
})
