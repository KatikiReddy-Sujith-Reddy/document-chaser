# Troubleshooting & Rollback Procedures

## 1. Cloud Run Logs Inspection

To stream real-time logs from Cloud Run:

```bash
gcloud run services logs tail document-chaser --region us-central1
```

To view recent error logs:

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=document-chaser AND severity>=ERROR" --limit 20
```

---

## 2. Instant Rollback Procedure

If a newly deployed version introduces issues, Cloud Run allows instant zero-downtime rollback to any prior revision:

### List Prior Revisions
```bash
gcloud run revisions list --service document-chaser --region us-central1
```

### Route 100% Traffic to Previous Revision
```bash
gcloud run services update-traffic document-chaser \
  --region us-central1 \
  --to-revisions <PREVIOUS_REVISION_NAME>=100
```
*Traffic switches instantaneously in under 1 second.*

---

## 3. Common Issues & Solutions

### A. Health Check Timeout on Cloud Run Startup
- **Symptom:** Cloud Run reports container failed to start and listen on the configured port.
- **Cause:** Express bound to `127.0.0.1` instead of `0.0.0.0`.
- **Solution:** Verified in code: `backend/src/index.ts` uses `process.env.HOST ?? "0.0.0.0"`.

### B. Workload Identity Federation Permission Denied
- **Symptom:** GitHub Actions fails at the `auth` step with `403 Forbidden` or `Permission 'iam.serviceAccounts.getAccessToken' denied`.
- **Cause:** Mismatch between GitHub repository name and the `attribute.repository` IAM binding, or incorrect `WIF_PROVIDER` variable.
- **Solution:** Confirm your GitHub repository URL exactly matches `KatikiReddy-Sujith-Reddy/document-chaser` in the IAM binding in Step 3.5 of `gcp-setup.md`.

### C. SQLite Permission Error in Container
- **Symptom:** `EACCES: permission denied, open '/app/data/chaser.db'`.
- **Cause:** Non-root container user cannot write to `/app/data`.
- **Solution:** The `Dockerfile` explicitly creates `/app/data` and executes `chown -R appuser:appgroup /app/data`.
