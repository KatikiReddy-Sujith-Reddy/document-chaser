# GitHub Actions CI/CD Pipeline Configuration

## 1. Workflow Architecture

The deployment pipeline is organized into two stages:

```
┌────────────────────────────────────────────────────────┐
│             Stage 1: CI Pipeline (.github/workflows/ci.yml)
│  - Checkout repository                                 │
│  - Node.js 22 runtime setup                            │
│  - npm ci (frontend & backend)                         │
│  - Automated tests (Vitest)                            │
│  - TypeScript & Vite builds                            │
│  - Secret bundle leak audit                            │
│  - Docker multi-stage build validation                 │
└───────────────────────────┬────────────────────────────┘
                            │ (On successful completion)
                            ▼
┌────────────────────────────────────────────────────────┐
│             Stage 2: CD Pipeline (.github/workflows/cd.yml)
│  - GCP Service Account Key Authentication              │
│  - Docker authentication with Artifact Registry        │
│  - Build & Tag production container image              │
│  - Push image to Artifact Registry (asia-south1)       │
│  - Deploy container revision to Google Cloud Run       │
│  - Health probe verification (/health)                 │
│  - Output deployed production URL                      │
└────────────────────────────────────────────────────────┘
```

---

## 2. GitHub Repository Configuration

In your GitHub repository (**Settings** → **Secrets and variables** → **Actions**):

### Repository Secrets (`secrets.*`)

| Secret Name | Description |
| :--- | :--- |
| `GCP_SA_KEY` | Full JSON service account key containing deployment credentials |

### Repository Variables (`vars.*`)

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `GCP_PROJECT_ID` | `slabspro-slabsuser35` | Google Cloud Project ID |
| `GCP_REGION` | `asia-south1` | Google Cloud region for deployment (Mumbai) |
| `ARTIFACT_REGISTRY_REPO` | `document-chaser` | Artifact Registry Docker repository name |
| `CLOUD_RUN_SERVICE` | `document-chaser` | Google Cloud Run service name |

---

## 3. Production Characteristics

- **Docker in CI/CD:** All container builds occur inside GitHub Actions hosted runners without requiring local Docker Desktop.
- **Region-Enforced Infrastructure:** Artifact Registry, Secret Manager, and Cloud Run are all provisioned in `asia-south1` (Mumbai).
- **Zero Secret Bundling:** Gemini API keys are mounted securely from Google Secret Manager at runtime and never baked into the container or client bundle.
