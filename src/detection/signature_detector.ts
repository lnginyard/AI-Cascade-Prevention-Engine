export type AnomalySignal = {
  serviceId: string;
  dependencyServiceId?: string;
  type: 'error_rate' | 'latency' | 'traffic_drop' | 'resource_exhaustion';
  observedAt: number;
  deviationStdDev?: number;
  latencyIncreasePct?: number;
  volumeDropPct?: number;
  metricName?: string;
};

export type CascadeSignature = {
  signatureId: string;
  signatureType: 'error_propagation' | 'latency_cascade' | 'traffic_drop' | 'resource_exhaustion';
  originServiceId: string;
  affectedServices: string[];
  detectedAt: number;
  confidenceScore: number;
  evidence: string[];
};

const WINDOW_30S = 30_000;
const WINDOW_60S = 60_000;
const WINDOW_120S = 120_000;

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

function pickOrigin(anomalies: AnomalySignal[]): string {
  if (anomalies.length === 0) return 'unknown';
  const sorted = [...anomalies].sort((a, b) => a.observedAt - b.observedAt);
  return sorted[0].serviceId;
}

function confidenceFromCount(count: number, base = 0.75): number {
  return Math.min(0.99, Number((base + count * 0.05).toFixed(2)));
}

export function detectCascadeSignature(anomalies: AnomalySignal[]): CascadeSignature | null {
  if (anomalies.length === 0) return null;

  const sorted = [...anomalies].sort((a, b) => a.observedAt - b.observedAt);
  const firstTs = sorted[0].observedAt;

  const errorCandidates = sorted.filter((a) =>
    a.type === 'error_rate' &&
    (a.deviationStdDev ?? 0) >= 3 &&
    a.observedAt - firstTs <= WINDOW_60S
  );
  if (uniq(errorCandidates.map((a) => a.serviceId)).length >= 2) {
    const affected = uniq(errorCandidates.map((a) => a.serviceId));
    return {
      signatureId: `sig-${Date.now()}-error`,
      signatureType: 'error_propagation',
      originServiceId: pickOrigin(errorCandidates),
      affectedServices: affected,
      detectedAt: Date.now(),
      confidenceScore: confidenceFromCount(affected.length, 0.8),
      evidence: ['error_rate >= 3 stddev in 2+ services within 60s']
    };
  }

  const latencyCandidates = sorted.filter((a) =>
    a.type === 'latency' &&
    (a.latencyIncreasePct ?? 0) >= 50 &&
    a.observedAt - firstTs <= WINDOW_30S
  );
  if (uniq(latencyCandidates.map((a) => a.serviceId)).length >= 2) {
    const affected = uniq(latencyCandidates.map((a) => a.serviceId));
    return {
      signatureId: `sig-${Date.now()}-latency`,
      signatureType: 'latency_cascade',
      originServiceId: pickOrigin(latencyCandidates),
      affectedServices: affected,
      detectedAt: Date.now(),
      confidenceScore: confidenceFromCount(affected.length, 0.78),
      evidence: ['latency increase >= 50% across dependency path within 30s']
    };
  }

  const trafficDropCandidates = sorted.filter((a) =>
    a.type === 'traffic_drop' &&
    (a.volumeDropPct ?? 0) >= 80
  );
  if (trafficDropCandidates.length > 0) {
    const affected = uniq(trafficDropCandidates.map((a) => a.serviceId));
    return {
      signatureId: `sig-${Date.now()}-traffic`,
      signatureType: 'traffic_drop',
      originServiceId: pickOrigin(trafficDropCandidates),
      affectedServices: affected,
      detectedAt: Date.now(),
      confidenceScore: confidenceFromCount(affected.length, 0.76),
      evidence: ['request volume drop >= 80% with upstream still active']
    };
  }

  const exhaustionCandidates = sorted.filter((a) =>
    a.type === 'resource_exhaustion' &&
    a.observedAt - firstTs <= WINDOW_120S
  );
  if (uniq(exhaustionCandidates.map((a) => a.serviceId)).length >= 2) {
    const affected = uniq(exhaustionCandidates.map((a) => a.serviceId));
    return {
      signatureId: `sig-${Date.now()}-resource`,
      signatureType: 'resource_exhaustion',
      originServiceId: pickOrigin(exhaustionCandidates),
      affectedServices: affected,
      detectedAt: Date.now(),
      confidenceScore: confidenceFromCount(affected.length, 0.77),
      evidence: ['resource exhaustion in 2+ services within 120s']
    };
  }

  return null;
}
