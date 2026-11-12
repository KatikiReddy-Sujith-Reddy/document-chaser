# Docker Configuration & Containerization

## 1. Multi-Stage Build Architecture

The `Dockerfile` utilizes a three-stage build to produce a minimal, secure production container image.

### Stage 1: `builder`
- Base image: `node:22-bookworm-slim`.
- Installs compilation tools (`make`, `g++`, `python3`) required for native C++ bindings (`better-sqlite3`).
- Installs complete dependencies for both `frontend` and `backend`.
- Compiles the React application into static assets (`frontend/dist`).
- Compiles backend TypeScript into JavaScript (`backend/dist`).

### Stage 2: `deps`
- Base image: `node:22-bookworm-slim`.
- Runs `npm ci --omit=dev` inside `backend/` to isolate production-only dependencies and strips out developer tools (TypeScript, Vitest, etc.).

### Stage 3: `runner` (Production Runtime)
- Base image: `node:22-bookworm-slim`.
- Runs under an unprivileged user `appuser` (UID `10001`) with group `appgroup`.
- Copies only production `node_modules`, backend `dist`, Drizzle migrations, frontend `dist`, and synthetic seed data.
- Creates `/app/data` with write permissions for SQLite persistence.
- Defines a built-in Docker `HEALTHCHECK` probing `GET /health` via Node's native `fetch`.
- Exposes port `8080`.

---

## 2. Security and Exclusion Rules

`.dockerignore` guarantees that sensitive or unnecessary files are never included in the image:

- Excludes `.env`, `.env.*` (preserving `.env.example`).
- Excludes `*.key`, `*.pem`, and service account JSON credentials.
- Excludes development `node_modules`.
- Excludes local `data/*.db` files.
- Excludes local build folders (`dist/`, `coverage/`).
- Excludes non-runtime files such as design exports and git metadata.

---

## 3. Local Docker Build & Test Commands

To build and run the container locally using Docker:

### Build Image
```bash
docker build -t document-chaser:latest .
```

### Run Container
```bash
docker run -d \
  --name document-chaser \
  -p 8080:8080 \
  -e PORT=8080 \
  -e HOST=0.0.0.0 \
  -e GOOGLE_API_KEY="your-gemini-key" \
  document-chaser:latest
```

### Run with Docker Compose
```bash
docker compose up -d
```

### Verify Container Health
```bash
# Health check endpoint
curl http://localhost:8080/health

# Case queue API endpoint
curl http://localhost:8080/api/cases

# UI Frontend
curl -I http://localhost:8080/
```
