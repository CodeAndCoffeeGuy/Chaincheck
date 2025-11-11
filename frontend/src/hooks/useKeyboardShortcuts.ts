import { useEffect, useRef } from "react";

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
}

/**
 * Custom hook for keyboard shortcuts
 * @param shortcuts Array of keyboard shortcut definitions
 * @param enabled Whether shortcuts are enabled (default: true)
 */
export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcut[] = [],
  enabled: boolean = true
) => {
  // Use ref to store latest shortcuts without causing effect to re-run
  const shortcutsRef = useRef<KeyboardShortcut[]>(shortcuts || []);
  const enabledRef = useRef<boolean>(enabled);
  const mountedRef = useRef<boolean>(false);
  
  // Update refs when values change - with safety check
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
    }
    if (shortcuts && Array.isArray(shortcuts)) {
      shortcutsRef.current = shortcuts;
    }
  }, [shortcuts]);
  
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    // Safety check: only set up if component is mounted and enabled
    if (!mountedRef.current || !enabledRef.current) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Use ref to get latest shortcuts
      const currentShortcuts = shortcutsRef.current;
      if (!currentShortcuts || !Array.isArray(currentShortcuts)) {
        return;
      }

      for (const shortcut of currentShortcuts) {
        if (!shortcut || !shortcut.key) continue;

        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        
        // Handle Cmd on Mac or Ctrl on Windows/Linux
        const modifierMatch =
          shortcut.ctrlKey || shortcut.metaKey
            ? event.ctrlKey || event.metaKey
            : !event.ctrlKey && !event.metaKey;
        
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.altKey ? event.altKey : !event.altKey;

        if (keyMatch && modifierMatch && shiftMatch && altMatch) {
          event.preventDefault();
          if (typeof shortcut.action === "function") {
            try {
              shortcut.action();
            } catch (error) {
              // Silently fail during HMR to prevent breaking the app
              if (import.meta.env.DEV) {
                console.warn('Keyboard shortcut action failed:', error);
              }
            }
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      mountedRef.current = false;
    };
  }, []); // Empty deps - use refs for all values
};
