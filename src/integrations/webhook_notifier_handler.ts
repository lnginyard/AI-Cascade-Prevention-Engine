import { EventBridgeEvent } from 'aws-lambda';

type WebhookEventDetail = Record<string, unknown>;

async function postWebhook(payload: unknown): Promise<void> {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook POST failed with status ${response.status}`);
  }
}

export async function handler(event: EventBridgeEvent<string, WebhookEventDetail>): Promise<void> {
  const enabled = process.env.WEBHOOK_ENABLED === 'true';
  if (!enabled) {
    return;
  }

  const payload = {
    source: event.source,
    detailType: event['detail-type'],
    time: event.time,
    detail: event.detail,
    id: event.id,
    region: event.region,
  };

  await postWebhook(payload);
}
