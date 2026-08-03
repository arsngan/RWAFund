// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

// Compatible with IOPn OPN Chain (EVM, Chain ID 984)
// Supports Pectra EVM features (EIP-7702, TLOAD/TSTORE, MCOPY)
// Gas: Fixed 7 Gwei on OPN Testnet
// Deploy: npx hardhat run scripts/deploy.js --network opnTestnet

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IndexToken
 * @notice ERC-20 representing one share of an RWA basket index.
 *         Users deposit USDC and receive index tokens at the current NAV.
 *         The owner (RWAVault) manages NAV updates and underlying positions.
 */
contract IndexToken is ERC20, Ownable, ReentrancyGuard {

    // ── State ──────────────────────────────────────────────
    IERC20 public immutable usdc;     // USDC deposit token
    uint256 public navPerToken;       // NAV in USDC (6 decimals), scaled 1e18
    uint256 public protocolFeeBps;    // Protocol fee in basis points (default: 10 = 0.1%)
    address public feeRecipient;

    // Index metadata
    string  public indexName;
    string  public indexTicker;

    // ── Events ─────────────────────────────────────────────
    event Minted(address indexed user, uint256 usdcIn, uint256 tokensOut, uint256 fee);
    event Redeemed(address indexed user, uint256 tokensIn, uint256 usdcOut, uint256 fee);
    event NavUpdated(uint256 oldNav, uint256 newNav);
    event FeeUpdated(uint256 newFeeBps);

    // ── Constructor ────────────────────────────────────────
    constructor(
        string memory _name,
        string memory _ticker,
        address _usdc,
        uint256 _initialNav,   // 6 decimal USDC price, scaled 1e18 (e.g. 1.0412 USDC = 1041200000000000000)
        address _feeRecipient
    )
        ERC20(_name, _ticker)
        Ownable(msg.sender)
    {
        require(_usdc != address(0), "Invalid USDC address");
        require(_initialNav > 0, "NAV must be > 0");
        usdc           = IERC20(_usdc);
        navPerToken    = _initialNav;
        protocolFeeBps = 10; // 0.1% default
        feeRecipient   = _feeRecipient;
        indexName      = _name;
        indexTicker    = _ticker;
    }

    // ── Mint (buy) ─────────────────────────────────────────
    /**
     * @notice Deposit USDC and receive index tokens at current NAV.
     * @param usdcAmount Amount of USDC (6 decimals) to deposit.
     * @param minTokensOut Minimum tokens to receive (slippage protection).
     */
    function mint(uint256 usdcAmount, uint256 minTokensOut)
        external
        nonReentrant
    {
        require(usdcAmount > 0, "Amount must be > 0");

        // Deduct protocol fee
        uint256 fee = (usdcAmount * protocolFeeBps) / 10_000;
        uint256 netAmount = usdcAmount - fee;

        // Calculate tokens to mint: netAmount / navPerToken
        // navPerToken is 1e18-scaled, usdc is 6 decimals → scale to 18
        uint256 tokensOut = (netAmount * 1e30) / navPerToken;

        require(tokensOut >= minTokensOut, "Slippage exceeded");

        // Transfer USDC in
        require(
            usdc.transferFrom(msg.sender, address(this), usdcAmount),
            "USDC transfer failed"
        );

        // Send fee to recipient
        if (fee > 0) {
            require(usdc.transfer(feeRecipient, fee), "Fee transfer failed");
        }

        _mint(msg.sender, tokensOut);

        emit Minted(msg.sender, usdcAmount, tokensOut, fee);
    }

    // ── Redeem (sell) ──────────────────────────────────────
    /**
     * @notice Burn index tokens and receive USDC at current NAV.
     * @param tokenAmount Amount of index tokens to burn.
     * @param minUsdcOut Minimum USDC to receive (slippage protection).
     */
    function redeem(uint256 tokenAmount, uint256 minUsdcOut)
        external
        nonReentrant
    {
        require(tokenAmount > 0, "Amount must be > 0");
        require(balanceOf(msg.sender) >= tokenAmount, "Insufficient balance");

        // Calculate USDC out: tokenAmount * navPerToken
        uint256 grossUsdc = (tokenAmount * navPerToken) / 1e30;

        // Deduct fee
        uint256 fee = (grossUsdc * protocolFeeBps) / 10_000;
        uint256 netUsdc = grossUsdc - fee;

        require(netUsdc >= minUsdcOut, "Slippage exceeded");
        require(usdc.balanceOf(address(this)) >= grossUsdc, "Insufficient vault USDC");

        _burn(msg.sender, tokenAmount);

        if (fee > 0) {
            require(usdc.transfer(feeRecipient, fee), "Fee transfer failed");
        }
        require(usdc.transfer(msg.sender, netUsdc), "USDC transfer failed");

        emit Redeemed(msg.sender, tokenAmount, netUsdc, fee);
    }

    // ── Admin ──────────────────────────────────────────────

    /**
     * @notice Update NAV per token (called by oracle / owner after rebalance).
     * @param newNav New NAV in USDC (6 dec), scaled 1e18.
     */
    function updateNav(uint256 newNav) external onlyOwner {
        require(newNav > 0, "NAV must be > 0");
        emit NavUpdated(navPerToken, newNav);
        navPerToken = newNav;
    }

    function setFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 100, "Max fee 1%");
        protocolFeeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid address");
        feeRecipient = newRecipient;
    }

    // ── View helpers ───────────────────────────────────────
    function navForAmount(uint256 usdcAmount) external view returns (uint256 tokensOut) {
        uint256 fee = (usdcAmount * protocolFeeBps) / 10_000;
        uint256 net = usdcAmount - fee;
        tokensOut = (net * 1e30) / navPerToken;
    }

    function usdcForTokens(uint256 tokenAmount) external view returns (uint256 usdcOut) {
        uint256 gross = (tokenAmount * navPerToken) / 1e30;
        uint256 fee   = (gross * protocolFeeBps) / 10_000;
        usdcOut = gross - fee;
    }

    // Override decimals to 18 (standard ERC-20)
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
