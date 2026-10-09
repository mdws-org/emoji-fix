## High

**CSP can drop the font (emoji-fix.js:12–16).** A page with `style-src` nonce-only / no `unsafe-inline` blocks the injected `<style>`. A page with `font-src 'self'` (GitHub, many dashboards; X’s listed `font-src` has no `chrome-extension:`) can block the WAR URL. Isolated-world `fetch(chrome.runtime.getURL(...))` → `data:` (X already allows `data:`) or a constructed `CSSStyleSheet` on `adoptedStyleSheets` of `document` and each shadow root. Do not leave this on Chromium exempting WAR from CSP.

**React / `!important` wipe the inline stack (emoji-fix.js:18–23).** `fix` snapshots `getComputedStyle` once, writes `font-family` without `important`, and never revisits (`done`). Trigger: X-style virtual list reuse; or `el.style.fontFamily = 'TwitterChirp'` / a stylesheet `font-family: … !important` after first paint → emoji blank, leftover stack on the recycled node. Write with `'important'`, or stop per-text inline styles (below).

**Keycaps stay blank (emoji-fix.js:10 vs 7–9).** `1️⃣#⃣*⃣0⃣–9⃣` is `U+0030–0039` / `U+0023` / `U+002A` + `U+FE0F` + `U+20E3`. None of those are `\p{Extended_Pictographic}`, and RANGE omits the bases. Same for `©` `®` (`U+00A9`/`U+00AE`) — regex can match, RANGE does not, so Apple Color Emoji still paints. Extend both the regex (or `/[\p{Extended_Pictographic}\u20E3\uFE0F]/u` plus keycap bases) and RANGE.

**`document.body` replace (emoji-fix.js:71–76).** Observer is on that body node only. `document.documentElement.replaceChild(newBody, oldBody)` (or equivalent SPA swap) leaves new content unobserved. Observe `document.documentElement` from `document_start`, not DCL on `body`.

## Medium

**`<input>`/`<textarea>` (emoji-fix.js:46–54, 66–69).** TreeWalker never sees `.value`. `<input value="😀">` at load, or `el.value = '😀'` with no `input` event, stays blank. Scan `input, textarea` values in `scan`; use `value` property on those nodes.

**`::before`/`::after`.** `content: '🔥'` on a button with no text node never calls `fix`. SVG `<text>🔥</text>` and HTML inside `<svg><foreignObject>` are skipped by `closest('svg, …')` (emoji-fix.js:20). Drop the `svg` exclusion or special-case `foreignObject`; for pseudos you cannot walk boxes — you need the family on the generating element or a document/shadow `@font-face` that overrides `Apple Color Emoji`.

**MAIN-world `attachShadow` wrap (shadow-hook.js:4–11).** After the native call, `init.mode` or `queueMicrotask`/`CustomEvent` can throw so the page loses the return. `Function.prototype.toString` is not `[native code]`; bot checks that assert native `attachShadow` fail. Wrap only the announce in `try/catch`. Closed roots and post-hoc prototype freeze/replace just miss announce (no extra privilege).

**CustomEvent is unauthenticated (emoji-fix.js:61–64, shadow-hook.js:8).** Page `host.dispatchEvent(new CustomEvent('emojifix-shadow',{bubbles:true,composed:true}))` runs `watchShadow`. `isTrusted` is false for your own event too, so it cannot authenticate. Harm is extra scans; `observed` caps repeat work. Name the event with a random suffix shared via a `data-*` on `documentElement` set from isolated before the hook runs, or ignore spoof if you drop the channel (CSS path).

**WAR fingerprint (manifest.json:29–37, emoji-fix.js:14).** `<all_urls>` WAR plus the URL in a page-visible stylesheet: any origin reads the `<style>` and knows the install. `use_dynamic_url: true` is still warranted (blocks `chrome-extension://<stable-id>/fonts/NotoColorEmoji.woff2` probes) but does not hide the ID in that CSS. No extra leak of page data; no extra permissions.

## Performance (keep behavior)

X timeline / long chat: one `MutationObserver` with `subtree`+`characterData` on `body` and every open shadow; every added subtree is a full TreeWalker; every hit calls `getComputedStyle` (style flush). Coalesce records to one rAF; drop `characterData` unless the parent is `contenteditable`; skip `getComputedStyle` if `el.style.fontFamily` already contains `EmojiFixNoto`. Better same behavior: `FontFace` + `@font-face { font-family: "Apple Color Emoji"; src: …; unicode-range }` adopted into `document` and each open shadow, then delete the text walk, `done`, and MAIN hook.

## Manifest / pack

Add `use_dynamic_url: true`, `match_about_blank` + `match_origin_as_fallback` (srcdoc / `about:blank` editors), `minimum_chrome_version` for COLRv1 WOFF2 (~98), and do not match `file://` unless you need it. No `action` / host permissions is fine; CWS will still grill `<all_urls>` + MAIN prototype patch. Bundle the Noto OFL. Omit `key`. CWS: declare no data collection.
