import json
from playwright.sync_api import sync_playwright
URL="file:///D:/dev/dsh-opencode-acp/site/index.html"
out={}
with sync_playwright() as p:
    b=p.chromium.launch(channel="msedge", headless=True)
    for w in (641,700,720,750,768,780,800,820,840,900):
        pg=b.new_context(viewport={"width":w,"height":900}).new_page()
        pg.goto(URL, wait_until="load"); pg.wait_for_timeout(250)
        out[w]=pg.evaluate("() => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})")
        pg.close()
    # isolate cause at 768
    ctx=b.new_context(viewport={"width":768,"height":900}); pg=ctx.new_page()
    pg.goto(URL, wait_until="load"); pg.wait_for_timeout(300)
    out["table_wrap_hidden"]=pg.evaluate("""() => { document.querySelector('.table-wrap').style.display='none';
        return document.documentElement.scrollWidth; }""")
    pg.reload(); pg.wait_for_timeout(300)
    out["table_only_overflow_hidden"]=pg.evaluate("""() => { const t=document.querySelector('.table-wrap'); t.style.overflow='hidden';
        return {sw: document.documentElement.scrollWidth, wrapSW: t.scrollWidth, wrapCW: t.clientWidth}; }""")
    pg.reload(); pg.wait_for_timeout(300)
    out["wrap_right"]=pg.evaluate("""() => { const t=document.querySelector('.table-wrap').getBoundingClientRect();
        const s=document.querySelector('#records').getBoundingClientRect();
        return {wrapRight:+t.right.toFixed(2), sectionRight:+s.right.toFixed(2), wrapW:+t.width.toFixed(2), sw:document.documentElement.scrollWidth}; }""")
    # wire: label center vs boundary x, and canvas box
    pg.set_viewport_size({"width":1440,"height":900}); pg.wait_for_timeout(400)
    out["wire_geometry"]=pg.evaluate("""() => {
      const lab=document.querySelector('.wire__boundary').getBoundingClientRect();
      const cv=document.getElementById('wire-canvas').getBoundingClientRect();
      return {labelCenter:+((lab.left+lab.right)/2).toFixed(1), labelLeft:+lab.left.toFixed(1), labelRight:+lab.right.toFixed(1),
              canvasLeft:+cv.left.toFixed(1), canvasWidth:+cv.width.toFixed(1),
              edgeX:+((cv.left + Math.round(cv.width*0.42))).toFixed(1),
              dshRight:+document.querySelector('.wire__head > span').getBoundingClientRect().right.toFixed(1),
              rightLabelLeft:+document.querySelector('.wire__head > span:last-child').getBoundingClientRect().left.toFixed(1)}; }""")
    # copy status re-announcement: same text twice
    out["status_dom"]=pg.evaluate("() => document.getElementById('status').textContent")
    ctx.close(); b.close()
print(json.dumps(out, indent=1))
