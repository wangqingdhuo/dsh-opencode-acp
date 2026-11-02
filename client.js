window.__ModuleLoader__.load({
  id: 'dsh-opencode-acp',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useRef } = React

    const PREFIX = '/.dsh-opencode-acp'
    const MODULE_NAME = 'dsh-opencode-acp'
    const GRACE_MIN = 500
    const GRACE_MAX = 120000
    const DEFAULT_GRACE = 6000
    const RUNS_PAGE = 30

    /**
     * Theme token aliases. Every colour is a token (no literal colours), so the
     * page follows the light/dark theme. `onBrand` is the token that inverts
     * against `brand`: white in light mode, near-black in dark mode.
     */
    const T = {
      base: 'var(--dsw-alias-bg-base)',
      layer1: 'var(--dsw-alias-bg-layer-1)',
      layer2: 'var(--dsw-alias-bg-layer-2)',
      border1: 'var(--dsw-alias-border-l1)',
      border2: 'var(--dsw-alias-border-l2)',
      text: 'var(--dsw-alias-label-primary)',
      dim: 'var(--dsw-alias-label-secondary)',
      brand: 'var(--dsw-alias-brand-primary)',
      onBrand: 'var(--dsw-alias-bg-base)',
      ok: 'var(--dsw-alias-state-success-primary)',
      err: 'var(--dsw-alias-state-error-primary)',
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
      subHint: { fontSize: 11.5, color: T.dim, lineHeight: 1.5, margin: 0 },
      field: { display: 'flex', flexDirection: 'column', gap: 4 },
      fieldRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
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
        /* Inverts with the theme; never hardcode #fff (white-on-white in dark). */
        color: T.onBrand,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontWeight: 600,
      },
      danger: {
        fontSize: 13,
        padding: '7px 14px',
        borderRadius: 8,
        border: `1px solid ${T.err}`,
        background: 'transparent',
        color: T.err,
        cursor: 'pointer',
        fontFamily: 'inherit',
      },
      ghost: {
        fontSize: 12,
        padding: 0,
        border: 'none',
        background: 'transparent',
        color: T.text,
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
      },
      disabled: { opacity: 0.55, cursor: 'not-allowed' },
      tableWrap: { width: '100%', maxWidth: '100%', overflowX: 'auto' },
      table: { width: '100%', minWidth: 856, borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' },
      th: {
        textAlign: 'left',
        fontWeight: 600,
        color: T.dim,
        padding: '6px 8px',
        borderBottom: `1px solid ${T.border1}`,
        whiteSpace: 'nowrap',
      },
      td: { padding: '6px 8px', borderBottom: `1px solid ${T.border1}`, verticalAlign: 'top' },
      cell: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
      statusCell: { display: 'flex', alignItems: 'center', gap: 6 },
      dot: { width: 6, height: 6, borderRadius: 3, flex: 'none', display: 'inline-block' },
      detail: { padding: '8px 10px', borderBottom: `1px solid ${T.border1}`, background: T.layer2, whiteSpace: 'normal' },
      detailLine: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, lineHeight: 1.6, overflowWrap: 'anywhere' },
      actions: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
      mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5 },
      errorLine: { fontSize: 12, color: T.err, lineHeight: 1.5, margin: 0 },
    }

    /* ── copy ─────────────────────────────────────────────────────────────── */

    /**
     * Two string tables, picked from the browser language inside this file.
     * The plugin registers no locale namespace, so this is the whole i18n; an
     * English DSH install gets an English page, zh* installs keep the Chinese
     * copy.
     */
    const STRINGS = {
      zh: {
        nav: 'OpenCode 委派',
        title: 'OpenCode 委派',
        introLead: '每次委派在独立进程里启动 ',
        introTail: '，用你自己的 opencode 登录与免费模型干活。设置保存在 ',
        introEnd: '。',
        loading: '正在读取 OpenCode 设置…',
        retry: '重试',
        retrying: '重试中…',
        loadError404Title: '设置接口未就绪（HTTP 404）',
        loadError404Detail: '宿主没有注册 /.dsh-opencode-acp 路由：插件热更新后刷新页面通常能恢复；如果一直失败，检查宿主插件是否已启用。',
        loadErrorHttpTitle: '宿主返回 HTTP {status}',
        loadErrorNetworkTitle: '无法连接 DSH 宿主',
        loadErrorNetworkDetail: '请确认 DSH Web 仍在运行，然后重试。',
        loadErrorMalformedTitle: '宿主返回的数据无法识别',
        loadErrorMalformedDetail: '页面需要 settings、models、runs 三个字段；可能是插件与宿主版本不一致，刷新页面或升级插件后重试。',
        loadErrorUnknownTitle: '读取设置失败',
        errorPrefix: '出错了：',
        colon: '：',
        modelSection: '模型',
        modelHint: 'opencode 侧的模型选择：ACP 协议不带模型参数，所以在这里改，并通过 OPENCODE_CONFIG_CONTENT 注入子进程。免费额度按账号走，哪个模型此刻能用要用「测试模型」当场问。',
        testModel: '测试模型',
        testingModel: '测试中…',
        healthCheck: '健康检查',
        checkingHealth: '检查中…',
        probeUsesSaved: '「测试模型」和「健康检查」都使用已保存的启动命令与环境变量，并且每次测试会消耗一次真实请求。',
        probeOk: '模型可用：{model}（{ms}ms）',
        probeFail: '模型不可用：{model}',
        reasonUnknown: '未知原因',
        healthOk: 'opencode 可用：{version}',
        healthVersionUnknown: '版本未知',
        healthFail: 'opencode 不可用：检查「高级」里的启动命令（这里用的是已保存的命令）',
        mainModel: '主模型',
        refreshModels: '刷新列表',
        refreshingModels: '刷新中…',
        catalogFresh: '模型目录更新于 {time}：opencode 现在能看到 {count} 个模型，其中 {free} 个免费。',
        catalogStale: '列表由「最近用过的模型 + 内置免费清单」组成。点「刷新列表」向 opencode 要一次最新目录。',
        catalogFail: '拉取模型目录失败：{detail}',
        customOption: '自定义 / 手填…',
        customModel: '模型 id',
        customModelPlaceholder: 'provider/model，例如 opencode/deepseek-v4.1-flash-free',
        smallModel: '小模型',
        smallModelPlaceholder: '留空则让 opencode 自己挑（标题、小任务用）',
        execution: '执行方式',
        permission: '权限应答',
        permissionAllow: 'allow — 自动放行（能干真活）',
        permissionReject: 'reject — 一律拒绝（只读试探）',
        cwd: '工作目录',
        cwdInherit: '跟随调用方会话的目录',
        cwdFixedMode: '固定目录',
        cwdFixed: '固定路径',
        cwdFixedPlaceholder: 'D:\\项目\\某个仓库',
        advanced: '高级',
        command: '启动命令',
        args: '参数',
        grace: '收尾宽限',
        graceHint: '毫秒，范围 {min}–{max}',
        graceInvalid: '需要 {min}–{max} 之间的整数毫秒',
        env: '额外环境变量（JSON 对象）',
        envNotObject: '环境变量必须是 JSON 对象',
        envValueNotString: '环境变量 {key} 的值必须是字符串',
        envInvalidJson: '环境变量不是合法 JSON',
        save: '保存设置',
        saving: '保存中…',
        saved: '已保存，下一次委派即生效',
        savedRefreshFailed: '已保存，但刷新运行记录失败；稍后点「刷新」再试',
        revert: '还原',
        unsaved: '有未保存的修改',
        fixFields: '请先修正下面标出的字段',
        runs: '运行记录',
        runCount: '（共 {count} 条）',
        runsHint: '每次委派一行；“会话”是 opencode 里那条会话的 id，可以直接在 opencode 里找。',
        updatedAt: '更新于 {time}',
        clear: '清空',
        clearConfirm: '清空全部记录？',
        clearConfirmYes: '确认清空（{count} 条）',
        cancel: '取消',
        cleared: '运行记录已清空',
        refresh: '刷新',
        refreshing: '刷新中…',
        emptyRuns: '还没有记录。让 DSH 用 subagent_opencode 委派一次试试。',
        colTime: '时间',
        colStatus: '状态',
        colModel: '模型',
        colCwd: '目录',
        colDuration: '耗时',
        colTokens: 'token',
        colSession: '会话',
        showAll: '显示全部（{count}）',
        showLess: '收起',
        statusCompleted: '完成',
        statusRunning: '运行中',
        statusAborted: '已取消',
        statusError: '失败',
        statusMaxTokens: '超长截断',
        statusRefusal: '拒绝',
        expandRun: '展开这次运行',
        collapseRun: '收起这次运行',
        detailCwd: 'cwd: {value}',
        detailSession: 'session: {value}',
        detailToolCalls: '工具调用: {value}',
        detailPrompt: '任务: {value}',
        detailErrorName: '错误类型: {value}',
        detailDiagnostic: '诊断: {value}',
        httpError: 'HTTP 错误',
        actionError404: '接口不存在（HTTP 404），宿主路由可能还没挂载；刷新页面后再试。',
        actionErrorNetwork: '网络错误，无法连接 DSH 宿主。',
        actionErrorMalformed: '宿主返回的数据无法识别。',
        actionErrorRefresh: '刷新失败，暂时没有读到最新状态。',
        homeUnknown: '<DSH_HOME>',
      },
      en: {
        nav: 'OpenCode Delegation',
        title: 'OpenCode Delegation',
        introLead: 'Every delegation starts ',
        introTail: ' in its own process and works with your own opencode login and free models. Settings live in ',
        introEnd: '.',
        loading: 'Loading OpenCode settings…',
        retry: 'Retry',
        retrying: 'Retrying…',
        loadError404Title: 'Settings API not available (HTTP 404)',
        loadError404Detail: 'The host has not registered the /.dsh-opencode-acp routes. Reloading the page usually fixes it after a plugin update; if it keeps failing, check that the host plugin is enabled.',
        loadErrorHttpTitle: 'The host returned HTTP {status}',
        loadErrorNetworkTitle: 'Cannot reach the DSH host',
        loadErrorNetworkDetail: 'Check that DSH Web is still running, then retry.',
        loadErrorMalformedTitle: 'The host returned an unexpected payload',
        loadErrorMalformedDetail: 'This page needs the settings, models and runs fields. The plugin and host versions may not match; reload or upgrade, then retry.',
        loadErrorUnknownTitle: 'Could not load settings',
        errorPrefix: 'Error: ',
        colon: ': ',
        modelSection: 'Model',
        refreshModels: 'Refresh list',
        refreshingModels: 'Refreshing…',
        catalogFresh: 'Model catalog updated at {time}: opencode currently sees {count} models, {free} of them free.',
        catalogStale: 'The list is "models you have used + a built-in free list". Use "Refresh list" to ask opencode for its current catalog.',
        catalogFail: 'Could not refresh the model catalog: {detail}',
        modelHint: 'Model choice on the opencode side: ACP carries no model parameter, so it is set here and injected through OPENCODE_CONFIG_CONTENT. Free quota is per account, so use "Test model" to check availability right now.',
        testModel: 'Test model',
        testingModel: 'Testing…',
        healthCheck: 'Health check',
        checkingHealth: 'Checking…',
        probeUsesSaved: '"Test model" and "Health check" both use the saved command and environment variables, and each test spends one real request.',
        probeOk: 'Model works: {model} ({ms}ms)',
        probeFail: 'Model unavailable: {model}',
        reasonUnknown: 'unknown reason',
        healthOk: 'opencode works: {version}',
        healthVersionUnknown: 'version unknown',
        healthFail: 'opencode is not available: check the command under Advanced (the saved command is used here)',
        mainModel: 'Main model',
        customOption: 'Custom / type an id…',
        customModel: 'Model id',
        customModelPlaceholder: 'provider/model, e.g. opencode/deepseek-v4.1-flash-free',
        smallModel: 'Small model',
        smallModelPlaceholder: 'Blank lets opencode choose (titles, small jobs)',
        execution: 'Execution',
        permission: 'Permission policy',
        permissionAllow: 'allow — auto-approve (can do real work)',
        permissionReject: 'reject — deny everything (read-only probing)',
        cwd: 'Working directory',
        cwdInherit: "Follow the calling session's directory",
        cwdFixedMode: 'Fixed directory',
        cwdFixed: 'Fixed path',
        cwdFixedPlaceholder: 'C:\\projects\\some-repo',
        advanced: 'Advanced',
        command: 'Command',
        args: 'Arguments',
        grace: 'Teardown grace',
        graceHint: 'milliseconds, {min}–{max}',
        graceInvalid: 'Needs an integer between {min} and {max} milliseconds',
        env: 'Extra environment variables (JSON object)',
        envNotObject: 'Environment variables must be a JSON object',
        envValueNotString: 'The value of {key} must be a string',
        envInvalidJson: 'Environment variables are not valid JSON',
        save: 'Save settings',
        saving: 'Saving…',
        saved: 'Saved; applies to the next delegation',
        savedRefreshFailed: 'Saved, but refreshing run history failed; press Refresh later',
        revert: 'Revert',
        unsaved: 'Unsaved changes',
        fixFields: 'Fix the highlighted fields first',
        runs: 'Run history',
        runCount: '({count} total)',
        runsHint: 'One row per delegation; "session" is the opencode session id you can look up in opencode.',
        updatedAt: 'Updated {time}',
        clear: 'Clear',
        clearConfirm: 'Clear all runs?',
        clearConfirmYes: 'Clear all ({count})',
        cancel: 'Cancel',
        cleared: 'Run history cleared',
        refresh: 'Refresh',
        refreshing: 'Refreshing…',
        emptyRuns: 'No runs yet. Ask DSH to delegate once with subagent_opencode.',
        colTime: 'Time',
        colStatus: 'Status',
        colModel: 'Model',
        colCwd: 'Directory',
        colDuration: 'Duration',
        colTokens: 'Tokens',
        colSession: 'Session',
        showAll: 'Show all ({count})',
        showLess: 'Show less',
        statusCompleted: 'done',
        statusRunning: 'running',
        statusAborted: 'cancelled',
        statusError: 'failed',
        statusMaxTokens: 'max tokens',
        statusRefusal: 'refused',
        expandRun: 'Expand this run',
        collapseRun: 'Collapse this run',
        detailCwd: 'cwd: {value}',
        detailSession: 'session: {value}',
        detailToolCalls: 'tool calls: {value}',
        detailPrompt: 'task: {value}',
        detailErrorName: 'error kind: {value}',
        detailDiagnostic: 'diagnostic: {value}',
        httpError: 'HTTP error',
        actionError404: 'Endpoint missing (HTTP 404); the host routes may not be mounted. Reload and try again.',
        actionErrorNetwork: 'Network error: cannot reach the DSH host.',
        actionErrorMalformed: 'The host returned an unexpected payload.',
        actionErrorRefresh: 'Refresh failed; the latest state could not be loaded.',
        homeUnknown: '<DSH_HOME>',
      },
    }

    function detectLocale() {
      try {
        const raw = typeof navigator !== 'undefined' && typeof navigator.language === 'string' ? navigator.language : ''
        return /^zh/i.test(raw) ? 'zh' : 'en'
      } catch {
        return 'en'
      }
    }

    const LOCALE = detectLocale()

    function format(template, params) {
      if (!params) return template
      let text = template
      for (const key of Object.keys(params)) text = text.split(`{${key}}`).join(String(params[key]))
      return text
    }

    function t(key, params) {
      const table = STRINGS[LOCALE] ?? STRINGS.en
      const template = table[key] ?? STRINGS.en[key] ?? key
      return format(template, params)
    }

    /* ── transport ────────────────────────────────────────────────────────── */

    /** One error type for every failure the page distinguishes in its copy. */
    function apiError(kind, message, status) {
      const error = new Error(message)
      error.name = 'ApiError'
      error.kind = kind
      if (status !== undefined) error.status = status
      return error
    }

    async function call(path, init) {
      const options = init ?? {}
      let response
      try {
        response = await fetch(path, {
          ...options,
          headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
        })
      } catch (cause) {
        if (cause && cause.name === 'AbortError') throw apiError('aborted', 'request aborted')
        throw apiError('network', cause instanceof Error ? cause.message : String(cause))
      }
      let text = ''
      try {
        text = await response.text()
      } catch {
        text = ''
      }
      let body = null
      let parsed = true
      if (text.trim() !== '') {
        try {
          body = JSON.parse(text)
        } catch {
          parsed = false
        }
      }
      if (!response.ok) {
        const message =
          body && typeof body === 'object' && typeof body.error === 'string' && body.error !== ''
            ? body.error
            : `HTTP ${response.status}`
        throw apiError('http', message, response.status)
      }
      if (!parsed) throw apiError('malformed', 'response body is not JSON')
      return body
    }

    /* ── payload normalisation (never let a partial response crash render) ── */

    function normalizeSettings(raw) {
      const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
      const text = (value, fallback) => (typeof value === 'string' ? value : fallback)
      const args = Array.isArray(source.args) ? source.args.filter((item) => typeof item === 'string') : ['acp']
      const env = {}
      if (source.env && typeof source.env === 'object' && !Array.isArray(source.env)) {
        for (const [key, value] of Object.entries(source.env)) {
          if (typeof key === 'string' && key !== '' && typeof value === 'string') env[key] = value
        }
      }
      const grace = Number(source.graceMs)
      return {
        model: text(source.model, ''),
        smallModel: text(source.smallModel, ''),
        permission: source.permission === 'reject' ? 'reject' : 'allow',
        cwdMode: source.cwdMode === 'fixed' ? 'fixed' : 'inherit',
        cwdFixed: text(source.cwdFixed, ''),
        command: text(source.command, ''),
        args,
        env,
        graceMs:
          Number.isFinite(grace) && grace >= GRACE_MIN && grace <= GRACE_MAX ? Math.round(grace) : DEFAULT_GRACE,
      }
    }

    function normalizeState(raw) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false }
      if (!raw.settings || typeof raw.settings !== 'object' || Array.isArray(raw.settings)) return { ok: false }
      return {
        ok: true,
        value: {
          settings: normalizeSettings(raw.settings),
          models: Array.isArray(raw.models)
            ? raw.models.filter((item) => typeof item === 'string' && item !== '')
            : [],
          runs: Array.isArray(raw.runs) ? raw.runs.filter((item) => item && typeof item === 'object') : [],
          home: typeof raw.home === 'string' ? raw.home : '',
          catalog: normalizeCatalog(raw.catalog),
        },
      }
    }

    /** A cached catalog is informational only; a malformed one is simply ignored. */
    function normalizeCatalog(raw) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
      const free = Array.isArray(raw.free)
        ? raw.free.filter((item) => typeof item === 'string' && item !== '')
        : []
      const at = Number(raw.at)
      const count = Number(raw.count)
      return {
        at: Number.isFinite(at) ? at : 0,
        count: Number.isFinite(count) && count >= 0 ? Math.round(count) : free.length,
        free,
      }
    }

    function toPayload(draft, envText) {
      const fieldErrors = {}
      const args = String(draft.argsText ?? '')
        .split(/\s+/)
        .filter(Boolean)
      let env = {}
      const trimmed = String(envText ?? '').trim()
      if (trimmed !== '') {
        let parsed
        let parsedOk = true
        try {
          parsed = JSON.parse(trimmed)
        } catch {
          parsedOk = false
          fieldErrors.env = t('envInvalidJson')
        }
        if (parsedOk) {
          if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            fieldErrors.env = t('envNotObject')
          } else {
            for (const [key, value] of Object.entries(parsed)) {
              if (typeof value !== 'string') {
                fieldErrors.env = t('envValueNotString', { key })
                break
              }
              env[key] = value
            }
          }
        }
        if (fieldErrors.env !== undefined) env = {}
      }
      const graceText = String(draft.graceMsText ?? '').trim()
      const grace = Number(graceText)
      if (
        graceText === '' ||
        !/^\d+$/.test(graceText) ||
        !Number.isFinite(grace) ||
        grace < GRACE_MIN ||
        grace > GRACE_MAX
      ) {
        fieldErrors.graceMs = t('graceInvalid', { min: GRACE_MIN, max: GRACE_MAX })
      }
      if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors }
      return {
        ok: true,
        payload: {
          model: String(draft.model ?? ''),
          smallModel: String(draft.smallModel ?? ''),
          permission: draft.permission === 'reject' ? 'reject' : 'allow',
          cwdMode: draft.cwdMode === 'fixed' ? 'fixed' : 'inherit',
          cwdFixed: String(draft.cwdFixed ?? ''),
          command: String(draft.command ?? ''),
          args,
          env,
          graceMs: grace,
        },
      }
    }

    /* ── formatting helpers ───────────────────────────────────────────────── */

    function stamp(ms) {
      if (!Number.isFinite(ms)) return '—'
      const date = new Date(ms)
      const pad = (value) => String(value).padStart(2, '0')
      const day = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
      return date.getFullYear() === new Date().getFullYear()
        ? `${day} ${time}`
        : `${date.getFullYear()}-${day} ${time}`
    }

    /** HH:mm, for "catalog updated at" lines. */
    function clock(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return '—'
      const date = new Date(ms)
      const pad = (value) => String(value).padStart(2, '0')
      return `${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    function duration(ms) {      if (!Number.isFinite(ms)) return '—'
      if (ms < 1000) return `${ms}ms`
      const seconds = ms / 1000
      if (seconds < 60) return `${seconds.toFixed(1)}s`
      let minutes = Math.floor(seconds / 60)
      let rest = Math.round(seconds - minutes * 60)
      if (rest === 60) {
        minutes += 1
        rest = 0
      }
      return `${minutes}m${String(rest).padStart(2, '0')}s`
    }

    function statusText(status) {
      switch (status) {
        case 'completed':
          return t('statusCompleted')
        case 'running':
          return t('statusRunning')
        case 'aborted':
          return t('statusAborted')
        case 'error':
          return t('statusError')
        case 'max-tokens':
          return t('statusMaxTokens')
        case 'refusal':
          return t('statusRefusal')
        default:
          return typeof status === 'string' && status !== '' ? status : '—'
      }
    }

    /** Semantic dot colour plus a text colour that passes contrast in both themes. */
    function statusTone(status) {
      if (status === 'completed') return { dot: T.ok, text: T.text }
      if (status === 'running') return { dot: T.brand, text: T.text }
      if (status === 'aborted') return { dot: T.idle, text: T.dim }
      return { dot: T.err, text: T.err }
    }

    function asText(value, fallback) {
      return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback ?? '—'
    }

    function safeNumber(value) {
      return typeof value === 'number' && Number.isFinite(value) ? value : null
    }

    function tokensText(tokens) {
      if (!tokens || typeof tokens !== 'object') return '—'
      const input = safeNumber(tokens.input) ?? 0
      const output = safeNumber(tokens.output) ?? 0
      const cache = safeNumber(tokens.cacheRead) ?? 0
      const parts = [`↑${input}`, `↓${output}`]
      if (cache > 0) parts.push(`cache ${cache}`)
      return parts.join(' · ')
    }

    function opencodeHomePath(home) {
      const base = typeof home === 'string' ? home.trim() : ''
      if (base === '') return `${t('homeUnknown')}/opencode-acp`
      const separator = base.includes('\\') && !base.includes('/') ? '\\' : '/'
      return `${base.replace(/[\\/]+$/, '')}${separator}opencode-acp`
    }

    function withDisabled(style, disabled) {
      return disabled ? { ...style, ...S.disabled } : style
    }

    function describeLoadFailure(cause) {
      if (cause && cause.name === 'ApiError') {
        if (cause.kind === 'http' && cause.status === 404) {
          return { title: t('loadError404Title'), detail: t('loadError404Detail'), technical: cause.message }
        }
        if (cause.kind === 'http') {
          return { title: t('loadErrorHttpTitle', { status: cause.status }), detail: cause.message, technical: '' }
        }
        if (cause.kind === 'network') {
          return { title: t('loadErrorNetworkTitle'), detail: t('loadErrorNetworkDetail'), technical: cause.message }
        }
        if (cause.kind === 'malformed') {
          return { title: t('loadErrorMalformedTitle'), detail: t('loadErrorMalformedDetail'), technical: cause.message }
        }
      }
      return {
        title: t('loadErrorUnknownTitle'),
        detail: cause instanceof Error ? cause.message : String(cause),
        technical: '',
      }
    }

    function describeActionFailure(cause) {
      if (cause && cause.name === 'ApiError') {
        if (cause.kind === 'http' && cause.status === 404) return t('actionError404')
        if (cause.kind === 'network') return t('actionErrorNetwork')
        if (cause.kind === 'malformed') return t('actionErrorMalformed')
        if (cause.kind === 'http') return `${t('httpError')} ${cause.status}${t('colon')}${cause.message}`
      }
      return cause instanceof Error ? cause.message : String(cause)
    }

    /* ── small components ─────────────────────────────────────────────────── */

    function Field({ id, label, hint, error, children }) {
      return h(
        'div',
        { style: S.field },
        h('div', { style: S.fieldRow }, h('label', { style: S.label, htmlFor: id }, label), children),
        error ? h('div', { style: S.errorLine, role: 'alert' }, error) : null,
        hint ? h('div', { style: S.subHint }, hint) : null,
      )
    }

    function Section({ title, hint, children, extra }) {
      return h(
        'section',
        { style: S.card },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
          h('h3', { style: S.cardTitle }, title),
          extra ? h('div', { style: { marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' } }, extra) : null,
        ),
        hint ? h('p', { style: S.hint }, hint) : null,
        children,
      )
    }

    function ResultLine({ ok, children }) {
      return h(
        'p',
        {
          style: { ...S.hint, display: 'flex', alignItems: 'center', gap: 6 },
          role: 'status',
          'aria-live': 'polite',
        },
        h('span', { style: { ...S.dot, background: ok ? T.ok : T.err }, 'aria-hidden': 'true' }),
        h('span', { style: { color: ok ? T.text : T.err } }, children),
      )
    }

    function OpencodeSettings() {
      /* data from the host */
      const [data, setData] = useState({ models: [], runs: [], home: '' })
      const [lastLoadedAt, setLastLoadedAt] = useState(0)
      const [initialLoading, setInitialLoading] = useState(true)
      const [loadError, setLoadError] = useState(null)

      /* editable draft (settings shape + two text mirrors) */
      const [draft, setDraft] = useState(null)
      const [envText, setEnvText] = useState('{}')
      const [dirty, setDirtyState] = useState(false)

      /* feedback */
      const [note, setNote] = useState('')
      const [noteKind, setNoteKind] = useState('ok')
      const [error, setError] = useState('')
      const [fieldErrors, setFieldErrors] = useState({})
      const [busyOps, setBusyOps] = useState([])
      const [probe, setProbe] = useState(null)
      const [health, setHealth] = useState(null)
      const [catalogOverride, setCatalogOverride] = useState(null)

      /* history */
      const [openRun, setOpenRun] = useState(null)
      const [showAllRuns, setShowAllRuns] = useState(false)
      const [confirmClear, setConfirmClear] = useState(false)

      const draftRef = useRef(null)
      const dirtyRef = useRef(false)
      const editSeqRef = useRef(0)
      const savedSettingsRef = useRef(null)
      const loadSeqRef = useRef(0)
      const loadAbortRef = useRef(null)
      const modelInputRef = useRef(null)

      const begin = useCallback((op) => {
        setBusyOps((prev) => (prev.includes(op) ? prev : [...prev, op]))
      }, [])
      const end = useCallback((op) => {
        setBusyOps((prev) => prev.filter((item) => item !== op))
      }, [])

      const setDirty = useCallback((value) => {
        dirtyRef.current = value
        setDirtyState(value)
      }, [])

      const applySettings = useCallback(
        (settings) => {
          const next = { ...settings, argsText: settings.args.join(' '), graceMsText: String(settings.graceMs) }
          draftRef.current = next
          savedSettingsRef.current = settings
          setDraft(next)
          setEnvText(JSON.stringify(settings.env, null, 2))
          setFieldErrors({})
          setDirty(false)
        },
        [setDirty],
      )

      const load = useCallback(
        async (options) => {
          const sequence = (loadSeqRef.current += 1)
          const editAtStart = editSeqRef.current
          if (loadAbortRef.current !== null) {
            try {
              loadAbortRef.current.abort()
            } catch {
              /* the old request is already settled */
            }
          }
          const controller = typeof AbortController === 'function' ? new AbortController() : null
          loadAbortRef.current = controller
          const quiet = options !== undefined && options.quiet === true
          try {
            const state = await call(`${PREFIX}/state`, controller ? { signal: controller.signal } : undefined)
            if (sequence !== loadSeqRef.current) return false
            const normalized = normalizeState(state)
            if (!normalized.ok) throw apiError('malformed', 'state payload shape')
            setData(normalized.value)
            setLastLoadedAt(Date.now())
            setLoadError(null)
            setInitialLoading(false)
            /* Never overwrite a draft the user edited: before the request (dirty)
             * or while it was in flight (edit sequence changed). */
            if (!dirtyRef.current && editSeqRef.current === editAtStart) applySettings(normalized.value.settings)
            return true
          } catch (cause) {
            if (sequence !== loadSeqRef.current) return false
            if (cause && cause.name === 'ApiError' && cause.kind === 'aborted') return false
            setInitialLoading(false)
            if (draftRef.current === null) setLoadError(describeLoadFailure(cause))
            else if (!quiet) setError(describeActionFailure(cause))
            return false
          } finally {
            if (loadAbortRef.current === controller) loadAbortRef.current = null
          }
        },
        [applySettings],
      )

      useEffect(() => {
        void load()
      }, [load])

      /* Disposal: the settings section unmounts when another tab is opened;
       * a still-running state request must not keep the page alive. */
      useEffect(
        () => () => {
          if (loadAbortRef.current !== null) {
            try {
              loadAbortRef.current.abort()
            } catch {
              /* already settled */
            }
          }
        },
        [],
      )

      const update = (patch) => {
        const current = draftRef.current
        if (current === null) return
        const next = { ...current, ...patch }
        draftRef.current = next
        editSeqRef.current += 1
        setDraft(next)
        setDirty(true)
        if (Object.prototype.hasOwnProperty.call(patch, 'model')) setProbe(null)
        if (Object.prototype.hasOwnProperty.call(patch, 'graceMsText')) {
          setFieldErrors((prev) => (prev.graceMs === undefined ? prev : { ...prev, graceMs: undefined }))
        }
      }

      const changeEnvText = (value) => {
        setEnvText(value)
        editSeqRef.current += 1
        setDirty(true)
        setFieldErrors((prev) => (prev.env === undefined ? prev : { ...prev, env: undefined }))
      }

      const anyBusy = busyOps.length > 0
      const busy = (op) => busyOps.includes(op)

      const save = async () => {
        if (anyBusy || draftRef.current === null) return
        begin('save')
        setNote('')
        setError('')
        setFieldErrors({})
        const built = toPayload(draftRef.current, envText)
        if (!built.ok) {
          setFieldErrors(built.fieldErrors)
          setError(t('fixFields'))
          end('save')
          return
        }
        const editAtStart = editSeqRef.current
        try {
          const body = await call(`${PREFIX}/settings`, { method: 'POST', body: JSON.stringify(built.payload) })
          if (!body || typeof body !== 'object' || !body.settings || typeof body.settings !== 'object') {
            throw apiError('malformed', 'settings payload shape')
          }
          const normalized = normalizeSettings(body.settings)
          savedSettingsRef.current = normalized
          /* Keep edits the user made while the POST was in flight. */
          if (editSeqRef.current === editAtStart) applySettings(normalized)
          setProbe(null)
          setHealth(null)
          const refreshed = await load({ quiet: true })
          if (refreshed) {
            setNoteKind('ok')
            setNote(t('saved'))
          } else {
            setNoteKind('warn')
            setNote(t('savedRefreshFailed'))
          }
        } catch (cause) {
          setError(describeActionFailure(cause))
        } finally {
          end('save')
        }
      }

      const runHealth = async () => {
        if (anyBusy) return
        begin('health')
        setError('')
        try {
          const result = await call(`${PREFIX}/health`, { method: 'POST', body: '{}' })
          setHealth(result && typeof result === 'object' ? result : { ok: false })
        } catch (cause) {
          setError(describeActionFailure(cause))
        } finally {
          end('health')
        }
      }

      const runProbe = async () => {
        if (anyBusy || draftRef.current === null) return
        begin('probe')
        setError('')
        setProbe(null)
        try {
          const result = await call(`${PREFIX}/probe`, {
            method: 'POST',
            body: JSON.stringify({ model: draftRef.current.model }),
          })
          setProbe(result && typeof result === 'object' ? result : { ok: false, model: draftRef.current.model })
        } catch (cause) {
          setError(describeActionFailure(cause))
        } finally {
          end('probe')
        }
      }

      const refreshCatalog = async () => {
        if (anyBusy) return
        begin('catalog')
        setError('')
        try {
          const result = await call(`${PREFIX}/models/refresh`, { method: 'POST', body: '{}' })
          if (result && result.ok === true) {
            setCatalogOverride(normalizeCatalog(result))
            setNoteKind('ok')
            setNote(
              t('catalogFresh', {
                time: clock(result.at),
                count: String(result.count ?? 0),
                free: String(Array.isArray(result.free) ? result.free.length : 0),
              }),
            )
          } else {
            setError(
              t('catalogFail', {
                detail: asText(result && result.detail, t('reasonUnknown')),
              }),
            )
          }
        } catch (cause) {
          setError(t('catalogFail', { detail: describeActionFailure(cause) }))
        } finally {
          end('catalog')
        }
      }

      const refresh = async () => {        if (anyBusy) return
        begin('refresh')
        setNote('')
        setError('')
        try {
          const ok = await load({ quiet: true })
          if (!ok) setError(t('actionErrorRefresh'))
        } finally {
          end('refresh')
        }
      }

      const clearRuns = async () => {
        if (anyBusy) return
        begin('clear')
        setConfirmClear(false)
        setNote('')
        setError('')
        try {
          await call(`${PREFIX}/runs/clear`, { method: 'POST', body: '{}' })
          setOpenRun(null)
          setShowAllRuns(false)
          const ok = await load({ quiet: true })
          if (ok) {
            setNoteKind('ok')
            setNote(t('cleared'))
          } else {
            setError(t('actionErrorRefresh'))
          }
        } catch (cause) {
          setError(describeActionFailure(cause))
        } finally {
          end('clear')
        }
      }

      const revert = () => {
        if (savedSettingsRef.current !== null) applySettings(savedSettingsRef.current)
        setNote('')
        setError('')
        setFieldErrors({})
      }

      const retryLoad = async () => {
        if (anyBusy) return
        begin('load')
        setInitialLoading(true)
        setLoadError(null)
        try {
          await load()
        } finally {
          end('load')
        }
      }

      /* ── initial states ─────────────────────────────────────────────────── */

      if (draft === null) {
        if (initialLoading) {
          return h(
            'div',
            { style: S.page },
            h('p', { style: S.hint, role: 'status', 'aria-live': 'polite' }, t('loading')),
          )
        }
        const failure = loadError ?? { title: t('loadErrorUnknownTitle'), detail: '', technical: '' }
        return h(
          'div',
          { style: S.page },
          h(
            'section',
            { style: S.card, role: 'alert' },
            h('h3', { style: S.cardTitle }, failure.title),
            failure.detail ? h('p', { style: S.hint }, failure.detail) : null,
            failure.technical ? h('p', { style: S.mono }, failure.technical) : null,
            h(
              'div',
              { style: S.actions },
              h(
                'button',
                {
                  type: 'button',
                  style: withDisabled(S.primary, anyBusy),
                  onClick: retryLoad,
                  disabled: anyBusy,
                  'aria-busy': busy('load') ? 'true' : undefined,
                },
                busy('load') ? t('retrying') : t('retry'),
              ),
            ),
          ),
        )
      }

      /* Saved catalog (last refresh, persisted by the host) plus the live result
       * of this session's refresh, which wins when it is newer. */
      const catalog = catalogOverride !== null ? catalogOverride : data.catalog
      const models = (() => {
        const merged = []
        const push = (id) => {
          if (typeof id === 'string' && id !== '' && !merged.includes(id)) merged.push(id)
        }
        for (const id of Array.isArray(catalog?.free) ? catalog.free : []) push(id)
        for (const id of data.models) push(id)
        return merged
      })()
      const known = models.includes(draft.model)
      const runs = data.runs
      const visibleRuns = showAllRuns ? runs : runs.slice(0, RUNS_PAGE)
      const canShowAll = runs.length > RUNS_PAGE
      const graceError = fieldErrors.graceMs
      const envError = fieldErrors.env

      /* ── page ───────────────────────────────────────────────────────────── */

      return h(
        'div',
        { style: S.page, 'aria-busy': anyBusy ? 'true' : undefined },
        h(
          'div',
          null,
          h('h2', { style: { fontSize: 16, fontWeight: 600, margin: '0 0 4px' } }, t('title')),
          h(
            'p',
            { style: S.hint },
            t('introLead'),
            h('code', { style: S.mono }, 'opencode acp'),
            t('introTail'),
            h('code', { style: S.mono }, opencodeHomePath(data.home)),
            t('introEnd'),
          ),
        ),

        error !== ''
          ? h('p', { style: S.errorLine, role: 'alert' }, `${t('errorPrefix')}${error}`)
          : null,

        h(
          Section,
          {
            title: t('modelSection'),
            hint: t('modelHint'),
            extra: h(
              'div',
              { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
              h(
                'button',
                {
                  type: 'button',
                  style: withDisabled(S.button, anyBusy),
                  onClick: runProbe,
                  disabled: anyBusy,
                  title: t('probeUsesSaved'),
                  'aria-busy': busy('probe') ? 'true' : undefined,
                },
                busy('probe') ? t('testingModel') : t('testModel'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  style: withDisabled(S.button, anyBusy),
                  onClick: runHealth,
                  disabled: anyBusy,
                  title: t('probeUsesSaved'),
                  'aria-busy': busy('health') ? 'true' : undefined,
                },
                busy('health') ? t('checkingHealth') : t('healthCheck'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  style: withDisabled(S.button, anyBusy),
                  onClick: refreshCatalog,
                  disabled: anyBusy,
                  title: t('catalogStale'),
                  'aria-busy': busy('catalog') ? 'true' : undefined,
                },
                busy('catalog') ? t('refreshingModels') : t('refreshModels'),
              ),
            ),
          },
          h('p', { style: S.subHint }, t('probeUsesSaved')),
          catalog !== null
            ? h(
                'p',
                { style: S.subHint, role: 'status' },
                t('catalogFresh', {
                  time: clock(catalog.at),
                  count: String(catalog.count ?? 0),
                  free: String(Array.isArray(catalog.free) ? catalog.free.length : 0),
                }),
              )
            : h('p', { style: S.subHint }, t('catalogStale')),
          probe !== null
            ? h(
                ResultLine,
                { ok: probe.ok === true },
                probe.ok === true
                  ? t('probeOk', { model: asText(probe.model, '—'), ms: asText(probe.ms, '—') })
                  : `${t('probeFail', { model: asText(probe.model, '—') })}${
                      probe.errorName ? ` — ${asText(probe.errorName, '')}` : ''
                    }${t('colon')}${asText(probe.detail, t('reasonUnknown'))}`,
              )
            : null,
          health !== null
            ? h(
                ResultLine,
                { ok: health.ok === true },
                health.ok === true
                  ? t('healthOk', { version: asText(health.version, t('healthVersionUnknown')) })
                  : t('healthFail'),
              )
            : null,
          h(
            Field,
            { id: 'oc-model', label: t('mainModel') },
            h(
              'select',
              {
                id: 'oc-model',
                style: S.select,
                value: known ? draft.model : '__custom',
                onChange: (event) => {
                  const value = event.target.value
                  if (value === '__custom') {
                    update({ model: '' })
                    if (typeof requestAnimationFrame === 'function') {
                      requestAnimationFrame(() => {
                        if (modelInputRef.current !== null) modelInputRef.current.focus()
                      })
                    }
                  } else {
                    update({ model: value })
                  }
                },
              },
              models.map((id) => h('option', { key: id, value: id }, id)),
              h('option', { value: '__custom' }, t('customOption')),
            ),
          ),
          known
            ? null
            : h(
                Field,
                { id: 'oc-model-custom', label: t('customModel') },
                h('input', {
                  id: 'oc-model-custom',
                  ref: modelInputRef,
                  style: S.input,
                  value: draft.model,
                  placeholder: t('customModelPlaceholder'),
                  onChange: (event) => update({ model: event.target.value }),
                }),
              ),
          h(
            Field,
            { id: 'oc-small-model', label: t('smallModel') },
            h('input', {
              id: 'oc-small-model',
              style: S.input,
              value: draft.smallModel,
              placeholder: t('smallModelPlaceholder'),
              onChange: (event) => update({ smallModel: event.target.value }),
            }),
          ),
        ),

        h(
          Section,
          { title: t('execution') },
          h(
            Field,
            { id: 'oc-permission', label: t('permission') },
            h(
              'select',
              {
                id: 'oc-permission',
                style: S.select,
                value: draft.permission,
                onChange: (event) => update({ permission: event.target.value }),
              },
              h('option', { value: 'allow' }, t('permissionAllow')),
              h('option', { value: 'reject' }, t('permissionReject')),
            ),
          ),
          h(
            Field,
            { id: 'oc-cwd-mode', label: t('cwd') },
            h(
              'select',
              {
                id: 'oc-cwd-mode',
                style: S.select,
                value: draft.cwdMode,
                onChange: (event) => update({ cwdMode: event.target.value }),
              },
              h('option', { value: 'inherit' }, t('cwdInherit')),
              h('option', { value: 'fixed' }, t('cwdFixedMode')),
            ),
          ),
          draft.cwdMode === 'fixed'
            ? h(
                Field,
                { id: 'oc-cwd-fixed', label: t('cwdFixed') },
                h('input', {
                  id: 'oc-cwd-fixed',
                  style: S.input,
                  value: draft.cwdFixed,
                  placeholder: t('cwdFixedPlaceholder'),
                  onChange: (event) => update({ cwdFixed: event.target.value }),
                }),
              )
            : null,
        ),

        h(
          'details',
          { style: { ...S.card, gap: 10 } },
          h('summary', { style: { ...S.cardTitle, cursor: 'pointer' } }, t('advanced')),
          h(
            Field,
            { id: 'oc-command', label: t('command') },
            h('input', {
              id: 'oc-command',
              style: { ...S.input, ...S.mono },
              value: draft.command,
              onChange: (event) => update({ command: event.target.value }),
            }),
          ),
          h(
            Field,
            { id: 'oc-args', label: t('args') },
            h('input', {
              id: 'oc-args',
              style: { ...S.input, ...S.mono },
              value: draft.argsText,
              onChange: (event) => update({ argsText: event.target.value }),
            }),
          ),
          h(
            Field,
            {
              id: 'oc-grace',
              label: t('grace'),
              hint: t('graceHint', { min: GRACE_MIN, max: GRACE_MAX }),
              error: graceError,
            },
            h('input', {
              id: 'oc-grace',
              style: { ...S.input, flex: 'none', maxWidth: 160 },
              type: 'text',
              inputMode: 'numeric',
              value: draft.graceMsText,
              onChange: (event) => update({ graceMsText: event.target.value }),
              'aria-invalid': graceError ? 'true' : undefined,
            }),
          ),
          h(
            'div',
            { style: S.field },
            h('label', { style: { ...S.label, minWidth: 0 }, htmlFor: 'oc-env' }, t('env')),
            h('textarea', {
              id: 'oc-env',
              style: { ...S.input, flex: 'none', width: '100%', minHeight: 72, resize: 'vertical' },
              value: envText,
              onChange: (event) => changeEnvText(event.target.value),
              'aria-invalid': envError ? 'true' : undefined,
            }),
            envError ? h('div', { style: S.errorLine, role: 'alert' }, envError) : null,
          ),
        ),

        h(
          'div',
          { style: S.actions },
          h(
            'button',
            {
              type: 'button',
              style: withDisabled(S.primary, anyBusy),
              onClick: save,
              disabled: anyBusy,
              'aria-busy': busy('save') ? 'true' : undefined,
            },
            busy('save') ? t('saving') : t('save'),
          ),
          dirty
            ? h(
                'button',
                { type: 'button', style: withDisabled(S.button, anyBusy), onClick: revert, disabled: anyBusy },
                t('revert'),
              )
            : null,
          dirty ? h('span', { style: S.subHint }, t('unsaved')) : null,
          note !== ''
            ? h(
                'span',
                {
                  style: { ...S.hint, color: noteKind === 'warn' ? T.err : T.text },
                  role: 'status',
                  'aria-live': 'polite',
                },
                note,
              )
            : null,
        ),

        h(
          Section,
          {
            title: `${t('runs')}${runs.length === 0 ? '' : t('runCount', { count: runs.length })}`,
            hint: t('runsHint'),
            extra: h(
              'div',
              { style: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } },
              h(
                'button',
                {
                  type: 'button',
                  style: withDisabled(S.button, anyBusy),
                  onClick: refresh,
                  disabled: anyBusy,
                  'aria-busy': busy('refresh') ? 'true' : undefined,
                },
                busy('refresh') ? t('refreshing') : t('refresh'),
              ),
              confirmClear
                ? h(
                    'div',
                    { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
                    h(
                      'button',
                      {
                        type: 'button',
                        style: withDisabled(S.danger, anyBusy),
                        onClick: clearRuns,
                        disabled: anyBusy,
                      },
                      t('clearConfirmYes', { count: runs.length }),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        style: withDisabled(S.button, anyBusy),
                        onClick: () => setConfirmClear(false),
                        disabled: anyBusy,
                      },
                      t('cancel'),
                    ),
                  )
                : h(
                    'button',
                    {
                      type: 'button',
                      style: withDisabled(S.button, anyBusy || runs.length === 0),
                      onClick: () => setConfirmClear(true),
                      disabled: anyBusy || runs.length === 0,
                    },
                    t('clear'),
                  ),
            ),
          },
          lastLoadedAt > 0 ? h('p', { style: S.subHint }, t('updatedAt', { time: stamp(lastLoadedAt) })) : null,
          confirmClear ? h('p', { style: S.errorLine }, t('clearConfirm')) : null,
          runs.length === 0
            ? h('p', { style: S.hint }, t('emptyRuns'))
            : h(
                'div',
                { style: S.tableWrap },
                h(
                  'table',
                  { style: S.table, 'aria-label': t('runs') },
                  h(
                    'colgroup',
                    null,
                    [100, 104, 180, 88, 64, 160, 160].map((width, index) =>
                      h('col', { key: index, style: { width } }),
                    ),
                  ),
                  h(
                    'thead',
                    null,
                    h(
                      'tr',
                      null,
                      [
                        t('colTime'),
                        t('colStatus'),
                        t('colModel'),
                        t('colCwd'),
                        t('colDuration'),
                        t('colTokens'),
                        t('colSession'),
                      ].map((label) => h('th', { key: label, style: S.th, scope: 'col' }, label)),
                    ),
                  ),
                  h(
                    'tbody',
                    null,
                    visibleRuns.map((run) => {
                      const expanded = openRun === run.id
                      const tone = statusTone(run.status)
                      const cwd = typeof run.cwd === 'string' ? run.cwd : ''
                      const cwdName = cwd.split(/[\\/]/).filter(Boolean).pop() || '—'
                      const sessionId = asText(run.sessionId, '—')
                      const model = asText(run.model, '—')
                      const detailId = `run-detail-${run.id}`
                      return h(
                        React.Fragment,
                        { key: run.id },
                        h(
                          'tr',
                          {
                            style: { cursor: 'pointer' },
                            onClick: () => setOpenRun(expanded ? null : run.id),
                          },
                          h(
                            'td',
                            { style: { ...S.td, ...S.cell } },
                            h(
                              'button',
                              {
                                type: 'button',
                                style: S.ghost,
                                onClick: (event) => {
                                  event.stopPropagation()
                                  setOpenRun(expanded ? null : run.id)
                                },
                                'aria-expanded': expanded ? 'true' : 'false',
                                'aria-controls': expanded ? detailId : undefined,
                                'aria-label': expanded ? t('collapseRun') : `${t('expandRun')} ${stamp(run.at)}`,
                              },
                              h('span', { 'aria-hidden': 'true' }, expanded ? '▾' : '▸'),
                              ' ',
                              stamp(run.at),
                            ),
                          ),
                          h(
                            'td',
                            { style: { ...S.td, ...S.cell } },
                            h(
                              'span',
                              { style: S.statusCell },
                              h('span', { style: { ...S.dot, background: tone.dot }, 'aria-hidden': 'true' }),
                              h('span', { style: { color: tone.text } }, statusText(run.status)),
                            ),
                          ),
                          h('td', { style: { ...S.td, ...S.cell, ...S.mono }, title: model }, model),
                          h('td', { style: { ...S.td, ...S.cell, ...S.mono }, title: cwd === '' ? undefined : cwd }, cwdName),
                          h('td', { style: { ...S.td, ...S.cell } }, duration(run.ms)),
                          h(
                            'td',
                            { style: { ...S.td, ...S.cell, ...S.mono }, title: tokensText(run.tokens) },
                            tokensText(run.tokens),
                          ),
                          h(
                            'td',
                            {
                              style: { ...S.td, ...S.cell, ...S.mono, color: T.dim },
                              title: sessionId === '—' ? undefined : sessionId,
                            },
                            sessionId,
                          ),
                        ),
                        expanded
                          ? h(
                              'tr',
                              null,
                              h(
                                'td',
                                { id: detailId, colSpan: 7, style: S.detail },
                                h(
                                  'div',
                                  { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
                                  h('div', { style: S.detailLine }, t('detailCwd', { value: cwd || '—' })),
                                  h('div', { style: S.detailLine }, t('detailSession', { value: sessionId })),
                                  h(
                                    'div',
                                    { style: S.detailLine },
                                    t('detailToolCalls', { value: asText(run.toolCalls, '0') }),
                                  ),
                                  h(
                                    'div',
                                    { style: S.detailLine },
                                    t('detailPrompt', { value: asText(run.promptPreview, '') }),
                                  ),
                                  typeof run.errorName === 'string' && run.errorName !== ''
                                    ? h(
                                        'div',
                                        { style: { ...S.detailLine, color: T.err } },
                                        t('detailErrorName', { value: run.errorName }),
                                      )
                                    : null,
                                  typeof run.diagnostic === 'string' && run.diagnostic !== ''
                                    ? h(
                                        'div',
                                        { style: { ...S.detailLine, color: T.err } },
                                        t('detailDiagnostic', { value: run.diagnostic }),
                                      )
                                    : null,
                                ),
                              ),
                            )
                          : null,
                      )
                    }),
                  ),
                ),
              ),
          canShowAll || showAllRuns
            ? h(
                'button',
                {
                  type: 'button',
                  style: S.ghost,
                  onClick: () => setShowAllRuns((value) => !value),
                },
                showAllRuns ? t('showLess') : t('showAll', { count: runs.length }),
              )
            : null,
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
            label: () => t('nav'),
            inject: () => ({}),
          },
          OpencodeSettings,
        ),
      )
    }

    return { name: MODULE_NAME, inject, apply }
  },
})
