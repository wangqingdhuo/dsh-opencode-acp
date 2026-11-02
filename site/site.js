/* dsh-opencode-acp — landing page behaviour.
   Three motions only: the hero run, the frame rail, and the acknowledgment on
   accepted actions. No scroll-jacking, no loops, no mouse-follow effects. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── entrance ──────────────────────────────────────────────────────────── */

  function startEntrance() {
    document.body.classList.add('is-ready');
  }

  if (document.readyState === 'complete') startEntrance();
  else window.addEventListener('load', startEntrance, { once: true });

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
    var original = label ? label.textContent : '';
    var timer = 0;

    button.addEventListener('click', function () {
      var text = button.getAttribute('data-copy') || '';
      copyText(text).then(function (ok) {
        if (!ok) {
          announce('Copy failed — select the command instead');
          return;
        }
        button.dataset.copied = 'true';
        if (label) label.textContent = 'Copied';
        announce('Install command copied');
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          button.dataset.copied = 'false';
          if (label) label.textContent = original;
        }, 1600);
      });
    });
  });

  /* ── M3 · acknowledgment: record rows ──────────────────────────────────── */

  Array.prototype.forEach.call(document.querySelectorAll('.disclose'), function (button) {
    button.addEventListener('click', function () {
      var id = button.getAttribute('aria-controls');
      var row = id ? document.getElementById(id) : null;
      if (!row) return;
      var open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', open ? 'false' : 'true');
      button.textContent = open ? '+' : '−';
      button.setAttribute('aria-label', open ? 'Show run detail' : 'Hide run detail');
      row.hidden = open;
    });
  });

  /* ── M2 · scroll-linked frame rail ─────────────────────────────────────── */

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
    var fields = recordBar.querySelectorAll('span');
    Array.prototype.forEach.call(fields, function (field, index) {
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

  if (!canvas) return;

  if (reduceMotion || window.matchMedia('(max-width: 640px)').matches) {
    staticRecord();
    return;
  }

  var ctx = canvas.getContext('2d');
  if (!ctx) {
    staticRecord();
    return;
  }

  var DURATION = 6600;
  var START = 900;
  var SPEED = 520; // px per second, per the motion brief
  var ANSWER_AT = 2600;
  var ANSWER_SPAN = 2900;
  var startedAt = 0;
  var finished = false;
  var width = 0;
  var height = 120;
  var dpr = 1;

  function measure() {
    var box = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(box.width));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  measure();
  window.addEventListener('resize', function () {
    measure();
    if (finished) renderFinal();
  });

  /* The wire is a channel: two hairlines with traffic inside them. */
  function channelTop() {
    return Math.round(height * 0.36)
  }

  function channelBottom() {
    return Math.round(height * 0.7)
  }

  function lineY() {
    return Math.round(height * 0.53)
  }

  function edgeX() {
    return Math.round(width * 0.42)
  }

  var mono = '10.5px ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace'

  function mark(x, y, color, alpha, w) {
    ctx.globalAlpha = alpha === undefined ? 1 : alpha
    ctx.fillStyle = color
    ctx.fillRect(Math.round(x), Math.round(y), w || 3, 3)
    ctx.globalAlpha = 1
  }

  var outFrames = [{ at: 0 }, { at: 140 }, { at: 280 }]
  var inFrames = [{ at: 1250 }, { at: 1700 }]

  function drawBase(alpha) {
    ctx.globalAlpha = alpha
    ctx.strokeStyle = 'rgba(140,160,178,0.42)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, channelTop() + 0.5)
    ctx.lineTo(width, channelTop() + 0.5)
    ctx.moveTo(0, channelBottom() + 0.5)
    ctx.lineTo(width, channelBottom() + 0.5)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(140,160,178,0.5)'
    ctx.beginPath()
    ctx.moveTo(edgeX() + 0.5, channelTop() - 14)
    ctx.lineTo(edgeX() + 0.5, channelBottom() + 14)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  function render(elapsed) {
    ctx.clearRect(0, 0, width, height)
    drawBase(1)
    var y = lineY() - 1.5

    outFrames.forEach(function (frame) {
      var travel = elapsed - frame.at
      if (travel < 0) return
      var x = 8 + (travel / 1000) * SPEED
      if (x > width - 4) return
      mark(x, y, x >= edgeX() ? '#f0a03a' : '#8ca0b2', 1)
    })

    inFrames.forEach(function (frame) {
      var travel = elapsed - frame.at
      if (travel < 0) return
      var x = width - 8 - (travel / 1000) * SPEED * 1.35
      if (x < edgeX() + 4) return
      mark(x, y, '#e9e4d9', 0.9)
    })

    var progress = Math.max(0, Math.min(1, (elapsed - ANSWER_AT) / ANSWER_SPAN))
    if (elapsed >= ANSWER_AT) drawAnswer(progress)
  }

  function drawAnswer(progress) {
    if (progress <= 0) return
    var from = width - 8
    var to = 8
    var x = from - (from - to) * progress
    var y = lineY()
    ctx.strokeStyle = '#e9e4d9'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(from, y)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 9, y - 4.5)
    ctx.lineTo(x + 9, y + 4.5)
    ctx.closePath()
    ctx.fillStyle = '#e9e4d9'
    ctx.fill()

    if (progress > 0.55) {
      ctx.font = mono
      ctx.fillStyle = 'rgba(233,228,217,' + (0.55 + 0.45 * progress).toFixed(2) + ')'
      ctx.fillText('one answer', to + 12, y - 9)
    }
  }

  function renderFinal() {
    ctx.clearRect(0, 0, width, height)
    drawBase(1)

    var y = lineY()

    /* three requests crossed the boundary and stay docked on its left */
    outFrames.forEach(function (frame, index) {
      ctx.fillStyle = 'rgba(240,160,58,0.85)'
      ctx.fillRect(Math.round(edgeX() - 34 + index * 11), Math.round(y - 4), 2, 8)
    })
    /* the chunks came back to the child side of the same boundary */
    inFrames.forEach(function (frame, index) {
      ctx.fillStyle = 'rgba(233,228,217,0.55)'
      ctx.fillRect(Math.round(edgeX() + 22 + index * 12), Math.round(y - 3), 2, 6)
    })

    drawAnswer(1)

    ctx.font = mono
    ctx.fillStyle = 'rgba(140,160,178,0.75)'
    ctx.fillText('conversation', 2, channelBottom() + 18)
    var right = 'child process'
    ctx.fillText(right, width - ctx.measureText(right).width - 2, channelBottom() + 18)

    ctx.fillStyle = 'rgba(240,160,58,0.85)'
    ctx.fillText('ACP', edgeX() + 6, channelTop() - 14)
  }

  function tick(now) {
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
  }

  window.setTimeout(function () {
    window.requestAnimationFrame(function (now) {
      startedAt = now;
      window.requestAnimationFrame(tick);
    });
    lightRecord(4800);
  }, START);
})();
