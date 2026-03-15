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

// src/detection/signature_matcher_handler.ts
var signature_matcher_handler_exports = {};
__export(signature_matcher_handler_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(signature_matcher_handler_exports);
var import_client_eventbridge = require("@aws-sdk/client-eventbridge");
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_client_sns = require("@aws-sdk/client-sns");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");

// src/detection/signature_detector.ts
var WINDOW_30S = 3e4;
var WINDOW_60S = 6e4;
var WINDOW_120S = 12e4;
function uniq(values) {
  return [...new Set(values)];
}
function pickOrigin(anomalies) {
  if (anomalies.length === 0) return "unknown";
  const sorted = [...anomalies].sort((a, b) => a.observedAt - b.observedAt);
  return sorted[0].serviceId;
}
function confidenceFromCount(count, base = 0.75) {
  return Math.min(0.99, Number((base + count * 0.05).toFixed(2)));
}
function detectCascadeSignature(anomalies) {
  if (anomalies.length === 0) return null;
  const sorted = [...anomalies].sort((a, b) => a.observedAt - b.observedAt);
  const firstTs = sorted[0].observedAt;
  const errorCandidates = sorted.filter(
    (a) => a.type === "error_rate" && (a.deviationStdDev ?? 0) >= 3 && a.observedAt - firstTs <= WINDOW_60S
  );
  if (uniq(errorCandidates.map((a) => a.serviceId)).length >= 2) {
    const affected = uniq(errorCandidates.map((a) => a.serviceId));
    return {
      signatureId: `sig-${Date.now()}-error`,
      signatureType: "error_propagation",
      originServiceId: pickOrigin(errorCandidates),
      affectedServices: affected,
      detectedAt: Date.now(),
      confidenceScore: confidenceFromCount(affected.length, 0.8),
      evidence: ["error_rate >= 3 stddev in 2+ services within 60s"]
    };
  }
  const latencyCandidates = sorted.filter(
    (a) => a.type === "latency" && (a.latencyIncreasePct ?? 0) >= 50 && a.observedAt - firstTs <= WINDOW_30S
  );
  if (uniq(latencyCandidates.map((a) => a.serviceId)).length >= 2) {
    const affected = uniq(latencyCandidates.map((a) => a.serviceId));
    return {
      signatureId: `sig-${Date.now()}-latency`,
      signatureType: "latency_cascade",
      originServiceId: pickOrigin(latencyCandidates),
      affectedServices: affected,
      detectedAt: Date.now(),
      confidenceScore: confidenceFromCount(affected.length, 0.78),
      evidence: ["latency increase >= 50% across dependency path within 30s"]
    };
  }
  const trafficDropCandidates = sorted.filter(
    (a) => a.type === "traffic_drop" && (a.volumeDropPct ?? 0) >= 80
  );
  if (trafficDropCandidates.length > 0) {
    const affected = uniq(trafficDropCandidates.map((a) => a.serviceId));
    return {
      signatureId: `sig-${Date.now()}-traffic`,
      signatureType: "traffic_drop",
      originServiceId: pickOrigin(trafficDropCandidates),
      affectedServices: affected,
      detectedAt: Date.now(),
      confidenceScore: confidenceFromCount(affected.length, 0.76),
      evidence: ["request volume drop >= 80% with upstream still active"]
    };
  }
  const exhaustionCandidates = sorted.filter(
    (a) => a.type === "resource_exhaustion" && a.observedAt - firstTs <= WINDOW_120S
  );
  if (uniq(exhaustionCandidates.map((a) => a.serviceId)).length >= 2) {
    const affected = uniq(exhaustionCandidates.map((a) => a.serviceId));
    return {
      signatureId: `sig-${Date.now()}-resource`,
      signatureType: "resource_exhaustion",
      originServiceId: pickOrigin(exhaustionCandidates),
      affectedServices: affected,
      detectedAt: Date.now(),
      confidenceScore: confidenceFromCount(affected.length, 0.77),
      evidence: ["resource exhaustion in 2+ services within 120s"]
    };
  }
  return null;
}

// src/detection/signature_matcher_handler.ts
var region = process.env.AWS_REGION || "us-east-1";
var eventBridge = new import_client_eventbridge.EventBridgeClient({ region });
var sns = new import_client_sns.SNSClient({ region });
var dynamo = import_lib_dynamodb.DynamoDBDocumentClient.from(new import_client_dynamodb.DynamoDBClient({ region }));
async function handler(event) {
  const tableName = process.env.SIGNATURES_TABLE_NAME;
  const eventBusName = process.env.EVENT_BUS_NAME;
  if (!tableName || !eventBusName) {
    return;
  }
  const anomalies = event.detail?.anomalies || [];
  const signature = detectCascadeSignature(anomalies);
  if (!signature) {
    return;
  }
  await dynamo.send(new import_lib_dynamodb.PutCommand({
    TableName: tableName,
    Item: {
      signatureId: signature.signatureId,
      originServiceId: signature.originServiceId,
      detectedAt: signature.detectedAt,
      signatureType: signature.signatureType,
      confidenceScore: signature.confidenceScore,
      affectedServices: signature.affectedServices,
      evidence: signature.evidence,
      status: "ACTIVE",
      ttl: Math.floor(Date.now() / 1e3) + 7 * 24 * 3600
    }
  }));
  await eventBridge.send(new import_client_eventbridge.PutEventsCommand({
    Entries: [
      {
        Source: "cascade-prevention.signature",
        DetailType: "CascadeSignatureDetected",
        EventBusName: eventBusName,
        Time: new Date(signature.detectedAt),
        Detail: JSON.stringify(signature)
      },
      {
        Source: "cascade-prevention.prediction",
        DetailType: "CascadePathPredicted",
        EventBusName: eventBusName,
        Time: new Date(signature.detectedAt),
        Detail: JSON.stringify({
          predictionId: `pred-${signature.signatureId}`,
          signatureId: signature.signatureId,
          predictedBlastRadius: signature.affectedServices,
          confidenceScore: signature.confidenceScore,
          createdAt: new Date(signature.detectedAt).toISOString()
        })
      }
    ]
  }));
  const alertTopicArn = process.env.ALERT_TOPIC_ARN;
  if (alertTopicArn && signature.confidenceScore >= 0.8) {
    await sns.send(new import_client_sns.PublishCommand({
      TopicArn: alertTopicArn,
      Subject: `Cascade Signature ${signature.signatureType}`,
      Message: JSON.stringify({
        severity: signature.confidenceScore >= 0.9 ? "CRITICAL" : "WARNING",
        signatureId: signature.signatureId,
        originServiceId: signature.originServiceId,
        affectedServices: signature.affectedServices,
        confidenceScore: signature.confidenceScore
      })
    }));
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
