/**
 * Transaction History Caching Utility
 * Caches verification results for faster access and offline support
 */

interface CachedVerification {
  serialHash: string;
  batchId: number;
  serialNumber: string;
  isAuthentic: boolean;
  verifier: string;
  timestamp: number;
  txHash: string;
  blockNumber?: number;
  productName?: string;
  productBrand?: string;
  cachedAt: number;
}

const CACHE_KEY = "chaincheck_verification_cache";
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const MAX_CACHE_SIZE = 1000; // Maximum number of cached verifications

/**
 * Get all cached verifications
 */
export const getCachedVerifications = (): CachedVerification[] => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return [];

    const verifications: CachedVerification[] = JSON.parse(cached);
    const now = Date.now();

    // Filter out expired entries
    const valid = verifications.filter((v) => now - v.cachedAt < CACHE_EXPIRY);

    // Update cache if entries were removed
    if (valid.length !== verifications.length) {
      saveCachedVerifications(valid);
    }

    return valid;
  } catch (error) {
    console.error("Error reading verification cache:", error);
    return [];
  }
};

/**
 * Save cached verifications
 */
const saveCachedVerifications = (verifications: CachedVerification[]): void => {
  try {
    // Limit cache size
    const limited = verifications.slice(-MAX_CACHE_SIZE);
    localStorage.setItem(CACHE_KEY, JSON.stringify(limited));
  } catch (error) {
    console.error("Error saving verification cache:", error);
  }
};

/**
 * Add verification to cache
 */
export const addCachedVerification = (verification: Omit<CachedVerification, "cachedAt">): void => {
  try {
    const cached = getCachedVerifications();
    const now = Date.now();

    // Remove duplicate if exists (same serialHash)
    const filtered = cached.filter((v) => v.serialHash !== verification.serialHash);

    // Add new verification
    const newVerification: CachedVerification = {
      ...verification,
      cachedAt: now,
    };

    // Add to beginning and limit size
    const updated = [newVerification, ...filtered].slice(0, MAX_CACHE_SIZE);
    saveCachedVerifications(updated);
  } catch (error) {
    console.error("Error adding verification to cache:", error);
  }
};

/**
 * Get cached verification by serial hash
 */
export const getCachedVerification = (serialHash: string): CachedVerification | null => {
  try {
    const cached = getCachedVerifications();
    const verification = cached.find((v) => v.serialHash === serialHash);

    if (verification) {
      return verification;
    }

    return null;
  } catch (error) {
    console.error("Error getting cached verification:", error);
    return null;
  }
};

/**
 * Clear all cached verifications
 */
export const clearVerificationCache = (): void => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error("Error clearing verification cache:", error);
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = (): {
  total: number;
  size: number;
  oldest: number | null;
  newest: number | null;
} => {
  try {
    const cached = getCachedVerifications();
    if (cached.length === 0) {
      return {
        total: 0,
        size: 0,
        oldest: null,
        newest: null,
      };
    }

    const timestamps = cached.map((v) => v.cachedAt);
    const size = new Blob([JSON.stringify(cached)]).size;

    return {
      total: cached.length,
      size: size,
      oldest: Math.min(...timestamps),
      newest: Math.max(...timestamps),
    };
  } catch (error) {
    console.error("Error getting cache stats:", error);
    return {
      total: 0,
      size: 0,
      oldest: null,
      newest: null,
    };
  }
};

