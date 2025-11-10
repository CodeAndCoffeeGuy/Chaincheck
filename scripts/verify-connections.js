const fs = require("fs");
const path = require("path");

/**
 * Verify all connections and configurations
 */

console.log("\n" + "=".repeat(60));
console.log("  ChainCheck Connection Verification");
console.log("=".repeat(60) + "\n");

let allGood = true;

// 1. Check contract compilation
console.log("1. Contract Compilation:");
try {
  const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "ChainCheck.sol", "ChainCheck.json");
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const abi = artifact.abi;
    console.log("   [OK] Contract compiled");
    console.log("   [OK] ABI found (" + abi.length + " entries)");
    
    // Check for key functions
    const requiredFunctions = [
      "registerProduct",
      "verify",
      "batchVerify",
      "getProduct",
      "getStatistics",
      "authorizeManufacturer",
      "getVerificationHistory",
      "updateProductMetadata"
    ];
    
    const functionNames = abi.filter(item => item.type === "function").map(f => f.name);
    const missingFunctions = requiredFunctions.filter(f => !functionNames.includes(f));
    
    if (missingFunctions.length === 0) {
      console.log("   [OK] All required functions present");
    } else {
      console.log("   [WARN] Missing functions:", missingFunctions.join(", "));
      allGood = false;
    }
  } else {
    console.log("   [ERROR] Contract artifact not found");
    allGood = false;
  }
} catch (error) {
  console.log("   [ERROR] Error:", error.message);
  allGood = false;
}

// 2. Check frontend config
console.log("\n2. Frontend Configuration:");
try {
  const configPath = path.join(__dirname, "..", "frontend", "src", "config.ts");
  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, "utf8");
    
    // Check network configuration
    if (configContent.includes("CURRENT_NETWORK = NETWORK_CONFIG.polygon")) {
      console.log("   [OK] Network set to Polygon mainnet");
    } else {
      console.log("   [WARN] Network not set to Polygon mainnet");
    }
    
    // Check contract address
    if (configContent.includes("VITE_CONTRACT_ADDRESS") || configContent.includes("0x0000000000000000000000000000000000000000")) {
      console.log("   [OK] Contract address configuration present");
    } else {
      console.log("   [WARN] Contract address configuration missing");
    }
    
    // Check ABI
    if (configContent.includes("export const CONTRACT_ABI")) {
      console.log("   [OK] ABI configuration present");
    } else {
      console.log("   [ERROR] ABI configuration missing");
      allGood = false;
    }
  } else {
    console.log("   [ERROR] Config file not found");
    allGood = false;
  }
} catch (error) {
  console.log("   [ERROR] Error:", error.message);
  allGood = false;
}

// 3. Check environment variables
console.log("\n3. Environment Variables:");
require("dotenv").config();

const requiredEnvVars = ["PRIVATE_KEY"];
const optionalEnvVars = ["POLYGON_RPC_URL", "POLYGONSCAN_API_KEY"];

requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log("   [OK] " + varName + " is set");
  } else {
    console.log("   [ERROR] " + varName + " is NOT set");
    allGood = false;
  }
});

optionalEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log("   [OK] " + varName + " is set (optional)");
  } else {
    console.log("   [WARN] " + varName + " is not set (optional)");
  }
});

// 4. Check frontend build
console.log("\n4. Frontend Build:");
const distPath = path.join(__dirname, "..", "frontend", "dist");
if (fs.existsSync(distPath)) {
  const files = fs.readdirSync(distPath);
  if (files.length > 0) {
    console.log("   [OK] Frontend built (" + files.length + " files)");
  } else {
    console.log("   [WARN] Frontend dist folder is empty");
  }
} else {
  console.log("   [WARN] Frontend not built (run: cd frontend && npm run build)");
}

// 5. Check Vercel configuration
console.log("\n5. Vercel Configuration:");
const vercelPath = path.join(__dirname, "..", "frontend", ".vercel");
if (fs.existsSync(vercelPath)) {
  console.log("   [OK] Vercel project linked");
  try {
    const projectJson = JSON.parse(fs.readFileSync(path.join(vercelPath, "project.json"), "utf8"));
    console.log("   [OK] Project ID:", projectJson.projectId);
  } catch (e) {
    console.log("   [WARN] Could not read project.json");
  }
} else {
  console.log("   [WARN] Vercel not linked (run: cd frontend && vercel link)");
}

// 6. Check network configuration
console.log("\n6. Network Configuration:");
try {
  const { ethers } = require("ethers");
  require("dotenv").config();
  
  const rpcUrl = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  provider.getNetwork().then(network => {
    console.log("   [OK] RPC URL accessible");
    console.log("   [OK] Network: " + network.name + " (Chain ID: " + network.chainId.toString() + ")");
    
    if (network.chainId === 137n) {
      console.log("   [OK] Connected to Polygon Mainnet");
    } else {
      console.log("   [WARN] Not connected to Polygon Mainnet (Chain ID: " + network.chainId + ")");
    }
    
    // Final summary
    console.log("\n" + "=".repeat(60));
    if (allGood) {
      console.log("  [OK] All Connections Verified!");
    } else {
      console.log("  [WARN] Some Issues Found - Review Above");
    }
    console.log("=".repeat(60) + "\n");
  }).catch(error => {
    console.log("   [ERROR] Cannot connect to RPC:", error.message);
    console.log("\n" + "=".repeat(60));
    console.log("  [WARN] RPC Connection Issue");
    console.log("=".repeat(60) + "\n");
  });
} catch (error) {
  console.log("   [ERROR] Error checking network:", error.message);
  console.log("\n" + "=".repeat(60));
  if (allGood) {
    console.log("  [OK] Basic Checks Passed");
  } else {
    console.log("  [WARN] Some Issues Found");
  }
  console.log("=".repeat(60) + "\n");
}

