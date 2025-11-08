const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * Batch Product Registration Script
 * 
 * Register multiple product batches at once
 * 
 * Usage:
 *   npx hardhat run scripts/batch-register.js --network localhost
 */

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

/**
 * Helper function to generate serial hash
 */
function generateSerialHash(batchId, serialNumber) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "string"],
      [batchId, serialNumber]
    )
  );
}

/**
 * Example products to register
 * Modify this array with your actual products
 */
const PRODUCTS_TO_REGISTER = [
  {
    batchId: 1,
    name: "Premium Sneakers",
    brand: "Nike",
    serials: ["SN001", "SN002", "SN003", "SN004", "SN005"],
    ipfsHash: "",
    description: "",
    imageUrl: ""
  },
  {
    batchId: 2,
    name: "Smart Watch",
    brand: "Apple",
    serials: ["SW001", "SW002", "SW003"],
    ipfsHash: "",
    description: "",
    imageUrl: ""
  },
  {
    batchId: 3,
    name: "Wireless Earbuds",
    brand: "Sony",
    serials: ["WE001", "WE002", "WE003", "WE004", "WE005", "WE006"],
    ipfsHash: "",
    description: "",
    imageUrl: ""
  }
];

async function main() {
  console.log("\n=== Batch Product Registration ===\n");

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log("Deployer address:", signer.address);

  // Get contract instance
  const ChainCheck = await ethers.getContractFactory("ChainCheck");
  const contract = ChainCheck.attach(CONTRACT_ADDRESS);

  // Check if signer is authorized
  const isAuthorized = await contract.authorizedMakers(signer.address);
  if (!isAuthorized) {
    throw new Error("Signer is not authorized to register products");
  }

  console.log("Authorized: YES\n");

  // Register each product batch
  for (const product of PRODUCTS_TO_REGISTER) {
    console.log(`Registering batch ${product.batchId}: ${product.name} (${product.brand})`);

    // Generate serial hashes
    const serialHashes = product.serials.map(serial =>
      generateSerialHash(product.batchId, serial)
    );

      try {
        // Register product (with optional metadata)
        const ipfsHash = product.ipfsHash || "";
        const description = product.description || "";
        const imageUrl = product.imageUrl || "";

        const tx = await contract.registerProduct(
          product.batchId,
          product.name,
          product.brand,
          serialHashes,
          ipfsHash,
          description,
          imageUrl
        );

      console.log("  Transaction hash:", tx.hash);
      console.log("  Waiting for confirmation...");

      const receipt = await tx.wait();
      console.log("  Registered successfully!");
      console.log("  Gas used:", receipt.gasUsed.toString());
      console.log("");

      // Wait a bit between transactions
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`  Failed to register batch ${product.batchId}:`, error.message);
      console.log("");
    }
  }

  // Get final statistics
  console.log("=== Final Statistics ===");
  const stats = await contract.getStatistics();
  console.log("Total Products:", stats.totalProductsCount.toString());
  console.log("Total Verifications:", stats.totalVerificationsCount.toString());
  console.log("Total Manufacturers:", stats.totalManufacturers.toString());
  console.log("\nBatch registration complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n=== Error ===");
    console.error(error);
    process.exitCode = 1;
  });

