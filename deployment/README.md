# Document Chaser Deployment Guide

This directory contains the complete production deployment specifications, architectural design, setup guides, and troubleshooting procedures for deploying **Document Chaser** to **Google Cloud Platform (GCP)** using **Docker** and **GitHub Actions CI/CD**.

---

## Documentation Index

- [Architecture Overview](architecture.md): System components, data flow, GCP services, and cost analysis.
- [Docker Configuration](docker.md): Multi-stage Docker build, container security, and local testing instructions.
- [GCP Setup Guide](gcp-setup.md): Step-by-step commands to configure GCP, IAM, Artifact Registry, Cloud Run, and Workload Identity Federation (WIF).
- [GitHub Actions CI/CD](github-actions.md): Complete guide to secrets, variables, workflow stages, and automated deployment.
- [Troubleshooting & Rollback](troubleshooting.md): Common error diagnosis, log inspection, and instant rollback procedures.

---

## Quick Reference

| Item | Value |
| :--- | :--- |
| **GCP Runtime** | Google Cloud Run (Fully Managed, Serverless) |
| **Container Registry** | Google Artifact Registry (`us-central1-docker.pkg.dev`) |
| **Auth Method** | Workload Identity Federation (Keyless OIDC) |
| **Default Port** | `8080` (Cloud Run standard) |
| **Health Endpoint** | `GET /health` |
| **Database** | Embedded SQLite (`/app/data/chaser.db`) |
