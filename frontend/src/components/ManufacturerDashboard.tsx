import { useState, useEffect } from "react";
import {
  registerProduct,
  isAuthorizedManufacturer,
  getStatistics,
  connectWallet,
  getCurrentAccount,
} from "../utils/blockchain";
import "./ManufacturerDashboard.css";

/**
 * Manufacturer Dashboard Component
 * 
 * Allows authorized manufacturers to:
 * - Register new product batches
 * - View statistics
 * - Generate QR codes for products
 */
function ManufacturerDashboard() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | null;
    text: string;
  } | null>(null);
  const [statistics, setStatistics] = useState<{
    totalProducts: bigint;
    totalVerifications: bigint;
  } | null>(null);

  // Form state
  const [batchId, setBatchId] = useState("");
  const [productName, setProductName] = useState("");
  const [productBrand, setProductBrand] = useState("");
  const [serialNumbers, setSerialNumbers] = useState("");

  /**
   * Check authorization on mount
   */
  useEffect(() => {
    checkAuthorization();
    loadStatistics();
  }, []);

  /**
   * Check if current account is authorized
   */
  const checkAuthorization = async () => {
    try {
      const account = await getCurrentAccount();
      if (!account) {
        setAuthorized(false);
        return;
      }

      const isAuth = await isAuthorizedManufacturer();
      setAuthorized(isAuth);
    } catch (error: any) {
      console.error("Error checking authorization:", error);
      // Don't show error if contract not deployed - it's expected during development
      if (error.message?.includes("not deployed") || error.code === "BAD_DATA") {
        console.log("Contract not deployed yet - this is normal if you haven't deployed to localhost");
      }
      setAuthorized(false);
    }
  };

  /**
   * Load contract statistics
   */
  const loadStatistics = async () => {
    try {
      const stats = await getStatistics();
      setStatistics(stats);
    } catch (error: any) {
      console.error("Error loading statistics:", error);
      // Don't show error if contract not deployed - it's expected during development
      if (error.message?.includes("not deployed") || error.message?.includes("could not decode")) {
        console.log("Contract not deployed yet - this is normal if you haven't deployed to localhost");
      }
    }
  };

  /**
   * Handle product registration
   */
  const handleRegisterProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Validate form
      if (!batchId || !productName || !productBrand || !serialNumbers) {
        throw new Error("All fields are required");
      }

      const batchIdNum = parseInt(batchId);
      if (isNaN(batchIdNum) || batchIdNum <= 0) {
        throw new Error("Batch ID must be a positive number");
      }

      // Parse serial numbers (comma or newline separated)
      const serialsArray = serialNumbers
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (serialsArray.length === 0) {
        throw new Error("At least one serial number is required");
      }

      // Connect wallet if needed
      await connectWallet();

      // Register product
      const receipt = await registerProduct(
        batchIdNum,
        productName,
        productBrand,
        serialsArray
      );

      setMessage({
        type: "success",
        text: `Product registered successfully! Transaction: ${receipt.hash}`,
      });

      // Reset form
      setBatchId("");
      setProductName("");
      setProductBrand("");
      setSerialNumbers("");

      // Reload statistics
      await loadStatistics();
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.message || "Failed to register product",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Generate QR code URL for a serial number
   */
  const generateQRUrl = (batchId: string, serialNumber: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/qr?batchId=${batchId}&serialNumber=${serialNumber}`;
  };

  if (authorized === null) {
    return (
      <div className="dashboard-section">
        <div className="loading-section">
          <div className="spinner"></div>
          <p>Checking authorization...</p>
        </div>
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="dashboard-section">
        <div className="result-section result-error">
          <h3>Not Authorized</h3>
          <p>You are not authorized to register products.</p>
          <p>Please contact the contract owner to get authorized as a manufacturer.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="manufacturer-dashboard">
      <h2>Manufacturer Dashboard</h2>

      {/* Statistics */}
      {statistics && (
        <div className="stats-section">
          <h3>Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{statistics.totalProducts.toString()}</div>
              <div className="stat-label">Total Products</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{statistics.totalVerifications.toString()}</div>
              <div className="stat-label">Total Verifications</div>
            </div>
          </div>
        </div>
      )}

      {/* Registration Form */}
      <div className="registration-section">
        <h3>Register New Product Batch</h3>
        <form onSubmit={handleRegisterProduct}>
          <div className="form-group">
            <label htmlFor="batchId">Batch ID *</label>
            <input
              type="number"
              id="batchId"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="e.g., 1"
              required
              min="1"
            />
          </div>

          <div className="form-group">
            <label htmlFor="productName">Product Name *</label>
            <input
              type="text"
              id="productName"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g., Premium Sneakers"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="productBrand">Brand Name *</label>
            <input
              type="text"
              id="productBrand"
              value={productBrand}
              onChange={(e) => setProductBrand(e.target.value)}
              placeholder="e.g., Nike"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="serialNumbers">
              Serial Numbers * (one per line or comma-separated)
            </label>
            <textarea
              id="serialNumbers"
              value={serialNumbers}
              onChange={(e) => setSerialNumbers(e.target.value)}
              placeholder="SN001&#10;SN002&#10;SN003"
              rows={5}
              required
            />
            <small>Enter serial numbers separated by commas or new lines</small>
          </div>

          {message && (
            <div className={`result-section result-${message.type}`}>
              <p>{message.text}</p>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? "Registering..." : "Register Product Batch"}
          </button>
        </form>
      </div>

      {/* QR Code Generator Helper */}
      {batchId && serialNumbers && (
        <div className="qr-helper-section">
          <h3>QR Code Generator</h3>
          <p>After registering, generate QR codes using:</p>
          <div className="qr-url-example">
            <code>
              {generateQRUrl(batchId, serialNumbers.split(/[,\n]/)[0].trim())}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManufacturerDashboard;

