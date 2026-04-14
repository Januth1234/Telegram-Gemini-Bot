/**
 * appShellContext — detects what shell the web app is running inside.
 * 'desktop' → Electron/Tauri WebView with window.orinDesktop bridge
 * 'mobile'  → Capacitor/React Native WebView with window.orinMobile bridge
 * 'browser' → standard web browser (default)
 */

export type AppShellKind = 'browser' | 'desktop' | 'mobile';

let _cached: AppShellKind | null = null;

export function getAppShellKind(): AppShellKind {
  if (_cached) return _cached;
  if (typeof window === 'undefined') return (_cached = 'browser');
  if ((window as any).orinDesktop) return (_cached = 'desktop');
  if ((window as any).orinMobile) return (_cached = 'mobile');
  // Capacitor detection
  if ((window as any).Capacitor?.isNativePlatform?.()) return (_cached = 'mobile');
  return (_cached = 'browser');
}
