import json, sys
from playwright.sync_api import sync_playwright

URL = "file:///D:/dev/dsh-opencode-acp/site/index.html"
REVIEW = "D:/dev/dsh-opencode-acp/site/.review/"
out = {}

OVERFLOW_JS = """
() => {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const bad = [];
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    if (el.closest('.table-wrap')) continue;      // intended internal scroller
    if (el.closest('.sr-only')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > vw + 0.5 || r.left < -0.5) {
      bad.push({sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : ''), left: +r.left.toFixed(1), right: +r.right.toFixed(1), w: +r.width.toFixed(1)});
    }
  }
  return {vw: vw, scrollW: doc.scrollWidth, clientW: doc.clientWidth, bad: bad.slice(0, 12)};
}
"""

FIT_JS = """
() => {
  const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return {top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1), h: +b.height.toFixed(1)}; };
  return {
    vh: window.innerHeight,
    nav: r('.nav'), h1: r('.hero h1'), lead: r('.lead'), actions: r('.actions'), zh: r('.zh'),
    wire: r('.wire'), record: r('.record-bar'), hero: r('.hero'),
    h1fs: getComputedStyle(document.querySelector('.hero h1')).fontSize,
    recordVisible: document.querySelector('.record-bar').getBoundingClientRect().bottom <= window.innerHeight,
    wireVisible: document.querySelector('.wire').getBoundingClientRect().bottom <= window.innerHeight
  };
}
"""

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)

    # ---- A. console / network at 1440 ----
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    logs, failed, resp404 = [], [], []
    page.on("console", lambda m: logs.append({"type": m.type, "text": m.text, "loc": (m.location or {}).get("url", "")}))
    page.on("pageerror", lambda e: logs.append({"type": "pageerror", "text": str(e), "loc": ""}))
    page.on("requestfailed", lambda r: failed.append({"url": r.url, "err": r.failure}))
    page.on("response", lambda r: resp404.append({"url": r.url, "status": r.status}) if r.status >= 400 else None)
    page.goto(URL, wait_until="load")
    page.wait_for_timeout(9500)   # past DURATION 6600 + START 900
    out["console"] = logs
    out["requestfailed"] = failed
    out["bad_responses"] = resp404
    out["final_animations"] = page.evaluate("() => document.getAnimations().map(a => ({name: a.animationName || a.transitionProperty, state: a.playState}))")
    out["fit_1440x900"] = page.evaluate(FIT_JS)
    page.screenshot(path=REVIEW + "hero-1440x900.png", clip={"x": 0, "y": 0, "width": 1440, "height": 900})
    page.screenshot(path=REVIEW + "wire-1440.png", clip=page.evaluate("() => { const b = document.querySelector('.wire').getBoundingClientRect(); return {x: 0, y: b.top + scrollY, width: 1440, height: b.height}; }"))
    page.screenshot(path=REVIEW + "full-1440.png", full_page=True)

    # ---- B. overflow at widths ----
    over = {}
    for w, h in [(360, 780), (390, 844), (768, 900), (1024, 800), (1440, 900), (1920, 1080)]:
        pg = ctx.new_page()
        pg.set_viewport_size({"width": w, "height": h})
        pg.goto(URL, wait_until="load")
        pg.wait_for_timeout(700)
        over[str(w)] = pg.evaluate(OVERFLOW_JS)
        if w == 390:
            pg.screenshot(path=REVIEW + "full-390.png", full_page=True)
            pg.screenshot(path=REVIEW + "hero-390.png", clip={"x": 0, "y": 0, "width": 390, "height": 844})
            # expand a record row on mobile, screenshot that region
            pg.evaluate("() => document.getElementById('records').scrollIntoView()")
            pg.wait_for_timeout(300)
            pg.locator(".disclose").nth(0).click()
            pg.wait_for_timeout(300)
            rec = pg.locator("#records").bounding_box()
            if rec:
                pg.screenshot(path=REVIEW + "mobile-record-expanded.png", clip={"x": 0, "y": max(0, rec["y"]), "width": 390, "height": min(700, rec["height"])}, full_page=False)
            over[str(w) + "_row_expanded"] = pg.evaluate(OVERFLOW_JS)
        if w == 1920:
            pg.screenshot(path=REVIEW + "hero-1920.png", clip={"x": 0, "y": 0, "width": 1920, "height": 1080})
        if w == 768:
            pg.screenshot(path=REVIEW + "hero-768.png", clip={"x": 0, "y": 0, "width": 768, "height": 900})
        pg.close()
    out["overflow"] = over

    # ---- C. fit at 1366x768 ----
    pg = ctx.new_page()
    pg.set_viewport_size({"width": 1366, "height": 768})
    pg.goto(URL, wait_until="load")
    pg.wait_for_timeout(7500)
    out["fit_1366x768"] = pg.evaluate(FIT_JS)
    pg.screenshot(path=REVIEW + "hero-1366x768.png", clip={"x": 0, "y": 0, "width": 1366, "height": 768})
    pg.close()

    # ---- D. behaviour at 1440 ----
    bctx = browser.new_context(viewport={"width": 1440, "height": 900}, permissions=["clipboard-read", "clipboard-write"])
    pg = bctx.new_page()
    pg.goto(URL, wait_until="load")
    pg.wait_for_timeout(800)

    # D1 copy: hero button
    hero_btn = pg.locator(".actions .btn--primary").first
    hero_btn.click()
    pg.wait_for_timeout(250)
    out["copy_hero"] = pg.evaluate("""() => {
      const b = document.querySelector('.actions .btn--primary');
      const s = document.getElementById('status');
      let clip = null;
      return {label: b.querySelector('.btn__label').textContent, copied: b.dataset.copied,
              status: s.textContent, statusClass: s.className, statusRole: s.getAttribute('role'),
              statusLive: s.getAttribute('aria-live'),
              statusOpacity: getComputedStyle(s).opacity, statusRect: s.getBoundingClientRect().bottom};
    }""")
    try:
        out["copy_hero"]["clipboard"] = pg.evaluate("() => navigator.clipboard.readText()")
    except Exception as e:
        out["copy_hero"]["clipboard"] = "ERR " + str(e)[:120]
    pg.wait_for_timeout(1900)
    out["copy_hero_after_1600ms"] = pg.evaluate("() => ({label: document.querySelector('.actions .btn--primary .btn__label').textContent, status: document.getElementById('status').textContent, cls: document.getElementById('status').className})")

    # D2 copy: install small button
    install_btn = pg.locator(".step .btn").first
    install_btn.click()
    pg.wait_for_timeout(200)
    out["copy_install"] = pg.evaluate("""() => {
      const b = document.querySelector('.step .btn');
      return {label: b.querySelector('.btn__label').textContent, copied: b.dataset.copied,
              status: document.getElementById('status').textContent};
    }""")
    pg.wait_for_timeout(1800)

    # D3 disclosure
    pg.evaluate("() => document.getElementById('records').scrollIntoView({block:'center'})")
    pg.wait_for_timeout(200)
    d0 = pg.locator(".disclose").nth(0)
    d0.click()
    pg.wait_for_timeout(200)
    out["disclose_open"] = pg.evaluate("""() => {
      const b = document.querySelector('.disclose');
      const row = document.getElementById('detail-1');
      return {expanded: b.getAttribute('aria-expanded'), text: b.textContent, name: b.getAttribute('aria-label'),
              rowHidden: row.hidden, rowDisplay: getComputedStyle(row).display,
              rowHeight: row.getBoundingClientRect().height,
              rowText: row.textContent.replace(/\\s+/g,' ').trim().slice(0,80)};
    }""")
    d0.click()
    pg.wait_for_timeout(200)
    out["disclose_closed"] = pg.evaluate("""() => {
      const b = document.querySelector('.disclose');
      const row = document.getElementById('detail-1');
      return {expanded: b.getAttribute('aria-expanded'), text: b.textContent, name: b.getAttribute('aria-label'), rowHidden: row.hidden};
    }""")

    # D4 rail fills as you scroll
    pg.evaluate("() => window.scrollTo(0,0)")
    pg.wait_for_timeout(150)
    rail = {}
    pg.evaluate("() => document.getElementById('how').scrollIntoView({block:'start'})")
    pg.wait_for_timeout(400)
    rail["at_how_top"] = pg.evaluate("""() => ({
      fill: getComputedStyle(document.querySelector('.rail__fill')).transform,
      passed: document.querySelectorAll('.frame.is-passed').length,
      frames: document.querySelectorAll('.frame').length})""")
    pg.evaluate("() => window.scrollBy(0, window.innerHeight*1.5)")
    pg.wait_for_timeout(400)
    rail["scrolled_more"] = pg.evaluate("""() => ({
      fill: getComputedStyle(document.querySelector('.rail__fill')).transform,
      passed: document.querySelectorAll('.frame.is-passed').length})""")
    pg.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
    pg.wait_for_timeout(400)
    rail["at_bottom"] = pg.evaluate("""() => ({
      fill: getComputedStyle(document.querySelector('.rail__fill')).transform,
      passed: document.querySelectorAll('.frame.is-passed').length})""")
    out["rail"] = rail

    # D5 hero wire stops; canvas stable
    pg2 = bctx.new_page()
    pg2.goto(URL, wait_until="load")
    snaps = []
    for i in range(11):
        pg2.wait_for_timeout(1000)
        snaps.append(pg2.evaluate("() => document.getElementById('wire-canvas').toDataURL()"))
    out["canvas_changes"] = [i for i in range(1, len(snaps)) if snaps[i] != snaps[i - 1]]
    out["canvas_stable_after_s"] = None
    for i in range(len(snaps) - 1, 0, -1):
        if snaps[i] != snaps[i - 1]:
            out["canvas_stable_after_s"] = i
            break
    out["animations_late"] = pg2.evaluate("() => document.getAnimations().length")
    out["record_bar_lit"] = pg2.evaluate("() => ({lit: document.querySelectorAll('.record-bar span.is-lit').length, total: document.querySelectorAll('.record-bar span').length, opacities: Array.from(document.querySelectorAll('.record-bar span')).map(s => getComputedStyle(s).opacity)})")
    pg2.close()
    bctx.close()
    ctx.close()
    browser.close()

with open(REVIEW + "audit1.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=True, indent=1)[:12000])
