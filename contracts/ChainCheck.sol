// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ChainCheck
 * @author ChainCheck Team
 * @notice A smart contract for verifying product authenticity using blockchain
 * 
 * How it works:
 * 1. Manufacturers register products with unique serial numbers
 * 2. Consumers scan QR codes and verify authenticity on-chain
 * 3. First scan marks the product as verified (authentic)
 * 4. Subsequent scans indicate the product may be counterfeit
 * 
 * Security features:
 * - Only authorized manufacturers can register products
 * - Serial numbers are hashed to prevent guessing
 * - One-time verification prevents replay attacks
 * - Reentrancy guard protection
 */
contract ChainCheck {
    /**
     * @notice Reentrancy guard state
     */
    uint256 private _locked;

    /**
     * @notice Reentrancy guard modifier
     */
    modifier nonReentrant() {
        require(_locked != 1, "ReentrancyGuard: reentrant call");
        _locked = 1;
        _;
        _locked = 0;
    }
    /**
     * @notice Custom errors for gas optimization
     */
    error NotOwner();
    error NotAuthorized();
    error InvalidAddress();
    error InvalidBatchId();
    error BatchExists();
    error BatchNotFound();
    error EmptyName();
    error EmptyBrand();
    error NoSerials();
    error InvalidOwner();
    error ContractPaused();
    error ContractNotPaused();
    error SerialNotInBatch();
    /**
     * @notice Product information structure
     * @param name Product name
     * @param brand Brand name
     * @param exists Whether the product batch exists
     * @param registeredAt Timestamp when product was registered
     * @param ipfsHash IPFS hash for product metadata (optional)
     * @param description Product description (optional)
     * @param imageUrl Product image URL (optional)
     */
    struct Product {
        string name;
        string brand;
        bool exists;
        uint256 registeredAt;
        string ipfsHash;
        string description;
        string imageUrl;
    }

    /**
     * @notice Mapping to track if a serial number has been verified
     * @dev serialHash => hasBeenVerified
     */
    mapping(bytes32 => bool) public serialVerified;

    /**
     * @notice Mapping to track which batch a serial number belongs to
     * @dev serialHash => batchId
     * @dev Used to validate that a serial belongs to the claimed batch
     */
    mapping(bytes32 => uint256) public serialToBatch;

    /**
     * @notice Mapping to store product batch information
     * @dev batchId => Product struct
     */
    mapping(uint256 => Product) public products;

    /**
     * @notice Mapping to track authorized manufacturers
     * @dev manufacturer address => isAuthorized
     */
    mapping(address => bool) public authorizedMakers;

    /**
     * @notice Contract owner address
     * @dev Only owner can authorize manufacturers
     */
    address public owner;

    /**
     * @notice Total number of products registered
     */
    uint256 public totalProducts;

    /**
     * @notice Total number of verifications performed
     */
    uint256 public totalVerifications;

    /**
     * @notice Mapping to track verification count per product batch
     * @dev batchId => verification count
     */
    mapping(uint256 => uint256) public batchVerificationCount;

    /**
     * @notice Array to track all authorized manufacturers
     * @dev Used for statistics and enumeration
     */
    address[] public manufacturerList;

    /**
     * @notice Pause state of the contract
     * @dev When paused, only owner functions work, verification is disabled
     */
    bool public paused;

    /**
     * @notice Event emitted when a product is registered
     * @param batchId Unique batch identifier
     * @param name Product name
     * @param brand Brand name
     * @param serialCount Number of serials registered in this batch
     */
    event ProductRegistered(
        uint256 indexed batchId,
        string name,
        string brand,
        uint256 serialCount
    );

    /**
     * @notice Event emitted when a product is verified
     * @param serialHash Hashed serial number
     * @param batchId Product batch ID
     * @param isAuthentic Whether the product is authentic (first scan)
     * @param verifier Address that performed the verification
     * @param timestamp Block timestamp of verification
     */
    event Verified(
        bytes32 indexed serialHash,
        uint256 indexed batchId,
        bool isAuthentic,
        address verifier,
        uint256 timestamp
    );

    /**
     * @notice Verification record structure
     * @param serialHash Hashed serial number
     * @param batchId Product batch ID
     * @param verifier Address that performed verification
     * @param timestamp Block timestamp
     * @param isAuthentic Whether it was authentic (first scan)
     */
    struct VerificationRecord {
        bytes32 serialHash;
        uint256 batchId;
        address verifier;
        uint256 timestamp;
        bool isAuthentic;
    }

    /**
     * @notice Mapping to store verification history
     * @dev serialHash => array of verification records
     */
    mapping(bytes32 => VerificationRecord[]) public verificationHistory;

    /**
     * @notice Event emitted when a manufacturer is authorized
     * @param maker Manufacturer address
     * @param authorized Whether authorized or revoked
     */
    event ManufacturerAuthorized(address indexed maker, bool authorized);

    /**
     * @notice Event emitted when contract is paused or unpaused
     * @param paused True if paused, false if unpaused
     */
    event Paused(bool paused);

    /**
     * @notice Modifier to restrict function access to contract owner
     */
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /**
     * @notice Modifier to restrict function access to authorized manufacturers
     */
    modifier onlyMaker() {
        if (!authorizedMakers[msg.sender]) revert NotAuthorized();
        _;
    }

    /**
     * @notice Modifier to check if contract is not paused
     */
    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    /**
     * @notice Modifier to check if contract is paused
     */
    modifier whenPaused() {
        if (!paused) revert ContractNotPaused();
        _;
    }

    /**
     * @notice Constructor sets the contract deployer as owner and authorizes them as manufacturer
     */
    constructor() {
        owner = msg.sender;
        authorizedMakers[msg.sender] = true;
        manufacturerList.push(msg.sender);
        emit ManufacturerAuthorized(msg.sender, true);
    }

    /**
     * @notice Authorize or revoke a manufacturer's registration rights
     * @dev Only owner can call this function
     * @param maker Address of the manufacturer
     * @param authorized True to authorize, false to revoke
     */
    function authorizeManufacturer(
        address maker,
        bool authorized
    ) external onlyOwner nonReentrant {
        if (maker == address(0)) revert InvalidAddress();
        
        bool wasAuthorized = authorizedMakers[maker];
        authorizedMakers[maker] = authorized;
        
        // Add to or remove from manufacturer list
        if (authorized && !wasAuthorized) {
            manufacturerList.push(maker);
        } else if (!authorized && wasAuthorized) {
            // Remove from list (keep last element, swap with current, pop)
            for (uint256 i = 0; i < manufacturerList.length; i++) {
                if (manufacturerList[i] == maker) {
                    manufacturerList[i] = manufacturerList[manufacturerList.length - 1];
                    manufacturerList.pop();
                    break;
                }
            }
        }
        
        emit ManufacturerAuthorized(maker, authorized);
    }

    /**
     * @notice Register a new product batch with serial numbers
     * @dev Only authorized manufacturers can call this
     * @param batchId Unique identifier for this product batch
     * @param name Product name
     * @param brand Brand name
     * @param serialHashes Array of hashed serial numbers for this batch
     * @param ipfsHash IPFS hash for product metadata (can be empty)
     * @param description Product description (can be empty)
     * @param imageUrl Product image URL (can be empty)
     * 
     * Note: Serial numbers should be hashed off-chain before calling this function
     * Example: keccak256(abi.encodePacked(batchId, serialNumber))
     */
    function registerProduct(
        uint256 batchId,
        string memory name,
        string memory brand,
        bytes32[] memory serialHashes,
        string memory ipfsHash,
        string memory description,
        string memory imageUrl
    ) external onlyMaker whenNotPaused nonReentrant {
        if (batchId == 0) revert InvalidBatchId();
        if (bytes(name).length == 0) revert EmptyName();
        if (bytes(brand).length == 0) revert EmptyBrand();
        if (serialHashes.length == 0) revert NoSerials();
        if (products[batchId].exists) revert BatchExists();

        // Register the product batch
        products[batchId] = Product({
            name: name,
            brand: brand,
            exists: true,
            registeredAt: block.timestamp,
            ipfsHash: ipfsHash,
            description: description,
            imageUrl: imageUrl
        });

        // Store serial-to-batch mapping for validation
        // This prevents attackers from verifying serials with wrong batch IDs
        for (uint256 i = 0; i < serialHashes.length; i++) {
            serialToBatch[serialHashes[i]] = batchId;
        }

        totalProducts++;

        emit ProductRegistered(batchId, name, brand, serialHashes.length);
    }

    /**
     * @notice Verify if a product serial number is authentic
     * @dev This function checks if:
     *      1. The serial belongs to an existing product batch
     *      2. This is the first time this serial is being verified
     * 
     * @param serialHash Hashed serial number to verify
     * @param batchId Product batch ID this serial belongs to
     * @return isAuthentic True if product is authentic (first scan), false otherwise
     * 
     * Security: Serial must be hashed off-chain using:
     * keccak256(abi.encodePacked(batchId, serialNumber))
     */
    function verify(
        bytes32 serialHash,
        uint256 batchId
    ) external whenNotPaused nonReentrant returns (bool) {
        if (batchId == 0) revert InvalidBatchId();
        if (!products[batchId].exists) revert BatchNotFound();
        
        // Validate that the serial hash belongs to the claimed batch
        if (serialToBatch[serialHash] != batchId) revert SerialNotInBatch();

        // Check if this serial has been verified before
        bool isAuthentic = !serialVerified[serialHash];

        // Mark as verified (even if it was already verified)
        // This prevents replay attacks
        if (isAuthentic) {
            serialVerified[serialHash] = true;
            totalVerifications++;
            batchVerificationCount[batchId]++;
        }

        // Record verification history
        uint256 timestamp = block.timestamp;
        verificationHistory[serialHash].push(VerificationRecord({
            serialHash: serialHash,
            batchId: batchId,
            verifier: msg.sender,
            timestamp: timestamp,
            isAuthentic: isAuthentic
        }));

        emit Verified(serialHash, batchId, isAuthentic, msg.sender, timestamp);

        return isAuthentic;
    }

    /**
     * @notice Get product batch information
     * @param batchId Product batch ID
     * @return name Product name
     * @return brand Brand name
     * @return exists Whether the batch exists
     * @return registeredAt Registration timestamp
     * @return ipfsHash IPFS hash for product metadata
     * @return description Product description
     * @return imageUrl Product image URL
     */
    function getProduct(
        uint256 batchId
    )
        external
        view
        returns (
            string memory name,
            string memory brand,
            bool exists,
            uint256 registeredAt,
            string memory ipfsHash,
            string memory description,
            string memory imageUrl
        )
    {
        Product memory product = products[batchId];
        return (
            product.name,
            product.brand,
            product.exists,
            product.registeredAt,
            product.ipfsHash,
            product.description,
            product.imageUrl
        );
    }

    /**
     * @notice Check if a serial number has been verified
     * @param serialHash Hashed serial number
     * @return verified True if this serial has been verified before
     */
    function isSerialVerified(bytes32 serialHash) external view returns (bool) {
        return serialVerified[serialHash];
    }

    /**
     * @notice Get contract statistics
     * @return totalProductsCount Total number of product batches registered
     * @return totalVerificationsCount Total number of verifications performed
     * @return totalManufacturers Number of authorized manufacturers
     */
    function getStatistics()
        external
        view
        returns (
            uint256 totalProductsCount,
            uint256 totalVerificationsCount,
            uint256 totalManufacturers
        )
    {
        return (totalProducts, totalVerifications, manufacturerList.length);
    }

    /**
     * @notice Get all authorized manufacturers
     * @return manufacturers Array of manufacturer addresses
     */
    function getManufacturers() external view returns (address[] memory) {
        return manufacturerList;
    }

    /**
     * @notice Transfer contract ownership to a new address
     * @dev Only current owner can call this
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) external onlyOwner nonReentrant {
        if (newOwner == address(0)) revert InvalidAddress();
        if (newOwner == owner) revert InvalidOwner();
        
        address oldOwner = owner;
        owner = newOwner;
        
        // Update authorization status
        authorizedMakers[oldOwner] = false;
        authorizedMakers[newOwner] = true;
        
        emit ManufacturerAuthorized(oldOwner, false);
        emit ManufacturerAuthorized(newOwner, true);
    }

    /**
     * @notice Batch verify multiple products at once
     * @dev More gas efficient for verifying multiple products
     * @param serialHashes Array of hashed serial numbers
     * @param batchIds Array of corresponding batch IDs
     * @return results Array of verification results (true = authentic, false = fake)
     */
    function batchVerify(
        bytes32[] memory serialHashes,
        uint256[] memory batchIds
    ) external whenNotPaused nonReentrant returns (bool[] memory results) {
        require(
            serialHashes.length == batchIds.length,
            "ChainCheck: arrays length mismatch"
        );

        results = new bool[](serialHashes.length);

        for (uint256 i = 0; i < serialHashes.length; i++) {
            if (batchIds[i] == 0) {
                results[i] = false;
                continue;
            }
            if (!products[batchIds[i]].exists) {
                results[i] = false;
                continue;
            }
            
            // Validate that the serial hash belongs to the claimed batch
            if (serialToBatch[serialHashes[i]] != batchIds[i]) {
                results[i] = false;
                continue;
            }

            bool isAuthentic = !serialVerified[serialHashes[i]];
            results[i] = isAuthentic;

            if (isAuthentic) {
                serialVerified[serialHashes[i]] = true;
                totalVerifications++;
                batchVerificationCount[batchIds[i]]++;
            }

            // Record verification history
            uint256 verifyTimestamp = block.timestamp;
            verificationHistory[serialHashes[i]].push(VerificationRecord({
                serialHash: serialHashes[i],
                batchId: batchIds[i],
                verifier: msg.sender,
                timestamp: verifyTimestamp,
                isAuthentic: isAuthentic
            }));

            emit Verified(serialHashes[i], batchIds[i], isAuthentic, msg.sender, verifyTimestamp);
        }
    }

    /**
     * @notice Pause the contract (emergency stop)
     * @dev Only owner can pause. When paused:
     *      - Product registration is disabled
     *      - Product verification is disabled
     *      - Owner functions still work
     */
    function pause() external onlyOwner whenNotPaused nonReentrant {
        paused = true;
        emit Paused(true);
    }

    /**
     * @notice Unpause the contract
     * @dev Only owner can unpause
     */
    function unpause() external onlyOwner whenPaused nonReentrant {
        paused = false;
        emit Paused(false);
    }

    /**
     * @notice Get multiple product batches by their IDs
     * @param batchIds Array of batch IDs to query
     * @return names Array of product names
     * @return brands Array of brand names
     * @return existsArray Array of existence flags
     * @return registeredAtArray Array of registration timestamps
     * @return ipfsHashes Array of IPFS hashes
     * @return descriptions Array of descriptions
     * @return imageUrls Array of image URLs
     */
    function getProductsBatch(uint256[] memory batchIds)
        external
        view
        returns (
            string[] memory names,
            string[] memory brands,
            bool[] memory existsArray,
            uint256[] memory registeredAtArray,
            string[] memory ipfsHashes,
            string[] memory descriptions,
            string[] memory imageUrls
        )
    {
        uint256 length = batchIds.length;
        names = new string[](length);
        brands = new string[](length);
        existsArray = new bool[](length);
        registeredAtArray = new uint256[](length);
        ipfsHashes = new string[](length);
        descriptions = new string[](length);
        imageUrls = new string[](length);

        for (uint256 i = 0; i < length; i++) {
            Product memory product = products[batchIds[i]];
            names[i] = product.name;
            brands[i] = product.brand;
            existsArray[i] = product.exists;
            registeredAtArray[i] = product.registeredAt;
            ipfsHashes[i] = product.ipfsHash;
            descriptions[i] = product.description;
            imageUrls[i] = product.imageUrl;
        }
    }

    /**
     * @notice Update product metadata (IPFS hash, description, image URL)
     * @dev Only authorized manufacturers can update their products
     * @param batchId Product batch ID
     * @param ipfsHash New IPFS hash (empty string to keep existing)
     * @param description New description (empty string to keep existing)
     * @param imageUrl New image URL (empty string to keep existing)
     */
    function updateProductMetadata(
        uint256 batchId,
        string memory ipfsHash,
        string memory description,
        string memory imageUrl
    ) external onlyMaker whenNotPaused nonReentrant {
        if (batchId == 0) revert InvalidBatchId();
        if (!products[batchId].exists) revert BatchNotFound();

        // Update only non-empty fields
        if (bytes(ipfsHash).length > 0) {
            products[batchId].ipfsHash = ipfsHash;
        }
        if (bytes(description).length > 0) {
            products[batchId].description = description;
        }
        if (bytes(imageUrl).length > 0) {
            products[batchId].imageUrl = imageUrl;
        }
    }

    /**
     * @notice Get verification history for a serial number
     * @param serialHash Hashed serial number
     * @return records Array of verification records
     */
    function getVerificationHistory(bytes32 serialHash)
        external
        view
        returns (VerificationRecord[] memory)
    {
        return verificationHistory[serialHash];
    }

    /**
     * @notice Get verification count for a serial number
     * @param serialHash Hashed serial number
     * @return count Number of times this serial has been verified
     */
    function getVerificationCount(bytes32 serialHash)
        external
        view
        returns (uint256)
    {
        return verificationHistory[serialHash].length;
    }

    /**
     * @notice Get verification history for multiple serials
     * @param serialHashes Array of hashed serial numbers
     * @return records Array of verification record arrays
     */
    function getVerificationHistoryBatch(bytes32[] memory serialHashes)
        external
        view
        returns (VerificationRecord[][] memory)
    {
        VerificationRecord[][] memory records = new VerificationRecord[][](serialHashes.length);
        for (uint256 i = 0; i < serialHashes.length; i++) {
            records[i] = verificationHistory[serialHashes[i]];
        }
        return records;
    }
}

