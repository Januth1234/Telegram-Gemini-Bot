'use strict';
/**
 * Orin Agent Content Script v2.0
 * Visual overlays: highlight ring, status banner, agent mode indicator.
 */

// Agent mode indicator (top bar)
function showAgentBar(show) {
  const id = '__orin_agent_bar__';
  if (!show) { document.getElementById(id)?.remove(); return; }
  if (document.getElementById(id)) return;
  const bar = document.createElement('div');
  bar.id = id;
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:linear-gradient(90deg,#6366f1,#8b5cf6);color:#fff;padding:6px 14px;font:700 11px/-apple-system,sans-serif;display:flex;align-items:center;gap:8px;box-shadow:0 2px 12px rgba(0,0,0,.3)';
  bar.innerHTML = '<span style="font-size:13px">🤖</span> <span>Orin AI Agent is controlling this tab</span> <span style="margin-left:auto;opacity:.7;font-size:10px">orinai.org</span>';
  document.body.style.paddingTop = Math.max(parseInt(document.body.style.paddingTop) || 0, 32) + 'px';
  document.body.insertAdjacentElement('afterbegin', bar);
}

// Handle messages from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'show-bar') showAgentBar(msg.show !== false);
  if (msg.type === 'hide-bar') showAgentBar(false);
});

// Signal ready
try { chrome.runtime.sendMessage({ type: 'content-ready', url: location.href }); } catch {}
