# Artificial Intelligence Cascade Prevention Engine (AICPE)

A production-oriented foundation for detecting cascade-risk signals, understanding dependency impact, and coordinating safe operator-approved remediation for real-world companies.

- **Engine repository:** this project — TypeScript, AWS CDK, Lambda-oriented handlers, EventBridge, DynamoDB, and S3 integrations.
- **Operations console:** [Cascade Prevention Dashboard](https://github.com/lnginyard/Cascade-Prevention-App)
- **Project domain:** [aicpe.dev](https://aicpe.dev) · [The AICPE article site](https://article.aicpe.dev) (availability and current deployment should be verified before relying on these links).

**Created and published by Lorenzo Ginyard**

## Product direction

AICPE is no longer maintained as a competition submission or voting/demo package. It is being developed as an AWS-hosted, single-company operational platform for environments where service degradation, dependency failures, and remediation decisions need to be observable, governed, and auditable.

The current release is an enterprise foundation, not a claim of autonomous incident prevention. Production adoption requires validating integrations, policies, recovery behavior, data retention, and operational runbooks against each company's environment.

## Implemented foundations

Based on the repository's current source and conformance notes:

- **Telemetry normalization:** sample ingestion code validates and normalizes telemetry events.
- **Event-driven routing:** ingestion code routes data to AWS storage/event services with retry handling.
- **Cascade signature detection:** rule-based signature detection with confidence scoring.
- **Event handler wiring:** a signature matcher handler persists detections and emits signature events.
- **Remediation planning foundation:** a remediation-planner handler and focused unit tests are present.
- **Infrastructure as code:** AWS CDK and CloudFormation resources support a deployable foundation for selected components.
- **API foundation:** an API handler and OpenAPI specification describe core endpoints, including dependency graph, active signatures, remediation plans, and approval decisions.
- **Domain schemas:** JSON schemas are included for several operational domains; the conformance report notes that schema integration into the runtime ingestion pipeline remains incomplete.

## Architecture at a glance

```text
Telemetry events
      |
      v
Normalize and validate
      |
      v
S3 / EventBridge / DynamoDB routing
      |
      v
Rule-based cascade signature detection
      |
      v
Persist and emit signature events
      |
      v
Remediation planning / governed operator decision API
```

This diagram represents the implemented foundation at a conceptual level; it does not imply that every target-state service or automated remediation action is complete.

## Technology

- TypeScript
- AWS CDK and CloudFormation
- AWS Lambda-oriented handlers
- Amazon EventBridge, DynamoDB, and S3 integrations
- Jest / ts-jest test setup
- OpenAPI specification

## Repository map

- `src/telemetry/` — sample ingestion, normalization, and ingestion handler
- `src/detection/` — signature detector, matching handler, and unit tests
- `src/orchestration/` — remediation planner and action executor handlers
- `src/api/` — API handler and OpenAPI specification
- `src/schemas/` — domain-oriented JSON schemas
- `infrastructure/`, `lib/`, `cfn-template.yaml` — infrastructure definitions
- `CONFORMANCE_REPORT.md` — known implementation gaps and audit notes
- `requirements.md`, `SRS.md`, `design.md` — target requirements and design context

## Getting started

Prerequisites: Node.js, npm, AWS CLI, and AWS CDK. Use a personal AWS account/profile and review all infrastructure and cost implications before deploying.

```bash
npm ci
npm run build
npm test -- --runInBand
npm run synth
```

These commands are defined in the project configuration. Run them in your local checkout to verify the current branch; this README does not claim a new test run has been performed by the reader.

For deployment setup and cost guardrails, review [DEPLOYMENT.md](DEPLOYMENT.md) and the scripts under `scripts/`. Start in a single region and set a budget before deploying. Do not commit credentials, access keys, or local environment files.

## Enterprise foundation and next steps

The enterprise roadmap is organized around:

- company-scoped access controls and role-based authorization;
- immutable audit events for detections, approvals, executions, and rollbacks;
- production telemetry and incident-management integrations;
- policy-as-code, dry-run mode, approval gates, rate limits, and emergency kill switches;
- service health metrics, traces, structured logs, alarms, backup, and disaster recovery;
- end-to-end validation with representative customer environments before enabling automated execution.

The current implementation still has partial coverage in these areas. Review [CONFORMANCE_REPORT.md](CONFORMANCE_REPORT.md), [EVIDENCE_AND_VALIDATION.md](EVIDENCE_AND_VALIDATION.md), and the source before treating a capability as production-verified.

## License

See [LICENSE](LICENSE).
