import { useState, useEffect, useRef } from "react";
import { getContract, generateSerialHash } from "../utils/blockchain";
import {
  saveVerificationHistoryForm,
  getVerificationHistoryForm,
  addRecentSearch,
  getRecentSearches,
  clearRecentSearches,
} from "../utils/localStorage";
import { debounce } from "../utils/debounce";
import SkeletonLoader from "./SkeletonLoader";
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
  const [filteredHistory, setFilteredHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [recentSearches, setRecentSearches] = useState<Array<{ batchId: string; serialNumber: string; timestamp: number }>>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const batchIdInputRef = useRef<HTMLInputElement>(null);
  const serialNumberInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved form data on mount
  useEffect(() => {
    const saved = getVerificationHistoryForm();
    if (saved) {
      setBatchId(saved.batchId);
      setSerialNumber(saved.serialNumber);
    }
    setRecentSearches(getRecentSearches());
  }, []);

  // Auto-save form data
  useEffect(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    if (batchId || serialNumber) {
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveVerificationHistoryForm(batchId, serialNumber);
      }, 1000); // Save after 1 second of no typing
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [batchId, serialNumber]);

  // Close recent searches dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        showRecentSearches &&
        batchIdInputRef.current &&
        serialNumberInputRef.current &&
        !batchIdInputRef.current.contains(target) &&
        !serialNumberInputRef.current.contains(target) &&
        !target.closest(".recent-searches-dropdown")
      ) {
        setShowRecentSearches(false);
      }
    };

    if (showRecentSearches) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showRecentSearches]);

  // Debounced search filter
  const debouncedFilter = useRef(
    debounce((filterValue: string) => {
      if (!filterValue.trim()) {
        setFilteredHistory(history);
        return;
      }

      const lowerFilter = filterValue.toLowerCase();
      const filtered = history.filter((record) => {
        return (
          record.date.toLowerCase().includes(lowerFilter) ||
          record.batchId.toString().includes(lowerFilter) ||
          record.verifier.toLowerCase().includes(lowerFilter) ||
          (record.isAuthentic ? "authentic" : "counterfeit").includes(lowerFilter)
        );
      });
      setFilteredHistory(filtered);
    }, 300)
  ).current;

  useEffect(() => {
    debouncedFilter(searchFilter);
  }, [searchFilter, history, debouncedFilter]);

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
      setFilteredHistory(formattedHistory);
      
      // Add to recent searches
      addRecentSearch(batchId, serialNumber);
      setRecentSearches(getRecentSearches());
    } catch (err: any) {
      console.error("Error loading history:", err);
      setError(err.message || "Failed to load verification history");
    } finally {
      setLoading(false);
    }
  };

  const handleRecentSearchClick = (search: { batchId: string; serialNumber: string }) => {
    setBatchId(search.batchId);
    setSerialNumber(search.serialNumber);
    setShowRecentSearches(false);
    // Auto-load after setting values
    setTimeout(() => {
      loadHistory();
    }, 100);
  };

  /**
   * Export history as CSV
   */
  const exportHistory = (format: "csv" | "json" = "csv") => {
    if (history.length === 0) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `verification-history-${batchId}-${serialNumber}-${timestamp}`;

    if (format === "csv") {
      // Escape CSV values
      const escapeCsv = (value: any) => {
        if (value === null || value === undefined) return "";
        const str = String(value);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csv = [
        ["Date", "Batch ID", "Serial Number", "Verifier", "Status", "Timestamp", "Unix Timestamp"].join(","),
        ...history.map((record) =>
          [
            escapeCsv(record.date),
            escapeCsv(record.batchId),
            escapeCsv(serialNumber),
            escapeCsv(record.verifier),
            escapeCsv(record.isAuthentic ? "Authentic" : "Counterfeit"),
            escapeCsv(record.timestamp),
            escapeCsv(record.timestamp),
          ].join(",")
        ),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      // Export as JSON
      const jsonData = {
        exportDate: new Date().toISOString(),
        batchId: parseInt(batchId),
        serialNumber: serialNumber,
        totalVerifications: count,
        verifications: history.map((record) => ({
          date: record.date,
          batchId: record.batchId,
          serialNumber: serialNumber,
          verifier: record.verifier,
          status: record.isAuthentic ? "Authentic" : "Counterfeit",
          isAuthentic: record.isAuthentic,
          timestamp: record.timestamp,
          unixTimestamp: record.timestamp,
          serialHash: record.serialHash,
        })),
      };

      const json = JSON.stringify(jsonData, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="verification-history">
      <h2>Verification History</h2>
      <p className="subtitle">View all verifications for a product serial number</p>

      <div className="history-form">
        <div className="form-group">
          <label>Batch ID</label>
          <input
            ref={batchIdInputRef}
            type="number"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            onFocus={() => setShowRecentSearches(recentSearches.length > 0)}
            placeholder="Enter batch ID"
          />
        </div>
        <div className="form-group">
          <label>Serial Number</label>
          <div className="input-with-recent">
            <input
              ref={serialNumberInputRef}
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              onFocus={() => setShowRecentSearches(recentSearches.length > 0)}
              placeholder="Enter serial number"
            />
            {showRecentSearches && recentSearches.length > 0 && (
              <div className="recent-searches-dropdown">
                <div className="recent-searches-header">
                  <span>Recent Searches</span>
                  <button
                    onClick={() => {
                      clearRecentSearches();
                      setRecentSearches([]);
                      setShowRecentSearches(false);
                    }}
                    className="clear-recent-btn"
                    title="Clear all"
                  >
                    Clear
                  </button>
                </div>
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    className="recent-search-item"
                    onClick={() => handleRecentSearchClick(search)}
                  >
                    <span className="recent-search-batch">Batch: {search.batchId}</span>
                    <span className="recent-search-serial">Serial: {search.serialNumber}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
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
            <div className="history-search">
              <input
                type="text"
                placeholder="Search history..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="history-search-input"
              />
              {searchFilter && (
                <button
                  onClick={() => setSearchFilter("")}
                  className="clear-search-btn"
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            <div className="history-export-buttons">
              <button onClick={() => exportHistory("csv")} className="btn btn-secondary">
                Export as CSV
              </button>
              <button onClick={() => exportHistory("json")} className="btn btn-secondary">
                Export as JSON
              </button>
            </div>
          </div>
          {filteredHistory.length === 0 && searchFilter ? (
            <div className="no-results">
              <p>No results found for "{searchFilter}"</p>
            </div>
          ) : (
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
                  {filteredHistory.map((record, index) => (
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
          )}
          {searchFilter && filteredHistory.length > 0 && (
            <div className="search-results-info">
              <p>Showing {filteredHistory.length} of {history.length} results</p>
            </div>
          )}
        </>
      )}

      {loading && (
        <div className="loading-section">
          <SkeletonLoader type="table" />
        </div>
      )}
    </div>
  );
}

export default VerificationHistory;

