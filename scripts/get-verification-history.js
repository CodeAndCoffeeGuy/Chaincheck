const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * Get Verification History Script
 * 
 * Query verification history for a product serial number
 * 
 * Usage:
 *   npx hardhat run scripts/get-verification-history.js --network localhost --serial-hash <hash>
 *   npx hardhat run scripts/get-verification-history.js --network localhost --batch-id 1 --serial SN001
 */

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Parse command line arguments
const args = process.argv.slice(2);
let serialHash = null;
let batchId = null;
let serialNumber = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--serial-hash" && args[i + 1]) {
    serialHash = args[i + 1];
    i++;
  } else if (args[i] === "--batch-id" && args[i + 1]) {
    batchId = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === "--serial" && args[i + 1]) {
    serialNumber = args[i + 1];
    i++;
  }
}

/**
 * Generate serial hash from batch ID and serial number
 */
function generateSerialHash(batchId, serialNumber) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "string"],
      [batchId, serialNumber]
    )
  );
}

async function main() {
  console.log("\n=== Verification History Query ===\n");
  console.log("Contract Address:", CONTRACT_ADDRESS);
  console.log("");

  // Get contract instance
  const ChainCheck = await ethers.getContractFactory("ChainCheck");
  const contract = ChainCheck.attach(CONTRACT_ADDRESS);

  // Determine serial hash
  if (!serialHash) {
    if (batchId && serialNumber) {
      serialHash = generateSerialHash(batchId, serialNumber);
      console.log("Generated serial hash from batch ID and serial number");
      console.log("  Batch ID:", batchId);
      console.log("  Serial Number:", serialNumber);
      console.log("  Serial Hash:", serialHash);
      console.log("");
    } else {
      console.log("Error: Serial hash required");
      console.log("\nUsage:");
      console.log("  --serial-hash <hash>     Direct serial hash");
      console.log("  --batch-id <id> --serial <number>  Generate hash from batch ID and serial");
      console.log("\nExample:");
      console.log('  npx hardhat run scripts/get-verification-history.js --network localhost --batch-id 1 --serial "SN001"');
      return;
    }
  }

  // Get verification count
  const count = await contract.getVerificationCount(serialHash);
  console.log("Verification Count:", count.toString());
  console.log("");

  if (count === 0) {
    console.log("No verification history found for this serial number.");
    return;
  }

  // Get verification history
  const history = await contract.getVerificationHistory(serialHash);
  console.log("Verification History:");
  console.log("");

  history.forEach((record, index) => {
    const date = new Date(Number(record.timestamp) * 1000);
    const status = record.isAuthentic ? "AUTHENTIC" : "COUNTERFEIT";
    
    console.log(`Record ${index + 1}:`);
    console.log("  Status:", status);
    console.log("  Verifier:", record.verifier);
    console.log("  Batch ID:", record.batchId.toString());
    console.log("  Timestamp:", date.toISOString());
    console.log("  Block Time:", date.toLocaleString());
    console.log("");
  });

  // Summary
  const authenticCount = history.filter(r => r.isAuthentic).length;
  const counterfeitCount = history.filter(r => !r.isAuthentic).length;
  
  console.log("Summary:");
  console.log("  Total Verifications:", count.toString());
  console.log("  Authentic:", authenticCount);
  console.log("  Potential Counterfeits:", counterfeitCount);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n=== Error ===");
    console.error(error);
    process.exitCode = 1;
  });

