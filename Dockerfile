# Multi-stage Dockerfile for Document Chaser
# Stage 1: Build the frontend and backend TypeScript code
FROM node:22-bookworm-slim AS builder

WORKDIR /build

# Install build tools if any native modules need compilation
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies for both projects
RUN cd frontend && npm ci
RUN cd backend && npm ci

# Copy source trees and seeds
COPY frontend/ ./frontend/
COPY backend/ ./backend/
COPY data/ ./data/

# Compile frontend static bundle and backend TypeScript
RUN cd frontend && npm run build
RUN cd backend && npm run build

# Stage 2: Install production dependencies only
FROM node:22-bookworm-slim AS deps

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev && npm cache clean --force

# Stage 3: Production runtime image
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    DATABASE_URL=file:./data/chaser.db

# Security: Create and run under an unprivileged user
RUN groupadd -r appgroup && useradd -r -g appgroup -u 10001 appuser

# Copy production node_modules from deps stage
COPY --from=deps /build/backend/node_modules ./backend/node_modules
COPY backend/package*.json ./backend/

# Copy compiled backend code, Drizzle migrations, frontend bundle, and seed data
COPY --from=builder /build/backend/dist ./backend/dist
COPY --from=builder /build/backend/src/db/migrations ./backend/src/db/migrations
COPY --from=builder /build/frontend/dist ./frontend/dist
COPY --from=builder /build/data/seed ./data/seed

# Create data directory for SQLite and ensure proper ownership
RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data /app

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 8080) + '/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "backend/dist/index.js"]
