# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies with a clean, reproducible install.
# --ignore-scripts prevents the "prepare" lifecycle from running tsc before
# the sources are copied.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Compile TypeScript -> dist/
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

LABEL org.opencontainers.image.title="evolution-api-mcp" \
      org.opencontainers.image.description="MCP server for Evolution API v2 (WhatsApp)" \
      org.opencontainers.image.source="https://github.com/RenatoAscencio/mcp-evolution-api" \
      org.opencontainers.image.licenses="MIT"

# Production dependencies only (no TypeScript / devDeps).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Bring in the compiled output.
COPY --from=builder /app/dist ./dist

# Run as the unprivileged "node" user shipped with the base image.
USER node

# The server speaks MCP over stdio; clients spawn it with `docker run -i`.
ENTRYPOINT ["node", "dist/index.js"]
