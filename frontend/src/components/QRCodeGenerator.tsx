import { useState } from "react";
import {
  generateQRCodeDataURL,
  downloadQRCode,
  generateProductQRData,
  generateBatchQRCodes,
} from "../utils/qrGenerator";
import { useToast } from "../contexts/ToastContext";
import "./QRCodeGenerator.css";

/**
 * QR Code Generator Component
 * Allows manufacturers to generate QR codes for their products
 */
function QRCodeGenerator() {
  const { showToast } = useToast();
  const [batchId, setBatchId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [serialNumbers, setSerialNumbers] = useState<string>("");
  const [batchQRCodes, setBatchQRCodes] = useState<string[]>([]);

  const handleGenerate = async () => {
    if (!batchId || !serialNumber) {
      showToast("Please enter both batch ID and serial number", "error");
      return;
    }

    setLoading(true);
    try {
      const data = generateProductQRData(parseInt(batchId), serialNumber);
      const dataUrl = await generateQRCodeDataURL(data, {
        width: 400,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });
      setQrCodeDataUrl(dataUrl);
      showToast("QR code generated successfully!", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to generate QR code", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchGenerate = async () => {
    if (!batchId || !serialNumbers.trim()) {
      showToast("Please enter batch ID and serial numbers", "error");
      return;
    }

    setLoading(true);
    try {
      const serials = serialNumbers
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (serials.length === 0) {
        showToast("Please enter at least one serial number", "error");
        setLoading(false);
        return;
      }

      if (serials.length > 100) {
        showToast("Maximum 100 serial numbers at once", "error");
        setLoading(false);
        return;
      }

      const qrCodes = await generateBatchQRCodes(parseInt(batchId), serials, {
        width: 300,
        margin: 2,
      });
      setBatchQRCodes(qrCodes);
      showToast(`Generated ${qrCodes.length} QR codes!`, "success");
    } catch (error: any) {
      showToast(error.message || "Failed to generate batch QR codes", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format: "png" | "svg" = "png") => {
    if (!batchId || !serialNumber) {
      showToast("Please generate a QR code first", "error");
      return;
    }

    try {
      const data = generateProductQRData(parseInt(batchId), serialNumber);
      const filename = `qrcode-${batchId}-${serialNumber}`;
      await downloadQRCode(data, filename, format);
      showToast(`QR code downloaded as ${format.toUpperCase()}!`, "success");
    } catch (error: any) {
      showToast(error.message || "Failed to download QR code", "error");
    }
  };

  const handleDownloadBatch = async (_index: number, serialNumber: string, format: "png" | "svg" = "png") => {
    try {
      const data = generateProductQRData(parseInt(batchId), serialNumber);
      const filename = `qrcode-${batchId}-${serialNumber}`;
      await downloadQRCode(data, filename, format);
      showToast(`QR code downloaded!`, "success");
    } catch (error: any) {
      showToast(error.message || "Failed to download QR code", "error");
    }
  };

  const handleReset = () => {
    setBatchId("");
    setSerialNumber("");
    setQrCodeDataUrl(null);
    setSerialNumbers("");
    setBatchQRCodes([]);
  };

  return (
    <div className="qr-generator">
      <h2>QR Code Generator</h2>
      <p className="subtitle">Generate QR codes for your products</p>

      <div className="generator-mode-toggle">
        <button
          className={`mode-btn ${!batchMode ? "active" : ""}`}
          onClick={() => {
            setBatchMode(false);
            setBatchQRCodes([]);
          }}
        >
          Single QR Code
        </button>
        <button
          className={`mode-btn ${batchMode ? "active" : ""}`}
          onClick={() => {
            setBatchMode(true);
            setQrCodeDataUrl(null);
          }}
        >
          Batch Generation
        </button>
      </div>

      {!batchMode ? (
        <div className="generator-form">
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
          <button onClick={handleGenerate} className="btn btn-primary" disabled={loading}>
            {loading ? "Generating..." : "Generate QR Code"}
          </button>

          {qrCodeDataUrl && (
            <div className="qr-preview">
              <div className="qr-code-container">
                <img src={qrCodeDataUrl} alt="QR Code" className="qr-code-image" />
              </div>
              <div className="qr-actions">
                <button onClick={() => handleDownload("png")} className="btn btn-secondary">
                  Download PNG
                </button>
                <button onClick={() => handleDownload("svg")} className="btn btn-secondary">
                  Download SVG
                </button>
                <button onClick={handleReset} className="btn btn-secondary">
                  Reset
                </button>
              </div>
              <div className="qr-info">
                <p>
                  <strong>Data:</strong> {generateProductQRData(parseInt(batchId), serialNumber)}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="generator-form">
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
            <label>Serial Numbers (one per line)</label>
            <textarea
              value={serialNumbers}
              onChange={(e) => setSerialNumbers(e.target.value)}
              placeholder="Enter serial numbers, one per line&#10;Example:&#10;SN001&#10;SN002&#10;SN003"
              rows={8}
            />
            <p className="form-hint">Enter up to 100 serial numbers, one per line</p>
          </div>
          <button onClick={handleBatchGenerate} className="btn btn-primary" disabled={loading}>
            {loading ? "Generating..." : "Generate Batch QR Codes"}
          </button>

          {batchQRCodes.length > 0 && (
            <div className="batch-qr-preview">
              <div className="batch-header">
                <h3>Generated QR Codes ({batchQRCodes.length})</h3>
                <button onClick={handleReset} className="btn btn-secondary">
                  Reset
                </button>
              </div>
              <div className="batch-qr-grid">
                {batchQRCodes.map((qrCode, idx) => {
                  const serials = serialNumbers
                    .split("\n")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0);
                  const serialNumber = serials[idx] || `Serial-${idx + 1}`;
                  return (
                    <div key={idx} className="batch-qr-item">
                      <img src={qrCode} alt={`QR Code ${idx + 1}`} className="batch-qr-image" />
                      <div className="batch-qr-info">
                        <p className="batch-qr-serial">{serialNumber}</p>
                        <div className="batch-qr-actions">
                          <button
                            onClick={() => handleDownloadBatch(idx, serialNumber, "png")}
                            className="btn btn-small"
                            title="Download PNG"
                          >
                            PNG
                          </button>
                          <button
                            onClick={() => handleDownloadBatch(idx, serialNumber, "svg")}
                            className="btn btn-small"
                            title="Download SVG"
                          >
                            SVG
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default QRCodeGenerator;

