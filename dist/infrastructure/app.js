"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const cdk = __importStar(require("aws-cdk-lib"));
const cloudformation_include_1 = require("aws-cdk-lib/cloudformation-include");
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const sfn = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const sfnTasks = __importStar(require("aws-cdk-lib/aws-stepfunctions-tasks"));
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
const path = __importStar(require("path"));
const playbook_mappings_construct_1 = require("../lib/playbook-mappings-construct");
const app = new cdk.App({ analyticsReporting: false });
const stack = new cdk.Stack(app, 'CascadePreventionStack');
const configuredWebhookUrl = app.node.tryGetContext('webhookUrl');
const webhookUrl = configuredWebhookUrl ?? '';
const webhookEnabled = configuredWebhookUrl ? 'true' : 'false';
const included = new cloudformation_include_1.CfnInclude(stack, 'CascadePreventionTemplate', {
    templateFile: 'cfn-template.yaml',
});
const playbookMappings = new playbook_mappings_construct_1.PlaybookMappings(stack, 'PlaybookMappings', {
    tableName: 'CascadePrevention-PlaybookMappings',
    eventBusName: 'CascadePrevention-PlaybookEventBus',
});
const telemetryBucket = included.getResource('TelemetryBucket710FF2C8');
const telemetryCacheTable = included.getResource('TelemetryCacheD29A0395');
const dependencyGraphTable = included.getResource('DependencyGraph3324833E');
const signaturesTable = included.getResource('SignaturesTable79733A9C');
const eventBus = included.getResource('EventBus7B8748AA');
const remediationPlansTable = new dynamodb.Table(stack, 'RemediationPlansTable', {
    tableName: 'CascadePrevention-RemediationPlans',
    partitionKey: { name: 'planId', type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
    },
    encryption: dynamodb.TableEncryption.AWS_MANAGED,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
});
const cascadeAlertsTopic = new sns.Topic(stack, 'CascadeAlertsTopic', {
    displayName: 'Cascade Prevention Alerts',
});
const telemetryIngestFunction = new aws_lambda_nodejs_1.NodejsFunction(stack, 'TelemetryIngestFunction', {
    runtime: lambda.Runtime.NODEJS_18_X,
    entry: path.join(__dirname, '../src/telemetry/ingestion_handler.ts'),
    handler: 'handler',
    timeout: cdk.Duration.seconds(30),
    memorySize: 256,
    environment: {
        TELEMETRY_BUCKET: telemetryBucket.ref,
        EVENT_BUS_NAME: eventBus.ref,
        TELEMETRY_CACHE_TABLE: telemetryCacheTable.ref,
    },
});
telemetryIngestFunction.addToRolePolicy(new iam.PolicyStatement({
    actions: ['s3:PutObject'],
    resources: [`${telemetryBucket.attrArn}/*`],
}));
telemetryIngestFunction.addToRolePolicy(new iam.PolicyStatement({
    actions: ['events:PutEvents'],
    resources: [eventBus.getAtt('Arn').toString()],
}));
telemetryIngestFunction.addToRolePolicy(new iam.PolicyStatement({
    actions: ['dynamodb:PutItem'],
    resources: [telemetryCacheTable.attrArn],
}));
const signatureMatcherV2Function = new aws_lambda_nodejs_1.NodejsFunction(stack, 'SignatureMatcherV2Function', {
    runtime: lambda.Runtime.NODEJS_18_X,
    entry: path.join(__dirname, '../src/detection/signature_matcher_handler.ts'),
    handler: 'handler',
    timeout: cdk.Duration.seconds(30),
    memorySize: 256,
    environment: {
        SIGNATURES_TABLE_NAME: signaturesTable.ref,
        EVENT_BUS_NAME: eventBus.ref,
        ALERT_TOPIC_ARN: cascadeAlertsTopic.topicArn,
    },
});
signatureMatcherV2Function.addToRolePolicy(new iam.PolicyStatement({
    actions: ['dynamodb:PutItem'],
    resources: [signaturesTable.attrArn],
}));
signatureMatcherV2Function.addToRolePolicy(new iam.PolicyStatement({
    actions: ['events:PutEvents'],
    resources: [eventBus.getAtt('Arn').toString()],
}));
cascadeAlertsTopic.grantPublish(signatureMatcherV2Function);
const anomalyToSignatureV2Rule = new events.Rule(stack, 'AnomalyToSignatureV2Rule', {
    eventPattern: {
        source: ['cascade-prevention.anomaly'],
        detailType: ['AnomalyDetected'],
    },
    eventBus: events.EventBus.fromEventBusName(stack, 'ImportedCascadeEventBus', eventBus.ref),
});
anomalyToSignatureV2Rule.addTarget(new targets.LambdaFunction(signatureMatcherV2Function));
const apiFunction = new aws_lambda_nodejs_1.NodejsFunction(stack, 'CascadeApiFunction', {
    runtime: lambda.Runtime.NODEJS_18_X,
    entry: path.join(__dirname, '../src/api/api_handler.ts'),
    handler: 'handler',
    timeout: cdk.Duration.seconds(30),
    memorySize: 256,
    environment: {
        DEPENDENCY_GRAPH_TABLE: dependencyGraphTable.ref,
        SIGNATURES_TABLE_NAME: signaturesTable.ref,
        REMEDIATION_PLANS_TABLE: remediationPlansTable.tableName,
        EVENT_BUS_NAME: eventBus.ref,
        ALERT_TOPIC_ARN: cascadeAlertsTopic.topicArn,
    },
});
apiFunction.addToRolePolicy(new iam.PolicyStatement({
    actions: ['dynamodb:GetItem', 'dynamodb:Scan', 'dynamodb:Query', 'dynamodb:PutItem'],
    resources: [
        dependencyGraphTable.attrArn,
        signaturesTable.attrArn,
        remediationPlansTable.tableArn,
    ],
}));
apiFunction.addToRolePolicy(new iam.PolicyStatement({
    actions: ['events:PutEvents'],
    resources: [eventBus.getAtt('Arn').toString()],
}));
cascadeAlertsTopic.grantPublish(apiFunction);
const webhookNotifierFunction = new aws_lambda_nodejs_1.NodejsFunction(stack, 'WebhookNotifierFunction', {
    runtime: lambda.Runtime.NODEJS_18_X,
    entry: path.join(__dirname, '../src/integrations/webhook_notifier_handler.ts'),
    handler: 'handler',
    timeout: cdk.Duration.seconds(30),
    memorySize: 256,
    environment: {
        WEBHOOK_URL: webhookUrl,
        WEBHOOK_ENABLED: webhookEnabled,
    },
});
const remediationActionExecutorFunction = new aws_lambda_nodejs_1.NodejsFunction(stack, 'RemediationActionExecutorFunction', {
    runtime: lambda.Runtime.NODEJS_18_X,
    entry: path.join(__dirname, '../src/orchestration/action_executor_handler.ts'),
    handler: 'handler',
    timeout: cdk.Duration.seconds(30),
    memorySize: 256,
    environment: {
        EVENT_BUS_NAME: eventBus.ref,
    },
});
remediationActionExecutorFunction.addToRolePolicy(new iam.PolicyStatement({
    actions: ['events:PutEvents'],
    resources: [eventBus.getAtt('Arn').toString()],
}));
const executeActionStep = new sfnTasks.LambdaInvoke(stack, 'ExecuteActionStep', {
    lambdaFunction: remediationActionExecutorFunction,
    payload: sfn.TaskInput.fromObject({
        planId: sfn.JsonPath.stringAt('$.planId'),
        signatureId: sfn.JsonPath.stringAt('$.signatureId'),
        mode: 'execute',
        action: sfn.JsonPath.objectAt('$$.Map.Item.Value'),
    }),
    outputPath: '$.Payload',
});
const rollbackActionStep = new sfnTasks.LambdaInvoke(stack, 'RollbackActionStep', {
    lambdaFunction: remediationActionExecutorFunction,
    payload: sfn.TaskInput.fromObject({
        planId: sfn.JsonPath.stringAt('$.planId'),
        signatureId: sfn.JsonPath.stringAt('$.signatureId'),
        mode: 'rollback',
        action: sfn.JsonPath.objectAt('$$.Map.Item.Value'),
    }),
    outputPath: '$.Payload',
});
const executeActionsMap = new sfn.Map(stack, 'ExecuteActionsMap', {
    itemsPath: sfn.JsonPath.stringAt('$.actions'),
    maxConcurrency: 1,
});
executeActionsMap.itemProcessor(executeActionStep);
const rollbackActionsMap = new sfn.Map(stack, 'RollbackActionsMap', {
    itemsPath: sfn.JsonPath.stringAt('$.rollbackActions'),
    maxConcurrency: 1,
});
rollbackActionsMap.itemProcessor(rollbackActionStep);
executeActionsMap.addCatch(rollbackActionsMap.next(new sfn.Fail(stack, 'PlanExecutionFailed')));
const remediationStateMachine = new sfn.StateMachine(stack, 'RemediationStateMachine', {
    definitionBody: sfn.DefinitionBody.fromChainable(executeActionsMap.next(new sfn.Succeed(stack, 'PlanExecutionSucceeded'))),
    timeout: cdk.Duration.seconds(300),
});
const remediationPlannerFunction = new aws_lambda_nodejs_1.NodejsFunction(stack, 'RemediationPlannerFunction', {
    runtime: lambda.Runtime.NODEJS_18_X,
    entry: path.join(__dirname, '../src/orchestration/remediation_planner_handler.ts'),
    handler: 'handler',
    timeout: cdk.Duration.seconds(30),
    memorySize: 256,
    environment: {
        REMEDIATION_PLANS_TABLE: remediationPlansTable.tableName,
        EVENT_BUS_NAME: eventBus.ref,
        REMEDIATION_STATE_MACHINE_ARN: remediationStateMachine.stateMachineArn,
    },
});
remediationPlannerFunction.addToRolePolicy(new iam.PolicyStatement({
    actions: ['dynamodb:PutItem'],
    resources: [remediationPlansTable.tableArn],
}));
remediationPlannerFunction.addToRolePolicy(new iam.PolicyStatement({
    actions: ['events:PutEvents'],
    resources: [eventBus.getAtt('Arn').toString()],
}));
remediationPlannerFunction.addToRolePolicy(new iam.PolicyStatement({
    actions: ['states:StartExecution'],
    resources: [remediationStateMachine.stateMachineArn],
}));
const predictionToRemediationRule = new events.Rule(stack, 'PredictionToRemediationRule', {
    eventPattern: {
        source: ['cascade-prevention.prediction'],
        detailType: ['CascadePathPredicted'],
    },
    eventBus: events.EventBus.fromEventBusName(stack, 'PredictionEventBus', eventBus.ref),
});
predictionToRemediationRule.addTarget(new targets.LambdaFunction(remediationPlannerFunction));
const integrationEventRule = new events.Rule(stack, 'IntegrationEventRule', {
    eventPattern: {
        source: [
            'cascade-prevention.signature',
            'cascade-prevention.prediction',
            'cascade-prevention.remediation',
        ],
        detailType: [
            'CascadeSignatureDetected',
            'CascadePathPredicted',
            'RemediationActionRecorded',
        ],
    },
    eventBus: events.EventBus.fromEventBusName(stack, 'IntegrationEventBus', eventBus.ref),
});
integrationEventRule.addTarget(new targets.LambdaFunction(webhookNotifierFunction));
const api = new apigateway.RestApi(stack, 'CascadePreventionApi', {
    restApiName: 'CascadePreventionApi',
    description: 'MVP API for cascade prevention telemetry and operator interfaces',
    deployOptions: { stageName: 'v1' },
    defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
    },
});
const userPool = new cognito.UserPool(stack, 'CascadePreventionUserPool', {
    userPoolName: 'CascadePreventionUsers',
    selfSignUpEnabled: false,
    signInAliases: { email: true },
    standardAttributes: {
        email: { required: true, mutable: false },
    },
    passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
    },
    mfa: cognito.Mfa.OPTIONAL,
    accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
});
const userPoolClient = new cognito.UserPoolClient(stack, 'CascadePreventionUserPoolClient', {
    userPool,
    generateSecret: false,
    authFlows: {
        userPassword: true,
        userSrp: true,
    },
});
const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(stack, 'CascadeApiAuthorizer', {
    cognitoUserPools: [userPool],
});
const protectedMethodOptions = {
    authorizationType: apigateway.AuthorizationType.COGNITO,
    authorizer: cognitoAuthorizer,
    apiKeyRequired: true,
};
const telemetry = api.root.addResource('telemetry');
const ingest = telemetry.addResource('ingest');
ingest.addMethod('POST', new apigateway.LambdaIntegration(telemetryIngestFunction), {
    authorizationType: apigateway.AuthorizationType.IAM,
});
const dependencyGraph = api.root.addResource('dependency-graph');
const dependencyGraphGetMethod = dependencyGraph.addMethod('GET', new apigateway.LambdaIntegration(apiFunction), protectedMethodOptions);
const cascadeSignatures = api.root.addResource('cascade-signatures');
const activeSignatures = cascadeSignatures.addResource('active');
const activeSignaturesGetMethod = activeSignatures.addMethod('GET', new apigateway.LambdaIntegration(apiFunction), protectedMethodOptions);
const remediationPlans = api.root.addResource('remediation-plans');
const remediationPlansGetMethod = remediationPlans.addMethod('GET', new apigateway.LambdaIntegration(apiFunction), protectedMethodOptions);
const planById = remediationPlans.addResource('{planId}');
const approval = planById.addResource('approval');
const approvalPostMethod = approval.addMethod('POST', new apigateway.LambdaIntegration(apiFunction), protectedMethodOptions);
const apiKey = api.addApiKey('CascadeOperatorApiKey', {
    apiKeyName: 'CascadeOperatorApiKey',
});
const usagePlan = api.addUsagePlan('CascadeApiUsagePlan', {
    name: 'CascadeApiUsagePlan',
    throttle: {
        burstLimit: 200,
        rateLimit: 1000 / 60,
    },
});
usagePlan.addApiKey(apiKey);
usagePlan.addApiStage({
    api,
    stage: api.deploymentStage,
    throttle: [
        {
            method: dependencyGraphGetMethod,
            throttle: {
                burstLimit: 200,
                rateLimit: 1000 / 60,
            },
        },
        {
            method: activeSignaturesGetMethod,
            throttle: {
                burstLimit: 200,
                rateLimit: 1000 / 60,
            },
        },
        {
            method: remediationPlansGetMethod,
            throttle: {
                burstLimit: 200,
                rateLimit: 1000 / 60,
            },
        },
        {
            method: approvalPostMethod,
            throttle: {
                burstLimit: 200,
                rateLimit: 1000 / 60,
            },
        },
    ],
});
new cdk.CfnOutput(stack, 'CascadePreventionUserPoolId', {
    value: userPool.userPoolId,
});
new cdk.CfnOutput(stack, 'CascadePreventionUserPoolClientId', {
    value: userPoolClient.userPoolClientId,
});
new cdk.CfnOutput(stack, 'CascadeOperatorApiKeyId', {
    value: apiKey.keyId,
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vaW5mcmFzdHJ1Y3R1cmUvYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLCtFQUFnRTtBQUNoRSx1RUFBeUQ7QUFDekQsaUVBQW1EO0FBQ25ELG1FQUFxRDtBQUNyRCwrREFBaUQ7QUFDakQsd0VBQTBEO0FBQzFELHlEQUEyQztBQUMzQywrREFBaUQ7QUFFakQseURBQTJDO0FBQzNDLG1FQUFxRDtBQUNyRCw4RUFBZ0U7QUFDaEUscUVBQStEO0FBQy9ELDJDQUE2QjtBQUM3QixvRkFBc0U7QUFFdEUsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsa0JBQWtCLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUN2RCxNQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLHdCQUF3QixDQUFDLENBQUM7QUFDM0QsTUFBTSxvQkFBb0IsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQXVCLENBQUM7QUFDeEYsTUFBTSxVQUFVLEdBQUcsb0JBQW9CLElBQUksRUFBRSxDQUFDO0FBQzlDLE1BQU0sY0FBYyxHQUFHLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztBQUUvRCxNQUFNLFFBQVEsR0FBRyxJQUFJLG1DQUFVLENBQUMsS0FBSyxFQUFFLDJCQUEyQixFQUFFO0lBQ25FLFlBQVksRUFBRSxtQkFBbUI7Q0FDakMsQ0FBQyxDQUFDO0FBRUgsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLDhDQUFnQixDQUFDLEtBQUssRUFBRSxrQkFBa0IsRUFBRTtJQUN4RSxTQUFTLEVBQUUsb0NBQW9DO0lBQy9DLFlBQVksRUFBRSxvQ0FBb0M7Q0FDbEQsQ0FBQyxDQUFD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QUssRUFBRSw2QkFBNkIsRUFBRTtJQUN2RCxLQUFLLEVBQUUsUUFBUSxDQUFDLFVBQVU7Q0FDMUIsQ0FBQyxDQUFDO0FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxtQ0FBbUMsRUFBRTtJQUM3RCxLQUFLLEVBQUUsY0FBYyxDQUFDLGdCQUFnQjtDQUN0QyxDQUFDLENBQUM7QUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLHlCQUF5QixFQUFFO0lBQ25ELEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSztDQUNuQixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ2ZuSW5jbHVkZSB9IGZyb20gJ2F3cy1jZGstbGliL2Nsb3VkZm9ybWF0aW9uLWluY2x1ZGUnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgc2ZuIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zJztcbmltcG9ydCAqIGFzIHNmblRhc2tzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zLXRhc2tzJztcbmltcG9ydCB7IE5vZGVqc0Z1bmN0aW9uIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ub2RlanMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IFBsYXlib29rTWFwcGluZ3MgfSBmcm9tICcuLi9saWIvcGxheWJvb2stbWFwcGluZ3MtY29uc3RydWN0JztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoeyBhbmFseXRpY3NSZXBvcnRpbmc6IGZhbHNlIH0pO1xuY29uc3Qgc3RhY2sgPSBuZXcgY2RrLlN0YWNrKGFwcCwgJ0Nhc2NhZGVQcmV2ZW50aW9uU3RhY2snKTtcbmNvbnN0IGNvbmZpZ3VyZWRXZWJob29rVXJsID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnd2ViaG9va1VybCcpIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbmNvbnN0IHdlYmhvb2tVcmwgPSBjb25maWd1cmVkV2ViaG9va1VybCA/PyAnJztcbmNvbnN0IHdlYmhvb2tFbmFibGVkID0gY29uZmlndXJlZFdlYmhvb2tVcmwgPyAndHJ1ZScgOiAnZmFsc2UnO1xuXG5jb25zdCBpbmNsdWRlZCA9IG5ldyBDZm5JbmNsdWRlKHN0YWNrLCAnQ2FzY2FkZVByZXZlbnRpb25UZW1wbGF0ZScsIHtcblx0dGVtcGxhdGVGaWxlOiAnY2ZuLXRlbXBsYXRlLnlhbWwnLFxufSk7XG5cbmNvbnN0IHBsYXlib29rTWFwcGluZ3MgPSBuZXcgUGxheWJvb2tNYXBwaW5ncyhzdGFjaywgJ1BsYXlib29rTWFwcGluZ3MnLCB7XG5cdHRhYmxlTmFtZTogJ0Nhc2NhZGVQcmV2ZW50aW9uLVBsYXlib29rTWFwcGluZ3MnLFxuXHRldmVudEJ1c05hbWU6ICdDYXNjYWRlUHJldmVudGlvbi1QbGF5Ym9va0V2ZW50QnVzJyxcbn0pO1xuXG5jb25zdCB0ZWxlbWV0cnlCdWNrZXQgPSBpbmNsdWRlZC5nZXRSZXNvdXJjZSgnVGVsZW1ldHJ5QnVja2V0NzEwRkYyQzgnKSBhcyBzMy5DZm5CdWNrZXQ7XG5jb25zdCB0ZWxlbWV0cnlDYWNoZVRhYmxlID0gaW5jbHVkZWQuZ2V0UmVzb3VyY2UoJ1RlbGVtZXRyeUNhY2hlRDI5QTAzOTUnKSBhcyBkeW5hbW9kYi5DZm5UYWJsZTtcbmNvbnN0IGRlcGVuZGVuY3lHcmFwaFRhYmxlID0gaW5jbHVkZWQuZ2V0UmVzb3VyY2UoJ0RlcGVuZGVuY3lHcmFwaDMzMjQ4MzNFJykgYXMgZHluYW1vZGIuQ2ZuVGFibGU7XG5jb25zdCBzaWduYXR1cmVzVGFibGUgPSBpbmNsdWRlZC5nZXRSZXNvdXJjZSgnU2lnbmF0dXJlc1RhYmxlNzk3MzNBOUMnKSBhcyBkeW5hbW9kYi5DZm5UYWJsZTtcbmNvbnN0IGV2ZW50QnVzID0gaW5jbHVkZWQuZ2V0UmVzb3VyY2UoJ0V2ZW50QnVzN0I4NzQ4QUEnKSBhcyBldmVudHMuQ2ZuRXZlbnRCdXM7XG5cbmNvbnN0IHJlbWVkaWF0aW9uUGxhbnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZShzdGFjaywgJ1JlbWVkaWF0aW9uUGxhbnNUYWJsZScsIHtcblx0dGFibGVOYW1lOiAnQ2FzY2FkZVByZXZlbnRpb24tUmVtZWRpYXRpb25QbGFucycsXG5cdHBhcnRpdGlvbktleTogeyBuYW1lOiAncGxhbklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcblx0YmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcblx0cG9pbnRJblRpbWVSZWNvdmVyeVNwZWNpZmljYXRpb246IHtcblx0XHRwb2ludEluVGltZVJlY292ZXJ5RW5hYmxlZDogdHJ1ZSxcblx0fSxcblx0ZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuXHRyZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG59KTtcblxuY29uc3QgY2FzY2FkZUFsZXJ0c1RvcGljID0gbmV3IHNucy5Ub3BpYyhzdGFjaywgJ0Nhc2NhZGVBbGVydHNUb3BpYycsIHtcblx0ZGlzcGxheU5hbWU6ICdDYXNjYWRlIFByZXZlbnRpb24gQWxlcnRzJyxcbn0pO1xuXG5jb25zdCB0ZWxlbWV0cnlJbmdlc3RGdW5jdGlvbiA9IG5ldyBOb2RlanNGdW5jdGlvbihzdGFjaywgJ1RlbGVtZXRyeUluZ2VzdEZ1bmN0aW9uJywge1xuXHRydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcblx0ZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9zcmMvdGVsZW1ldHJ5L2luZ2VzdGlvbl9oYW5kbGVyLnRzJyksXG5cdGhhbmRsZXI6ICdoYW5kbGVyJyxcblx0dGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuXHRtZW1vcnlTaXplOiAyNTYsXG5cdGVudmlyb25tZW50OiB7XG5cdFx0VEVMRU1FVFJZX0JVQ0tFVDogdGVsZW1ldHJ5QnVja2V0LnJlZixcblx0XHRFVkVOVF9CVVNfTkFNRTogZXZlbnRCdXMucmVmLFxuXHRcdFRFTEVNRVRSWV9DQUNIRV9UQUJMRTogdGVsZW1ldHJ5Q2FjaGVUYWJsZS5yZWYsXG5cdH0sXG59KTtcblxudGVsZW1ldHJ5SW5nZXN0RnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcblx0YWN0aW9uczogWydzMzpQdXRPYmplY3QnXSxcblx0cmVzb3VyY2VzOiBbYCR7dGVsZW1ldHJ5QnVja2V0LmF0dHJBcm59LypgXSxcbn0pKTtcbnRlbGVtZXRyeUluZ2VzdEZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG5cdGFjdGlvbnM6IFsnZXZlbnRzOlB1dEV2ZW50cyddLFxuXHRyZXNvdXJjZXM6IFtldmVudEJ1cy5nZXRBdHQoJ0FybicpLnRvU3RyaW5nKCldLFxufSkpO1xudGVsZW1ldHJ5SW5nZXN0RnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcblx0YWN0aW9uczogWydkeW5hbW9kYjpQdXRJdGVtJ10sXG5cdHJlc291cmNlczogW3RlbGVtZXRyeUNhY2hlVGFibGUuYXR0ckFybl0sXG59KSk7XG5cbmNvbnN0IHNpZ25hdHVyZU1hdGNoZXJWMkZ1bmN0aW9uID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHN0YWNrLCAnU2lnbmF0dXJlTWF0Y2hlclYyRnVuY3Rpb24nLCB7XG5cdHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuXHRlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL3NyYy9kZXRlY3Rpb24vc2lnbmF0dXJlX21hdGNoZXJfaGFuZGxlci50cycpLFxuXHRoYW5kbGVyOiAnaGFuZGxlcicsXG5cdHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcblx0bWVtb3J5U2l6ZTogMjU2LFxuXHRlbnZpcm9ubWVudDoge1xuXHRcdFNJR05BVFVSRVNfVEFCTEVfTkFNRTogc2lnbmF0dXJlc1RhYmxlLnJlZixcblx0XHRFVkVOVF9CVVNfTkFNRTogZXZlbnRCdXMucmVmLFxuXHRcdEFMRVJUX1RPUElDX0FSTjogY2FzY2FkZUFsZXJ0c1RvcGljLnRvcGljQXJuLFxuXHR9LFxufSk7XG5cbnNpZ25hdHVyZU1hdGNoZXJWMkZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG5cdGFjdGlvbnM6IFsnZHluYW1vZGI6UHV0SXRlbSddLFxuXHRyZXNvdXJjZXM6IFtzaWduYXR1cmVzVGFibGUuYXR0ckFybl0sXG59KSk7XG5zaWduYXR1cmVNYXRjaGVyVjJGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuXHRhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcblx0cmVzb3VyY2VzOiBbZXZlbnRCdXMuZ2V0QXR0KCdBcm4nKS50b1N0cmluZygpXSxcbn0pKTtcbmNhc2NhZGVBbGVydHNUb3BpYy5ncmFudFB1Ymxpc2goc2lnbmF0dXJlTWF0Y2hlclYyRnVuY3Rpb24pO1xuXG5jb25zdCBhbm9tYWx5VG9TaWduYXR1cmVWMlJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUoc3RhY2ssICdBbm9tYWx5VG9TaWduYXR1cmVWMlJ1bGUnLCB7XG5cdGV2ZW50UGF0dGVybjoge1xuXHRcdHNvdXJjZTogWydjYXNjYWRlLXByZXZlbnRpb24uYW5vbWFseSddLFxuXHRcdGRldGFpbFR5cGU6IFsnQW5vbWFseURldGVjdGVkJ10sXG5cdH0sXG5cdGV2ZW50QnVzOiBldmVudHMuRXZlbnRCdXMuZnJvbUV2ZW50QnVzTmFtZShzdGFjaywgJ0ltcG9ydGVkQ2FzY2FkZUV2ZW50QnVzJywgZXZlbnRCdXMucmVmKSxcbn0pO1xuYW5vbWFseVRvU2lnbmF0dXJlVjJSdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihzaWduYXR1cmVNYXRjaGVyVjJGdW5jdGlvbikpO1xuXG5jb25zdCBhcGlGdW5jdGlvbiA9IG5ldyBOb2RlanNGdW5jdGlvbihzdGFjaywgJ0Nhc2NhZGVBcGlGdW5jdGlvbicsIHtcblx0cnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG5cdGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vc3JjL2FwaS9hcGlfaGFuZGxlci50cycpLFxuXHRoYW5kbGVyOiAnaGFuZGxlcicsXG5cdHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcblx0bWVtb3J5U2l6ZTogMjU2LFxuXHRlbnZpcm9ubWVudDoge1xuXHRcdERFUEVOREVOQ1lfR1JBUEhfVEFCTEU6IGRlcGVuZGVuY3lHcmFwaFRhYmxlLnJlZixcblx0XHRTSUdOQVRVUkVTX1RBQkxFX05BTUU6IHNpZ25hdHVyZXNUYWJsZS5yZWYsXG5cdFx0UkVNRURJQVRJT05fUExBTlNfVEFCTEU6IHJlbWVkaWF0aW9uUGxhbnNUYWJsZS50YWJsZU5hbWUsXG5cdFx0RVZFTlRfQlVTX05BTUU6IGV2ZW50QnVzLnJlZixcblx0XHRBTEVSVF9UT1BJQ19BUk46IGNhc2NhZGVBbGVydHNUb3BpYy50b3BpY0Fybixcblx0fSxcbn0pO1xuXG5hcGlGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuXHRhY3Rpb25zOiBbJ2R5bmFtb2RiOkdldEl0ZW0nLCAnZHluYW1vZGI6U2NhbicsICdkeW5hbW9kYjpRdWVyeScsICdkeW5hbW9kYjpQdXRJdGVtJ10sXG5cdHJlc291cmNlczogW1xuXHRcdGRlcGVuZGVuY3lHcmFwaFRhYmxlLmF0dHJBcm4sXG5cdFx0c2lnbmF0dXJlc1RhYmxlLmF0dHJBcm4sXG5cdFx0cmVtZWRpYXRpb25QbGFuc1RhYmxlLnRhYmxlQXJuLFxuXHRdLFxufSkpO1xuYXBpRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcblx0YWN0aW9uczogWydldmVudHM6UHV0RXZlbnRzJ10sXG5cdHJlc291cmNlczogW2V2ZW50QnVzLmdldEF0dCgnQXJuJykudG9TdHJpbmcoKV0sXG59KSk7XG5jYXNjYWRlQWxlcnRzVG9waWMuZ3JhbnRQdWJsaXNoKGFwaUZ1bmN0aW9uKTtcblxuY29uc3Qgd2ViaG9va05vdGlmaWVyRnVuY3Rpb24gPSBuZXcgTm9kZWpzRnVuY3Rpb24oc3RhY2ssICdXZWJob29rTm90aWZpZXJGdW5jdGlvbicsIHtcblx0cnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG5cdGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vc3JjL2ludGVncmF0aW9ucy93ZWJob29rX25vdGlmaWVyX2hhbmRsZXIudHMnKSxcblx0aGFuZGxlcjogJ2hhbmRsZXInLFxuXHR0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG5cdG1lbW9yeVNpemU6IDI1Nixcblx0ZW52aXJvbm1lbnQ6IHtcblx0XHRXRUJIT09LX1VSTDogd2ViaG9va1VybCxcblx0XHRXRUJIT09LX0VOQUJMRUQ6IHdlYmhvb2tFbmFibGVkLFxuXHR9LFxufSk7XG5cbmNvbnN0IHJlbWVkaWF0aW9uQWN0aW9uRXhlY3V0b3JGdW5jdGlvbiA9IG5ldyBOb2RlanNGdW5jdGlvbihzdGFjaywgJ1JlbWVkaWF0aW9uQWN0aW9uRXhlY3V0b3JGdW5jdGlvbicsIHtcblx0cnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG5cdGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vc3JjL29yY2hlc3RyYXRpb24vYWN0aW9uX2V4ZWN1dG9yX2hhbmRsZXIudHMnKSxcblx0aGFuZGxlcjogJ2hhbmRsZXInLFxuXHR0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG5cdG1lbW9yeVNpemU6IDI1Nixcblx0ZW52aXJvbm1lbnQ6IHtcblx0XHRFVkVOVF9CVVNfTkFNRTogZXZlbnRCdXMucmVmLFxuXHR9LFxufSk7XG5yZW1lZGlhdGlvbkFjdGlvbkV4ZWN1dG9yRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcblx0YWN0aW9uczogWydldmVudHM6UHV0RXZlbnRzJ10sXG5cdHJlc291cmNlczogW2V2ZW50QnVzLmdldEF0dCgnQXJuJykudG9TdHJpbmcoKV0sXG59KSk7XG5cbmNvbnN0IGV4ZWN1dGVBY3Rpb25TdGVwID0gbmV3IHNmblRhc2tzLkxhbWJkYUludm9rZShzdGFjaywgJ0V4ZWN1dGVBY3Rpb25TdGVwJywge1xuXHRsYW1iZGFGdW5jdGlvbjogcmVtZWRpYXRpb25BY3Rpb25FeGVjdXRvckZ1bmN0aW9uLFxuXHRwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xuXHRcdHBsYW5JZDogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLnBsYW5JZCcpLFxuXHRcdHNpZ25hdHVyZUlkOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuc2lnbmF0dXJlSWQnKSxcblx0XHRtb2RlOiAnZXhlY3V0ZScsXG5cdFx0YWN0aW9uOiBzZm4uSnNvblBhdGgub2JqZWN0QXQoJyQkLk1hcC5JdGVtLlZhbHVlJyksXG5cdH0pLFxuXHRvdXRwdXRQYXRoOiAnJC5QYXlsb2FkJyxcbn0pO1xuXG5jb25zdCByb2xsYmFja0FjdGlvblN0ZXAgPSBuZXcgc2ZuVGFza3MuTGFtYmRhSW52b2tlKHN0YWNrLCAnUm9sbGJhY2tBY3Rpb25TdGVwJywge1xuXHRsYW1iZGFGdW5jdGlvbjogcmVtZWRpYXRpb25BY3Rpb25FeGVjdXRvckZ1bmN0aW9uLFxuXHRwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xuXHRcdHBsYW5JZDogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLnBsYW5JZCcpLFxuXHRcdHNpZ25hdHVyZUlkOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuc2lnbmF0dXJlSWQnKSxcblx0XHRtb2RlOiAncm9sbGJhY2snLFxuXHRcdGFjdGlvbjogc2ZuLkpzb25QYXRoLm9iamVjdEF0KCckJC5NYXAuSXRlbS5WYWx1ZScpLFxuXHR9KSxcblx0b3V0cHV0UGF0aDogJyQuUGF5bG9hZCcsXG59KTtcblxuY29uc3QgZXhlY3V0ZUFjdGlvbnNNYXAgPSBuZXcgc2ZuLk1hcChzdGFjaywgJ0V4ZWN1dGVBY3Rpb25zTWFwJywge1xuXHRpdGVtc1BhdGg6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5hY3Rpb25zJyksXG5cdG1heENvbmN1cnJlbmN5OiAxLFxufSk7XG5leGVjdXRlQWN0aW9uc01hcC5pdGVtUHJvY2Vzc29yKGV4ZWN1dGVBY3Rpb25TdGVwKTtcblxuY29uc3Qgcm9sbGJhY2tBY3Rpb25zTWFwID0gbmV3IHNmbi5NYXAoc3RhY2ssICdSb2xsYmFja0FjdGlvbnNNYXAnLCB7XG5cdGl0ZW1zUGF0aDogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLnJvbGxiYWNrQWN0aW9ucycpLFxuXHRtYXhDb25jdXJyZW5jeTogMSxcbn0pO1xucm9sbGJhY2tBY3Rpb25zTWFwLml0ZW1Qcm9jZXNzb3Iocm9sbGJhY2tBY3Rpb25TdGVwKTtcblxuZXhlY3V0ZUFjdGlvbnNNYXAuYWRkQ2F0Y2gocm9sbGJhY2tBY3Rpb25zTWFwLm5leHQobmV3IHNmbi5GYWlsKHN0YWNrLCAnUGxhbkV4ZWN1dGlvbkZhaWxlZCcpKSk7XG5cbmNvbnN0IHJlbWVkaWF0aW9uU3RhdGVNYWNoaW5lID0gbmV3IHNmbi5TdGF0ZU1hY2hpbmUoc3RhY2ssICdSZW1lZGlhdGlvblN0YXRlTWFjaGluZScsIHtcblx0ZGVmaW5pdGlvbkJvZHk6IHNmbi5EZWZpbml0aW9uQm9keS5mcm9tQ2hhaW5hYmxlKGV4ZWN1dGVBY3Rpb25zTWFwLm5leHQobmV3IHNmbi5TdWNjZWVkKHN0YWNrLCAnUGxhbkV4ZWN1dGlvblN1Y2NlZWRlZCcpKSksXG5cdHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwMCksXG59KTtcblxuY29uc3QgcmVtZWRpYXRpb25QbGFubmVyRnVuY3Rpb24gPSBuZXcgTm9kZWpzRnVuY3Rpb24oc3RhY2ssICdSZW1lZGlhdGlvblBsYW5uZXJGdW5jdGlvbicsIHtcblx0cnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG5cdGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vc3JjL29yY2hlc3RyYXRpb24vcmVtZWRpYXRpb25fcGxhbm5lcl9oYW5kbGVyLnRzJyksXG5cdGhhbmRsZXI6ICdoYW5kbGVyJyxcblx0dGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuXHRtZW1vcnlTaXplOiAyNTYsXG5cdGVudmlyb25tZW50OiB7XG5cdFx0UkVNRURJQVRJT05fUExBTlNfVEFCTEU6IHJlbWVkaWF0aW9uUGxhbnNUYWJsZS50YWJsZU5hbWUsXG5cdFx0RVZFTlRfQlVTX05BTUU6IGV2ZW50QnVzLnJlZixcblx0XHRSRU1FRElBVElPTl9TVEFURV9NQUNISU5FX0FSTjogcmVtZWRpYXRpb25TdGF0ZU1hY2hpbmUuc3RhdGVNYWNoaW5lQXJuLFxuXHR9LFxufSk7XG5yZW1lZGlhdGlvblBsYW5uZXJGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuXHRhY3Rpb25zOiBbJ2R5bmFtb2RiOlB1dEl0ZW0nXSxcblx0cmVzb3VyY2VzOiBbcmVtZWRpYXRpb25QbGFuc1RhYmxlLnRhYmxlQXJuXSxcbn0pKTtcbnJlbWVkaWF0aW9uUGxhbm5lckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG5cdGFjdGlvbnM6IFsnZXZlbnRzOlB1dEV2ZW50cyddLFxuXHRyZXNvdXJjZXM6IFtldmVudEJ1cy5nZXRBdHQoJ0FybicpLnRvU3RyaW5nKCldLFxufSkpO1xucmVtZWRpYXRpb25QbGFubmVyRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcblx0YWN0aW9uczogWydzdGF0ZXM6U3RhcnRFeGVjdXRpb24nXSxcblx0cmVzb3VyY2VzOiBbcmVtZWRpYXRpb25TdGF0ZU1hY2hpbmUuc3RhdGVNYWNoaW5lQXJuXSxcbn0pKTtcblxuY29uc3QgcHJlZGljdGlvblRvUmVtZWRpYXRpb25SdWxlID0gbmV3IGV2ZW50cy5SdWxlKHN0YWNrLCAnUHJlZGljdGlvblRvUmVtZWRpYXRpb25SdWxlJywge1xuXHRldmVudFBhdHRlcm46IHtcblx0XHRzb3VyY2U6IFsnY2FzY2FkZS1wcmV2ZW50aW9uLnByZWRpY3Rpb24nXSxcblx0XHRkZXRhaWxUeXBlOiBbJ0Nhc2NhZGVQYXRoUHJlZGljdGVkJ10sXG5cdH0sXG5cdGV2ZW50QnVzOiBldmVudHMuRXZlbnRCdXMuZnJvbUV2ZW50QnVzTmFtZShzdGFjaywgJ1ByZWRpY3Rpb25FdmVudEJ1cycsIGV2ZW50QnVzLnJlZiksXG59KTtcbnByZWRpY3Rpb25Ub1JlbWVkaWF0aW9uUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24ocmVtZWRpYXRpb25QbGFubmVyRnVuY3Rpb24pKTtcblxuY29uc3QgaW50ZWdyYXRpb25FdmVudFJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUoc3RhY2ssICdJbnRlZ3JhdGlvbkV2ZW50UnVsZScsIHtcblx0ZXZlbnRQYXR0ZXJuOiB7XG5cdFx0c291cmNlOiBbXG5cdFx0XHQnY2FzY2FkZS1wcmV2ZW50aW9uLnNpZ25hdHVyZScsXG5cdFx0XHQnY2FzY2FkZS1wcmV2ZW50aW9uLnByZWRpY3Rpb24nLFxuXHRcdFx0J2Nhc2NhZGUtcHJldmVudGlvbi5yZW1lZGlhdGlvbicsXG5cdFx0XSxcblx0XHRkZXRhaWxUeXBlOiBbXG5cdFx0XHQnQ2FzY2FkZVNpZ25hdHVyZURldGVjdGVkJyxcblx0XHRcdCdDYXNjYWRlUGF0aFByZWRpY3RlZCcsXG5cdFx0XHQnUmVtZWRpYXRpb25BY3Rpb25SZWNvcmRlZCcsXG5cdFx0XSxcblx0fSxcblx0ZXZlbnRCdXM6IGV2ZW50cy5FdmVudEJ1cy5mcm9tRXZlbnRCdXNOYW1lKHN0YWNrLCAnSW50ZWdyYXRpb25FdmVudEJ1cycsIGV2ZW50QnVzLnJlZiksXG59KTtcbmludGVncmF0aW9uRXZlbnRSdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbih3ZWJob29rTm90aWZpZXJGdW5jdGlvbikpO1xuXG5jb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHN0YWNrLCAnQ2FzY2FkZVByZXZlbnRpb25BcGknLCB7XG5cdHJlc3RBcGlOYW1lOiAnQ2FzY2FkZVByZXZlbnRpb25BcGknLFxuXHRkZXNjcmlwdGlvbjogJ01WUCBBUEkgZm9yIGNhc2NhZGUgcHJldmVudGlvbiB0ZWxlbWV0cnkgYW5kIG9wZXJhdG9yIGludGVyZmFjZXMnLFxuXHRkZXBsb3lPcHRpb25zOiB7IHN0YWdlTmFtZTogJ3YxJyB9LFxuXHRkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcblx0XHRhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcblx0XHRhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcblx0XHRhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ0F1dGhvcml6YXRpb24nLCAnWC1BcGktS2V5J10sXG5cdH0sXG59KTtcblxuY29uc3QgdXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbChzdGFjaywgJ0Nhc2NhZGVQcmV2ZW50aW9uVXNlclBvb2wnLCB7XG5cdHVzZXJQb29sTmFtZTogJ0Nhc2NhZGVQcmV2ZW50aW9uVXNlcnMnLFxuXHRzZWxmU2lnblVwRW5hYmxlZDogZmFsc2UsXG5cdHNpZ25JbkFsaWFzZXM6IHsgZW1haWw6IHRydWUgfSxcblx0c3RhbmRhcmRBdHRyaWJ1dGVzOiB7XG5cdFx0ZW1haWw6IHsgcmVxdWlyZWQ6IHRydWUsIG11dGFibGU6IGZhbHNlIH0sXG5cdH0sXG5cdHBhc3N3b3JkUG9saWN5OiB7XG5cdFx0bWluTGVuZ3RoOiAxMixcblx0XHRyZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuXHRcdHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG5cdFx0cmVxdWlyZURpZ2l0czogdHJ1ZSxcblx0XHRyZXF1aXJlU3ltYm9sczogdHJ1ZSxcblx0fSxcblx0bWZhOiBjb2duaXRvLk1mYS5PUFRJT05BTCxcblx0YWNjb3VudFJlY292ZXJ5OiBjb2duaXRvLkFjY291bnRSZWNvdmVyeS5FTUFJTF9PTkxZLFxuXHRyZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG59KTtcblxuY29uc3QgdXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudChzdGFjaywgJ0Nhc2NhZGVQcmV2ZW50aW9uVXNlclBvb2xDbGllbnQnLCB7XG5cdHVzZXJQb29sLFxuXHRnZW5lcmF0ZVNlY3JldDogZmFsc2UsXG5cdGF1dGhGbG93czoge1xuXHRcdHVzZXJQYXNzd29yZDogdHJ1ZSxcblx0XHR1c2VyU3JwOiB0cnVlLFxuXHR9LFxufSk7XG5cbmNvbnN0IGNvZ25pdG9BdXRob3JpemVyID0gbmV3IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXIoc3RhY2ssICdDYXNjYWRlQXBpQXV0aG9yaXplcicsIHtcblx0Y29nbml0b1VzZXJQb29sczogW3VzZXJQb29sXSxcbn0pO1xuXG5jb25zdCBwcm90ZWN0ZWRNZXRob2RPcHRpb25zOiBhcGlnYXRld2F5Lk1ldGhvZE9wdGlvbnMgPSB7XG5cdGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG5cdGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxuXHRhcGlLZXlSZXF1aXJlZDogdHJ1ZSxcbn07XG5cbmNvbnN0IHRlbGVtZXRyeSA9IGFwaS5yb290LmFkZFJlc291cmNlKCd0ZWxlbWV0cnknKTtcbmNvbnN0IGluZ2VzdCA9IHRlbGVtZXRyeS5hZGRSZXNvdXJjZSgnaW5nZXN0Jyk7XG5pbmdlc3QuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGVsZW1ldHJ5SW5nZXN0RnVuY3Rpb24pLCB7XG5cdGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLklBTSxcbn0pO1xuXG5jb25zdCBkZXBlbmRlbmN5R3JhcGggPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnZGVwZW5kZW5jeS1ncmFwaCcpO1xuY29uc3QgZGVwZW5kZW5jeUdyYXBoR2V0TWV0aG9kID0gZGVwZW5kZW5jeUdyYXBoLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXBpRnVuY3Rpb24pLCBwcm90ZWN0ZWRNZXRob2RPcHRpb25zKTtcblxuY29uc3QgY2FzY2FkZVNpZ25hdHVyZXMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnY2FzY2FkZS1zaWduYXR1cmVzJyk7XG5jb25zdCBhY3RpdmVTaWduYXR1cmVzID0gY2FzY2FkZVNpZ25hdHVyZXMuYWRkUmVzb3VyY2UoJ2FjdGl2ZScpO1xuY29uc3QgYWN0aXZlU2lnbmF0dXJlc0dldE1ldGhvZCA9IGFjdGl2ZVNpZ25hdHVyZXMuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlGdW5jdGlvbiksIHByb3RlY3RlZE1ldGhvZE9wdGlvbnMpO1xuXG5jb25zdCByZW1lZGlhdGlvblBsYW5zID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3JlbWVkaWF0aW9uLXBsYW5zJyk7XG5jb25zdCByZW1lZGlhdGlvblBsYW5zR2V0TWV0aG9kID0gcmVtZWRpYXRpb25QbGFucy5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaUZ1bmN0aW9uKSwgcHJvdGVjdGVkTWV0aG9kT3B0aW9ucyk7XG5jb25zdCBwbGFuQnlJZCA9IHJlbWVkaWF0aW9uUGxhbnMuYWRkUmVzb3VyY2UoJ3twbGFuSWR9Jyk7XG5jb25zdCBhcHByb3ZhbCA9IHBsYW5CeUlkLmFkZFJlc291cmNlKCdhcHByb3ZhbCcpO1xuY29uc3QgYXBwcm92YWxQb3N0TWV0aG9kID0gYXBwcm92YWwuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXBpRnVuY3Rpb24pLCBwcm90ZWN0ZWRNZXRob2RPcHRpb25zKTtcblxuY29uc3QgYXBpS2V5ID0gYXBpLmFkZEFwaUtleSgnQ2FzY2FkZU9wZXJhdG9yQXBpS2V5Jywge1xuXHRhcGlLZXlOYW1lOiAnQ2FzY2FkZU9wZXJhdG9yQXBpS2V5Jyxcbn0pO1xuXG5jb25zdCB1c2FnZVBsYW4gPSBhcGkuYWRkVXNhZ2VQbGFuKCdDYXNjYWRlQXBpVXNhZ2VQbGFuJywge1xuXHRuYW1lOiAnQ2FzY2FkZUFwaVVzYWdlUGxhbicsXG5cdHRocm90dGxlOiB7XG5cdFx0YnVyc3RMaW1pdDogMjAwLFxuXHRcdHJhdGVMaW1pdDogMTAwMCAvIDYwLFxuXHR9LFxufSk7XG5cbnVzYWdlUGxhbi5hZGRBcGlLZXkoYXBpS2V5KTtcbnVzYWdlUGxhbi5hZGRBcGlTdGFnZSh7XG5cdGFwaSxcblx0c3RhZ2U6IGFwaS5kZXBsb3ltZW50U3RhZ2UsXG5cdHRocm90dGxlOiBbXG5cdFx0e1xuXHRcdFx0bWV0aG9kOiBkZXBlbmRlbmN5R3JhcGhHZXRNZXRob2QsXG5cdFx0XHR0aHJvdHRsZToge1xuXHRcdFx0XHRidXJzdExpbWl0OiAyMDAsXG5cdFx0XHRcdHJhdGVMaW1pdDogMTAwMCAvIDYwLFxuXHRcdFx0fSxcblx0XHR9LFxuXHRcdHtcblx0XHRcdG1ldGhvZDogYWN0aXZlU2lnbmF0dXJlc0dldE1ldGhvZCxcblx0XHRcdHRocm90dGxlOiB7XG5cdFx0XHRcdGJ1cnN0TGltaXQ6IDIwMCxcblx0XHRcdFx0cmF0ZUxpbWl0OiAxMDAwIC8gNjAsXG5cdFx0XHR9LFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0bWV0aG9kOiByZW1lZGlhdGlvblBsYW5zR2V0TWV0aG9kLFxuXHRcdFx0dGhyb3R0bGU6IHtcblx0XHRcdFx0YnVyc3RMaW1pdDogMjAwLFxuXHRcdFx0XHRyYXRlTGltaXQ6IDEwMDAgLyA2MCxcblx0XHRcdH0sXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRtZXRob2Q6IGFwcHJvdmFsUG9zdE1ldGhvZCxcblx0XHRcdHRocm90dGxlOiB7XG5cdFx0XHRcdGJ1cnN0TGltaXQ6IDIwMCxcblx0XHRcdFx0cmF0ZUxpbWl0OiAxMDAwIC8gNjAsXG5cdFx0XHR9LFxuXHRcdH0sXG5cdF0sXG59KTtcblxubmV3IGNkay5DZm5PdXRwdXQoc3RhY2ssICdDYXNjYWRlUHJldmVudGlvblVzZXJQb29sSWQnLCB7XG5cdHZhbHVlOiB1c2VyUG9vbC51c2VyUG9vbElkLFxufSk7XG5cbm5ldyBjZGsuQ2ZuT3V0cHV0KHN0YWNrLCAnQ2FzY2FkZVByZXZlbnRpb25Vc2VyUG9vbENsaWVudElkJywge1xuXHR2YWx1ZTogdXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbn0pO1xuXG5uZXcgY2RrLkNmbk91dHB1dChzdGFjaywgJ0Nhc2NhZGVPcGVyYXRvckFwaUtleUlkJywge1xuXHR2YWx1ZTogYXBpS2V5LmtleUlkLFxufSk7XG4iXX0=