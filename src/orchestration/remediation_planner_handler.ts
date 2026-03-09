import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { randomUUID } from 'crypto';

type PredictionDetail = {
  predictionId: string;
  signatureId: string;
  predictedBlastRadius: string[];
  confidenceScore: number;
  createdAt: string;
};

type RemediationAction = {
  actionId: string;
  kind: 'circuit_break' | 'rate_limit' | 'traffic_shift';
  targetService: string;
  priority: number;
  rollback: {
    kind: 'restore_traffic' | 'remove_rate_limit' | 'close_circuit_break';
    targetService: string;
  };
};

type RemediationPlan = {
  planId: string;
  signatureId: string;
  predictionId: string;
  status: 'PENDING_APPROVAL' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  generatedAt: string;
  confidenceScore: number;
  blastRadius: string[];
  actions: RemediationAction[];
  alternatives: Array<{ strategy: string; actions: string[] }>;
};

const region = process.env.AWS_REGION || 'us-east-1';
const eventBridge = new EventBridgeClient({ region });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const sfn = new SFNClient({ region });

function buildPlan(detail: PredictionDetail): RemediationPlan {
  const generatedAt = new Date().toISOString();
  const topTargets = detail.predictedBlastRadius.slice(0, 3);

  const actions: RemediationAction[] = [
    {
      actionId: randomUUID(),
      kind: 'circuit_break',
      targetService: topTargets[0] || 'unknown-service',
      priority: 1,
      rollback: {
        kind: 'close_circuit_break',
        targetService: topTargets[0] || 'unknown-service',
      },
    },
    {
      actionId: randomUUID(),
      kind: 'rate_limit',
      targetService: topTargets[1] || topTargets[0] || 'unknown-service',
      priority: 2,
      rollback: {
        kind: 'remove_rate_limit',
        targetService: topTargets[1] || topTargets[0] || 'unknown-service',
      },
    },
    {
      actionId: randomUUID(),
      kind: 'traffic_shift',
      targetService: topTargets[2] || topTargets[1] || topTargets[0] || 'unknown-service',
      priority: 3,
      rollback: {
        kind: 'restore_traffic',
        targetService: topTargets[2] || topTargets[1] || topTargets[0] || 'unknown-service',
      },
    },
  ];

  return {
    planId: `plan-${randomUUID()}`,
    signatureId: detail.signatureId,
    predictionId: detail.predictionId,
    status: 'PENDING_APPROVAL',
    generatedAt,
    confidenceScore: detail.confidenceScore,
    blastRadius: detail.predictedBlastRadius,
    actions,
    alternatives: [
      {
        strategy: 'conservative',
        actions: ['rate_limit', 'traffic_shift'],
      },
      {
        strategy: 'aggressive',
        actions: ['circuit_break', 'rate_limit', 'traffic_shift'],
      },
    ],
  };
}

async function emitPlanGenerated(plan: RemediationPlan, eventBusName: string): Promise<void> {
  await eventBridge.send(new PutEventsCommand({
    Entries: [
      {
        Source: 'cascade-prevention.remediation',
        DetailType: 'RemediationPlanGenerated',
        EventBusName: eventBusName,
        Time: new Date(plan.generatedAt),
        Detail: JSON.stringify({
          planId: plan.planId,
          signatureId: plan.signatureId,
          predictionId: plan.predictionId,
          actionCount: plan.actions.length,
          confidenceScore: plan.confidenceScore,
        }),
      },
    ],
  }));
}

export async function handler(event: EventBridgeEvent<'CascadePathPredicted', PredictionDetail>): Promise<void> {
  const tableName = process.env.REMEDIATION_PLANS_TABLE;
  const eventBusName = process.env.EVENT_BUS_NAME;
  const stateMachineArn = process.env.REMEDIATION_STATE_MACHINE_ARN;

  if (!tableName || !eventBusName) {
    return;
  }

  const plan = buildPlan(event.detail);

  await dynamo.send(new PutCommand({
    TableName: tableName,
    Item: plan,
  }));

  await emitPlanGenerated(plan, eventBusName);

  if (stateMachineArn && plan.actions.length >= 3) {
    await sfn.send(new StartExecutionCommand({
      stateMachineArn,
      input: JSON.stringify({
        planId: plan.planId,
        signatureId: plan.signatureId,
        actions: plan.actions,
        rollbackActions: [...plan.actions].reverse().map((action) => ({
          actionId: `${action.actionId}-rollback`,
          kind: action.rollback.kind,
          targetService: action.rollback.targetService,
        })),
      }),
    }));
  }
}
