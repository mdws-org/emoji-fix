// Turns the extension off or on for the current tab's site, then reloads the
// tab, because fonts already set on the page stay until it loads again.
const PATTERN_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;

async function main() {
  const hostEl = document.getElementById('host');
  const stateEl = document.getElementById('state');
  const button = document.getElementById('toggle');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = null;
  try {
    const u = new URL(tab.url);
    if (u.protocol === 'http:' || u.protocol === 'https:') host = u.hostname;
  } catch (e) { /* no URL: a browser page the extension cannot read */ }

  if (!host || !PATTERN_HOST.test(host)) {
    hostEl.textContent = 'Emoji Fix';
    stateEl.textContent = 'Not available on this page.';
    return;
  }
  hostEl.textContent = host;

  const { disabledHosts = [] } = await chrome.storage.sync.get('disabledHosts');
  const off = disabledHosts.includes(host);
  stateEl.textContent = off ? 'Off on this site.' : 'On for this site.';
  button.textContent = off ? 'Turn on for this site' : 'Turn off for this site';
  button.hidden = false;

  button.addEventListener('click', async () => {
    button.disabled = true;
    const { disabledHosts: current = [] } = await chrome.storage.sync.get('disabledHosts');
    const next = off ? current.filter((h) => h !== host) : [...new Set([...current, host])];
    await chrome.storage.sync.set({ disabledHosts: next });
    // The service worker re-registers the scripts on the storage change; wait
    // for that before reloading, so the reload already uses the new list.
    await waitForRegistration(host, !off);
    await chrome.tabs.reload(tab.id);
    window.close();
  });
}

async function waitForRegistration(host, excluded) {
  const pattern = `*://${host}/*`;
  for (let i = 0; i < 20; i++) {
    const scripts = await chrome.scripting.getRegisteredContentScripts();
    if (scripts.length && scripts.every((s) => (s.excludeMatches || []).includes(pattern) === excluded)) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}

main();
