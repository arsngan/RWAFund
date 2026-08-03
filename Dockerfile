FROM node:22.13.0-slim

WORKDIR /usr/src/app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install dependencies (including dev deps for Hardhat)
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copy project
COPY . .

EXPOSE 8545

ENTRYPOINT ["/usr/src/app/entrypoint.sh"]
