'use strict';
/**
 * Orin Agent Content Script v2.1
 * Auto-announces extension ID to orinai.org pages — zero manual setup.
 * Visual overlays: agent bar, highlight ring, status banners.
 */

// ── Auto-connect: inject extension ID into page ───────────────────────────────
// This allows orinai.org to call chrome.runtime.sendMessage without knowing the ID
function announceExtension() {
  // Method 1: custom DOM event (most reliable)
  window.dispatchEvent(new CustomEvent('orin-agent-ready', {
    detail: { extId: chrome.runtime.id, version: '2.1' }
  }));
  
  // Method 2: data attribute on html element (backup)
  document.documentElement.setAttribute('data-orin-agent-id', chrome.runtime.id);
  document.documentElement.setAttribute('data-orin-agent-version', '2.1');
}

// Announce immediately and on every navigation (SPA support)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', announceExtension);
} else {
  announceExtension();
}

// Re-announce when orinai.org asks
window.addEventListener('orin-agent-ping', () => {
  announceExtension();
});

// ── Agent mode bar ─────────────────────────────────────────────────────────────
function showAgentBar(show) {
  const id = '__orin_agent_bar__';
  if (!show) { document.getElementById(id)?.remove(); return; }
  if (document.getElementById(id)) return;
  const bar = document.createElement('div');
  bar.id = id;
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:linear-gradient(90deg,#6366f1,#8b5cf6);color:#fff;padding:6px 14px;font:700 11px/-apple-system,sans-serif;display:flex;align-items:center;gap:8px;box-shadow:0 2px 12px rgba(0,0,0,.3);pointer-events:none';
  bar.innerHTML = '<span style="font-size:13px">🤖</span> <span>Orin AI Agent is controlling this tab</span> <span style="margin-left:auto;opacity:.7;font-size:10px">orinai.org</span>';
  document.body?.insertAdjacentElement('afterbegin', bar);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'show-bar') showAgentBar(true);
  if (msg.type === 'hide-bar') showAgentBar(false);
});

try { chrome.runtime.sendMessage({ type: 'content-ready', url: location.href }); } catch {}
