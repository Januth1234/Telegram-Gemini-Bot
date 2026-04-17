/**
 * Orin AI Desktop — Electron main.js
 * Persistent WebView + auto-starting Python executor
 */
const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const APP_URL = 'https://orinai.org';
const SESSION_PARTITION = 'persist:orin-main';

let win = null, tray = null, agentProc = null;
app.isQuitting = false;

function createWindow() {
  win = new BrowserWindow({
    width: 1300, height: 880, minWidth: 900, minHeight: 600,
    title: 'Orin AI', icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      partition: SESSION_PARTITION,
      contextIsolation: true, nodeIntegration: false, webSecurity: true,
    },
    show: false, backgroundColor: '#0f172a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });
  win.loadURL(APP_URL + '/#agent?panel=desktop');
  win.once('ready-to-show', () => {
    // Spoof UA so Google/Firebase treat this as a real Chrome browser
    win.webContents.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    );
    win.show();
  });
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      if(!window.orinDesktop) window.orinDesktop = {
        version:1, shell:'desktop',
        startLocalPcAgent: () => new Promise(r => {
          window._orinAgentResolve = r;
          window.dispatchEvent(new CustomEvent('orin-start-agent'));
        }),
        stopLocalPcAgent: () => window.dispatchEvent(new CustomEvent('orin-stop-agent')),
      };
    `).catch(()=>{});
  });
  // Intercept Google OAuth + any auth URLs → open in system default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });

  // Also intercept navigation to Google accounts / OAuth in the main frame
  win.webContents.on('will-navigate', (event, url) => {
    const isGoogle = url.includes('accounts.google.com') || url.includes('oauth2') || url.includes('openid-connect');
    const isOAuth  = url.includes('access_token') || url.includes('code=') || url.includes('error=');
    if (isGoogle) {
      // Open Google sign-in in system browser — Google blocks embedded webviews
      event.preventDefault();
      shell.openExternal(url);
    }
    // Allow redirect back to orinai.org after auth
  });
  win.on('close', (e) => { if (!app.isQuitting) { e.preventDefault(); win.hide(); } });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  const img = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  tray = new Tray(img.resize({ width: 16, height: 16 }));
  tray.setToolTip('Orin AI');
  const rebuild = () => tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Orin AI',   click: () => { win?.show(); win?.focus(); } },
    { label: 'Agent Mode',     click: () => { win?.show(); win?.loadURL(APP_URL + '/#agent?panel=desktop'); } },
    { type: 'separator' },
    { label: agentProc ? '● PC Agent running' : '○ PC Agent stopped', enabled: false },
    { label: agentProc ? 'Stop Agent' : 'Start Agent',
      click: () => agentProc ? stopAgent() : startAgent() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  rebuild(); tray.on('click', () => win?.show());
  ipcMain.on('agent-state-changed', rebuild);
}

function findPython() {
  const candidates = ['python3','python','py'];
  const { execSync } = require('child_process');
  for (const c of candidates) {
    try { execSync(`${c} --version`, { stdio:'ignore' }); return c; } catch {}
  }
  return 'python';
}

function startAgent() {
  if (agentProc) return { ok: true, status: 'already_running' };
  const agentPath = path.join(app.getPath('userData'), 'agent.py');
  const bundled = path.join(__dirname, 'assets', 'agent.py');
  const execPy  = path.join(__dirname, 'assets', 'executor.py');
  const brokerPy = path.join(__dirname, 'assets', 'broker_client.py');

  // Copy agent files to userData if not present
  for (const [src, dst] of [
    [bundled, agentPath],
    [execPy,  path.join(app.getPath('userData'), 'executor.py')],
    [brokerPy, path.join(app.getPath('userData'), 'broker_client.py')],
  ]) {
    if (fs.existsSync(src) && !fs.existsSync(dst)) fs.copyFileSync(src, dst);
  }

  if (!fs.existsSync(agentPath))
    return { ok: false, error: 'agent.py not found. Download from orinai.org/agent' };

  const py = findPython();
  agentProc = spawn(py, [agentPath], {
    cwd: app.getPath('userData'), detached: false,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  agentProc.stdout?.on('data', d => console.log('[agent]', d.toString().trim()));
  agentProc.stderr?.on('data', d => console.warn('[agent err]', d.toString().trim()));
  agentProc.on('exit', () => { agentProc = null; ipcMain.emit('agent-state-changed'); });
  ipcMain.emit('agent-state-changed');
  return { ok: true, status: 'running' };
}

function stopAgent() {
  if (agentProc) { agentProc.kill(); agentProc = null; }
  ipcMain.emit('agent-state-changed');
}

ipcMain.handle('start-local-agent', async () => startAgent());
ipcMain.handle('stop-local-agent',  async () => { stopAgent(); return { ok: true }; });
ipcMain.handle('agent-status',      async () => ({ running: !!agentProc }));

app.whenReady().then(() => {
  createWindow(); createTray();
  // Auto-start agent 3s after launch
  setTimeout(() => startAgent(), 3000);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!win) createWindow(); else win.show(); });
app.on('before-quit', () => { app.isQuitting = true; stopAgent(); });
