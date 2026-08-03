require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/**
 * Hardhat config for IOPn OPN Chain
 * https://iopn.gitbook.io/iopn/developer-docs/developers/development-setup
 */

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.30",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "pectra", // IOPn supports Pectra EVM features
    },
  },

  networks: {
    // Local development
    hardhat: {
      chainId: 31337,
    },

    // IOPn OPN Testnet
    // Chain ID: 984 | RPC: https://testnet-rpc.iopn.tech
    // Explorer: https://testnet.iopn.tech
    opnTestnet: {
      url: process.env.OPN_TESTNET_RPC || "https://testnet-rpc.iopn.tech",
      chainId: 984,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 7_000_000_000, // 7 Gwei (fixed on OPN Chain)
      timeout: 60_000,
    },

    // IOPn OPN Mainnet (when available)
    opnMainnet: {
      url: process.env.OPN_MAINNET_RPC || "https://rpc.iopn.tech",
      chainId: 985, // Update when mainnet launches
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 7_000_000_000,
      timeout: 60_000,
    },
  },

  etherscan: {
    apiKey: {
      opnTestnet: process.env.OPNSCAN_API_KEY || "no-key",
    },
    customChains: [
      {
        network: "opnTestnet",
        chainId: 984,
        urls: {
          apiURL: "https://testnet.iopn.tech/api",
          browserURL: "https://testnet.iopn.tech",
        },
      },
    ],
  },

  paths: {
    sources:   "./",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
