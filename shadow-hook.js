// Runs in the page's own JavaScript world. Announces every open shadow root as
// it is attached so the content script can scan and observe it. The native
// result is returned unchanged even if the announcement fails.
(() => {
  const attach = Element.prototype.attachShadow;
  if (typeof attach !== 'function') return;
  const defer = queueMicrotask.bind(globalThis);
  const dispatch = EventTarget.prototype.dispatchEvent;
  const Custom = CustomEvent;
  try {
    Element.prototype.attachShadow = function attachShadow(init) {
      const root = attach.call(this, init);
      if (root.mode === 'open') {
        const host = this;
        try {
          defer(() => {
            try {
              dispatch.call(host, new Custom('emoji-fix:shadow-attached', { bubbles: true, composed: true }));
            } catch (e) { /* the page's own listeners threw; the root is still attached */ }
          });
        } catch (e) { /* announcing is best effort */ }
      }
      return root;
    };
  } catch (e) { /* a frozen prototype: shadow roots are then found by scanning only */ }
})();
