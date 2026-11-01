# Evidence and Validation

## What proves the engine works

A credible claim needs four linked records:

1. **Input**: timestamped telemetry or a versioned replay fixture.
2. **Decision**: the signature, confidence, evidence, and predicted blast radius.
3. **Action**: the recommendation, approval, execution result, or explicit no-op.
4. **Outcome**: what happened afterward, including impact, recovery, and cost signals.

The current deterministic replay report proves only that the detector produces expected classifications for versioned scenarios. It does not prove production accuracy or that a remediation prevented an outage.

## Run the repeatable baseline

```bash
npm test -- --runInBand
npm run build
```

The versioned scenarios are in `evidence/scenarios.json`. Keep changes to those fixtures reviewed and append new scenarios rather than replacing old ones. Each run should retain the generated report, source commit, scenario version, and test command.

Recommended report fields:

- `generatedAt`
- Git commit SHA
- engine version
- scenario ID and fixture hash
- input event timestamps
- observed signature and confidence
- expected classification
- false-positive and false-negative counts
- remediation plan ID and approval/execution status
- outcome timestamps and CloudWatch/CloudTrail evidence links

## Production or pilot evidence

Use read-only access first. Retain customer-approved, redacted records for:

- CloudWatch metric or alarm export
- CloudTrail change/deployment events
- X-Ray trace IDs or service-map snapshots
- EventBridge telemetry event IDs
- engine prediction and remediation-plan IDs
- approval and rollback records
- incident timeline and customer-impact metrics
- before/after blast-radius or recovery measurements

Never claim "prevented" from a simulation alone. Use `detected`, `recommended`, `executed`, `mitigated`, or `prevented` only when the evidence supports that exact stage.

## Metrics for design partners

Measure per scenario and aggregate by customer:

- detection precision and recall
- false-positive and false-negative rate
- lead time before customer impact
- time from prediction to recommendation
- time to approve and execute remediation
- affected services with and without the control
- recovery time and error-budget consumption
- duplicate work, retry volume, and cloud spend avoided
- estimated revenue or SLA credits preserved, labeled as estimates until verified

A strong pilot result has a timestamped baseline, a counterfactual or control comparison, and an outcome record. For example: the engine identified a dependency failure 12 minutes before the existing alert, the approved control reduced affected services from 11 to 4, and the incident timeline confirms the measured recovery improvement.

## Evidence retention

For every run, retain an immutable bundle containing:

```text
evidence/runs/<run-id>/
  manifest.json
  scenarios.json
  report.json
  telemetry-redacted.jsonl
  predictions.jsonl
  remediation-plans.jsonl
  outcomes.jsonl
```

The manifest should include the customer consent/reference, environment, AWS account alias (never secret credentials), region, collection window, git SHA, schema versions, redaction policy, and hashes for each file. Store customer bundles in a customer-controlled encrypted S3 bucket with a documented retention period. Do not commit customer telemetry or secrets to Git.

## Evidence sources to retain

Use the primary AWS documentation as the source register for what each signal means:

- CloudWatch metrics and alarms: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/WhatIsCloudWatch.html
- CloudTrail event history: https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-event-reference.html
- AWS X-Ray traces and service map: https://docs.aws.amazon.com/xray/latest/devguide/aws-xray.html
- EventBridge events: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-events.html
- AWS Well-Architected Reliability Pillar: https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html

Treat these as signal definitions and operational guidance, not proof that the engine is accurate. Accuracy must come from retained, timestamped replay and customer outcome evidence.
