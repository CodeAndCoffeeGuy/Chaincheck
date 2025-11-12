const hre = require("hardhat");

/**
 * Deployment script for ChainCheck contract
 * 
 * Usage:
 *   npx hardhat run scripts/deploy.js --network localhost
 *   npx hardhat run scripts/deploy.js --network mumbai
 *   npx hardhat run scripts/deploy.js --network polygon
 * 
 */
async function main() {
  // Get the deployer account
  const [deployer] = await ethers.getSigners();

  console.log("\n=== ChainCheck Deployment ===");
  console.log("Deploying contracts with account:", deployer.address);

  // Check account balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH/MATIC");

  // Validate balance
  if (balance === 0n) {
    throw new Error("Insufficient balance. Please fund your account.");
  }

  // Deploy the ChainCheck contract
  console.log("\nDeploying ChainCheck contract...");
  const ChainCheck = await ethers.getContractFactory("ChainCheck");
  const chaincheck = await ChainCheck.deploy();

  // Wait for deployment to complete
  await chaincheck.waitForDeployment();
  const contractAddress = await chaincheck.getAddress();

  console.log("\n=== Deployment Successful ===");
  console.log("ChainCheck deployed to:", contractAddress);

  // Get network information
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, "(Chain ID:", network.chainId.toString() + ")");

  // Wait for a few block confirmations before verification
  if (network.chainId !== 1337n) {
    console.log("\nWaiting for block confirmations...");
    await chaincheck.deploymentTransaction().wait(5);

    // Verify contract on PolygonScan (if API key is set)
    if (process.env.POLYGONSCAN_API_KEY) {
      console.log("\nVerifying contract on PolygonScan...");
      try {
        await hre.run("verify:verify", {
          address: contractAddress,
          constructorArguments: [],
        });
        console.log("Contract verified successfully!");
      } catch (error) {
        if (error.message.includes("Already Verified")) {
          console.log("Contract already verified.");
        } else {
          console.log("Verification failed:", error.message);
        }
      }
    }
  }

  console.log("\n=== Next Steps ===");
  console.log("1. Update CONTRACT_ADDRESS in frontend/src/config.ts");
  console.log("2. Copy contract ABI from artifacts/contracts/ChainCheck.sol/ChainCheck.json");
  console.log("3. Deploy frontend: cd frontend && npm run build && vercel --prod");
  console.log("\nContract Address:", contractAddress);
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n=== Deployment Failed ===");
    console.error(error);
    process.exitCode = 1;
  });

