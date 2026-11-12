# Deployment Architecture

## 1. Overview

**Document Chaser** is deployed as a single, containerized service on **Google Cloud Run**. The container houses both the Express 5 Node.js backend and the compiled React static frontend bundle, providing an efficient, low-latency, and zero-cost-when-idle deployment.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Client Browser                             │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTPS (Managed SSL)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Google Cloud Run Service                     │
│                  Service Name: document-chaser                  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Docker Container                       │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                Express 5 HTTP Server                │  │  │
│  │  │  - Serves static React UI (/*)                      │  │  │
│  │  │  - Serves REST API endpoints (/api/*)              │  │  │
│  │  │  - Health Check endpoint (/health)                  │  │  │
│  │  └───────────────┬─────────────────────────┬───────────┘  │  │
│  │                  │                         │              │  │
│  │                  ▼                         ▼              │  │
│  │       ┌──────────────────────┐  ┌──────────────────────┐  │  │
│  │       │   SQLite Database    │  │  Google Gemini API   │  │  │
│  │       │  (/app/data/chaser)  │  │  (Request Drafting)  │  │  │
│  │       └──────────────────────┘  └──────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. GCP Services Utilized

1. **Google Cloud Run**:
   - Fully managed serverless container platform.
   - Automatically provisions HTTPS certificates.
   - Scales to **0 instances** during idle periods (incurring $0 cost) and scales rapidly on demand.
2. **Google Artifact Registry**:
   - Modern, secure container registry storing Docker images.
   - Images tagged by Git commit SHA (`${{ github.sha }}`) and `latest`.
3. **Workload Identity Federation (WIF)**:
   - Eliminates long-lived JSON service account keys.
   - GitHub Actions exchanges GitHub's OIDC token for short-lived Google Cloud credentials.
4. **Google Cloud IAM**:
   - Grants minimal permissions strictly to the deployment service account.

---

## 3. Cost Analysis (Zero-Cost / Free-Tier Estimation)

Document Chaser operates within the **Google Cloud Free Tier**:

| Service | Free Tier Allowance | Document Chaser Usage | Estimated Monthly Cost |
| :--- | :--- | :--- | :--- |
| **Cloud Run** | 2,000,000 requests/month, 360,000 GB-seconds, 180,000 vCPU-seconds | Minimal demo/evaluation traffic | **$0.00** |
| **Artifact Registry**| 0.5 GB storage per month | 1-2 slim container images (~180 MB) | **$0.00** |
| **Cloud Logging** | 50 GB log ingestion per month | Minimal logs | **$0.00** |
| **Workload Identity**| Free | Token exchange | **$0.00** |
| **Total Estimated Cost** | — | — | **$0.00 / month** |
