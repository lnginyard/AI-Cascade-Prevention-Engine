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

// src/orchestration/remediation_planner_handler.ts
var remediation_planner_handler_exports = {};
__export(remediation_planner_handler_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(remediation_planner_handler_exports);
var import_client_eventbridge = require("@aws-sdk/client-eventbridge");
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_client_sfn = require("@aws-sdk/client-sfn");
var import_crypto = require("crypto");
var region = process.env.AWS_REGION || "us-east-1";
var eventBridge = new import_client_eventbridge.EventBridgeClient({ region });
var dynamo = import_lib_dynamodb.DynamoDBDocumentClient.from(new import_client_dynamodb.DynamoDBClient({ region }));
var sfn = new import_client_sfn.SFNClient({ region });
function buildPlan(detail) {
  const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const topTargets = detail.predictedBlastRadius.slice(0, 3);
  const actions = [
    {
      actionId: (0, import_crypto.randomUUID)(),
      kind: "circuit_break",
      targetService: topTargets[0] || "unknown-service",
      priority: 1,
      rollback: {
        kind: "close_circuit_break",
        targetService: topTargets[0] || "unknown-service"
      }
    },
    {
      actionId: (0, import_crypto.randomUUID)(),
      kind: "rate_limit",
      targetService: topTargets[1] || topTargets[0] || "unknown-service",
      priority: 2,
      rollback: {
        kind: "remove_rate_limit",
        targetService: topTargets[1] || topTargets[0] || "unknown-service"
      }
    },
    {
      actionId: (0, import_crypto.randomUUID)(),
      kind: "traffic_shift",
      targetService: topTargets[2] || topTargets[1] || topTargets[0] || "unknown-service",
      priority: 3,
      rollback: {
        kind: "restore_traffic",
        targetService: topTargets[2] || topTargets[1] || topTargets[0] || "unknown-service"
      }
    }
  ];
  return {
    planId: `plan-${(0, import_crypto.randomUUID)()}`,
    signatureId: detail.signatureId,
    predictionId: detail.predictionId,
    status: "PENDING_APPROVAL",
    generatedAt,
    confidenceScore: detail.confidenceScore,
    blastRadius: detail.predictedBlastRadius,
    actions,
    alternatives: [
      {
        strategy: "conservative",
        actions: ["rate_limit", "traffic_shift"]
      },
      {
        strategy: "aggressive",
        actions: ["circuit_break", "rate_limit", "traffic_shift"]
      }
    ]
  };
}
async function emitPlanGenerated(plan, eventBusName) {
  await eventBridge.send(new import_client_eventbridge.PutEventsCommand({
    Entries: [
      {
        Source: "cascade-prevention.remediation",
        DetailType: "RemediationPlanGenerated",
        EventBusName: eventBusName,
        Time: new Date(plan.generatedAt),
        Detail: JSON.stringify({
          planId: plan.planId,
          signatureId: plan.signatureId,
          predictionId: plan.predictionId,
          actionCount: plan.actions.length,
          confidenceScore: plan.confidenceScore
        })
      }
    ]
  }));
}
async function handler(event) {
  const tableName = process.env.REMEDIATION_PLANS_TABLE;
  const eventBusName = process.env.EVENT_BUS_NAME;
  const stateMachineArn = process.env.REMEDIATION_STATE_MACHINE_ARN;
  if (!tableName || !eventBusName) {
    return;
  }
  const plan = buildPlan(event.detail);
  await dynamo.send(new import_lib_dynamodb.PutCommand({
    TableName: tableName,
    Item: plan
  }));
  await emitPlanGenerated(plan, eventBusName);
  if (stateMachineArn && plan.actions.length >= 3) {
    await sfn.send(new import_client_sfn.StartExecutionCommand({
      stateMachineArn,
      input: JSON.stringify({
        planId: plan.planId,
        signatureId: plan.signatureId,
        actions: plan.actions,
        rollbackActions: [...plan.actions].reverse().map((action) => ({
          actionId: `${action.actionId}-rollback`,
          kind: action.rollback.kind,
          targetService: action.rollback.targetService
        }))
      })
    }));
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
