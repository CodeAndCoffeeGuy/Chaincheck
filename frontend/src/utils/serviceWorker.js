/**
 * Service Worker Registration
 * Registers the service worker for PWA functionality
 */

/**
 * Register service worker for PWA support
 */
export function registerServiceWorker() {
  // Only register in production or if explicitly enabled
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    // Delay registration to avoid blocking initial render
    setTimeout(() => {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("Service Worker registered:", registration.scope);

            // Check for updates
            registration.addEventListener("updatefound", () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                    // New service worker available
                    console.log("New service worker available");
                  }
                });
              }
            });
          })
          .catch((error) => {
            // Silently fail - service worker is optional
            if (import.meta.env.DEV) {
              console.warn("Service Worker registration failed:", error);
            }
          });
      }, 1000); // Delay to not block initial render
    }, 2000);
  }
}

