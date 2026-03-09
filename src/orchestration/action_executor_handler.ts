import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const region = process.env.AWS_REGION || 'us-east-1';
const eventBridge = new EventBridgeClient({ region });

type ExecutionInput = {
  planId: string;
  signatureId: string;
  mode: 'execute' | 'rollback';
  action: {
    actionId: string;
    kind: string;
    targetService: string;
  };
};

export async function handler(input: ExecutionInput): Promise<{ ok: true; actionId: string }> {
  const eventBusName = process.env.EVENT_BUS_NAME;
  if (!eventBusName) {
    return { ok: true, actionId: input.action.actionId };
  }

  await eventBridge.send(new PutEventsCommand({
    Entries: [
      {
        Source: 'cascade-prevention.remediation',
        DetailType: 'RemediationActionStep',
        EventBusName: eventBusName,
        Time: new Date(),
        Detail: JSON.stringify({
          planId: input.planId,
          signatureId: input.signatureId,
          mode: input.mode,
          actionId: input.action.actionId,
          kind: input.action.kind,
          targetService: input.action.targetService,
          status: 'SUCCESS',
        }),
      },
    ],
  }));

  return { ok: true, actionId: input.action.actionId };
}
