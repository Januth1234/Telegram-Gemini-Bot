
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const startApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("Critical: 'root' element not found.");
    return;
  }

  // Register Asset Caching Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('Asset Cache Worker active:', reg.scope))
        .catch((err) => console.warn('Cache Worker registration failed:', err));
    });

    // Register Firebase Messaging separately if needed
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then((registration) => {
        console.log('FCM Worker active:', registration.scope);
      })
      .catch((err) => {
        console.warn('FCM Worker registration failed:', err);
      });
  }

  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("Orin Neural Workspace: Successfully Mounted.");
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
