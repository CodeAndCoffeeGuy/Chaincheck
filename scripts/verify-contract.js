const hre = require("hardhat");
require("dotenv").config();

/**
 * Contract Verification Script
 * 
 * Verify contract on PolygonScan/Etherscan
 * 
 * Usage:
 *   npx hardhat run scripts/verify-contract.js --network polygon
 *   npx hardhat run scripts/verify-contract.js --network mumbai
 */

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

async function main() {
  console.log("\n=== Contract Verification ===\n");

  if (!CONTRACT_ADDRESS) {
    console.error("Error: CONTRACT_ADDRESS not set in .env");
    console.log("Set CONTRACT_ADDRESS in your .env file");
    process.exit(1);
  }

  console.log("Contract Address:", CONTRACT_ADDRESS);

  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("");

  // Check if API key is set
  const apiKey = process.env.POLYGONSCAN_API_KEY || process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    console.log("Warning: No API key found");
    console.log("Set POLYGONSCAN_API_KEY or ETHERSCAN_API_KEY in .env");
    console.log("Get API key from:");
    if (network.chainId === 137n || network.chainId === 80001n) {
      console.log("  https://polygonscan.com/apis");
    } else {
      console.log("  https://etherscan.io/apis");
    }
    console.log("");
    return;
  }

  console.log("Verifying contract...");
  console.log("This may take a few minutes...\n");

  try {
    await hre.run("verify:verify", {
      address: CONTRACT_ADDRESS,
      constructorArguments: [],
    });

    console.log("\nContract verified successfully!");
    
    // Show explorer URL
    if (network.chainId === 137n) {
      console.log("View on PolygonScan: https://polygonscan.com/address/" + CONTRACT_ADDRESS);
    } else if (network.chainId === 80001n) {
      console.log("View on PolygonScan: https://mumbai.polygonscan.com/address/" + CONTRACT_ADDRESS);
    } else if (network.chainId === 1n) {
      console.log("View on Etherscan: https://etherscan.io/address/" + CONTRACT_ADDRESS);
    } else {
      console.log("Contract verified. Check your network's block explorer.");
    }
    console.log("");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("Contract is already verified.");
    } else if (error.message.includes("does not have bytecode")) {
      console.log("Error: Contract not found at this address");
      console.log("Make sure the contract is deployed and address is correct");
    } else {
      console.log("Verification failed:");
      console.log(error.message);
      
      if (error.message.includes("API")) {
        console.log("\nTroubleshooting:");
        console.log("1. Check your API key is correct");
        console.log("2. Make sure API key has write access");
        console.log("3. Wait a few minutes after deployment before verifying");
      }
    }
    console.log("");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n=== Error ===");
    console.error(error);
    process.exitCode = 1;
  });

