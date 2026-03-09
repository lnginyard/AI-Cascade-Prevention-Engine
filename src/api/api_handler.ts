import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const region = process.env.AWS_REGION || 'us-east-1';
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const eventBridge = new EventBridgeClient({ region });

function json(statusCode: number, payload: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

async function getDependencyGraph(): Promise<APIGatewayProxyResult> {
  const tableName = process.env.DEPENDENCY_GRAPH_TABLE;
  if (!tableName) return json(500, { message: 'DEPENDENCY_GRAPH_TABLE is not configured' });

  const result = await dynamo.send(new ScanCommand({
    TableName: tableName,
    Limit: 100,
  }));

  return json(200, { items: result.Items || [] });
}

async function getActiveSignatures(): Promise<APIGatewayProxyResult> {
  const tableName = process.env.SIGNATURES_TABLE_NAME;
  if (!tableName) return json(500, { message: 'SIGNATURES_TABLE_NAME is not configured' });

  const result = await dynamo.send(new ScanCommand({
    TableName: tableName,
    FilterExpression: '#status = :status',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': 'ACTIVE' },
    Limit: 100,
  }));

  return json(200, { items: result.Items || [] });
}

async function getRemediationPlans(): Promise<APIGatewayProxyResult> {
  const tableName = process.env.REMEDIATION_PLANS_TABLE;
  if (!tableName) return json(200, { items: [] });

  const result = await dynamo.send(new ScanCommand({
    TableName: tableName,
    Limit: 100,
  }));

  return json(200, { items: result.Items || [] });
}

async function approveRemediationPlan(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tableName = process.env.REMEDIATION_PLANS_TABLE;
  const eventBusName = process.env.EVENT_BUS_NAME;
  if (!tableName) return json(500, { message: 'REMEDIATION_PLANS_TABLE is not configured' });

  const planId = event.pathParameters?.planId;
  if (!planId) return json(400, { message: 'Missing planId path parameter' });

  const parsedBody = event.body ? JSON.parse(event.body) : {};
  const approved = parsedBody.approved === true;
  const reviewer = parsedBody.reviewer || 'unknown';
  const reason = parsedBody.reason || null;

  const existing = await dynamo.send(new GetCommand({
    TableName: tableName,
    Key: { planId },
  }));

  if (!existing.Item) {
    return json(404, { message: `Remediation plan ${planId} was not found` });
  }

  const updated = {
    ...existing.Item,
    status: approved ? 'APPROVED' : 'REJECTED',
    approval: {
      approved,
      reviewer,
      reason,
      at: new Date().toISOString(),
    },
  };

  await dynamo.send(new PutCommand({
    TableName: tableName,
    Item: updated,
  }));

  if (eventBusName) {
    await eventBridge.send(new PutEventsCommand({
      Entries: [
        {
          Source: 'cascade-prevention.remediation',
          DetailType: 'RemediationActionRecorded',
          EventBusName: eventBusName,
          Time: new Date(),
          Detail: JSON.stringify({
            planId,
            approved,
            reviewer,
            reason,
            status: updated.status,
            at: updated.approval.at,
          }),
        }
      ],
    }));
  }

  return json(200, updated);
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const rawPath = event.path;
  const path = rawPath.replace(/^\/v1/, '');

  if (method === 'GET' && path === '/dependency-graph') return getDependencyGraph();
  if (method === 'GET' && path === '/cascade-signatures/active') return getActiveSignatures();
  if (method === 'GET' && path === '/remediation-plans') return getRemediationPlans();
  if (method === 'POST' && /^\/remediation-plans\/[^/]+\/approval$/.test(path)) {
    return approveRemediationPlan(event);
  }

  return json(404, { message: 'Route not found' });
}
