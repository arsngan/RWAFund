**Docker: local Hardhat node + deploy**

Steps to run the project inside Docker (builds image, starts a Hardhat node and runs the `deploy.js` script against the local node):

1. Copy `.env.example` to `.env` if you need to set any env values (not required for local run).
2. Build and run with docker-compose:

```bash
docker compose up --build
```

This will:
- Start a Hardhat node and expose RPC on `localhost:8545`.
- Compile the contracts and run `deploy.js` against the local node.
- Save deployed addresses to `deployed-addresses.json` in the project root.

To run only the build once and then start:

```bash
docker compose build
docker compose up
```

To run the deploy against a real network instead of localhost, set `.env` values for `OPN_TESTNET_RPC` and `PRIVATE_KEY` and run the host Node (not required here). For testnet deployments use the host `npm` with `npx hardhat run deploy.js --network opnTestnet`.
