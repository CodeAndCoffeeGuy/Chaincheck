/**
 * ChainCheck Frontend Configuration
 * 
 * Update these values after deploying the contract:
 * 1. CONTRACT_ADDRESS: Address of deployed ChainCheck contract
 * 2. NETWORK_CONFIG: RPC URLs for different networks
 */

// Contract address - Update this after deployment
export const CONTRACT_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

// Network configuration
export const NETWORK_CONFIG = {
  // Polygon Mumbai testnet
  mumbai: {
    chainId: "0x13881", // 80001 in hex
    rpcUrl: "https://rpc-mumbai.maticvigil.com",
    name: "Mumbai Testnet",
  },
  // Polygon mainnet
  polygon: {
    chainId: "0x89", // 137 in hex
    rpcUrl: "https://polygon-rpc.com",
    name: "Polygon Mainnet",
  },
  // Local development
  localhost: {
    chainId: "0x539", // 1337 in hex
    rpcUrl: "http://127.0.0.1:8545",
    name: "Localhost",
  },
};

// Current network to use (change based on deployment)
export const CURRENT_NETWORK = NETWORK_CONFIG.localhost;

// Contract ABI - This will be imported from the compiled contract
// After deployment, copy the ABI from artifacts/contracts/ChainCheck.sol/ChainCheck.json
export const CONTRACT_ABI = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "maker",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "authorized",
        type: "bool",
      },
    ],
    name: "ManufacturerAuthorized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "batchId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "string",
        name: "name",
        type: "string",
      },
      {
        indexed: false,
        internalType: "string",
        name: "brand",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "serialCount",
        type: "uint256",
      },
    ],
    name: "ProductRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes32",
        name: "serialHash",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "batchId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "isAuthentic",
        type: "bool",
      },
      {
        indexed: false,
        internalType: "address",
        name: "verifier",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "Verified",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bool",
        name: "paused",
        type: "bool",
      },
    ],
    name: "Paused",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "maker",
        type: "address",
      },
      {
        internalType: "bool",
        name: "authorized",
        type: "bool",
      },
    ],
    name: "authorizeManufacturer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "authorizedMakers",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "batchId",
        type: "uint256",
      },
    ],
    name: "getProduct",
    outputs: [
      {
        internalType: "string",
        name: "name",
        type: "string",
      },
      {
        internalType: "string",
        name: "brand",
        type: "string",
      },
      {
        internalType: "bool",
        name: "exists",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "registeredAt",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "ipfsHash",
        type: "string",
      },
      {
        internalType: "string",
        name: "description",
        type: "string",
      },
      {
        internalType: "string",
        name: "imageUrl",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "serialHash",
        type: "bytes32",
      },
    ],
    name: "isSerialVerified",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "products",
    outputs: [
      {
        internalType: "string",
        name: "name",
        type: "string",
      },
      {
        internalType: "string",
        name: "brand",
        type: "string",
      },
      {
        internalType: "bool",
        name: "exists",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "registeredAt",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "batchId",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "name",
        type: "string",
      },
      {
        internalType: "string",
        name: "brand",
        type: "string",
      },
      {
        internalType: "bytes32[]",
        name: "serialHashes",
        type: "bytes32[]",
      },
      {
        internalType: "string",
        name: "ipfsHash",
        type: "string",
      },
      {
        internalType: "string",
        name: "description",
        type: "string",
      },
      {
        internalType: "string",
        name: "imageUrl",
        type: "string",
      },
    ],
    name: "registerProduct",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    name: "serialVerified",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalProducts",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalVerifications",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "batchVerificationCount",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "paused",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "serialHash",
        type: "bytes32",
      },
      {
        internalType: "uint256",
        name: "batchId",
        type: "uint256",
      },
    ],
    name: "verify",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getStatistics",
    outputs: [
      {
        internalType: "uint256",
        name: "totalProductsCount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "totalVerificationsCount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "totalManufacturers",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "batchIds",
        type: "uint256[]",
      },
    ],
    name: "getProductsBatch",
    outputs: [
      {
        internalType: "string[]",
        name: "names",
        type: "string[]",
      },
      {
        internalType: "string[]",
        name: "brands",
        type: "string[]",
      },
      {
        internalType: "bool[]",
        name: "existsArray",
        type: "bool[]",
      },
      {
        internalType: "uint256[]",
        name: "registeredAtArray",
        type: "uint256[]",
      },
      {
        internalType: "string[]",
        name: "ipfsHashes",
        type: "string[]",
      },
      {
        internalType: "string[]",
        name: "descriptions",
        type: "string[]",
      },
      {
        internalType: "string[]",
        name: "imageUrls",
        type: "string[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "batchId",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "ipfsHash",
        type: "string",
      },
      {
        internalType: "string",
        name: "description",
        type: "string",
      },
      {
        internalType: "string",
        name: "imageUrl",
        type: "string",
      },
    ],
    name: "updateProductMetadata",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32[]",
        name: "serialHashes",
        type: "bytes32[]",
      },
      {
        internalType: "uint256[]",
        name: "batchIds",
        type: "uint256[]",
      },
    ],
    name: "batchVerify",
    outputs: [
      {
        internalType: "bool[]",
        name: "results",
        type: "bool[]",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getManufacturers",
    outputs: [
      {
        internalType: "address[]",
        name: "",
        type: "address[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "pause",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "unpause",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "serialHash",
        type: "bytes32",
      },
    ],
    name: "getVerificationHistory",
    outputs: [
      {
        components: [
          {
            internalType: "bytes32",
            name: "serialHash",
            type: "bytes32",
          },
          {
            internalType: "uint256",
            name: "batchId",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "verifier",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "bool",
            name: "isAuthentic",
            type: "bool",
          },
        ],
        internalType: "struct ChainCheck.VerificationRecord[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "serialHash",
        type: "bytes32",
      },
    ],
    name: "getVerificationCount",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32[]",
        name: "serialHashes",
        type: "bytes32[]",
      },
    ],
    name: "getVerificationHistoryBatch",
    outputs: [
      {
        components: [
          {
            internalType: "bytes32",
            name: "serialHash",
            type: "bytes32",
          },
          {
            internalType: "uint256",
            name: "batchId",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "verifier",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "bool",
            name: "isAuthentic",
            type: "bool",
          },
        ],
        internalType: "struct ChainCheck.VerificationRecord[][]",
        name: "",
        type: "tuple[][]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "batchVerificationCount",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

