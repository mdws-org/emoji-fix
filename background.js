// Registers the content scripts on every site except the ones the user turned
// the extension off for, and the frames of anti-bot challenges. Those frames
// check that built-in functions are unmodified, and shadow-hook.js replaces
// Element.prototype.attachShadow, so a challenge would fail (Cloudflare
// Turnstile shows "Verification failed"). They never show emoji.
const ALWAYS_EXCLUDED = [
  '*://challenges.cloudflare.com/*',
  '*://*.hcaptcha.com/*',
  '*://www.google.com/recaptcha/*',
  '*://www.recaptcha.net/recaptcha/*',
  '*://*.arkoselabs.com/*',
];

const SCRIPTS = [
  { id: 'shadow-hook', js: ['shadow-hook.js'], world: 'MAIN' },
  { id: 'emoji-fix', js: ['emoji-fix.js'] },
].map((s) => ({
  ...s,
  matches: ['<all_urls>'],
  runAt: 'document_start',
  allFrames: true,
  matchOriginAsFallback: true,
}));

// Hosts are stored as URL.hostname values. Only plain DNS names and IPv4
// addresses can be written as a match pattern; one invalid pattern would make
// the whole registration fail.
const PATTERN_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;

async function disabledHosts() {
  const { disabledHosts: hosts = [] } = await chrome.storage.sync.get('disabledHosts');
  return hosts.filter((h) => PATTERN_HOST.test(h));
}

async function register() {
  const hosts = await disabledHosts();
  await chrome.scripting.unregisterContentScripts();
  const exclude = [...ALWAYS_EXCLUDED, ...hosts.map((h) => `*://${h}/*`)];
  try {
    await chrome.scripting.registerContentScripts(SCRIPTS.map((s) => ({ ...s, excludeMatches: exclude })));
  } catch (e) {
    console.error('Emoji Fix: registering with the per-site list failed, registering without it', e);
    await chrome.scripting.unregisterContentScripts();
    await chrome.scripting.registerContentScripts(SCRIPTS.map((s) => ({ ...s, excludeMatches: ALWAYS_EXCLUDED })));
  }
}

// Registrations run one at a time, so that two quick toggles cannot interleave
// an unregister with a register and collide on the script IDs.
let queue = Promise.resolve();
function reregister() {
  queue = queue.then(register, register);
  return queue;
}

function hostOf(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname : null;
  } catch (e) {
    return null;
  }
}

async function updateBadge(tabId, url, hosts) {
  const off = hosts.includes(hostOf(url));
  await chrome.action.setBadgeText({ tabId, text: off ? 'off' : '' });
}

async function updateAllBadges() {
  const hosts = await disabledHosts();
  for (const tab of await chrome.tabs.query({})) {
    if (tab.url) updateBadge(tab.id, tab.url, hosts).catch(() => {});
  }
}

chrome.action.setBadgeBackgroundColor({ color: '#5f6368' });

chrome.runtime.onInstalled.addListener(() => {
  reregister();
  updateAllBadges();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes.disabledHosts) return;
  reregister();
  updateAllBadges();
});

// A navigation, including a reload, clears a tab's badge. A reload reports no
// new URL, so the badge is also set again on each status change.
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!info.url && !info.status) return;
  if (tab.url) updateBadge(tabId, tab.url, await disabledHosts()).catch(() => {});
});
