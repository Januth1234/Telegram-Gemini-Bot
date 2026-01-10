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
    // FIX: Explicitly construct the absolute URL using window.location.origin.
    // This ignores any <base> tags injected by cloud environments (like ai.studio)
    // that cause origin mismatch errors.
    const swUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '/')}/firebase-messaging-sw.js`.replace(/\/\//g, '/').replace(':/', '://');

    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        console.log('Service Worker registration successful with scope: ', registration.scope);
      })
      .catch((err) => {
        console.warn('Service Worker registration failed:', err);
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