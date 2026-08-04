// app.js
// UI layer: reads/writes DOM, calls into chain.js for everything on-chain.
// Adjust the element IDs below to match your actual index.html if they differ.

const BASKETS = ["TSY-IDX", "REFI-IDX", "CMDTY-IDX", "EMC-IDX"];

let selectedBasket = "TSY-IDX";
let amount = 0;
let slippagePct = 0.5;
let pollHandle = null;

// --- DOM helpers ---
const el = (id) => document.getElementById(id);

function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text;
}

// --- Wallet connect button ---
async function onConnectClick() {
  const address = await handleWalletConnect(); // from chain.js
  if (address) {
    setText("walletStatus", `Connected: ${address.slice(0, 6)}...${address.slice(-4)}`);
    await refreshAll();
    startPolling();
  }
}

function onWalletConnected(address) {
  setText("walletStatus", `Connected: ${address.slice(0, 6)}...${address.slice(-4)}`);
  refreshAll();
  startPolling();
}

function onWalletDisconnected() {
  setText("walletStatus", "Disconnected");
  stopPolling();
}

function onWalletError(err) {
  setText("walletStatus", "Disconnected");
  console.error(err);
  // Surfacing a readable message instead of letting a raw provider error
  // (e.g. the window.ethereum multi-wallet conflict) go silent.
  alert(err?.message || "Wallet connection failed. Check for conflicting wallet extensions.");
}

// --- Basket selection / amount / slippage ---

function selectBasket(symbol) {
  if (!BASKETS.includes(symbol)) return;
  selectedBasket = symbol;
  updateBreakdown();
}

function setAmt(value) {
  const parsed = parseFloat(value);
  amount = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  updateBreakdown();
}

function setSlip(value) {
  const parsed = parseFloat(value);
  slippagePct = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0.5;
  updateBreakdown();
}

// --- Breakdown panel (estimated shares out at current NAV, before tx) ---

async function updateBreakdown() {
  try {
    const info = await getBasketInfo(selectedBasket); // chain.js
    const nav = parseFloat(info.navPerShare) || 1;
    const estimatedShares = amount > 0 ? amount / nav : 0;
    const minSharesAfterSlippage = estimatedShares * (1 - slippagePct / 100);

    setText("breakdownNav", `$${nav.toFixed(4)} / share`);
    setText("breakdownShares", estimatedShares.toFixed(6));
    setText("breakdownMinShares", minSharesAfterSlippage.toFixed(6));
    setText("breakdownStale", info.active ? "" : "Basket inactive");

    const buyBtn = el("buyBtn");
    if (buyBtn) buyBtn.disabled = !userAddress || amount <= 0 || !info.active;
  } catch (err) {
    console.error("updateBreakdown failed:", err);
  }
}

// --- Buy / Redeem ---

async function handleBuy() {
  if (!userAddress) {
    alert("Connect your wallet first.");
    return;
  }
  if (amount <= 0) {
    alert("Enter an amount to deposit.");
    return;
  }

  const buyBtn = el("buyBtn");
  const originalLabel = buyBtn ? buyBtn.textContent : null;
  if (buyBtn) {
    buyBtn.disabled = true;
    buyBtn.textContent = "Confirm in wallet...";
  }

  try {
    const receipt = await depositIntoBasket(selectedBasket, amount); // chain.js
    console.log("Deposit confirmed:", receipt.hash);
    await refreshAll();
    alert(`Deposit confirmed in block ${receipt.blockNumber}.`);
  } catch (err) {
    console.error("Deposit failed:", err);
    alert(err?.shortMessage || err?.message || "Deposit failed.");
  } finally {
    if (buyBtn) {
      buyBtn.disabled = false;
      buyBtn.textContent = originalLabel;
    }
  }
}

async function handleRedeem(shareAmount) {
  if (!userAddress) {
    alert("Connect your wallet first.");
    return;
  }
  if (!shareAmount || shareAmount <= 0) {
    alert("Enter a share amount to redeem.");
    return;
  }

  try {
    const receipt = await redeemFromBasket(selectedBasket, shareAmount); // chain.js
    console.log("Redeem confirmed:", receipt.hash);
    await refreshAll();
    alert(`Redemption confirmed in block ${receipt.blockNumber}.`);
  } catch (err) {
    console.error("Redeem failed:", err);
    alert(err?.shortMessage || err?.message || "Redemption failed.");
  }
}

// --- Refresh loop: block number, balances, breakdown ---

async function refreshAll() {
  try {
    const block = await getBlockNumber(); // chain.js
    setText("blockNumber", block.toString());
  } catch (err) {
    console.error("Failed to fetch block number:", err);
  }

  if (userAddress) {
    try {
      const [opnBal, usdcBal, shareBal] = await Promise.all([
        getOPNBalance(userAddress),
        getUSDCBalance(userAddress),
        getIndexTokenBalance(selectedBasket, userAddress),
      ]);
      setText("opnBalance", parseFloat(opnBal).toFixed(4));
      setText("usdcBalance", parseFloat(usdcBal).toFixed(2));
      setText("shareBalance", parseFloat(shareBal).toFixed(6));
    } catch (err) {
      console.error("Failed to refresh balances:", err);
    }
  }

  await updateBreakdown();
}

function startPolling() {
  stopPolling();
  pollHandle = setInterval(refreshAll, 15000); // every 15s, keep it light on the RPC
}

function stopPolling() {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
}

// --- Init ---

document.addEventListener("DOMContentLoaded", () => {
  el("connectBtn")?.addEventListener("click", onConnectClick);
  el("buyBtn")?.addEventListener("click", handleBuy);
  el("amountInput")?.addEventListener("input", (e) => setAmt(e.target.value));
  el("slippageInput")?.addEventListener("input", (e) => setSlip(e.target.value));

  BASKETS.forEach((symbol) => {
    el(`basket-${symbol}`)?.addEventListener("click", () => selectBasket(symbol));
  });

  // Populate initial read-only state even before wallet connect
  refreshAll();
});
