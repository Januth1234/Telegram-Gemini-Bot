document.getElementById('open-orin').onclick = () => {
  chrome.tabs.create({ url: 'https://orinai.org/#agent' });
};

document.getElementById('set-tab').onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab) {
    await chrome.storage.local.set({ agentTabId: tab.id });
    document.getElementById('tab-info').textContent = '✅ Target: ' + (tab.title || tab.url || '').slice(0, 50);
    document.getElementById('status-text').textContent = 'Target set';
  }
};

// Check current agent tab
chrome.storage.local.get(['agentTabId'], async (result) => {
  if (result.agentTabId) {
    try {
      const tab = await chrome.tabs.get(result.agentTabId);
      document.getElementById('tab-info').textContent = 'Target: ' + (tab.title || tab.url || '').slice(0, 50);
      document.getElementById('status-text').textContent = 'Agent active';
    } catch {
      document.getElementById('tab-info').textContent = 'No active target';
    }
  }
});
