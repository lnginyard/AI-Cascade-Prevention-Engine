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

## Requirements Mapping

This implementation addresses the following requirements:

- **Requirement 1.7**: Dependency graph historical snapshots at 5-minute intervals for 90 days
- **Requirement 2.8**: Telemetry storage in S3 with lifecycle policies for 365-day retention
- **Requirement 24.1**: CloudFormation templates for all infrastructure components
- **Requirement 24.4**: IAM roles, policies, and service-linked roles created by deployment

## License

MIT
