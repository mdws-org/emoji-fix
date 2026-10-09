# Review: Emoji Fix 1.2.0 (Chromium MV3 extension), round 1: security and bugs

You are reviewing a small Manifest V3 browser extension before it is published as open source. Answer as a senior browser-extension security engineer who also hunts correctness bugs. Be specific: name the file and line, give a concrete page or input that triggers each problem, and say what the fix is. No compliments; do not restate the code back to me. Rank findings by severity. Under 900 words.

Read nothing outside this message. Run nothing. Write nothing. Do not edit any files. Put your whole answer in your final message.

## What it is for

On some Macs, Chromium browsers (Brave, Brave Origin) draw characters from the system font "Apple Color Emoji" as blank space, while Safari draws them normally. The extension bundles Google's Noto Color Emoji (COLRv1, converted to WOFF2, 2.0 MB) and makes pages use it for emoji only. It must work on x.com, whose Content-Security-Policy is `font-src 'self' https://*.twimg.com data: ...` and whose chat UI is rendered inside an open shadow root. It works there in testing (emoji visible in chat, chat list and reaction picker).

## Mechanism

- `emoji-fix.js` (isolated world, document_start, all frames, all URLs): injects a `<style>` with an `@font-face` named EmojiFixNoto whose `src` is the extension URL of the font and whose `unicode-range` covers emoji code points. It walks text nodes; for each text node matching `\p{Extended_Pictographic}` it prepends `"EmojiFixNoto"` to the parent element's computed `font-family` via an inline style. A MutationObserver (childList, subtree, characterData) handles new content. It scans and observes open shadow roots.
- `shadow-hook.js` (MAIN world, document_start, all frames): wraps `Element.prototype.attachShadow`; for open roots it dispatches a bubbling, composed CustomEvent `emojifix-shadow` on the host after a microtask, so the isolated script can find the new shadow root.
- The extension declares no permissions and makes no network requests. The font is a web_accessible_resource matched to `<all_urls>`.

## Questions

1. **Security.** What can a hostile web page do to or through this extension? Consider: the MAIN-world prototype patch (detectability, interference with page code, `toString`, closed roots, re-entrancy, pages that freeze or replace prototypes), the CustomEvent channel (spoofing by the page, event name collisions), web_accessible_resources fingerprinting of the extension ID, injected `<style>` and inline styles under strict CSP or Trusted Types, and anything that leaks page data. Say whether `use_dynamic_url` or other manifest changes are warranted.
2. **Correctness.** Find emoji that stay blank or text that breaks. Consider: emoji that `\p{Extended_Pictographic}` does not match (regional-indicator flags, keycaps such as 1️⃣, skin-tone modifiers alone), `unicode-range` gaps versus the regex, `!important` page rules that beat the inline style, computed font stacks captured once and then frozen (later class or theme changes), elements reused by frameworks (React, virtual lists) whose text changes after `done` recorded them, contenteditable and input/textarea, iframes (about:blank, srcdoc), SVG `<text>`, `::before` content, and pages where `document.body` is replaced.
3. **Performance.** Cost on large or fast-mutating pages (X timeline, long chats): full TreeWalker scans per added subtree, `getComputedStyle` per element, observer volume. What would you change, keeping the behaviour?
4. **Manifest and packaging.** Anything wrong or missing in `manifest.json` for an unpacked open-source release, and for a possible later Chrome Web Store submission.

## Source


### manifest.json

```json
     1	{
     2	  "manifest_version": 3,
     3	  "name": "Emoji Fix",
     4	  "version": "1.2.0",
     5	  "description": "Draws emoji with a bundled Noto Color Emoji font on Macs where Chromium browsers draw Apple Color Emoji blank.",
     6	  "content_scripts": [
     7	    {
     8	      "matches": [
     9	        "<all_urls>"
    10	      ],
    11	      "js": [
    12	        "shadow-hook.js"
    13	      ],
    14	      "run_at": "document_start",
    15	      "all_frames": true,
    16	      "world": "MAIN"
    17	    },
    18	    {
    19	      "matches": [
    20	        "<all_urls>"
    21	      ],
    22	      "js": [
    23	        "emoji-fix.js"
    24	      ],
    25	      "run_at": "document_start",
    26	      "all_frames": true
    27	    }
    28	  ],
    29	  "web_accessible_resources": [
    30	    {
    31	      "resources": [
    32	        "fonts/NotoColorEmoji.woff2"
    33	      ],
    34	      "matches": [
    35	        "<all_urls>"
    36	      ]
    37	    }
    38	  ],
    39	  "icons": {
    40	    "16": "icons/icon-16.png",
    41	    "32": "icons/icon-32.png",
    42	    "48": "icons/icon-48.png",
    43	    "128": "icons/icon-128.png"
    44	  }
    45	}
```

### emoji-fix.js

```js
     1	// Prepends a bundled emoji font to the font stack of every element whose own
     2	// text contains emoji. The font is restricted to emoji code points, so other
     3	// text keeps the page's fonts. Open shadow roots are scanned and observed too
     4	// (X's chat UI lives in one); shadow-hook.js reports roots attached later.
     5	(() => {
     6	  const FAMILY = 'EmojiFixNoto';
     7	  const RANGE = 'U+203C, U+2049, U+2122, U+2139, U+2194-21AA, U+231A-23FF, U+24C2, ' +
     8	    'U+25AA-25FE, U+2600-27BF, U+2934-2935, U+2B05-2B55, U+3030, U+303D, U+3297, U+3299, ' +
     9	    'U+200D, U+20E3, U+FE0F, U+1F000-1FAFF, U+E0020-E007F';
    10	  const EMOJI = /\p{Extended_Pictographic}/u;
    11	
    12	  const style = document.createElement('style');
    13	  style.textContent = `@font-face { font-family: "${FAMILY}"; ` +
    14	    `src: url("${chrome.runtime.getURL('fonts/NotoColorEmoji.woff2')}") format("woff2"); ` +
    15	    `unicode-range: ${RANGE}; font-display: swap; }`;
    16	  (document.head || document.documentElement).appendChild(style);
    17	
    18	  const done = new WeakSet();
    19	  function fix(el) {
    20	    if (!el || done.has(el) || el.closest('svg, script, style')) return;
    21	    done.add(el);
    22	    const stack = getComputedStyle(el).fontFamily;
    23	    if (!stack.includes(FAMILY)) el.style.setProperty('font-family', `"${FAMILY}", ${stack}`);
    24	  }
    25	
    26	  const observed = new WeakSet();
    27	  const observer = new MutationObserver((records) => {
    28	    for (const r of records) {
    29	      if (r.type === 'characterData') {
    30	        if (EMOJI.test(r.target.nodeValue)) fix(r.target.parentElement);
    31	        continue;
    32	      }
    33	      for (const n of r.addedNodes) {
    34	        if (n.nodeType === Node.TEXT_NODE) {
    35	          if (EMOJI.test(n.nodeValue)) fix(n.parentElement);
    36	        } else if (n.nodeType === Node.ELEMENT_NODE) scan(n);
    37	      }
    38	    }
    39	  });
    40	  function observe(root) {
    41	    if (observed.has(root)) return;
    42	    observed.add(root);
    43	    observer.observe(root, { childList: true, subtree: true, characterData: true });
    44	  }
    45	
    46	  function scan(root) {
    47	    if (root.shadowRoot) watchShadow(root.shadowRoot);
    48	    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    49	    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    50	      if (n.nodeType === Node.TEXT_NODE) {
    51	        if (EMOJI.test(n.nodeValue)) fix(n.parentElement);
    52	      } else if (n.shadowRoot) watchShadow(n.shadowRoot);
    53	    }
    54	  }
    55	  function watchShadow(shadow) {
    56	    if (observed.has(shadow)) return;
    57	    observe(shadow);
    58	    scan(shadow);
    59	  }
    60	
    61	  document.addEventListener('emojifix-shadow', (e) => {
    62	    const host = e.composedPath()[0];
    63	    if (host && host.shadowRoot) watchShadow(host.shadowRoot);
    64	  }, true);
    65	
    66	  document.addEventListener('input', (e) => {
    67	    const t = e.composedPath()[0];
    68	    if ((t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && EMOJI.test(t.value)) fix(t);
    69	  }, true);
    70	
    71	  function start() {
    72	    observe(document.body);
    73	    scan(document.body);
    74	  }
    75	  if (document.body) start();
    76	  else document.addEventListener('DOMContentLoaded', start, { once: true });
    77	})();
```

### shadow-hook.js

```js
     1	// Runs in the page's own JavaScript world. Announces every open shadow root as
     2	// it is attached so the content script can scan and observe it.
     3	(() => {
     4	  const attach = Element.prototype.attachShadow;
     5	  Element.prototype.attachShadow = function (init) {
     6	    const root = attach.call(this, init);
     7	    if (init && init.mode === 'open') {
     8	      queueMicrotask(() => this.dispatchEvent(new CustomEvent('emojifix-shadow', { bubbles: true, composed: true })));
     9	    }
    10	    return root;
    11	  };
    12	})();
```
