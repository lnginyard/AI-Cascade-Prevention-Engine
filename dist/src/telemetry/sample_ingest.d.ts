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
/**
 * validateEvent - very small runtime checks for required fields per source
 */
export declare function validateEvent(ev: TelemetryEvent): IngestResult;
/**
 * routeEvent - placeholder to show where to send validated events
 * Options: S3 (raw store), EventBridge (events), DynamoDB (cache), or direct to the Prediction Engine.
 * Replace the TODO blocks with real AWS SDK calls in your environment.
 */
export declare function routeEvent(ev: TelemetryEvent): Promise<IngestResult>;
