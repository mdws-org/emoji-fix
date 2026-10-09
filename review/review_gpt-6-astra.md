## Medium

1. **Several emoji never select the replacement font.** `emoji-fix.js:7–10,30–35,51`: standalone `🇺🇸`, `1️⃣`, and `🏽` do not match `Extended_Pictographic`. `©️` and `®️` match, but their bases, U+00A9/U+00AE, are outside `RANGE`. Keycaps additionally need `#`, `*`, and digits, currently excluded. Use sequence-aware detection covering flags, keycaps, modifiers and pictographs, with corresponding font coverage. Do not simply add ASCII bases to the globally preferred font: ordinary numbers could change appearance. Apply keycap handling specifically to those sequences, and preserve text-presentation requests.

2. **The permanent `done` marker makes styling stale and unrecoverable.** `emoji-fix.js:18–23,43`: render `<span>😀</span>`, then have React replace its inline style; subsequent text mutations cannot repair it. Changing a theme’s font also leaves the captured computed stack overriding the new font indefinitely. Replacing emoji with ordinary text never restores the original styling. Separately, `span { font-family: "Apple Color Emoji" !important }` defeats the normal inline declaration. Replace `done` with reconciled state tracking the original declaration and the extension’s applied value; restore when no longer needed, refresh underlying stacks when styling changes, and use an explicitly managed `important` override where necessary.

3. **Replacing the body disconnects coverage from the page.** `emoji-fix.js:71–76`: `document.body.replaceWith(newBody)` leaves observation attached to the discarded body; emoji subsequently inserted into `newBody` are untouched. Observe `document`, not only the initial body. The sole font stylesheet at lines 12–16 is similarly removable by head/document reconstruction: re-establish it, or register the font through `document.fonts` instead.

4. **Several rendering and editing surfaces are missed or damaged.**
   - `emoji-fix.js:51`: `host.attachShadow({mode:'open'}).textContent = '😀'` produces text whose `parentElement` is null. Apply the inherited font through the shadow host for direct-root text.
   - Lines 66–69: `<input value="😀">` is never initially checked; programmatic input/textarea `.value` changes emit no `input` event. Scan initial controls and provide an explicit refresh strategy for programmatic changes; MutationObserver cannot observe value-property changes.
   - Lines 20,48–52: SVG `<text>😀</text>` is explicitly excluded; `::before { content: "😀" }` and placeholders have no scanned text nodes. These need separate SVG/pseudo-element handling or documented exclusions.
   - Line 23: `<div contenteditable><p>😀</p></div>` gains inline font markup inside the editor’s serializable HTML. Avoid modifying rich-text document formatting; use editor-container styling or an opt-out.

5. **The MAIN-world wrapper changes native API behavior.** `shadow-hook.js:6–8`: an `init.mode` getter that returns `"open"` once and throws on its second invocation succeeds natively but throws through this wrapper **after attaching the root**. Read `root.mode`, not the input dictionary again. A replaced `queueMicrotask` can likewise make an otherwise successful attachment throw. Capture required intrinsics early and prevent notification failures from changing the native result.

   The wrapper is detectable through `Function.prototype.toString.call(...)` and other function characteristics; do not claim transparency or spoof native identity. Frozen prototypes can prevent installation; later replacements bypass it. Fail gracefully and retain scanning as fallback. Page getters/listeners can execute re-entrantly. Closed roots remain unsupported; do not force them open.

6. **Mutation bursts cause redundant scans and repeated style recalculation.** `emoji-fix.js:27–38,46–53,22–23`: append a populated chat container, then append inside it before observer delivery. Overlapping mutation records rescan the same descendants. Alternating computed-style reads and writes across thousands of emoji-bearing elements compounds the cost. Deduplicate queued subtree roots and target elements, prune script/style subtrees, perform reads before writes, and process bounded batches across frames. Keep shadow observation idempotent.

## Low / security boundaries

7. **Pages can detect and interfere, but no privileged execution or data-exfiltration path is evident.** `emoji-fix.js:61–64`: a page can dispatch `emojifix-shadow` on its own host; this only requests scanning an accessible root. The WeakSet limits repeated notifications. Check that the origin is an element with an open root, but do not treat the event as authenticated. The public event name can collide with page listeners.

   `manifest.json:29–37`: a known extension ID permits font-resource probing. `use_dynamic_url: true` is reasonable defense-in-depth, subject to testing URL resolution on supported browsers. It does not hide installation from pages already receiving the readable stylesheet, font-family mutations and hook.

8. **CSP is a compatibility question, not an established bypass vulnerability.** `emoji-fix.js:12–23`: X’s stated policy alone does not invalidate the reported successful test. Chromium’s extension-origin injection/loading behavior matters. Verify strict `style-src` and `font-src` cases on supported builds. These `style.textContent` and CSSStyleDeclaration operations are not TrustedHTML sinks. If DOM stylesheet loading is blocked, test isolated-world bundled-byte loading into `FontFace`/`document.fonts`; do not weaken site CSP.

## Manifest / release

9. **Frame coverage and release requirements need attention.** `manifest.json:6–27`: `all_frames` alone misses ordinary `about:blank`/`srcdoc` children. Add `match_about_blank` to both entries; consider `match_origin_as_fallback` for related opaque-origin frames. Declare a tested minimum Chromium version: MAIN declarations require 111; origin fallback requires 119.

   Broad content-script matching still grants broad page access despite no `permissions` array. No extra host permissions are needed here. Verify packaged icons/font, include the font’s OFL/copyright notices and applicable modified-font requirements, and supply an explicit source-code license. A later store submission needs accurate site-access justification and privacy disclosures; browser-internal pages remain unsupported.
