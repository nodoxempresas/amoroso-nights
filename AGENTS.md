# Amoroso Nights — Codex project guide

Landing page for **Amoroso Nights** (private bachelor-party nightlife routes in CDMX, Monterrey, Tijuana). Live at [amorosonights.com](https://amorosonights.com).

## Architecture

Static site on **GitHub Pages** (`main` branch deploys automatically). No build step, no bundler.

| Path | Role |
| --- | --- |
| `index.html` | Entire site: markup, CSS, and the React `<x-dc>` component |
| `assets/` | `dc-runtime.js` (renders `<x-dc>`) + `image-slot.js` |
| `vendor/` | React + ReactDOM pinned locally (no CDN at runtime) |
| `fonts/` | Self-hosted Instrument Sans + Newsreader (woff2) |
| `fotos/` | Original gallery photos (source; not served to visitors) |
| `img/` | Optimized gallery images the page loads (WebP + JPG) |
| `worker/` | Cloudflare Worker relaying the lead form to Telegram |
| `CNAME` | Custom domain for GitHub Pages |

## Local development

The page uses `fetch()` for assets — serve over HTTP, not `file://`:

```sh
python3 -m http.server 8777   # http://localhost:8777
```

## Editing conventions

- Keep changes minimal and focused. This is a single-file static site; avoid introducing build tooling unless explicitly requested.
- Gallery photos: drop originals in `fotos/`, optimize into `img/` (~880px, WebP + JPEG), add a `<picture>` block in the `#galeria` section of `index.html`.
- Language: site copy is in **Spanish**. Match existing tone and terminology.
- Do not commit secrets. The Telegram bot token lives as a Cloudflare Worker secret only.

## Lead form

The form at `#solicitar` POSTs to a Cloudflare Worker (`worker/`) that forwards submissions to Telegram.

- `Component.FORM_ENDPOINT` in `index.html` must point at the deployed Worker's `workers.dev` URL.
- Form field names must match `FIELDS` in `worker/src/index.js`.
- Worker setup and deployment: see `worker/README.md`.
- `ALLOWED_ORIGINS` in `worker/wrangler.toml` includes `http://localhost:8777` for local testing.

## Worker changes

From `worker/`:

```sh
npx wrangler deploy
npx wrangler tail    # live logs when debugging
```

Never put `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` in tracked files.

## Git

- Only commit when the user explicitly asks.
- Do not force-push to `main`.
