import { EventBridgeEvent } from 'aws-lambda';

jest.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: jest.fn().mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}) })),
  PutEventsCommand: jest.fn().mockImplementation((input) => input),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}) })),
  },
  PutCommand: jest.fn().mockImplementation((input) => input),
}));

jest.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: jest.fn().mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}) })),
  StartExecutionCommand: jest.fn().mockImplementation((input) => input),
}));

describe('remediation_planner_handler', () => {
  it('creates remediation plan without throwing', async () => {
    process.env.REMEDIATION_PLANS_TABLE = 'plans';
    process.env.EVENT_BUS_NAME = 'bus';
    process.env.REMEDIATION_STATE_MACHINE_ARN = 'arn:aws:states:us-east-1:123:stateMachine:demo';

    const { handler } = await import('./remediation_planner_handler');

    const event = {
      detail: {
        predictionId: 'pred-1',
        signatureId: 'sig-1',
        predictedBlastRadius: ['svc-a', 'svc-b', 'svc-c'],
        confidenceScore: 0.91,
        createdAt: new Date().toISOString(),
      },
    } as EventBridgeEvent<'CascadePathPredicted', any>;

    await expect(handler(event)).resolves.toBeUndefined();
  });
});
