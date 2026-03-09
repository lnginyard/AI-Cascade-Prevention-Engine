import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';

export interface PlaybookMappingsProps {
  readonly tableName?: string;
  readonly eventBusName?: string;
}

export class PlaybookMappings extends Construct {
  public readonly table: dynamodb.Table;
  public readonly eventBus: events.EventBus;
  public readonly rule: events.Rule;

  constructor(scope: Construct, id: string, props?: PlaybookMappingsProps) {
    super(scope, id);

    this.table = new dynamodb.Table(this, 'PlaybookMappingsTable', {
      partitionKey: { name: 'mappingId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: props?.tableName,
    });

    this.eventBus = new events.EventBus(this, 'CascadeEventBus', {
      eventBusName: props?.eventBusName || 'CascadeEventBus',
    });

    // Example rule: matches cascade prevention alerts and playbook requests
    this.rule = new events.Rule(this, 'PlaybookTriggerRule', {
      eventBus: this.eventBus,
      eventPattern: {
        source: ['cascade.prevention'],
        detailType: ['PlaybookRequest', 'TelemetryAlert'],
      },
      description: 'Matches cascade-related playbook requests and telemetry alerts',
    });
  }
}

export default PlaybookMappings;
