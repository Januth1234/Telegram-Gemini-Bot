# Orin AI Mobile

Capacitor wrapper that loads **orinai.org** in a persistent WebView.
One identity, same Google session — no re-login on phone.

## Setup
```bash
cd mobile-app
npm install

# Android
npm run sync:android
npm run open:android   # opens Android Studio

# iOS (macOS only)
npm run sync:ios
npm run open:ios       # opens Xcode
```

## What it does
- Persistent session: same Google cookies as mobile Chrome
- System browser for OAuth (no embedded popups)
- Push notifications wired to Firebase Cloud Messaging
- `window.orinMobile` bridge exposed for approval/status UI
- App routes to `#agent?panel=desktop` for PC task control

## App signature
Set `VITE_MOBILE_UA` env var so the site detects mobile shell:
`OrinAI-Mobile/1.0`
