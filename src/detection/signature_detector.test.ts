import { detectCascadeSignature } from './signature_detector';

describe('signature_detector', () => {
  it('detects error propagation signature from correlated anomalies', () => {
    const now = Date.now();
    const signature = detectCascadeSignature([
      {
        serviceId: 'svc-a',
        type: 'error_rate',
        observedAt: now,
        deviationStdDev: 3.2,
      },
      {
        serviceId: 'svc-b',
        dependencyServiceId: 'svc-a',
        type: 'error_rate',
        observedAt: now + 10_000,
        deviationStdDev: 4.1,
      }
    ]);

    expect(signature).not.toBeNull();
    expect(signature?.signatureType).toBe('error_propagation');
    expect(signature?.affectedServices).toEqual(expect.arrayContaining(['svc-a', 'svc-b']));
  });

  it('returns null when anomalies do not meet thresholds', () => {
    const now = Date.now();
    const signature = detectCascadeSignature([
      {
        serviceId: 'svc-a',
        type: 'error_rate',
        observedAt: now,
        deviationStdDev: 1.5,
      }
    ]);

    expect(signature).toBeNull();
  });
});
