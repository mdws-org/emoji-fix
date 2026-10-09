# Emoji Fix 1.2.0 - Review

## High

**1. `\p{Extended_Pictographic}` misses flags and keycaps entirely** — emoji-fix.js:10. Extended_Pictographic deliberately excludes regional indicators, so every country/subdivision flag ("🇩🇪", "🏴󠁧󠁢󠁳󠁣󠁴󠁿" — common in X names/bio) never matches: the parent element never gets the font, and the generous `RANGE` (which includes `U+20E3`, `U+E0020-E007F`) never helps because the gate is the regex, not the range. Same for keycaps: "1️⃣" is `1`+FE0F+20E3, and "1" is not EP. Trigger: any chat message containing only "🇩🇪" or "1️⃣" stays blank. Fix: test with an RGI-style pattern, e.g. `/\p{Extended_Pictographic}|\p{RGI_Emoji}|\p{Emoji}(?=\uFE0F?\u20E3)/u`, or segment with `Intl.Segmenter` and test clusters. Also note skin-tone modifiers (U+1F3FB-1F3FF) alone are not EP — fine when they follow a base (same text node, base matches), blank if a framework splits the cluster across nodes (React hydration streaming does this).

**2. Trusted Types kills the whole script at document_start** — emoji-fix.js:13. `style.textContent = "..."` on a `<style>` element is a TT sink. On any page with `require-trusted-types-for 'script'` (major sites already enforce this), the assignment throws, the whole IIFE dies, and no observer, no shadow watch, no font — silently. Fix: wrap in try/catch and fall back to `sheet.insertRule` via `style.sheet` after building an empty style, or create the `@font-face` with `new CSSStyleSheet()` adoption; keep the rest of the script alive in either case. Page CSP `style-src` without `'unsafe-inline'` may also drop the injected `<style>` on strict sites; the try/catch path above covers both.

**3. `attachShadow()` without an explicit `mode` is missed** — shadow-hook.js:7. Spec default for `mode` is `'open'`; the hook checks `init && init.mode === 'open'`, so `el.attachShadow()` and `el.attachShadow({})` — legal, open roots used by plenty of web components — are never announced and their emoji stay blank. Fix: `if (!init || init.mode !== 'closed')`.

## Medium

**4. `document.body` replacement kills the observer** — emoji-fix.js:71-76. SPAs and document.write-style pages (Turbo/Hotwire full-body swap, Salesforce login flow) replace `<body>` wholesale; `observer` is still observing the detached old body, and nothing ever calls `start()` again. Same class of bug for the style element: if `<head>` is replaced (document.open, LiveView), the `@font-face` is gone while every inline stack still names EmojiFixNoto → falls back, blanks return. Fix: observe `document.documentElement` and re-append the style if it becomes disconnected (guard against your own mutations).

**5. Extension fingerprinting** — shadow-hook.js:5 and manifest.json:29-37. The wrapper's `toString()` returns JS source, not `[native code]`; any page computes `Element.prototype.attachShadow.toString().includes('emojifix')`. Separately, `web_accessible_resources` matched to `<all_urls>` lets every page fetch `chrome-extension://<stable-id>/fonts/NotoColorEmoji.woff2` — a hard install signal. Fix: cover `toString` (define a getter returning the native string, and cover `Function.prototype.toString` corner if you care) and add `"use_dynamic_url": true` to the WAR entry — yes, it is warranted for a font loaded from page CSS; it rotates the URL per session.

**6. Frozen font stack fights the page's cascade** — emoji-fix.js:22-23. The computed family is captured once and baked into an inline style, which (a) beats later class/theme changes to `font-family` (dark-mode theme toggles on x.com change stacks — element keeps the old stack verbatim), and (b) goes stale when a framework reuses the element for a different component (virtual lists: the `done` WeakSet then also refuses to re-fix, and the stack now belongs to a different widget). Inline style with no `!important` also loses to page rules with `!important` (many sites set `font-family: ... !important` on prose containers). Fix: recompute per `characterData` hit regardless of `done` (drop the WeakSet on the fix path, keep it only as a cheap no-op check), and store `data-*` marker instead of relying on stack includes.

**7. Inputs/textareas with programmatic or initial values are never fixed** — emoji-fix.js:66-69. Input values are not text nodes; the TreeWalker never sees them. A draft reply restored into a textarea on page load stays blank until one keystroke fires `input`. Fix: during `scan`, also test `HTMLInputElement/HTMLTextAreaElement` values; also listen for `change` and the `value` property setter isn't needed — but do handle paste-without-input edge (rare).

## Low

**8. CustomEvent channel is spoofable and noisy** — emoji-fix.js:61. The page can dispatch `emojifix-shadow` on a host carrying a 50k-node open shadow root repeatedly to burn cycles (the `observed` WeakSet caps repeats, but each event costs `composedPath` + lookup), or simply learn the extension is installed. Name is also collision-prone with any other tooling. The fix shipped already — re-scan guard — is enough; just use a less guessable event name.

**9. Injected inline styles on `parentElement` of a text node inside contenteditable** are fine for caret (style attr doesn't move selection), but the fix applies to whatever node React/Lightning considers the unit — typography bleeds to adjacent non-emoji runs'fallback chain. Mitigation, not blocker: prefer fixing the deepest block-level ancestor rather than immediate parent.

## Performance

- emoji-fix.js:36: every added element gets a fresh full-subtree TreeWalker; X's infinite scroll creates hundreds of added subtrees/second, each walked O(n). Queue added roots, dedupe by ancestry, flush in an `rAF`/idle callback, walk once per topmost root.
- Line 22's synchronous `getComputedStyle` per record forces style resolution inside the mutation callback — layout thrash under chat-typing volume. Batch with the same queue; resolve in the flush.
- characterData on the whole document is heavy on long timelines; observers have no cost-based throttle. The queue already helps: a re-match of an element whose stack already contains `FAMILY` can then be skipped purely by string check.

## Manifest / packaging

- A merged second entry could keep `world` explicit — fine, but add `"minimum_chrome_version": "105"` (COLRv1 rendering; the `\p{EP}` class and `attachShadow` hook argue even older, COLRv1 is the floor).
- For CWS: `<all_urls>` on two content scripts with MAIN-world prototype patching will trigger "broad host permissions" justification; prepare that text. Everything else (icons, description length, version format) passes.
- Consider restricting content scripts to `http/https/file` rather than `<all_urls>` — no real extension function exists on `chrome://` pages, and `all_frames` on error pages is wasted injection cost.

**Biggest single fix: the regex (finding 1).** Everything else is robustness around a mechanism that demonstrably works on x.com.
