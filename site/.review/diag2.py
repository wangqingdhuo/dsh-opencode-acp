import json
from playwright.sync_api import sync_playwright
URL="file:///D:/dev/dsh-opencode-acp/site/index.html"
out={}
with sync_playwright() as p:
    b=p.chromium.launch(channel="msedge", headless=True)
    for w in (360,390,641,700,768,800,1024,1440):
        pg=b.new_context(viewport={"width":w,"height":900}).new_page()
        pg.goto(URL, wait_until="load"); pg.wait_for_timeout(300)
        out[w]=pg.evaluate("""() => {
          const se=document.scrollingElement;
          window.scrollTo(99999,0);
          const x=window.scrollX;
          window.scrollTo(0,0);
          const t=document.querySelector('.table-wrap');
          return {scrollWidth:se.scrollWidth, clientWidth:se.clientWidth, realScrollX:x,
                  wrapRight:+t.getBoundingClientRect().right.toFixed(1), wrapSW:t.scrollWidth, wrapCW:t.clientWidth,
                  bodySW:document.body.scrollWidth, htmlSW:document.documentElement.scrollWidth};
        }""")
        pg.close()
    b.close()
print(json.dumps(out, indent=1))
