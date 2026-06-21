# RWAFund — Real World Asset Index dApp

A decentralized ETF-style index fund for tokenized real-world assets, deployed on **IOPn OPN Chain** (Testnet, Chain ID 984).

## Overview

Retail users can buy a single token representing a diversified basket of real-world assets — without needing to research, custody, or rebalance individual positions.

### Four Indices

| Token | Basket | APY |
|-------|--------|-----|
| `TSY-IDX` | Treasury (US T-Bills, EU, JP, UK bonds) | 4.8% |
| `REFI-IDX` | Real Estate (NYC, Singapore, Dubai, London) | 6.2% |
| `CMDTY-IDX` | Commodity (Gold, Silver, Crude, Agri) | 3.1% |
| `EMC-IDX` | EM Credit (VN, BR, IN, MX debt) | 8.4% |

---

## Network — IOPn OPN Testnet

| Parameter | Value |
|-----------|-------|
| Network name | OPN Testnet |
| Chain ID | `984` (`0x3D8`) |
| RPC URL | `https://testnet-rpc.iopn.tech` |
| Symbol | OPN |
| Explorer | https://testnet.iopn.tech |
| Block time | ~1 second |
| Gas price | Fixed 7 Gwei |

---

## Project Structure

```
rwa-index-fund/
├── index.html          ← Main dApp (single-page)
├── src/
│   ├── styles.css      ← All styles (light + dark mode)
│   ├── chain.js        ← IOPn chain integration & wallet logic
│   ├── data.js         ← Index definitions & basket compositions
│   └── app.js          ← UI rendering, chart, buy form, live tickers
├── contracts/
│   ├── IndexToken.sol  ← ERC-20 index token contract
│   └── RWAVault.sol    ← Vault holding underlying RWA positions
├── public/
│   └── favicon.svg
└── README.md
```

---

## Quick Start

### 1. Clone and open

```bash
git clone https://github.com/YOUR_USERNAME/rwa-index-fund.git
cd rwa-index-fund
# Open in browser — no build step needed
open index.html
```

Or serve locally:

```bash
npx serve .
# Visit http://localhost:3000
```

### 2. Add OPN Testnet to MetaMask

Click **"OPN Testnet"** button in the app header — it will prompt MetaMask to add the network automatically.

Or add manually:
- Network Name: `OPN Testnet`
- RPC URL: `https://testnet-rpc.iopn.tech`
- Chain ID: `984`
- Symbol: `OPN`
- Explorer: `https://testnet.iopn.tech`

### 3. Get test OPN tokens

Visit the IOPn faucet (coming soon) or join the [IOPn community](https://t.me/iopndiscussion).

---

## Deploy Smart Contracts

> Smart contracts require Node.js 18+ and Hardhat.

### Install dependencies

```bash
cd contracts
npm install
```

### Configure environment

```bash
cp .env.example .env
# Edit .env and add your private key:
# PRIVATE_KEY=your_private_key_here
```

**⚠️ Never commit `.env` to git.**

### Deploy to OPN Testnet

```bash
npx hardhat run scripts/deploy.js --network opnTestnet
```

After deployment, update the `contractAddress` fields in `src/data.js` with the deployed addresses.

### Hardhat config for OPN Testnet

```js
// hardhat.config.js (already configured in contracts/)
networks: {
  opnTestnet: {
    url: 'https://testnet-rpc.iopn.tech',
    chainId: 984,
    accounts: [process.env.PRIVATE_KEY],
    gasPrice: 7_000_000_000, // 7 Gwei
  }
}
```

---

## Deploy Frontend to GitHub Pages

### First time setup

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/rwa-index-fund.git
git push -u origin main
```

### Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / `/ (root)`
4. Click **Save**

Your dApp will be live at:
`https://YOUR_USERNAME.github.io/rwa-index-fund/`

### Auto-deploy with GitHub Actions (optional)

Create `.github/workflows/deploy.yml` — the app is static HTML so Pages deploys automatically on every push to `main`.

---

## Connecting to Real Contracts

Once contracts are deployed, update `src/app.js` to call real on-chain functions:

```js
// Replace simulation in handleBuy() with:
import { ethers } from 'https://esm.sh/ethers@6';

const provider = new ethers.BrowserProvider(window.ethereum);
const signer   = await provider.getSigner();
const contract = new ethers.Contract(
  idx.contractAddress,
  INDEX_TOKEN_ABI,  // import from contracts/abi/
  signer
);
const amountWei = ethers.parseUnits(amt.toString(), 6); // USDC 6 decimals
const tx = await contract.mint(amountWei, {
  gasPrice: ethers.parseUnits('7', 'gwei'), // IOPn fixed gas
});
await tx.wait();
```

---

## Links

- **IOPn Explorer**: https://testnet.iopn.tech
- **IOPn Docs**: https://iopn.gitbook.io/iopn/developer-docs
- **Community**: https://t.me/iopndiscussion
- **Twitter**: https://x.com/iopn_io

---

## License

DinhThuy
