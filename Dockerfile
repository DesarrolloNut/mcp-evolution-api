# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies with clean reproducible install
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Compile TypeScript and copy static web assets -> dist/
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

LABEL org.opencontainers.image.title="mcp-whatsapp" \
      org.opencontainers.image.description="Unified Multi-Channel WhatsApp MCP Gateway (Evolution API, Meta, Twilio)" \
      org.opencontainers.image.source="https://github.com/DesarrolloNut/mcp-whatsapp" \
      org.opencontainers.image.licenses="MIT"

# Production dependencies only (including native better-sqlite3)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Bring in compiled output and web panel assets
COPY --from=builder /app/dist ./dist

# Prepare data directory for mounted SQLite persistence with proper node user permissions
RUN mkdir -p /app/data && chown -R node:node /app/data

# Declare persistence volume and expose default HTTP gateway port
VOLUME ["/app/data"]
EXPOSE 3000

# Run as the unprivileged "node" user shipped with the base image
USER node

ENTRYPOINT ["node", "dist/index.js"]
