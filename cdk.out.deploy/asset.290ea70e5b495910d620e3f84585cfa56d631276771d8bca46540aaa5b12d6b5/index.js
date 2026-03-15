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
async function postWebhook(payload) {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`Webhook POST failed with status ${response.status}`);
  }
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
  await postWebhook(payload);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
