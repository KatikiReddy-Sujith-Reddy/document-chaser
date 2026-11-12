# GitHub Actions CI/CD Pipeline Configuration

## 1. Workflow Pipeline (`.github/workflows/deploy.yml`)

The GitHub Actions workflow executes two sequential jobs:

```
┌────────────────────────────────────────────────────────┐
│                   GitHub Actions CI                    │
│  - Checkout repository                                 │
│  - Node.js 22 runtime setup                            │
│  - npm ci (frontend & backend)                         │
│  - Automated tests (Vitest)                            │
│  - Secret bundle leak audit                            │
│  - TypeScript & Vite builds                            │
│  - Docker build test                                   │
└───────────────────────────┬────────────────────────────┘
                            │ (On push to 'main' branch)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   GitHub Actions CD                    │
│  - Keyless GCP Authentication via WIF                  │
│  - Docker authentication with Artifact Registry        │
│  - Build & Tag: :${{ github.sha }} and :latest         │
│  - Push image to Artifact Registry                     │
│  - Deploy revision to Google Cloud Run                 │
│  - Health probe verification (/health)                 │
│  - Output deployed production URL                      │
└────────────────────────────────────────────────────────┘
```

---

## 2. GitHub Repository Configuration

In your GitHub repository (**Settings** → **Secrets and variables** → **Actions**):

### Repository Variables (`vars.*`)
Add the following under the **Variables** tab:

| Variable Name | Example Value | Description |
| :--- | :--- | :--- |
| `GCP_PROJECT_ID` | `my-gcp-project-12345` | Your Google Cloud Project ID |
| `GCP_REGION` | `us-central1` | Google Cloud region for deployment |
| `ARTIFACT_REGISTRY_REPO` | `document-chaser` | Name of your Artifact Registry repository |
| `CLOUD_RUN_SERVICE` | `document-chaser` | Name of your Cloud Run service |
| `WIF_PROVIDER` | `projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider` | Full Workload Identity Provider resource name |
| `WIF_SERVICE_ACCOUNT` | `github-deployer@my-gcp-project-12345.iam.gserviceaccount.com` | Email of the deployment service account |

### Repository Secrets (`secrets.*`)
- **None required!** The Gemini API key is securely managed in **Google Secret Manager** and mounted directly into Cloud Run via `--set-secrets`. No API keys or credentials are stored in GitHub Actions.

---

## 3. Security Highlights

- **No Long-Lived Service Account Keys:** No JSON credentials stored in GitHub Secrets.
- **Audience & Repository Restriction:** WIF strictly restricts access to `attribute.repository == 'KatikiReddy-Sujith-Reddy/document-chaser'`.
- **Immutable Artifact Tags:** Every deployment creates and deploys an image tagged with the exact Git commit SHA.
