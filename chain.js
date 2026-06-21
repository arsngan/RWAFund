/**
 * chain.js — IOPn OPN Chain integration
 *
 * Chain details from https://testnet.iopn.tech/
 * Docs: https://iopn.gitbook.io/iopn/developer-docs
 *
 * Network: OPN Testnet
 * Chain ID: 984 (0x3D8)
 * RPC: https://testnet-rpc.iopn.tech
 * Symbol: OPN
 * Explorer: https://testnet.iopn.tech
 * Block time: ~1 second
 * Gas price: Fixed 7 Gwei
 */

const IOPN_CHAIN = {
  chainId: '0x3D8',                        // 984 in hex
  chainName: 'OPN Testnet',
  nativeCurrency: {
    name: 'OPN',
    symbol: 'OPN',
    decimals: 18,
  },
  rpcUrls: ['https://testnet-rpc.iopn.tech'],
  blockExplorerUrls: ['https://testnet.iopn.tech'],
};

const IOPN_CHAIN_ID_DEC = 984;
const IOPN_RPC = 'https://testnet-rpc.iopn.tech';

// ── State ──────────────────────────────────────────────────
let walletConnected = false;
let walletAddress = '';
let currentChainId = null;
let blockPollingInterval = null;

// ── Add IOPn Network to MetaMask ───────────────────────────
async function addIOPnNetwork() {
  if (!window.ethereum) {
    showToast('Please install MetaMask to connect', true);
    return;
  }
  try {
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [IOPN_CHAIN],
    });
    showToast('OPN Testnet added to wallet!');
    updateChainBadge(IOPN_CHAIN_ID_DEC);
  } catch (err) {
    if (err.code === 4001) {
      showToast('Network add cancelled', true);
    } else {
      console.error('addIOPnNetwork error:', err);
      showToast('Could not add network: ' + (err.message || 'unknown error'), true);
    }
  }
}

// ── Switch to IOPn Network ─────────────────────────────────
async function switchToIOPn() {
  if (!window.ethereum) return;
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: IOPN_CHAIN.chainId }],
    });
  } catch (switchErr) {
    // Chain not yet added — add it
    if (switchErr.code === 4902) {
      await addIOPnNetwork();
    } else {
      throw switchErr;
    }
  }
}

// ── Connect Wallet ─────────────────────────────────────────
async function handleWalletConnect() {
  if (!window.ethereum) {
    showToast('MetaMask not found. Please install it.', true);
    window.open('https://metamask.io/download/', '_blank');
    return;
  }

  if (walletConnected) {
    disconnectWallet();
    return;
  }

  try {
    // Request accounts
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts.length) return;

    walletAddress = accounts[0];
    walletConnected = true;

    // Ensure we're on IOPn
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    currentChainId = parseInt(chainId, 16);
    if (currentChainId !== IOPN_CHAIN_ID_DEC) {
      showToast('Switching to OPN Testnet...');
      await switchToIOPn();
    }

    onWalletConnected();
  } catch (err) {
    if (err.code === 4001) {
      showToast('Connection rejected', true);
    } else {
      console.error('handleWalletConnect error:', err);
      showToast('Connection failed: ' + (err.message || 'unknown error'), true);
    }
  }
}

function onWalletConnected() {
  const shortAddr = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
  document.getElementById('walletText').textContent = shortAddr;
  document.getElementById('walletDot').classList.add('on');
  document.getElementById('walletBtn').classList.add('connected');
  document.getElementById('buyBtn').disabled = false;
  updateBreakdown();
  fetchOPNBalance();
  startBlockPolling();
  listenForChainEvents();
  showToast('Wallet connected · OPN Testnet');
}

function disconnectWallet() {
  walletConnected = false;
  walletAddress = '';
  document.getElementById('walletText').textContent = 'Connect Wallet';
  document.getElementById('walletDot').classList.remove('on');
  document.getElementById('walletBtn').classList.remove('connected');
  document.getElementById('buyBtn').disabled = true;
  document.getElementById('buyBtn').textContent = 'Connect wallet to buy';
  document.getElementById('opnBalance').textContent = '—';
  stopBlockPolling();
}

// ── Fetch OPN Balance ──────────────────────────────────────
async function fetchOPNBalance() {
  if (!walletConnected || !walletAddress) return;
  try {
    const result = await rpcCall('eth_getBalance', [walletAddress, 'latest']);
    const balanceWei = BigInt(result);
    const balanceEth = Number(balanceWei) / 1e18;
    document.getElementById('opnBalance').textContent = balanceEth.toFixed(4) + ' OPN';
  } catch (err) {
    console.warn('Balance fetch failed:', err);
    document.getElementById('opnBalance').textContent = '— OPN';
  }
}

// ── Block Polling ──────────────────────────────────────────
function startBlockPolling() {
  fetchLatestBlock();
  blockPollingInterval = setInterval(fetchLatestBlock, 2000);
}

function stopBlockPolling() {
  if (blockPollingInterval) {
    clearInterval(blockPollingInterval);
    blockPollingInterval = null;
  }
  document.getElementById('blockNum').textContent = '—';
}

async function fetchLatestBlock() {
  try {
    const result = await rpcCall('eth_blockNumber', []);
    const blockNum = parseInt(result, 16).toLocaleString();
    document.getElementById('blockNum').textContent = '#' + blockNum;
  } catch (err) {
    // Silent — block polling is informational
  }
}

// ── Generic JSON-RPC call to IOPn ─────────────────────────
async function rpcCall(method, params) {
  const res = await fetch(IOPN_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

// ── Listen for wallet/chain events ────────────────────────
function listenForChainEvents() {
  if (!window.ethereum) return;

  window.ethereum.on('accountsChanged', (accounts) => {
    if (!accounts.length) {
      disconnectWallet();
    } else {
      walletAddress = accounts[0];
      const shortAddr = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
      document.getElementById('walletText').textContent = shortAddr;
      fetchOPNBalance();
      showToast('Account switched');
    }
  });

  window.ethereum.on('chainChanged', (chainId) => {
    currentChainId = parseInt(chainId, 16);
    updateChainBadge(currentChainId);
    if (currentChainId !== IOPN_CHAIN_ID_DEC) {
      showToast('Please switch to OPN Testnet (Chain 984)', true);
      document.getElementById('buyBtn').disabled = true;
    } else {
      document.getElementById('buyBtn').disabled = false;
      showToast('Connected to OPN Testnet');
      updateBreakdown();
    }
    fetchOPNBalance();
  });
}

// ── Chain Badge ────────────────────────────────────────────
function updateChainBadge(chainId) {
  const label = document.getElementById('chainLabel');
  const badge = document.getElementById('chainBadge');
  if (chainId === IOPN_CHAIN_ID_DEC) {
    label.textContent = 'OPN Testnet';
    badge.style.background = 'rgba(29,158,117,0.1)';
    badge.style.borderColor = 'rgba(29,158,117,0.3)';
    badge.style.color = 'var(--teal)';
  } else {
    label.textContent = `Chain ${chainId}`;
    badge.style.background = 'rgba(216,90,48,0.1)';
    badge.style.borderColor = 'rgba(216,90,48,0.3)';
    badge.style.color = 'var(--coral)';
  }
}

// ── Auto-reconnect on page load ────────────────────────────
window.addEventListener('load', async () => {
  if (window.ethereum) {
    try {
      // Check if already connected (no prompt)
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length) {
        walletAddress = accounts[0];
        walletConnected = true;
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        currentChainId = parseInt(chainId, 16);
        updateChainBadge(currentChainId);
        onWalletConnected();
      }
    } catch (_) {}
  }
});
