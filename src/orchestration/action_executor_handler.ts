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

type ExecutionResult = {
  ok: false;
  status: 'NOT_IMPLEMENTED';
  actionId: string;
  reason: string;
};

/**
 * Safety boundary: this handler records that an action is unsupported.
 * It deliberately performs no AWS resource mutation and must never report
 * SUCCESS until a real, tested, least-privilege action adapter exists.
 */
export async function handler(input: ExecutionInput): Promise<ExecutionResult> {
  const reason = `No live remediation adapter is implemented for action kind "${input.action.kind}".`;
  const eventBusName = process.env.EVENT_BUS_NAME;

  if (eventBusName) {
    const response = await eventBridge.send(new PutEventsCommand({
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
            status: 'NOT_IMPLEMENTED',
            reason,
          }),
        },
      ],
    }));

    if ((response.FailedEntryCount || 0) > 0) {
      throw new Error('Failed to publish remediation NOT_IMPLEMENTED status event');
    }
  }

  return {
    ok: false,
    status: 'NOT_IMPLEMENTED',
    actionId: input.action.actionId,
    reason,
  };
}
