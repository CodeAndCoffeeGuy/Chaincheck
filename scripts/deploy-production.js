const hre = require("hardhat");
require("dotenv").config();

/**
 * Production Deployment Script for ChainCheck
 * 
 * This script handles the complete production deployment process:
 * 1. Checks prerequisites (balance, environment variables)
 * 2. Deploys contract to Polygon mainnet
 * 3. Verifies contract on PolygonScan
 * 4. Updates frontend configuration
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-production.js --network polygon
 * 
 * Prerequisites:
 *   - PRIVATE_KEY set in .env
 *   - POLYGON_RPC_URL set in .env (optional)
 *   - POLYGONSCAN_API_KEY set in .env (for verification)
 *   - At least 0.1 MATIC in deployer wallet
 */

const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("  ChainCheck Production Deployment");
  console.log("=".repeat(60) + "\n");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = deployer.address;

  console.log("Deployer Address:", deployerAddress);
  console.log("Network: Polygon Mainnet (Chain ID: 137)\n");

  // Check account balance
  const balance = await ethers.provider.getBalance(deployerAddress);
  const balanceFormatted = ethers.formatEther(balance);
  console.log("Account Balance:", balanceFormatted, "MATIC");

  // Get current gas price
  const feeData = await ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice;
  console.log("Current Gas Price:", ethers.formatUnits(gasPrice || 0n, "gwei"), "gwei\n");

  // Validate balance
  if (balance === 0n) {
    console.error("[ERROR] Insufficient balance!");
    console.error("   Your wallet has 0 MATIC.");
    console.error("   Please fund your wallet with at least 0.1 MATIC to deploy.");
    console.error("   Wallet address:", deployerAddress);
    console.error("\n   You can get MATIC from:");
    console.error("   - Exchange (Coinbase, Binance, etc.)");
    console.error("   - Bridge from Ethereum: https://portal.polygon.technology/");
    console.error("   - Fiat on-ramp: https://ramp.network/ or similar\n");
    process.exit(1);
  }

  // Estimate deployment cost
  const estimatedGas = 2000000n; // Approximate gas for deployment
  const estimatedCost = gasPrice * estimatedGas;
  const estimatedCostFormatted = ethers.formatEther(estimatedCost);

  console.log("Estimated Deployment Cost:");
  console.log("  Gas Limit:", estimatedGas.toString());
  console.log("  Estimated Cost:", estimatedCostFormatted, "MATIC\n");

  if (balance < estimatedCost) {
    console.error("[WARNING] Balance may be insufficient!");
    console.error("   Estimated cost:", estimatedCostFormatted, "MATIC");
    console.error("   Your balance:", balanceFormatted, "MATIC");
    console.error("   Please add more MATIC to your wallet.\n");
    process.exit(1);
  }

  // Confirm deployment
  console.log("[OK] Prerequisites check passed!\n");
  console.log("Ready to deploy ChainCheck to Polygon Mainnet.");
  console.log("This will cost approximately", estimatedCostFormatted, "MATIC.\n");

  // Deploy the ChainCheck contract
  console.log("Deploying ChainCheck contract...");
  const ChainCheck = await ethers.getContractFactory("ChainCheck");
  const chaincheck = await ChainCheck.deploy();

  console.log("Waiting for deployment transaction...");
  await chaincheck.waitForDeployment();
  const contractAddress = await chaincheck.getAddress();

  console.log("\n" + "=".repeat(60));
  console.log("  [OK] Deployment Successful!");
  console.log("=".repeat(60));
  console.log("\nContract Address:", contractAddress);
  console.log("Network: Polygon Mainnet");
  console.log("Chain ID: 137\n");

  // Wait for block confirmations
  console.log("Waiting for 5 block confirmations...");
  const deploymentTx = chaincheck.deploymentTransaction();
  if (deploymentTx) {
    await deploymentTx.wait(5);
    console.log("[OK] Transaction confirmed!\n");
  }

  // Verify contract on PolygonScan (if API key is set)
  if (process.env.POLYGONSCAN_API_KEY) {
    console.log("Verifying contract on PolygonScan...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [],
      });
      console.log("[OK] Contract verified on PolygonScan!");
      console.log("   View at: https://polygonscan.com/address/" + contractAddress + "\n");
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("[OK] Contract already verified on PolygonScan.");
        console.log("   View at: https://polygonscan.com/address/" + contractAddress + "\n");
      } else {
        console.log("[WARN] Verification failed:", error.message);
        console.log("   You can verify manually at: https://polygonscan.com/address/" + contractAddress + "\n");
      }
    }
  } else {
    console.log("[WARN] POLYGONSCAN_API_KEY not set. Skipping verification.");
    console.log("   To verify later, run:");
    console.log("   npx hardhat verify --network polygon", contractAddress + "\n");
  }

  // Update frontend configuration
  console.log("=".repeat(60));
  console.log("  Next Steps");
  console.log("=".repeat(60) + "\n");

  console.log("1. Update Frontend Configuration:");
  console.log("   Option A - Use environment variable (recommended):");
  console.log("     Create frontend/.env file:");
  console.log("     VITE_CONTRACT_ADDRESS=" + contractAddress + "\n");

  console.log("   Option B - Update config.ts directly:");
  console.log("     Edit frontend/src/config.ts:");
  console.log("     CONTRACT_ADDRESS = \"" + contractAddress + "\"\n");

  console.log("2. Build Frontend:");
  console.log("     cd frontend");
  console.log("     npm run build\n");

  console.log("3. Deploy Frontend:");
  console.log("     Option A - Vercel:");
  console.log("       vercel --prod");
  console.log("     Option B - Netlify:");
  console.log("       netlify deploy --prod --dir=dist");
  console.log("     Option C - Other hosting service\n");

  console.log("4. Test the Deployment:");
  console.log("     - Connect MetaMask to Polygon Mainnet");
  console.log("     - Visit your deployed frontend");
  console.log("     - Test product verification\n");

  // Save deployment info to file
  const deploymentInfo = {
    contractAddress: contractAddress,
    network: "Polygon Mainnet",
    chainId: 137,
    deployer: deployerAddress,
    deployedAt: new Date().toISOString(),
    transactionHash: deploymentTx?.hash || "N/A",
  };

  const infoPath = path.join(__dirname, "..", "deployment-info.json");
  fs.writeFileSync(infoPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("[OK] Deployment info saved to: deployment-info.json\n");

  console.log("=".repeat(60));
  console.log("  Contract Address");
  console.log("=".repeat(60));
  console.log(contractAddress);
  console.log("=".repeat(60) + "\n");
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n" + "=".repeat(60));
    console.error("  [ERROR] Deployment Failed");
    console.error("=".repeat(60));
    console.error("\nError:", error.message);
    if (error.transaction) {
      console.error("\nTransaction:", error.transaction);
    }
    console.error("\nStack trace:", error.stack);
    process.exitCode = 1;
  });

