import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./contexts/ToastContext";
import { registerServiceWorker } from "./utils/serviceWorker";
import "./index.css";

/**
 * Application Entry Point
 * 
 * Renders the ChainCheck application to the DOM
 */
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found. Make sure there is a <div id='root'></div> in your HTML.");
}

try {
  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ErrorBoundary>
    </StrictMode>
  );
} catch (error) {
  console.error("Failed to render app:", error);
  rootElement.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0f0f0f; color: #f5f5f5; font-family: system-ui, sans-serif; padding: 20px; text-align: center;">
      <div>
        <h1 style="color: #FF6B35; margin-bottom: 20px;">Failed to Load</h1>
        <p style="margin-bottom: 20px;">The application failed to initialize. Please refresh the page.</p>
        <button onclick="window.location.reload()" style="padding: 12px 24px; background: #FF6B35; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
          Refresh Page
        </button>
      </div>
    </div>
  `;
}

// Register Service Worker for PWA (non-blocking)
if (typeof window !== "undefined") {
  registerServiceWorker();
}

