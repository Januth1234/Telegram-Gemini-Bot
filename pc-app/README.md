# Orin AI Desktop

Electron wrapper that loads orinai.org in a persistent WebView.

## Setup
```
cd pc-app
npm install
npm start          # dev
npm run build:win  # Windows installer
npm run build:mac  # macOS DMG
npm run build:linux # AppImage
```

## What it does
- Persistent Google session (no re-login)
- Auto-starts `orin-pc-agent.py` on launch
- `window.orinDesktop` bridge available to orinai.org
- System tray with quick-access menu
- External links open in default browser
