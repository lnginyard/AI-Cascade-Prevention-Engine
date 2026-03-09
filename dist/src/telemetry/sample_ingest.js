"use strict";
// Sample telemetry ingestion helper (TypeScript)
// Minimal, framework-agnostic stub showing validation, normalization, and routing.
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEvent = validateEvent;
exports.routeEvent = routeEvent;
const client_eventbridge_1 = require("@aws-sdk/client-eventbridge");
const client_s3_1 = require("@aws-sdk/client-s3");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const crypto_1 = require("crypto");
const MAX_RETRY_ATTEMPTS = 3;
function buildClients(region) {
    const dynamoClient = new client_dynamodb_1.DynamoDBClient({ region });
    return {
        s3: new client_s3_1.S3Client({ region }),
        eventBridge: new client_eventbridge_1.EventBridgeClient({ region }),
        dynamo: lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient),
    };
}
async function withRetry(operation) {
    let attempt = 0;
    let lastError;
    while (attempt < MAX_RETRY_ATTEMPTS) {
        try {
            return await operation();
        }
        catch (error) {
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
function telemetryObjectKey(event) {
    const date = new Date(event.timestamp);
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const id = (0, crypto_1.randomUUID)();
    return `source=${event.source}/region=${event.region}/year=${year}/month=${month}/day=${day}/${id}.json`;
}
/**
 * validateEvent - very small runtime checks for required fields per source
 */
function validateEvent(ev) {
    if (!ev || !ev.source || !ev.timestamp || !ev.metrics) {
        return { ok: false, reason: 'missing required top-level fields' };
    }
    switch (ev.source) {
        case 'health':
            if (typeof ev.metrics.icuOccupancyPct !== 'number')
                return { ok: false, reason: 'health.metrics.icuOccupancyPct required' };
            break;
        case 'logistics':
            if (typeof ev.metrics.throughputPctOfNorm !== 'number')
                return { ok: false, reason: 'logistics.metrics.throughputPctOfNorm required' };
            break;
        case 'utilities':
            if (typeof ev.metrics.capacityPct !== 'number')
                return { ok: false, reason: 'utilities.metrics.capacityPct required' };
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
async function routeEvent(ev) {
    const valid = validateEvent(ev);
    if (!valid.ok)
        return valid;
    // Example normalization: ensure ISO timestamp and region present
    const normalized = {
        ...ev,
        timestamp: new Date(ev.timestamp).toISOString(),
        region: ev.region || 'unknown'
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
            await clients.s3.send(new client_s3_1.PutObjectCommand({
                Bucket: telemetryBucket,
                Key: objectKey,
                Body: JSON.stringify(normalized),
                ContentType: 'application/json'
            }));
        });
        await withRetry(async () => {
            await clients.eventBridge.send(new client_eventbridge_1.PutEventsCommand({
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
            await clients.dynamo.send(new lib_dynamodb_1.PutCommand({
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
    }
    catch (error) {
        return {
            ok: false,
            reason: `routing failure: ${error instanceof Error ? error.message : 'unknown error'}`
        };
    }
    return { ok: true, normalized };
}
// Example usage (uncomment when running in a Node environment):
/*
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
*/
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2FtcGxlX2luZ2VzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy90ZWxlbWV0cnkvc2FtcGxlX2luZ2VzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsaURBQWlEO0FBQ2pELG1GQUFtRjs7QUEwRW5GLHNDQW9CQztBQU9ELGdDQStFQztBQWxMRCxvRUFBa0Y7QUFDbEYsa0RBQWdFO0FBQ2hFLDhEQUEwRDtBQUMxRCx3REFBMkU7QUFDM0UsbUNBQW9DO0FBd0JwQyxNQUFNLGtCQUFrQixHQUFHLENBQUMsQ0FBQztBQUU3QixTQUFTLFlBQVksQ0FBQyxNQUFjO0lBQ2xDLE1BQU0sWUFBWSxHQUFHLElBQUksZ0NBQWMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDcEQsT0FBTztRQUNMLEVBQUUsRUFBRSxJQUFJLG9CQUFRLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQztRQUM1QixXQUFXLEVBQUUsSUFBSSxzQ0FBaUIsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDO1FBQzlDLE1BQU0sRUFBRSxxQ0FBc0IsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDO0tBQ2xELENBQUM7QUFDSixDQUFDO0FBRUQsS0FBSyxVQUFVLFNBQVMsQ0FBSSxTQUEyQjtJQUNyRCxJQUFJLE9BQU8sR0FBRyxDQUFDLENBQUM7SUFDaEIsSUFBSSxTQUFrQixDQUFDO0lBRXZCLE9BQU8sT0FBTyxHQUFHLGtCQUFrQixFQUFFLENBQUM7UUFDcEMsSUFBSSxDQUFDO1lBQ0gsT0FBTyxNQUFNLFNBQVMsRUFBRSxDQUFDO1FBQzNCLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsU0FBUyxHQUFHLEtBQUssQ0FBQztZQUNsQixPQUFPLElBQUksQ0FBQyxDQUFDO1lBQ2IsSUFBSSxPQUFPLElBQUksa0JBQWtCLEVBQUUsQ0FBQztnQkFDbEMsTUFBTTtZQUNSLENBQUM7WUFDRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsR0FBRyxHQUFHLENBQUM7WUFDMUMsTUFBTSxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQzlELENBQUM7SUFDSCxDQUFDO0lBRUQsTUFBTSxTQUFTLENBQUM7QUFDbEIsQ0FBQztBQUVELFNBQVMsa0JBQWtCLENBQUMsS0FBcUI7SUFDL0MsTUFBTSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3ZDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQztJQUMzQyxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDOUQsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDdkQsTUFBTSxFQUFFLEdBQUcsSUFBQSxtQkFBVSxHQUFFLENBQUM7SUFDeEIsT0FBTyxVQUFVLEtBQUssQ0FBQyxNQUFNLFdBQVcsS0FBSyxDQUFDLE1BQU0sU0FBUyxJQUFJLFVBQVUsS0FBSyxRQUFRLEdBQUcsSUFBSSxFQUFFLE9BQU8sQ0FBQztBQUMzRyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixhQUFhLENBQUMsRUFBa0I7SUFDOUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFLENBQUMsU0FBUyxJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3RELE9BQU8sRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxtQ0FBbUMsRUFBRSxDQUFDO0lBQ3BFLENBQUM7SUFFRCxRQUFRLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNsQixLQUFLLFFBQVE7WUFDWCxJQUFJLE9BQU8sRUFBRSxDQUFDLE9BQU8sQ0FBQyxlQUFlLEtBQUssUUFBUTtnQkFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUseUNBQXlDLEVBQUUsQ0FBQztZQUM1SCxNQUFNO1FBQ1IsS0FBSyxXQUFXO1lBQ2QsSUFBSSxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsbUJBQW1CLEtBQUssUUFBUTtnQkFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsZ0RBQWdELEVBQUUsQ0FBQztZQUN2SSxNQUFNO1FBQ1IsS0FBSyxXQUFXO1lBQ2QsSUFBSSxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsV0FBVyxLQUFLLFFBQVE7Z0JBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLHdDQUF3QyxFQUFFLENBQUM7WUFDdkgsTUFBTTtRQUNSO1lBQ0UsT0FBTyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLG1CQUFtQixFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztJQUNqRSxDQUFDO0lBRUQsT0FBTyxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLEVBQUUsRUFBRSxDQUFDO0FBQ3RDLENBQUM7QUFFRDs7OztHQUlHO0FBQ0ksS0FBSyxVQUFVLFVBQVUsQ0FBQyxFQUFrQjtJQUNqRCxNQUFNLEtBQUssR0FBRyxhQUFhLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDaEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFFNUIsaUVBQWlFO0lBQ2pFLE1BQU0sVUFBVSxHQUFtQjtRQUNqQyxHQUFHLEVBQUU7UUFDTCxTQUFTLEVBQUUsSUFBSSxJQUFJLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLFdBQVcsRUFBRTtRQUMvQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU0sSUFBSSxTQUFTO0tBQy9CLENBQUM7SUFFRixNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsSUFBSSxXQUFXLENBQUM7SUFDckQsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQztJQUNyRCxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQztJQUNoRCxNQUFNLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUM7SUFFOUQsSUFBSSxDQUFDLGVBQWUsSUFBSSxDQUFDLFlBQVksSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7UUFDOUQsT0FBTztZQUNMLEVBQUUsRUFBRSxJQUFJO1lBQ1IsVUFBVTtZQUNWLE1BQU0sRUFBRSxvR0FBb0c7U0FDN0csQ0FBQztJQUNKLENBQUM7SUFFRCxNQUFNLE9BQU8sR0FBRyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFckMsSUFBSSxDQUFDO1FBQ0gsTUFBTSxTQUFTLEdBQUcsa0JBQWtCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDakQsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDO1FBRWxELE1BQU0sU0FBUyxDQUFDLEtBQUssSUFBSSxFQUFFO1lBQ3pCLE1BQU0sT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSw0QkFBZ0IsQ0FBQztnQkFDekMsTUFBTSxFQUFFLGVBQWU7Z0JBQ3ZCLEdBQUcsRUFBRSxTQUFTO2dCQUNkLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQztnQkFDaEMsV0FBVyxFQUFFLGtCQUFrQjthQUNoQyxDQUFDLENBQUMsQ0FBQztRQUNOLENBQUMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxTQUFTLENBQUMsS0FBSyxJQUFJLEVBQUU7WUFDekIsTUFBTSxPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLHFDQUFnQixDQUFDO2dCQUNsRCxPQUFPLEVBQUU7b0JBQ1A7d0JBQ0UsTUFBTSxFQUFFLGdDQUFnQyxVQUFVLENBQUMsTUFBTSxFQUFFO3dCQUMzRCxVQUFVLEVBQUUsd0JBQXdCO3dCQUNwQyxZQUFZLEVBQUUsWUFBWTt3QkFDMUIsSUFBSSxFQUFFLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUM7d0JBQ3BDLE1BQU0sRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDOzRCQUNyQixNQUFNLEVBQUUsVUFBVSxDQUFDLE1BQU07NEJBQ3pCLE1BQU0sRUFBRSxVQUFVLENBQUMsTUFBTTs0QkFDekIsU0FBUyxFQUFFLFVBQVUsQ0FBQyxTQUFTOzRCQUMvQixPQUFPLEVBQUUsVUFBVSxDQUFDLE9BQU87eUJBQzVCLENBQUM7cUJBQ0g7aUJBQ0Y7YUFDRixDQUFDLENBQUMsQ0FBQztRQUNOLENBQUMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxTQUFTLENBQUMsS0FBSyxJQUFJLEVBQUU7WUFDekIsTUFBTSxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLHlCQUFVLENBQUM7Z0JBQ3ZDLFNBQVMsRUFBRSxtQkFBbUI7Z0JBQzlCLElBQUksRUFBRTtvQkFDSixTQUFTLEVBQUUsVUFBVSxDQUFDLFVBQVUsSUFBSSxVQUFVLENBQUMsTUFBTSxJQUFJLFVBQVUsQ0FBQyxTQUFTLElBQUksV0FBVyxVQUFVLENBQUMsTUFBTSxFQUFFO29CQUMvRyxTQUFTLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDO29CQUMzQyxTQUFTLEVBQUUsVUFBVSxDQUFDLE1BQU07b0JBQzVCLE1BQU0sRUFBRSxVQUFVLENBQUMsTUFBTTtvQkFDekIsT0FBTyxFQUFFLFVBQVUsQ0FBQyxPQUFPO29CQUMzQixHQUFHO2lCQUNKO2FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFDTixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTztZQUNMLEVBQUUsRUFBRSxLQUFLO1lBQ1QsTUFBTSxFQUFFLG9CQUFvQixLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxlQUFlLEVBQUU7U0FDdkYsQ0FBQztJQUNKLENBQUM7SUFFRCxPQUFPLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsQ0FBQztBQUNsQyxDQUFDO0FBRUQsZ0VBQWdFO0FBQ2hFOzs7Ozs7Ozs7Ozs7O0VBYUUiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBTYW1wbGUgdGVsZW1ldHJ5IGluZ2VzdGlvbiBoZWxwZXIgKFR5cGVTY3JpcHQpXG4vLyBNaW5pbWFsLCBmcmFtZXdvcmstYWdub3N0aWMgc3R1YiBzaG93aW5nIHZhbGlkYXRpb24sIG5vcm1hbGl6YXRpb24sIGFuZCByb3V0aW5nLlxuXG5pbXBvcnQgeyBQdXRFdmVudHNDb21tYW5kLCBFdmVudEJyaWRnZUNsaWVudCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1ldmVudGJyaWRnZSc7XG5pbXBvcnQgeyBQdXRPYmplY3RDb21tYW5kLCBTM0NsaWVudCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1zMyc7XG5pbXBvcnQgeyBEeW5hbW9EQkNsaWVudCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1keW5hbW9kYic7XG5pbXBvcnQgeyBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LCBQdXRDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvbGliLWR5bmFtb2RiJztcbmltcG9ydCB7IHJhbmRvbVVVSUQgfSBmcm9tICdjcnlwdG8nO1xuXG5leHBvcnQgdHlwZSBUZWxlbWV0cnlFdmVudCA9IHtcbiAgc291cmNlOiBzdHJpbmc7XG4gIHRpbWVzdGFtcDogc3RyaW5nO1xuICByZWdpb24/OiBzdHJpbmc7XG4gIGZhY2lsaXR5SWQ/OiBzdHJpbmc7XG4gIG5vZGVJZD86IHN0cmluZztcbiAgdXRpbGl0eUlkPzogc3RyaW5nO1xuICBtZXRyaWNzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xufTtcblxuZXhwb3J0IHR5cGUgSW5nZXN0UmVzdWx0ID0ge1xuICBvazogYm9vbGVhbjtcbiAgbm9ybWFsaXplZD86IFRlbGVtZXRyeUV2ZW50O1xuICByZWFzb24/OiBzdHJpbmc7XG59O1xuXG50eXBlIEluZ2VzdGlvbkNsaWVudHMgPSB7XG4gIHMzOiBTM0NsaWVudDtcbiAgZXZlbnRCcmlkZ2U6IEV2ZW50QnJpZGdlQ2xpZW50O1xuICBkeW5hbW86IER5bmFtb0RCRG9jdW1lbnRDbGllbnQ7XG59O1xuXG5jb25zdCBNQVhfUkVUUllfQVRURU1QVFMgPSAzO1xuXG5mdW5jdGlvbiBidWlsZENsaWVudHMocmVnaW9uOiBzdHJpbmcpOiBJbmdlc3Rpb25DbGllbnRzIHtcbiAgY29uc3QgZHluYW1vQ2xpZW50ID0gbmV3IER5bmFtb0RCQ2xpZW50KHsgcmVnaW9uIH0pO1xuICByZXR1cm4ge1xuICAgIHMzOiBuZXcgUzNDbGllbnQoeyByZWdpb24gfSksXG4gICAgZXZlbnRCcmlkZ2U6IG5ldyBFdmVudEJyaWRnZUNsaWVudCh7IHJlZ2lvbiB9KSxcbiAgICBkeW5hbW86IER5bmFtb0RCRG9jdW1lbnRDbGllbnQuZnJvbShkeW5hbW9DbGllbnQpLFxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiB3aXRoUmV0cnk8VD4ob3BlcmF0aW9uOiAoKSA9PiBQcm9taXNlPFQ+KTogUHJvbWlzZTxUPiB7XG4gIGxldCBhdHRlbXB0ID0gMDtcbiAgbGV0IGxhc3RFcnJvcjogdW5rbm93bjtcblxuICB3aGlsZSAoYXR0ZW1wdCA8IE1BWF9SRVRSWV9BVFRFTVBUUykge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gYXdhaXQgb3BlcmF0aW9uKCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGxhc3RFcnJvciA9IGVycm9yO1xuICAgICAgYXR0ZW1wdCArPSAxO1xuICAgICAgaWYgKGF0dGVtcHQgPj0gTUFYX1JFVFJZX0FUVEVNUFRTKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY29uc3Qgd2FpdE1zID0gTWF0aC5wb3coMiwgYXR0ZW1wdCkgKiAxMDA7XG4gICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCB3YWl0TXMpKTtcbiAgICB9XG4gIH1cblxuICB0aHJvdyBsYXN0RXJyb3I7XG59XG5cbmZ1bmN0aW9uIHRlbGVtZXRyeU9iamVjdEtleShldmVudDogVGVsZW1ldHJ5RXZlbnQpOiBzdHJpbmcge1xuICBjb25zdCBkYXRlID0gbmV3IERhdGUoZXZlbnQudGltZXN0YW1wKTtcbiAgY29uc3QgeWVhciA9IFN0cmluZyhkYXRlLmdldFVUQ0Z1bGxZZWFyKCkpO1xuICBjb25zdCBtb250aCA9IFN0cmluZyhkYXRlLmdldFVUQ01vbnRoKCkgKyAxKS5wYWRTdGFydCgyLCAnMCcpO1xuICBjb25zdCBkYXkgPSBTdHJpbmcoZGF0ZS5nZXRVVENEYXRlKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gIGNvbnN0IGlkID0gcmFuZG9tVVVJRCgpO1xuICByZXR1cm4gYHNvdXJjZT0ke2V2ZW50LnNvdXJjZX0vcmVnaW9uPSR7ZXZlbnQucmVnaW9ufS95ZWFyPSR7eWVhcn0vbW9udGg9JHttb250aH0vZGF5PSR7ZGF5fS8ke2lkfS5qc29uYDtcbn1cblxuLyoqXG4gKiB2YWxpZGF0ZUV2ZW50IC0gdmVyeSBzbWFsbCBydW50aW1lIGNoZWNrcyBmb3IgcmVxdWlyZWQgZmllbGRzIHBlciBzb3VyY2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlRXZlbnQoZXY6IFRlbGVtZXRyeUV2ZW50KTogSW5nZXN0UmVzdWx0IHtcbiAgaWYgKCFldiB8fCAhZXYuc291cmNlIHx8ICFldi50aW1lc3RhbXAgfHwgIWV2Lm1ldHJpY3MpIHtcbiAgICByZXR1cm4geyBvazogZmFsc2UsIHJlYXNvbjogJ21pc3NpbmcgcmVxdWlyZWQgdG9wLWxldmVsIGZpZWxkcycgfTtcbiAgfVxuXG4gIHN3aXRjaCAoZXYuc291cmNlKSB7XG4gICAgY2FzZSAnaGVhbHRoJzpcbiAgICAgIGlmICh0eXBlb2YgZXYubWV0cmljcy5pY3VPY2N1cGFuY3lQY3QgIT09ICdudW1iZXInKSByZXR1cm4geyBvazogZmFsc2UsIHJlYXNvbjogJ2hlYWx0aC5tZXRyaWNzLmljdU9jY3VwYW5jeVBjdCByZXF1aXJlZCcgfTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2xvZ2lzdGljcyc6XG4gICAgICBpZiAodHlwZW9mIGV2Lm1ldHJpY3MudGhyb3VnaHB1dFBjdE9mTm9ybSAhPT0gJ251bWJlcicpIHJldHVybiB7IG9rOiBmYWxzZSwgcmVhc29uOiAnbG9naXN0aWNzLm1ldHJpY3MudGhyb3VnaHB1dFBjdE9mTm9ybSByZXF1aXJlZCcgfTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3V0aWxpdGllcyc6XG4gICAgICBpZiAodHlwZW9mIGV2Lm1ldHJpY3MuY2FwYWNpdHlQY3QgIT09ICdudW1iZXInKSByZXR1cm4geyBvazogZmFsc2UsIHJlYXNvbjogJ3V0aWxpdGllcy5tZXRyaWNzLmNhcGFjaXR5UGN0IHJlcXVpcmVkJyB9O1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgcmVhc29uOiBgdW5rbm93biBzb3VyY2U6ICR7ZXYuc291cmNlfWAgfTtcbiAgfVxuXG4gIHJldHVybiB7IG9rOiB0cnVlLCBub3JtYWxpemVkOiBldiB9O1xufVxuXG4vKipcbiAqIHJvdXRlRXZlbnQgLSBwbGFjZWhvbGRlciB0byBzaG93IHdoZXJlIHRvIHNlbmQgdmFsaWRhdGVkIGV2ZW50c1xuICogT3B0aW9uczogUzMgKHJhdyBzdG9yZSksIEV2ZW50QnJpZGdlIChldmVudHMpLCBEeW5hbW9EQiAoY2FjaGUpLCBvciBkaXJlY3QgdG8gdGhlIFByZWRpY3Rpb24gRW5naW5lLlxuICogUmVwbGFjZSB0aGUgVE9ETyBibG9ja3Mgd2l0aCByZWFsIEFXUyBTREsgY2FsbHMgaW4geW91ciBlbnZpcm9ubWVudC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJvdXRlRXZlbnQoZXY6IFRlbGVtZXRyeUV2ZW50KTogUHJvbWlzZTxJbmdlc3RSZXN1bHQ+IHtcbiAgY29uc3QgdmFsaWQgPSB2YWxpZGF0ZUV2ZW50KGV2KTtcbiAgaWYgKCF2YWxpZC5vaykgcmV0dXJuIHZhbGlkO1xuXG4gIC8vIEV4YW1wbGUgbm9ybWFsaXphdGlvbjogZW5zdXJlIElTTyB0aW1lc3RhbXAgYW5kIHJlZ2lvbiBwcmVzZW50XG4gIGNvbnN0IG5vcm1hbGl6ZWQ6IFRlbGVtZXRyeUV2ZW50ID0ge1xuICAgIC4uLmV2LFxuICAgIHRpbWVzdGFtcDogbmV3IERhdGUoZXYudGltZXN0YW1wKS50b0lTT1N0cmluZygpLFxuICAgIHJlZ2lvbjogZXYucmVnaW9uIHx8ICd1bmtub3duJ1xuICB9O1xuXG4gIGNvbnN0IHJlZ2lvbiA9IHByb2Nlc3MuZW52LkFXU19SRUdJT04gfHwgJ3VzLWVhc3QtMSc7XG4gIGNvbnN0IHRlbGVtZXRyeUJ1Y2tldCA9IHByb2Nlc3MuZW52LlRFTEVNRVRSWV9CVUNLRVQ7XG4gIGNvbnN0IGV2ZW50QnVzTmFtZSA9IHByb2Nlc3MuZW52LkVWRU5UX0JVU19OQU1FO1xuICBjb25zdCB0ZWxlbWV0cnlDYWNoZVRhYmxlID0gcHJvY2Vzcy5lbnYuVEVMRU1FVFJZX0NBQ0hFX1RBQkxFO1xuXG4gIGlmICghdGVsZW1ldHJ5QnVja2V0IHx8ICFldmVudEJ1c05hbWUgfHwgIXRlbGVtZXRyeUNhY2hlVGFibGUpIHtcbiAgICByZXR1cm4ge1xuICAgICAgb2s6IHRydWUsXG4gICAgICBub3JtYWxpemVkLFxuICAgICAgcmVhc29uOiAnUm91dGluZyBza2lwcGVkLiBTZXQgVEVMRU1FVFJZX0JVQ0tFVCwgRVZFTlRfQlVTX05BTUUsIGFuZCBURUxFTUVUUllfQ0FDSEVfVEFCTEUgdG8gZW5hYmxlIHdyaXRlcy4nXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IGNsaWVudHMgPSBidWlsZENsaWVudHMocmVnaW9uKTtcblxuICB0cnkge1xuICAgIGNvbnN0IG9iamVjdEtleSA9IHRlbGVtZXRyeU9iamVjdEtleShub3JtYWxpemVkKTtcbiAgICBjb25zdCB0dGwgPSBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKSArIDg2NDAwO1xuXG4gICAgYXdhaXQgd2l0aFJldHJ5KGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IGNsaWVudHMuczMuc2VuZChuZXcgUHV0T2JqZWN0Q29tbWFuZCh7XG4gICAgICAgIEJ1Y2tldDogdGVsZW1ldHJ5QnVja2V0LFxuICAgICAgICBLZXk6IG9iamVjdEtleSxcbiAgICAgICAgQm9keTogSlNPTi5zdHJpbmdpZnkobm9ybWFsaXplZCksXG4gICAgICAgIENvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgIH0pKTtcbiAgICB9KTtcblxuICAgIGF3YWl0IHdpdGhSZXRyeShhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCBjbGllbnRzLmV2ZW50QnJpZGdlLnNlbmQobmV3IFB1dEV2ZW50c0NvbW1hbmQoe1xuICAgICAgICBFbnRyaWVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgU291cmNlOiBgY2FzY2FkZS1wcmV2ZW50aW9uLnRlbGVtZXRyeS4ke25vcm1hbGl6ZWQuc291cmNlfWAsXG4gICAgICAgICAgICBEZXRhaWxUeXBlOiAnVGVsZW1ldHJ5RXZlbnRJbmdlc3RlZCcsXG4gICAgICAgICAgICBFdmVudEJ1c05hbWU6IGV2ZW50QnVzTmFtZSxcbiAgICAgICAgICAgIFRpbWU6IG5ldyBEYXRlKG5vcm1hbGl6ZWQudGltZXN0YW1wKSxcbiAgICAgICAgICAgIERldGFpbDogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICBzb3VyY2U6IG5vcm1hbGl6ZWQuc291cmNlLFxuICAgICAgICAgICAgICByZWdpb246IG5vcm1hbGl6ZWQucmVnaW9uLFxuICAgICAgICAgICAgICB0aW1lc3RhbXA6IG5vcm1hbGl6ZWQudGltZXN0YW1wLFxuICAgICAgICAgICAgICBtZXRyaWNzOiBub3JtYWxpemVkLm1ldHJpY3NcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICBdXG4gICAgICB9KSk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCB3aXRoUmV0cnkoYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgY2xpZW50cy5keW5hbW8uc2VuZChuZXcgUHV0Q29tbWFuZCh7XG4gICAgICAgIFRhYmxlTmFtZTogdGVsZW1ldHJ5Q2FjaGVUYWJsZSxcbiAgICAgICAgSXRlbToge1xuICAgICAgICAgIHNlcnZpY2VJZDogbm9ybWFsaXplZC5mYWNpbGl0eUlkIHx8IG5vcm1hbGl6ZWQubm9kZUlkIHx8IG5vcm1hbGl6ZWQudXRpbGl0eUlkIHx8IGB1bmtub3duOiR7bm9ybWFsaXplZC5zb3VyY2V9YCxcbiAgICAgICAgICB0aW1lc3RhbXA6IERhdGUucGFyc2Uobm9ybWFsaXplZC50aW1lc3RhbXApLFxuICAgICAgICAgIGV2ZW50VHlwZTogbm9ybWFsaXplZC5zb3VyY2UsXG4gICAgICAgICAgcmVnaW9uOiBub3JtYWxpemVkLnJlZ2lvbixcbiAgICAgICAgICBtZXRyaWNzOiBub3JtYWxpemVkLm1ldHJpY3MsXG4gICAgICAgICAgdHRsLFxuICAgICAgICB9XG4gICAgICB9KSk7XG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG9rOiBmYWxzZSxcbiAgICAgIHJlYXNvbjogYHJvdXRpbmcgZmFpbHVyZTogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6ICd1bmtub3duIGVycm9yJ31gXG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiB7IG9rOiB0cnVlLCBub3JtYWxpemVkIH07XG59XG5cbi8vIEV4YW1wbGUgdXNhZ2UgKHVuY29tbWVudCB3aGVuIHJ1bm5pbmcgaW4gYSBOb2RlIGVudmlyb25tZW50KTpcbi8qXG4oYXN5bmMgKCkgPT4ge1xuICBjb25zdCBldnQ6IFRlbGVtZXRyeUV2ZW50ID0ge1xuICAgIHNvdXJjZTogJ2hlYWx0aCcsXG4gICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICBmYWNpbGl0eUlkOiAnaG9zcGl0YWwtMTIzJyxcbiAgICBtZXRyaWNzOiB7IGljdU9jY3VwYW5jeVBjdDogNzgsIGlucGF0aWVudEFkbWlzc2lvbnM6IDEyIH1cbiAgfTtcblxuICBjb25zdCByZXMgPSBhd2FpdCByb3V0ZUV2ZW50KGV2dCk7XG4gIGNvbnNvbGUubG9nKCdyZXN1bHQnLCByZXMpO1xufSkoKTtcbiovXG4iXX0=