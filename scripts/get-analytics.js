const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * Analytics Script
 * 
 * Get comprehensive analytics and insights from the ChainCheck contract
 * 
 * Usage:
 *   npx hardhat run scripts/get-analytics.js --network localhost
 *   npx hardhat run scripts/get-analytics.js --network mumbai
 */

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

async function main() {
  console.log("\n=== ChainCheck Analytics ===\n");
  console.log("Contract Address:", CONTRACT_ADDRESS);
  console.log("");

  // Get contract instance
  const ChainCheck = await ethers.getContractFactory("ChainCheck");
  const contract = ChainCheck.attach(CONTRACT_ADDRESS);

  // Get basic statistics
  const stats = await contract.getStatistics();
  console.log("=== Overall Statistics ===");
  console.log("Total Products:", stats.totalProductsCount.toString());
  console.log("Total Verifications:", stats.totalVerificationsCount.toString());
  console.log("Total Manufacturers:", stats.totalManufacturers.toString());
  console.log("");

  if (stats.totalProductsCount === 0n) {
    console.log("No products registered yet. Register some products to see analytics.");
    return;
  }

  // Get all manufacturers
  const manufacturers = await contract.getManufacturers();
  console.log("=== Manufacturer Analysis ===");
  
  if (manufacturers.length === 0) {
    console.log("No manufacturers found");
  } else {
    for (let i = 0; i < manufacturers.length; i++) {
      const addr = manufacturers[i];
      const isAuthorized = await contract.authorizedMakers(addr);
      console.log(`${i + 1}. ${addr} - ${isAuthorized ? "Authorized" : "Not Authorized"}`);
    }
  }
  console.log("");

  // Analyze products
  console.log("=== Product Analysis ===");
  
  // Get verification events to analyze
  const currentBlock = await ethers.provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 10000); // Last 10k blocks
  
  const verifiedEvents = await contract.queryFilter(
    contract.filters.Verified(),
    fromBlock,
    "latest"
  );

  let authenticCount = 0;
  let counterfeitCount = 0;
  const batchStats = new Map();
  const verifierStats = new Map();
  const timeStats = {
    today: 0,
    thisWeek: 0,
    thisMonth: 0
  };

  const now = Math.floor(Date.now() / 1000);
  const oneDay = 86400;
  const oneWeek = 7 * oneDay;
  const oneMonth = 30 * oneDay;

  for (const event of verifiedEvents) {
    const args = event.args;
    const isAuthentic = args.isAuthentic;
    
    if (isAuthentic) {
      authenticCount++;
    } else {
      counterfeitCount++;
    }

    // Batch statistics
    const batchId = args.batchId.toString();
    if (!batchStats.has(batchId)) {
      batchStats.set(batchId, { authentic: 0, counterfeit: 0 });
    }
    const batchData = batchStats.get(batchId);
    if (isAuthentic) {
      batchData.authentic++;
    } else {
      batchData.counterfeit++;
    }

    // Verifier statistics
    const verifier = args.verifier.toLowerCase();
    verifierStats.set(verifier, (verifierStats.get(verifier) || 0) + 1);

    // Time-based statistics
    const timestamp = Number(args.timestamp);
    const age = now - timestamp;
    
    if (age < oneDay) timeStats.today++;
    if (age < oneWeek) timeStats.thisWeek++;
    if (age < oneMonth) timeStats.thisMonth++;
  }

  // Verification statistics
  console.log("Verification Breakdown:");
  console.log("  Authentic:", authenticCount);
  console.log("  Potential Counterfeits:", counterfeitCount);
  
  if (authenticCount + counterfeitCount > 0) {
    const authenticRate = (authenticCount / (authenticCount + counterfeitCount) * 100).toFixed(2);
    const counterfeitRate = (counterfeitCount / (authenticCount + counterfeitCount) * 100).toFixed(2);
    console.log("  Authentic Rate:", authenticRate + "%");
    console.log("  Counterfeit Rate:", counterfeitRate + "%");
  }
  console.log("");

  // Time-based statistics
  console.log("=== Time-Based Statistics ===");
  console.log("Verifications Today:", timeStats.today);
  console.log("Verifications This Week:", timeStats.thisWeek);
  console.log("Verifications This Month:", timeStats.thisMonth);
  console.log("");

  // Top batches
  if (batchStats.size > 0) {
    console.log("=== Top Product Batches ===");
    const batchArray = Array.from(batchStats.entries())
      .map(([batchId, data]) => ({
        batchId,
        total: data.authentic + data.counterfeit,
        authentic: data.authentic,
        counterfeit: data.counterfeit
      }))
      .sort((a, b) => Number(b.total) - Number(a.total))
      .slice(0, 10);

    for (let i = 0; i < batchArray.length; i++) {
      const batch = batchArray[i];
      try {
        const product = await contract.getProduct(batch.batchId);
        console.log(`${i + 1}. Batch ${batch.batchId}: ${product.name} (${product.brand})`);
        console.log(`   Total Verifications: ${batch.total}`);
        console.log(`   Authentic: ${batch.authentic}, Counterfeits: ${batch.counterfeit}`);
        
        // Get batch verification count
        const batchCount = await contract.batchVerificationCount(batch.batchId);
        console.log(`   Batch Count: ${batchCount.toString()}`);
        console.log("");
      } catch (error) {
        console.log(`${i + 1}. Batch ${batch.batchId}: (product not found)`);
        console.log(`   Total Verifications: ${batch.total}`);
        console.log("");
      }
    }
  }

  // Top verifiers
  if (verifierStats.size > 0) {
    console.log("=== Top Verifiers ===");
    const verifierArray = Array.from(verifierStats.entries())
      .map(([address, count]) => ({ address, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    for (let i = 0; i < verifierArray.length; i++) {
      const verifier = verifierArray[i];
      console.log(`${i + 1}. ${verifier.address}: ${verifier.count} verifications`);
    }
    console.log("");
  }

  // Network info
  const network = await ethers.provider.getNetwork();
  const blockNumber = await ethers.provider.getBlockNumber();
  console.log("=== Network Info ===");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("Current Block:", blockNumber);
  console.log("");

  // Summary
  console.log("=== Summary ===");
  if (authenticCount + counterfeitCount > 0) {
    const totalVerifications = authenticCount + counterfeitCount;
    console.log(`Total verifications analyzed: ${totalVerifications}`);
    console.log(`Authentic products: ${authenticCount} (${((authenticCount / totalVerifications) * 100).toFixed(2)}%)`);
    console.log(`Potential counterfeits detected: ${counterfeitCount} (${((counterfeitCount / totalVerifications) * 100).toFixed(2)}%)`);
  } else {
    console.log("No verifications found in recent blocks");
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n=== Error ===");
    console.error(error);
    process.exitCode = 1;
  });

