import { EventBridgeEvent } from 'aws-lambda';

type WebhookEventDetail = Record<string, unknown>;

async function postJson(url: string | undefined, payload: unknown, channel: string): Promise<void> {
  if (!url) {
    return;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`${channel} webhook POST failed with status ${response.status}`);
  }
}

function toSummary(event: EventBridgeEvent<string, WebhookEventDetail>): string {
  const detail = event.detail || {};
  const signatureId = String(detail['signatureId'] || detail['id'] || 'n/a');
  const severity = String(detail['severity'] || detail['riskLevel'] || 'INFO').toUpperCase();
  return `[${severity}] ${event['detail-type']} (${signatureId})`;
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

  const summary = toSummary(event);
  const dashboardUrl = process.env.OPERATIONS_CONSOLE_URL || 'https://aicpe.dev';

  const slackPayload = {
    text: `${summary}\nSource: ${event.source}\nTime: ${event.time}\nDashboard: ${dashboardUrl}`,
  };

  const teamsPayload = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary,
    themeColor: 'E81123',
    title: 'Cascade Prevention Alert',
    sections: [
      {
        activityTitle: summary,
        facts: [
          { name: 'Source', value: event.source },
          { name: 'DetailType', value: event['detail-type'] },
          { name: 'Time', value: event.time },
          { name: 'Region', value: event.region },
          { name: 'Dashboard', value: dashboardUrl },
        ],
      },
    ],
  };

  const statuspagePayload = {
    event: 'cascade_prevention_alert',
    summary,
    source: event.source,
    detailType: event['detail-type'],
    time: event.time,
    detail: event.detail,
    region: event.region,
  };

  await Promise.all([
    postJson(process.env.WEBHOOK_URL, payload, 'Generic'),
    postJson(process.env.SLACK_WEBHOOK_URL, slackPayload, 'Slack'),
    postJson(process.env.TEAMS_WEBHOOK_URL, teamsPayload, 'Teams'),
    postJson(process.env.STATUSPAGE_WEBHOOK_URL, statuspagePayload, 'Statuspage'),
  ]);
}
