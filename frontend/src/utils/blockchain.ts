import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI, CURRENT_NETWORK } from "../config";

/**
 * Blockchain utility functions
 * 
 * These functions handle all blockchain interactions:
 * - Connecting to wallet
 * - Creating contract instances
 * - Generating serial hashes
 * - Verifying products
 */

/**
 * Check if MetaMask is installed
 * Improved detection that checks for ethereum provider
 */
export function isMetaMaskInstalled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  
  // Check for ethereum provider
  const ethereum = window.ethereum;
  if (!ethereum) {
    return false;
  }
  
  // Check if it's MetaMask specifically (has isMetaMask property)
  return (ethereum.isMetaMask === true) || (ethereum.providers?.some((p: any) => p.isMetaMask === true) ?? false);
}

/**
 * Request account access from MetaMask
 * @returns Array of connected accounts
 */
export async function connectWallet(): Promise<string[]> {
  if (!isMetaMaskInstalled() || !window.ethereum) {
    throw new Error("MetaMask is not installed. Please install MetaMask to continue.");
  }

  try {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    return accounts;
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error("Please connect to MetaMask to continue.");
    }
    throw new Error("Failed to connect wallet: " + error.message);
  }
}

/**
 * Get the current connected account
 * @returns Current account address or null
 */
export async function getCurrentAccount(): Promise<string | null> {
  if (!isMetaMaskInstalled() || !window.ethereum) {
    return null;
  }

  try {
    const accounts = await window.ethereum.request({
      method: "eth_accounts",
    });
    return accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    console.error("Error getting current account:", error);
    return null;
  }
}

/**
 * Switch to the correct network if needed
 */
export async function switchNetwork(): Promise<void> {
  if (!isMetaMaskInstalled() || !window.ethereum) {
    throw new Error("MetaMask is not installed");
  }

  try {
    // Try to switch to the network
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CURRENT_NETWORK.chainId }],
    });
  } catch (switchError: any) {
    // If the network doesn't exist, add it
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: CURRENT_NETWORK.chainId,
              chainName: CURRENT_NETWORK.name,
              rpcUrls: [CURRENT_NETWORK.rpcUrl],
              nativeCurrency: {
                name: "MATIC",
                symbol: "MATIC",
                decimals: 18,
              },
            },
          ],
        });
      } catch (addError) {
        throw new Error("Failed to add network: " + addError);
      }
    } else {
      throw new Error("Failed to switch network: " + switchError.message);
    }
  }
}

/**
 * Get a provider instance
 * @returns ethers provider
 */
export function getProvider(): ethers.BrowserProvider {
  if (!isMetaMaskInstalled() || !window.ethereum) {
    throw new Error("MetaMask is not installed");
  }

  return new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
}

/**
 * Get a contract instance
 * @param signer Optional signer for write operations
 * @returns Contract instance
 */
export function getContract(signer?: ethers.Signer): ethers.Contract {
  const defaultAddress = "0x0000000000000000000000000000000000000000";
  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS.toLowerCase() === defaultAddress.toLowerCase()) {
    throw new Error("Contract address not set. Please deploy the contract first.");
  }

  const provider = signer ? signer : getProvider();
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

/**
 * Generate a serial hash from batch ID and serial number
 * This must match the format used in the smart contract
 * @param batchId Product batch ID
 * @param serialNumber Serial number string
 * @returns Hashed serial number
 */
export function generateSerialHash(
  batchId: number,
  serialNumber: string
): string {
  // This matches the contract's hash generation:
  // keccak256(abi.encodePacked(batchId, serialNumber))
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "string"],
    [batchId, serialNumber]
  );
  return ethers.keccak256(encoded);
}

/**
 * Verify a product on the blockchain
 * @param serialHash Hashed serial number
 * @param batchId Product batch ID
 * @returns Object with verification result and product info
 */
export async function verifyProduct(
  serialHash: string,
  batchId: number
): Promise<{
  isAuthentic: boolean;
  productName: string;
  productBrand: string;
}> {
  try {
    // Connect wallet and get signer
    const accounts = await connectWallet();
    if (accounts.length === 0) {
      throw new Error("No accounts connected");
    }

    // Switch to correct network
    await switchNetwork();

    // Get contract with signer
    const provider = getProvider();
    const signer = await provider.getSigner();
    const contract = getContract(signer);

    // Get product info first
    const product = await contract.getProduct(batchId);
    if (!product.exists) {
      throw new Error("Product batch not found");
    }

    // Perform verification (this will mark serial as verified)
    const isAuthentic = await contract.verify(serialHash, batchId);

    return {
      isAuthentic,
      productName: product.name,
      productBrand: product.brand,
    };
  } catch (error: any) {
    // Handle specific error messages
    if (error.message.includes("user rejected")) {
      throw new Error("Transaction was rejected");
    }
    if (error.message.includes("insufficient funds")) {
      throw new Error("Insufficient funds for transaction");
    }
    if (error.message.includes("network")) {
      throw new Error("Network error. Please check your connection.");
    }
    throw error;
  }
}

/**
 * Check if a serial has already been verified (read-only)
 * @param serialHash Hashed serial number
 * @returns True if serial has been verified before
 */
export async function checkSerialStatus(
  serialHash: string
): Promise<boolean> {
  try {
    const contract = getContract();
    return await contract.isSerialVerified(serialHash);
  } catch (error) {
    console.error("Error checking serial status:", error);
    return false;
  }
}

/**
 * Get product information by batch ID
 * @param batchId Product batch ID
 * @returns Product information
 */
export async function getProductInfo(batchId: number): Promise<{
  name: string;
  brand: string;
  exists: boolean;
  registeredAt: bigint;
}> {
  try {
    const contract = getContract();
    const product = await contract.getProduct(batchId);
    return {
      name: product.name,
      brand: product.brand,
      exists: product.exists,
      registeredAt: product.registeredAt,
    };
  } catch (error) {
    throw new Error("Failed to fetch product information: " + error);
  }
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
      isMetaMask?: boolean;
      providers?: Array<{
        isMetaMask?: boolean;
        request: (args: { method: string; params?: any[] }) => Promise<any>;
      }>;
    };
  }
}

