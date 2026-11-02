/* dsh-opencode-acp — landing page behaviour.
   Chinese is the default language; English is one click away and remembered.
   Three motions only: the hero run, the frame rail, and the acknowledgment on
   accepted actions. No scroll-jacking, no loops, no mouse-follow effects. */
(function () {
  'use strict';

  /* ── copy ──────────────────────────────────────────────────────────────── */

  var I18N = {
    zh: {
      'meta.title': 'dsh-opencode-acp — 把 opencode 接成 DeepSeek Harness 的子代理',
      'meta.description':
        '一个 DeepSeek Harness 插件：把任务交给 opencode 的独立进程，用它的模型和工具干活，只把答案带回来。每次运行都有记录。',
      'meta.ogDescription': '把 opencode 接成 DeepSeek Harness 的子代理。任务出去，答案回来。',
      'nav.skip': '跳到正文',
      'hero.kicker': 'DeepSeek Harness 插件',
      'hero.line1': '把 opencode 变成',
      'hero.line2': 'DeepSeek Harness',
      'hero.line3': '里的子代理。',
      'hero.lead': '一个任务离开你的对话，进入 opencode 自己的进程，用它自己的模型跑完。答案回来，别的都不回来。',
      'hero.cta': '复制安装命令',
      'hero.secondary': '看源码',
      'wire.out': '发出',
      'wire.in': '返回',
      'wire.caption': '一次运行，已缩短。方法名就是 README 里写的那些。',
      'record.run': '运行',
      'record.model': '模型',
      'record.duration': '耗时',
      'record.tokens': 'token',
      'record.done': '完成',
      'throat.task': '任务',
      'throat.answer': '答案',
      'band.title': '两个 harness，一段对话。',
      'band.body':
        'DSH 继续当驾驶。opencode 带来它自己的模型、工具和免费额度，它做的一切都不会进你的上下文，也不进你的账单。子进程只拿到任务文本和工作目录：没有历史，没有计划，也没有它没要的文件。',
      'records.title': '每次运行都留下记录。',
      'records.body':
        '这个插件自己实现了 ACP，所以官方 provider 丢掉的东西它都留着：子进程的会话 id、真正跑的是哪个模型、耗时、工具调用次数和 token。最后一行是一次值得保留的失败——它才是告诉你要修什么的那条。',
      'records.note': '示例记录。字段与 <code>runs.json</code> 一致。',
      'records.th.started': '开始',
      'records.th.model': '模型',
      'records.th.dir': '目录',
      'records.th.ms': '毫秒',
      'records.th.tokens': 'token',
      'records.th.state': '状态',
      'records.state.done': '完成',
      'records.state.fault': '额度用尽',
      'records.session': '会话',
      'records.toolCalls': '工具调用',
      'records.cacheRead': '缓存读取',
      'records.faultText': 'opencode 报免费额度用完：接一个 provider，或订阅 OpenCode Go，或者换一个模型。',
      'how.title': '六帧，一个答案。',
      'how.body': '因为 DSH 自己讲 ACP，它才能留下官方 provider 丢掉的那部分：子进程侧的会话 id、真正跑的模型、耗时、token。',
      'frame.out': '发出',
      'frame.in': '返回',
      'frame.write': '写入',
      'frame.1': '协议版本、客户端能力。子进程先同意讲 ACP，之后才对它提要求。',
      'frame.2': '在 opencode 里开一个会话，绑定到这次委派发起时所在的目录。',
      'frame.3': '任务文本越过边界。载荷就这些：没有历史、没有附件、没有父级上下文。',
      'frame.4': '答案以分片流式回来。只收集文本，工具调用留在子进程自己的会话里。',
      'frame.5': '这次运行花掉的 token，答案落地时和模型、耗时记在一起。',
      'frame.6': '会话 id、模型、毫秒、工具调用、用量。运行一结束，设置页里就能看到。',
      'models.title': '用的是它的免费额度。',
      'models.body':
        '模型目录在设置页刷新，然后花一次真实请求测一下已保存的模型，再决定信不信它。免费额度按账号走、还会变，页面会告诉你哪个模型答了、哪个模型拒了。',
      'models.dt1': '刷新目录',
      'models.dd1': '跑一次 <code>opencode models</code>，把免费档模型并进下拉，缓存在 <code>catalog.json</code>',
      'models.dt2': '测试模型',
      'models.dd2': '用已保存的模型起一个一次性 ACP 会话；失败原文会作为诊断留在记录里',
      'models.dt3': '设置',
      'models.dd3': '模型、小模型、权限策略、工作目录——每次委派开始时读取',
      'models.dt4': '读得懂的失败',
      'models.dd4': '<code>provider.free-limit</code> · <code>provider.internal</code> · 退出码 · 有截断的 stderr',
      'install.title': '装上，然后发一次委派。',
      'install.req':
        '要求：DSH <code>&gt;=0.2.1-rc.1 &lt;0.3.0</code>，opencode v2 且带 <code>acp</code> 子命令，以及一个已经登录过的 opencode。',
      'step.1.label': '加插件',
      'copy.short': '复制',
      'step.2.label': '选模型',
      'step.2.text': '设置 → OpenCode 委派。刷新目录，测一个能用的，留着。',
      'step.3.label': '发委派',
      'step.3.text': '直接跟 agent 说，或者调 <code>subagent_opencode</code>。答案会作为完成通知回来。',
      limits:
        '限制也一起说清楚：一次性执行、不能追问 · 每次运行新起一个进程 · 子进程用你的账号跑，不受沙箱约束 · 本地设置路由按设计不做鉴权，只监听回环。',
      'foot.note': '记录里的数值来自一台真实机器的示例数据。',
      'canvas.boundary': '进程边界',
      'canvas.answer': '一个答案',
      'canvas.recorded': '已记录',
      'status.copied': '已复制安装命令',
      'status.copyFailed': '复制失败，请手动选中命令',
      'a11y.discloseShow': '显示 {when} 这次运行的详情',
      'a11y.discloseHide': '收起 {when} 这次运行的详情',
      'a11y.navMark': 'dsh-opencode-acp，回到顶部',
      'a11y.langGroup': '语言 / Language',
    },
    en: {
      'meta.title': 'dsh-opencode-acp — run opencode as a subagent inside DeepSeek Harness',
      'meta.description':
        'A DeepSeek Harness plugin that runs opencode as an ACP subagent: one task leaves your conversation, the child process does the work with its own models, and the answer comes back. Every run leaves a record.',
      'meta.ogDescription': 'Run opencode as a subagent inside DeepSeek Harness. One task leaves, one answer returns.',
      'nav.skip': 'Skip to content',
      'hero.kicker': 'DeepSeek Harness plugin',
      'hero.line1': 'Run opencode as a',
      'hero.line2': 'subagent inside',
      'hero.line3': 'DeepSeek Harness.',
      'hero.lead':
        'One task leaves your conversation. opencode runs it in its own process, with its own models. The answer comes back. Nothing else does.',
      'hero.cta': 'Copy install command',
      'hero.secondary': 'Read the source',
      'wire.out': 'out',
      'wire.in': 'in',
      'wire.caption': 'One run, shortened. Method names are the ones the README documents.',
      'record.run': 'run',
      'record.model': 'model',
      'record.duration': 'duration',
      'record.tokens': 'tokens',
      'record.done': 'done',
      'throat.task': 'task',
      'throat.answer': 'answer',
      'band.title': 'Two harnesses, one conversation.',
      'band.body':
        'DSH stays the driver. opencode brings its own models, tools and free tier, and nothing it does lands in your context or your token bill. The child receives the task text and the working directory. Not the history, not the plan, not the files it did not ask for.',
      'records.title': 'Every run leaves a record.',
      'records.body':
        'The plugin speaks ACP itself, so it keeps the session id, model, duration, tool calls and tokens that the official provider drops. The last row is the failure worth keeping: it is the one that tells you what to fix.',
      'records.note': 'Example record. Fields match <code>runs.json</code>.',
      'records.th.started': 'started',
      'records.th.model': 'model',
      'records.th.dir': 'dir',
      'records.th.ms': 'ms',
      'records.th.tokens': 'tokens',
      'records.th.state': 'state',
      'records.state.done': 'completed',
      'records.state.fault': 'free-limit',
      'records.session': 'session',
      'records.toolCalls': 'tool calls',
      'records.cacheRead': 'cache read',
      'records.faultText': 'Free usage limit reached: connect a provider, subscribe to OpenCode Go, or switch models.',
      'how.title': 'Six frames. One answer.',
      'how.body':
        'DSH speaks ACP itself, so it can keep what the official provider drops: the session id on the child side, the model that ran, the duration, the tokens.',
      'frame.out': 'out',
      'frame.in': 'in',
      'frame.write': 'write',
      'frame.1': 'Protocol version, client capabilities. The child agrees to speak ACP before anything is asked of it.',
      'frame.2': 'A session is created inside opencode, bound to the directory the delegation was started from.',
      'frame.3': 'The task text crosses the boundary. That is the whole payload: no history, no attachments, no parent context.',
      'frame.4': "The answer streams back as chunks. Only text is collected; tool traffic stays in the child's session.",
      'frame.5': 'Tokens this run spent, recorded beside the model and duration when the answer lands.',
      'frame.6': 'Session id, model, milliseconds, tool calls, usage. Readable in the settings page as soon as the run settles.',
      'models.title': 'Its free tier, not yours.',
      'models.body':
        "Refresh opencode's catalog from Settings, then spend one real request to test the saved model before you trust it. Free quota is per account and moves; the page tells you which model answered and which one refused.",
      'models.dt1': 'Refresh catalog',
      'models.dd1': 'runs <code>opencode models</code> → free-tier entries merged into the picker, cached in <code>catalog.json</code>',
      'models.dt2': 'Test model',
      'models.dd2': "one throwaway ACP session against the saved model; the failure text is kept as the record's diagnostic",
      'models.dt3': 'Settings',
      'models.dd3': 'model, small model, permission policy, working directory — read at the start of every delegation',
      'models.dt4': 'Failure you can read',
      'models.dd4': '<code>provider.free-limit</code> · <code>provider.internal</code> · exit code · bounded stderr tail',
      'install.title': 'Install it, then send one delegation.',
      'install.req':
        'Requirements: DSH <code>&gt;=0.2.1-rc.1 &lt;0.3.0</code>, opencode v2 with the <code>acp</code> subcommand, and an existing opencode login.',
      'step.1.label': 'Add the plugin',
      'copy.short': 'Copy',
      'step.2.label': 'Set the model',
      'step.2.text': 'Settings → OpenCode 委派. Refresh the catalog, test one model, keep it.',
      'step.3.label': 'Delegate',
      'step.3.text': 'Ask your agent, or call <code>subagent_opencode</code> directly. The answer arrives as a completion notice.',
      limits:
        'Limits, in the same breath: one-shot, no follow-ups · a fresh process per run · the child runs as you and is not sandboxed · the local settings routes are unauthenticated by design, bound to loopback.',
      'foot.note': 'Record values are example data from a real machine.',
      'canvas.boundary': 'process boundary',
      'canvas.answer': 'one answer',
      'canvas.recorded': 'recorded',
      'status.copied': 'Install command copied',
      'status.copyFailed': 'Copy failed — select the command instead',
      'a11y.discloseShow': 'Show detail for the run started at {when}',
      'a11y.discloseHide': 'Hide detail for the run started at {when}',
      'a11y.navMark': 'dsh-opencode-acp, top of page',
      'a11y.langGroup': 'Language / 语言',
    },
  };

  var STORAGE_KEY = 'dsh-opencode-acp:lang';
  var lang = 'zh';

  /* ?lang=en / ?lang=zh lets a link choose the language; the switch remembers it. */
  try {
    var requested = new URLSearchParams(window.location.search).get('lang');
    if (requested === 'en' || requested === 'zh') lang = requested;
    else {
      var saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'zh') lang = saved;
    }
  } catch (error) {
    /* private mode or blocked storage: keep the default */
  }

  function t(key, params) {
    var table = I18N[lang] || I18N.zh;
    var value = table[key];
    if (value === undefined) value = I18N.zh[key] !== undefined ? I18N.zh[key] : key;
    if (params) {
      Object.keys(params).forEach(function (name) {
        value = value.split('{' + name + '}').join(String(params[name]));
      });
    }
    return value;
  }

  /* ── per-language chrome that other features read ──────────────────────── */

  var body = document.body;
  var langButtons = Array.prototype.slice.call(document.querySelectorAll('[data-lang]'));
  var copyButtons = [];
  var discloses = [];

  function applyLang(next, options) {
    lang = next === 'en' ? 'en' : 'zh';
    document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : 'en';
    document.title = t('meta.title');

    var description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', t('meta.description'));
    var ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.setAttribute('content', t('meta.ogDescription'));
    var ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogLocale) ogLocale.setAttribute('content', lang === 'zh' ? 'zh_CN' : 'en_US');

    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (element) {
      element.textContent = t(element.getAttribute('data-i18n'));
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-html]'), function (element) {
      element.innerHTML = t(element.getAttribute('data-i18n-html'));
    });

    /* mobile record cards label their cells through data-label */
    var labels = {
      'records.th.started': 'started',
      'records.th.model': 'model',
      'records.th.dir': 'dir',
      'records.th.ms': 'ms',
      'records.th.tokens': 'tokens',
      'records.th.state': 'state',
    };
    Object.keys(labels).forEach(function (key) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-label="' + labels[key] + '"]'), function (cell) {
        cell.setAttribute('data-label', t(key));
      });
    });

    var navMark = document.querySelector('.nav__mark');
    if (navMark) navMark.setAttribute('aria-label', t('a11y.navMark'));
    var langGroup = document.querySelector('.lang');
    if (langGroup) langGroup.setAttribute('aria-label', t('a11y.langGroup'));

    langButtons.forEach(function (button) {
      button.setAttribute('aria-pressed', button.getAttribute('data-lang') === lang ? 'true' : 'false');
    });

    copyButtons.forEach(function (entry) {
      entry.original = t(entry.key);
      if (!entry.copied) entry.label.textContent = entry.original;
    });
    discloses.forEach(function (entry) {
      var open = entry.button.getAttribute('aria-expanded') === 'true';
      entry.button.setAttribute('aria-label', t(open ? 'a11y.discloseHide' : 'a11y.discloseShow', { when: entry.when }));
    });

    if (options && options.persist) {
      try {
        window.localStorage.setItem(STORAGE_KEY, lang);
      } catch (error) {
        /* storage blocked: the switch still works for this page */
      }
      /* keep the address bar honest so a reload does not fight the switch */
      try {
        var next = new URL(window.location.href);
        next.searchParams.set('lang', lang);
        window.history.replaceState(null, '', next.toString());
      } catch (error) {
        /* file:// or a blocked history API: the stored choice still wins */
      }
    }

    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }));
    return lang;
  }

  /* ── entrance ──────────────────────────────────────────────────────────── */

  function startEntrance() {
    window.requestAnimationFrame(function () {
      body.classList.add('is-ready');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startEntrance, { once: true });
  else startEntrance();

  /* ── M3 · acknowledgment: copy buttons ─────────────────────────────────── */

  var statusEl = document.getElementById('status');
  var statusTimer = 0;

  function announce(text) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.add('is-on');
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(function () {
      statusEl.classList.remove('is-on');
    }, 1600);
  }

  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (error) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return legacyCopy(text);
        },
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (button) {
    var label = button.querySelector('.btn__label');
    if (!label) return;
    var entry = {
      button: button,
      label: label,
      key: label.getAttribute('data-i18n') || 'hero.cta',
      original: label.textContent,
      copied: false,
    };
    copyButtons.push(entry);
    var timer = 0;

    button.addEventListener('click', function () {
      var text = button.getAttribute('data-copy') || '';
      copyText(text).then(function (ok) {
        if (!ok) {
          announce(t('status.copyFailed'));
          return;
        }
        entry.copied = true;
        button.dataset.copied = 'true';
        label.textContent = lang === 'zh' ? '已复制' : 'Copied';
        announce(t('status.copied'));
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          entry.copied = false;
          button.dataset.copied = 'false';
          label.textContent = entry.original;
        }, 1600);
      });
    });
  });

  /* ── M3 · acknowledgment: record rows ──────────────────────────────────── */

  Array.prototype.forEach.call(document.querySelectorAll('.disclose'), function (button) {
    var row = button.closest('tr');
    var stamp = row ? row.querySelector('th') : null;
    var when = stamp ? stamp.textContent.trim() : '';
    var entry = { button: button, when: when };
    discloses.push(entry);

    button.addEventListener('click', function () {
      var id = button.getAttribute('aria-controls');
      var detail = id ? document.getElementById(id) : null;
      if (!detail) return;
      var open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', open ? 'false' : 'true');
      button.textContent = open ? '+' : '−';
      button.setAttribute('aria-label', t(open ? 'a11y.discloseShow' : 'a11y.discloseHide', { when: when }));
      detail.hidden = open;
    });
  });

  /* ── language switch ───────────────────────────────────────────────────── */

  langButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var next = button.getAttribute('data-lang');
      if (next === lang) return;
      applyLang(next, { persist: true });
    });
  });

  /* ── M2 · scroll-linked frame rail ─────────────────────────────────────── */

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var how = document.getElementById('how');
  var fill = how ? how.querySelector('.rail__fill') : null;
  var frames = how ? Array.prototype.slice.call(how.querySelectorAll('.frame')) : [];

  function updateRail() {
    if (!how || !fill || frames.length === 0) return;
    var rect = how.getBoundingClientRect();
    var viewport = window.innerHeight || 800;
    var travel = rect.height + viewport * 0.45;
    var passed = viewport * 0.55 - rect.top;
    var progress = Math.max(0, Math.min(1, passed / Math.max(travel, 1)));
    fill.style.transform = 'scaleY(' + progress.toFixed(4) + ')';
    var per = 1 / (frames.length + 0.55);
    for (var i = 0; i < frames.length; i += 1) {
      if (progress >= per * (i + 0.35)) frames[i].classList.add('is-passed');
      else frames[i].classList.remove('is-passed');
    }
  }

  if (reduceMotion) {
    if (fill) fill.style.transform = 'scaleY(1)';
    frames.forEach(function (frame) {
      frame.classList.add('is-passed');
    });
  } else if (how) {
    var railQueued = false;
    var queueRail = function () {
      if (railQueued) return;
      railQueued = true;
      window.requestAnimationFrame(function () {
        railQueued = false;
        updateRail();
      });
    };
    window.addEventListener('scroll', queueRail, { passive: true });
    window.addEventListener('resize', queueRail);
    updateRail();
  }

  /* ── M1 · the hero run ─────────────────────────────────────────────────── */

  var canvas = document.getElementById('wire-canvas');
  var recordBar = document.querySelector('.record-bar');

  function lightRecord(at) {
    if (!recordBar) return;
    Array.prototype.forEach.call(recordBar.querySelectorAll('span'), function (field, index) {
      window.setTimeout(function () {
        field.classList.add('is-lit');
      }, (at || 0) + index * 120);
    });
  }

  function staticRecord() {
    if (!recordBar) return;
    Array.prototype.forEach.call(recordBar.querySelectorAll('span'), function (field) {
      field.classList.add('is-lit');
    });
  }

  var ctx = canvas ? canvas.getContext('2d') : null;

  if (canvas && ctx) {
    var DURATION = 6400;
    var START = 700;
    var SPEED = 520; // px per second, per the motion brief
    var ANSWER_AT = 2400;
    var ANSWER_SPAN = 2800;
    var startedAt = 0;
    var finished = false;
    var width = 0;
    var height = 92;
    var dpr = 1;
    var mono = '10.5px ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace';

    var measure = function () {
      var box = canvas.getBoundingClientRect();
      width = Math.max(0, Math.round(box.width));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    var channelTop = function () {
      return Math.round(height * 0.36);
    };
    var channelBottom = function () {
      return Math.round(height * 0.7);
    };
    var lineY = function () {
      return Math.round(height * 0.53);
    };
    var edgeX = function () {
      return Math.round(width * 0.42);
    };

    var mark = function (x, color, alpha) {
      ctx.globalAlpha = alpha === undefined ? 1 : alpha;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), lineY() - 1.5, 2.5, 3);
      ctx.globalAlpha = 1;
    };

    var outFrames = [{ at: 0 }, { at: 140 }, { at: 280 }];
    var inFrames = [{ at: 1150 }, { at: 1550 }];

    var drawBase = function (alpha) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(140,160,178,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, channelTop() + 0.5);
      ctx.lineTo(width, channelTop() + 0.5);
      ctx.moveTo(0, channelBottom() + 0.5);
      ctx.lineTo(width, channelBottom() + 0.5);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(140,160,178,0.5)';
      ctx.beginPath();
      ctx.moveTo(edgeX() + 0.5, channelTop() - 12);
      ctx.lineTo(edgeX() + 0.5, channelBottom() + 12);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    var drawBoundaryLabel = function () {
      ctx.font = mono;
      ctx.fillStyle = 'rgba(140,160,178,0.85)';
      ctx.fillText(t('canvas.boundary'), edgeX() + 8, channelTop() - 4);
    };

    var drawAnswer = function (progress) {
      if (progress <= 0) return;
      var from = width - 8;
      var to = 8;
      var x = from - (from - to) * progress;
      var y = lineY();
      ctx.strokeStyle = '#e9e4d9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(from, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 9, y - 4.5);
      ctx.lineTo(x + 9, y + 4.5);
      ctx.closePath();
      ctx.fillStyle = '#e9e4d9';
      ctx.fill();

      if (progress > 0.5) {
        ctx.font = mono;
        ctx.fillStyle = 'rgba(233,228,217,' + (0.5 + 0.5 * progress).toFixed(2) + ')';
        ctx.fillText(t('canvas.answer'), to + 12, y - 9);
      }
    };

    var render = function (elapsed) {
      if (width < 10) return;
      ctx.clearRect(0, 0, width, height);
      drawBase(1);
      drawBoundaryLabel();

      outFrames.forEach(function (frame) {
        var travel = elapsed - frame.at;
        if (travel < 0) return;
        var x = 8 + (travel / 1000) * SPEED;
        if (x > width - 4) return;
        mark(x, x >= edgeX() ? '#f0a03a' : '#8ca0b2');
      });

      inFrames.forEach(function (frame) {
        var travel = elapsed - frame.at;
        if (travel < 0) return;
        var x = width - 8 - (travel / 1000) * SPEED * 1.35;
        if (x < edgeX() + 4) return;
        mark(x, '#e9e4d9', 0.9);
      });

      var progress = Math.max(0, Math.min(1, (elapsed - ANSWER_AT) / ANSWER_SPAN));
      if (elapsed >= ANSWER_AT) drawAnswer(progress);
    };

    var renderFinal = function () {
      measure();
      if (width < 10) return;
      ctx.clearRect(0, 0, width, height);
      drawBase(1);
      drawBoundaryLabel();

      var y = lineY();
      outFrames.forEach(function (frame, index) {
        ctx.fillStyle = 'rgba(240,160,58,0.9)';
        ctx.fillRect(Math.round(edgeX() - 34 + index * 11), Math.round(y - 4), 2, 8);
      });
      inFrames.forEach(function (frame, index) {
        ctx.fillStyle = 'rgba(233,228,217,0.55)';
        ctx.fillRect(Math.round(edgeX() + 22 + index * 12), Math.round(y - 3), 2, 6);
      });

      drawAnswer(1);

      ctx.font = mono;
      ctx.fillStyle = 'rgba(240,160,58,0.9)';
      ctx.fillText(t('canvas.recorded'), 2, channelBottom() + 20);
    };

    var tick = function (now) {
      if (!startedAt) startedAt = now;
      var elapsed = now - startedAt;
      render(elapsed > DURATION ? DURATION : elapsed);
      if (elapsed >= DURATION) {
        finished = true;
        renderFinal();
        return;
      }
      if (!document.hidden) window.requestAnimationFrame(tick);
      else
        window.setTimeout(function () {
          window.requestAnimationFrame(tick);
        }, 300);
    };

    document.addEventListener('langchange', function () {
      if (finished) renderFinal();
    });

    /* Reduced motion, or a viewport where the canvas is hidden: paint the result once. */
    if (reduceMotion || window.matchMedia('(max-width: 640px)').matches) {
      renderFinal();
      staticRecord();
      window.addEventListener('resize', function () {
        if (window.matchMedia('(max-width: 640px)').matches) staticRecord();
        else renderFinal();
      });
    } else {
      measure();
      window.addEventListener('resize', function () {
        measure();
        if (finished) renderFinal();
      });

      window.setTimeout(function () {
        window.requestAnimationFrame(function (now) {
          startedAt = now;
          window.requestAnimationFrame(tick);
        });
        lightRecord(4800);
      }, START);
    }
  } else {
    staticRecord();
  }

  /* ── boot ──────────────────────────────────────────────────────────────── */

  applyLang(lang, { persist: false });
})();
