// Prepends a bundled emoji font to the font stack of every element whose own
// text contains emoji. The font is restricted to emoji code points, so other
// text keeps the page's fonts. Open shadow roots are scanned and observed too
// (X's chat UI lives in one); shadow-hook.js reports roots attached later.
(() => {
  const FAMILY = 'EmojiFixNoto';
  const RANGE = 'U+203C, U+2049, U+2122, U+2139, U+2194-21AA, U+231A-23FF, U+24C2, ' +
    'U+25AA-25FE, U+2600-27BF, U+2934-2935, U+2B05-2B55, U+3030, U+303D, U+3297, U+3299, ' +
    'U+200D, U+20E3, U+FE0F, U+1F000-1FAFF, U+E0020-E007F';
  const EMOJI = /\p{Extended_Pictographic}/u;

  const style = document.createElement('style');
  style.textContent = `@font-face { font-family: "${FAMILY}"; ` +
    `src: url("${chrome.runtime.getURL('fonts/NotoColorEmoji.woff2')}") format("woff2"); ` +
    `unicode-range: ${RANGE}; font-display: swap; }`;
  (document.head || document.documentElement).appendChild(style);

  const done = new WeakSet();
  function fix(el) {
    if (!el || done.has(el) || el.closest('svg, script, style')) return;
    done.add(el);
    const stack = getComputedStyle(el).fontFamily;
    if (!stack.includes(FAMILY)) el.style.setProperty('font-family', `"${FAMILY}", ${stack}`);
  }

  const observed = new WeakSet();
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') {
        if (EMOJI.test(r.target.nodeValue)) fix(r.target.parentElement);
        continue;
      }
      for (const n of r.addedNodes) {
        if (n.nodeType === Node.TEXT_NODE) {
          if (EMOJI.test(n.nodeValue)) fix(n.parentElement);
        } else if (n.nodeType === Node.ELEMENT_NODE) scan(n);
      }
    }
  });
  function observe(root) {
    if (observed.has(root)) return;
    observed.add(root);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  }

  function scan(root) {
    if (root.shadowRoot) watchShadow(root.shadowRoot);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === Node.TEXT_NODE) {
        if (EMOJI.test(n.nodeValue)) fix(n.parentElement);
      } else if (n.shadowRoot) watchShadow(n.shadowRoot);
    }
  }
  function watchShadow(shadow) {
    if (observed.has(shadow)) return;
    observe(shadow);
    scan(shadow);
  }

  document.addEventListener('emojifix-shadow', (e) => {
    const host = e.composedPath()[0];
    if (host && host.shadowRoot) watchShadow(host.shadowRoot);
  }, true);

  document.addEventListener('input', (e) => {
    const t = e.composedPath()[0];
    if ((t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && EMOJI.test(t.value)) fix(t);
  }, true);

  function start() {
    observe(document.body);
    scan(document.body);
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
