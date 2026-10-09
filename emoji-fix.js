// Prepends a bundled emoji font to the font stack of every element whose own
// text contains emoji. The font is restricted to emoji code points, so other
// text keeps the page's fonts. Open shadow roots are scanned and observed too
// (X's chat UI lives in one); shadow-hook.js reports roots attached later.
(() => {
  const FAMILY = 'EmojiFixNoto';
  const KEYCAP_FAMILY = 'EmojiFixNotoKeycap';
  const RANGE = 'U+A9, U+AE, U+203C, U+2049, U+2122, U+2139, U+2194-21AA, U+231A-23FF, U+24C2, ' +
    'U+25AA-25FE, U+2600-27BF, U+2934-2935, U+2B05-2B55, U+3030, U+303D, U+3297, U+3299, ' +
    'U+200D, U+20E3, U+FE0F, U+1F000-1FAFF, U+E0020-E007F';
  // Keycap bases get the bundled font only in elements that contain a keycap,
  // so ordinary digits elsewhere keep the page's font.
  const KEYCAP_RANGE = 'U+23, U+2A, U+30-39, U+FE0F, U+20E3';
  // Characters that default to emoji presentation (this includes flags and skin
  // tones), text-default pictographs followed by U+FE0F, and keycaps. Plain
  // text symbols such as the trademark sign or a check mark are left alone.
  const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F|[#*0-9]\uFE0F?\u20E3/u;
  const KEYCAP = /[#*0-9]\uFE0F?\u20E3/u;

  const fontUrl = chrome.runtime.getURL('fonts/NotoColorEmoji.woff2');
  const face = (family, range) => `@font-face { font-family: "${family}"; ` +
    `src: url("${fontUrl}") format("woff2"); unicode-range: ${range}; font-display: swap; }`;
  const style = document.createElement('style');
  style.textContent = face(FAMILY, RANGE) + '\n' + face(KEYCAP_FAMILY, KEYCAP_RANGE);
  function ensureStyle() {
    if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
  }
  ensureStyle();

  // Rich-text editors serialize the inline styles of their content, so inside
  // one the font goes on the editing host instead of on the edited markup.
  function target(textNode) {
    let el = textNode.parentElement || (textNode.parentNode && textNode.parentNode.host);
    if (!el || el.closest('script, style')) return null;
    if (el.isContentEditable) {
      while (el.parentElement && el.parentElement.isContentEditable) el = el.parentElement;
    }
    return el;
  }

  // Elements to fix are collected first and styled once per animation frame,
  // so that all computed-style reads happen before any style writes.
  const pending = new Map();
  let scheduled = false;
  function queue(el, keycap) {
    if (!el) return;
    pending.set(el, pending.get(el) || keycap);
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(flush);
    }
  }
  function flush() {
    scheduled = false;
    ensureStyle();
    const work = [];
    for (const [el, keycap] of pending) {
      if (!el.isConnected) continue;
      const inline = el.style.getPropertyValue('font-family');
      if (inline.includes(FAMILY) && (!keycap || inline.includes(KEYCAP_FAMILY))) continue;
      const stack = getComputedStyle(el).fontFamily
        .replace(new RegExp(`"?${KEYCAP_FAMILY}"?,\\s*`, 'g'), '')
        .replace(new RegExp(`"?${FAMILY}"?,\\s*`, 'g'), '');
      const prefix = keycap ? `"${FAMILY}", "${KEYCAP_FAMILY}"` : `"${FAMILY}"`;
      work.push([el, `${prefix}, ${stack}`]);
    }
    pending.clear();
    for (const [el, value] of work) el.style.setProperty('font-family', value, 'important');
  }

  function check(textNode) {
    const text = textNode.nodeValue;
    if (EMOJI.test(text)) queue(target(textNode), KEYCAP.test(text));
  }
  function checkControl(el) {
    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && EMOJI.test(el.value)) {
      queue(el, KEYCAP.test(el.value));
    }
  }

  const observed = new WeakSet();
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') {
        check(r.target);
        continue;
      }
      for (const n of r.addedNodes) {
        if (n.nodeType === Node.TEXT_NODE) check(n);
        else if (n.nodeType === Node.ELEMENT_NODE) scan(n);
      }
    }
  });
  function observe(root) {
    if (observed.has(root)) return;
    observed.add(root);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  }

  function scan(root) {
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (root.matches('script, style')) return;
      if (root.shadowRoot) watchShadow(root.shadowRoot);
      checkControl(root);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeType === Node.ELEMENT_NODE && (n.tagName === 'SCRIPT' || n.tagName === 'STYLE'))
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === Node.TEXT_NODE) check(n);
      else {
        if (n.shadowRoot) watchShadow(n.shadowRoot);
        checkControl(n);
      }
    }
  }
  function watchShadow(shadow) {
    if (observed.has(shadow)) return;
    observe(shadow);
    scan(shadow);
  }

  document.addEventListener('emoji-fix:shadow-attached', (e) => {
    const host = e.composedPath()[0];
    if (host instanceof Element && host.shadowRoot) watchShadow(host.shadowRoot);
  }, true);

  document.addEventListener('input', (e) => checkControl(e.composedPath()[0]), true);

  // Observing the document element (not the body) survives body replacement.
  function start() {
    observe(document.documentElement);
    scan(document.documentElement);
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
