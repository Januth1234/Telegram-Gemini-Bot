import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.orinai.mobile',
  appName: 'Orin AI',
  // Loads the live orinai.org in a persistent WebView — same session as web
  server: {
    url: 'https://orinai.org',
    cleartext: false,
    androidScheme: 'https',
  },
  webDir: 'dist', // not used in remote mode, but required by Capacitor
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0f172a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0f172a',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    // Preserve cookies + localStorage — same as a signed-in Chrome tab
    webContentsDebuggingEnabled: false,
    appendUserAgent: 'OrinAI-Mobile/1.0',
  },
  ios: {
    appendUserAgent: 'OrinAI-Mobile/1.0',
    scrollEnabled: true,
  },
};

export default config;
