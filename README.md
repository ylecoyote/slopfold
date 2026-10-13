# Slopfold

Slopfold is a Chrome extension that folds AI-slop posts out of your LinkedIn feed. Each post is rated by
[Jev](https://openrouter.ai/typesafe/jev-router) (an OpenRouter model). If Jev says it's slop
with more than 80% confidence, the post collapses to a one-line bar. Hover **Show anyway** to
preview the text, click it to unfold.

> Not affiliated with, endorsed by, or sponsored by LinkedIn. Read **Risks** before using.

## How it works

```
LinkedIn tab ──content.js──▶ background.js ──HTTP──▶ shim.py (127.0.0.1:8765) ──▶ OpenRouter (Jev)
```

The extension never holds your API key. A tiny local Python server (`shim.py`, stdlib only)
holds it and makes the OpenRouter call.

## Setup

1. Get an [OpenRouter API key](https://openrouter.ai/keys).
2. Start the shim and leave it running:
   ```bash
   OPENROUTER_API_KEY=sk-or-... python3 shim.py
   ```
   It prints one line per post it checks: `SLOP 0.94 '...'` or `ok   0.82 '...'`.
3. In Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick this folder.
4. Open your LinkedIn feed and scroll.

After editing any file, click ↻ on the extension in `chrome://extensions` and refresh LinkedIn.

## Settings

| What | Where | Default |
|---|---|---|
| Fold threshold | `SLOP_THRESHOLD` in `fold.js` | `0.8` (folds when confidence is strictly above) |
| Shortest post checked | `MIN_CHARS` in `content.js` | `40` characters |
| Parallel requests | `MAX_INFLIGHT` in `content.js` | `3` |
| Shim port | `SLOP_SHIM_PORT` env var (also update `background.js` and `manifest.json`) | `8765` |
| Model | `JEV_MODEL` env var | `typesafe/jev-router` |
| What counts as slop | `ASK` prompt in `shim.py` | generic, formulaic, engagement-bait posts |

Each unique post is checked once per tab, so scrolling back up does not re-bill or flip a verdict.

## Troubleshooting

- **Nothing folds, shim prints nothing:** LinkedIn changed its markup. Update `POST_SELECTORS` /
  `TEXT_SELECTORS` at the top of `content.js`. As of 2026-10 the feed uses hashed class names, so
  prefer stable attributes (`role`, `componentkey`, `data-testid`).
- **Nothing folds, shim prints `ERR ...`:** the OpenRouter call failed. The message says why
  (missing key, no credit, timeout).
- **Shim prints verdicts but nothing folds:** no post scored above the threshold. Lower it, or
  check the console (filter `slopfold`).
- **Console full of `chrome-extension://invalid/ net::ERR_FAILED`:** that's LinkedIn probing for
  installed extensions, not this one. Filter it out with `-chrome-extension`.
- **Ads and promoted posts get folded:** the prompt treats marketing copy as slop. Edit `ASK` in
  `shim.py` if you want them visible.

## Risks

- **LinkedIn's terms.** The [User Agreement](https://www.linkedin.com/legal/user-agreement) §8.2
  prohibits browser plugins that "scrape or copy" the Services, and copying content without the
  owner's consent. This extension reads post text from your own feed and sends it to a third party
  for classification. Whether that counts is LinkedIn's call, and LinkedIn actively scans for
  extensions. Use at your own risk to your account.
- **Privacy.** The text of every post you scroll past (other people's writing) is sent to
  OpenRouter and the model provider behind Jev.
- **Cost.** One OpenRouter call per unique post. A fresh feed load is roughly 50–60 calls.
- **Accuracy.** Jev's confidence is self-reported and uncalibrated. Expect some false folds;
  that's what **Show anyway** is for.

## Development

```bash
node check.js   # fold threshold + one-call-per-unique-post checks
```

## License

MIT, see [LICENSE](LICENSE).
