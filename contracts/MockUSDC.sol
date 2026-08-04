// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Testnet-only mock stablecoin used as the RWAVault deposit token.
///         6 decimals to mirror real USDC. Anyone can mint on testnet so
///         users can self-serve test funds — remove open minting before
///         any non-testnet deployment.
contract MockUSDC is ERC20, Ownable {
    uint8 private constant _DECIMALS = 6;

    constructor() ERC20("Mock USD Coin", "mUSDC") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000 * 10 ** _DECIMALS); // seed deployer with 1M mUSDC
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Open faucet mint for testnet convenience. Cap per-call amount to prevent abuse.
    function faucetMint(uint256 amount) external {
        require(amount <= 10_000 * 10 ** _DECIMALS, "max 10,000 mUSDC per call");
        _mint(msg.sender, amount);
    }
}
