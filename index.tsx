
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const startApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("Critical: 'root' element not found.");
    return;
  }

  try {
    const root = createRoot(rootElement);
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
