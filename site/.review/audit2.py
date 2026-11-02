import json, math
from playwright.sync_api import sync_playwright

URL = "file:///D:/dev/dsh-opencode-acp/site/index.html"
REVIEW = "D:/dev/dsh-opencode-acp/site/.review/"
out = {}

NAMES_JS = """
() => {
  const items = Array.from(document.querySelectorAll('a[href], button, [tabindex]'));
  return items.map(el => {
    const label = el.getAttribute('aria-label');
    const by = el.getAttribute('aria-labelledby');
    const byText = by ? by.split(/\\s+/).map(id => { const t = document.getElementById(id); return t ? t.textContent.trim() : ''; }).join(' ') : '';
    const txt = (el.textContent || '').replace(/\\s+/g, ' ').trim();
    return {tag: el.tagName.toLowerCase(), text: txt.slice(0, 40), ariaLabel: label, byLabel: byText,
            name: label || byText || txt, empty: !(label || byText || txt)};
  });
}
"""

HEADINGS_JS = """
() => Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({tag: h.tagName, text: h.textContent.replace(/\\s+/g,' ').trim().slice(0,60)}))
"""

CONTRAST_JS = """
() => {
  function parse(c, el) {
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map(Number);
    return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1};
  }
  function opacityOf(el) {
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
    return o;
  }
  function lin(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function lum(c) { return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b); }
  const bg = {r: 11, g: 16, b: 21};
  const blend = (fg, a, bg) => ({r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a)});
  function ratio(sel, note) {
    const el = document.querySelector(sel);
    if (!el) return {sel, missing: true};
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    const a = opacityOf(el) * (fg.a === undefined ? 1 : fg.a);
    const eff = blend(fg, a, bg);
    const l1 = lum(eff), l2 = lum(bg);
    const r = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return {sel, note, color: cs.color, opacity: +a.toFixed(3), fs: cs.fontSize, fw: cs.fontWeight,
            bgNote: bg, ratio: +r.toFixed(2)};
  }
  return [
    ratio('body', 'body 17px'),
    ratio('.lead', 'hero lead'),
    ratio('.kicker', 'orange kicker 12px'),
    ratio('.zh', 'zh 14.5px dim'),
    ratio('.nav__version', 'version chip'),
    ratio('.nav__links a', 'nav link'),
    ratio('.wire__caption', 'wire caption'),
    ratio('.wire__legend', 'wire legend 11.5px'),
    ratio('.record-bar span', 'record bar value'),
    ratio('.records thead th', 'table head 11px'),
    ratio('.records tbody th', 'table row head'),
    ratio('.records__row--fault td', 'fault text'),
    ratio('.frame p:last-child', 'frame body (unpassed)'),
    ratio('.section__head .note', 'example-record note'),
    ratio('.step__text', 'step text dim'),
    ratio('.limits', 'limits 12px'),
    ratio('.foot__note', 'footer note'),
    ratio('.btn--primary', 'primary btn label'),
  ].map(x => x.missing ? x : (x.ratio < 4.5 ? Object.assign(x, {FAIL: true}) : x));
}
"""

FOCUS_JS = """
() => {
  const el = document.activeElement;
  if (!el || el === document.body) return {tag: 'BODY'};
  const cs = getComputedStyle(el);
  return {tag: el.tagName.toLowerCase(), cls: typeof el.className === 'string' ? el.className : '',
          text: (el.getAttribute('aria-label') || el.textContent || '').replace(/\\s+/g,' ').trim().slice(0,30),
          focusVisible: el.matches(':focus-visible'),
          outline: cs.outlineWidth + ' ' + cs.outlineStyle + ' ' + cs.outlineColor,
          outlineOffset: cs.outlineOffset};
}
"""

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)

    # ---------- a11y / headings / names / contrast at 1440 ----------
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page()
    pg.goto(URL, wait_until="load")
    pg.wait_for_timeout(9000)
    out["headings"] = pg.evaluate(HEADINGS_JS)
    out["h1_count"] = pg.evaluate("() => document.querySelectorAll('h1').length")
    out["names"] = pg.evaluate(NAMES_JS)
    out["contrast"] = pg.evaluate(CONTRAST_JS)
    out["table"] = pg.evaluate("""() => ({
      caption: document.querySelector('table caption') ? document.querySelector('table caption').textContent.trim() : null,
      captionVisible: document.querySelector('table caption') ? getComputedStyle(document.querySelector('table caption')).position : null,
      scopes: Array.from(document.querySelectorAll('table th')).map(th => th.getAttribute('scope')),
      tableRole: document.querySelector('table').getAttribute('role'),
      theadDisplayAtDesktop: getComputedStyle(document.querySelector('.records thead')).display
    })""")
    out["aria"] = pg.evaluate("""() => ({
      legendHidden: document.querySelector('.wire__legend').getAttribute('aria-hidden'),
      staticDisplay: getComputedStyle(document.querySelector('.wire__static')).display,
      staticAriaLabel: document.querySelector('.wire__static').getAttribute('aria-label'),
      canvasHidden: document.querySelector('#wire-canvas').getAttribute('aria-hidden'),
      recordBarLabel: document.querySelector('.record-bar').getAttribute('aria-label'),
      recordBarRole: document.querySelector('.record-bar').getAttribute('role'),
      statusRole: document.querySelector('#status').getAttribute('role'),
      statusLive: document.querySelector('#status').getAttribute('aria-live')
    })""")
    out["landmarks"] = pg.evaluate("() => Array.from(document.querySelectorAll('header,nav,main,footer,section')).map(e => e.tagName.toLowerCase() + (e.getAttribute('aria-labelledby') ? '[' + e.getAttribute('aria-labelledby') + ']' : ''))")

    # keyboard traversal
    pg.evaluate("() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0,0); }")
    steps = []
    for i in range(14):
        pg.keyboard.press("Tab")
        pg.wait_for_timeout(90)
        steps.append(pg.evaluate(FOCUS_JS))
    out["focus_steps"] = steps

    # nav / content alignment
    out["align_1440"] = pg.evaluate("""() => {
      const l = s => document.querySelector(s).getBoundingClientRect().left;
      return {navMark: l('.nav__mark'), navRight: document.querySelector('.nav__links').getBoundingClientRect().right,
              h1: l('.hero h1'), kicker: l('.kicker'), foot: l('.foot'), vw: innerWidth};
    }""")
    pg2 = ctx.new_page(); pg2.set_viewport_size({"width": 1920, "height": 1080})
    pg2.goto(URL, wait_until="load"); pg2.wait_for_timeout(400)
    out["align_1920"] = pg2.evaluate("""() => {
      const l = s => document.querySelector(s).getBoundingClientRect().left;
      return {navMark: l('.nav__mark'), h1: l('.hero h1'), foot: l('.foot'), vw: innerWidth};
    }""")
    pg2.close()

    # why 768 overflows horizontally
    pg3 = ctx.new_page(); pg3.set_viewport_size({"width": 768, "height": 900})
    pg3.goto(URL, wait_until="load"); pg3.wait_for_timeout(500)
    out["wide768"] = pg3.evaluate("""() => {
      const vw = innerWidth, res = [];
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none') continue;
        const r = el.getBoundingClientRect();
        if (r.width && r.right > vw + 0.1) res.push({tag: el.tagName.toLowerCase(), cls: typeof el.className === 'string' ? el.className : '',
          right: +r.right.toFixed(1), w: +r.width.toFixed(1), sw: el.scrollWidth, cw: el.clientWidth});
      }
      return {vw, scrollW: document.documentElement.scrollWidth, bodyScrollW: document.body.scrollWidth, res: res.slice(0, 20)};
    }""")
    pg3.close()

    # 360 nav specifics
    pg4 = ctx.new_page(); pg4.set_viewport_size({"width": 360, "height": 780})
    pg4.goto(URL, wait_until="load"); pg4.wait_for_timeout(500)
    out["nav360"] = pg4.evaluate("""() => {
      const n = document.querySelector('.nav'), m = document.querySelector('.nav__mark'), l = document.querySelector('.nav__links');
      const mr = m.getBoundingClientRect(), lr = l.getBoundingClientRect();
      return {navW: n.getBoundingClientRect().width, navScrollW: n.scrollWidth,
              markH: +mr.height.toFixed(1), markTextH: +m.querySelector('span').getBoundingClientRect().height.toFixed(1),
              markText: m.querySelector('span').getBoundingClientRect().width,
              linksLeft: +lr.left.toFixed(1), linksRight: +lr.right.toFixed(1), linksW: +lr.width.toFixed(1),
              overlap: +(mr.right - lr.left).toFixed(1), docScrollW: document.documentElement.scrollWidth};
    }""")
    pg4.screenshot(path=REVIEW + "hero-360.png", clip={"x": 0, "y": 0, "width": 360, "height": 780})
    pg4.close()

    # ---------- copy on file:// WITHOUT clipboard permission ----------
    pc = browser.new_context(viewport={"width": 1440, "height": 900})
    pcx = pc.new_page(); pcx.goto(URL, wait_until="load"); pcx.wait_for_timeout(900)
    pcx.locator(".actions .btn--primary").first.click()
    pcx.wait_for_timeout(350)
    out["copy_no_permission"] = pcx.evaluate("""() => ({
      label: document.querySelector('.actions .btn--primary .btn__label').textContent,
      status: document.getElementById('status').textContent,
      statusVisible: getComputedStyle(document.getElementById('status')).opacity
    })""")
    pc.close()

    # ---------- reduced motion ----------
    rctx = browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
    rp = rctx.new_page(); rp.goto(URL, wait_until="load"); rp.wait_for_timeout(600)
    out["reduced"] = rp.evaluate("""() => ({
      matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      animations: document.getAnimations().length,
      canvasBlank: (() => { const c = document.getElementById('wire-canvas'); if (!c) return 'no-canvas';
        const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
        for (let i=0;i<d.length;i++) if (d[i] !== 0) return false; return true; })(),
      canvasDisplay: getComputedStyle(document.getElementById('wire-canvas')).display,
      canvasBox: (() => { const b = document.getElementById('wire-canvas').getBoundingClientRect(); return {w:+b.width.toFixed(0), h:+b.height.toFixed(0)}; })(),
      staticDisplay: getComputedStyle(document.querySelector('.wire__static')).display,
      leadOpacity: getComputedStyle(document.querySelector('.lead')).opacity,
      actionsOpacity: getComputedStyle(document.querySelector('.actions')).opacity,
      zhOpacity: getComputedStyle(document.querySelector('.zh')).opacity,
      h1spanTransform: getComputedStyle(document.querySelector('.hero h1 .line > span')).transform,
      frameOpacity: getComputedStyle(document.querySelector('.frame')).opacity,
      railFill: getComputedStyle(document.querySelector('.rail__fill')).transform,
      recordOpacity: Array.from(document.querySelectorAll('.record-bar span')).map(s => getComputedStyle(s).opacity),
      isReady: document.body.classList.contains('is-ready'),
      canvasDataURL: document.getElementById('wire-canvas').toDataURL().length
    })""")
    shot1 = rp.screenshot(path=REVIEW + "reduced-1440.png")
    rp.wait_for_timeout(1200)
    shot2 = rp.screenshot(path=REVIEW + "reduced-1440-b.png")
    out["reduced_screens_identical"] = (shot1 == shot2)
    # measured after 9s: does canvas ever draw?
    rp.wait_for_timeout(7000)
    out["reduced_canvas_blank_after_9s"] = rp.evaluate("""() => { const c = document.getElementById('wire-canvas');
      const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let ink = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) ink++;
      return {paintedPixels: ink, w: c.width, h: c.height}; }""")
    rp.screenshot(path=REVIEW + "reduced-full.png", full_page=True)
    rctx.close()

    # ---------- no JS ----------
    nctx = browser.new_context(viewport={"width": 1440, "height": 900}, java_script_enabled=False)
    np_ = nctx.new_page(); np_.goto(URL, wait_until="load"); np_.wait_for_timeout(700)
    out["nojs"] = np_.evaluate("""() => ({
      h1Box: (() => { const b = document.querySelector('.hero h1').getBoundingClientRect(); return {top:+b.top.toFixed(0), h:+b.height.toFixed(0)}; })(),
      h1span: getComputedStyle(document.querySelector('.hero h1 .line > span')).transform,
      leadOpacity: getComputedStyle(document.querySelector('.lead')).opacity,
      actionsOpacity: getComputedStyle(document.querySelector('.actions')).opacity,
      zhOpacity: getComputedStyle(document.querySelector('.zh')).opacity,
      recordOpacity: getComputedStyle(document.querySelector('.record-bar span')).opacity,
      framesOpacity: getComputedStyle(document.querySelector('.frame')).opacity,
      railFill: getComputedStyle(document.querySelector('.rail__fill')).transform
    })""")
    np_.screenshot(path=REVIEW + "nojs-hero.png", clip={"x": 0, "y": 0, "width": 1440, "height": 900})
    nctx.close()

    # ---------- how section mid-scroll visual ----------
    hp = ctx.new_page(); hp.goto(URL, wait_until="load"); hp.wait_for_timeout(1500)
    hp.evaluate("() => document.getElementById('how').scrollIntoView({block:'start'})")
    hp.wait_for_timeout(500)
    hp.evaluate("() => window.scrollBy(0, 420)")
    hp.wait_for_timeout(500)
    hp.locator("#how").screenshot(path=REVIEW + "how-partial.png")
    out["how_contrast_frame_unpassed"] = hp.evaluate("""() => {
      const f = document.querySelectorAll('.frame')[5];
      return {opacity: getComputedStyle(f).opacity, color: getComputedStyle(f.querySelector('p:last-child')).color,
              passed: f.classList.contains('is-passed')};
    }""")
    ctx.close()
    browser.close()

with open(REVIEW + "audit2.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=True, indent=1)[:20000])
