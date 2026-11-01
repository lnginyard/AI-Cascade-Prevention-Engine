import { detectCascadeSignature, AnomalySignal, CascadeSignature } from '../detection/signature_detector';

export type EvidenceScenario = {
  scenarioId: string;
  description: string;
  expected: { detected: boolean; signatureType?: CascadeSignature['signatureType'] };
  anomalies: AnomalySignal[];
};

export type ScenarioEvidence = {
  scenarioId: string;
  description: string;
  expected: EvidenceScenario['expected'];
  observed: {
    detected: boolean;
    signatureType?: CascadeSignature['signatureType'];
    originServiceId?: string;
    affectedServices?: string[];
    confidenceScore?: number;
    evidence?: string[];
  };
  detectionWindowMs?: number;
  passed: boolean;
};

export type EvidenceReport = {
  schemaVersion: '1.0';
  generatedAt: string;
  evidenceType: 'deterministic_replay';
  limitation: string;
  summary: {
    scenarioCount: number;
    passedCount: number;
    failedCount: number;
    truePositiveCount: number;
    falsePositiveCount: number;
    falseNegativeCount: number;
    trueNegativeCount: number;
  };
  scenarios: ScenarioEvidence[];
};

function classify(expected: EvidenceScenario['expected'], observed: CascadeSignature | null): ScenarioEvidence['observed'] {
  if (!observed) return { detected: false };
  return {
    detected: true,
    signatureType: observed.signatureType,
    originServiceId: observed.originServiceId,
    affectedServices: observed.affectedServices,
    confidenceScore: observed.confidenceScore,
    evidence: observed.evidence,
  };
}

export function replayScenario(scenario: EvidenceScenario): ScenarioEvidence {
  const signature = detectCascadeSignature(scenario.anomalies);
  const observed = classify(scenario.expected, signature);
  const expectedMatches = scenario.expected.detected === observed.detected &&
    (!scenario.expected.signatureType || scenario.expected.signatureType === observed.signatureType);
  const timestamps = scenario.anomalies.map((anomaly) => anomaly.observedAt);
  const detectionWindowMs = timestamps.length > 1 ? Math.max(...timestamps) - Math.min(...timestamps) : undefined;

  return {
    scenarioId: scenario.scenarioId,
    description: scenario.description,
    expected: scenario.expected,
    observed,
    detectionWindowMs,
    passed: expectedMatches,
  };
}

export function buildEvidenceReport(scenarios: EvidenceScenario[], generatedAt = new Date().toISOString()): EvidenceReport {
  const results = scenarios.map(replayScenario);
  const counts = results.reduce((summary, result) => {
    const expectedDetected = result.expected.detected;
    const observedDetected = result.observed.detected;
    if (expectedDetected && observedDetected) summary.truePositiveCount += 1;
    if (!expectedDetected && observedDetected) summary.falsePositiveCount += 1;
    if (expectedDetected && !observedDetected) summary.falseNegativeCount += 1;
    if (!expectedDetected && !observedDetected) summary.trueNegativeCount += 1;
    return summary;
  }, { truePositiveCount: 0, falsePositiveCount: 0, falseNegativeCount: 0, trueNegativeCount: 0 });

  return {
    schemaVersion: '1.0',
    generatedAt,
    evidenceType: 'deterministic_replay',
    limitation: 'This report proves behavior on the versioned scenarios only. It does not prove production accuracy, avoided loss, or causal prevention without timestamped AWS telemetry and an outcome record.',
    summary: {
      scenarioCount: results.length,
      passedCount: results.filter((result) => result.passed).length,
      failedCount: results.filter((result) => !result.passed).length,
      ...counts,
    },
    scenarios: results,
  };
}
