from playwright.sync_api import sync_playwright
URL="file:///D:/dev/dsh-opencode-acp/site/index.html"
with sync_playwright() as p:
    b=p.chromium.launch(channel="msedge", headless=True)
    pg=b.new_context(viewport={"width":768,"height":900}).new_page()
    pg.goto(URL, wait_until="load"); pg.wait_for_timeout(8500)
    pg.locator("#records").scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    pg.locator(".table-wrap").screenshot(path="records-768.png")
    pg.locator("#wire").screenshot(path="wire-768.png")
    pg.close()
    b.close()
print("ok")
