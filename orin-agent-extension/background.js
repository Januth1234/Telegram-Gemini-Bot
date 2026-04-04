/**
 * Orin AI Agent — Background Service Worker
 * Receives commands from orinai.org via chrome.runtime.onMessageExternal
 * Executes: navigate, click, type, screenshot, scroll, find-element
 */

const ALLOWED_ORIGINS = [
  'https://orinai.org',
  'https://www.orinai.org',
  'http://localhost:5173',
  'http://localhost:3000',
];

let agentTabId = null; // the tab the agent is controlling

chrome.runtime.onMessageExternal.addListener(async (message, sender, sendResponse) => {
  if (!ALLOWED_ORIGINS.includes(sender.origin)) {
    sendResponse({ error: 'Unauthorized origin: ' + sender.origin });
    return true;
  }

  const { action, data } = message;

  try {
    switch (action) {
      case 'ping':
        sendResponse({ ok: true, version: '1.0.0' });
        break;

      case 'navigate': {
        const tab = await getOrCreateAgentTab(data.url);
        agentTabId = tab.id;
        await waitForTabLoad(agentTabId);
        sendResponse({ ok: true, tabId: agentTabId, url: tab.url });
        break;
      }

      case 'screenshot': {
        if (!agentTabId) {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          agentTabId = tab?.id;
        }
        if (!agentTabId) { sendResponse({ error: 'No active tab' }); break; }
        await chrome.tabs.update(agentTabId, { active: true });
        await new Promise(r => setTimeout(r, 300)); // let tab render
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        const base64 = dataUrl.replace('data:image/png;base64,', '');
        sendResponse({ ok: true, screenshot: base64, mimeType: 'image/png' });
        break;
      }

      case 'click': {
        if (!agentTabId) { sendResponse({ error: 'No agent tab' }); break; }
        const result = await chrome.scripting.executeScript({
          target: { tabId: agentTabId },
          func: findAndClick,
          args: [data.selector, data.text, data.x, data.y],
        });
        sendResponse({ ok: true, result: result[0]?.result });
        break;
      }

      case 'type': {
        if (!agentTabId) { sendResponse({ error: 'No agent tab' }); break; }
        const result = await chrome.scripting.executeScript({
          target: { tabId: agentTabId },
          func: findAndType,
          args: [data.selector, data.text, data.value],
        });
        sendResponse({ ok: true, result: result[0]?.result });
        break;
      }

      case 'scroll': {
        if (!agentTabId) { sendResponse({ error: 'No agent tab' }); break; }
        await chrome.scripting.executeScript({
          target: { tabId: agentTabId },
          func: (x, y) => window.scrollBy(x, y),
          args: [data.x || 0, data.y || 300],
        });
        sendResponse({ ok: true });
        break;
      }

      case 'get-page-content': {
        if (!agentTabId) { sendResponse({ error: 'No agent tab' }); break; }
        const result = await chrome.scripting.executeScript({
          target: { tabId: agentTabId },
          func: () => ({
            title: document.title,
            url: location.href,
            text: document.body?.innerText?.slice(0, 3000) || '',
            links: Array.from(document.querySelectorAll('a[href]'))
              .slice(0, 20)
              .map(a => ({ text: a.textContent?.trim(), href: a.href })),
            inputs: Array.from(document.querySelectorAll('input,textarea,select'))
              .slice(0, 15)
              .map(el => ({ type: el.type, name: el.name, placeholder: el.placeholder, id: el.id })),
            buttons: Array.from(document.querySelectorAll('button,[role=button]'))
              .slice(0, 15)
              .map(el => el.textContent?.trim()),
          }),
        });
        sendResponse({ ok: true, content: result[0]?.result });
        break;
      }

      case 'press-key': {
        if (!agentTabId) { sendResponse({ error: 'No agent tab' }); break; }
        await chrome.scripting.executeScript({
          target: { tabId: agentTabId },
          func: (key) => {
            const el = document.activeElement || document.body;
            el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
          },
          args: [data.key],
        });
        sendResponse({ ok: true });
        break;
      }

      case 'set-agent-tab': {
        agentTabId = data.tabId;
        sendResponse({ ok: true });
        break;
      }

      case 'get-agent-tab': {
        sendResponse({ ok: true, tabId: agentTabId });
        break;
      }

      default:
        sendResponse({ error: 'Unknown action: ' + action });
    }
  } catch (e) {
    console.error('[Orin Agent]', action, e);
    sendResponse({ error: e.message || String(e) });
  }
  return true; // keep channel open for async
});

// ── Helpers injected into pages ───────────────────────────────────────────────

function findAndClick(selector, text, x, y) {
  // Try CSS selector first
  if (selector) {
    const el = document.querySelector(selector);
    if (el) { el.click(); return 'clicked-selector:' + selector; }
  }
  // Try finding by text content
  if (text) {
    const all = document.querySelectorAll('button,a,[role=button],[role=link],input[type=submit],input[type=button]');
    const lower = text.toLowerCase();
    for (const el of all) {
      if (el.textContent?.toLowerCase().includes(lower) || el.value?.toLowerCase().includes(lower)) {
        el.click();
        return 'clicked-text:' + text;
      }
    }
    // Try aria-label
    const labeled = document.querySelector(`[aria-label*="${text}" i]`);
    if (labeled) { labeled.click(); return 'clicked-aria:' + text; }
  }
  // Coordinate click
  if (x !== undefined && y !== undefined) {
    const el = document.elementFromPoint(x, y);
    if (el) { el.click(); return 'clicked-coord:' + x + ',' + y; }
  }
  return 'not-found';
}

function findAndType(selector, fieldHint, value) {
  let el = null;
  if (selector) el = document.querySelector(selector);
  if (!el && fieldHint) {
    const hint = fieldHint.toLowerCase();
    // Try placeholder
    el = document.querySelector(`input[placeholder*="${fieldHint}" i],textarea[placeholder*="${fieldHint}" i]`);
    if (!el) el = document.querySelector(`input[name*="${hint}"],textarea[name*="${hint}"]`);
    if (!el) el = document.querySelector(`input[id*="${hint}"],textarea[id*="${hint}"]`);
    // Try label association
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      if (label.textContent?.toLowerCase().includes(hint)) {
        const forEl = document.getElementById(label.htmlFor);
        if (forEl) { el = forEl; break; }
      }
    }
    // Fallback to first visible input
    if (!el) {
      el = document.querySelector('input:not([type=hidden]):not([type=submit]):not([type=button]),textarea');
    }
  }
  if (el) {
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return 'typed-into:' + (el.id || el.name || el.placeholder || selector);
  }
  return 'field-not-found';
}

async function getOrCreateAgentTab(url) {
  if (agentTabId) {
    try {
      await chrome.tabs.update(agentTabId, { url, active: true });
      return chrome.tabs.get(agentTabId);
    } catch { agentTabId = null; }
  }
  return chrome.tabs.create({ url, active: true });
}

function waitForTabLoad(tabId, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(), timeout); // resolve anyway after timeout
    chrome.tabs.onUpdated.addListener(function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 500); // extra 500ms for JS to settle
      }
    });
  });
}

// Notification when extension is activated
chrome.runtime.onInstalled.addListener(() => {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.png',
    title: 'Orin AI Agent Ready',
    message: 'Go to orinai.org → Agent Mode to start automating browser tasks.',
  });
});
