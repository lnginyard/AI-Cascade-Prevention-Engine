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

function splitQuestions(message: string): string[] {
  return message.split(/\n+|(?<=[?])\s+/).map((part) => part.trim()).filter(Boolean).slice(0, 8);
}

function answerQuestion(question: string): string {
  const lowerMessage = question.toLowerCase();

  if (/\b(hello|hi|hey|help|what can you do)\b/.test(lowerMessage)) {
    return 'I can help with this dashboard, cascade prevention, engineering, operations, business planning, security, compliance, people, finance, and general decision-making. I can also answer several questions in one message.';
  }
  if (/\b(cascade|propagate|spread|blast radius|dependency)\b/.test(lowerMessage)) {
    return 'Cascade analysis: identify the origin service, inspect queue depth, latency, errors, retries, and saturation, then trace dependent services outward. Contain the highest-risk edge first, preserve rollback, and use advisory mode before approving circuit breaking or traffic shaping.';
  }
  if (/\b(business|impact|revenue|customer|profit|roi|cost)\b/.test(lowerMessage)) {
    return 'Business analysis: connect the signal to customer journeys, transaction volume, revenue exposure, SLA commitments, staffing capacity, and operational queues. Compare the cost of containment, delay, and customer harm before choosing a response.';
  }
  if (/\b(region|regional|failover|disaster|outage|availability|recovery|backup)\b/.test(lowerMessage)) {
    return 'Resilience guidance: compare health, latency, replication lag, capacity, and data consistency across regions. Test failover and rollback with representative traffic, define recovery objectives, and keep high-impact actions advisory until evidence is clear.';
  }
  if (/\b(mitigat|prevent|remediat|fix|solve|reduce risk|protect)\b/.test(lowerMessage)) {
    return 'Mitigation guidance: start with the least disruptive reversible control, such as rate limiting, queue isolation, or workload prioritization. Require approval for high-risk changes, verify expected metric movement, and record the decision and rollback condition.';
  }
  if (/\b(compliance|regulat|audit|privacy|gdpr|hipaa|soc ?2|policy|sla)\b/.test(lowerMessage)) {
    return 'Governance guidance: preserve an immutable decision trail, document the policy and approver, minimize sensitive data, respect residency and retention requirements, and verify that the response does not violate an SLA or control boundary.';
  }
  if (/\b(code|program|software|api|database|aws|cloud|deploy|test|bug|debug|technical)\b/.test(lowerMessage)) {
    return 'Technical guidance: define expected behavior, isolate the smallest reproducible case, inspect logs and metrics for the same time window, make one reversible change, and validate it with a focused test before rollout. Include timeout, retry, authentication, and failure-path behavior.';
  }
  if (/\b(team|staff|people|employee|hiring|leadership|culture|workload|project)\b/.test(lowerMessage)) {
    return 'People and operations guidance: clarify ownership, capacity, decision rights, and the next measurable outcome. Avoid shifting critical work to an overloaded team; use an escalation path and communicate tradeoffs to stakeholders.';
  }
  if (/\b(logistics|supply|transport|shipping|inventory|warehouse|vendor)\b/.test(lowerMessage)) {
    return 'Operations guidance: monitor lead time, throughput, backlog, carrier or vendor availability, and customer priority together. Protect constrained capacity for the highest-value commitments and establish a fallback route.';
  }
  if (/\b(question|why|how|what|when|where|should|can|could|would)\b/.test(lowerMessage)) {
    return 'A practical way to answer this is to clarify the desired outcome, constraints, evidence, and acceptable risk. Compare two or three options, choose a reversible next step, define a success measure, and review the result before committing further.';
  }
  return 'I need more context to make a specific claim. Share the goal, current situation, constraints, stakeholders, and desired outcome; I can turn that into options, risks, and next steps.';
}

function generateAiResponse(userMessage: string): string {
  const questions = splitQuestions(userMessage);
  return questions.length === 1
    ? answerQuestion(questions[0])
    : questions.map((question, index) => `${index + 1}. ${answerQuestion(question)}`).join('\n\n');
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
