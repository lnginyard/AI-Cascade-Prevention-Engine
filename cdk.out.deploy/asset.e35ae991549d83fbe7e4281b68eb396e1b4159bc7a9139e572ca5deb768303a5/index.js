"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/telemetry/ingestion_handler.ts
var ingestion_handler_exports = {};
__export(ingestion_handler_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(ingestion_handler_exports);

// src/telemetry/sample_ingest.ts
var import_client_eventbridge = require("@aws-sdk/client-eventbridge");
var import_client_s3 = require("@aws-sdk/client-s3");
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_crypto = require("crypto");
var MAX_RETRY_ATTEMPTS = 3;
function buildClients(region) {
  const dynamoClient = new import_client_dynamodb.DynamoDBClient({ region });
  return {
    s3: new import_client_s3.S3Client({ region }),
    eventBridge: new import_client_eventbridge.EventBridgeClient({ region }),
    dynamo: import_lib_dynamodb.DynamoDBDocumentClient.from(dynamoClient)
  };
}
async function withRetry(operation) {
  let attempt = 0;
  let lastError;
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
function telemetryObjectKey(event) {
  const date = new Date(event.timestamp);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const id = (0, import_crypto.randomUUID)();
  return `source=${event.source}/region=${event.region}/year=${year}/month=${month}/day=${day}/${id}.json`;
}
function validateEvent(ev) {
  if (!ev || !ev.source || !ev.timestamp || !ev.metrics) {
    return { ok: false, reason: "missing required top-level fields" };
  }
  switch (ev.source) {
    case "health":
      if (typeof ev.metrics.icuOccupancyPct !== "number") return { ok: false, reason: "health.metrics.icuOccupancyPct required" };
      break;
    case "logistics":
      if (typeof ev.metrics.throughputPctOfNorm !== "number") return { ok: false, reason: "logistics.metrics.throughputPctOfNorm required" };
      break;
    case "utilities":
      if (typeof ev.metrics.capacityPct !== "number") return { ok: false, reason: "utilities.metrics.capacityPct required" };
      break;
    default:
      return { ok: false, reason: `unknown source: ${ev.source}` };
  }
  return { ok: true, normalized: ev };
}
async function routeEvent(ev) {
  const valid = validateEvent(ev);
  if (!valid.ok) return valid;
  const normalized = {
    ...ev,
    timestamp: new Date(ev.timestamp).toISOString(),
    region: ev.region || "unknown"
  };
  const region = process.env.AWS_REGION || "us-east-1";
  const telemetryBucket = process.env.TELEMETRY_BUCKET;
  const eventBusName = process.env.EVENT_BUS_NAME;
  const telemetryCacheTable = process.env.TELEMETRY_CACHE_TABLE;
  if (!telemetryBucket || !eventBusName || !telemetryCacheTable) {
    return {
      ok: true,
      normalized,
      reason: "Routing skipped. Set TELEMETRY_BUCKET, EVENT_BUS_NAME, and TELEMETRY_CACHE_TABLE to enable writes."
    };
  }
  const clients = buildClients(region);
  try {
    const objectKey = telemetryObjectKey(normalized);
    const ttl = Math.floor(Date.now() / 1e3) + 86400;
    await withRetry(async () => {
      await clients.s3.send(new import_client_s3.PutObjectCommand({
        Bucket: telemetryBucket,
        Key: objectKey,
        Body: JSON.stringify(normalized),
        ContentType: "application/json"
      }));
    });
    await withRetry(async () => {
      await clients.eventBridge.send(new import_client_eventbridge.PutEventsCommand({
        Entries: [
          {
            Source: `cascade-prevention.telemetry.${normalized.source}`,
            DetailType: "TelemetryEventIngested",
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
      await clients.dynamo.send(new import_lib_dynamodb.PutCommand({
        TableName: telemetryCacheTable,
        Item: {
          serviceId: normalized.facilityId || normalized.nodeId || normalized.utilityId || `unknown:${normalized.source}`,
          timestamp: Date.parse(normalized.timestamp),
          eventType: normalized.source,
          region: normalized.region,
          metrics: normalized.metrics,
          ttl
        }
      }));
    });
  } catch (error) {
    return {
      ok: false,
      reason: `routing failure: ${error instanceof Error ? error.message : "unknown error"}`
    };
  }
  return { ok: true, normalized };
}

// src/telemetry/ingestion_handler.ts
function response(statusCode, payload) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  };
}
async function handler(event) {
  if (!event.body) {
    return response(400, { ok: false, message: "Missing request body" });
  }
  let parsed;
  try {
    parsed = JSON.parse(event.body);
  } catch {
    return response(400, { ok: false, message: "Invalid JSON body" });
  }
  const result = await routeEvent(parsed);
  if (!result.ok) {
    return response(400, result);
  }
  return response(200, result);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
