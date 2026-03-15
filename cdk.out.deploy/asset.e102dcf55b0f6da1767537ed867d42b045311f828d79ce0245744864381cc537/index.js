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

// src/orchestration/action_executor_handler.ts
var action_executor_handler_exports = {};
__export(action_executor_handler_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(action_executor_handler_exports);
var import_client_eventbridge = require("@aws-sdk/client-eventbridge");
var region = process.env.AWS_REGION || "us-east-1";
var eventBridge = new import_client_eventbridge.EventBridgeClient({ region });
async function handler(input) {
  const eventBusName = process.env.EVENT_BUS_NAME;
  if (!eventBusName) {
    return { ok: true, actionId: input.action.actionId };
  }
  await eventBridge.send(new import_client_eventbridge.PutEventsCommand({
    Entries: [
      {
        Source: "cascade-prevention.remediation",
        DetailType: "RemediationActionStep",
        EventBusName: eventBusName,
        Time: /* @__PURE__ */ new Date(),
        Detail: JSON.stringify({
          planId: input.planId,
          signatureId: input.signatureId,
          mode: input.mode,
          actionId: input.action.actionId,
          kind: input.action.kind,
          targetService: input.action.targetService,
          status: "SUCCESS"
        })
      }
    ]
  }));
  return { ok: true, actionId: input.action.actionId };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
