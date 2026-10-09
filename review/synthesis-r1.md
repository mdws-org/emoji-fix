# Round 1 synthesis: security and bugs (Emoji Fix 1.2.0 -> 1.3.0)

Brief: `brief-r1.md`. Seven seats, run 2026-10-09. Every defect below was reproduced or refuted in a clean Chromium 155 profile (Brave Origin Beta 1.98.52) with the extension loaded unpacked; `probes/regression.html` is the final check (14 of 15 cases pass on 1.3.0; the failure is a documented limit).

## Seats

| Seat | Route | Bytes |
|---|---|---|
| DeepSeek V4.1 Flash | ccx | 5517 |
| Gemini | agyx | 6497 |
| Kimi K3 high | Devin | 7024 |
| SWE-2 high | Devin | 5615 |
| GPT-6 Astra high | Devin | 6413 |
| Grok 4.6 high | Devin | 4648 |
| GPT-5.6 Terra (Codex) | ccx | 7801 |

## Verified defects, fixed in 1.3.0

| Defect | Seats | Evidence |
|---|---|---|
| Flags, keycaps and lone skin tones are not detected (`\p{Extended_Pictographic}` excludes them) | 7 of 7 | A flag-only element was left unfixed in the browser |
| Keycap bases (`#`, `*`, `0-9`) are outside `unicode-range`, so keycaps split across two fonts | 6 of 7 | Fixed with a second font family applied only to elements that contain a keycap; a digit beside a non-keycap emoji keeps the page font |
| Text-presentation symbols (trademark, heavy check mark, arrows, sun, small squares) were swapped to Noto emoji glyphs | 0 of 7 (found during probing) | These are `Extended_Pictographic`, in `RANGE`, and in Noto's cmap. Detection now requires emoji presentation, U+FE0F, or a keycap |
| `done` latch: a reused element whose style is reset is never fixed again | 7 of 7 | Fixed: state is read from the inline style on each check |
| Page `!important` rules beat the inline declaration | 6 of 7 | Fixed: the declaration is `!important` |
| Observer on `document.body` dies when the body is replaced | 6 of 7 | Fixed: observes `document.documentElement` and restores the `<style>` if it is removed |
| Initial `input` and `textarea` values are not checked | 5 of 7 | Fixed in the scan |
| SVG `<text>` is excluded | 5 of 7 | Fixed: only `script` and `style` are excluded |
| Text directly under a shadow root has no `parentElement` | 1 of 7 (Astra) | Fixed: the shadow host is styled |
| Inline font markup is written into `contenteditable` content and can be serialized by editors | 1 of 7 (Astra) | Fixed: the editing host is styled instead |
| `shadow-hook.js` re-reads `init.mode` after the native call and can throw after the root is attached | 4 of 7 | Fixed: reads `root.mode`, captures intrinsics early, isolates the announcement in try/catch |
| `about:blank` and `srcdoc` frames are not covered | 6 of 7 | `match_about_blank` and `match_origin_as_fallback` added; `srcdoc` now passes |
| Stable extension ID is probeable through the web-accessible font | 7 of 7 | `use_dynamic_url: true`; the font loads from a per-session URL |
| Per-record scans and computed-style reads on busy pages | 7 of 7 | Fixed: elements are queued and styled once per animation frame, reads before writes; `script`/`style` subtrees are skipped |

## Refuted

| Claim | Seats | Evidence |
|---|---|---|
| A strict `style-src` without `'unsafe-inline'` blocks the injected `<style>` | SWE-2, Gemini, Grok, Codex (as a risk) | Under `style-src 'self'` the `@font-face` applied and the font loaded |
| A `font-src` without `chrome-extension:` blocks the font | Grok | x.com's `font-src` has no `chrome-extension:` and the font loads there |
| Trusted Types makes `style.textContent` throw | K3 | Under `require-trusted-types-for 'script'` the font applied and loaded |
| `attachShadow()` with no mode creates an open root that is missed | K3 | `attachShadow()` throws; `mode` is required |
| `\p{Extended_Pictographic}` matches ASCII digits, `#` and `*` | DeepSeek | It does not |
| Copyright and registered signs are left blank because they are outside `RANGE` | SWE-2, Grok | As plain text they draw from a text font; U+A9 and U+AE were added to `RANGE` for the U+FE0F forms |

## Accepted, not fixed

- Detection of the extension by the page: the inline `font-family`, the readable `<style>` and the wrapped `attachShadow` all reveal it. `use_dynamic_url` removes only the stable-ID probe (all seats agree this is the residual).
- A page can dispatch the shadow event or declare its own `EmojiFixNoto` face. Both affect only the page's own rendering and cost; no page data leaves the page and the extension holds no permissions.
- The captured font stack goes stale if the page later changes that element's font (README limit).
- `about:blank` frames filled by the parent page's script, closed shadow roots, CSS `content`, and `<canvas>` (README limits).
