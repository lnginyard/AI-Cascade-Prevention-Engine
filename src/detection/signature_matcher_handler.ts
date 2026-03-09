import { EventBridgeEvent } from 'aws-lambda';
import { PutEventsCommand, EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { AnomalySignal, detectCascadeSignature } from './signature_detector';

type AnomalyEventDetail = {
  anomalies: AnomalySignal[];
};

const region = process.env.AWS_REGION || 'us-east-1';
const eventBridge = new EventBridgeClient({ region });
const sns = new SNSClient({ region });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

export async function handler(event: EventBridgeEvent<'AnomalyDetected', AnomalyEventDetail>): Promise<void> {
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

  await dynamo.send(new PutCommand({
    TableName: tableName,
    Item: {
      signatureId: signature.signatureId,
      originServiceId: signature.originServiceId,
      detectedAt: signature.detectedAt,
      signatureType: signature.signatureType,
      confidenceScore: signature.confidenceScore,
      affectedServices: signature.affectedServices,
      evidence: signature.evidence,
      status: 'ACTIVE',
      ttl: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    }
  }));

  await eventBridge.send(new PutEventsCommand({
    Entries: [
      {
        Source: 'cascade-prevention.signature',
        DetailType: 'CascadeSignatureDetected',
        EventBusName: eventBusName,
        Time: new Date(signature.detectedAt),
        Detail: JSON.stringify(signature),
      },
      {
        Source: 'cascade-prevention.prediction',
        DetailType: 'CascadePathPredicted',
        EventBusName: eventBusName,
        Time: new Date(signature.detectedAt),
        Detail: JSON.stringify({
          predictionId: `pred-${signature.signatureId}`,
          signatureId: signature.signatureId,
          predictedBlastRadius: signature.affectedServices,
          confidenceScore: signature.confidenceScore,
          createdAt: new Date(signature.detectedAt).toISOString(),
        }),
      }
    ]
  }));

  const alertTopicArn = process.env.ALERT_TOPIC_ARN;
  if (alertTopicArn && signature.confidenceScore >= 0.8) {
    await sns.send(new PublishCommand({
      TopicArn: alertTopicArn,
      Subject: `Cascade Signature ${signature.signatureType}`,
      Message: JSON.stringify({
        severity: signature.confidenceScore >= 0.9 ? 'CRITICAL' : 'WARNING',
        signatureId: signature.signatureId,
        originServiceId: signature.originServiceId,
        affectedServices: signature.affectedServices,
        confidenceScore: signature.confidenceScore,
      }),
    }));
  }
}
