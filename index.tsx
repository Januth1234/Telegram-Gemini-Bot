import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const startApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("Critical: 'root' element not found.");
    return;
  }

  // Register Service Worker for Firebase Messaging
  if ('serviceWorker' in navigator) {
    const registerSW = async () => {
      // Skip if not http/https (e.g. data: or file:)
      if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') {
        return;
      }

      try {
        // Attempt to construct absolute URL to bypass potentially incorrect <base> tags
        // injected by cloud environments.
        let swUrl = './firebase-messaging-sw.js';
        let options = { scope: './' };

        try {
          const baseUrl = window.location.href;
          swUrl = new URL('firebase-messaging-sw.js', baseUrl).href;
          options.scope = new URL('./', baseUrl).href;
        } catch (e) {
          // If URL construction fails (e.g. invalid base), fall back to relative path
          console.warn("SW URL construction failed, using relative path:", e);
        }
        
        const registration = await navigator.serviceWorker.register(swUrl, options);
        console.log('Service Worker registration successful with scope: ', registration.scope);
      } catch (err) {
        // Log explicitly so we can debug if it persists
        console.error('Service Worker registration failed:', err);
      }
    };

    // Wait for full page load to ensure the environment is stable
    window.addEventListener('load', () => {
      // Small buffer to allow the iframe to settle
      setTimeout(registerSW, 1500);
    });
  }

  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("Aura Neural Workspace: Successfully Mounted.");
  } catch (err) {
    console.error("Mounting Error:", err);
  }
};

// Ensure DOM is fully ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}