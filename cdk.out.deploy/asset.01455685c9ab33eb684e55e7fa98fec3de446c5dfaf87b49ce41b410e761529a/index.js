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

// src/integrations/webhook_notifier_handler.ts
var webhook_notifier_handler_exports = {};
__export(webhook_notifier_handler_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(webhook_notifier_handler_exports);
async function postJson(url, payload, channel) {
  if (!url) {
    return;
  }
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`${channel} webhook POST failed with status ${response.status}`);
  }
}
function toSummary(event) {
  const detail = event.detail || {};
  const signatureId = String(detail["signatureId"] || detail["id"] || "n/a");
  const severity = String(detail["severity"] || detail["riskLevel"] || "INFO").toUpperCase();
  return `[${severity}] ${event["detail-type"]} (${signatureId})`;
}
async function handler(event) {
  const enabled = process.env.WEBHOOK_ENABLED === "true";
  if (!enabled) {
    return;
  }
  const payload = {
    source: event.source,
    detailType: event["detail-type"],
    time: event.time,
    detail: event.detail,
    id: event.id,
    region: event.region
  };
  const summary = toSummary(event);
  const dashboardUrl = process.env.OPERATIONS_CONSOLE_URL || "https://aicpe.dev";
  const slackPayload = {
    text: `${summary}
Source: ${event.source}
Time: ${event.time}
Dashboard: ${dashboardUrl}`
  };
  const teamsPayload = {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary,
    themeColor: "E81123",
    title: "Cascade Prevention Alert",
    sections: [
      {
        activityTitle: summary,
        facts: [
          { name: "Source", value: event.source },
          { name: "DetailType", value: event["detail-type"] },
          { name: "Time", value: event.time },
          { name: "Region", value: event.region },
          { name: "Dashboard", value: dashboardUrl }
        ]
      }
    ]
  };
  const statuspagePayload = {
    event: "cascade_prevention_alert",
    summary,
    source: event.source,
    detailType: event["detail-type"],
    time: event.time,
    detail: event.detail,
    region: event.region
  };
  await Promise.all([
    postJson(process.env.WEBHOOK_URL, payload, "Generic"),
    postJson(process.env.SLACK_WEBHOOK_URL, slackPayload, "Slack"),
    postJson(process.env.TEAMS_WEBHOOK_URL, teamsPayload, "Teams"),
    postJson(process.env.STATUSPAGE_WEBHOOK_URL, statuspagePayload, "Statuspage")
  ]);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
