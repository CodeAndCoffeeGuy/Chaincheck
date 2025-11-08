const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * Gas Estimation Script
 * 
 * Estimate gas costs for various contract operations
 * 
 * Usage:
 *   npx hardhat run scripts/estimate-gas.js --network localhost
 */

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

/**
 * Generate serial hash
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
  console.log("\n=== Gas Estimation ===\n");
  console.log("Contract Address:", CONTRACT_ADDRESS);
  console.log("");

  // Get signers
  const [owner, manufacturer, consumer] = await ethers.getSigners();
  
  // Get contract instance
  const ChainCheck = await ethers.getContractFactory("ChainCheck");
  const contract = ChainCheck.attach(CONTRACT_ADDRESS);

  // Check if manufacturer is authorized
  const isAuthorized = await contract.authorizedMakers(manufacturer.address);
  if (!isAuthorized) {
    console.log("Authorizing manufacturer for testing...");
    await contract.authorizeManufacturer(manufacturer.address, true);
  }

  console.log("Estimating gas costs...\n");

  // Test data
  const testBatchId = 9999;
  const testSerial = "TEST001";
  const serialHash = generateSerialHash(testBatchId, testSerial);
  const serialHashes = [serialHash];

  // 1. Register Product
  console.log("1. Register Product:");
  try {
    const registerGas = await contract
      .connect(manufacturer)
      .registerProduct.estimateGas(
        testBatchId,
        "Test Product",
        "Test Brand",
        serialHashes,
        "",
        "",
        ""
      );
    console.log("   Gas:", registerGas.toString());
    console.log("   Cost (at 30 gwei):", ethers.formatEther(registerGas * 30n * 10n**9n), "ETH");
  } catch (error) {
    console.log("   Error:", error.message.includes("exists") ? "Product already exists" : error.message);
  }

  // 2. Verify Product
  console.log("\n2. Verify Product:");
  try {
    // Make sure product exists
    const exists = await contract.products(testBatchId);
    if (!exists.exists) {
      await contract
        .connect(manufacturer)
        .registerProduct(testBatchId, "Test", "Brand", serialHashes, "", "", "");
    }

    const verifyGas = await contract
      .connect(consumer)
      .verify.estimateGas(serialHash, testBatchId);
    console.log("   Gas:", verifyGas.toString());
    console.log("   Cost (at 30 gwei):", ethers.formatEther(verifyGas * 30n * 10n**9n), "ETH");
  } catch (error) {
    console.log("   Error:", error.message);
  }

  // 3. Batch Verify (3 products)
  console.log("\n3. Batch Verify (3 products):");
  try {
    const batch2Id = 9998;
    const batch3Id = 9997;
    const serial2 = generateSerialHash(batch2Id, "TEST002");
    const serial3 = generateSerialHash(batch3Id, "TEST003");
    
    // Register test products
    const exists2 = await contract.products(batch2Id);
    if (!exists2.exists) {
      await contract.connect(manufacturer).registerProduct(batch2Id, "Test2", "Brand", [serial2], "", "", "");
    }
    const exists3 = await contract.products(batch3Id);
    if (!exists3.exists) {
      await contract.connect(manufacturer).registerProduct(batch3Id, "Test3", "Brand", [serial3], "", "", "");
    }

    const batchVerifyGas = await contract
      .connect(consumer)
      .batchVerify.estimateGas(
        [serialHash, serial2, serial3],
        [testBatchId, batch2Id, batch3Id]
      );
    console.log("   Gas:", batchVerifyGas.toString());
    console.log("   Cost (at 30 gwei):", ethers.formatEther(batchVerifyGas * 30n * 10n**9n), "ETH");
    console.log("   Per product:", (batchVerifyGas / 3n).toString(), "gas");
  } catch (error) {
    console.log("   Error:", error.message);
  }

  // 4. Update Metadata
  console.log("\n4. Update Product Metadata:");
  try {
    const updateGas = await contract
      .connect(manufacturer)
      .updateProductMetadata.estimateGas(
        testBatchId,
        "QmNewHash",
        "Updated description",
        "https://example.com/image.jpg"
      );
    console.log("   Gas:", updateGas.toString());
    console.log("   Cost (at 30 gwei):", ethers.formatEther(updateGas * 30n * 10n**9n), "ETH");
  } catch (error) {
    console.log("   Error:", error.message);
  }

  // 5. Authorize Manufacturer
  console.log("\n5. Authorize Manufacturer:");
  try {
    const authGas = await contract
      .connect(owner)
      .authorizeManufacturer.estimateGas(consumer.address, true);
    console.log("   Gas:", authGas.toString());
    console.log("   Cost (at 30 gwei):", ethers.formatEther(authGas * 30n * 10n**9n), "ETH");
  } catch (error) {
    console.log("   Error:", error.message);
  }

  // 6. Pause/Unpause
  console.log("\n6. Pause Contract:");
  try {
    const paused = await contract.paused();
    if (!paused) {
      const pauseGas = await contract.connect(owner).pause.estimateGas();
      console.log("   Gas:", pauseGas.toString());
      console.log("   Cost (at 30 gwei):", ethers.formatEther(pauseGas * 30n * 10n**9n), "ETH");
    } else {
      console.log("   Contract already paused");
    }
  } catch (error) {
    console.log("   Error:", error.message);
  }

  // 7. View functions (no gas, but showing for completeness)
  console.log("\n7. View Functions (no gas cost):");
  console.log("   - getProduct()");
  console.log("   - getStatistics()");
  console.log("   - getVerificationHistory()");
  console.log("   - getVerificationCount()");

  // Get current gas price
  const gasPrice = await ethers.provider.getFeeData();
  console.log("\n=== Current Network Info ===");
  console.log("Gas Price:", ethers.formatUnits(gasPrice.gasPrice || 0n, "gwei"), "gwei");
  
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("");

  console.log("Note: Actual gas costs may vary based on network congestion");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n=== Error ===");
    console.error(error);
    process.exitCode = 1;
  });

