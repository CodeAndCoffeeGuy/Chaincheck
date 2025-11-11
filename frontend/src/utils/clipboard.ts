/**
 * Copy text to clipboard utility
 * @param text The text to copy
 * @returns Promise that resolves to true if successful, false otherwise
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    // Use modern Clipboard API if available
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for older browsers or non-secure contexts
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      document.body.removeChild(textArea);
      return false;
    }
  } catch (err) {
    console.error("Failed to copy text:", err);
    return false;
  }
};

/**
 * Copy text to clipboard with user feedback
 * @param text The text to copy
 * @param showToast Optional toast function to show success/error message
 * @returns Promise that resolves to true if successful, false otherwise
 */
export const copyToClipboardWithFeedback = async (
  text: string,
  showToast?: (message: string, type?: "success" | "error" | "info" | "warning", duration?: number) => void
): Promise<boolean> => {
  const success = await copyToClipboard(text);
  
  if (showToast) {
    if (success) {
      showToast("Copied to clipboard!", "success", 3000);
    } else {
      showToast("Failed to copy to clipboard", "error", 3000);
    }
  }
  
  return success;
};

