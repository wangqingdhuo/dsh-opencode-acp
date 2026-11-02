# Site

Static landing page for `dsh-opencode-acp`. No build step, no CDN, no external
fonts or images — upload the folder as it is.

```
site/
├── index.html
├── site.css
├── site.js       (all copy lives in the I18N table at the top)
└── assets/mark.svg
```

The page ships in **Chinese by default**; the `中文 / EN` switch in the nav
remembers the choice in `localStorage`, and `?lang=en` (or `?lang=zh`) links
straight to one language.

## Host it

Any static server works. From this folder:

```sh
python -m http.server 8080     # http://127.0.0.1:8080
```

nginx, one location:

```nginx
location / {
  root /var/www/dsh-opencode-acp;
  try_files $uri $uri/ /index.html;
  add_header Cache-Control "public, max-age=300";
}
```

It also opens straight from `file://` — the copy buttons fall back to
`document.execCommand` when the clipboard API is unavailable.

## Edit

- **Copy (both languages)**: the `I18N` object at the top of `site.js`
  (`zh` and `en` tables must keep the same keys). Markup carries the Chinese
  fallback in `data-i18n` / `data-i18n-html` attributes, so the page still reads
  correctly before JavaScript runs.
- Colors, type, spacing: the `:root` block in `site.css` (two temperatures:
  `--wire` for the host half, `--signal` for the child process). Chinese type is
  tuned separately under `[lang="zh-Hans"]`.
- Motion: three blocks in `site.js` — the hero run (`M1`), the frame rail
  (`M2`), and the acknowledgment handlers (`M3`). Behaviour under
  `prefers-reduced-motion`, without JavaScript, and below 640px is CSS/static.

## Check before uploading

1. Open the page: it should be Chinese; the hero wire plays once and stops.
2. Press `EN`: every string flips (including the canvas labels and the table
   headers), and reloading keeps English.
3. Press `中文`: back to Chinese, no English left except product names and code.
4. Copy button: label becomes `已复制` / `Copied`, status line announces it.
5. A run row expands; the box turns `−`.
6. 390px: the canvas is replaced by the frame list, no horizontal overflow.
7. Reduce motion in the OS: final state immediately, no animation.
8. Disable JavaScript: Chinese content is fully visible, the switch is hidden,
   the static frame list stands in for the canvas.