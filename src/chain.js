// chain.js
// Low-level chain layer: wallet connect, network handling, contract instances.
// Requires ethers.js loaded globally (e.g. <script src="https://cdn.jsdelivr.net/npm/ethers@6.13.2/dist/ethers.umd.min.js"></script>)
// and deployed-addresses.json output from deploy.js merged into DEPLOYED below.

const OPN_CHAIN_ID_DEC = 984;
const OPN_CHAIN_ID_HEX = "0x" + OPN_CHAIN_ID_DEC.toString(16); // 0x3D8
const OPN_RPC_URL = "https://testnet-rpc.iopn.tech";

// --- Fill these in from deployed-addresses.json after running deploy.js ---
const DEPLOYED = {
  mockUSDC: "0xREPLACE_WITH_MOCKUSDC_ADDRESS",
  rwaVault: "0xREPLACE_WITH_RWAVAULT_ADDRESS",
  indexTokens: {
    "TSY-IDX": "0xREPLACE_WITH_TSY_IDX_ADDRESS",
    "REFI-IDX": "0xREPLACE_WITH_REFI_IDX_ADDRESS",
    "CMDTY-IDX": "0xREPLACE_WITH_CMDTY_IDX_ADDRESS",
    "EMC-IDX": "0xREPLACE_WITH_EMC_IDX_ADDRESS",
  },
};

// --- Minimal ABIs (only the functions/events the frontend actually calls) ---
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function faucetMint(uint256 amount)", // MockUSDC only
];

const VAULT_ABI = [
  "function deposit(bytes32 basketId, uint256 depositAmount)",
  "function redeem(bytes32 basketId, uint256 shareAmount)",
  "function getBasket(bytes32 basketId) view returns (address indexToken, uint256 navPerShare, uint256 lastNavUpdate, bool active, uint256 totalShares)",
  "function isNavStale(bytes32 basketId) view returns (bool)",
  "event Deposited(bytes32 indexed basketId, address indexed user, uint256 depositAmount, uint256 sharesMinted)",
  "event Redeemed(bytes32 indexed basketId, address indexed user, uint256 sharesBurned, uint256 payoutAmount)",
];

// --- Module state ---
let provider = null;   // ethers.BrowserProvider
let signer = null;     // connected signer
let userAddress = null;

function basketIdFor(symbol) {
  return ethers.keccak256(ethers.toUtf8Bytes(symbol));
}

function getReadProvider() {
  // Falls back to a plain RPC provider for read-only calls before wallet connect
  return provider || new ethers.JsonRpcProvider(OPN_RPC_URL);
}

function getVaultContract(runner) {
  return new ethers.Contract(DEPLOYED.rwaVault, VAULT_ABI, runner || getReadProvider());
}

function getTokenContract(address, runner) {
  return new ethers.Contract(address, ERC20_ABI, runner || getReadProvider());
}

function getUSDCContract(runner) {
  return getTokenContract(DEPLOYED.mockUSDC, runner);
}

// --- Network handling ---

async function addIOPnNetwork() {
  if (!window.ethereum) throw new Error("No wallet extension found");
  try {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: OPN_CHAIN_ID_HEX,
          chainName: "IOPn OPN Testnet",
          nativeCurrency: { name: "OPN", symbol: "OPN", decimals: 18 },
          rpcUrls: [OPN_RPC_URL],
          blockExplorerUrls: [], // fill in if/when IOPn publishes a testnet explorer
        },
      ],
    });
  } catch (err) {
    // 4001 = user rejected; anything else, surface it
    if (err.code !== 4001) console.error("addIOPnNetwork failed:", err);
    throw err;
  }
}

async function ensureOPNNetwork() {
  const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
  if (chainIdHex.toLowerCase() !== OPN_CHAIN_ID_HEX.toLowerCase()) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: OPN_CHAIN_ID_HEX }],
      });
    } catch (switchErr) {
      // 4902 = chain not added to wallet yet
      if (switchErr.code === 4902) {
        await addIOPnNetwork();
      } else {
        throw switchErr;
      }
    }
  }
}

// --- Wallet connect ---

async function handleWalletConnect() {
  if (!window.ethereum) {
    alert("No wallet extension detected. Install MetaMask or a compatible wallet.");
    return null;
  }

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    await ensureOPNNetwork();

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    userAddress = accounts[0];

    window.ethereum.removeListener?.("accountsChanged", onAccountsChanged);
    window.ethereum.removeListener?.("chainChanged", onChainChanged);
    window.ethereum.on?.("accountsChanged", onAccountsChanged);
    window.ethereum.on?.("chainChanged", onChainChanged);

    if (typeof onWalletConnected === "function") onWalletConnected(userAddress);
    return userAddress;
  } catch (err) {
    // window.ethereum access is wrapped here so a multi-wallet-extension
    // conflict (e.g. Coinbase Wallet vs MetaMask both injecting window.ethereum)
    // can't silently break the whole page.
    console.error("Wallet connect failed:", err);
    if (typeof onWalletError === "function") onWalletError(err);
    return null;
  }
}

function onAccountsChanged(accounts) {
  if (!accounts || accounts.length === 0) {
    userAddress = null;
    signer = null;
    if (typeof onWalletDisconnected === "function") onWalletDisconnected();
  } else {
    userAddress = accounts[0];
    if (typeof onWalletConnected === "function") onWalletConnected(userAddress);
  }
}

function onChainChanged() {
  // Simplest safe reaction to a network switch is a reload, since provider/signer
  // state can otherwise get stale in subtle ways.
  window.location.reload();
}

// --- Reads ---

async function getBlockNumber() {
  return getReadProvider().getBlockNumber();
}

async function getOPNBalance(address) {
  const bal = await getReadProvider().getBalance(address);
  return ethers.formatEther(bal);
}

async function getUSDCBalance(address) {
  const usdc = getUSDCContract();
  const [raw, decimals] = await Promise.all([usdc.balanceOf(address), usdc.decimals()]);
  return ethers.formatUnits(raw, decimals);
}

async function getIndexTokenBalance(symbol, address) {
  const tokenAddress = DEPLOYED.indexTokens[symbol];
  if (!tokenAddress) throw new Error(`Unknown basket symbol: ${symbol}`);
  const token = getTokenContract(tokenAddress);
  const raw = await token.balanceOf(address);
  return ethers.formatUnits(raw, 18); // IndexToken uses default 18 decimals
}

async function getBasketInfo(symbol) {
  const vault = getVaultContract();
  const id = basketIdFor(symbol);
  const [indexToken, navPerShare, lastNavUpdate, active, totalShares] = await vault.getBasket(id);
  return {
    indexToken,
    navPerShare: ethers.formatUnits(navPerShare, 18),
    lastNavUpdate: Number(lastNavUpdate),
    active,
    totalShares: ethers.formatUnits(totalShares, 18),
  };
}

// --- Writes ---

async function ensureAllowance(spender, amountRaw) {
  const usdc = getUSDCContract(signer);
  const current = await usdc.allowance(userAddress, spender);
  if (current < amountRaw) {
    const tx = await usdc.approve(spender, amountRaw);
    await tx.wait();
  }
}

async function depositIntoBasket(symbol, humanAmount) {
  if (!signer) throw new Error("Wallet not connected");
  const vault = getVaultContract(signer);
  const decimals = 6; // MockUSDC decimals
  const amountRaw = ethers.parseUnits(String(humanAmount), decimals);

  await ensureAllowance(DEPLOYED.rwaVault, amountRaw);

  const id = basketIdFor(symbol);
  const tx = await vault.deposit(id, amountRaw);
  return tx.wait();
}

async function redeemFromBasket(symbol, humanShareAmount) {
  if (!signer) throw new Error("Wallet not connected");
  const vault = getVaultContract(signer);
  const shareAmountRaw = ethers.parseUnits(String(humanShareAmount), 18);

  const id = basketIdFor(symbol);
  const tx = await vault.redeem(id, shareAmountRaw);
  return tx.wait();
}
