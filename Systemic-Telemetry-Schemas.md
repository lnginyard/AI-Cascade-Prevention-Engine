# Telemetry Schemas and Event-to-Playbook Mappings

This file provides example telemetry schemas for health, logistics, and utilities, plus example event-to-playbook mappings and threshold specifications for automated triggers.

1) Example JSON Schemas (concise)

- Health (Hospital/ICU occupancy, admissions, test positivity)

```json
{
  "type": "object",
  "properties": {
    "source": {"const": "health"},
    "timestamp": {"type": "string", "format": "date-time"},
    "region": {"type": "string"},
    "facilityId": {"type": "string"},
    "metrics": {
      "type": "object",
      "properties": {
        "icuOccupancyPct": {"type": "number"},
        "inpatientAdmissions": {"type": "integer"},
        "posTestRatePct": {"type": "number"}
      },
      "required": ["icuOccupancyPct"]
    }
  },
  "required": ["source","timestamp","region","metrics"]
}
```

- Logistics (factory throughput, port delays, shipment lead time)

```json
{
  "type": "object",
  "properties": {
    "source": {"const": "logistics"},
    "timestamp": {"type": "string", "format": "date-time"},
    "nodeId": {"type": "string"},
    "metrics": {
      "type": "object",
      "properties": {
        "throughputPctOfNorm": {"type": "number"},
        "avgLeadDays": {"type": "number"},
        "backlogContainers": {"type": "integer"}
      },
      "required": ["throughputPctOfNorm"]
    }
  },
  "required": ["source","timestamp","nodeId","metrics"]
}
```

- Utilities (power/water availability, workforce absenteeism)

```json
{
  "type": "object",
  "properties": {
    "source": {"const": "utilities"},
    "timestamp": {"type": "string", "format": "date-time"},
    "utilityId": {"type": "string"},
    "metrics": {
      "type": "object",
      "properties": {
        "capacityPct": {"type": "number"},
        "workforceAbsencePct": {"type": "number"}
      },
      "required": ["capacityPct"]
    }
  },
  "required": ["source","timestamp","utilityId","metrics"]
}
```

2) Example Event-to-Playbook Mappings (rules)

- Rule A: If region R has: `icuOccupancyPct >= 85%` AND `throughputPctOfNorm <= 70%` at any linked critical supplier node, then trigger:
  - Playbook: `HospitalSupplyProtection`
  - Actions: prioritize critical shipments to region R, activate emergency procurement, alert Pandemic Response Council for Level 2 consideration.

- Rule B: If a port's `backlogContainers` increases by > 50% week-over-week AND `avgLeadDays` > threshold, then trigger:
  - Playbook: `PortRerouteAndSurge`
  - Actions: reroute X% of inbound volume to alternative ports A/B, notify carriers, increase contracted trucking capacity.

- Rule C: If `workforceAbsencePct >= 30%` for electricity utility U, then trigger:
  - Playbook: `CriticalUtilityStabilization`
  - Actions: initiate mutual aid agreements, enable demand-reduction messaging, defer non-essential maintenance.

3) Threshold Specifications (examples)

- Health:
  - Level 1 alert: `posTestRatePct > 3%` OR `icuOccupancyPct > 70%`
  - Level 2 alert: `icuOccupancyPct > 85%` OR `inpatientAdmissions` trend accelerating > 20% in 7 days

- Logistics:
  - Degraded: `throughputPctOfNorm < 80%`
  - Critical: `throughputPctOfNorm < 60%`

- Utilities:
  - Watch: `workforceAbsencePct > 15%`
  - Critical: `workforceAbsencePct > 30%` OR `capacityPct < 75%`

4) Playbook Examples (short)

- `HospitalSupplyProtection`:
  - Immediate: Identify top-5 suppliers to region, allocate available stock to hospitals.
  - 24-hour: Initiate emergency procurement and regional redistribution.

- `PortRerouteAndSurge`:
  - Immediate: Notify carriers, adopt temporary berthing prioritization.
  - 72-hour: Contract additional trucking and warehouse capacity.

5) Integration notes

- Encode these schemas as JSON Schema artifacts in the telemetry pipeline so validators can enrich/route events.
- Implement rule evaluation as event-driven functions (EventBridge rules or Lambda) or within the Cascade Prediction Engine as graph-based pattern detectors.
- Store mapping metadata in a DynamoDB table `PlaybookMappings` for easy updates by governance teams.

---

If you'd like, I can convert these examples to inline JSON Schema files in `src/schemas/`, add a `PlaybookMappings` DynamoDB table CDK construct, or generate Lambda handlers that evaluate the rules in real-time. Which would you prefer next? 
