# Astrodynamics — "Ask Claude" proxy (Cloudflare Worker)

A ~130-line Worker that holds your Anthropic API key and forwards streaming
requests to the Messages API. The static app talks only to this Worker, so the
key never ships in the browser bundle. This is the Phase-1 spike backend.

## What it does

- Accepts `POST { system, messages, preset }` from the app, CORS-locked to your site.
- Maps `preset` to a model + effort from its own allowlist (`PRESETS` in
  `src/index.ts`: Sonnet 5.5 medium (default), Sonnet 5.5 high, Opus 5.5
  medium), so the client can't request anything else. Output cap 10000 tokens.
- Refusal fallbacks on (`fallbacks: "default"`): a declined request is re-run
  on Anthropic's recommended fallback model inside the same call.
- Streams the Server-Sent-Events response straight back to the browser.
- **Does not log request or response bodies** — chart factors pass through.

## One-time setup

You need a (free) Cloudflare account and the Anthropic API key you already have.

```bash
cd worker
npm install
npx wrangler login                      # opens a browser to authorise
npx wrangler secret put ANTHROPIC_API_KEY   # paste the key when prompted (stored encrypted)
npx wrangler deploy
```

`wrangler deploy` prints the Worker URL, e.g.
`https://astro-ai.<your-subdomain>.workers.dev`.

Edit `wrangler.toml` → `ALLOWED_ORIGINS` so it lists the exact origin(s) the app
is served from (plus `http://localhost:8322` for local dev), then redeploy.

## Point the app at it

The Worker URL is committed in `.env` at the repo root
(`VITE_AI_WORKER_URL=…`), so every build includes it: local `npm run build`,
`npm run dev`, and the GitHub Actions deploy alike. It is not a secret (it is
in the shipped JavaScript anyway). Override it for one build with
`VITE_AI_WORKER_URL=… npm run build`, or locally with a gitignored `.env.local`.

With the URL empty, the app still builds; the Ask Claude panel just says it is
not available.

## Local development

```bash
cd worker
cp .dev.vars.example .dev.vars    # paste your key into .dev.vars (gitignored)
npx wrangler dev                  # serves on http://localhost:8787
```

Then run the app with `VITE_AI_WORKER_URL=http://localhost:8787 npm run dev`.

## Cost & safety notes (spike)

- Sonnet 5.5 is ~$2/$10 per million input/output tokens; a reading is a few
  cents. Set a **monthly spend cap** in the Anthropic console before sharing
  the URL — every call spends your credits.
- `ALLOWED_ORIGINS` is the only gate in this spike. Before exposing the URL
  beyond you and one trusted tester, add a shared passphrase check and
  rate-limiting (noted in the proposal as pre-remote-use work).
