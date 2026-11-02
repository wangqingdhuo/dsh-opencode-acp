# Site

Static landing page for `dsh-opencode-acp`. No build step, no CDN, no external
fonts or images — upload the folder as it is.

```
site/
├── index.html
├── site.css
├── site.js
└── assets/mark.svg
```

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

- Copy and links: `index.html` (the version string appears in the nav and footer).
- Colors, type, spacing: the `:root` block in `site.css` (two temperatures:
  `--wire` for the host half, `--signal` for the child process).
- Motion: three blocks in `site.js` — the hero run (`M1`), the frame rail
  (`M2`), and the acknowledgment handlers (`M3`). Behaviour under
  `prefers-reduced-motion` and below 640px is CSS/static.

## Check before uploading

1. Open the page; the hero wire should play once and stop.
2. Press the copy button; it should say “Copied” and a status line should appear.
3. Open a run row; the detail line should expand and the box change to `−`.
4. Resize to 390px: the canvas is replaced by the static frame list, nothing
   overflows horizontally.
5. With “reduce motion” enabled in the OS, the page should render its final
   state immediately, with no animation.
