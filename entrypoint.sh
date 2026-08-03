#!/bin/bash
set -euo pipefail

# Load .env variables if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs -r)
fi

echo "Starting Hardhat node..."
npx hardhat node --hostname 0.0.0.0 &> node.log &
NODE_PID=$!

echo "Waiting for Hardhat RPC to be available..."
for i in $(seq 1 30); do
  if curl -sS --max-time 1 http://127.0.0.1:8545 >/dev/null 2>&1; then
    echo "RPC up"
    break
  fi
  sleep 1
done

echo "Compiling contracts..."
npx hardhat compile

echo "Running deployment script to localhost..."
npx hardhat run deploy.js --network localhost

echo "Deployment finished. Tailing node log."
tail -f node.log &
wait $NODE_PID
