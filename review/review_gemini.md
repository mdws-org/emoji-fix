### 1. Security (High Severity)

- **Prototype Pollution / DOM Cloaking Denial of Service (HIGH)**
  - **Location:** `shadow-hook.js:4-6`, `emoji-fix.js:12-16, 22, 62-63, 67`
  - **Trigger:** Web page runs `delete Element.prototype.attachShadow` or replaces `Element.prototype.attachShadow`, `document.createElement`, `document.addEventListener`, `getComputedStyle`, or `e.composedPath`.
  - **Problem:** `shadow-hook.js` reads `Element.prototype.attachShadow` at `document_start` without freezing or caching prototypes securely. Page scripts running prior or manipulating DOM prototypes can break extension execution or intercept custom events. In `emoji-fix.js`, untrusted page objects calling prototype methods (`e.composedPath()`, `getComputedStyle()`) can be hijacked via getter getters/proxy traps on `Event.prototype`.
  - **Fix:** Cache prototype methods in `shadow-hook.js` locally before page scripts load, or use `Object.defineProperty` with non-writable, non-configurable descriptors. In `emoji-fix.js`, invoke methods safely from prototype references saved inside the closure.

- **Web Accessible Resource Fingerprinting & Tracking (MEDIUM)**
  - **Location:** `manifest.json:29-37`
  - **Trigger:** Any website fetches `chrome-extension://<id>/fonts/NotoColorEmoji.woff2`.
  - **Problem:** Declaring `<all_urls>` under `web_accessible_resources` without `use_dynamic_url` allows any site to fingerprint the extension's presence and track the user across browsing sessions.
  - **Fix:** Set `"use_dynamic_url": true` in `web_accessible_resources` in `manifest.json`.

- **CSP Injection Bypass Failure (MEDIUM)**
  - **Location:** `emoji-fix.js:16`
  - **Trigger:** Pages with strict `style-src` CSP without `'unsafe-inline'` or using Trusted Types (e.g., Google services, strict GitHub/X CSP policies).
  - **Problem:** Appending an inline `<style>` element directly fails under strict CSP policies or sites requiring `TrustedHTML`.
  - **Fix:** Pass styles via `chrome.runtime.getURL` dynamic CSS injection or use Chrome extension `scripting.insertCSS` API.

- **CustomEvent Channel Spoofing (LOW)**
  - **Location:** `emoji-fix.js:61-64`
  - **Trigger:** Hostile web script dispatches a fake `emojifix-shadow` CustomEvent targeting arbitrary nodes.
  - **Problem:** Forces `emoji-fix.js` to run redundant `TreeWalker` operations over specified host subtrees, leading to CPU exhaustion.
  - **Fix:** Validate event provenance or use `WeakMap`/`Set` checks for legitimate shadow roots.

---

### 2. Correctness Bugs (High / Medium Severity)

- **Missing Emoji Sequences in Regex and Unicode Range (HIGH)**
  - **Location:** `emoji-fix.js:7-10`
  - **Trigger:** Regional Indicator flag sequences (e.g., 🇺🇸 `U+1F1FA U+1F1F8`), Keycaps (e.g., 1️⃣ `U+0031 U+FE0F U+20E3`), standalone skin tone modifiers (`U+1F3FB-1F3FF`).
  - **Problem:** `\p{Extended_Pictographic}` does not cover ASCII digits/symbols used in keycap sequences or Regional Indicator symbols (`U+1F1E6-1F1FF`). Keycap bases (e.g., `1`) won't trigger `fix()`, leaving keycap emoji broken or partially rendered. Furthermore, Regional Indicators are missing from `RANGE` (`U+1F1E6-1F1FF`).
  - **Fix:** Include `U+1F1E6-1F1FF` and ASCII keycap characters in both `RANGE` and `EMOJI` pattern (`/(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3)/u`).

- **Dynamic Content & Framework Re-render Truncation (HIGH)**
  - **Location:** `emoji-fix.js:18-24`
  - **Trigger:** Virtualized lists (React, Vue, Twitter/X timeline) re-using DOM elements where non-emoji text replaces emoji text, or element font-family updates dynamically via class toggle.
  - **Problem:** `done` `WeakSet` marks elements permanently on first scan. If a framework updates an element's text content or resets its class/inline styles, `fix()` will bail out early on `done.has(el)` and fail to re-apply `EmojiFixNoto`.
  - **Fix:** Do not use `done` `WeakSet` based on element identity alone. Track applied font stack state or check `el.style.fontFamily` directly.

- **Closed Shadow Root Evasion (MEDIUM)**
  - **Location:** `shadow-hook.js:7`
  - **Trigger:** Elements invoking `attachShadow({ mode: 'closed' })`.
  - **Problem:** `shadow-hook.js` explicitly checks `init.mode === 'open'`. Emoji inside closed shadow DOM roots will remain unfixed and blank.
  - **Fix:** Intercept and store references to closed shadow roots within `shadow-hook.js` or patch `attachShadow` to report all attached roots regardless of mode.

- **Frame & Document Re-initialization Failures (MEDIUM)**
  - **Location:** `emoji-fix.js:71-76`
  - **Trigger:** SPA page navigation replacing `document.body` or dynamic `<iframe>` loading `about:blank`/`srcdoc`.
  - **Problem:** `start()` only runs once on initial DOM load and observes `document.body`. If `document.body` is completely replaced by SPA routing frameworks, mutations on the new body are lost.
  - **Fix:** Observe `document.documentElement` instead of `document.body`.

- **Inline Style Specificity Override (`!important`) (LOW)**
  - **Location:** `emoji-fix.js:23`
  - **Trigger:** CSS rule with `font-family: ... !important;`.
  - **Problem:** `el.style.setProperty('font-family', ...)` without `'important'` priority is overridden by page stylesheet rules carrying `!important`.
  - **Fix:** Use `el.style.setProperty('font-family', `"${FAMILY}", ${stack}`, 'important')`.

---

### 3. Performance (Medium Severity)

- **Unrestricted TreeWalker and Redundant `getComputedStyle` Calls (HIGH)**
  - **Location:** `emoji-fix.js:22, 48-54`
  - **Trigger:** Fast-mutating timelines (X/Twitter, Discord web) adding large subtrees.
  - **Problem:** `scan()` runs a `TreeWalker` over every added element node. Calling `getComputedStyle(el)` forces a synchronous layout/reflow recalculation for every node containing an emoji. In large subtrees, this causes main-thread jank and frame drops.
  - **Fix:** Batch DOM reads/writes or apply a class/attribute selector style instead of invoking `getComputedStyle` per element.

---

### 4. Manifest and Packaging (Low Severity)

- **Missing Store / Chrome MV3 Requirements (LOW)**
  - **Location:** `manifest.json:1-45`
  - **Problem:** 
    1. Missing `author` field for Chrome Web Store package validation.
    2. Large uncompressed font asset binary (`2.0 MB`) increases extension bundle size; consider optimizing subsetting if store limits apply.
  - **Fix:** Add required packaging fields to `manifest.json` prior to CWS submission.
