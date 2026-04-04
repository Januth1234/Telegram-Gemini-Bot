/**
 * Orin Agent content script — injected into all pages.
 * Listens for direct DOM manipulation messages from background.js.
 * Also highlights elements when the agent hovers over them.
 */

let highlightEl = null;

// Visual indicator for agent-controlled elements
function highlightElement(selector) {
  if (highlightEl) { highlightEl.remove(); highlightEl = null; }
  if (!selector) return;
  const el = document.querySelector(selector);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const div = document.createElement('div');
  div.id = '__orin_highlight__';
  div.style.cssText = `
    position: fixed;
    left: ${rect.left - 2}px;
    top: ${rect.top + window.scrollY - 2}px;
    width: ${rect.width + 4}px;
    height: ${rect.height + 4}px;
    border: 2px solid #6366f1;
    border-radius: 4px;
    background: rgba(99,102,241,0.1);
    pointer-events: none;
    z-index: 999999;
    animation: orin-pulse 1s infinite;
  `;
  const style = document.createElement('style');
  style.textContent = `@keyframes orin-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`;
  document.head.appendChild(style);
  document.body.appendChild(div);
  highlightEl = div;
  setTimeout(() => { div.remove(); }, 2000);
}

// Show agent status overlay
function showStatusBanner(text, type = 'info') {
  const existing = document.getElementById('__orin_banner__');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.id = '__orin_banner__';
  const colors = { info: '#6366f1', success: '#10b981', error: '#ef4444' };
  div.style.cssText = `
    position: fixed; top: 12px; right: 12px; z-index: 999999;
    background: ${colors[type] || colors.info};
    color: white; padding: 8px 14px; border-radius: 10px;
    font-family: sans-serif; font-size: 12px; font-weight: 700;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    display: flex; align-items: center; gap: 8px;
    max-width: 300px;
  `;
  div.innerHTML = `<span style="font-size:14px">${type === 'success' ? '✅' : type === 'error' ? '❌' : '🤖'}</span> ${text}`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// Listen for instructions from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'highlight') highlightElement(msg.selector);
  if (msg.type === 'banner') showStatusBanner(msg.text, msg.variant);
});

// Signal to background that content script is ready
chrome.runtime.sendMessage({ type: 'content-ready', url: location.href });
