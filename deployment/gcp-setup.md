# Google Cloud Platform Setup & Workload Identity Federation

This guide provides the exact commands and configuration steps required to provision the GCP infrastructure for **Document Chaser**.

> [!IMPORTANT]
> Execute these commands using the Google Cloud CLI (`gcloud`) in your terminal or in Google Cloud Shell.
> GCP Project ID: `slabspro-slabsuser35`
> GitHub Repository: `KatikiReddy-Sujith-Reddy/document-chaser`

---

## 1. Project Selection & Required APIs

Set your active GCP project:

```bash
gcloud config set project slabspro-slabsuser35
```

Enable the necessary GCP services (Cloud Run, Artifact Registry, IAM Credentials, Resource Manager, Secret Manager):

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  secretmanager.googleapis.com
```

---

## 2. Artifact Registry Setup

Create a Docker repository in Google Artifact Registry to store your container images:

```bash
gcloud artifacts repositories create document-chaser \
  --repository-format=docker \
  --location=us-central1 \
  --description="Docker repository for Document Chaser"
```

---

## 3. Secret Manager Setup (Gemini API Key)

Create the secret and add your Gemini API key version:

```bash
# Create the secret container
gcloud secrets create gemini-api-key --replication-policy="automatic"

# Add the secret payload (paste your Gemini API key when prompted or via stdin)
echo -n "<YOUR_GEMINI_API_KEY>" | gcloud secrets versions add gemini-api-key --data-file=-
```

---

## 4. Service Accounts & Least-Privilege IAM

We create two distinct, least-privilege service accounts to enforce strict separation of duties between CI/CD deployment and container runtime execution:

### 4.1. Create Cloud Run Runtime Service Account
Runs the container in Cloud Run with zero administrative privileges:

```bash
gcloud iam service-accounts create document-chaser-runner \
  --display-name="Document Chaser Cloud Run Runtime"
```

Grant the runtime service account access **only** to the Gemini API key secret in Secret Manager:

```bash
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:document-chaser-runner@slabspro-slabsuser35.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 4.2. Create GitHub Deployer Service Account
Used solely by GitHub Actions to push images and create Cloud Run revisions:

```bash
gcloud iam service-accounts create github-deployer \
  --display-name="GitHub Actions Deployer"
```

Assign minimal required roles to `github-deployer`:

```bash
# Allow pushing images to Artifact Registry
gcloud projects add-iam-policy-binding slabspro-slabsuser35 \
  --member="serviceAccount:github-deployer@slabspro-slabsuser35.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Allow deploying revisions to Cloud Run
gcloud projects add-iam-policy-binding slabspro-slabsuser35 \
  --member="serviceAccount:github-deployer@slabspro-slabsuser35.iam.gserviceaccount.com" \
  --role="roles/run.developer"

# Allow deploying services running as the dedicated runtime service account
gcloud iam service-accounts add-iam-policy-binding document-chaser-runner@slabspro-slabsuser35.iam.gserviceaccount.com \
  --member="serviceAccount:github-deployer@slabspro-slabsuser35.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

---

## 5. Workload Identity Federation (Keyless GitHub Actions Auth)

Workload Identity Federation allows GitHub Actions to deploy to GCP without downloading dangerous long-lived service account JSON keys.

### 5.1: Create Workload Identity Pool

```bash
gcloud iam workload-identity-pools create "github-pool" \
  --project="slabspro-slabsuser35" \
  --location="global" \
  --display-name="GitHub Actions Pool"
```

### 5.2: Create Workload Identity Provider with Repository Restriction

Connect GitHub's OIDC issuer to the pool and strictly restrict token issuance to `KatikiReddy-Sujith-Reddy/document-chaser`:

```bash
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project="slabspro-slabsuser35" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository == 'KatikiReddy-Sujith-Reddy/document-chaser'" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

### 5.3: Allow GitHub Actions to Impersonate the Deployer Service Account

Bind your specific GitHub repository to the deployer service account:

```bash
PROJECT_NUMBER=$(gcloud projects describe slabspro-slabsuser35 --format='value(projectNumber)')

gcloud iam service-accounts add-iam-policy-binding "github-deployer@slabspro-slabsuser35.iam.gserviceaccount.com" \
  --project="slabspro-slabsuser35" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/KatikiReddy-Sujith-Reddy/document-chaser"
```

### 5.4: Retrieve the Provider Resource Name

Run:
```bash
gcloud iam workload-identity-pools providers describe "github-provider" \
  --project="slabspro-slabsuser35" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(name)"
```
*Note down this output value. It will look like:*
`projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-pool/providers/github-provider`

---

## 6. GitHub Repository Configuration

In your GitHub repository (**Settings** → **Secrets and variables** → **Actions**):

### Repository Variables (`vars.*`)
Add the following under the **Variables** tab:

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `GCP_PROJECT_ID` | `slabspro-slabsuser35` | Your Google Cloud Project ID |
| `GCP_REGION` | `us-central1` | Google Cloud region for deployment |
| `ARTIFACT_REGISTRY_REPO` | `document-chaser` | Name of your Artifact Registry repository |
| `CLOUD_RUN_SERVICE` | `document-chaser` | Name of your Cloud Run service |
| `WIF_PROVIDER` | `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-pool/providers/github-provider` | Full Workload Identity Provider resource name |
| `WIF_SERVICE_ACCOUNT` | `github-deployer@slabspro-slabsuser35.iam.gserviceaccount.com` | Deployment service account email |
| `RUNTIME_SERVICE_ACCOUNT` | `document-chaser-runner@slabspro-slabsuser35.iam.gserviceaccount.com` | Cloud Run runtime service account email |

### Repository Secrets (`secrets.*`)
- **None required!** With Secret Manager, no API keys or secrets are stored in GitHub Actions.
