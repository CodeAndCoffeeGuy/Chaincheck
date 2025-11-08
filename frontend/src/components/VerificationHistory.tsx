import { useState } from "react";
import { getContract, generateSerialHash } from "../utils/blockchain";
import "./VerificationHistory.css";

/**
 * Verification History Component
 * 
 * Displays verification history for a given serial number
 */
function VerificationHistory() {
  const [batchId, setBatchId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);

  /**
   * Load verification history
   */
  const loadHistory = async () => {
    if (!batchId || !serialNumber) {
      setError("Please enter both batch ID and serial number");
      return;
    }

    setLoading(true);
    setError(null);
    setHistory([]);
    setCount(null);

    try {
      const serialHash = generateSerialHash(parseInt(batchId), serialNumber);
      const contract = getContract();

      // Get verification count
      const verificationCount = await contract.getVerificationCount(serialHash);
      setCount(Number(verificationCount));

      // Get verification history
      const historyData = await contract.getVerificationHistory(serialHash);
      
      // Convert BigInt to numbers and format data
      const formattedHistory = historyData.map((record: any) => ({
        serialHash: record.serialHash,
        batchId: Number(record.batchId),
        verifier: record.verifier,
        timestamp: Number(record.timestamp),
        isAuthentic: record.isAuthentic,
        date: new Date(Number(record.timestamp) * 1000).toLocaleString(),
      }));

      setHistory(formattedHistory);
    } catch (err: any) {
      console.error("Error loading history:", err);
      setError(err.message || "Failed to load verification history");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Export history as CSV
   */
  const exportHistory = () => {
    if (history.length === 0) return;

    const csv = [
      ["Date", "Batch ID", "Verifier", "Status", "Timestamp"].join(","),
      ...history.map((record) =>
        [
          record.date,
          record.batchId,
          record.verifier,
          record.isAuthentic ? "Authentic" : "Counterfeit",
          record.timestamp,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verification-history-${batchId}-${serialNumber}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="verification-history">
      <h2>Verification History</h2>
      <p className="subtitle">View all verifications for a product serial number</p>

      <div className="history-form">
        <div className="form-group">
          <label>Batch ID</label>
          <input
            type="number"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            placeholder="Enter batch ID"
          />
        </div>
        <div className="form-group">
          <label>Serial Number</label>
          <input
            type="text"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="Enter serial number"
          />
        </div>
        <button onClick={loadHistory} className="btn btn-primary" disabled={loading}>
          {loading ? "Loading..." : "Load History"}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {count !== null && (
        <div className="history-summary">
          <p>
            <strong>Total Verifications:</strong> {count}
          </p>
        </div>
      )}

      {history.length > 0 && (
        <>
          <div className="history-actions">
            <button onClick={exportHistory} className="btn btn-secondary">
              Export as CSV
            </button>
          </div>
          <div className="history-list">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Batch ID</th>
                  <th>Verifier</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record, index) => (
                  <tr key={index}>
                    <td>{record.date}</td>
                    <td>{record.batchId}</td>
                    <td className="address-cell">
                      {record.verifier.substring(0, 6)}...
                      {record.verifier.substring(record.verifier.length - 4)}
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          record.isAuthentic ? "status-authentic" : "status-fake"
                        }`}
                      >
                        {record.isAuthentic ? "Authentic" : "Counterfeit"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {loading && (
        <div className="loading-section">
          <div className="spinner"></div>
          <p>Loading verification history...</p>
        </div>
      )}
    </div>
  );
}

export default VerificationHistory;

