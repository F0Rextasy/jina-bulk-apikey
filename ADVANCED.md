# Advanced usage (escape hatches)

Everything below is **optional**. The normal path is one command:

```bash
npm start                 # menu → "1) Mint keys" → how many keys
# or non-interactive:
node src/cli.js --count 5
```

The CLI solves the panel's captcha by itself (`--auto`, the default) through the
bundled `src/solver.js`, pinned to the same exit that spends the token.

## Run your own solver instead

`--auto` is skipped the moment you supply your own token source, so an existing
solver keeps working unchanged. The flags are intentionally **not** in `--help`:

| Flag | What it does |
| --- | --- |
| `--token <tok>[,<tok>…]` | use captured token(s) verbatim (one is spent per panel call) |
| `--token-cmd "<cmd>"` | run a command that prints one fresh token on stdout (once per call) |
| `--manual` | print the widget URL and paste the token by hand (attended runs only) |

Environment variables mirror the flags (prefix `JINA_`), which is handy on a
headless/server box where no desktop browser can open.

## The embedded solver

- `src/solver.js` drives a real, **headed** Chrome (headless is refused by the
  Turnstile widget: measured 0/N, while the offscreen window solves).
- It needs `puppeteer-core`: run `npm install` once in the repo root.
- Chrome is auto-detected; set `CHROME_PATH` (or `PUPPETEER_EXECUTABLE_PATH`) if
  it lives somewhere unusual, or install it: `winget install --id Google.Chrome`.
- Each account's pinned exit (`--pool`) is handed to the solver, so the token is
  solved and spent through the same IP. Without a pool it runs DIRECT.

## Terms

Automating account creation may violate the provider's terms of service. You are
responsible for how you use this tool; keep the cadence human and the per-IP
account count low.
