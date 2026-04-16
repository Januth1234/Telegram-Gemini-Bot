/**
 * Orin AI Desktop — Electron main process
 * Loads orinai.org in a persistent WebView, preserves session,
 * bridges window.orinDesktop for PC agent control.
 */
const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const APP_URL = 'https://orinai.org';
const SESSION_PARTITION = 'persist:orin-main'; // preserves Google login across launches

let win = null;
let tray = null;
let agentProc = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860,
    minWidth: 800, minHeight: 600,
    title: 'Orin AI',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      partition: SESSION_PARTITION,  // persistent session — Google login survives
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      // Allow cookies + localStorage on orinai.org
    },
    show: false,
    backgroundColor: '#0f172a',
    frame: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  win.loadURL(APP_URL + '#agent?panel=desktop');
  win.once('ready-to-show', () => win.show());

  // Open external links in default browser, not in the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });

  // Inject orinDesktop bridge after every navigation (SPA navigations too)
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      window.orinDesktop = window.orinDesktop || {
        version: 1,
        shell: 'desktop',
        startLocalPcAgent: () => window._orinDesktop_startAgent(),
      };
    `).catch(() => {});
  });

  win.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); win.hide(); }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  const img = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  tray = new Tray(img);
  tray.setToolTip('Orin AI');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Orin AI', click: () => win?.show() },
    { label: 'Agent Mode', click: () => { win?.show(); win?.webContents.loadURL(APP_URL + '#agent?panel=desktop'); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.on('click', () => win?.show());
}

// ── IPC: start/stop local Python agent ────────────────────────────────────────
ipcMain.handle('start-local-agent', async () => {
  if (agentProc) return { ok: true, status: 'already_running' };
  const agentPath = path.join(app.getPath('userData'), 'orin-pc-agent.py');
  // If not installed yet, copy bundled version
  const bundled = path.join(__dirname, 'assets', 'orin-pc-agent.py');
  if (!fs.existsSync(agentPath) && fs.existsSync(bundled)) {
    fs.copyFileSync(bundled, agentPath);
  }
  if (!fs.existsSync(agentPath)) {
    return { ok: false, error: 'orin-pc-agent.py not found. Download from orinai.org → Agent.' };
  }
  return new Promise(resolve => {
    agentProc = spawn('python', [agentPath], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    agentProc.stdout.once('data', () => resolve({ ok: true, status: 'running' }));
    agentProc.on('error', (e) => { agentProc = null; resolve({ ok: false, error: e.message }); });
    agentProc.on('exit', () => { agentProc = null; });
    setTimeout(() => resolve({ ok: true, status: 'starting' }), 3000);
  });
});

ipcMain.handle('stop-local-agent', () => {
  if (agentProc) { agentProc.kill(); agentProc = null; }
  return { ok: true };
});

ipcMain.handle('agent-status', () => ({ running: !!agentProc }));

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
  // Auto-start agent on launch
  setTimeout(() => ipcMain.emit('start-local-agent'), 2000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => { if (!win) createWindow(); else win.show(); });
app.on('before-quit', () => { app.isQuitting = true; });
