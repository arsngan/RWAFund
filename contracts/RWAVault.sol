// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/// @notice Minimal interface the vault expects from each IndexToken.
/// IndexToken.sol should restrict mint/burn to `onlyVault` (this contract).
interface IIndexToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function totalSupply() external view returns (uint256);
}

/**
 * @title RWAVault
 * @notice Holds deposits backing an RWA index basket (TSY-IDX, REFI-IDX,
 *         CMDTY-IDX, EMC-IDX) and mints/burns the corresponding IndexToken
 *         against a NAV-per-share price. Since the underlying real-world
 *         assets (T-bills, real estate, commodities) cannot settle on-chain,
 *         NAV is fed by a trusted updater (owner/oracle role) rather than
 *         computed from on-chain price data. This is a testnet-appropriate
 *         design — a production version would replace `updateNAV` with a
 *         Chainlink oracle or off-chain attested price feed with staleness
 *         checks and multi-sig update rights.
 */
contract RWAVault is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    struct Basket {
        IIndexToken indexToken;   // the ERC-20 share token for this basket
        uint256 navPerShare;      // NAV per share, scaled by 1e18
        uint256 lastNavUpdate;    // timestamp of last NAV update
        bool active;              // whether deposits/redemptions are allowed
    }

    /// @notice The stablecoin (e.g. USDC-equivalent on OPN testnet) used for deposits/redemptions
    IERC20 public immutable depositToken;

    /// @notice basketId => Basket config
    mapping(bytes32 => Basket) public baskets;

    /// @notice list of registered basket ids, for enumeration
    bytes32[] public basketIds;

    /// @notice address allowed to push NAV updates (can be owner or a separate oracle relayer)
    address public navUpdater;

    /// @notice max age (seconds) a NAV quote is considered valid before mint/redeem is blocked
    uint256 public navStaleAfter = 1 days;

    event BasketRegistered(bytes32 indexed basketId, address indexToken);
    event NavUpdated(bytes32 indexed basketId, uint256 navPerShare, uint256 timestamp);
    event Deposited(bytes32 indexed basketId, address indexed user, uint256 depositAmount, uint256 sharesMinted);
    event Redeemed(bytes32 indexed basketId, address indexed user, uint256 sharesBurned, uint256 payoutAmount);
    event NavUpdaterChanged(address indexed newUpdater);
    event BasketActiveSet(bytes32 indexed basketId, bool active);

    modifier onlyNavUpdater() {
        require(msg.sender == navUpdater || msg.sender == owner(), "not authorized");
        _;
    }

    constructor(address _depositToken, address _navUpdater) Ownable(msg.sender) {
        require(_depositToken != address(0), "bad deposit token");
        depositToken = IERC20(_depositToken);
        navUpdater = _navUpdater == address(0) ? msg.sender : _navUpdater;
    }

    // ---------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------

    /// @notice Register a new index basket (e.g. "TSY-IDX") with its token and starting NAV.
    /// @param basketId keccak256 of the basket symbol, e.g. keccak256("TSY-IDX")
    /// @param indexToken deployed IndexToken address for this basket
    /// @param initialNavPerShare starting NAV per share, scaled 1e18 (e.g. 1e18 = $1.00)
    function registerBasket(
        bytes32 basketId,
        address indexToken,
        uint256 initialNavPerShare
    ) external onlyOwner {
        require(indexToken != address(0), "bad index token");
        require(address(baskets[basketId].indexToken) == address(0), "already registered");
        require(initialNavPerShare > 0, "nav must be > 0");

        baskets[basketId] = Basket({
            indexToken: IIndexToken(indexToken),
            navPerShare: initialNavPerShare,
            lastNavUpdate: block.timestamp,
            active: true
        });
        basketIds.push(basketId);

        emit BasketRegistered(basketId, indexToken);
        emit NavUpdated(basketId, initialNavPerShare, block.timestamp);
    }

    /// @notice Push a new NAV-per-share for a basket. Called by the trusted updater/oracle.
    function updateNAV(bytes32 basketId, uint256 newNavPerShare) external onlyNavUpdater {
        Basket storage b = baskets[basketId];
        require(address(b.indexToken) != address(0), "unknown basket");
        require(newNavPerShare > 0, "nav must be > 0");

        b.navPerShare = newNavPerShare;
        b.lastNavUpdate = block.timestamp;

        emit NavUpdated(basketId, newNavPerShare, block.timestamp);
    }

    function setNavUpdater(address newUpdater) external onlyOwner {
        require(newUpdater != address(0), "bad address");
        navUpdater = newUpdater;
        emit NavUpdaterChanged(newUpdater);
    }

    function setNavStaleAfter(uint256 seconds_) external onlyOwner {
        require(seconds_ >= 1 hours, "too short");
        navStaleAfter = seconds_;
    }

    function setBasketActive(bytes32 basketId, bool active) external onlyOwner {
        require(address(baskets[basketId].indexToken) != address(0), "unknown basket");
        baskets[basketId].active = active;
        emit BasketActiveSet(basketId, active);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Owner can sweep deposit-token dust or recover accidentally sent tokens
    ///         (never the depositToken itself beyond what's unbacked — kept simple for testnet).
    function rescueToken(address token, uint256 amount, address to) external onlyOwner {
        require(token != address(depositToken), "cannot rescue deposit token");
        IERC20(token).safeTransfer(to, amount);
    }

    // ---------------------------------------------------------------
    // User actions
    // ---------------------------------------------------------------

    /// @notice Deposit `depositAmount` of the deposit token and mint index shares at current NAV.
    function deposit(bytes32 basketId, uint256 depositAmount) external nonReentrant whenNotPaused {
        Basket storage b = baskets[basketId];
        require(address(b.indexToken) != address(0), "unknown basket");
        require(b.active, "basket inactive");
        require(depositAmount > 0, "amount must be > 0");
        require(block.timestamp - b.lastNavUpdate <= navStaleAfter, "nav stale");

        uint256 sharesToMint = (depositAmount * 1e18) / b.navPerShare;
        require(sharesToMint > 0, "deposit too small");

        depositToken.safeTransferFrom(msg.sender, address(this), depositAmount);
        b.indexToken.mint(msg.sender, sharesToMint);

        emit Deposited(basketId, msg.sender, depositAmount, sharesToMint);
    }

    /// @notice Burn `shareAmount` of index shares and withdraw the deposit token at current NAV.
    function redeem(bytes32 basketId, uint256 shareAmount) external nonReentrant whenNotPaused {
        Basket storage b = baskets[basketId];
        require(address(b.indexToken) != address(0), "unknown basket");
        require(b.active, "basket inactive");
        require(shareAmount > 0, "amount must be > 0");
        require(block.timestamp - b.lastNavUpdate <= navStaleAfter, "nav stale");

        uint256 payoutAmount = (shareAmount * b.navPerShare) / 1e18;
        require(payoutAmount > 0, "redeem too small");
        require(depositToken.balanceOf(address(this)) >= payoutAmount, "insufficient vault liquidity");

        b.indexToken.burn(msg.sender, shareAmount);
        depositToken.safeTransfer(msg.sender, payoutAmount);

        emit Redeemed(basketId, msg.sender, shareAmount, payoutAmount);
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    function getBasket(bytes32 basketId)
        external
        view
        returns (address indexToken, uint256 navPerShare, uint256 lastNavUpdate, bool active, uint256 totalShares)
    {
        Basket storage b = baskets[basketId];
        return (
            address(b.indexToken),
            b.navPerShare,
            b.lastNavUpdate,
            b.active,
            address(b.indexToken) == address(0) ? 0 : b.indexToken.totalSupply()
        );
    }

    function basketCount() external view returns (uint256) {
        return basketIds.length;
    }

    function isNavStale(bytes32 basketId) external view returns (bool) {
        Basket storage b = baskets[basketId];
        if (address(b.indexToken) == address(0)) return true;
        return block.timestamp - b.lastNavUpdate > navStaleAfter;
    }
}
