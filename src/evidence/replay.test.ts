import { buildEvidenceReport, EvidenceScenario } from './replay';

const scenarios: EvidenceScenario[] = [
  {
    scenarioId: 'positive',
    description: 'Two correlated error signals',
    expected: { detected: true, signatureType: 'error_propagation' },
    anomalies: [
      { serviceId: 'payments', type: 'error_rate', observedAt: 1_000, deviationStdDev: 4 },
      { serviceId: 'checkout', type: 'error_rate', observedAt: 2_000, deviationStdDev: 3.5 },
    ],
  },
  {
    scenarioId: 'negative',
    description: 'One weak signal',
    expected: { detected: false },
    anomalies: [
      { serviceId: 'catalog', type: 'error_rate', observedAt: 1_000, deviationStdDev: 2 },
    ],
  },
];

describe('evidence replay', () => {
  it('records expected classifications and confusion counts', () => {
    const report = buildEvidenceReport(scenarios, '2026-01-01T00:00:00.000Z');

    expect(report.summary).toMatchObject({
      scenarioCount: 2,
      passedCount: 2,
      failedCount: 0,
      truePositiveCount: 1,
      trueNegativeCount: 1,
      falsePositiveCount: 0,
      falseNegativeCount: 0,
    });
    expect(report.scenarios[0].observed.affectedServices).toEqual(['payments', 'checkout']);
    expect(report.limitation).toContain('does not prove production accuracy');
  });
});
