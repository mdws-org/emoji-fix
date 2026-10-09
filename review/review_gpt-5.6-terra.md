## High

1. **Open-shadow coverage can be disabled or break page code — `shadow-hook.js:4-9`.**  
   A page can save `Element.prototype.attachShadow` before this runs, later invoke that saved function on a connected host, or overwrite/freeze the prototype afterward. The extension then misses subsequently attached roots. Conversely, code that checks `Function.prototype.toString.call(Element.prototype.attachShadow)` for native code, compares function identity, or freezes the prototype can fail. The wrapper is trivially detectable; attempting to forge `toString()` would create further interference.  
   **Fix:** Treat this as an unavoidable compatibility cost of a MAIN-world hook, capture safe intrinsics early, preserve the original property descriptor, and make the wrapper minimal and failure-tolerant. Do not claim complete shadow-root coverage. Consider removing the hook if broad page compatibility matters more than late-root coverage.

2. **The page can spoof `emojifix-shadow` and force work — `emoji-fix.js:61-64`; `shadow-hook.js:8`.**  
   Any page can dispatch `emojifix-shadow` from a host with an open shadow root. For example, a hostile page can repeatedly create hosts containing large trees and dispatch the event, causing scans and observers. A page listener using the same event name can also collide with or suppress the notification. There is no privilege escalation or page-data exfiltration—the page already owns the nodes being scanned—but this creates a page-controlled CPU path.  
   **Fix:** Regard the event as untrusted: validate that the target is an `Element`, that its open root is actually connected/needed, and deduplicate/coalesce scans. Use a highly namespaced event name. A secret event name is not authentication because page code can inspect and emit it.

3. **Flags, keycaps, and some emoji-text symbols remain unfixed — `emoji-fix.js:7-10`.**  
   `\p{Extended_Pictographic}` does not match regional-indicator flags such as **🇺🇸**, keycap sequences such as **1️⃣**, or a standalone skin-tone modifier such as **🏽**. Thus no font family is added. Separately, **©️** and **®️** match the regex but `U+00A9` and `U+00AE` are absent from `RANGE`, so the declared face is not selected for them. Keycap bases (`#`, `*`, `0-9`) are also absent, preventing reliable sequence shaping even after detection is fixed.  
   **Fix:** Detect emoji sequences rather than only `Extended_Pictographic`: include regional indicators, emoji modifiers, and `[0-9#*]\uFE0F?\u20E3`. Add the missing copyright/registered-sign and keycap-base ranges, and test flags, keycaps, ZWJ sequences, tag flags, variation selectors, and modifiers against the actual converted font.

4. **Inline font stacks freeze page typography and lose to author `!important` — `emoji-fix.js:18-24`.**  
   On a theme switch, an element initially rendered as `font-family: Inter` may later receive an author class selecting `Georgia`; its inline extension declaration remains `"EmojiFixNoto", Inter`, overriding the intended theme. Conversely, `font-family: SomeFont !important` beats this inline normal-priority declaration, leaving emoji blank.  
   **Fix:** Do not permanently cache a computed stack as an inline declaration. Track extension-owned styling separately, observe relevant `class`/`style` mutations, and recalculate after temporarily removing the extension value. If using `!important`, do so deliberately and still restore/recompute when page styles change.

## Moderate

5. **Framework reuse can remove the fix permanently — `emoji-fix.js:18-24, 27-38`.**  
   React or a virtual list can reuse an already-fixed element, replace its `style` attribute, then replace its text node with emoji. The character-data observer calls `fix()`, but `done.has(el)` returns true, so the removed `font-family` is never restored. A page using `font-family: EmojiFixNotoSans` also incorrectly passes `stack.includes(FAMILY)`.  
   **Fix:** Do not use a permanent `WeakSet` as the sole applied-state check. Verify the extension’s exact declaration remains present; parse font-family values rather than substring matching; observe `class` and `style` changes.

6. **Several visible-content paths are unsupported — `emoji-fix.js:20, 46-53, 66-69, 71-76`.**  
   * Emoji in SVG `<text>` is explicitly skipped by `closest('svg, …')`.  
   * `::before`/`::after` content has no text node and is never inspected.  
   * An initial `<input value="😀">`, a programmatic `input.value = "😀"` without an `input` event, and some composition flows are missed.  
   * Replacing `document.body` disconnects the only light-DOM observer; the replacement body is not scanned.  
   * Closed shadow roots cannot be reached: `host.shadowRoot` is null even though the MAIN-world hook saw attachment.  
   **Fix:** Observe `document.documentElement` and reattach when the body changes; explicitly scan form controls initially and on relevant events; support SVG text if intended; document closed-root and pseudo-content limitations or add narrowly targeted handling for them.

7. **Opaque frames are not covered despite `all_frames` — `manifest.json:8-26`.**  
   A same-site `about:blank` or `srcdoc` iframe containing `😀` does not necessarily receive either content script merely because `all_frames` is true. This affects editors, embedded chats, and document previews.  
   **Fix:** Add `match_about_blank: true` and, where supported by the target Chromium baseline, `match_origin_as_fallback: true`; test `about:blank`, `srcdoc`, `data:`, and dynamically navigated frames.

8. **Large or fast-mutating pages can incur substantial layout and traversal work — `emoji-fix.js:22, 27-38, 46-53`.**  
   Adding a timeline card or chat subtree causes a full TreeWalker pass over that subtree. Bursty framework insertions can repeat this many times, while each emoji-bearing parent invokes `getComputedStyle`, potentially forcing style calculation. A hostile or merely busy X timeline can make this noticeable.  
   **Fix:** Batch mutation records to one animation frame or microtask, discard roots contained by another queued root, scan only text nodes plus necessary shadow hosts, and cap/defer work for detached or oversized subtrees.

## Security and packaging notes

9. **Every matching site can fingerprint the extension — `manifest.json:29-37`; `emoji-fix.js:12-15`.**  
   The page can read the injected style, learn the `chrome-extension://<extension-id>/…` URL, detect the named font, and detect the `attachShadow` replacement. The web-accessible font is not secret, and no page text is sent anywhere, so there is no direct data leak.  
   **Fix:** `"use_dynamic_url": true` is reasonable defense-in-depth against static URL probing, but it does not hide an extension that writes its live URL into the DOM. Narrow site matches if universal operation is not required.

10. **Strict policy compatibility needs testing — `emoji-fix.js:12-16, 23`.**  
    Pages enforcing `style-src` without inline styles can reject the inserted `<style>` and/or style attributes, depending on Chromium’s extension-injection path; Trusted Types does not protect or enable these DOM/CSS sinks.  
    **Fix:** Test strict `style-src` and Trusted Types pages explicitly; prefer a packaged manifest CSS resource or `chrome.scripting.insertCSS` where its permission/model is acceptable.

For Chrome Web Store submission, the manifest is syntactically sufficient, but `<all_urls>` content-script access is broad and should be justified in store disclosures. Add a tested `minimum_chrome_version` for `world: "MAIN"` and fallback matching behavior. Include the Noto Color Emoji license in the distributed source/package; do not add a public signing key merely to stabilize unpacked IDs.
