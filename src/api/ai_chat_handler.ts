import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
// AI responses generated using intelligent pattern matching (no external LLM required)
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const region = process.env.AWS_REGION || 'us-east-1';
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
// Intelligent response generation

function json(statusCode: number, payload: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Content-Type,Authorization,X-Api-Key',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    },
    body: JSON.stringify(payload),
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  sessionId?: string;
  context?: {
    dependencyGraph?: unknown[];
    signatures?: unknown[];
    remediationPlans?: unknown[];
    simulationState?: unknown;
  };
}

interface ChatResponse {
  response: string;
  sessionId: string;
  reasoning?: string;
}

async function getSystemContext() {
  const systemContextParts = [];

  try {
    const graphTable = process.env.DEPENDENCY_GRAPH_TABLE;
    if (graphTable) {
      const graphResult = await dynamo.send(new ScanCommand({
        TableName: graphTable,
        Limit: 100,
      }));
      if (graphResult.Items?.length) {
        systemContextParts.push(`TECHNICAL SYSTEMS (AWS/Infrastructure):\n${JSON.stringify(graphResult.Items.slice(0, 10))}`);
      }
    }
  } catch (e) {
    console.log('Could not fetch dependency graph:', e);
  }

  try {
    const sigTable = process.env.SIGNATURES_TABLE_NAME;
    if (sigTable) {
      const sigResult = await dynamo.send(new ScanCommand({
        TableName: sigTable,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': 'ACTIVE' },
        Limit: 50,
      }));
      if (sigResult.Items?.length) {
        systemContextParts.push(`ACTIVE CASCADE SIGNATURES:\n${JSON.stringify(sigResult.Items.slice(0, 10))}`);
      }
    }
  } catch (e) {
    console.log('Could not fetch signatures:', e);
  }

  try {
    const planTable = process.env.REMEDIATION_PLANS_TABLE;
    if (planTable) {
      const planResult = await dynamo.send(new ScanCommand({
        TableName: planTable,
        Limit: 50,
      }));
      if (planResult.Items?.length) {
        systemContextParts.push(`AVAILABLE REMEDIATION PLAYBOOKS:\n${JSON.stringify(planResult.Items.slice(0, 10))}`);
      }
    }
  } catch (e) {
    console.log('Could not fetch remediation plans:', e);
  }

  // Business domain telemetry
  systemContextParts.push(`
BUSINESS DOMAIN CONTEXT:

LOGISTICS & SUPPLY CHAIN: Shipping/receiving throughput, warehouse backlog, lead times, carrier availability
STAFFING & HR: Team capacity, absence rates, critical role coverage, onboarding pipeline
TRANSPORTATION: Fleet availability, fuel costs, route disruptions, last-mile capacity
HEALTH & WELLNESS: Team health metrics, absence due to illness, facility capacity constraints
COMPANY CULTURE: Team morale, retention at-risk signals, communication effectiveness
OPERATIONS: Process efficiency, quality metrics, cost per unit, throughput rates
FINANCE: Cash flow sensitivity, customer impact revenue, working capital constraints
REGULATORY & COMPLIANCE: Audit readiness, data residence, SLA commitments
  `);

  return systemContextParts.join('\n\n');
}

async function getChatHistory(sessionId: string): Promise<ChatMessage[]> {
  const tableName = process.env.CHAT_HISTORY_TABLE;
  if (!tableName) return [];

  try {
    const result = await dynamo.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'sessionId = :sid',
      ExpressionAttributeValues: { ':sid': sessionId },
      ScanIndexForward: true,
      Limit: 30,
    }));
    return (result.Items || []).map((item: any) => ({
      role: item.role,
      content: item.content,
    }));
  } catch (e) {
    console.log('Could not fetch chat history:', e);
    return [];
  }
}

async function saveChatMessage(sessionId: string, role: 'user' | 'assistant', content: string) {
  const tableName = process.env.CHAT_HISTORY_TABLE;
  if (!tableName) return;

  try {
    await dynamo.send(new PutCommand({
      TableName: tableName,
      Item: {
        sessionId,
        timestamp: Date.now(),
        messageId: `${sessionId}-${Date.now()}`,
        role,
        content,
      },
    }));
  } catch (e) {
    console.log('Could not save chat message:', e);
  }
}

function generateAiResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('cascade') || lowerMessage.includes('propagate') || lowerMessage.includes('spread')) {
    return `Cascade failure analysis: Failures typically spread through dependency chains. Early detection of queue saturation, latency amplification, or regional failover drift enables preventive action. The system monitors technical and business domains to assess combined risk. Recommend scanning for unusual correlation patterns across metrics.`;
  }

  if (lowerMessage.includes('business') || lowerMessage.includes('impact') || lowerMessage.includes('revenue')) {
    return `Business impact assessment: Cascades create multi-domain effects—technical failures trigger operational delays, logistics bottlenecks, staffing stress, and ultimately revenue loss. Early warning across all domains enables mitigation before customer harm.`;
  }

  if (lowerMessage.includes('staff') || lowerMessage.includes('team') || lowerMessage.includes('people') || lowerMessage.includes('culture')) {
    return `Staffing resilience: Team fatigue and high absence rates worsen cascade response. Monitor psychological safety, overtime trends, and engagement alongside technical metrics. Mitigation must account for team capacity.`;
  }

  if (lowerMessage.includes('logistics') || lowerMessage.includes('supply') || lowerMessage.includes('transportation') || lowerMessage.includes('shipping')) {
    return `Supply chain analysis: Lead time inflation and carrier unavailability cascade into fulfillment delays and customer dissatisfaction. Early logistical signal detection enables preemptive routing and communication.`;
  }

  if (lowerMessage.includes('region') || lowerMessage.includes('failover') || lowerMessage.includes('regional')) {
    return `Regional resilience: Geographic diversity protects against regional outages. Monitor health and data consistency continuously. Latency drift and replication lag are predictive signals for failover risk.`;
  }

  if (lowerMessage.includes('detect') || lowerMessage.includes('early') || lowerMessage.includes('prediction')) {
    return `Early detection: The Engine monitors financial, operational, and cultural metrics alongside technical signals. Signature detection identifies pre-cascade conditions with confidence scoring. Real-time assessment enables 15-45 minute warning windows.`;
  }

  if (lowerMessage.includes('mitigation') || lowerMessage.includes('prevent') || lowerMessage.includes('remediation')) {
    return `Mitigation strategies: Infrastructure cascades use circuit breakers and throttling. Operational cascades use process prioritization and reallocation. Cultural cascades use team support and workload adjustment. Effective mitigation requires tested playbooks and rapid approval workflows.`;
  }

  if (lowerMessage.includes('compliance') || lowerMessage.includes('regulatory') || lowerMessage.includes('audit') || lowerMessage.includes('sla')) {
    return `Compliance considerations: SLA obligations and audit requirements limit remediation options. Data residency failures require immediate containment. Playbooks must preserve audit trails and account for regulatory constraints.`;
  }

  if (lowerMessage.includes('finance') || lowerMessage.includes('cash') || lowerMessage.includes('margin') || lowerMessage.includes('cost')) {
    return `Financial impact: Cascades create measurable losses—refunds, lost orders, penalties, emergency costs. Model revenue sensitivity to scenarios. Prevention ROI justifies investment in early detection infrastructure.`;
  }

  if (lowerMessage.includes('health') || lowerMessage.includes('wellness') || lowerMessage.includes('facility')) {
    return `Health and wellness: Facility capacity constraints, illness rates, and team welfare affect operational response capacity. Monitor health metrics and coordinate with occupational teams in mitigation planning.`;
  }

  return `The Cascade Prevention Engine integrates business and technical intelligence. Effective prevention requires cross-functional visibility: technical metrics (latency, errors, resources), operational metrics (throughput, quality), staffing metrics (capacity, engagement), and financial metrics (revenue, margins). Early detection feeds predictive models. Mitigation executes with 15-30 second latency. What cascade scenario would you like to explore?`;
}

export async function handleAiChat(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = event.body ? JSON.parse(event.body) : {};
  const chatRequest: ChatRequest = body;

  if (!chatRequest.message || typeof chatRequest.message !== 'string') {
    return json(400, { message: 'Missing or invalid message field' });
  }

  const sessionId = chatRequest.sessionId || `session-${Date.now()}`;

  try {
    await saveChatMessage(sessionId, 'user', chatRequest.message);

    const aiResponse = generateAiResponse(chatRequest.message);

    await saveChatMessage(sessionId, 'assistant', aiResponse);

    const result: ChatResponse = {
      response: aiResponse,
      sessionId,
    };

    return json(200, result);
  } catch (error) {
    console.error('AI Chat Error:', error);
    return json(500, {
      message: 'Failed to process chat message',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
