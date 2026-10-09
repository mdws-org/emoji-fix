## High

**1. `@font-face` never registers on strict-CSP sites; the `<style>` node is page-removable.** `emoji-fix.js:12-16` injects a DOM `<style>` element. Page `style-src` without `'unsafe-inline'` blocks it, so on strict-CSP sites the extension silently does nothing. Worse, any page script can remove the node or define its own `@font-face { font-family: EmojiFixNoto; src: url(evil.woff2) }` with an overlapping `unicode-range` and hijack every "fixed" element. Fix: inject via `chrome.scripting.insertCSS` (`origin: 'AUTHOR'`) — immune to page CSP and DOM tampering. Cost: `"permissions": ["scripting"]`, `host_permissions: ["<all_urls>"]`, and a service worker.

**2. `unicode-range` breaks keycap sequences and misses ©/®.** `RANGE` (lines 7-9) lacks the keycap bases `U+0023, U+002A, U+0030-0039`. In "1️⃣" the digit gets the page font while `FE0F`/`20E3` get Noto, so the sequence splits across two font runs and the keycap glyph never forms — you get "1" plus a dangling combining box. © and ® are `Extended_Pictographic` (they trigger `fix`) but are outside `RANGE`, so they stay blank — exactly the bug being fixed. Add `U+23, U+2A, U+30-39, U+A9, U+AE`.

**3. `\p{Extended_Pictographic}` misses flags and bare modifiers.** Line 10: regional indicators `U+1F1E6-1F1FF` are `Emoji=Yes` but `Extended_Pictographic=No`. A message containing only "🇩🇪🇫🇷" fails the test and stays blank; same for standalone skin-tone modifiers (`U+1F3FB-1F3FF`, `Emoji_Modifier`). Use `/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\p{Emoji_Modifier}]/u`.

**4. `done` freezes a stale, cascade-overriding font stack.** Lines 18-24: `getComputedStyle` captures the stack once; the inline style then wins over every later class/theme change for the element's lifetime. Concrete trigger: X toggles a `font-family`-changing class on a tweet element (or React reuses a row with different typography) — the fixed element keeps the old stack forever, and new emoji in it are never re-fixed (`done.has(el)` early-returns). Fix: drop `done`, store the captured stack in a `WeakMap`, and on each call re-read computed style, strip the prior `"EmojiFixNoto",` prefix from the inline value, and rewrite if the stack changed.

**5. Observer is rooted at `document.body`.** Lines 71-74: if a page replaces `document.body` or you need coverage of `<head>`/pre-body mutations, the observer dies or never saw them. Observe `document.documentElement` instead — it also covers shadow hosts that land in `<head>`.

## Medium

**6. The MAIN-world hook is detectable three ways.** `shadow-hook.js`: `Element.prototype.attachShadow.toString()` returns the wrapper source, not `[native code]`; a page can pass `attachShadow` an `init` object with a `mode` getter and count the second read (yours, line 7); the `queueMicrotask`/`dispatchEvent` pair is observable through a patched `dispatchEvent`. A `toString` shim plus reading `init.mode` before the native call narrows it, but accept residual detectability — `"EmojiFixNoto"` in computed styles already fingerprints the install.

**7. The `emojifix-shadow` event is spoofable.** `emoji-fix.js:61-64`: any page can dispatch a composed CustomEvent on a chosen host and force `watchShadow`/`scan` on attacker-picked subtrees — amplification of the scan cost in finding 9. `isTrusted` can't distinguish it from your own synthetic event; debounce `watchShadow` calls instead. Name collision risk is real but benign.

**8. Stable web-accessible resource URL fingerprints the extension ID.** `manifest.json:29-38`: any site can `fetch('chrome-extension://<id>/fonts/NotoColorEmoji.woff2')`. Add `"use_dynamic_url": true` (and set `minimum_chrome_version` accordingly). The `chrome-extension:` scheme keeps the CSP bypass you rely on for x.com.

**9. Perf: unfiltered scans and `characterData` volume.** Every added subtree gets a full `TreeWalker` including `<script>`/`<style>` text; every text mutation fires the callback. On an infinite-scroll timeline this is O(total mutations). Cheap wins, same behaviour: bail early with `EMOJI.test(n.textContent)` before walking a subtree; filter out script/style subtrees in the walker; batch the `getComputedStyle` calls (line 22 forces a style recalc each) behind one `requestAnimationFrame` per mutation batch.

## Low

- **Inputs/textareas** (`emoji-fix.js:66-69`): only fixed on `input` events — pre-filled `value`s and `placeholder` emoji are never handled. Scan `value`/`placeholder` in `scan()`.
- **SVG**: line 20's `closest('svg, …')` drops emoji in SVG `<text>` even though `font-family` applies there; narrow the guard to `script, style`.
- **Pseudo-elements**: `::before`/`::marker` emoji inherit the element's font, but an element containing *only* pseudo-generated emoji has no matching text node, so it's never fixed.
- **Line 16**: appending `<style>` to `<html>` before `<head>` exists leaves it in a bogus position — works, but append to `head` once available.
- **Inherent gaps to document**: closed shadow roots, `data:`/`javascript:` documents, `document.title`, OS-rendered tooltips.

## Manifest

Add `"minimum_chrome_version": "111"` (`world: "MAIN"` floor; higher if `use_dynamic_url` is adopted). For a Web Store submission the listing is otherwise fine: broad `<all_urls>` is justifiable, no permissions needed today — note that the `insertCSS` fix adds `scripting` + host permissions, which reviewers will ask you to justify. Ship the Noto OFL `LICENSE` file alongside the font for the open-source release, plus `homepage_url`. `world` is Chromium-only, which matches your stated target.
