const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Test suite for ChainCheck contract
 * 
 * Tests cover:
 * - Contract deployment
 * - Manufacturer authorization
 * - Product registration
 * - Product verification (authentic and fake)
 * - Access control
 * - Edge cases
 */
describe("ChainCheck", function () {
  let chaincheck;
  let owner;
  let manufacturer;
  let consumer;
  let otherAccount;

  // Test data
  const batchId = 1;
  const productName = "Premium Sneakers";
  const productBrand = "Nike";
  const serialNumber = "SN123456789";

  /**
   * Helper function to create a serial hash
   * This matches the format expected by the contract
   */
  function createSerialHash(batchId, serialNumber) {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "string"],
        [batchId, serialNumber]
      )
    );
  }

  /**
   * Setup: Deploy contract and get signers before each test
   */
  beforeEach(async function () {
    // Get test accounts
    [owner, manufacturer, consumer, otherAccount] = await ethers.getSigners();

    // Deploy ChainCheck contract
    const ChainCheck = await ethers.getContractFactory("ChainCheck");
    chaincheck = await ChainCheck.deploy();
    await chaincheck.waitForDeployment();

    // Authorize manufacturer (owner is auto-authorized in constructor)
    await chaincheck.authorizeManufacturer(manufacturer.address, true);
  });

  describe("Deployment", function () {
    it("Should set the deployer as owner", async function () {
      expect(await chaincheck.owner()).to.equal(owner.address);
    });

    it("Should authorize the deployer as manufacturer", async function () {
      expect(await chaincheck.authorizedMakers(owner.address)).to.be.true;
    });

    it("Should initialize counters to zero", async function () {
      expect(await chaincheck.totalProducts()).to.equal(0);
      expect(await chaincheck.totalVerifications()).to.equal(0);
    });
  });

  describe("Manufacturer Authorization", function () {
    it("Should allow owner to authorize manufacturers", async function () {
      await expect(
        chaincheck.authorizeManufacturer(otherAccount.address, true)
      )
        .to.emit(chaincheck, "ManufacturerAuthorized")
        .withArgs(otherAccount.address, true);

      expect(await chaincheck.authorizedMakers(otherAccount.address)).to.be.true;
    });

    it("Should allow owner to revoke manufacturer authorization", async function () {
      await chaincheck.authorizeManufacturer(otherAccount.address, true);
      await chaincheck.authorizeManufacturer(otherAccount.address, false);

      expect(await chaincheck.authorizedMakers(otherAccount.address)).to.be.false;
    });

    it("Should reject authorization from non-owner", async function () {
      await expect(
        chaincheck
          .connect(consumer)
          .authorizeManufacturer(otherAccount.address, true)
      ).to.be.revertedWith("ChainCheck: caller is not the owner");
    });

    it("Should reject authorization with zero address", async function () {
      await expect(
        chaincheck.authorizeManufacturer(ethers.ZeroAddress, true)
      ).to.be.revertedWith("ChainCheck: invalid address");
    });
  });

  describe("Product Registration", function () {
    const serialHashes = [
      createSerialHash(batchId, "SN001"),
      createSerialHash(batchId, "SN002"),
      createSerialHash(batchId, "SN003"),
    ];

    it("Should allow authorized manufacturer to register products", async function () {
      await expect(
        chaincheck
          .connect(manufacturer)
          .registerProduct(batchId, productName, productBrand, serialHashes)
      )
        .to.emit(chaincheck, "ProductRegistered")
        .withArgs(batchId, productName, productBrand, serialHashes.length);

      const product = await chaincheck.getProduct(batchId);
      expect(product.name).to.equal(productName);
      expect(product.brand).to.equal(productBrand);
      expect(product.exists).to.be.true;
      expect(await chaincheck.totalProducts()).to.equal(1);
    });

    it("Should reject registration from unauthorized address", async function () {
      await expect(
        chaincheck
          .connect(consumer)
          .registerProduct(batchId, productName, productBrand, serialHashes)
      ).to.be.revertedWith("ChainCheck: not an authorized manufacturer");
    });

    it("Should reject registration with invalid batch ID", async function () {
      await expect(
        chaincheck
          .connect(manufacturer)
          .registerProduct(0, productName, productBrand, serialHashes)
      ).to.be.revertedWith("ChainCheck: invalid batch ID");
    });

    it("Should reject registration with empty name", async function () {
      await expect(
        chaincheck
          .connect(manufacturer)
          .registerProduct(batchId, "", productBrand, serialHashes)
      ).to.be.revertedWith("ChainCheck: name required");
    });

    it("Should reject registration with empty brand", async function () {
      await expect(
        chaincheck
          .connect(manufacturer)
          .registerProduct(batchId, productName, "", serialHashes)
      ).to.be.revertedWith("ChainCheck: brand required");
    });

    it("Should reject registration with empty serials array", async function () {
      await expect(
        chaincheck
          .connect(manufacturer)
          .registerProduct(batchId, productName, productBrand, [])
      ).to.be.revertedWith("ChainCheck: serials required");
    });

    it("Should reject duplicate batch registration", async function () {
      await chaincheck
        .connect(manufacturer)
        .registerProduct(batchId, productName, productBrand, serialHashes);

      await expect(
        chaincheck
          .connect(manufacturer)
          .registerProduct(batchId, productName, productBrand, serialHashes)
      ).to.be.revertedWith("ChainCheck: batch already exists");
    });
  });

  describe("Product Verification", function () {
    const serialHash = createSerialHash(batchId, serialNumber);

    beforeEach(async function () {
      // Register a product before each verification test
      await chaincheck
        .connect(manufacturer)
        .registerProduct(batchId, productName, productBrand, [serialHash]);
    });

    it("Should verify authentic product on first scan", async function () {
      // First verification
      const tx = await chaincheck.connect(consumer).verify(serialHash, batchId);
      await expect(tx)
        .to.emit(chaincheck, "Verified")
        .withArgs(serialHash, batchId, true, consumer.address);

      // Check the result by reading the transaction receipt or checking state
      const receipt = await tx.wait();
      expect(await chaincheck.isSerialVerified(serialHash)).to.be.true;
      expect(await chaincheck.totalVerifications()).to.equal(1);
      
      // Verify it returns false on second call (already verified)
      const tx2 = await chaincheck.connect(consumer).verify(serialHash, batchId);
      await expect(tx2)
        .to.emit(chaincheck, "Verified")
        .withArgs(serialHash, batchId, false, consumer.address);
    });

    it("Should detect fake product on second scan", async function () {
      // First scan (authentic)
      const tx1 = await chaincheck.connect(consumer).verify(serialHash, batchId);
      await expect(tx1)
        .to.emit(chaincheck, "Verified")
        .withArgs(serialHash, batchId, true, consumer.address);

      // Second scan (fake - already verified)
      const tx2 = await chaincheck
        .connect(otherAccount)
        .verify(serialHash, batchId);
      
      await expect(tx2)
        .to.emit(chaincheck, "Verified")
        .withArgs(serialHash, batchId, false, otherAccount.address);

      expect(await chaincheck.isSerialVerified(serialHash)).to.be.true;
      expect(await chaincheck.totalVerifications()).to.equal(1);
    });

    it("Should reject verification for non-existent batch", async function () {
      const nonExistentBatchId = 999;
      await expect(
        chaincheck.connect(consumer).verify(serialHash, nonExistentBatchId)
      ).to.be.revertedWith("ChainCheck: product batch not found");
    });

    it("Should reject verification with invalid batch ID", async function () {
      await expect(
        chaincheck.connect(consumer).verify(serialHash, 0)
      ).to.be.revertedWith("ChainCheck: invalid batch ID");
    });

    it("Should allow anyone to verify products", async function () {
      // Consumer can verify
      await chaincheck.connect(consumer).verify(serialHash, batchId);

      // Manufacturer can verify
      const serialHash2 = createSerialHash(batchId, "SN002");
      await chaincheck
        .connect(manufacturer)
        .registerProduct(2, productName, productBrand, [serialHash2]);
      await chaincheck.connect(manufacturer).verify(serialHash2, 2);
    });
  });

  describe("Product Information", function () {
    beforeEach(async function () {
      const serialHashes = [createSerialHash(batchId, serialNumber)];
      await chaincheck
        .connect(manufacturer)
        .registerProduct(batchId, productName, productBrand, serialHashes);
    });

    it("Should return correct product information", async function () {
      const product = await chaincheck.getProduct(batchId);
      expect(product.name).to.equal(productName);
      expect(product.brand).to.equal(productBrand);
      expect(product.exists).to.be.true;
      expect(product.registeredAt).to.be.gt(0);
    });

    it("Should return false for non-existent product", async function () {
      const product = await chaincheck.getProduct(999);
      expect(product.exists).to.be.false;
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple product batches", async function () {
      const batch1Serials = [createSerialHash(1, "SN001")];
      const batch2Serials = [createSerialHash(2, "SN002")];

      await chaincheck
        .connect(manufacturer)
        .registerProduct(1, "Product 1", "Brand A", batch1Serials);
      await chaincheck
        .connect(manufacturer)
        .registerProduct(2, "Product 2", "Brand B", batch2Serials);

      expect(await chaincheck.totalProducts()).to.equal(2);
    });

    it("Should handle large serial arrays", async function () {
      const largeSerialArray = [];
      for (let i = 0; i < 100; i++) {
        largeSerialArray.push(createSerialHash(batchId, `SN${i}`));
      }

      await chaincheck
        .connect(manufacturer)
        .registerProduct(batchId, productName, productBrand, largeSerialArray);

      expect(await chaincheck.totalProducts()).to.equal(1);
    });
  });
});

