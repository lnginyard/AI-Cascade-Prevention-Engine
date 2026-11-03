jest.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: jest.fn().mockImplementation(() => ({ send: jest.fn().mockResolvedValue({ FailedEntryCount: 0 }) })),
  PutEventsCommand: jest.fn().mockImplementation((input) => input),
}));

describe('action_executor_handler safety boundary', () => {
  beforeEach(() => {
    delete process.env.EVENT_BUS_NAME;
    jest.resetModules();
  });

  it('never reports success for an unsupported action', async () => {
    const { handler } = await import('./action_executor_handler');

    await expect(handler({
      planId: 'plan-1',
      signatureId: 'sig-1',
      mode: 'execute',
      action: {
        actionId: 'action-1',
        kind: 'circuit_break',
        targetService: 'payments',
      },
    })).resolves.toMatchObject({
      ok: false,
      status: 'NOT_IMPLEMENTED',
      actionId: 'action-1',
    });
  });

  it('records NOT_IMPLEMENTED rather than SUCCESS when an event bus is configured', async () => {
    process.env.EVENT_BUS_NAME = 'test-bus';
    const { handler } = await import('./action_executor_handler');
    const { EventBridgeClient } = await import('@aws-sdk/client-eventbridge');
    const send = (EventBridgeClient as jest.Mock).mock.results[0].value.send;

    await handler({
      planId: 'plan-2',
      signatureId: 'sig-2',
      mode: 'rollback',
      action: {
        actionId: 'action-2',
        kind: 'restore_traffic',
        targetService: 'checkout',
      },
    });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      Entries: [expect.objectContaining({
        Detail: expect.stringContaining('"status":"NOT_IMPLEMENTED"'),
      })],
    }));
  });
});
