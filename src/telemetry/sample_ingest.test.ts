import { routeEvent, validateEvent } from './sample_ingest';

describe('sample_ingest', () => {
  it('rejects invalid health event', () => {
    const result = validateEvent({
      source: 'health',
      timestamp: new Date().toISOString(),
      metrics: {},
    });

    expect(result.ok).toBe(false);
  });

  it('normalizes and accepts valid telemetry event', async () => {
    const result = await routeEvent({
      source: 'logistics',
      timestamp: '2026-01-01T00:00:00.000Z',
      nodeId: 'port-1',
      metrics: { throughputPctOfNorm: 55 },
    });

    expect(result.ok).toBe(true);
    expect(result.normalized?.region).toBe('unknown');
    expect(result.normalized?.timestamp).toBe('2026-01-01T00:00:00.000Z');
  });
});
