// scripts/deploy.js
// Deploy all four RWA Index Token contracts to IOPn OPN Testnet
//
// Usage:
//   npx hardhat run scripts/deploy.js --network opnTestnet
//
// After deployment, paste the addresses into src/data.js
// contractAddress fields for each index.

const { ethers } = require("hardhat");

// OPN Testnet USDC placeholder address (update with real deployed USDC)
const USDC_ADDRESS = "0x0000000000000000000000000000000000000000"; // TODO
const FEE_RECIPIENT = "0x0000000000000000000000000000000000000000"; // TODO: your address

// Initial NAVs scaled to 1e18
const toNav = (navFloat) =>
  ethers.parseUnits(navFloat.toFixed(18), 18);

const INDICES = [
  { name: "Treasury Index",     symbol: "TSY-IDX",   nav: 1.0412 },
  { name: "Real Estate Index",  symbol: "REFI-IDX",  nav: 0.9871 },
  { name: "Commodity Index",    symbol: "CMDTY-IDX", nav: 1.1204 },
  { name: "EM Credit Index",    symbol: "EMC-IDX",   nav: 0.9543 },
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n📦 Deploying RWAFund contracts");
  console.log("   Network:   OPN Testnet (Chain 984)");
  console.log("   Deployer:", deployer.address);
  console.log("   Balance: ", ethers.formatEther(
    await ethers.provider.getBalance(deployer.address)
  ), "OPN\n");

  const IndexToken = await ethers.getContractFactory("IndexToken");
  const deployed = {};

  for (const idx of INDICES) {
    console.log(`🔨 Deploying ${idx.symbol}...`);
    const contract = await IndexToken.deploy(
      idx.name,
      idx.symbol,
      USDC_ADDRESS,
      toNav(idx.nav),
      FEE_RECIPIENT,
      {
        gasPrice: ethers.parseUnits("7", "gwei"), // IOPn fixed gas
      }
    );
    await contract.waitForDeployment();
    const addr = await contract.getAddress();
    deployed[idx.symbol] = addr;
    console.log(`   ✓ ${idx.symbol} deployed at: ${addr}`);
    console.log(`     Explorer: https://testnet.iopn.tech/address/${addr}\n`);
  }

  console.log("\n✅ All contracts deployed!\n");
  console.log("📋 Update src/data.js with these addresses:\n");
  for (const [symbol, addr] of Object.entries(deployed)) {
    console.log(`   ${symbol}: "${addr}"`);
  }

  // Save addresses to a file for reference
  const fs = require("fs");
  const out = {
    network: "OPN Testnet",
    chainId: 984,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: deployed,
  };
  fs.writeFileSync(
    "deployed-addresses.json",
    JSON.stringify(out, null, 2)
  );
  console.log("\n💾 Saved to deployed-addresses.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
