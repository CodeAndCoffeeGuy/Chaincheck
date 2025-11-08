/**
 * Script to register a product on ChainCheck
 * 
 * Usage:
 *   npx hardhat run scripts/register-product.js --network localhost
 * 
 * This script demonstrates how to register a product batch
 * with serial numbers on the ChainCheck contract.
 */

const hre = require("hardhat");
const { ethers } = require("hardhat");

/**
 * Generate serial hash from batch ID and serial number
 * This matches the format used in the frontend
 */
function generateSerialHash(batchId, serialNumber) {
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "string"],
    [batchId, serialNumber]
  );
  return ethers.keccak256(encoded);
}

async function main() {
  // Get signers
  const [deployer, manufacturer] = await ethers.getSigners();

  console.log("\n=== ChainCheck Product Registration ===");
  console.log("Using account:", deployer.address);

  // Contract address - Update this with your deployed contract address
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  if (!CONTRACT_ADDRESS) {
    console.error("Error: CONTRACT_ADDRESS not set");
    console.log("Set it in .env or pass as environment variable");
    process.exit(1);
  }

  // Get contract instance
  const ChainCheck = await ethers.getContractFactory("ChainCheck");
  const chaincheck = ChainCheck.attach(CONTRACT_ADDRESS);

  // Check if deployer is authorized
  const isAuthorized = await chaincheck.authorizedMakers(deployer.address);
  if (!isAuthorized) {
    console.log("Authorizing deployer as manufacturer...");
    await chaincheck.authorizeManufacturer(deployer.address, true);
    console.log("Deployer authorized.");
  }

  // Example product data
  const batchId = 1;
  const productName = "Premium Sneakers";
  const productBrand = "Nike";
  const serialNumbers = ["SN001", "SN002", "SN003", "SN004", "SN005"];

  // Generate serial hashes
  const serialHashes = serialNumbers.map((serial) =>
    generateSerialHash(batchId, serial)
  );

  console.log("\nProduct Details:");
  console.log("  Batch ID:", batchId);
  console.log("  Name:", productName);
  console.log("  Brand:", productBrand);
  console.log("  Serial Numbers:", serialNumbers.length);

  // Check if product already exists
  const existingProduct = await chaincheck.getProduct(batchId);
  if (existingProduct.exists) {
    console.log("\nWarning: Product batch already exists!");
    console.log("  Existing name:", existingProduct.name);
    console.log("  Existing brand:", existingProduct.brand);
    console.log("\nSkipping registration.");
    return;
  }

  // Register product (with optional metadata)
  const ipfsHash = process.env.IPFS_HASH || "";
  const description = process.env.DESCRIPTION || "";
  const imageUrl = process.env.IMAGE_URL || "";

  console.log("\nRegistering product...");
  const tx = await chaincheck.registerProduct(
    batchId,
    productName,
    productBrand,
    serialHashes,
    ipfsHash,
    description,
    imageUrl
  );

  console.log("Transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log("Transaction confirmed in block:", receipt.blockNumber);

  // Verify registration
  const product = await chaincheck.getProduct(batchId);
  console.log("\n=== Registration Successful ===");
  console.log("Product Name:", product.name);
  console.log("Product Brand:", product.brand);
  console.log("Registered At:", new Date(Number(product.registeredAt) * 1000));

  console.log("\n=== Next Steps ===");
  console.log("1. Generate QR codes for each serial number:");
  serialNumbers.forEach((serial) => {
    console.log(
      `   http://localhost:3001/qr?batchId=${batchId}&serialNumber=${serial}`
    );
  });
  console.log("\n2. Test verification in the frontend");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n=== Registration Failed ===");
    console.error(error);
    process.exitCode = 1;
  });

