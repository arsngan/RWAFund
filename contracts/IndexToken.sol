// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IndexToken
 * @notice ERC-20 share token for a single RWAFund index basket
 *         (e.g. TSY-IDX, REFI-IDX, CMDTY-IDX, EMC-IDX). Minting and
 *         burning are restricted to the RWAVault contract, which is
 *         the only party allowed to issue/redeem shares — it does so
 *         in exchange for deposit-token collateral, at the vault's
 *         current NAV per share. The token itself holds no logic
 *         about price or collateral; it's purely the accounting unit.
 */
contract IndexToken is ERC20, Ownable {
    /// @notice the RWAVault contract allowed to mint/burn this token
    address public vault;

    event VaultChanged(address indexed previousVault, address indexed newVault);

    modifier onlyVault() {
        require(msg.sender == vault, "IndexToken: caller is not the vault");
        _;
    }

    constructor(string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        Ownable(msg.sender)
    {}

    /// @notice Set (or change) the vault allowed to mint/burn this token.
    ///         Callable once by the deployer during setup; can be re-pointed
    ///         later by the owner if the vault is ever redeployed/upgraded.
    function setVault(address newVault) external onlyOwner {
        require(newVault != address(0), "IndexToken: zero vault address");
        address previous = vault;
        vault = newVault;
        emit VaultChanged(previous, newVault);
    }

    /// @notice Mint new shares. Only callable by the vault, on user deposit.
    function mint(address to, uint256 amount) external onlyVault {
        _mint(to, amount);
    }

    /// @notice Burn shares. Only callable by the vault, on user redemption.
    function burn(address from, uint256 amount) external onlyVault {
        _burn(from, amount);
    }
}
