import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import {
  verifyProduct,
  generateSerialHash,
  isMetaMaskInstalled,
  getCurrentAccount,
  connectWallet,
} from "./utils/blockchain";
import { validateQRCodeOffline, type QRValidationResult } from "./utils/qrValidator";
import { copyToClipboardWithFeedback } from "./utils/clipboard";
import { useToast } from "./contexts/ToastContext";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { addCachedVerification, getCachedVerification, type CachedVerification } from "./utils/transactionCache";
import { CURRENT_NETWORK } from "./config";
import ManufacturerDashboard from "./components/ManufacturerDashboard";
import VerificationHistory from "./components/VerificationHistory";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import PrivacyPolicy from "./components/PrivacyPolicy";
import TermsOfService from "./components/TermsOfService";
import FAQ from "./components/FAQ";
import About from "./components/About";
import NotFound from "./components/NotFound";
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
  const { showToast } = useToast();
  
  // Application state
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{
    status: "authentic" | "fake" | "error" | null;
    message: string;
    productName?: string;
    productBrand?: string;
    txHash?: string;
    blockNumber?: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");
  const [scanner, setScanner] = useState<Html5QrcodeScanner | null>(null);
  const qrReaderRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"verify" | "dashboard" | "history" | "analytics" | "faq" | "privacy" | "terms" | "about" | "404">("verify");

  // Check URL hash for navigation
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash === "faq" || hash === "privacy" || hash === "terms" || hash === "about" || hash === "404") {
      setActiveTab(hash as any);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    
    const handleHashChange = () => {
      const newHash = window.location.hash.slice(1);
      if (newHash === "faq" || newHash === "privacy" || newHash === "terms" || newHash === "about" || newHash === "404") {
        setActiveTab(newHash as any);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (newHash === "" || newHash === "verify") {
        setActiveTab("verify");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

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
        showToast("Wallet connected successfully!", "success");
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
    // Use requestAnimationFrame for better timing
    const initScanner = async () => {
      // Wait for next frame to ensure DOM is fully rendered
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => setTimeout(resolve, 200)); // Additional small delay
      
      const element = document.getElementById("qr-reader");
      if (!element) {
        console.error("QR reader element not found after delay");
        setScanning(false);
        setResult({
          status: "error",
          message: "Failed to initialize scanner. Please try again.",
        });
        return;
      }

      console.log("QR reader element found, initializing scanner...");

      // Clear any existing scanner first
      if (scanner) {
        try {
          scanner.clear();
          setScanner(null);
        } catch (e) {
          console.log("Error clearing previous scanner:", e);
        }
      }

      // Initialize QR scanner with mobile-optimized settings
      const isMobile = window.innerWidth <= 768;
      let qrScanner: Html5QrcodeScanner;
      
      try {
        // Clear the element first to ensure clean state
        element.innerHTML = "";

        // Calculate optimal QR box size based on container
        const containerWidth = element.offsetWidth || (isMobile ? window.innerWidth - 60 : 400);
        const containerHeight = element.offsetHeight || 400;
        const maxSize = Math.min(containerWidth - 40, containerHeight - 40, isMobile ? 250 : 300);
        const qrBoxSize = Math.max(200, maxSize);

        console.log("Initializing QR scanner with box size:", qrBoxSize, "Container:", containerWidth, "x", containerHeight);

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
          true // verbose mode on for debugging
        );

        setScanner(qrScanner);
        setLoading(true);

        console.log("QR scanner instance created, calling render()...");

        // Start scanning with proper error handling
        qrScanner.render(
          async (decodedText) => {
            console.log("QR Code detected:", decodedText);
            setLoading(false);
            // Stop scanner when QR code is detected
            try {
              qrScanner.clear();
            } catch (e) {
              console.log("Error clearing scanner:", e);
            }
            setScanning(false);
            setScanner(null);

            // Process the scanned QR code
            await processQRCode(decodedText);
          },
          (errorMessage: any) => {
            console.log("QR scanner error callback triggered:", errorMessage);
            
            // Handle both string and object error messages
            const errorStr = typeof errorMessage === "string" 
              ? errorMessage 
              : (errorMessage && typeof errorMessage === "object" && "message" in errorMessage)
                ? String(errorMessage.message)
                : String(errorMessage);
            
            // Check for camera-specific errors
            if (errorStr && (
              errorStr.includes("Permission") || 
              errorStr.includes("NotAllowedError") ||
              errorStr.includes("NotReadableError") ||
              errorStr.includes("NotFoundError") ||
              errorStr.includes("Could not start video stream") ||
              errorStr.includes("camera") ||
              errorStr.includes("Camera")
            )) {
              setLoading(false);
              setScanning(false);
              try {
                qrScanner.clear();
              } catch (e) {
                console.log("Error clearing scanner:", e);
              }
              setScanner(null);
              setResult({
                status: "error",
                message: errorStr.includes("Permission") || errorStr.includes("NotAllowedError")
                  ? "Camera permission denied. Please allow camera access in your browser settings and try again."
                  : errorStr.includes("NotFoundError")
                  ? "No camera found. Please connect a camera and try again."
                  : "Camera access failed. Please check your camera and try again.",
              });
              return;
            }

            // Only log non-common scanning errors (not "No QR code found" messages)
            if (errorStr && 
                !errorStr.includes("NotFoundException") && 
                !errorStr.includes("No QR code") &&
                !errorStr.includes("No barcode") &&
                !errorStr.includes("parse error") &&
                !errorStr.includes("QR code parse error") &&
                !errorStr.includes("QR code parse error, error =")) {
              console.log("QR scanning error (non-critical):", errorStr);
            }
          }
        );

        console.log("QR scanner render() called, waiting for camera to start...");

        // Check if camera started by looking for video element
        let checkCount = 0;
        const maxChecks = 10;
        const checkCameraStarted = () => {
          checkCount++;
          const videoElement = element.querySelector("video");
          if (videoElement) {
            console.log("Camera video element found!");
            // Wait for video to be ready
            const onVideoReady = () => {
              setLoading(false);
              console.log("Video is ready and playing");
            };
            
            if (videoElement.readyState >= 2) {
              onVideoReady();
            } else {
              videoElement.addEventListener("loadeddata", onVideoReady, { once: true });
              videoElement.addEventListener("playing", onVideoReady, { once: true });
            }
          } else if (checkCount < maxChecks) {
            setTimeout(checkCameraStarted, 500);
          } else {
            console.log("Camera not found after multiple attempts");
            setLoading(false);
          }
        };

        // Start checking after a short delay
        setTimeout(checkCameraStarted, 500);
        
        // Fallback to hide loading after reasonable time
        setTimeout(() => {
          setLoading(false);
        }, 3000);
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
    };

    // Start initialization
    initScanner();

    // Cleanup function
    return () => {
      if (scanner) {
        try {
          scanner.clear();
          setScanner(null);
        } catch (e) {
          console.log("Error in cleanup:", e);
        }
      }
    };
  }, [scanning, walletConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Stop QR scanner
   */
  const stopScan = useCallback(() => {
    if (scanner) {
      scanner.clear();
      setScanner(null);
    }
    setScanning(false);
  }, [scanner]);


  /**
   * Process scanned QR code and verify on blockchain
   * Expected format: "BATCH_ID:SERIAL_NUMBER" or JSON with batchId and serialNumber
   */
  const processQRCode = async (qrData: string) => {
    setLoading(true);
    setResult(null);

    try {
      // First, validate QR code format offline
      const validation: QRValidationResult = validateQRCodeOffline(qrData);
      if (!validation.valid || !validation.batchId || !validation.serialNumber) {
        throw new Error(validation.error || "Invalid QR code format");
      }

      const { batchId, serialNumber } = validation;

      // Generate serial hash
      const serialHash = generateSerialHash(batchId, serialNumber);

      // Check cache first
      const cached: CachedVerification | null = getCachedVerification(serialHash);
      if (cached && cached.txHash) {
        // Use cached result if available
        setResult({
          status: cached.isAuthentic ? "authentic" : "fake",
          message: cached.isAuthentic ? "Product verified as AUTHENTIC" : "WARNING: This product may be COUNTERFEIT",
          productName: cached.productName,
          productBrand: cached.productBrand,
          txHash: cached.txHash,
          blockNumber: cached.blockNumber,
        });
        setTxStatus("success");
        showToast(cached.isAuthentic ? "Product verified (from cache)" : "Warning: Product may be counterfeit (from cache)", cached.isAuthentic ? "success" : "warning");
        setLoading(false);
        return;
      }

      // Set transaction status to pending
      setTxStatus("pending");

      // Verify on blockchain
      const verificationResult = await verifyProduct(serialHash, batchId);

      // Set transaction status to success
      setTxStatus("success");

      // Cache the verification result
      if (verificationResult.txHash) {
        addCachedVerification({
          serialHash,
          batchId,
          serialNumber,
          isAuthentic: verificationResult.isAuthentic,
          verifier: await getCurrentAccount() || "",
          timestamp: Math.floor(Date.now() / 1000),
          txHash: verificationResult.txHash,
          blockNumber: verificationResult.blockNumber,
          productName: verificationResult.productName,
          productBrand: verificationResult.productBrand,
        });
      }

      // Set result based on verification
      if (verificationResult.isAuthentic) {
        setResult({
          status: "authentic",
          message: "Product verified as AUTHENTIC",
          productName: verificationResult.productName,
          productBrand: verificationResult.productBrand,
          txHash: verificationResult.txHash,
          blockNumber: verificationResult.blockNumber,
        });
        showToast("Product verified as authentic!", "success");
      } else {
        setResult({
          status: "fake",
          message: "WARNING: This product may be COUNTERFEIT",
          productName: verificationResult.productName,
          productBrand: verificationResult.productBrand,
          txHash: verificationResult.txHash,
          blockNumber: verificationResult.blockNumber,
        });
        showToast("Warning: Product may be counterfeit", "warning");
      }
    } catch (error: any) {
      console.error("Verification error:", error);
      setTxStatus("failed");
      
      // Better error messages with user-friendly descriptions
      let errorMessage = "Failed to verify product. Please try again.";
      
      if (error.message) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes("user rejected") || errorMsg.includes("rejected")) {
          errorMessage = "Transaction was rejected. Please approve the transaction in MetaMask to continue.";
        } else if (errorMsg.includes("insufficient funds") || errorMsg.includes("gas")) {
          errorMessage = "Insufficient funds for transaction. Please ensure you have enough ETH/MATIC for gas fees.";
        } else if (errorMsg.includes("network") || errorMsg.includes("connection")) {
          errorMessage = "Network connection error. Please check your internet connection and try again.";
        } else if (errorMsg.includes("not found") || errorMsg.includes("batch")) {
          errorMessage = "Product batch not found. The QR code may be invalid or the product may not be registered.";
        } else if (errorMsg.includes("invalid") || errorMsg.includes("format")) {
          errorMessage = error.message;
        } else if (errorMsg.includes("revert") || errorMsg.includes("execution reverted")) {
          errorMessage = "Transaction failed. The product may already be verified or the QR code may be invalid.";
        } else {
          errorMessage = error.message;
        }
      }
      
      setResult({
        status: "error",
        message: errorMessage,
      });
      showToast(errorMessage, "error");
    } finally {
      setLoading(false);
      // Reset tx status after a delay
      setTimeout(() => {
        if (txStatus === "success" || txStatus === "failed") {
          setTxStatus("idle");
        }
      }, 5000);
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

  // Keyboard shortcuts - memoized to prevent recreation on every render
  const shortcuts = useMemo(() => [
    {
      key: "k",
      ctrlKey: true,
      metaKey: true,
      action: () => {
        if (walletConnected) {
          showToast("Keyboard Shortcuts:\nEsc - Cancel scan\nCtrl/Cmd+K - Show shortcuts\n1-4 - Navigate tabs", "info", 5000);
        }
      },
      description: "Show keyboard shortcuts",
    },
    {
      key: "Escape",
      action: () => {
        if (scanning) {
          stopScan();
          showToast("Scan cancelled", "info", 2000);
        }
      },
      description: "Cancel scan",
    },
    {
      key: "1",
      ctrlKey: true,
      metaKey: true,
      action: () => {
        if (walletConnected) {
          setActiveTab("verify");
          window.location.hash = "";
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      },
      description: "Go to Verify Product",
    },
    {
      key: "2",
      ctrlKey: true,
      metaKey: true,
      action: () => {
        if (walletConnected) {
          setActiveTab("history");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      },
      description: "Go to Verification History",
    },
    {
      key: "3",
      ctrlKey: true,
      metaKey: true,
      action: () => {
        if (walletConnected) {
          setActiveTab("analytics");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      },
      description: "Go to Analytics",
    },
    {
      key: "4",
      ctrlKey: true,
      metaKey: true,
      action: () => {
        if (walletConnected) {
          setActiveTab("dashboard");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      },
      description: "Go to Manufacturer Dashboard",
    },
  ], [walletConnected, scanning, showToast, stopScan, setActiveTab]);
  
  // Keyboard shortcuts - disabled in development to avoid React null errors during HMR
  // Always call the hook (Rules of Hooks) but it will be disabled in development
  useKeyboardShortcuts(
    shortcuts && Array.isArray(shortcuts) ? shortcuts : [], 
    import.meta.env.PROD // Only enabled in production
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <img 
            src="/logo.png" 
            alt="ChainCheck Logo" 
            className="app-logo"
            onClick={() => {
              setActiveTab("verify");
              window.location.hash = "";
            }}
            style={{ cursor: "pointer" }}
          />
          <div className="header-text">
            <h1>
              <span className="title-chain">Chain</span>
              <span className="title-check">Check</span>
            </h1>
            <p className="subtitle">Verify Product Authenticity</p>
          </div>
        </div>
      </header>

      <main className="app-main">
        {/* Navigation Tabs */}
        {walletConnected && (
          <div className="nav-tabs">
            <button
              className={`nav-tab ${activeTab === "verify" ? "active" : ""}`}
              onClick={() => setActiveTab("verify")}
            >
              Verify Product
            </button>
            <button
              className={`nav-tab ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              Verification History
            </button>
            <button
              className={`nav-tab ${activeTab === "analytics" ? "active" : ""}`}
              onClick={() => setActiveTab("analytics")}
            >
              Analytics
            </button>
            <button
              className={`nav-tab ${activeTab === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveTab("dashboard")}
            >
              Manufacturer Dashboard
            </button>
          </div>
        )}

        {/* FAQ Page */}
        {activeTab === "faq" && <FAQ />}

        {/* About Page */}
        {activeTab === "about" && <About />}

        {/* Privacy Policy */}
        {activeTab === "privacy" && <PrivacyPolicy />}

        {/* Terms of Service */}
        {activeTab === "terms" && <TermsOfService />}

        {/* 404 Page */}
        {activeTab === "404" && <NotFound />}

        {/* Verification History */}
        {walletConnected && activeTab === "history" && (
          <VerificationHistory />
        )}

        {/* Analytics Dashboard */}
        {walletConnected && activeTab === "analytics" && (
          <AnalyticsDashboard />
        )}

        {/* Manufacturer Dashboard */}
        {walletConnected && activeTab === "dashboard" && (
          <ManufacturerDashboard />
        )}

        {/* Verification Section */}
        {activeTab === "verify" && (
          <>
            {/* Beta Banner */}
            <div className="beta-banner">
              <span className="beta-badge">BETA</span>
              <span className="beta-text">Site under active development</span>
            </div>

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
                <div className="scanner-container">
                  <div className="scanner-header">
                    <h3>Scan QR Code</h3>
                    <p>Position the QR code within the frame</p>
                  </div>
                  <div id="qr-reader" ref={qrReaderRef} className="qr-reader-wrapper"></div>
                  <button onClick={stopScan} className="btn btn-secondary btn-cancel-scan">
                    Cancel Scan
                  </button>
                </div>
              </div>
            )}

            {/* Transaction Status Indicator */}
            {txStatus === "pending" && (
              <div className="tx-status tx-pending">
                <div className="spinner"></div>
                <p>Transaction pending... Waiting for confirmation</p>
              </div>
            )}

            {/* Loading State for verification */}
            {loading && !scanning && txStatus !== "pending" && (
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
                {result.txHash && (
                  <div className="tx-info">
                    <p>
                      <strong>Transaction:</strong>{" "}
                      <a
                        href={`${CURRENT_NETWORK.name === "Localhost" ? "#" : `https://${CURRENT_NETWORK.name === "Mumbai Testnet" ? "mumbai.polygonscan.com" : "polygonscan.com"}/tx/${result.txHash}`}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tx-link"
                      >
                        {result.txHash.substring(0, 10)}...{result.txHash.substring(result.txHash.length - 8)}
                      </a>
                      <button
                        onClick={() => copyToClipboardWithFeedback(result.txHash!, showToast)}
                        className="btn-copy"
                        title="Copy transaction hash"
                        aria-label="Copy transaction hash"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    </p>
                    {result.blockNumber && (
                      <p>
                        <strong>Block:</strong> {result.blockNumber.toString()}
                      </p>
                    )}
                  </div>
                )}
                <div className="result-actions">
                  <button onClick={reset} className="btn btn-primary">
                    Scan Another Product
                  </button>
                  {result.status !== "error" && (
                    <button
                      onClick={async () => {
                        const shareText = `ChainCheck Verification Result:\n${result.message}\nProduct: ${result.productName}\nBrand: ${result.productBrand}\n${result.txHash ? `Transaction: ${result.txHash}` : ""}`;
                        if (navigator.share) {
                          try {
                            await navigator.share({
                              title: "ChainCheck Verification",
                              text: shareText,
                            });
                            showToast("Result shared successfully!", "success");
                          } catch (err) {
                            // User cancelled or error occurred
                            if ((err as Error).name !== "AbortError") {
                              await copyToClipboardWithFeedback(shareText, showToast);
                            }
                          }
                        } else {
                          await copyToClipboardWithFeedback(shareText, showToast);
                        }
                      }}
                      className="btn btn-secondary"
                    >
                      Share Result
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

            {/* Instructions - Only show on verify tab */}
            {activeTab === "verify" && (
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
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-links">
            <a 
              href="#about"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab("about");
                window.location.hash = "about";
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="footer-link"
            >
              About
            </a>
            <span className="footer-separator">•</span>
            <a 
              href="#faq"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab("faq");
                window.location.hash = "faq";
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="footer-link"
            >
              FAQ
            </a>
            <span className="footer-separator">•</span>
            <a 
              href="#privacy"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab("privacy");
                window.location.hash = "privacy";
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="footer-link"
            >
              Privacy Policy
            </a>
            <span className="footer-separator">•</span>
            <a 
              href="#terms"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab("terms");
                window.location.hash = "terms";
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="footer-link"
            >
              Terms of Service
            </a>
            <span className="footer-separator">•</span>
            <a 
              href="https://github.com/CodeAndCoffeeGuy/Chaincheck" 
              target="_blank" 
              rel="noopener noreferrer"
              className="github-link"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

