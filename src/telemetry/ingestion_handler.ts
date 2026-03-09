import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { routeEvent, TelemetryEvent } from './sample_ingest';

function response(statusCode: number, payload: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return response(400, { ok: false, message: 'Missing request body' });
  }

  let parsed: TelemetryEvent;

  try {
    parsed = JSON.parse(event.body) as TelemetryEvent;
  } catch {
    return response(400, { ok: false, message: 'Invalid JSON body' });
  }

  const result = await routeEvent(parsed);
  if (!result.ok) {
    return response(400, result);
  }

  return response(200, result);
}
