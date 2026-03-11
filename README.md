# Cascade Prevention Engine

AI-driven resilience layer for AWS workloads that predicts and prevents cascading failures across microservices, data pipelines, and regions before they impact customers.

## Overview

The Cascade Prevention Engine continuously analyzes telemetry signals across AWS environments to detect early signs of failure cascades and automatically triggers stabilizing actions to prevent incidents from propagating.

## Architecture

The system uses TypeScript with AWS CDK for infrastructure as code and consists of:

- **Telemetry Collector**: Ingests signals from CloudWatch, X-Ray, CloudTrail, and custom sources
- **Dependency Graph Engine**: Maintains live service dependency relationships
- **Anomaly Detection Engine**: ML-powered detection of deviations from normal behavior
- **Cascade Prediction Engine**: Forecasts failure propagation paths
- **Remediation Orchestration**: Executes preventive actions (circuit breaking, traffic shifting, rate limiting, rollbacks)

## Infrastructure Components

### DynamoDB Tables
- **DependencyGraph**: Stores service nodes and dependency edges with metrics
- **TelemetryCache**: Recent telemetry events with TTL for fast access
- **CircuitBreakerState**: Circuit breaker states for all services

### S3 Buckets
- **TelemetryBucket**: Raw telemetry storage with 365-day retention
  - Lifecycle: Standard → Intelligent-Tiering after 30 days
- **SnapshotBucket**: Dependency graph snapshots every 5 minutes (90-day retention)

### EventBridge
- **EventBus**: Central event bus for cascade prevention events
- **Archive**: 90-day event archive for analysis

### Security
- **KMS Encryption**: Customer-managed keys for all data at rest
- **IAM Roles**: Least-privilege access policies
- **Encryption in Transit**: TLS 1.2+ for all communications

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed (`npm install -g aws-cdk`)

### Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy infrastructure
npm run deploy
```

### Configure AWS CLI (Your Account)

Use an AWS CLI profile for your own account (recommended: SSO).

```bash
# SSO mode (recommended)
npm run aws:configure -- cascade-free-tier us-east-1 sso

# Access-key mode (fallback)
npm run aws:configure -- cascade-free-tier us-east-1 keys
```

After setup, use this profile for all commands:

```bash
export AWS_PROFILE=cascade-free-tier
export AWS_REGION=us-east-1
aws sts get-caller-identity
```

Credentials remain in your local AWS config/credentials files and are not stored in this repository.

### Configuration

Configure deployment parameters in `cdk.json` context:

```json
{
  "context": {
    "telemetryRetentionDays": 365,
    "snapshotRetentionDays": 90,
    "multiRegion": false,
    "environment": "development"
  }
}
```

### Multi-Region Deployment

To enable multi-region deployment:

```bash
cdk deploy --context multiRegion=true
```

Note: Cross-region replication requires manual configuration of destination buckets and replication roles.

### Free-Tier Mode (Recommended Start)

Run in one region first to control cost, then expand only after validating usage.

One-command path:

```bash
npm run free-tier:start -- cascade-free-tier us-east-1 10 you@example.com
```

This command validates your AWS profile, bootstraps CDK, sets billing guardrails, and deploys a single-region stack.

Step-by-step path (equivalent):

```bash
# 1) Bootstrap CDK in your selected region
npm run free-tier:bootstrap -- cascade-free-tier us-east-1

# 2) Configure budget + billing alarms (confirm SNS email subscription)
npm run free-tier:guardrails -- cascade-free-tier us-east-1 10 you@example.com

# 3) Deploy single-region MVP with low-cost defaults
npm run free-tier:deploy -- cascade-free-tier us-east-1
```

To avoid idle cost when not using the stack:

```bash
npm run free-tier:destroy -- cascade-free-tier us-east-1
```

Check environment and stack status:

```bash
# Identity + stack + API discovery
npm run free-tier:status -- cascade-free-tier us-east-1

# Include protected-route HTTP checks
npm run free-tier:status -- cascade-free-tier us-east-1 <api-key> <bearer-token>
```

## Core Types

### Telemetry Events
- `TelemetryEvent`: Base event structure with source, type, and payload
- `MetricPayload`: CloudWatch metrics
- `TracePayload`: X-Ray traces
- `ApiCallPayload`: CloudTrail API calls

### Dependency Graph
- `ServiceNode`: Service representation with metadata
- `DependencyEdge`: Relationships with call metrics
- `DependencyHealthScore`: Aggregated health metrics

### Cascade Detection
- `CascadeSignature`: Detected failure patterns
- `CascadePrediction`: Predicted propagation paths
- `AnomalyDetection`: Behavioral deviations

### Remediation
- `RemediationPlan`: Ordered preventive actions
- `PreventiveAction`: Individual actions (circuit break, traffic shift, etc.)
- `CircuitBreakerState`: Circuit breaker status

## Development

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run watch
```

### Run Tests
```bash
npm test
```

### Synthesize CloudFormation
```bash
npm run synth
```

## UI Prototype (Session Kickoff)

An initial, interactive operations dashboard shell is included for UX and stakeholder demo preparation.

- Architecture notes: `UI_INFORMATION_ARCHITECTURE.md`
- Prototype files: `ui/index.html`, `ui/styles.css`, `ui/app.js`
- Demo includes an AI-assisted cascade simulator for pre-impact scenario rehearsal and mitigation walkthroughs

To run locally:

```bash
cd ui
python3 -m http.server 8080
```

Then open `http://localhost:8080` in a browser.

### Demo Simulator

Use the **AI Simulator** view to rehearse a cascading event before it reaches customers:

- Select a scenario
- Choose region or company-wide scope
- Adjust intensity
- Click **Simulate Event**
- Click **Apply AI Mitigation** to show blast-radius reduction and stabilization

### Live API Mode (Optional)

The UI can connect to deployed API routes when you provide:

- API base URL (example: `https://{api-id}.execute-api.{region}.amazonaws.com/v1`)
- `x-api-key` value
- Cognito bearer token for protected routes

Current API routes used by the UI:

- `GET /dependency-graph`
- `GET /cascade-signatures/active`
- `GET /remediation-plans`
- `POST /remediation-plans/{planId}/approval`

Note: Browser live mode also requires CORS to be enabled on API Gateway methods.
This repository now includes CORS configuration; run a fresh deployment to apply it:

```bash
npm run deploy
```

## Submission

**Deadline: March 12, 2026**

- Full submission package: `SUBMISSION.md`
- Blog article (ready to publish): `SUBMISSION_BLOG.md`
- Social posts (LinkedIn + Twitter/X): `SUBMISSION_SOCIAL.md`

To support the project:

- ⭐ Star the GitHub repo (no AWS account needed)
- 🗳️ Vote on AWS Community — [submission link]
- 💬 Share the blog / social post with your SRE and platform engineering network

## Requirements Mapping

This implementation addresses the following requirements:

- **Requirement 1.7**: Dependency graph historical snapshots at 5-minute intervals for 90 days
- **Requirement 2.8**: Telemetry storage in S3 with lifecycle policies for 365-day retention
- **Requirement 24.1**: CloudFormation templates for all infrastructure components
- **Requirement 24.4**: IAM roles, policies, and service-linked roles created by deployment

## License

MIT
