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
export declare function detectCascadeSignature(anomalies: AnomalySignal[]): CascadeSignature | null;
