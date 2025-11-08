import { useState, useEffect } from "react";
import { getStatistics } from "../utils/blockchain";
import "./AnalyticsDashboard.css";

/**
 * Analytics Dashboard Component
 * 
 * Displays comprehensive analytics and statistics
 */
function AnalyticsDashboard() {
  const [statistics, setStatistics] = useState<{
    totalProducts: bigint;
    totalVerifications: bigint;
    totalManufacturers: bigint;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load analytics data
   */
  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const stats = await getStatistics();
      setStatistics(stats);
    } catch (err: any) {
      console.error("Error loading analytics:", err);
      const errorMessage = err.message || "Failed to load analytics";
      // Provide helpful message if contract not deployed
      if (errorMessage.includes("not deployed") || errorMessage.includes("could not decode")) {
        setError("Contract not deployed. Please deploy the contract to localhost first. See deployment instructions in the README.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="analytics-dashboard">
        <div className="loading-section">
          <div className="spinner"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-dashboard">
        <div className="error-message">
          <p>{error}</p>
          {error.includes("not deployed") && (
            <div style={{ marginTop: "16px", padding: "12px", background: "rgba(255, 107, 53, 0.1)", borderRadius: "8px", fontSize: "0.9rem" }}>
              <p style={{ marginBottom: "8px", fontWeight: "500" }}>To deploy the contract:</p>
              <ol style={{ textAlign: "left", marginLeft: "20px", lineHeight: "1.6" }}>
                <li>Start Hardhat node: <code style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: "4px" }}>npx hardhat node</code></li>
                <li>Deploy contract: <code style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: "4px" }}>npx hardhat run scripts/deploy.js --network localhost</code></li>
                <li>Update CONTRACT_ADDRESS in frontend/src/config.ts</li>
                <li>Refresh this page</li>
              </ol>
            </div>
          )}
          <button onClick={loadAnalytics} className="btn btn-primary" style={{ marginTop: "16px" }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!statistics) {
    return null;
  }

  const totalProducts = Number(statistics.totalProducts);
  const totalVerifications = Number(statistics.totalVerifications);
  const totalManufacturers = statistics.totalManufacturers ? Number(statistics.totalManufacturers) : 0;
  const avgVerificationsPerProduct = totalProducts > 0 ? (totalVerifications / totalProducts).toFixed(2) : "0";

  return (
    <div className="analytics-dashboard">
      <h2>Analytics Dashboard</h2>
      <p className="subtitle">Comprehensive statistics and insights</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-value">{totalProducts.toLocaleString()}</div>
          <div className="stat-label">Total Products</div>
          <div className="stat-description">Registered product batches</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✓</div>
          <div className="stat-value">{totalVerifications.toLocaleString()}</div>
          <div className="stat-label">Total Verifications</div>
          <div className="stat-description">Product authenticity checks</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🏭</div>
          <div className="stat-value">{totalManufacturers.toLocaleString()}</div>
          <div className="stat-label">Manufacturers</div>
          <div className="stat-description">Authorized manufacturers</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-value">{avgVerificationsPerProduct}</div>
          <div className="stat-label">Avg Verifications</div>
          <div className="stat-description">Per product batch</div>
        </div>
      </div>

      <div className="analytics-actions">
        <button onClick={loadAnalytics} className="btn btn-secondary">
          Refresh Data
        </button>
      </div>
    </div>
  );
}

export default AnalyticsDashboard;

