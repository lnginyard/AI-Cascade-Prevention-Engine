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

// src/api/api_handler.ts
var api_handler_exports = {};
__export(api_handler_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(api_handler_exports);
var import_client_dynamodb2 = require("@aws-sdk/client-dynamodb");
var import_client_eventbridge = require("@aws-sdk/client-eventbridge");
var import_lib_dynamodb2 = require("@aws-sdk/lib-dynamodb");

// src/api/ai_chat_handler.ts
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var region = process.env.AWS_REGION || "us-east-1";
var dynamo = import_lib_dynamodb.DynamoDBDocumentClient.from(new import_client_dynamodb.DynamoDBClient({ region }));
function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Content-Type,Authorization,X-Api-Key",
      "access-control-allow-methods": "GET,POST,OPTIONS"
    },
    body: JSON.stringify(payload)
  };
}
async function saveChatMessage(sessionId, role, content) {
  const tableName = process.env.CHAT_HISTORY_TABLE;
  if (!tableName) return;
  try {
    await dynamo.send(new import_lib_dynamodb.PutCommand({
      TableName: tableName,
      Item: {
        sessionId,
        timestamp: Date.now(),
        messageId: `${sessionId}-${Date.now()}`,
        role,
        content
      }
    }));
  } catch (e) {
    console.log("Could not save chat message:", e);
  }
}
function generateAiResponse(userMessage) {
  const lowerMessage = userMessage.toLowerCase();
  if (lowerMessage.includes("cascade") || lowerMessage.includes("propagate") || lowerMessage.includes("spread")) {
    return `Cascade failure analysis: Failures typically spread through dependency chains. Early detection of queue saturation, latency amplification, or regional failover drift enables preventive action. The system monitors technical and business domains to assess combined risk. Recommend scanning for unusual correlation patterns across metrics.`;
  }
  if (lowerMessage.includes("business") || lowerMessage.includes("impact") || lowerMessage.includes("revenue")) {
    return `Business impact assessment: Cascades create multi-domain effects\u2014technical failures trigger operational delays, logistics bottlenecks, staffing stress, and ultimately revenue loss. Early warning across all domains enables mitigation before customer harm.`;
  }
  if (lowerMessage.includes("staff") || lowerMessage.includes("team") || lowerMessage.includes("people") || lowerMessage.includes("culture")) {
    return `Staffing resilience: Team fatigue and high absence rates worsen cascade response. Monitor psychological safety, overtime trends, and engagement alongside technical metrics. Mitigation must account for team capacity.`;
  }
  if (lowerMessage.includes("logistics") || lowerMessage.includes("supply") || lowerMessage.includes("transportation") || lowerMessage.includes("shipping")) {
    return `Supply chain analysis: Lead time inflation and carrier unavailability cascade into fulfillment delays and customer dissatisfaction. Early logistical signal detection enables preemptive routing and communication.`;
  }
  if (lowerMessage.includes("region") || lowerMessage.includes("failover") || lowerMessage.includes("regional")) {
    return `Regional resilience: Geographic diversity protects against regional outages. Monitor health and data consistency continuously. Latency drift and replication lag are predictive signals for failover risk.`;
  }
  if (lowerMessage.includes("detect") || lowerMessage.includes("early") || lowerMessage.includes("prediction")) {
    return `Early detection: The Engine monitors financial, operational, and cultural metrics alongside technical signals. Signature detection identifies pre-cascade conditions with confidence scoring. Real-time assessment enables 15-45 minute warning windows.`;
  }
  if (lowerMessage.includes("mitigation") || lowerMessage.includes("prevent") || lowerMessage.includes("remediation")) {
    return `Mitigation strategies: Infrastructure cascades use circuit breakers and throttling. Operational cascades use process prioritization and reallocation. Cultural cascades use team support and workload adjustment. Effective mitigation requires tested playbooks and rapid approval workflows.`;
  }
  if (lowerMessage.includes("compliance") || lowerMessage.includes("regulatory") || lowerMessage.includes("audit") || lowerMessage.includes("sla")) {
    return `Compliance considerations: SLA obligations and audit requirements limit remediation options. Data residency failures require immediate containment. Playbooks must preserve audit trails and account for regulatory constraints.`;
  }
  if (lowerMessage.includes("finance") || lowerMessage.includes("cash") || lowerMessage.includes("margin") || lowerMessage.includes("cost")) {
    return `Financial impact: Cascades create measurable losses\u2014refunds, lost orders, penalties, emergency costs. Model revenue sensitivity to scenarios. Prevention ROI justifies investment in early detection infrastructure.`;
  }
  if (lowerMessage.includes("health") || lowerMessage.includes("wellness") || lowerMessage.includes("facility")) {
    return `Health and wellness: Facility capacity constraints, illness rates, and team welfare affect operational response capacity. Monitor health metrics and coordinate with occupational teams in mitigation planning.`;
  }
  return `The Cascade Prevention Engine integrates business and technical intelligence. Effective prevention requires cross-functional visibility: technical metrics (latency, errors, resources), operational metrics (throughput, quality), staffing metrics (capacity, engagement), and financial metrics (revenue, margins). Early detection feeds predictive models. Mitigation executes with 15-30 second latency. What cascade scenario would you like to explore?`;
}
async function handleAiChat(event) {
  const body = event.body ? JSON.parse(event.body) : {};
  const chatRequest = body;
  if (!chatRequest.message || typeof chatRequest.message !== "string") {
    return json(400, { message: "Missing or invalid message field" });
  }
  const sessionId = chatRequest.sessionId || `session-${Date.now()}`;
  try {
    await saveChatMessage(sessionId, "user", chatRequest.message);
    const aiResponse = generateAiResponse(chatRequest.message);
    await saveChatMessage(sessionId, "assistant", aiResponse);
    const result = {
      response: aiResponse,
      sessionId
    };
    return json(200, result);
  } catch (error) {
    console.error("AI Chat Error:", error);
    return json(500, {
      message: "Failed to process chat message",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// src/api/api_handler.ts
var region2 = process.env.AWS_REGION || "us-east-1";
var dynamo2 = import_lib_dynamodb2.DynamoDBDocumentClient.from(new import_client_dynamodb2.DynamoDBClient({ region: region2 }));
var eventBridge = new import_client_eventbridge.EventBridgeClient({ region: region2 });
function json2(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Content-Type,Authorization,X-Api-Key",
      "access-control-allow-methods": "GET,POST,OPTIONS"
    },
    body: JSON.stringify(payload)
  };
}
async function getDependencyGraph() {
  const tableName = process.env.DEPENDENCY_GRAPH_TABLE;
  if (!tableName) return json2(500, { message: "DEPENDENCY_GRAPH_TABLE is not configured" });
  const result = await dynamo2.send(new import_lib_dynamodb2.ScanCommand({
    TableName: tableName,
    Limit: 100
  }));
  return json2(200, { items: result.Items || [] });
}
async function getActiveSignatures() {
  const tableName = process.env.SIGNATURES_TABLE_NAME;
  if (!tableName) return json2(500, { message: "SIGNATURES_TABLE_NAME is not configured" });
  const result = await dynamo2.send(new import_lib_dynamodb2.ScanCommand({
    TableName: tableName,
    FilterExpression: "#status = :status",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: { ":status": "ACTIVE" },
    Limit: 100
  }));
  return json2(200, { items: result.Items || [] });
}
async function getRemediationPlans() {
  const tableName = process.env.REMEDIATION_PLANS_TABLE;
  if (!tableName) return json2(200, { items: [] });
  const result = await dynamo2.send(new import_lib_dynamodb2.ScanCommand({
    TableName: tableName,
    Limit: 100
  }));
  return json2(200, { items: result.Items || [] });
}
async function approveRemediationPlan(event) {
  const tableName = process.env.REMEDIATION_PLANS_TABLE;
  const eventBusName = process.env.EVENT_BUS_NAME;
  if (!tableName) return json2(500, { message: "REMEDIATION_PLANS_TABLE is not configured" });
  const planId = event.pathParameters?.planId;
  if (!planId) return json2(400, { message: "Missing planId path parameter" });
  const parsedBody = event.body ? JSON.parse(event.body) : {};
  const approved = parsedBody.approved === true;
  const reviewer = parsedBody.reviewer || "unknown";
  const reason = parsedBody.reason || null;
  const existing = await dynamo2.send(new import_lib_dynamodb2.GetCommand({
    TableName: tableName,
    Key: { planId }
  }));
  if (!existing.Item) {
    return json2(404, { message: `Remediation plan ${planId} was not found` });
  }
  const updated = {
    ...existing.Item,
    status: approved ? "APPROVED" : "REJECTED",
    approval: {
      approved,
      reviewer,
      reason,
      at: (/* @__PURE__ */ new Date()).toISOString()
    }
  };
  await dynamo2.send(new import_lib_dynamodb2.PutCommand({
    TableName: tableName,
    Item: updated
  }));
  if (eventBusName) {
    await eventBridge.send(new import_client_eventbridge.PutEventsCommand({
      Entries: [
        {
          Source: "cascade-prevention.remediation",
          DetailType: "RemediationActionRecorded",
          EventBusName: eventBusName,
          Time: /* @__PURE__ */ new Date(),
          Detail: JSON.stringify({
            planId,
            approved,
            reviewer,
            reason,
            status: updated.status,
            at: updated.approval.at
          })
        }
      ]
    }));
  }
  return json2(200, updated);
}
async function handler(event) {
  const method = event.httpMethod;
  const rawPath = event.path;
  const path = rawPath.replace(/^\/v1/, "");
  if (method === "GET" && path === "/dependency-graph") return getDependencyGraph();
  if (method === "GET" && path === "/cascade-signatures/active") return getActiveSignatures();
  if (method === "GET" && path === "/remediation-plans") return getRemediationPlans();
  if (method === "POST" && /^\/remediation-plans\/[^/]+\/approval$/.test(path)) {
    return approveRemediationPlan(event);
  }
  if (method === "POST" && path === "/ai-copilot/chat") return handleAiChat(event);
  return json2(404, { message: "Route not found" });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
