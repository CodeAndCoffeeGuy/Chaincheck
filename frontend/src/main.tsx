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
ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
);

// Register Service Worker for PWA
registerServiceWorker();

