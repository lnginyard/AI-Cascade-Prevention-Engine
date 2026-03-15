# Cascade Prevention Engine — Submission Package
## Deadline: March 12, 2026

---

## Project Overview (Elevator Pitch)

**Cascade Prevention Engine** is an AI-driven resilience layer for AWS workloads that predicts and prevents cascading failures — before they reach your customers. Built entirely on AWS serverless infrastructure, it ingests CloudWatch, X-Ray, and CloudTrail telemetry in real time, constructs a live service dependency graph, detects early cascade signatures, predicts blast radius with confidence scoring, and automatically executes remediation plans through AWS Step Functions.

It includes a full-featured operations dashboard (zero framework, no dependencies) for SREs, incident commanders, and platform engineers to monitor system health, review active signatures, and approve/reject remediation plans — with role-based access gating built in.

---

## Submission Checklist

### Code & Repository
- [x] TypeScript/AWS CDK stack compiles (`npm run build`)
- [x] Unit tests pass (`npm test -- --runInBand`, 3 suites, 5 tests)
- [x] `cdk synth` produces valid CloudFormation template
- [x] All core Lambdas implemented (telemetry ingest, signature detection, API, remediation planner, action executor, webhook notifier)
- [x] API Gateway with Cognito auth + API key + usage plan + rate limiting
- [x] Step Functions remediation orchestration with rollback
- [x] EventBridge event-driven pipeline (detection → prediction → remediation → notifications)
- [x] SNS high-confidence cascade alerts
- [x] Webhook notifier for third-party integrations
- [x] DynamoDB tables with encryption, PITR, and retention policies
- [x] S3 lifecycle policies (365-day telemetry, 90-day snapshots)
- [x] KMS encryption at rest for all data
- [x] CORS enabled for browser-based UI live mode
- [x] Free-tier deployment scripts and cost guardrails

### UI Dashboard
- [x] Operations dashboard (Dependency Graph, Signatures & Blast Radius, Remediation Plans, Event Timeline)
- [x] Role-based approval gating (Viewer / Operator / Admin)
- [x] Live API mode with auth headers and fallback demo data
- [x] Approval/rejection audit trail panel
- [x] Dark-mode, responsive design (no external dependencies)

### Documentation
- [x] README with architecture overview and setup instructions
- [x] DEPLOYMENT.md with full deployment guide
- [x] SRS.md (Software Requirements Specification)
- [x] requirements.md (26 requirements with acceptance criteria)
- [x] UI_INFORMATION_ARCHITECTURE.md
- [x] CONFORMANCE_REPORT.md
- [x] design.md (full architecture design document)

### Submission Assets (TO DO before 3/12)
- [ ] Publish blog article to community.aws or dev.to (see SUBMISSION_BLOG.md)
- [ ] Post social call-to-vote (see SUBMISSION_SOCIAL.md)
- [ ] Record 2–3 minute demo video (UI walkthrough + story narration)
- [ ] Register/confirm AWS Community Builders submission link
- [ ] Add project URL in SUBMISSION_LINKS.md once deployed
- [ ] Confirm public GitHub repo is visible (check visibility settings)

---

## The Story

### Problem
Catastrophic cloud outages rarely start with a single point of failure. They start with one service slowing down — and a wave of dependent services amplifying that slowdown into a full system collapse. By the time an alert fires, the cascade is already in motion. Teams scramble to understand what's happening, where it started, and what to stop first. Minutes become hours. Customers are impacted.

### Solution
The Cascade Prevention Engine is the layer that sits between "early anomaly" and "customer incident." It watches your telemetry continuously, learns what normal looks like, detects the patterns that precede cascades, and intervenes — automatically — before the wave reaches production.

It doesn't wait for an incident. It prevents one.

### Key Differentiators
1. **Proactive, not reactive** — detection happens at the anomaly stage, not the incident stage
2. **Graph-aware** — blast radius is calculated against the real service dependency graph, not a static topology map
3. **Human-in-the-loop** — operators can review and approve plans before execution, with full audit trail
4. **Serverless by design** — no agents, no servers to manage; runs entirely on AWS managed services
5. **Free-tier deployable** — start in one region in under 10 minutes; one command to deploy and one to destroy when idle

### AWS Services Used
| Service | Role |
|---|---|
| AWS CDK | Infrastructure as Code |
| Lambda (Node.js 18) | Telemetry, detection, orchestration, API |
| API Gateway | REST API with Cognito auth + API keys |
| Cognito | User pool for operator authentication |
| DynamoDB | Dependency graph, signatures, remediation plans, telemetry cache |
| EventBridge | Event bus connecting all pipeline stages |
| Step Functions | Multi-step remediation orchestration with rollback |
| S3 | Telemetry storage with lifecycle policies |
| SNS | High-confidence cascade alerts |
| KMS | Encryption at rest |
| CloudFormation | Full stack deployment |

---

## Voting Strategy (Important Notes)

### AWS Community Builders / community.aws
- Voting on community.aws **does require a free community account** (not an AWS account — it's a separate, free sign-up at community.aws)
- This cannot be changed as it's controlled by AWS
- Best mitigation: make the GitHub and demo links the primary entry points so people can explore and engage without any login
- Direct people to GitHub ⭐, LinkedIn reaction, or Twitter/X like as the zero-friction engagement path
- Reserve the community.aws vote ask for people already in the community

### Alternate Engagement Paths (No Sign-In Required)
- GitHub ⭐ star (no AWS account needed, just GitHub)
- LinkedIn post reaction and comments
- Twitter/X likes and retweets
- Demo page visit and share

---

## Links (Fill in Before 3/12)

| Resource | URL |
|---|---|
| GitHub Repository | https://github.com/lnginyard/AI-Cascade-Prevention-Engine |
| Demo UI (live) | https://aicpe.dev |
| Blog Article | https://article.aicpe.dev |
| AWS Community Submission | https://community.aws/[submission-url] |
| LinkedIn Post | [post URL after publishing] |
| Twitter/X Post | [tweet URL after publishing] |

---

## Pre-Submission Final Commands

```bash
# 1. Verify build and tests still pass
npm run build && npm test -- --runInBand

# 2. Deploy to your account
npm run free-tier:start -- cascade-free-tier us-east-1 10 lnginyard@gmail.com

# 3. Check everything is live
npm run free-tier:status -- cascade-free-tier us-east-1

# 4. Start UI for demo recording
cd ui && python3 -m http.server 8080
```
