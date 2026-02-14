# Shoal Infrastructure Deployment Tiers
**LFG Consulting Implementation Guide**

This document outlines the standard deployment patterns for Shoal to meet diverse client security and operational needs.

---

## 🚀 Tier 1: The "Shoal Appliance" (Maximum Sovereignty)
*Target: Law firms, medical clinics, defense contractors.*

*   **Infra:** Physical small-factor server (Mac Mini M4 or Intel NUC) shipped to client.
*   **Networking:** Runs on client's local LAN. Outbound access limited to Model APIs (OpenAI/Anthropic).
*   **Access:** Direct local access or secure remote management via isolated **Tailscale** node.
*   **Value:** 100% Data Sovereignty. Even if the cloud goes down, their agent history and governance logs remain inside their physical walls.

---

## ☁️ Tier 2: The "Private Vault" (VPC Deployment)
*Target: SaaS companies, high-growth startups, mid-market enterprises.*

*   **Infra:** Dedicated VM inside the client’s own cloud account (AWS EC2, GCP, Azure).
*   **Configuration:** Isolated VPC with strict security groups.
*   **Database:** Managed Postgres or local Docker Postgres (depending on scale).
*   **Value:** Leverages existing enterprise cloud spend and IT management while maintaining logical isolation. No data travels through Shoal/LFG servers.

---

## 🛠️ Tier 3: "LFG Managed" (Rapid POC)
*Target: Short-term pilot projects, internal testing, small teams.*

*   **Infra:** Dedicated VM on LFG’s secure infrastructure.
*   **Isolation:** Per-client Docker network and database.
*   **Value:** Zero-friction setup. "Login and go."
*   **Risk Mitigation:** Full ARISE audit logging enabled by default to prove security posture.

---

## 🧱 The Deployment Stack (Consistent Across Tiers)
Shoal uses a unified **Docker Compose** blueprint to ensure the environment is identical regardless of where it sits:

1.  **OpenClaw Runtime:** The agent reasoning engine + channel connectors.
2.  **Shoal Governance Plugin:** Intercepts agent I/O for policy enforcement.
3.  **Shoal Admin Dashboard:** Centralized control for users, agents, and logs.
4.  **PostgreSQL + Redis:** Local persistence and caching.

---

## 🛠️ Internal Testing Checklist (For "Tomorrow")
To validate Shoal on **Poza** before the first client deployment:

- [ ] **OpenClaw Hook Spike:** Confirm the Shoal plugin can drop a message or block a tool call.
- [ ] **Admin Dashboard CRUD:** Verify Users/Agents/Policies can be edited without DB errors.
- [ ] **Tailscale Relay:** Confirm dashboard is accessible via Tailscale from mobile.
- [ ] **Cold Start Test:** Run `docker-compose down -v && docker-compose up` to verify zero-state launch.
