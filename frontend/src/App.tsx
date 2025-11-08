import { useState, useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import {
  verifyProduct,
  generateSerialHash,
  isMetaMaskInstalled,
  getCurrentAccount,
  connectWallet,
} from "./utils/blockchain";
import "./App.css";

/**
 * Main ChainCheck Application Component
 * 
 * Features:
 * - QR code scanning for product verification
 * - Blockchain verification via smart contract
 * - Real-time status updates
 * - Error handling and user feedback
 */
function App() {
  // Application state
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{
    status: "authentic" | "fake" | "error" | null;
    message: string;
    productName?: string;
    productBrand?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [scanner, setScanner] = useState<Html5QrcodeScanner | null>(null);
  const qrReaderRef = useRef<HTMLDivElement>(null);

  /**
   * Check wallet connection on component mount
   */
  useEffect(() => {
    checkWalletConnection();
    
    // Listen for account changes
    if (isMetaMaskInstalled() && window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length > 0) {
          setWalletConnected(true);
        } else {
          setWalletConnected(false);
        }
      });

      window.ethereum.on("chainChanged", () => {
        // Reload page on network change
        window.location.reload();
      });

      // Cleanup listeners on unmount
      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener("accountsChanged", () => {});
          window.ethereum.removeListener("chainChanged", () => {});
        }
      };
    }
  }, []);

  /**
   * Check if wallet is already connected
   */
  const checkWalletConnection = async () => {
    if (isMetaMaskInstalled()) {
      const account = await getCurrentAccount();
      setWalletConnected(account !== null);
    }
  };

  /**
   * Connect to MetaMask wallet
   */
  const handleConnectWallet = async () => {
    try {
      setLoading(true);
      setResult(null);
      
      // Double-check MetaMask installation
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("MetaMask is not installed. Please install MetaMask to continue.");
      }

      // Try to connect wallet
      const accounts = await connectWallet();
      
      if (accounts && accounts.length > 0) {
        setWalletConnected(true);
        console.log("Wallet connected:", accounts[0]);
        setResult(null); // Clear any previous errors
      } else {
        throw new Error("No accounts found. Please unlock MetaMask and try again.");
      }
    } catch (error: any) {
      console.error("Wallet connection error:", error);
      
      // Provide more helpful error messages
      let errorMessage = error.message || "Failed to connect wallet";
      
      if (error.code === 4001) {
        errorMessage = "Connection rejected. Please approve the connection request in MetaMask.";
      } else if (error.message?.includes("not installed")) {
        errorMessage = "MetaMask is not installed. Please install MetaMask to continue.";
      } else if (error.message?.includes("No accounts")) {
        errorMessage = "No accounts found. Please unlock MetaMask and try again.";
      }
      
      setResult({
        status: "error",
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Start QR code scanner
   */
  const startScan = () => {
    if (!isMetaMaskInstalled()) {
      setResult({
        status: "error",
        message: "MetaMask is required. Please install MetaMask to continue.",
      });
      return;
    }

    if (!walletConnected) {
      setResult({
        status: "error",
        message: "Please connect your wallet first.",
      });
      return;
    }

    // Reset previous results
    setResult(null);
    setScanning(true);
  };

  /**
   * Initialize QR scanner when scanning state becomes true
   * This ensures the DOM element exists before initializing
   */
  useEffect(() => {
    if (!scanning || !walletConnected) {
      // Clean up scanner when not scanning
      if (scanner) {
        try {
          scanner.clear();
          setScanner(null);
        } catch (e) {
          console.log("Error clearing scanner:", e);
        }
      }
      return;
    }

    // Wait for DOM to update and element to be available
    const timer = setTimeout(async () => {
      const element = document.getElementById("qr-reader");
      if (!element) {
        console.error("QR reader element not found");
        setScanning(false);
        setResult({
          status: "error",
          message: "Failed to initialize scanner. Please try again.",
        });
        return;
      }

      // Clear any existing scanner first
      if (scanner) {
        try {
          scanner.clear();
        } catch (e) {
          console.log("Error clearing previous scanner:", e);
        }
      }

      // Initialize QR scanner with mobile-optimized settings
      const isMobile = window.innerWidth <= 768;
      let qrScanner: Html5QrcodeScanner;
      
      try {
        // Check camera permissions first
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          // Stop the test stream immediately
          stream.getTracks().forEach(track => track.stop());
        } catch (permError: any) {
          console.error("Camera permission error:", permError);
          setScanning(false);
          setResult({
            status: "error",
            message: permError.name === "NotAllowedError" || permError.name === "PermissionDeniedError"
              ? "Camera permission denied. Please allow camera access in your browser settings and try again."
              : "Camera access failed. Please check your camera permissions and try again.",
          });
          return;
        }

        // Clear the element first to ensure clean state
        element.innerHTML = "";

        // Calculate optimal QR box size based on container
        const containerWidth = element.offsetWidth || (isMobile ? window.innerWidth - 60 : 400);
        const containerHeight = element.offsetHeight || 400;
        const maxSize = Math.min(containerWidth - 40, containerHeight - 40, isMobile ? 250 : 300);
        const qrBoxSize = Math.max(200, maxSize);

        qrScanner = new Html5QrcodeScanner(
          "qr-reader",
          {
            fps: 10,
            qrbox: { width: qrBoxSize, height: qrBoxSize },
            aspectRatio: 1.0,
            disableFlip: false,
            rememberLastUsedCamera: true,
            supportedScanTypes: [],
            showTorchButtonIfSupported: true,
            showZoomSliderIfSupported: true,
          },
          false // verbose mode off for cleaner UI
        );

        setScanner(qrScanner);
        setLoading(true); // Show loading while camera starts

        // Start scanning with proper error handling
        qrScanner.render(
          async (decodedText) => {
            console.log("QR Code detected:", decodedText);
            setLoading(false);
            // Stop scanner when QR code is detected
            try {
              await qrScanner.clear();
            } catch (e) {
              console.log("Error clearing scanner:", e);
            }
            setScanning(false);
            setScanner(null);

            // Process the scanned QR code
            await processQRCode(decodedText);
          },
          (errorMessage: any) => {
            setLoading(false);
            // Log errors for debugging
            // Handle both string and object error messages
            const errorStr = typeof errorMessage === "string" 
              ? errorMessage 
              : (errorMessage && typeof errorMessage === "object" && "message" in errorMessage)
                ? String(errorMessage.message)
                : String(errorMessage);
            
            // Check for camera-specific errors
            if (errorStr && (errorStr.includes("Permission") || errorStr.includes("NotAllowedError"))) {
              setScanning(false);
              setResult({
                status: "error",
                message: "Camera permission denied. Please allow camera access and try again.",
              });
              return;
            }

            if (errorStr && 
                !errorStr.includes("NotFoundException") && 
                !errorStr.includes("No QR code") &&
                !errorStr.includes("No barcode") &&
                !errorStr.includes("parse error") &&
                !errorStr.includes("QR code parse error")) {
              console.log("QR scanning error:", errorStr);
            }
          }
        );

        // Hide loading after a short delay (camera should be starting)
        setTimeout(() => {
          setLoading(false);
        }, 2000);
      } catch (error: any) {
        console.error("Error initializing QR scanner:", error);
        setLoading(false);
        setScanning(false);
        setResult({
          status: "error",
          message: error.message?.includes("Permission") || error.name === "NotAllowedError"
            ? "Camera permission denied. Please allow camera access in your browser settings and try again."
            : error.message || "Failed to initialize camera. Please check permissions and try again.",
        });
      }
    }, 100); // Small delay to ensure DOM is ready

    // Cleanup function
    return () => {
      clearTimeout(timer);
      if (scanner) {
        try {
          scanner.clear();
        } catch (e) {
          console.log("Error in cleanup:", e);
        }
      }
    };
  }, [scanning, walletConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Stop QR scanner
   */
  const stopScan = () => {
    if (scanner) {
      scanner.clear();
      setScanner(null);
    }
    setScanning(false);
  };

  /**
   * Process scanned QR code and verify on blockchain
   * Expected format: "BATCH_ID:SERIAL_NUMBER" or JSON with batchId and serialNumber
   */
  const processQRCode = async (qrData: string) => {
    setLoading(true);
    setResult(null);

    try {
      // Parse QR code data
      // Format 1: "BATCH_ID:SERIAL_NUMBER" (e.g., "1:SN123456")
      // Format 2: JSON string with batchId and serialNumber
      let batchId: number;
      let serialNumber: string;

      try {
        // Try parsing as JSON first
        const jsonData = JSON.parse(qrData);
        batchId = parseInt(jsonData.batchId);
        serialNumber = jsonData.serialNumber;
      } catch {
        // If not JSON, try colon-separated format
        const parts = qrData.split(":");
        if (parts.length !== 2) {
          throw new Error(
            'Invalid QR code format. Expected "BATCH_ID:SERIAL_NUMBER" or JSON'
          );
        }
        batchId = parseInt(parts[0]);
        serialNumber = parts[1];
      }

      if (isNaN(batchId) || !serialNumber) {
        throw new Error("Invalid batch ID or serial number");
      }

      // Generate serial hash
      const serialHash = generateSerialHash(batchId, serialNumber);

      // Verify on blockchain
      const verificationResult = await verifyProduct(serialHash, batchId);

      // Set result based on verification
      if (verificationResult.isAuthentic) {
        setResult({
          status: "authentic",
          message: "Product verified as AUTHENTIC",
          productName: verificationResult.productName,
          productBrand: verificationResult.productBrand,
        });
      } else {
        setResult({
          status: "fake",
          message: "WARNING: This product may be COUNTERFEIT",
          productName: verificationResult.productName,
          productBrand: verificationResult.productBrand,
        });
      }
    } catch (error: any) {
      console.error("Verification error:", error);
      setResult({
        status: "error",
        message: error.message || "Failed to verify product. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset application state
   */
  const reset = () => {
    stopScan();
    setResult(null);
    setLoading(false);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>ChainCheck</h1>
        <p className="subtitle">Verify Product Authenticity</p>
      </header>

      <main className="app-main">
        {/* Wallet Connection Section */}
        {!walletConnected && (
          <div className="wallet-section">
            <p>Connect your wallet to start verifying products</p>
            {!isMetaMaskInstalled() ? (
              <div className="result-section result-error">
                <h3>MetaMask Required</h3>
                <p>MetaMask is not installed. Please install MetaMask to use ChainCheck.</p>
                <div style={{ marginTop: "20px" }}>
                  <a 
                    href="https://metamask.io/download/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ textDecoration: "none", display: "inline-block" }}
                  >
                    Install MetaMask
                  </a>
                </div>
                <p style={{ marginTop: "15px", fontSize: "0.9rem", opacity: 0.8 }}>
                  After installing, refresh this page and connect your wallet.
                </p>
              </div>
            ) : loading ? (
              <div className="loading-section">
                <div className="spinner"></div>
                <p>Connecting to wallet...</p>
              </div>
            ) : (
              <button 
                onClick={handleConnectWallet} 
                className="btn btn-primary"
                disabled={loading}
              >
                Connect Wallet
              </button>
            )}
            {result && result.status === "error" && isMetaMaskInstalled() && (
              <div className={`result-section result-error`} style={{ marginTop: "20px" }}>
                <p>{result.message}</p>
                <p style={{ marginTop: "10px", fontSize: "0.9rem", opacity: 0.8 }}>
                  Make sure MetaMask is unlocked and try again.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Scanner Section */}
        {walletConnected && (
          <>
            {!scanning && !result && (
              <div className="scan-section">
                <p>Scan the QR code on your product to verify authenticity</p>
                <button onClick={startScan} className="btn btn-primary">
                  Start Scan
                </button>
              </div>
            )}

            {/* QR Code Scanner */}
            {scanning && (
              <div className="scanner-section">
                {loading && (
                  <div className="loading-section" style={{ marginBottom: "20px" }}>
                    <div className="spinner"></div>
                    <p>Starting camera...</p>
                  </div>
                )}
                <div id="qr-reader" ref={qrReaderRef}></div>
                <button onClick={stopScan} className="btn btn-secondary">
                  Cancel Scan
                </button>
              </div>
            )}

            {/* Loading State for verification */}
            {loading && !scanning && (
              <div className="loading-section">
                <div className="spinner"></div>
                <p>Verifying on blockchain...</p>
              </div>
            )}

            {/* Results Section */}
            {result && (
              <div className={`result-section result-${result.status}`}>
                <h2>{result.message}</h2>
                {result.productName && (
                  <div className="product-info">
                    <p>
                      <strong>Product:</strong> {result.productName}
                    </p>
                    <p>
                      <strong>Brand:</strong> {result.productBrand}
                    </p>
                  </div>
                )}
                <button onClick={reset} className="btn btn-primary">
                  Scan Another Product
                </button>
              </div>
            )}
          </>
        )}

        {/* Instructions */}
        <div className="instructions">
          <h3>How it works:</h3>
          <ol>
            <li>Connect your MetaMask wallet</li>
            <li>Click "Start Scan" and allow camera access</li>
            <li>Point your camera at the product QR code</li>
            <li>View verification result on blockchain</li>
          </ol>
          <p className="note">
            First scan = Authentic | Second scan = Possible Counterfeit
          </p>
        </div>
      </main>

      <footer className="app-footer">
        <p>Powered by Polygon Blockchain</p>
      </footer>
    </div>
  );
}

export default App;

