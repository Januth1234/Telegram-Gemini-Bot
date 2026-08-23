/**
 * Orin AI Agent Extension — Background Service Worker v2.0
 * Production-ready. Receives commands from orinai.org.
 * Full browser automation: navigate, click, type, screenshot, scroll, extract.
 */
'use strict';

const ALLOWED_ORIGINS = new Set([
  'https://orinai.org',
  'https://www.orinai.org',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
]);

// Exact-origin match. Prefix/startsWith checks are bypassable via lookalike
// domains (e.g. https://orinai.org.evil.com startsWith https://orinai.org).
function isAllowedOrigin(origin) {
  if (!origin) return false;
  try {
    return ALLOWED_ORIGINS.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

let agentTabId = null;

// ── External message handler ──────────────────────────────────────────────────
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!isAllowedOrigin(sender.origin)) {
    sendResponse({ error: 'Unauthorized: ' + sender.origin }); return true;
  }
  handleCommand(message).then(sendResponse).catch(e => sendResponse({ error: e.message }));
  return true; // async
});

// ── Internal message from content scripts ────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'content-ready' && sender.tab?.id === agentTabId) {
    // Content script loaded in agent tab — it's ready for commands
    console.log('[Orin] Agent tab content ready:', msg.url);
  }
});

async function handleCommand({ action, data = {} }) {
  switch (action) {

    case 'ping':
      return { ok: true, version: '2.0.0', agentTabId };

    case 'navigate': {
      const tab = agentTabId ? await safeUpdateTab(agentTabId, data.url) : null;
      if (!tab) {
        const newTab = await chrome.tabs.create({ url: data.url, active: true });
        agentTabId = newTab.id;
        await waitForLoad(agentTabId);
        return { ok: true, tabId: agentTabId };
      }
      agentTabId = tab.id;
      await waitForLoad(agentTabId);
      await delay(500);
      return { ok: true, tabId: agentTabId };
    }

    case 'open-new-tab': {
      // Open URL in a NEW tab without replacing the agent tab
      const t = await chrome.tabs.create({ url: data.url, active: data.focus !== false });
      await waitForLoad(t.id);
      return { ok: true, tabId: t.id };
    }

    case 'open-multiple-tabs': {
      // Open multiple URLs as tabs simultaneously
      const tabs = await Promise.all((data.urls || []).map(url =>
        chrome.tabs.create({ url, active: false })
      ));
      return { ok: true, tabIds: tabs.map(t => t.id) };
    }

    case 'screenshot': {
      const targetTab = data.tabId || agentTabId;
      if (!targetTab) return { error: 'No agent tab' };
      await chrome.tabs.update(targetTab, { active: true });
      await delay(400);
      const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
      return { ok: true, screenshot: dataUrl.replace('data:image/png;base64,', ''), mimeType: 'image/png' };
    }

    case 'click': {
      if (!agentTabId) return { error: 'No agent tab' };
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: agentTabId },
        func: clickElement,
        args: [data.selector, data.text, data.x, data.y],
      });
      await delay(300);
      return { ok: true, result: res?.result };
    }

    case 'type': {
      if (!agentTabId) return { error: 'No agent tab' };
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: agentTabId },
        func: typeIntoField,
        args: [data.selector, data.fieldHint, data.value],
      });
      await delay(300);
      return { ok: true, result: res?.result };
    }

    case 'scroll': {
      if (!agentTabId) return { error: 'No agent tab' };
      await chrome.scripting.executeScript({
        target: { tabId: agentTabId },
        func: (x, y) => window.scrollBy({ left: x, top: y, behavior: 'smooth' }),
        args: [data.x || 0, data.y || 500],
      });
      await delay(600);
      return { ok: true };
    }

    case 'press-key': {
      if (!agentTabId) return { error: 'No agent tab' };
      await chrome.scripting.executeScript({
        target: { tabId: agentTabId },
        func: (key) => {
          const el = document.activeElement || document.body;
          ['keydown','keypress','keyup'].forEach(t =>
            el.dispatchEvent(new KeyboardEvent(t, { key, code: key, bubbles: true }))
          );
        },
        args: [data.key],
      });
      await delay(300);
      return { ok: true };
    }

    case 'get-page-content': {
      const tid = data.tabId || agentTabId;
      if (!tid) return { error: 'No agent tab' };
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: tid },
        func: extractPageContent,
        args: [data.maxText || 4000],
      });
      return { ok: true, content: res?.result };
    }

    case 'extract-deals': {
      // Specialized: extract product/deal listings from current page
      const tid = data.tabId || agentTabId;
      if (!tid) return { error: 'No agent tab' };
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: tid },
        func: extractDeals,
        args: [data.query || ''],
      });
      return { ok: true, deals: res?.result };
    }

    case 'find-links-matching': {
      // Find all links matching a pattern (for opening deal pages)
      const tid = data.tabId || agentTabId;
      if (!tid) return { error: 'No agent tab' };
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: tid },
        func: findMatchingLinks,
        args: [data.pattern, data.limit || 10],
      });
      return { ok: true, links: res?.result };
    }

    case 'highlight': {
      if (!agentTabId) return { ok: true };
      chrome.scripting.executeScript({
        target: { tabId: agentTabId },
        func: (sel) => {
          const el = sel ? document.querySelector(sel) : null;
          if (!el) return;
          const old = document.getElementById('__orin_hl__');
          if (old) old.remove();
          const r = el.getBoundingClientRect();
          const d = document.createElement('div');
          d.id = '__orin_hl__';
          d.style.cssText = `position:fixed;left:${r.left-2}px;top:${r.top-2}px;width:${r.width+4}px;height:${r.height+4}px;border:2px solid #6366f1;border-radius:4px;background:rgba(99,102,241,.15);pointer-events:none;z-index:2147483647;transition:all .2s`;
          document.body.appendChild(d);
          setTimeout(() => d.remove(), 2000);
        },
        args: [data.selector],
      }).catch(() => {});
      return { ok: true };
    }

    case 'banner': {
      if (!agentTabId) return { ok: true };
      chrome.scripting.executeScript({
        target: { tabId: agentTabId },
        func: (text, type) => {
          const old = document.getElementById('__orin_banner__');
          if (old) old.remove();
          const d = document.createElement('div');
          d.id = '__orin_banner__';
          const bg = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1';
          d.style.cssText = `position:fixed;top:12px;right:12px;z-index:2147483647;background:${bg};color:#fff;padding:8px 14px;border-radius:10px;font:700 12px/-apple-system,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.3);display:flex;align-items:center;gap:8px;max-width:320px`;
          d.innerHTML = `<span style="font-size:14px">${type==='success'?'✅':type==='error'?'❌':'🤖'}</span>${text}`;
          document.body.appendChild(d);
          setTimeout(() => d.remove(), 3000);
        },
        args: [data.text, data.type || 'info'],
      }).catch(() => {});
      return { ok: true };
    }

    case 'set-agent-tab':
      agentTabId = data.tabId;
      return { ok: true };

    case 'get-agent-tab':
      return { ok: true, tabId: agentTabId };

    case 'close-tab':
      if (data.tabId) await chrome.tabs.remove(data.tabId).catch(() => {});
      return { ok: true };

    case 'list-tabs': {
      const tabs = await chrome.tabs.query({});
      return { ok: true, tabs: tabs.map(t => ({ id: t.id, url: t.url, title: t.title, active: t.active })) };
    }

    default:
      return { error: 'Unknown action: ' + action };
  }
}

// ── Page functions injected into tabs ─────────────────────────────────────────

function clickElement(selector, text, x, y) {
  const strategies = [
    () => selector ? document.querySelector(selector) : null,
    () => text ? [...document.querySelectorAll('button,a,[role=button],[role=link],input[type=submit]')]
          .find(el => el.textContent?.trim().toLowerCase().includes(text.toLowerCase()) || el.value?.toLowerCase().includes(text.toLowerCase())) : null,
    () => text ? document.querySelector(`[aria-label*="${text}" i]`) : null,
    () => text ? document.querySelector(`[title*="${text}" i]`) : null,
    () => (x !== undefined && y !== undefined) ? document.elementFromPoint(x, y) : null,
  ];
  for (const fn of strategies) {
    try {
      const el = fn();
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => { el.focus(); el.click(); }, 100);
        return 'clicked:' + (el.id || el.className?.slice(0,20) || selector || text || `${x},${y}`);
      }
    } catch {}
  }
  return 'not-found';
}

function typeIntoField(selector, fieldHint, value) {
  const strategies = [
    () => selector ? document.querySelector(selector) : null,
    () => fieldHint ? document.querySelector(`input[placeholder*="${fieldHint}" i],textarea[placeholder*="${fieldHint}" i]`) : null,
    () => fieldHint ? document.querySelector(`input[name*="${fieldHint}" i],textarea[name*="${fieldHint}" i]`) : null,
    () => fieldHint ? document.querySelector(`input[id*="${fieldHint}" i],textarea[id*="${fieldHint}" i]`) : null,
    () => { // label association
      if (!fieldHint) return null;
      for (const label of document.querySelectorAll('label')) {
        if (label.textContent?.toLowerCase().includes(fieldHint.toLowerCase())) {
          return document.getElementById(label.htmlFor) || label.querySelector('input,textarea');
        }
      }
      return null;
    },
    () => document.querySelector('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]),textarea'),
  ];
  for (const fn of strategies) {
    try {
      const el = fn();
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
        el.focus();
        el.value = value;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return 'typed:' + (el.id || el.name || el.placeholder || 'field');
      }
    } catch {}
  }
  return 'field-not-found';
}

function extractPageContent(maxText) {
  const getText = el => el?.innerText?.trim() || el?.textContent?.trim() || '';
  return {
    title: document.title,
    url: location.href,
    text: getText(document.body)?.slice(0, maxText),
    h1s: [...document.querySelectorAll('h1,h2,h3')].slice(0,10).map(h => getText(h)),
    links: [...document.querySelectorAll('a[href]')].slice(0,30).map(a => ({ text: getText(a).slice(0,60), href: a.href })),
    inputs: [...document.querySelectorAll('input:not([type=hidden]),textarea,select')].slice(0,15).map(el => ({
      type: el.type, name: el.name, id: el.id, placeholder: el.placeholder, label: el.labels?.[0]?.textContent?.trim()
    })),
    buttons: [...document.querySelectorAll('button,[role=button],input[type=submit]')].slice(0,20).map(el => getText(el).slice(0,40)),
    images: [...document.querySelectorAll('img[alt]')].slice(0,10).map(img => img.alt),
  };
}

function extractDeals(query) {
  // Try to extract structured deal/product cards from the page
  const q = (query || '').toLowerCase();
  const cards = [];
  
  // Common deal/product selectors
  const selectors = [
    '[class*="product"]', '[class*="deal"]', '[class*="item"]', '[class*="card"]',
    '[class*="listing"]', '[class*="result"]', 'article', '[data-testid*="product"]',
    '[data-testid*="result"]', '[data-testid*="listing"]',
  ];
  
  const seen = new Set();
  for (const sel of selectors) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      // Check element has meaningful content
      const text = (el.innerText || el.textContent || '').trim();
      if (text.length < 20 || seen.has(text.slice(0,50))) continue;
      seen.add(text.slice(0,50));
      
      // Extract price
      const priceMatch = text.match(/(?:Rs\.?|LKR|USD|\$|£|€)\s*[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s*(?:Rs\.?|LKR)/i);
      const price = priceMatch ? priceMatch[0] : null;
      
      // Extract name (first heading or first substantial text)
      const heading = el.querySelector('h1,h2,h3,h4,h5,[class*="title"],[class*="name"]');
      const name = (heading?.innerText || text.split('\n')[0] || '').trim().slice(0, 100);
      
      // Extract link
      const link = el.querySelector('a[href]');
      const href = link?.href;
      
      if (!name && !price) continue;
      if (q && !text.toLowerCase().includes(q)) continue;
      
      cards.push({ name, price, url: href, snippet: text.slice(0, 200) });
      if (cards.length >= 15) break;
    }
    if (cards.length >= 15) break;
  }
  return cards;
}

function findMatchingLinks(pattern, limit) {
  const re = pattern ? new RegExp(pattern, 'i') : null;
  const links = [...document.querySelectorAll('a[href]')]
    .filter(a => {
      const text = a.textContent?.trim() || '';
      const href = a.href || '';
      if (!text && !href) return false;
      if (re) return re.test(text) || re.test(href);
      return true;
    })
    .slice(0, limit)
    .map(a => ({ text: a.textContent?.trim().slice(0, 80), href: a.href }));
  return links;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function safeUpdateTab(tabId, url) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab) return null;
    await chrome.tabs.update(tabId, { url, active: true });
    return chrome.tabs.get(tabId);
  } catch { return null; }
}

function waitForLoad(tabId, timeout = 15000) {
  return new Promise(resolve => {
    const t = setTimeout(resolve, timeout);
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(t);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 600);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: 'https://orinai.org/#agent' });
  }
});
