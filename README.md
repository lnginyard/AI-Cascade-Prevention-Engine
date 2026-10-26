# Artificial Intelligence Cascade Prevention Engine (AICPE)

A research and engineering prototype exploring how telemetry, rule-based cascade signatures, event-driven AWS services, and operator-reviewed remediation can help teams reason about service disruptions.

- **Engine repository:** this project — TypeScript, AWS CDK, Lambda-oriented handlers, EventBridge, DynamoDB, and S3 integrations.
- **Interactive demonstration:** [Cascade Prevention Dashboard](https://github.com/lnginyard/Cascade-Prevention-App)
- **Project domain:** [aicpe.dev](https://aicpe.dev) · [The AICPE article site](https://article.aicpe.dev) (availability and current deployment should be verified before relying on these links).

## Project status

This is an **early MVP / foundation**, not a production-ready autonomous incident-prevention platform. The repository's conformance report records that the developer build, test, and CDK synthesis workflows were run successfully during its audit, while also noting that requirements coverage is partial and test coverage is narrow. Review the implementation and current CI results before treating any behavior as production-verified.

The high-level architecture and requirements documents describe the intended direction. Not every target capability in those documents is implemented in the current source.

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
Remediation planning / operator decision API (MVP foundation)
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

## Known limitations and next steps

- The conformance report identifies this codebase as a partial MVP and says many requirements remain unimplemented.
- Existing tests cover selected ingestion, signature-detection, and remediation-planning paths; expand coverage to API and orchestration integration behavior.
- Confirm which AWS integrations are live versus mocked or scaffolded.
- Add end-to-end tests with representative telemetry fixtures and documented expected outputs.
- Document failure modes, idempotency, retry behavior, authorization boundaries, and approval safeguards.
- Provide reproducible screenshots or a recorded walkthrough linking the engine to the companion dashboard.

## Portfolio context

AICPE was developed as an applied AI / disruption-detection concept and was a semifinalist in the AWS 10,000 AIdeas competition, as described by the project author. The project explores detection, forecasting, and mitigation suggestions; claims about production impact or fully autonomous prevention should not be made unless separately validated.

## License

See [LICENSE](LICENSE).
