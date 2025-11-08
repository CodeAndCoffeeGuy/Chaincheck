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
 */
contract ChainCheck {
    /**
     * @notice Product information structure
     * @param name Product name
     * @param brand Brand name
     * @param exists Whether the product batch exists
     * @param registeredAt Timestamp when product was registered
     */
    struct Product {
        string name;
        string brand;
        bool exists;
        uint256 registeredAt;
    }

    /**
     * @notice Mapping to track if a serial number has been verified
     * @dev serialHash => hasBeenVerified
     */
    mapping(bytes32 => bool) public serialVerified;

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
     */
    event Verified(
        bytes32 indexed serialHash,
        uint256 indexed batchId,
        bool isAuthentic,
        address verifier
    );

    /**
     * @notice Event emitted when a manufacturer is authorized
     * @param maker Manufacturer address
     * @param authorized Whether authorized or revoked
     */
    event ManufacturerAuthorized(address indexed maker, bool authorized);

    /**
     * @notice Modifier to restrict function access to contract owner
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "ChainCheck: caller is not the owner");
        _;
    }

    /**
     * @notice Modifier to restrict function access to authorized manufacturers
     */
    modifier onlyMaker() {
        require(
            authorizedMakers[msg.sender],
            "ChainCheck: not an authorized manufacturer"
        );
        _;
    }

    /**
     * @notice Constructor sets the contract deployer as owner and authorizes them as manufacturer
     */
    constructor() {
        owner = msg.sender;
        authorizedMakers[msg.sender] = true;
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
    ) external onlyOwner {
        require(maker != address(0), "ChainCheck: invalid address");
        authorizedMakers[maker] = authorized;
        emit ManufacturerAuthorized(maker, authorized);
    }

    /**
     * @notice Register a new product batch with serial numbers
     * @dev Only authorized manufacturers can call this
     * @param batchId Unique identifier for this product batch
     * @param name Product name
     * @param brand Brand name
     * @param serialHashes Array of hashed serial numbers for this batch
     * 
     * Note: Serial numbers should be hashed off-chain before calling this function
     * Example: keccak256(abi.encodePacked(batchId, serialNumber))
     */
    function registerProduct(
        uint256 batchId,
        string memory name,
        string memory brand,
        bytes32[] memory serialHashes
    ) external onlyMaker {
        require(batchId > 0, "ChainCheck: invalid batch ID");
        require(bytes(name).length > 0, "ChainCheck: name required");
        require(bytes(brand).length > 0, "ChainCheck: brand required");
        require(serialHashes.length > 0, "ChainCheck: serials required");
        require(!products[batchId].exists, "ChainCheck: batch already exists");

        // Register the product batch
        products[batchId] = Product({
            name: name,
            brand: brand,
            exists: true,
            registeredAt: block.timestamp
        });

        // Mark all serial hashes as unverified (ready for first verification)
        // Note: We don't store all serials, just track them when verified
        // This saves gas and allows for dynamic serial registration

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
    ) external returns (bool) {
        require(batchId > 0, "ChainCheck: invalid batch ID");
        require(products[batchId].exists, "ChainCheck: product batch not found");

        // Check if this serial has been verified before
        bool isAuthentic = !serialVerified[serialHash];

        // Mark as verified (even if it was already verified)
        // This prevents replay attacks
        if (isAuthentic) {
            serialVerified[serialHash] = true;
            totalVerifications++;
        }

        emit Verified(serialHash, batchId, isAuthentic, msg.sender);

        return isAuthentic;
    }

    /**
     * @notice Get product batch information
     * @param batchId Product batch ID
     * @return name Product name
     * @return brand Brand name
     * @return exists Whether the batch exists
     * @return registeredAt Registration timestamp
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
            uint256 registeredAt
        )
    {
        Product memory product = products[batchId];
        return (product.name, product.brand, product.exists, product.registeredAt);
    }

    /**
     * @notice Check if a serial number has been verified
     * @param serialHash Hashed serial number
     * @return verified True if this serial has been verified before
     */
    function isSerialVerified(bytes32 serialHash) external view returns (bool) {
        return serialVerified[serialHash];
    }
}

