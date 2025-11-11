import QRCode from "qrcode";

/**
 * Generate QR code as data URL (for display)
 * @param data The data to encode in the QR code
 * @param options QR code generation options
 * @returns Promise resolving to data URL string
 */
export const generateQRCodeDataURL = async (
  data: string,
  options?: {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }
): Promise<string> => {
  try {
    const defaultOptions = {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      ...options,
    };

    return await QRCode.toDataURL(data, defaultOptions);
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw new Error("Failed to generate QR code");
  }
};

/**
 * Generate QR code as SVG string
 * @param data The data to encode in the QR code
 * @param options QR code generation options
 * @returns Promise resolving to SVG string
 */
export const generateQRCodeSVG = async (
  data: string,
  options?: {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }
): Promise<string> => {
  try {
    const defaultOptions = {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      ...options,
    };

    return await QRCode.toString(data, {
      type: "svg",
      ...defaultOptions,
    });
  } catch (error) {
    console.error("Error generating QR code SVG:", error);
    throw new Error("Failed to generate QR code SVG");
  }
};

/**
 * Download QR code as image
 * @param data The data to encode
 * @param filename Filename for download
 * @param format Image format (png, svg)
 * @param options QR code generation options
 */
export const downloadQRCode = async (
  data: string,
  filename: string = "qrcode",
  format: "png" | "svg" = "png",
  options?: {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }
): Promise<void> => {
  try {
    if (format === "svg") {
      const svg = await generateQRCodeSVG(data, options);
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.svg`;
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      const dataUrl = await generateQRCodeDataURL(data, options);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${filename}.png`;
      a.click();
    }
  } catch (error) {
    console.error("Error downloading QR code:", error);
    throw new Error("Failed to download QR code");
  }
};

/**
 * Generate QR code data for product verification
 * Format: "BATCH_ID:SERIAL_NUMBER"
 * @param batchId Product batch ID
 * @param serialNumber Product serial number
 * @returns QR code data string
 */
export const generateProductQRData = (batchId: number, serialNumber: string): string => {
  return `${batchId}:${serialNumber}`;
};

/**
 * Generate multiple QR codes for batch
 * @param batchId Product batch ID
 * @param serialNumbers Array of serial numbers
 * @param options QR code generation options
 * @returns Promise resolving to array of data URLs
 */
export const generateBatchQRCodes = async (
  batchId: number,
  serialNumbers: string[],
  options?: {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }
): Promise<string[]> => {
  try {
    const qrCodes = await Promise.all(
      serialNumbers.map((serialNumber) => {
        const data = generateProductQRData(batchId, serialNumber);
        return generateQRCodeDataURL(data, options);
      })
    );
    return qrCodes;
  } catch (error) {
    console.error("Error generating batch QR codes:", error);
    throw new Error("Failed to generate batch QR codes");
  }
};

