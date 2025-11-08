const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * Update Product Metadata Script
 * 
 * Update IPFS hash, description, or image URL for existing products
 * 
 * Usage:
 *   npx hardhat run scripts/update-metadata.js --network localhost
 *   npx hardhat run scripts/update-metadata.js --network mumbai --batch-id 1 --ipfs QmHash --description "New desc" --image-url https://example.com/image.jpg
 */

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Parse command line arguments
const args = process.argv.slice(2);
let batchId = null;
let ipfsHash = "";
let description = "";
let imageUrl = "";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--batch-id" && args[i + 1]) {
    batchId = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === "--ipfs" && args[i + 1]) {
    ipfsHash = args[i + 1];
    i++;
  } else if (args[i] === "--description" && args[i + 1]) {
    description = args[i + 1];
    i++;
  } else if (args[i] === "--image-url" && args[i + 1]) {
    imageUrl = args[i + 1];
    i++;
  }
}

async function main() {
  console.log("\n=== Update Product Metadata ===\n");
  console.log("Contract Address:", CONTRACT_ADDRESS);
  console.log("");

  if (!batchId) {
    console.log("Error: Batch ID is required");
    console.log("\nUsage:");
    console.log("  npx hardhat run scripts/update-metadata.js --network <network> --batch-id <id> [options]");
    console.log("\nOptions:");
    console.log("  --batch-id <number>     Product batch ID (required)");
    console.log("  --ipfs <hash>           IPFS hash for product metadata");
    console.log("  --description <text>    Product description");
    console.log("  --image-url <url>       Product image URL");
    console.log("\nExample:");
    console.log('  npx hardhat run scripts/update-metadata.js --network localhost --batch-id 1 --ipfs "QmHash123" --description "Updated description" --image-url "https://example.com/image.jpg"');
    return;
  }

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log("Signer address:", signer.address);

  // Get contract instance
  const ChainCheck = await ethers.getContractFactory("ChainCheck");
  const contract = ChainCheck.attach(CONTRACT_ADDRESS);

  // Check if signer is authorized
  const isAuthorized = await contract.authorizedMakers(signer.address);
  if (!isAuthorized) {
    throw new Error("Signer is not authorized to update products");
  }

  // Check if product exists
  const product = await contract.getProduct(batchId);
  if (!product.exists) {
    throw new Error(`Product batch ${batchId} does not exist`);
  }

  console.log("Current product:", product.name, "by", product.brand);
  console.log("Current IPFS hash:", product.ipfsHash || "(empty)");
  console.log("Current description:", product.description || "(empty)");
  console.log("Current image URL:", product.imageUrl || "(empty)");
  console.log("");

  // Check if any updates provided
  if (!ipfsHash && !description && !imageUrl) {
    console.log("No updates provided. Use --ipfs, --description, or --image-url to update.");
    return;
  }

  console.log("Updating metadata...");
  if (ipfsHash) console.log("  IPFS hash:", ipfsHash);
  if (description) console.log("  Description:", description);
  if (imageUrl) console.log("  Image URL:", imageUrl);
  console.log("");

  // Update metadata
  const tx = await contract.updateProductMetadata(batchId, ipfsHash, description, imageUrl);
  console.log("Transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log("Transaction confirmed!");
  console.log("Gas used:", receipt.gasUsed.toString());
  console.log("");

  // Verify update
  const updatedProduct = await contract.getProduct(batchId);
  console.log("Updated product metadata:");
  console.log("  IPFS hash:", updatedProduct.ipfsHash || "(empty)");
  console.log("  Description:", updatedProduct.description || "(empty)");
  console.log("  Image URL:", updatedProduct.imageUrl || "(empty)");
  console.log("\nMetadata update complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n=== Error ===");
    console.error(error);
    process.exitCode = 1;
  });

