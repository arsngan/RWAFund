/**
 * app.js — RWAFund dApp logic
 *
 * Handles: index card rendering, donut chart,
 * buy form, breakdown calc, live price ticks, toast UI
 */

// ── State ──────────────────────────────────────────────────
let activeIdx = 0;
let slipTolerance = 0.001; // 0.1%
let compositionChart = null;
let portfolio = { value: 0, tokens: [0, 0, 0, 0] };

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderIndexCards();
  selectIndex(0);
  startLiveTicker();
});

// ── Render index cards ─────────────────────────────────────
function renderIndexCards() {
  const grid = document.getElementById('indexGrid');
  grid.innerHTML = INDICES.map((idx, i) => {
    const isUp = idx.change >= 0;
    const changeStr = (isUp ? '+' : '') + idx.change.toFixed(2) + '%';
    const barWidth = Math.min(Math.max(((idx.nav - 0.9) / 0.3) * 100, 15), 95).toFixed(0);
    return `
      <div class="index-card" data-i="${i}" role="listitem"
           style="--card-color: ${idx.color}"
           onclick="selectIndex(${i})"
           onkeydown="if(event.key==='Enter')selectIndex(${i})"
           tabindex="0"
           aria-label="${idx.name}, NAV ${idx.nav.toFixed(4)}, ${changeStr} today">
        <div class="ic-header">
          <div class="ic-icon" style="background:${idx.color}1a; color:${idx.color}">
            <i class="ti ${idx.iconClass}" aria-hidden="true"></i>
          </div>
          <span class="ic-badge" style="background:${idx.color}18; color:${idx.color}">
            ${idx.ticker}
          </span>
        </div>
        <div class="ic-name">${idx.name}</div>
        <div class="ic-nav mono" id="cardNav${i}">$${idx.nav.toFixed(4)}</div>
        <div class="ic-change ${isUp ? 'up' : 'down'} mono" id="cardChg${i}">
          ${isUp ? '▲' : '▼'} ${changeStr} today
        </div>
        <div class="ic-bar">
          <div class="ic-fill" style="width:${barWidth}%; background:${idx.color};"></div>
        </div>
        <div class="ic-stats">
          <div class="ic-stat">
            <strong class="mono">${idx.apy}%</strong>
            APY
          </div>
          <div class="ic-stat">
            <strong class="mono">$${idx.tvl}</strong>
            TVL
          </div>
          <div class="ic-stat">
            <strong>${idx.assets.length}</strong>
            Assets
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Select Index ───────────────────────────────────────────
function selectIndex(i) {
  activeIdx = i;
  const idx = INDICES[i];

  // Update active card
  document.querySelectorAll('.index-card').forEach((c, j) => {
    c.classList.toggle('active', j === i);
  });

  // Update panel header
  document.getElementById('compositionTitle').textContent =
    idx.name + ' — basket composition';
  document.getElementById('selectedTag').textContent = idx.ticker;

  // Update explorer link to include contract address
  const link = document.getElementById('explorerLink');
  link.href = idx.contractAddress !== '0x0000000000000000000000000000000000000001'
    ? `https://testnet.iopn.tech/address/${idx.contractAddress}`
    : 'https://testnet.iopn.tech';

  // Update yield metric
  document.getElementById('estYield').textContent = idx.apy.toFixed(1) + '%';

  renderChart();
  renderHoldings();
  updateBreakdown();
}

// ── Donut Chart ────────────────────────────────────────────
function renderChart() {
  const idx = INDICES[activeIdx];
  const data    = idx.assets.map(a => a.weight);
  const colors  = idx.assets.map(a => a.dot);
  const labels  = idx.assets.map(a => a.name);
  const isDark  = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (compositionChart) compositionChart.destroy();

  compositionChart = new Chart(
    document.getElementById('compositionChart'),
    {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: isDark ? '#161b22' : '#ffffff',
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.parsed}%`,
            },
          },
        },
        animation: { duration: 400 },
      },
    }
  );

  // Custom legend
  const legendEl = document.getElementById('chartLegend');
  legendEl.innerHTML = idx.assets.map(a => `
    <div class="legend-row">
      <span class="legend-dot" style="background:${a.dot}"></span>
      <span class="legend-name">${a.name}</span>
      <span class="legend-pct">${a.weight}%</span>
    </div>
  `).join('');
}

// ── Holdings Table ─────────────────────────────────────────
function renderHoldings() {
  const idx = INDICES[activeIdx];
  document.getElementById('holdingsTbody').innerHTML = idx.assets.map(a => `
    <tr>
      <td>
        <span class="asset-dot" style="background:${a.dot}"></span>
        ${a.name}
      </td>
      <td style="color:var(--text2); font-size:11px;">${a.issuer}</td>
      <td class="mono">${a.weight}%</td>
      <td class="up mono" style="font-size:11px;">${a.yield > 0 ? a.yield.toFixed(2) + '%' : '—'}</td>
      <td>${a.nav}</td>
    </tr>
  `).join('');
}

// ── Buy Form ───────────────────────────────────────────────
function setAmt(v) {
  document.getElementById('buyAmount').value = v;
  updateBreakdown();
}

function setSlip(idx, btn) {
  const tolerances = [0.001, 0.003, 0.005];
  slipTolerance = tolerances[idx];
  document.querySelectorAll('#slipBtns button').forEach((b, j) => {
    b.classList.toggle('active', j === idx);
  });
}

function updateBreakdown() {
  const amt = parseFloat(document.getElementById('buyAmount').value) || 0;
  const fee = amt * 0.001;
  const net = amt - fee;
  const idx = INDICES[activeIdx];
  const tokens = net / idx.nav;
  const btn = document.getElementById('buyBtn');

  document.getElementById('bPay').textContent = '$' + amt.toFixed(2);
  document.getElementById('bFee').textContent = '−$' + fee.toFixed(2);
  document.getElementById('bReceive').textContent =
    tokens > 0 ? tokens.toFixed(2) + ' ' + idx.ticker : '0.00 ' + idx.ticker;

  if (walletConnected) {
    if (amt <= 0) {
      btn.textContent = 'Enter an amount';
      btn.disabled = true;
    } else {
      btn.textContent = `Buy ${tokens.toFixed(2)} ${idx.ticker}`;
      btn.disabled = false;
    }
  }
}

// ── Handle Buy ─────────────────────────────────────────────
async function handleBuy() {
  if (!walletConnected) {
    handleWalletConnect();
    return;
  }

  // Chain check
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (parseInt(chainId, 16) !== IOPN_CHAIN_ID_DEC) {
    showToast('Please switch to OPN Testnet first', true);
    await switchToIOPn();
    return;
  }

  const amt = parseFloat(document.getElementById('buyAmount').value) || 0;
  if (amt <= 0) return;

  const idx   = INDICES[activeIdx];
  const fee   = amt * 0.001;
  const tokens = (amt - fee) / idx.nav;

  // Simulate on-chain tx (replace with real contract call after deployment)
  const btn = document.getElementById('buyBtn');
  btn.textContent = 'Confirming...';
  btn.disabled = true;

  try {
    // TODO: Replace with real ethers.js / viem contract interaction:
    //
    // const provider = new ethers.BrowserProvider(window.ethereum);
    // const signer   = await provider.getSigner();
    // const contract = new ethers.Contract(idx.contractAddress, ABI, signer);
    // const tx = await contract.mint(ethers.parseUnits(amt.toString(), 6));
    // await tx.wait();

    // For now — simulate 1.5s tx time (matching IOPn ~1s block time)
    await new Promise(r => setTimeout(r, 1500));

    // Update portfolio state
    portfolio.value += amt;
    portfolio.tokens[activeIdx] += tokens;
    const positions = portfolio.tokens.filter(t => t > 0).length;

    document.getElementById('portfolioVal').textContent = '$' + portfolio.value.toFixed(2);
    document.getElementById('portfolioSub').textContent =
      `Est. yield: $${(portfolio.value * idx.apy / 100).toFixed(2)}/yr`;
    document.getElementById('posCount').textContent = positions;

    // Add to activity feed
    addTxRow(idx, tokens, 'buy');

    showToast(`✓ Bought ${tokens.toFixed(2)} ${idx.ticker}`);
    btn.textContent = `Buy ${tokens.toFixed(2)} ${idx.ticker}`;
    btn.disabled = false;

    // Refresh OPN balance
    fetchOPNBalance();

  } catch (err) {
    console.error('Buy error:', err);
    showToast('Transaction failed: ' + (err.message || 'unknown'), true);
    btn.textContent = `Buy ${tokens.toFixed(2)} ${idx.ticker}`;
    btn.disabled = false;
  }
}

// ── Add Tx to Activity Feed ────────────────────────────────
function addTxRow(idx, tokens, type) {
  const list = document.getElementById('txList');
  const isOut = type === 'sell';
  const sign  = isOut ? '−' : '+';
  const icon  = isOut ? 'ti-arrow-up-right' : 'ti-arrow-down-right';
  const shortAddr = walletAddress
    ? walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4)
    : '0x3fa...c12';

  const row = document.createElement('div');
  row.className = 'tx-row';
  row.setAttribute('role', 'listitem');
  row.innerHTML = `
    <div class="tx-icon" style="--c:${idx.color}" aria-hidden="true">
      <i class="ti ${icon}"></i>
    </div>
    <div class="tx-info">
      <div class="tx-name">
        ${isOut ? 'Redeemed' : 'Bought'} ${idx.ticker}
        <span class="tag ${idx.tagClass}">${idx.name.split(' ')[0]}</span>
      </div>
      <div class="tx-time">Just now · ${shortAddr}</div>
    </div>
    <div class="tx-amt" style="color:${idx.color}">
      ${sign}${tokens.toFixed(1)} tokens
    </div>
  `;
  list.insertBefore(row, list.firstChild);
}

// ── Toast ──────────────────────────────────────────────────
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '') + ' show';
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ── Live ticker simulation ─────────────────────────────────
// In production, replace with WebSocket subscription to IOPn RPC
// e.g. ws://testnet-rpc.iopn.tech via eth_subscribe
function startLiveTicker() {
  const bases = INDICES.map(i => i.nav);
  setInterval(() => {
    bases.forEach((base, i) => {
      const drift = (Math.random() - 0.49) * 0.0004;
      const nav   = +(base + drift).toFixed(4);
      const pct   = +((drift / base) * 100).toFixed(2);
      bases[i] = nav;

      // Ticker strip
      const tEl  = document.getElementById('t' + i);
      const tcEl = document.getElementById('tc' + i);
      if (tEl)  tEl.textContent = '$' + nav.toFixed(4);
      if (tcEl) {
        tcEl.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
        tcEl.className = 'tick-chg mono ' + (pct >= 0 ? 'up' : 'down');
      }

      // Index cards
      const navEl = document.getElementById('cardNav' + i);
      const chgEl = document.getElementById('cardChg' + i);
      if (navEl) navEl.textContent = '$' + nav.toFixed(4);
      if (chgEl) {
        const isUp = pct >= 0;
        chgEl.textContent = (isUp ? '▲ +' : '▼ ') + pct.toFixed(2) + '% today';
        chgEl.className = 'ic-change mono ' + (isUp ? 'up' : 'down');
      }

      // Update live nav in state for breakdown calc
      INDICES[i].nav = nav;
    });
    // Refresh breakdown with latest nav
    updateBreakdown();
  }, 2500);
}
