'use strict';

const dot = document.getElementById('dot');
const statusEl = document.getElementById('status');
const tabInfoEl = document.getElementById('tab-info');
const extIdEl = document.getElementById('ext-id');

// Show own extension ID
extIdEl.value = chrome.runtime.id;

document.getElementById('btn-open').onclick = () => {
  chrome.tabs.create({ url: 'https://orinai.org/#agent' });
  window.close();
};

document.getElementById('btn-set-tab').onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab) {
    chrome.runtime.sendMessage({ action: 'set-agent-tab', data: { tabId: tab.id } });
    await chrome.storage.local.set({ agentTabId: tab.id });
    tabInfoEl.textContent = '✅ Target: ' + (tab.title || tab.url || 'tab').slice(0, 50);
    dot.className = 'dot green';
    statusEl.textContent = 'Target set';
  }
};

// Load current state
async function init() {
  const { agentTabId } = await chrome.storage.local.get(['agentTabId']);
  if (agentTabId) {
    try {
      const tab = await chrome.tabs.get(agentTabId);
      tabInfoEl.textContent = 'Target: ' + (tab.title || tab.url || 'tab').slice(0, 55);
      dot.className = 'dot green';
      statusEl.textContent = 'Agent ready';
    } catch {
      tabInfoEl.textContent = 'Previous tab no longer available';
      dot.className = 'dot grey';
      statusEl.textContent = 'Set a new target tab';
    }
  } else {
    dot.className = 'dot grey';
    statusEl.textContent = 'No target tab';
  }
}

init();
