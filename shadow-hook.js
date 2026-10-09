// Runs in the page's own JavaScript world. Announces every open shadow root as
// it is attached so the content script can scan and observe it.
(() => {
  const attach = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) {
    const root = attach.call(this, init);
    if (init && init.mode === 'open') {
      queueMicrotask(() => this.dispatchEvent(new CustomEvent('emojifix-shadow', { bubbles: true, composed: true })));
    }
    return root;
  };
})();
