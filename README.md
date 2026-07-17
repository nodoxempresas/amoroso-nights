# Amoroso Nights

Landing page for **Amoroso Nights** — private nightlife routes for bachelor
parties in CDMX, Monterrey and Tijuana. Live at
**[amorosonights.com](https://amorosonights.com)**.

Static site hosted on GitHub Pages (custom domain via `CNAME`), served straight
from `main` — every push to `main` deploys.

## Layout

```
index.html            The whole site: markup, styles, and the DC/React component.
assets/               dc-runtime.js (renders the <x-dc> component) + image-slot.js
vendor/               React + ReactDOM, pinned locally (no CDN at runtime)
fonts/                Self-hosted Instrument Sans + Newsreader (woff2)
fotos/                Original gallery photos (source; not what the page loads)
img/                  Optimized gallery images the page actually serves (WebP + JPG)
worker/               Cloudflare Worker that relays the lead form to Telegram
CNAME                 Custom domain for GitHub Pages
```

`index.html` was originally a self-extracting bundle (a ~920 KB base64 blob that
decoded itself on load). It's now plain static files, so the page renders
directly and changes show up as readable diffs.

## Working on it locally

The page uses `fetch()` for its assets, so open it over HTTP, not `file://`:

```sh
python3 -m http.server 8777    # then visit http://localhost:8777
```

## The gallery

Real photos are plain `<picture>` elements (WebP with a JPEG fallback,
lazy-loaded, sized to avoid layout shift). To add or replace one: drop the
original in `fotos/`, optimize it into `img/` (~880px, WebP + JPEG), and add a
`<picture>` block in the `#galeria` section of `index.html`. There's a comment
in that section marking where the two still-missing photos go.

## The lead form

The form at `#solicitar` POSTs to a Cloudflare Worker that forwards each
submission to Telegram. The bot token lives as a Worker secret, never in this
repo — the site is static, so anything in the page is public.

Setup and deployment are documented in **[worker/README.md](worker/README.md)**.

> The form's `FORM_ENDPOINT` in `index.html` must point at the deployed Worker's
> `workers.dev` URL. Until that's filled in, submissions fail — deploy the
> Worker first.
