// Sample telemetry ingestion helper (TypeScript)
// Minimal, framework-agnostic stub showing validation, normalization, and routing.

import { PutEventsCommand, EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

export type TelemetryEvent = {
  source: string;
  timestamp: string;
  region?: string;
  facilityId?: string;
  nodeId?: string;
  utilityId?: string;
  metrics: Record<string, any>;
};

export type IngestResult = {
  ok: boolean;
  normalized?: TelemetryEvent;
  reason?: string;
};

type IngestionClients = {
  s3: S3Client;
  eventBridge: EventBridgeClient;
  dynamo: DynamoDBDocumentClient;
};

const MAX_RETRY_ATTEMPTS = 3;

function buildClients(region: string): IngestionClients {
  const dynamoClient = new DynamoDBClient({ region });
  return {
    s3: new S3Client({ region }),
    eventBridge: new EventBridgeClient({ region }),
    dynamo: DynamoDBDocumentClient.from(dynamoClient),
  };
}

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < MAX_RETRY_ATTEMPTS) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= MAX_RETRY_ATTEMPTS) {
        break;
      }
      const waitMs = Math.pow(2, attempt) * 100;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError;
}

function telemetryObjectKey(event: TelemetryEvent): string {
  const date = new Date(event.timestamp);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const id = randomUUID();
  return `source=${event.source}/region=${event.region}/year=${year}/month=${month}/day=${day}/${id}.json`;
}

/**
 * validateEvent - very small runtime checks for required fields per source
 */
export function validateEvent(ev: TelemetryEvent): IngestResult {
  if (!ev || !ev.source || !ev.timestamp || !ev.metrics) {
    return { ok: false, reason: 'missing required top-level fields' };
  }

  switch (ev.source) {
    case 'health':
      if (typeof ev.metrics.icuOccupancyPct !== 'number') return { ok: false, reason: 'health.metrics.icuOccupancyPct required' };
      break;
    case 'logistics':
      if (typeof ev.metrics.throughputPctOfNorm !== 'number') return { ok: false, reason: 'logistics.metrics.throughputPctOfNorm required' };
      break;
    case 'utilities':
      if (typeof ev.metrics.capacityPct !== 'number') return { ok: false, reason: 'utilities.metrics.capacityPct required' };
      break;
    default:
      return { ok: false, reason: `unknown source: ${ev.source}` };
  }

  return { ok: true, normalized: ev };
}

/**
 * routeEvent - placeholder to show where to send validated events
 * Options: S3 (raw store), EventBridge (events), DynamoDB (cache), or direct to the Prediction Engine.
 * Replace the TODO blocks with real AWS SDK calls in your environment.
 */
export async function routeEvent(ev: TelemetryEvent): Promise<IngestResult> {
  const valid = validateEvent(ev);
  if (!valid.ok) return valid;

  // Example normalization: ensure ISO timestamp and region present
  const normalized: TelemetryEvent = {
    ...ev,
    timestamp: new Date(ev.timestamp).toISOString(),
    region: ev.region || 'us-west-2'
  };

  const region = process.env.AWS_REGION || 'us-east-1';
  const telemetryBucket = process.env.TELEMETRY_BUCKET;
  const eventBusName = process.env.EVENT_BUS_NAME;
  const telemetryCacheTable = process.env.TELEMETRY_CACHE_TABLE;

  if (!telemetryBucket || !eventBusName || !telemetryCacheTable) {
    return {
      ok: true,
      normalized,
      reason: 'Routing skipped. Set TELEMETRY_BUCKET, EVENT_BUS_NAME, and TELEMETRY_CACHE_TABLE to enable writes.'
    };
  }

  const clients = buildClients(region);

  try {
    const objectKey = telemetryObjectKey(normalized);
    const ttl = Math.floor(Date.now() / 1000) + 86400;

    await withRetry(async () => {
      await clients.s3.send(new PutObjectCommand({
        Bucket: telemetryBucket,
        Key: objectKey,
        Body: JSON.stringify(normalized),
        ContentType: 'application/json'
      }));
    });

    await withRetry(async () => {
      await clients.eventBridge.send(new PutEventsCommand({
        Entries: [
          {
            Source: `cascade-prevention.telemetry.${normalized.source}`,
            DetailType: 'TelemetryEventIngested',
            EventBusName: eventBusName,
            Time: new Date(normalized.timestamp),
            Detail: JSON.stringify({
              source: normalized.source,
              region: normalized.region,
              timestamp: normalized.timestamp,
              metrics: normalized.metrics
            })
          }
        ]
      }));
    });

    await withRetry(async () => {
      await clients.dynamo.send(new PutCommand({
        TableName: telemetryCacheTable,
        Item: {
          serviceId: normalized.facilityId || normalized.nodeId || normalized.utilityId || `unknown:${normalized.source}`,
          timestamp: Date.parse(normalized.timestamp),
          eventType: normalized.source,
          region: normalized.region,
          metrics: normalized.metrics,
          ttl,
        }
      }));
    });
  } catch (error) {
    return {
      ok: false,
      reason: `routing failure: ${error instanceof Error ? error.message : 'unknown error'}`
    };
  }

  return { ok: true, normalized };
}

// Example usage (uncomment when running in a Node environment):

(async () => {
  const evt: TelemetryEvent = {
    source: 'health',
    timestamp: new Date().toISOString(),
    region: 'us-east-1',
    facilityId: 'hospital-123',
    metrics: { icuOccupancyPct: 78, inpatientAdmissions: 12 }
  };

  const res = await routeEvent(evt);
  console.log('result', res);
})();

