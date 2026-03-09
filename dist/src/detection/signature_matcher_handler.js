"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const client_eventbridge_1 = require("@aws-sdk/client-eventbridge");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const client_sns_1 = require("@aws-sdk/client-sns");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const signature_detector_1 = require("./signature_detector");
const region = process.env.AWS_REGION || 'us-east-1';
const eventBridge = new client_eventbridge_1.EventBridgeClient({ region });
const sns = new client_sns_1.SNSClient({ region });
const dynamo = lib_dynamodb_1.DynamoDBDocumentClient.from(new client_dynamodb_1.DynamoDBClient({ region }));
async function handler(event) {
    const tableName = process.env.SIGNATURES_TABLE_NAME;
    const eventBusName = process.env.EVENT_BUS_NAME;
    if (!tableName || !eventBusName) {
        return;
    }
    const anomalies = event.detail?.anomalies || [];
    const signature = (0, signature_detector_1.detectCascadeSignature)(anomalies);
    if (!signature) {
        return;
    }
    await dynamo.send(new lib_dynamodb_1.PutCommand({
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
    await eventBridge.send(new client_eventbridge_1.PutEventsCommand({
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
        await sns.send(new client_sns_1.PublishCommand({
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2lnbmF0dXJlX21hdGNoZXJfaGFuZGxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9kZXRlY3Rpb24vc2lnbmF0dXJlX21hdGNoZXJfaGFuZGxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWdCQSwwQkFtRUM7QUFsRkQsb0VBQWtGO0FBQ2xGLDhEQUEwRDtBQUMxRCxvREFBZ0U7QUFDaEUsd0RBQTJFO0FBQzNFLDZEQUE2RTtBQU03RSxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsSUFBSSxXQUFXLENBQUM7QUFDckQsTUFBTSxXQUFXLEdBQUcsSUFBSSxzQ0FBaUIsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDdEQsTUFBTSxHQUFHLEdBQUcsSUFBSSxzQkFBUyxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztBQUN0QyxNQUFNLE1BQU0sR0FBRyxxQ0FBc0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxnQ0FBYyxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBRXBFLEtBQUssVUFBVSxPQUFPLENBQUMsS0FBOEQ7SUFDMUYsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQztJQUNwRCxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQztJQUNoRCxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDaEMsT0FBTztJQUNULENBQUM7SUFFRCxNQUFNLFNBQVMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLFNBQVMsSUFBSSxFQUFFLENBQUM7SUFDaEQsTUFBTSxTQUFTLEdBQUcsSUFBQSwyQ0FBc0IsRUFBQyxTQUFTLENBQUMsQ0FBQztJQUNwRCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDZixPQUFPO0lBQ1QsQ0FBQztJQUVELE1BQU0sTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLHlCQUFVLENBQUM7UUFDL0IsU0FBUyxFQUFFLFNBQVM7UUFDcEIsSUFBSSxFQUFFO1lBQ0osV0FBVyxFQUFFLFNBQVMsQ0FBQyxXQUFXO1lBQ2xDLGVBQWUsRUFBRSxTQUFTLENBQUMsZUFBZTtZQUMxQyxVQUFVLEVBQUUsU0FBUyxDQUFDLFVBQVU7WUFDaEMsYUFBYSxFQUFFLFNBQVMsQ0FBQyxhQUFhO1lBQ3RDLGVBQWUsRUFBRSxTQUFTLENBQUMsZUFBZTtZQUMxQyxnQkFBZ0IsRUFBRSxTQUFTLENBQUMsZ0JBQWdCO1lBQzVDLFFBQVEsRUFBRSxTQUFTLENBQUMsUUFBUTtZQUM1QixNQUFNLEVBQUUsUUFBUTtZQUNoQixHQUFHLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxJQUFJO1NBQ25EO0tBQ0YsQ0FBQyxDQUFDLENBQUM7SUFFSixNQUFNLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxxQ0FBZ0IsQ0FBQztRQUMxQyxPQUFPLEVBQUU7WUFDUDtnQkFDRSxNQUFNLEVBQUUsOEJBQThCO2dCQUN0QyxVQUFVLEVBQUUsMEJBQTBCO2dCQUN0QyxZQUFZLEVBQUUsWUFBWTtnQkFDMUIsSUFBSSxFQUFFLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUM7Z0JBQ3BDLE1BQU0sRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQzthQUNsQztZQUNEO2dCQUNFLE1BQU0sRUFBRSwrQkFBK0I7Z0JBQ3ZDLFVBQVUsRUFBRSxzQkFBc0I7Z0JBQ2xDLFlBQVksRUFBRSxZQUFZO2dCQUMxQixJQUFJLEVBQUUsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQztnQkFDcEMsTUFBTSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7b0JBQ3JCLFlBQVksRUFBRSxRQUFRLFNBQVMsQ0FBQyxXQUFXLEVBQUU7b0JBQzdDLFdBQVcsRUFBRSxTQUFTLENBQUMsV0FBVztvQkFDbEMsb0JBQW9CLEVBQUUsU0FBUyxDQUFDLGdCQUFnQjtvQkFDaEQsZUFBZSxFQUFFLFNBQVMsQ0FBQyxlQUFlO29CQUMxQyxTQUFTLEVBQUUsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLFdBQVcsRUFBRTtpQkFDeEQsQ0FBQzthQUNIO1NBQ0Y7S0FDRixDQUFDLENBQUMsQ0FBQztJQUVKLE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDO0lBQ2xELElBQUksYUFBYSxJQUFJLFNBQVMsQ0FBQyxlQUFlLElBQUksR0FBRyxFQUFFLENBQUM7UUFDdEQsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksMkJBQWMsQ0FBQztZQUNoQyxRQUFRLEVBQUUsYUFBYTtZQUN2QixPQUFPLEVBQUUscUJBQXFCLFNBQVMsQ0FBQyxhQUFhLEVBQUU7WUFDdkQsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ3RCLFFBQVEsRUFBRSxTQUFTLENBQUMsZUFBZSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxTQUFTO2dCQUNuRSxXQUFXLEVBQUUsU0FBUyxDQUFDLFdBQVc7Z0JBQ2xDLGVBQWUsRUFBRSxTQUFTLENBQUMsZUFBZTtnQkFDMUMsZ0JBQWdCLEVBQUUsU0FBUyxDQUFDLGdCQUFnQjtnQkFDNUMsZUFBZSxFQUFFLFNBQVMsQ0FBQyxlQUFlO2FBQzNDLENBQUM7U0FDSCxDQUFDLENBQUMsQ0FBQztJQUNOLENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRCcmlkZ2VFdmVudCB9IGZyb20gJ2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgUHV0RXZlbnRzQ29tbWFuZCwgRXZlbnRCcmlkZ2VDbGllbnQgfSBmcm9tICdAYXdzLXNkay9jbGllbnQtZXZlbnRicmlkZ2UnO1xuaW1wb3J0IHsgRHluYW1vREJDbGllbnQgfSBmcm9tICdAYXdzLXNkay9jbGllbnQtZHluYW1vZGInO1xuaW1wb3J0IHsgUHVibGlzaENvbW1hbmQsIFNOU0NsaWVudCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1zbnMnO1xuaW1wb3J0IHsgRHluYW1vREJEb2N1bWVudENsaWVudCwgUHV0Q29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2xpYi1keW5hbW9kYic7XG5pbXBvcnQgeyBBbm9tYWx5U2lnbmFsLCBkZXRlY3RDYXNjYWRlU2lnbmF0dXJlIH0gZnJvbSAnLi9zaWduYXR1cmVfZGV0ZWN0b3InO1xuXG50eXBlIEFub21hbHlFdmVudERldGFpbCA9IHtcbiAgYW5vbWFsaWVzOiBBbm9tYWx5U2lnbmFsW107XG59O1xuXG5jb25zdCByZWdpb24gPSBwcm9jZXNzLmVudi5BV1NfUkVHSU9OIHx8ICd1cy1lYXN0LTEnO1xuY29uc3QgZXZlbnRCcmlkZ2UgPSBuZXcgRXZlbnRCcmlkZ2VDbGllbnQoeyByZWdpb24gfSk7XG5jb25zdCBzbnMgPSBuZXcgU05TQ2xpZW50KHsgcmVnaW9uIH0pO1xuY29uc3QgZHluYW1vID0gRHluYW1vREJEb2N1bWVudENsaWVudC5mcm9tKG5ldyBEeW5hbW9EQkNsaWVudCh7IHJlZ2lvbiB9KSk7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBoYW5kbGVyKGV2ZW50OiBFdmVudEJyaWRnZUV2ZW50PCdBbm9tYWx5RGV0ZWN0ZWQnLCBBbm9tYWx5RXZlbnREZXRhaWw+KTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHRhYmxlTmFtZSA9IHByb2Nlc3MuZW52LlNJR05BVFVSRVNfVEFCTEVfTkFNRTtcbiAgY29uc3QgZXZlbnRCdXNOYW1lID0gcHJvY2Vzcy5lbnYuRVZFTlRfQlVTX05BTUU7XG4gIGlmICghdGFibGVOYW1lIHx8ICFldmVudEJ1c05hbWUpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBhbm9tYWxpZXMgPSBldmVudC5kZXRhaWw/LmFub21hbGllcyB8fCBbXTtcbiAgY29uc3Qgc2lnbmF0dXJlID0gZGV0ZWN0Q2FzY2FkZVNpZ25hdHVyZShhbm9tYWxpZXMpO1xuICBpZiAoIXNpZ25hdHVyZSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGF3YWl0IGR5bmFtby5zZW5kKG5ldyBQdXRDb21tYW5kKHtcbiAgICBUYWJsZU5hbWU6IHRhYmxlTmFtZSxcbiAgICBJdGVtOiB7XG4gICAgICBzaWduYXR1cmVJZDogc2lnbmF0dXJlLnNpZ25hdHVyZUlkLFxuICAgICAgb3JpZ2luU2VydmljZUlkOiBzaWduYXR1cmUub3JpZ2luU2VydmljZUlkLFxuICAgICAgZGV0ZWN0ZWRBdDogc2lnbmF0dXJlLmRldGVjdGVkQXQsXG4gICAgICBzaWduYXR1cmVUeXBlOiBzaWduYXR1cmUuc2lnbmF0dXJlVHlwZSxcbiAgICAgIGNvbmZpZGVuY2VTY29yZTogc2lnbmF0dXJlLmNvbmZpZGVuY2VTY29yZSxcbiAgICAgIGFmZmVjdGVkU2VydmljZXM6IHNpZ25hdHVyZS5hZmZlY3RlZFNlcnZpY2VzLFxuICAgICAgZXZpZGVuY2U6IHNpZ25hdHVyZS5ldmlkZW5jZSxcbiAgICAgIHN0YXR1czogJ0FDVElWRScsXG4gICAgICB0dGw6IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApICsgNyAqIDI0ICogMzYwMCxcbiAgICB9XG4gIH0pKTtcblxuICBhd2FpdCBldmVudEJyaWRnZS5zZW5kKG5ldyBQdXRFdmVudHNDb21tYW5kKHtcbiAgICBFbnRyaWVzOiBbXG4gICAgICB7XG4gICAgICAgIFNvdXJjZTogJ2Nhc2NhZGUtcHJldmVudGlvbi5zaWduYXR1cmUnLFxuICAgICAgICBEZXRhaWxUeXBlOiAnQ2FzY2FkZVNpZ25hdHVyZURldGVjdGVkJyxcbiAgICAgICAgRXZlbnRCdXNOYW1lOiBldmVudEJ1c05hbWUsXG4gICAgICAgIFRpbWU6IG5ldyBEYXRlKHNpZ25hdHVyZS5kZXRlY3RlZEF0KSxcbiAgICAgICAgRGV0YWlsOiBKU09OLnN0cmluZ2lmeShzaWduYXR1cmUpLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgU291cmNlOiAnY2FzY2FkZS1wcmV2ZW50aW9uLnByZWRpY3Rpb24nLFxuICAgICAgICBEZXRhaWxUeXBlOiAnQ2FzY2FkZVBhdGhQcmVkaWN0ZWQnLFxuICAgICAgICBFdmVudEJ1c05hbWU6IGV2ZW50QnVzTmFtZSxcbiAgICAgICAgVGltZTogbmV3IERhdGUoc2lnbmF0dXJlLmRldGVjdGVkQXQpLFxuICAgICAgICBEZXRhaWw6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBwcmVkaWN0aW9uSWQ6IGBwcmVkLSR7c2lnbmF0dXJlLnNpZ25hdHVyZUlkfWAsXG4gICAgICAgICAgc2lnbmF0dXJlSWQ6IHNpZ25hdHVyZS5zaWduYXR1cmVJZCxcbiAgICAgICAgICBwcmVkaWN0ZWRCbGFzdFJhZGl1czogc2lnbmF0dXJlLmFmZmVjdGVkU2VydmljZXMsXG4gICAgICAgICAgY29uZmlkZW5jZVNjb3JlOiBzaWduYXR1cmUuY29uZmlkZW5jZVNjb3JlLFxuICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoc2lnbmF0dXJlLmRldGVjdGVkQXQpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIH0pLFxuICAgICAgfVxuICAgIF1cbiAgfSkpO1xuXG4gIGNvbnN0IGFsZXJ0VG9waWNBcm4gPSBwcm9jZXNzLmVudi5BTEVSVF9UT1BJQ19BUk47XG4gIGlmIChhbGVydFRvcGljQXJuICYmIHNpZ25hdHVyZS5jb25maWRlbmNlU2NvcmUgPj0gMC44KSB7XG4gICAgYXdhaXQgc25zLnNlbmQobmV3IFB1Ymxpc2hDb21tYW5kKHtcbiAgICAgIFRvcGljQXJuOiBhbGVydFRvcGljQXJuLFxuICAgICAgU3ViamVjdDogYENhc2NhZGUgU2lnbmF0dXJlICR7c2lnbmF0dXJlLnNpZ25hdHVyZVR5cGV9YCxcbiAgICAgIE1lc3NhZ2U6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgc2V2ZXJpdHk6IHNpZ25hdHVyZS5jb25maWRlbmNlU2NvcmUgPj0gMC45ID8gJ0NSSVRJQ0FMJyA6ICdXQVJOSU5HJyxcbiAgICAgICAgc2lnbmF0dXJlSWQ6IHNpZ25hdHVyZS5zaWduYXR1cmVJZCxcbiAgICAgICAgb3JpZ2luU2VydmljZUlkOiBzaWduYXR1cmUub3JpZ2luU2VydmljZUlkLFxuICAgICAgICBhZmZlY3RlZFNlcnZpY2VzOiBzaWduYXR1cmUuYWZmZWN0ZWRTZXJ2aWNlcyxcbiAgICAgICAgY29uZmlkZW5jZVNjb3JlOiBzaWduYXR1cmUuY29uZmlkZW5jZVNjb3JlLFxuICAgICAgfSksXG4gICAgfSkpO1xuICB9XG59XG4iXX0=