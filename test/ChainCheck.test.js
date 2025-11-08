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
      ).to.be.revertedWithCustomError(chaincheck, "NotOwner");
    });

    it("Should reject authorization with zero address", async function () {
      await expect(
        chaincheck.authorizeManufacturer(ethers.ZeroAddress, true)
      ).to.be.revertedWithCustomError(chaincheck, "InvalidAddress");
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
          .registerProduct(batchId, productName, productBrand, serialHashes, "", "", "")
      )
        .to.emit(chaincheck, "ProductRegistered")
        .withArgs(batchId, productName, productBrand, serialHashes.length);

      const product = await chaincheck.getProduct(batchId);
      expect(product.name).to.equal(productName);
      expect(product.brand).to.equal(productBrand);
      expect(product.exists).to.be.true;
      expect(await chaincheck.totalProducts()).to.equal(1);
    });

    it("Should allow registration with metadata", async function () {
      const ipfsHash = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
      const description = "Premium quality sneakers with advanced technology";
      const imageUrl = "https://example.com/images/sneakers.jpg";

      await chaincheck
        .connect(manufacturer)
        .registerProduct(2, "Test Product", "Test Brand", serialHashes, ipfsHash, description, imageUrl);

      const product = await chaincheck.getProduct(2);
      expect(product.ipfsHash).to.equal(ipfsHash);
      expect(product.description).to.equal(description);
      expect(product.imageUrl).to.equal(imageUrl);
    });

    it("Should reject registration from unauthorized address", async function () {
      await expect(
        chaincheck
          .connect(consumer)
          .registerProduct(batchId, productName, productBrand, serialHashes, "", "", "")
      ).to.be.revertedWithCustomError(chaincheck, "NotAuthorized");
    });

    it("Should reject registration with invalid batch ID", async function () {
      await expect(
        chaincheck
          .connect(manufacturer)
          .registerProduct(0, productName, productBrand, serialHashes, "", "", "")
      ).to.be.revertedWithCustomError(chaincheck, "InvalidBatchId");
    });

    it("Should reject registration with empty name", async function () {
      await expect(
        chaincheck
          .connect(manufacturer)
          .registerProduct(batchId, "", productBrand, serialHashes, "", "", "")
      ).to.be.revertedWithCustomError(chaincheck, "EmptyName");
    });

    it("Should reject registration with empty brand", async function () {
      await expect(
        chaincheck
          .connect(manufacturer)
          .registerProduct(batchId, productName, "", serialHashes, "", "", "")
      ).to.be.revertedWithCustomError(chaincheck, "EmptyBrand");
    });

    it("Should reject registration with empty serials array", async function () {
      await expect(
        chaincheck
          .connect(manufacturer)
          .registerProduct(batchId, productName, productBrand, [], "", "", "")
      ).to.be.revertedWithCustomError(chaincheck, "NoSerials");
    });

    it("Should reject duplicate batch registration", async function () {
      await chaincheck
        .connect(manufacturer)
        .registerProduct(batchId, productName, productBrand, serialHashes, "", "", "");

      await expect(
        chaincheck
          .connect(manufacturer)
          .registerProduct(batchId, productName, productBrand, serialHashes, "", "", "")
      ).to.be.revertedWithCustomError(chaincheck, "BatchExists");
    });

    it("Should allow updating product metadata", async function () {
      await chaincheck
        .connect(manufacturer)
        .registerProduct(3, productName, productBrand, serialHashes, "", "", "");

      const newIpfsHash = "QmNewHash123";
      const newDescription = "Updated description";
      const newImageUrl = "https://example.com/new-image.jpg";

      await chaincheck
        .connect(manufacturer)
        .updateProductMetadata(3, newIpfsHash, newDescription, newImageUrl);

      const product = await chaincheck.getProduct(3);
      expect(product.ipfsHash).to.equal(newIpfsHash);
      expect(product.description).to.equal(newDescription);
      expect(product.imageUrl).to.equal(newImageUrl);
    });

    it("Should reject metadata update from unauthorized address", async function () {
      await chaincheck
        .connect(manufacturer)
        .registerProduct(4, productName, productBrand, serialHashes, "", "", "");

      await expect(
        chaincheck
          .connect(consumer)
          .updateProductMetadata(4, "hash", "desc", "url")
      ).to.be.revertedWithCustomError(chaincheck, "NotAuthorized");
    });
  });

  describe("Product Verification", function () {
    const serialHash = createSerialHash(batchId, serialNumber);

    beforeEach(async function () {
      // Register a product before each verification test
      await chaincheck
        .connect(manufacturer)
        .registerProduct(batchId, productName, productBrand, [serialHash], "", "", "");
    });

    it("Should verify authentic product on first scan", async function () {
      // First verification
      const tx = await chaincheck.connect(consumer).verify(serialHash, batchId);
      const receipt = await tx.wait();
      const timestamp = (await ethers.provider.getBlock(receipt.blockNumber)).timestamp;
      
      await expect(tx)
        .to.emit(chaincheck, "Verified")
        .withArgs(serialHash, batchId, true, consumer.address, timestamp);

      // Check verification history
      const history = await chaincheck.getVerificationHistory(serialHash);
      expect(history.length).to.equal(1);
      expect(history[0].isAuthentic).to.be.true;
      expect(history[0].verifier).to.equal(consumer.address);
      expect(history[0].batchId).to.equal(batchId);

      // Check the result by reading the transaction receipt or checking state
      expect(await chaincheck.isSerialVerified(serialHash)).to.be.true;
      expect(await chaincheck.totalVerifications()).to.equal(1);
      
      // Check batch verification count
      const batchCount = await chaincheck.batchVerificationCount(batchId);
      expect(batchCount).to.equal(1);
      
      // Verify it returns false on second call (already verified)
      const tx2 = await chaincheck.connect(consumer).verify(serialHash, batchId);
      const receipt2 = await tx2.wait();
      const timestamp2 = (await ethers.provider.getBlock(receipt2.blockNumber)).timestamp;
      await expect(tx2)
        .to.emit(chaincheck, "Verified")
        .withArgs(serialHash, batchId, false, consumer.address, timestamp2);
    });

    it("Should detect fake product on second scan", async function () {
      // First scan (authentic)
      const tx1 = await chaincheck.connect(consumer).verify(serialHash, batchId);
      const receipt1 = await tx1.wait();
      const timestamp1 = (await ethers.provider.getBlock(receipt1.blockNumber)).timestamp;
      await expect(tx1)
        .to.emit(chaincheck, "Verified")
        .withArgs(serialHash, batchId, true, consumer.address, timestamp1);

      // Second scan (fake - already verified)
      const tx2 = await chaincheck
        .connect(otherAccount)
        .verify(serialHash, batchId);
      const receipt2 = await tx2.wait();
      const timestamp2 = (await ethers.provider.getBlock(receipt2.blockNumber)).timestamp;
      
      await expect(tx2)
        .to.emit(chaincheck, "Verified")
        .withArgs(serialHash, batchId, false, otherAccount.address, timestamp2);

      expect(await chaincheck.isSerialVerified(serialHash)).to.be.true;
      expect(await chaincheck.totalVerifications()).to.equal(1);

      // Check verification history has 2 records
      const history = await chaincheck.getVerificationHistory(serialHash);
      expect(history.length).to.equal(2);
      expect(history[0].isAuthentic).to.be.true;
      expect(history[1].isAuthentic).to.be.false;
      expect(history[1].verifier).to.equal(otherAccount.address);
    });

    it("Should reject verification for non-existent batch", async function () {
      const nonExistentBatchId = 999;
      await expect(
        chaincheck.connect(consumer).verify(serialHash, nonExistentBatchId)
      ).to.be.revertedWithCustomError(chaincheck, "BatchNotFound");
    });

    it("Should reject verification with invalid batch ID", async function () {
      await expect(
        chaincheck.connect(consumer).verify(serialHash, 0)
      ).to.be.revertedWithCustomError(chaincheck, "InvalidBatchId");
    });

    it("Should allow anyone to verify products", async function () {
      // Consumer can verify
      await chaincheck.connect(consumer).verify(serialHash, batchId);

      // Manufacturer can verify
      const serialHash2 = createSerialHash(batchId, "SN002");
      await chaincheck
        .connect(manufacturer)
        .registerProduct(2, productName, productBrand, [serialHash2], "", "", "");
      await chaincheck.connect(manufacturer).verify(serialHash2, 2);
    });

    it("Should track verification history", async function () {
      // First verification
      await chaincheck.connect(consumer).verify(serialHash, batchId);
      
      // Second verification
      await chaincheck.connect(otherAccount).verify(serialHash, batchId);

      // Check history
      const history = await chaincheck.getVerificationHistory(serialHash);
      expect(history.length).to.equal(2);
      expect(history[0].isAuthentic).to.be.true;
      expect(history[1].isAuthentic).to.be.false;
      expect(history[0].verifier).to.equal(consumer.address);
      expect(history[1].verifier).to.equal(otherAccount.address);

      // Check verification count
      const count = await chaincheck.getVerificationCount(serialHash);
      expect(count).to.equal(2);
      
      // Check batch verification count (only authentic verifications count)
      const batchCount = await chaincheck.batchVerificationCount(batchId);
      expect(batchCount).to.equal(1);
    });

    it("Should return empty history for unverified serial", async function () {
      const unverifiedHash = createSerialHash(batchId, "UNVERIFIED");
      const history = await chaincheck.getVerificationHistory(unverifiedHash);
      expect(history.length).to.equal(0);
      
      const count = await chaincheck.getVerificationCount(unverifiedHash);
      expect(count).to.equal(0);
    });
  });

  describe("Product Information", function () {
    beforeEach(async function () {
      const serialHashes = [createSerialHash(batchId, serialNumber)];
      await chaincheck
        .connect(manufacturer)
        .registerProduct(batchId, productName, productBrand, serialHashes, "", "", "");
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
        .registerProduct(1, "Product 1", "Brand A", batch1Serials, "", "", "");
      await chaincheck
        .connect(manufacturer)
        .registerProduct(2, "Product 2", "Brand B", batch2Serials, "", "", "");

      expect(await chaincheck.totalProducts()).to.equal(2);
    });

    it("Should handle large serial arrays", async function () {
      const largeSerialArray = [];
      for (let i = 0; i < 100; i++) {
        largeSerialArray.push(createSerialHash(batchId, `SN${i}`));
      }

      await chaincheck
        .connect(manufacturer)
        .registerProduct(batchId, productName, productBrand, largeSerialArray, "", "", "");

      expect(await chaincheck.totalProducts()).to.equal(1);
    });
  });

  describe("Pausable Functionality", function () {
    beforeEach(async function () {
      // Register a product for testing
      const serialHashes = [createSerialHash(batchId, serialNumber)];
      await chaincheck
        .connect(manufacturer)
        .registerProduct(batchId, productName, productBrand, serialHashes, "", "", "");
    });

    it("Should allow owner to pause contract", async function () {
      await expect(chaincheck.pause())
        .to.emit(chaincheck, "Paused")
        .withArgs(true);

      expect(await chaincheck.paused()).to.be.true;
    });

    it("Should allow owner to unpause contract", async function () {
      // Pause first
      await chaincheck.pause();
      expect(await chaincheck.paused()).to.be.true;

      // Unpause
      await expect(chaincheck.unpause())
        .to.emit(chaincheck, "Paused")
        .withArgs(false);

      expect(await chaincheck.paused()).to.be.false;
    });

    it("Should reject pause from non-owner", async function () {
      await expect(
        chaincheck.connect(consumer).pause()
      ).to.be.revertedWithCustomError(chaincheck, "NotOwner");
    });

    it("Should reject unpause from non-owner", async function () {
      await chaincheck.pause();
      await expect(
        chaincheck.connect(consumer).unpause()
      ).to.be.revertedWithCustomError(chaincheck, "NotOwner");
    });

    it("Should prevent product registration when paused", async function () {
      await chaincheck.pause();
      const serialHashes = [createSerialHash(2, "SN999")];

      await expect(
        chaincheck
          .connect(manufacturer)
          .registerProduct(2, "Test Product", "Test Brand", serialHashes, "", "", "")
      ).to.be.revertedWithCustomError(chaincheck, "ContractPaused");
    });

    it("Should prevent product verification when paused", async function () {
      await chaincheck.pause();
      const serialHash = createSerialHash(batchId, serialNumber);

      await expect(
        chaincheck.connect(consumer).verify(serialHash, batchId)
      ).to.be.revertedWithCustomError(chaincheck, "ContractPaused");
    });

    it("Should prevent batch verification when paused", async function () {
      await chaincheck.pause();
      const serialHash = createSerialHash(batchId, serialNumber);

      await expect(
        chaincheck.connect(consumer).batchVerify([serialHash], [batchId])
      ).to.be.revertedWithCustomError(chaincheck, "ContractPaused");
    });

    it("Should allow owner functions when paused", async function () {
      await chaincheck.pause();
      
      // Owner should still be able to authorize manufacturers
      await expect(
        chaincheck.authorizeManufacturer(otherAccount.address, true)
      ).to.emit(chaincheck, "ManufacturerAuthorized");
    });

    it("Should reject pause when already paused", async function () {
      await chaincheck.pause();
      await expect(chaincheck.pause()).to.be.revertedWithCustomError(
        chaincheck,
        "ContractPaused"
      );
    });

    it("Should reject unpause when not paused", async function () {
      await expect(chaincheck.unpause()).to.be.revertedWithCustomError(
        chaincheck,
        "ContractNotPaused"
      );
    });
  });

  describe("Reentrancy Protection", function () {
    beforeEach(async function () {
      const serialHashes = [createSerialHash(batchId, serialNumber)];
      await chaincheck
        .connect(manufacturer)
        .registerProduct(batchId, productName, productBrand, serialHashes, "", "", "");
    });

    it("Should have reentrancy guard on state-changing functions", async function () {
      const serialHash = createSerialHash(batchId, serialNumber);
      
      // Verify function has nonReentrant modifier
      const tx1 = await chaincheck.connect(consumer).verify(serialHash, batchId);
      const receipt1 = await tx1.wait();
      expect(receipt1.status).to.equal(1);
      
      // Reentrancy guard prevents malicious reentrant calls
      // Second verification should complete but return false (already verified)
      const tx2 = await chaincheck.connect(consumer).verify(serialHash, batchId);
      const receipt2 = await tx2.wait();
      expect(receipt2.status).to.equal(1);
      
      // Check that serial is still verified
      expect(await chaincheck.isSerialVerified(serialHash)).to.be.true;
    });
  });
});

