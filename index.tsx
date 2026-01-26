
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- GLOBAL ERROR SHIELD ---
// Traps synchronous errors (like "undefined is not a function") to prevent white-screen crashes
window.addEventListener('error', (event) => {
  console.warn('[Orin Runtime Guard] Caught:', event.message);
  // event.preventDefault(); // Uncomment to suppress the red error in console
});

// Traps unhandled promise rejections (like "Network Error" or "Permission Denied")
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'AbortError') return;
  console.warn('[Orin Async Guard] Unhandled Rejection:', event.reason);
  event.preventDefault(); // Prevents "Uncaught (in promise)" error
});

const startApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("Critical: 'root' element not found.");
    return;
  }

  // Register Main Service Worker (Caching + Messaging)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('Orin SW registered with scope:', registration.scope);
        })
        .catch((err) => {
          console.debug('Orin SW registration skipped:', err);
        });
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
