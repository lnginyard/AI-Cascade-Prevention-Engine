# AICPE Implementation Triage

**Updated:** 2026-11-03  
**Source of truth:** [Conformance Audit Report](CONFORMANCE_REPORT.md)

This backlog translates the current conformance gaps into an ordered engineering plan. Priorities are safety-first, not a promise of delivery dates.

## P0 — Safety blockers (before any live execution or external multi-tenant use)

- [ ] **Fail-closed execution:** set remediation execution disabled by default; reject unsupported action kinds; never emit `SUCCESS` for a no-op.
- [ ] **Explicit dry-run mode:** record `SIMULATED`/ `NOT_IMPLEMENTED` accurately and prove that dry-run cannot mutate AWS resources.
- [ ] **Approval enforcement:** require a valid, authorized approval for each plan before execution; enforce state transitions and prevent duplicate/replayed approvals.
- [ ] **Tenant isolation:** scope all reads/writes by trusted tenant claims; remove unscoped scans and plan-ID-only access; add cross-tenant denial tests.
- [ ] **Audit correlation:** persist plan, action, approval, execution, failure, and rollback events with actor, timestamp, reason, correlation ID, and actual outcome.

## P1 — Prove the core single-region resilience workflow

- [ ] **Telemetry adapters:** implement and test at least one complete source path (recommended: CloudWatch metrics + X-Ray), then CloudTrail and Kinesis.
- [ ] **Dependency graph:** build/update graph edges from telemetry; track freshness, service inactivity, metadata, and snapshots.
- [ ] **Detection quality:** expand labeled fixtures to every signature type; include noisy, missing, duplicate, delayed, and out-of-order telemetry.
- [ ] **Deterministic path prediction:** implement graph traversal, ranked paths, blast radius, and time-to-impact before introducing ML.
- [ ] **Plan quality:** add action preconditions, impact/capacity estimate, risk rationale, alternatives, and rollback preconditions.
- [ ] **First real adapter:** choose one reversible AWS control, implement least-privilege permissions, idempotency, health checks, gradual recovery, and compensating rollback.
- [ ] **Orchestration state:** persist Step Functions execution IDs and reconcile action outcomes; test retries, timeouts, partial failure, cancellation, and rollback.

## P2 — Operational readiness

- [ ] Operator console for graph, signatures, plans, approvals, and action history.
- [ ] Alert deduplication, acknowledgement, escalation timers, and delivery tracking.
- [ ] End-to-end metrics, dashboards, alarms, structured logs, and trace correlation.
- [ ] Versioned configuration, validation, per-service overrides, rollout, and rollback.
- [ ] Expand replay into synthetic injection, dry-run, and historical replay with reproducible evidence bundles.
- [ ] Audit export, retention enforcement, and access-controlled evidence downloads.
- [ ] CI gates for build, unit/integration tests, CDK synth, security checks, and staging deployment.
- [ ] Deployment, incident-response, manual-remediation, and recovery runbooks.

## P3 — Scale and advanced capabilities (after P0–P2)

- [ ] Multi-region coordination and failover drills.
- [ ] Labeled incident dataset and ML training/evaluation/model promotion lifecycle.
- [ ] Cost estimation and cost-aware remediation selection.
- [ ] Load/performance tests against explicit throughput, graph-size, p95 latency, and recovery objectives.

## Release gates

Do not enable live remediation until all P0 items pass. Do not market the platform as predictive AI until Req 5 and the relevant ML lifecycle are implemented and independently evaluated. Do not claim production readiness until the single-region end-to-end flow, security testing, operational observability, recovery, and deployment gates have passed.
