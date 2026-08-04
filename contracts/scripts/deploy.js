// deploy.js
//
// Deploys the full RWAFund testnet stack to IOPn OPN Chain:
//   1. MockUSDC          (deposit token used by the vault)
//   2. 4x IndexToken      (TSY-IDX, REFI-IDX, CMDTY-IDX, EMC-IDX)
//   3. RWAVault           (points at MockUSDC, becomes each token's vault)
//   4. Registers each basket in the vault with a starting NAV
//   5. Writes all deployed addresses to deployed-addresses.json for the frontend
//
// Run with:
//   npx hardhat run deploy.js --network opnTestnet

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Basket config: symbol, display name, starting NAV per share (scaled 1e18 = $1.00)
const BASKETS = [
  { symbol: "TSY-IDX", name: "RWAFund Treasury Index", startingNav: hre.ethers.parseUnits("1", 18) },
  { symbol: "REFI-IDX", name: "RWAFund Real Estate Index", startingNav: hre.ethers.parseUnits("1", 18) },
  { symbol: "CMDTY-IDX", name: "RWAFund Commodity Index", startingNav: hre.ethers.parseUnits("1", 18) },
  { symbol: "EMC-IDX", name: "RWAFund Emerging Market Credit Index", startingNav: hre.ethers.parseUnits("1", 18) },
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer OPN balance:", hre.ethers.formatEther(balance));
  if (balance === 0n) {
    throw new Error("Deployer has 0 OPN — fund it from the IOPn testnet faucet first.");
  }

  const gasPrice = hre.ethers.parseUnits("7", "gwei"); // fixed OPN testnet gas price

  // ---------------------------------------------------------------
  // 1. Deploy MockUSDC (deposit token)
  // ---------------------------------------------------------------
  console.log("\nDeploying MockUSDC...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy({ gasPrice });
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("MockUSDC deployed at:", mockUSDCAddress);

  // ---------------------------------------------------------------
  // 2. Deploy RWAVault (needs depositToken address; navUpdater = deployer for now)
  // ---------------------------------------------------------------
  console.log("\nDeploying RWAVault...");
  const RWAVault = await hre.ethers.getContractFactory("RWAVault");
  const vault = await RWAVault.deploy(mockUSDCAddress, deployer.address, { gasPrice });
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("RWAVault deployed at:", vaultAddress);

  // ---------------------------------------------------------------
  // 3. Deploy each IndexToken, point it at the vault, register the basket
  // ---------------------------------------------------------------
  const deployedTokens = {};

  for (const basket of BASKETS) {
    console.log(`\nDeploying IndexToken for ${basket.symbol}...`);
    const IndexToken = await hre.ethers.getContractFactory("IndexToken");
    const token = await IndexToken.deploy(basket.name, basket.symbol, { gasPrice });
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    console.log(`${basket.symbol} deployed at:`, tokenAddress);

    // Grant the vault mint/burn rights on this token
    console.log(`Setting vault on ${basket.symbol}...`);
    const setVaultTx = await token.setVault(vaultAddress, { gasPrice });
    await setVaultTx.wait();

    // Register this basket in the vault with its starting NAV
    const basketId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(basket.symbol));
    console.log(`Registering ${basket.symbol} in vault...`);
    const registerTx = await vault.registerBasket(basketId, tokenAddress, basket.startingNav, { gasPrice });
    await registerTx.wait();

    deployedTokens[basket.symbol] = {
      address: tokenAddress,
      basketId,
      startingNav: basket.startingNav.toString(),
    };
  }

  // ---------------------------------------------------------------
  // 4. Write all addresses out for the frontend (data.js)
  // ---------------------------------------------------------------
  const output = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    mockUSDC: mockUSDCAddress,
    rwaVault: vaultAddress,
    indexTokens: deployedTokens,
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, "deployed-addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log("\n=== Deployment complete ===");
  console.log(JSON.stringify(output, null, 2));
  console.log(`\nAddresses written to ${outPath}`);
  console.log("Copy these into src/data.js to connect the frontend.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
