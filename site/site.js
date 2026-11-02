/* dsh-opencode-acp — landing page behaviour.
   Three motions only: the hero run, the frame rail, and the acknowledgment on
   accepted actions. No scroll-jacking, no loops, no mouse-follow effects. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── entrance ──────────────────────────────────────────────────────────── */

  function startEntrance() {
    window.requestAnimationFrame(function () {
      document.body.classList.add('is-ready');
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
    var row = button.closest('tr');
    var stamp = row ? row.querySelector('th') : null;
    var when = stamp ? stamp.textContent.trim() : '';

    button.addEventListener('click', function () {
      var id = button.getAttribute('aria-controls');
      var detail = id ? document.getElementById(id) : null;
      if (!detail) return;
      var open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', open ? 'false' : 'true');
      button.textContent = open ? '+' : '−';
      button.setAttribute('aria-label', (open ? 'Show detail for the run started at ' : 'Hide detail for the run started at ') + when);
      detail.hidden = open;
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

  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) {
    staticRecord();
    return;
  }

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

  function measure() {
    var box = canvas.getBoundingClientRect();
    width = Math.max(0, Math.round(box.width));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function channelTop() {
    return Math.round(height * 0.36);
  }

  function channelBottom() {
    return Math.round(height * 0.7);
  }

  function lineY() {
    return Math.round(height * 0.53);
  }

  function edgeX() {
    return Math.round(width * 0.42);
  }

  function mark(x, color, alpha) {
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), lineY() - 1.5, 2.5, 3);
    ctx.globalAlpha = 1;
  }

  var outFrames = [{ at: 0 }, { at: 140 }, { at: 280 }];
  var inFrames = [{ at: 1150 }, { at: 1550 }];

  function drawBase(alpha) {
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
  }

  function drawBoundaryLabel() {
    ctx.font = mono;
    ctx.fillStyle = 'rgba(140,160,178,0.85)';
    ctx.fillText('process boundary', edgeX() + 8, channelTop() - 4);
  }

  function drawAnswer(progress) {
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
      ctx.fillText('one answer', to + 12, y - 9);
    }
  }

  function render(elapsed) {
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
  }

  function renderFinal() {
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
    ctx.fillText('recorded', 2, channelBottom() + 20);
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

  /* Reduced motion, or a viewport where the canvas is hidden: paint the result once. */
  if (reduceMotion || window.matchMedia('(max-width: 640px)').matches) {
    renderFinal();
    staticRecord();
    window.addEventListener('resize', function () {
      if (window.matchMedia('(max-width: 640px)').matches) staticRecord();
      else renderFinal();
    });
    return;
  }

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
})();
