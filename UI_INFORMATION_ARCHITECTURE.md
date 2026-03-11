# Cascade Prevention Engine - UI Information Architecture

## Goals

- Provide a clear operations view of service health and cascade risk
- Support fast triage and controlled remediation approvals
- Prepare a presentable interface for user testing and stakeholder demos

## Primary Personas

1. **Reliability Engineer**
   - Monitors system health and validates remediation plans
2. **Incident Commander**
   - Oversees high-risk events and approves critical actions
3. **Platform Engineer**
   - Reviews dependency behavior and investigates root-cause patterns

## Navigation Model

Top-level navigation (left rail):

1. **Overview**
   - Global health, active incidents, and key risk indicators
2. **Dependency Graph**
   - Service relationship map and upstream/downstream risk impact
3. **Signatures & Predictions**
   - Active signatures, confidence scores, projected blast radius
4. **Remediation Plans**
   - Review/approve/reject actions and observe execution status
5. **Event Timeline**
   - Chronological stream of detection, prediction, and action events
6. **Settings**
   - Notification endpoints, environment scope, and role-based preferences

## Role-Based View Rules (Initial)

- **Viewer**
  - Can view all dashboards and timelines
  - Cannot approve plans
- **Operator**
  - Can view all dashboards
  - Can approve low/medium-risk plans
- **Admin**
  - Full access including high-risk approval and settings changes

## Initial Dashboard Shell Scope

This first UI increment implements:

1. **Dependency Graph view** (topology and service health indicators)
2. **Active signatures + predicted blast radius** (sortable risk cards)
3. **Remediation review/approve flow** (approve/reject with audit trail panel)

## Future Extensions (Not in this increment)

- Live data binding to API Gateway endpoints
- Multi-environment selector (prod/staging/dev)
- Fine-grained team ownership overlays on graph
- User auth integration with Cognito/IAM identity context