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
const app = new cdk.App({ analyticsReporting: false });
const stack = new cdk.Stack(app, 'CascadePreventionStack');
const configuredWebhookUrl = app.node.tryGetContext('webhookUrl');
const webhookUrl = configuredWebhookUrl ?? '';
const webhookEnabled = configuredWebhookUrl ? 'true' : 'false';
const included = new cloudformation_include_1.CfnInclude(stack, 'CascadePreventionTemplate', {
    templateFile: 'cfn-template.yaml',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vaW5mcmFzdHJ1Y3R1cmUvYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLCtFQUFnRTtBQUNoRSx1RUFBeUQ7QUFDekQsaUVBQW1EO0FBQ25ELG1FQUFxRDtBQUNyRCwrREFBaUQ7QUFDakQsd0VBQTBEO0FBQzFELHlEQUEyQztBQUMzQywrREFBaUQ7QUFFakQseURBQTJDO0FBQzNDLG1FQUFxRDtBQUNyRCw4RUFBZ0U7QUFDaEUscUVBQStEO0FBQy9ELDJDQUE2QjtBQUU3QixNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxrQkFBa0IsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0FBQ3ZELE1BQU0sS0FBSyxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsd0JBQXdCLENBQUMsQ0FBQztBQUMzRCxNQUFNLG9CQUFvQixHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBdUIsQ0FBQztBQUN4RixNQUFNLFVBQVUsR0FBRyxvQkFBb0IsSUFBSSxFQUFFLENBQUM7QUFDOUMsTUFBTSxjQUFjLEdBQUcsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO0FBRS9ELE1BQU0sUUFBUSxHQUFHLElBQUksbUNBQVUsQ0FBQyxLQUFLLEVBQUUsMkJBQTJCLEVBQUU7SUFDbkUsWUFBWSxFQUFFLG1CQUFtQjtDQUNqQyxDQUFDLENBQUM7QUFFSCxNQUFNLGVBQWUsR0FBRyxRQUFRLENBQUMsV0FBVyxDQUFDLHlCQUF5QixDQUFpQixDQUFDO0FBQ3hGLE1BQU0sbUJBQW1CLEdBQUcsUUFBUSxDQUFDLFdBQVcsQ0FBQyx3QkFBd0IsQ0FBc0IsQ0FBQztBQUNoRyxNQUFNLG9CQUFv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dCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDZm5JbmNsdWRlIH0gZnJvbSAnYXdzLWNkay1saWIvY2xvdWRmb3JtYXRpb24taW5jbHVkZSc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBzbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucyc7XG5pbXBvcnQgKiBhcyBzZm4gZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgc2ZuVGFza3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMtdGFza3MnO1xuaW1wb3J0IHsgTm9kZWpzRnVuY3Rpb24gfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLW5vZGVqcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCh7IGFuYWx5dGljc1JlcG9ydGluZzogZmFsc2UgfSk7XG5jb25zdCBzdGFjayA9IG5ldyBjZGsuU3RhY2soYXBwLCAnQ2FzY2FkZVByZXZlbnRpb25TdGFjaycpO1xuY29uc3QgY29uZmlndXJlZFdlYmhvb2tVcmwgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCd3ZWJob29rVXJsJykgYXMgc3RyaW5nIHwgdW5kZWZpbmVkO1xuY29uc3Qgd2ViaG9va1VybCA9IGNvbmZpZ3VyZWRXZWJob29rVXJsID8/ICcnO1xuY29uc3Qgd2ViaG9va0VuYWJsZWQgPSBjb25maWd1cmVkV2ViaG9va1VybCA/ICd0cnVlJyA6ICdmYWxzZSc7XG5cbmNvbnN0IGluY2x1ZGVkID0gbmV3IENmbkluY2x1ZGUoc3RhY2ssICdDYXNjYWRlUHJldmVudGlvblRlbXBsYXRlJywge1xuXHR0ZW1wbGF0ZUZpbGU6ICdjZm4tdGVtcGxhdGUueWFtbCcsXG59KTtcblxuY29uc3QgdGVsZW1ldHJ5QnVja2V0ID0gaW5jbHVkZWQuZ2V0UmVzb3VyY2UoJ1RlbGVtZXRyeUJ1Y2tldDcxMEZGMkM4JykgYXMgczMuQ2ZuQnVja2V0O1xuY29uc3QgdGVsZW1ldHJ5Q2FjaGVUYWJsZSA9IGluY2x1ZGVkLmdldFJlc291cmNlKCdUZWxlbWV0cnlDYWNoZUQyOUEwMzk1JykgYXMgZHluYW1vZGIuQ2ZuVGFibGU7XG5jb25zdCBkZXBlbmRlbmN5R3JhcGhUYWJsZSA9IGluY2x1ZGVkLmdldFJlc291cmNlKCdEZXBlbmRlbmN5R3JhcGgzMzI0ODMzRScpIGFzIGR5bmFtb2RiLkNmblRhYmxlO1xuY29uc3Qgc2lnbmF0dXJlc1RhYmxlID0gaW5jbHVkZWQuZ2V0UmVzb3VyY2UoJ1NpZ25hdHVyZXNUYWJsZTc5NzMzQTlDJykgYXMgZHluYW1vZGIuQ2ZuVGFibGU7XG5jb25zdCBldmVudEJ1cyA9IGluY2x1ZGVkLmdldFJlc291cmNlKCdFdmVudEJ1czdCODc0OEFBJykgYXMgZXZlbnRzLkNmbkV2ZW50QnVzO1xuXG5jb25zdCByZW1lZGlhdGlvblBsYW5zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUoc3RhY2ssICdSZW1lZGlhdGlvblBsYW5zVGFibGUnLCB7XG5cdHRhYmxlTmFtZTogJ0Nhc2NhZGVQcmV2ZW50aW9uLVJlbWVkaWF0aW9uUGxhbnMnLFxuXHRwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3BsYW5JZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG5cdGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG5cdHBvaW50SW5UaW1lUmVjb3ZlcnlTcGVjaWZpY2F0aW9uOiB7XG5cdFx0cG9pbnRJblRpbWVSZWNvdmVyeUVuYWJsZWQ6IHRydWUsXG5cdH0sXG5cdGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcblx0cmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxufSk7XG5cbmNvbnN0IGNhc2NhZGVBbGVydHNUb3BpYyA9IG5ldyBzbnMuVG9waWMoc3RhY2ssICdDYXNjYWRlQWxlcnRzVG9waWMnLCB7XG5cdGRpc3BsYXlOYW1lOiAnQ2FzY2FkZSBQcmV2ZW50aW9uIEFsZXJ0cycsXG59KTtcblxuY29uc3QgdGVsZW1ldHJ5SW5nZXN0RnVuY3Rpb24gPSBuZXcgTm9kZWpzRnVuY3Rpb24oc3RhY2ssICdUZWxlbWV0cnlJbmdlc3RGdW5jdGlvbicsIHtcblx0cnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG5cdGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vc3JjL3RlbGVtZXRyeS9pbmdlc3Rpb25faGFuZGxlci50cycpLFxuXHRoYW5kbGVyOiAnaGFuZGxlcicsXG5cdHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcblx0bWVtb3J5U2l6ZTogMjU2LFxuXHRlbnZpcm9ubWVudDoge1xuXHRcdFRFTEVNRVRSWV9CVUNLRVQ6IHRlbGVtZXRyeUJ1Y2tldC5yZWYsXG5cdFx0RVZFTlRfQlVTX05BTUU6IGV2ZW50QnVzLnJlZixcblx0XHRURUxFTUVUUllfQ0FDSEVfVEFCTEU6IHRlbGVtZXRyeUNhY2hlVGFibGUucmVmLFxuXHR9LFxufSk7XG5cbnRlbGVtZXRyeUluZ2VzdEZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG5cdGFjdGlvbnM6IFsnczM6UHV0T2JqZWN0J10sXG5cdHJlc291cmNlczogW2Ake3RlbGVtZXRyeUJ1Y2tldC5hdHRyQXJufS8qYF0sXG59KSk7XG50ZWxlbWV0cnlJbmdlc3RGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuXHRhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcblx0cmVzb3VyY2VzOiBbZXZlbnRCdXMuZ2V0QXR0KCdBcm4nKS50b1N0cmluZygpXSxcbn0pKTtcbnRlbGVtZXRyeUluZ2VzdEZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG5cdGFjdGlvbnM6IFsnZHluYW1vZGI6UHV0SXRlbSddLFxuXHRyZXNvdXJjZXM6IFt0ZWxlbWV0cnlDYWNoZVRhYmxlLmF0dHJBcm5dLFxufSkpO1xuXG5jb25zdCBzaWduYXR1cmVNYXRjaGVyVjJGdW5jdGlvbiA9IG5ldyBOb2RlanNGdW5jdGlvbihzdGFjaywgJ1NpZ25hdHVyZU1hdGNoZXJWMkZ1bmN0aW9uJywge1xuXHRydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcblx0ZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9zcmMvZGV0ZWN0aW9uL3NpZ25hdHVyZV9tYXRjaGVyX2hhbmRsZXIudHMnKSxcblx0aGFuZGxlcjogJ2hhbmRsZXInLFxuXHR0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG5cdG1lbW9yeVNpemU6IDI1Nixcblx0ZW52aXJvbm1lbnQ6IHtcblx0XHRTSUdOQVRVUkVTX1RBQkxFX05BTUU6IHNpZ25hdHVyZXNUYWJsZS5yZWYsXG5cdFx0RVZFTlRfQlVTX05BTUU6IGV2ZW50QnVzLnJlZixcblx0XHRBTEVSVF9UT1BJQ19BUk46IGNhc2NhZGVBbGVydHNUb3BpYy50b3BpY0Fybixcblx0fSxcbn0pO1xuXG5zaWduYXR1cmVNYXRjaGVyVjJGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuXHRhY3Rpb25zOiBbJ2R5bmFtb2RiOlB1dEl0ZW0nXSxcblx0cmVzb3VyY2VzOiBbc2lnbmF0dXJlc1RhYmxlLmF0dHJBcm5dLFxufSkpO1xuc2lnbmF0dXJlTWF0Y2hlclYyRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcblx0YWN0aW9uczogWydldmVudHM6UHV0RXZlbnRzJ10sXG5cdHJlc291cmNlczogW2V2ZW50QnVzLmdldEF0dCgnQXJuJykudG9TdHJpbmcoKV0sXG59KSk7XG5jYXNjYWRlQWxlcnRzVG9waWMuZ3JhbnRQdWJsaXNoKHNpZ25hdHVyZU1hdGNoZXJWMkZ1bmN0aW9uKTtcblxuY29uc3QgYW5vbWFseVRvU2lnbmF0dXJlVjJSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHN0YWNrLCAnQW5vbWFseVRvU2lnbmF0dXJlVjJSdWxlJywge1xuXHRldmVudFBhdHRlcm46IHtcblx0XHRzb3VyY2U6IFsnY2FzY2FkZS1wcmV2ZW50aW9uLmFub21hbHknXSxcblx0XHRkZXRhaWxUeXBlOiBbJ0Fub21hbHlEZXRlY3RlZCddLFxuXHR9LFxuXHRldmVudEJ1czogZXZlbnRzLkV2ZW50QnVzLmZyb21FdmVudEJ1c05hbWUoc3RhY2ssICdJbXBvcnRlZENhc2NhZGVFdmVudEJ1cycsIGV2ZW50QnVzLnJlZiksXG59KTtcbmFub21hbHlUb1NpZ25hdHVyZVYyUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oc2lnbmF0dXJlTWF0Y2hlclYyRnVuY3Rpb24pKTtcblxuY29uc3QgYXBpRnVuY3Rpb24gPSBuZXcgTm9kZWpzRnVuY3Rpb24oc3RhY2ssICdDYXNjYWRlQXBpRnVuY3Rpb24nLCB7XG5cdHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuXHRlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL3NyYy9hcGkvYXBpX2hhbmRsZXIudHMnKSxcblx0aGFuZGxlcjogJ2hhbmRsZXInLFxuXHR0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG5cdG1lbW9yeVNpemU6IDI1Nixcblx0ZW52aXJvbm1lbnQ6IHtcblx0XHRERVBFTkRFTkNZX0dSQVBIX1RBQkxFOiBkZXBlbmRlbmN5R3JhcGhUYWJsZS5yZWYsXG5cdFx0U0lHTkFUVVJFU19UQUJMRV9OQU1FOiBzaWduYXR1cmVzVGFibGUucmVmLFxuXHRcdFJFTUVESUFUSU9OX1BMQU5TX1RBQkxFOiByZW1lZGlhdGlvblBsYW5zVGFibGUudGFibGVOYW1lLFxuXHRcdEVWRU5UX0JVU19OQU1FOiBldmVudEJ1cy5yZWYsXG5cdFx0QUxFUlRfVE9QSUNfQVJOOiBjYXNjYWRlQWxlcnRzVG9waWMudG9waWNBcm4sXG5cdH0sXG59KTtcblxuYXBpRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcblx0YWN0aW9uczogWydkeW5hbW9kYjpHZXRJdGVtJywgJ2R5bmFtb2RiOlNjYW4nLCAnZHluYW1vZGI6UXVlcnknLCAnZHluYW1vZGI6UHV0SXRlbSddLFxuXHRyZXNvdXJjZXM6IFtcblx0XHRkZXBlbmRlbmN5R3JhcGhUYWJsZS5hdHRyQXJuLFxuXHRcdHNpZ25hdHVyZXNUYWJsZS5hdHRyQXJuLFxuXHRcdHJlbWVkaWF0aW9uUGxhbnNUYWJsZS50YWJsZUFybixcblx0XSxcbn0pKTtcbmFwaUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG5cdGFjdGlvbnM6IFsnZXZlbnRzOlB1dEV2ZW50cyddLFxuXHRyZXNvdXJjZXM6IFtldmVudEJ1cy5nZXRBdHQoJ0FybicpLnRvU3RyaW5nKCldLFxufSkpO1xuY2FzY2FkZUFsZXJ0c1RvcGljLmdyYW50UHVibGlzaChhcGlGdW5jdGlvbik7XG5cbmNvbnN0IHdlYmhvb2tOb3RpZmllckZ1bmN0aW9uID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHN0YWNrLCAnV2ViaG9va05vdGlmaWVyRnVuY3Rpb24nLCB7XG5cdHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuXHRlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL3NyYy9pbnRlZ3JhdGlvbnMvd2ViaG9va19ub3RpZmllcl9oYW5kbGVyLnRzJyksXG5cdGhhbmRsZXI6ICdoYW5kbGVyJyxcblx0dGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuXHRtZW1vcnlTaXplOiAyNTYsXG5cdGVudmlyb25tZW50OiB7XG5cdFx0V0VCSE9PS19VUkw6IHdlYmhvb2tVcmwsXG5cdFx0V0VCSE9PS19FTkFCTEVEOiB3ZWJob29rRW5hYmxlZCxcblx0fSxcbn0pO1xuXG5jb25zdCByZW1lZGlhdGlvbkFjdGlvbkV4ZWN1dG9yRnVuY3Rpb24gPSBuZXcgTm9kZWpzRnVuY3Rpb24oc3RhY2ssICdSZW1lZGlhdGlvbkFjdGlvbkV4ZWN1dG9yRnVuY3Rpb24nLCB7XG5cdHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuXHRlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL3NyYy9vcmNoZXN0cmF0aW9uL2FjdGlvbl9leGVjdXRvcl9oYW5kbGVyLnRzJyksXG5cdGhhbmRsZXI6ICdoYW5kbGVyJyxcblx0dGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuXHRtZW1vcnlTaXplOiAyNTYsXG5cdGVudmlyb25tZW50OiB7XG5cdFx0RVZFTlRfQlVTX05BTUU6IGV2ZW50QnVzLnJlZixcblx0fSxcbn0pO1xucmVtZWRpYXRpb25BY3Rpb25FeGVjdXRvckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG5cdGFjdGlvbnM6IFsnZXZlbnRzOlB1dEV2ZW50cyddLFxuXHRyZXNvdXJjZXM6IFtldmVudEJ1cy5nZXRBdHQoJ0FybicpLnRvU3RyaW5nKCldLFxufSkpO1xuXG5jb25zdCBleGVjdXRlQWN0aW9uU3RlcCA9IG5ldyBzZm5UYXNrcy5MYW1iZGFJbnZva2Uoc3RhY2ssICdFeGVjdXRlQWN0aW9uU3RlcCcsIHtcblx0bGFtYmRhRnVuY3Rpb246IHJlbWVkaWF0aW9uQWN0aW9uRXhlY3V0b3JGdW5jdGlvbixcblx0cGF5bG9hZDogc2ZuLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcblx0XHRwbGFuSWQ6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5wbGFuSWQnKSxcblx0XHRzaWduYXR1cmVJZDogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLnNpZ25hdHVyZUlkJyksXG5cdFx0bW9kZTogJ2V4ZWN1dGUnLFxuXHRcdGFjdGlvbjogc2ZuLkpzb25QYXRoLm9iamVjdEF0KCckJC5NYXAuSXRlbS5WYWx1ZScpLFxuXHR9KSxcblx0b3V0cHV0UGF0aDogJyQuUGF5bG9hZCcsXG59KTtcblxuY29uc3Qgcm9sbGJhY2tBY3Rpb25TdGVwID0gbmV3IHNmblRhc2tzLkxhbWJkYUludm9rZShzdGFjaywgJ1JvbGxiYWNrQWN0aW9uU3RlcCcsIHtcblx0bGFtYmRhRnVuY3Rpb246IHJlbWVkaWF0aW9uQWN0aW9uRXhlY3V0b3JGdW5jdGlvbixcblx0cGF5bG9hZDogc2ZuLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcblx0XHRwbGFuSWQ6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5wbGFuSWQnKSxcblx0XHRzaWduYXR1cmVJZDogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLnNpZ25hdHVyZUlkJyksXG5cdFx0bW9kZTogJ3JvbGxiYWNrJyxcblx0XHRhY3Rpb246IHNmbi5Kc29uUGF0aC5vYmplY3RBdCgnJCQuTWFwLkl0ZW0uVmFsdWUnKSxcblx0fSksXG5cdG91dHB1dFBhdGg6ICckLlBheWxvYWQnLFxufSk7XG5cbmNvbnN0IGV4ZWN1dGVBY3Rpb25zTWFwID0gbmV3IHNmbi5NYXAoc3RhY2ssICdFeGVjdXRlQWN0aW9uc01hcCcsIHtcblx0aXRlbXNQYXRoOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuYWN0aW9ucycpLFxuXHRtYXhDb25jdXJyZW5jeTogMSxcbn0pO1xuZXhlY3V0ZUFjdGlvbnNNYXAuaXRlbVByb2Nlc3NvcihleGVjdXRlQWN0aW9uU3RlcCk7XG5cbmNvbnN0IHJvbGxiYWNrQWN0aW9uc01hcCA9IG5ldyBzZm4uTWFwKHN0YWNrLCAnUm9sbGJhY2tBY3Rpb25zTWFwJywge1xuXHRpdGVtc1BhdGg6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5yb2xsYmFja0FjdGlvbnMnKSxcblx0bWF4Q29uY3VycmVuY3k6IDEsXG59KTtcbnJvbGxiYWNrQWN0aW9uc01hcC5pdGVtUHJvY2Vzc29yKHJvbGxiYWNrQWN0aW9uU3RlcCk7XG5cbmV4ZWN1dGVBY3Rpb25zTWFwLmFkZENhdGNoKHJvbGxiYWNrQWN0aW9uc01hcC5uZXh0KG5ldyBzZm4uRmFpbChzdGFjaywgJ1BsYW5FeGVjdXRpb25GYWlsZWQnKSkpO1xuXG5jb25zdCByZW1lZGlhdGlvblN0YXRlTWFjaGluZSA9IG5ldyBzZm4uU3RhdGVNYWNoaW5lKHN0YWNrLCAnUmVtZWRpYXRpb25TdGF0ZU1hY2hpbmUnLCB7XG5cdGRlZmluaXRpb25Cb2R5OiBzZm4uRGVmaW5pdGlvbkJvZHkuZnJvbUNoYWluYWJsZShleGVjdXRlQWN0aW9uc01hcC5uZXh0KG5ldyBzZm4uU3VjY2VlZChzdGFjaywgJ1BsYW5FeGVjdXRpb25TdWNjZWVkZWQnKSkpLFxuXHR0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMDApLFxufSk7XG5cbmNvbnN0IHJlbWVkaWF0aW9uUGxhbm5lckZ1bmN0aW9uID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHN0YWNrLCAnUmVtZWRpYXRpb25QbGFubmVyRnVuY3Rpb24nLCB7XG5cdHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuXHRlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL3NyYy9vcmNoZXN0cmF0aW9uL3JlbWVkaWF0aW9uX3BsYW5uZXJfaGFuZGxlci50cycpLFxuXHRoYW5kbGVyOiAnaGFuZGxlcicsXG5cdHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcblx0bWVtb3J5U2l6ZTogMjU2LFxuXHRlbnZpcm9ubWVudDoge1xuXHRcdFJFTUVESUFUSU9OX1BMQU5TX1RBQkxFOiByZW1lZGlhdGlvblBsYW5zVGFibGUudGFibGVOYW1lLFxuXHRcdEVWRU5UX0JVU19OQU1FOiBldmVudEJ1cy5yZWYsXG5cdFx0UkVNRURJQVRJT05fU1RBVEVfTUFDSElORV9BUk46IHJlbWVkaWF0aW9uU3RhdGVNYWNoaW5lLnN0YXRlTWFjaGluZUFybixcblx0fSxcbn0pO1xucmVtZWRpYXRpb25QbGFubmVyRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcblx0YWN0aW9uczogWydkeW5hbW9kYjpQdXRJdGVtJ10sXG5cdHJlc291cmNlczogW3JlbWVkaWF0aW9uUGxhbnNUYWJsZS50YWJsZUFybl0sXG59KSk7XG5yZW1lZGlhdGlvblBsYW5uZXJGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuXHRhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcblx0cmVzb3VyY2VzOiBbZXZlbnRCdXMuZ2V0QXR0KCdBcm4nKS50b1N0cmluZygpXSxcbn0pKTtcbnJlbWVkaWF0aW9uUGxhbm5lckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG5cdGFjdGlvbnM6IFsnc3RhdGVzOlN0YXJ0RXhlY3V0aW9uJ10sXG5cdHJlc291cmNlczogW3JlbWVkaWF0aW9uU3RhdGVNYWNoaW5lLnN0YXRlTWFjaGluZUFybl0sXG59KSk7XG5cbmNvbnN0IHByZWRpY3Rpb25Ub1JlbWVkaWF0aW9uUnVsZSA9IG5ldyBldmVudHMuUnVsZShzdGFjaywgJ1ByZWRpY3Rpb25Ub1JlbWVkaWF0aW9uUnVsZScsIHtcblx0ZXZlbnRQYXR0ZXJuOiB7XG5cdFx0c291cmNlOiBbJ2Nhc2NhZGUtcHJldmVudGlvbi5wcmVkaWN0aW9uJ10sXG5cdFx0ZGV0YWlsVHlwZTogWydDYXNjYWRlUGF0aFByZWRpY3RlZCddLFxuXHR9LFxuXHRldmVudEJ1czogZXZlbnRzLkV2ZW50QnVzLmZyb21FdmVudEJ1c05hbWUoc3RhY2ssICdQcmVkaWN0aW9uRXZlbnRCdXMnLCBldmVudEJ1cy5yZWYpLFxufSk7XG5wcmVkaWN0aW9uVG9SZW1lZGlhdGlvblJ1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKHJlbWVkaWF0aW9uUGxhbm5lckZ1bmN0aW9uKSk7XG5cbmNvbnN0IGludGVncmF0aW9uRXZlbnRSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHN0YWNrLCAnSW50ZWdyYXRpb25FdmVudFJ1bGUnLCB7XG5cdGV2ZW50UGF0dGVybjoge1xuXHRcdHNvdXJjZTogW1xuXHRcdFx0J2Nhc2NhZGUtcHJldmVudGlvbi5zaWduYXR1cmUnLFxuXHRcdFx0J2Nhc2NhZGUtcHJldmVudGlvbi5wcmVkaWN0aW9uJyxcblx0XHRcdCdjYXNjYWRlLXByZXZlbnRpb24ucmVtZWRpYXRpb24nLFxuXHRcdF0sXG5cdFx0ZGV0YWlsVHlwZTogW1xuXHRcdFx0J0Nhc2NhZGVTaWduYXR1cmVEZXRlY3RlZCcsXG5cdFx0XHQnQ2FzY2FkZVBhdGhQcmVkaWN0ZWQnLFxuXHRcdFx0J1JlbWVkaWF0aW9uQWN0aW9uUmVjb3JkZWQnLFxuXHRcdF0sXG5cdH0sXG5cdGV2ZW50QnVzOiBldmVudHMuRXZlbnRCdXMuZnJvbUV2ZW50QnVzTmFtZShzdGFjaywgJ0ludGVncmF0aW9uRXZlbnRCdXMnLCBldmVudEJ1cy5yZWYpLFxufSk7XG5pbnRlZ3JhdGlvbkV2ZW50UnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24od2ViaG9va05vdGlmaWVyRnVuY3Rpb24pKTtcblxuY29uc3QgYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaShzdGFjaywgJ0Nhc2NhZGVQcmV2ZW50aW9uQXBpJywge1xuXHRyZXN0QXBpTmFtZTogJ0Nhc2NhZGVQcmV2ZW50aW9uQXBpJyxcblx0ZGVzY3JpcHRpb246ICdNVlAgQVBJIGZvciBjYXNjYWRlIHByZXZlbnRpb24gdGVsZW1ldHJ5IGFuZCBvcGVyYXRvciBpbnRlcmZhY2VzJyxcblx0ZGVwbG95T3B0aW9uczogeyBzdGFnZU5hbWU6ICd2MScgfSxcbn0pO1xuXG5jb25zdCB1c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHN0YWNrLCAnQ2FzY2FkZVByZXZlbnRpb25Vc2VyUG9vbCcsIHtcblx0dXNlclBvb2xOYW1lOiAnQ2FzY2FkZVByZXZlbnRpb25Vc2VycycsXG5cdHNlbGZTaWduVXBFbmFibGVkOiBmYWxzZSxcblx0c2lnbkluQWxpYXNlczogeyBlbWFpbDogdHJ1ZSB9LFxuXHRzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcblx0XHRlbWFpbDogeyByZXF1aXJlZDogdHJ1ZSwgbXV0YWJsZTogZmFsc2UgfSxcblx0fSxcblx0cGFzc3dvcmRQb2xpY3k6IHtcblx0XHRtaW5MZW5ndGg6IDEyLFxuXHRcdHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG5cdFx0cmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcblx0XHRyZXF1aXJlRGlnaXRzOiB0cnVlLFxuXHRcdHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxuXHR9LFxuXHRtZmE6IGNvZ25pdG8uTWZhLk9QVElPTkFMLFxuXHRhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXG5cdHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbn0pO1xuXG5jb25zdCB1c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KHN0YWNrLCAnQ2FzY2FkZVByZXZlbnRpb25Vc2VyUG9vbENsaWVudCcsIHtcblx0dXNlclBvb2wsXG5cdGdlbmVyYXRlU2VjcmV0OiBmYWxzZSxcblx0YXV0aEZsb3dzOiB7XG5cdFx0dXNlclBhc3N3b3JkOiB0cnVlLFxuXHRcdHVzZXJTcnA6IHRydWUsXG5cdH0sXG59KTtcblxuY29uc3QgY29nbml0b0F1dGhvcml6ZXIgPSBuZXcgYXBpZ2F0ZXdheS5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplcihzdGFjaywgJ0Nhc2NhZGVBcGlBdXRob3JpemVyJywge1xuXHRjb2duaXRvVXNlclBvb2xzOiBbdXNlclBvb2xdLFxufSk7XG5cbmNvbnN0IHByb3RlY3RlZE1ldGhvZE9wdGlvbnM6IGFwaWdhdGV3YXkuTWV0aG9kT3B0aW9ucyA9IHtcblx0YXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcblx0YXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG5cdGFwaUtleVJlcXVpcmVkOiB0cnVlLFxufTtcblxuY29uc3QgdGVsZW1ldHJ5ID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3RlbGVtZXRyeScpO1xuY29uc3QgaW5nZXN0ID0gdGVsZW1ldHJ5LmFkZFJlc291cmNlKCdpbmdlc3QnKTtcbmluZ2VzdC5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0ZWxlbWV0cnlJbmdlc3RGdW5jdGlvbiksIHtcblx0YXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuSUFNLFxufSk7XG5cbmNvbnN0IGRlcGVuZGVuY3lHcmFwaCA9IGFwaS5yb290LmFkZFJlc291cmNlKCdkZXBlbmRlbmN5LWdyYXBoJyk7XG5jb25zdCBkZXBlbmRlbmN5R3JhcGhHZXRNZXRob2QgPSBkZXBlbmRlbmN5R3JhcGguYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlGdW5jdGlvbiksIHByb3RlY3RlZE1ldGhvZE9wdGlvbnMpO1xuXG5jb25zdCBjYXNjYWRlU2lnbmF0dXJlcyA9IGFwaS5yb290LmFkZFJlc291cmNlKCdjYXNjYWRlLXNpZ25hdHVyZXMnKTtcbmNvbnN0IGFjdGl2ZVNpZ25hdHVyZXMgPSBjYXNjYWRlU2lnbmF0dXJlcy5hZGRSZXNvdXJjZSgnYWN0aXZlJyk7XG5jb25zdCBhY3RpdmVTaWduYXR1cmVzR2V0TWV0aG9kID0gYWN0aXZlU2lnbmF0dXJlcy5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaUZ1bmN0aW9uKSwgcHJvdGVjdGVkTWV0aG9kT3B0aW9ucyk7XG5cbmNvbnN0IHJlbWVkaWF0aW9uUGxhbnMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgncmVtZWRpYXRpb24tcGxhbnMnKTtcbmNvbnN0IHJlbWVkaWF0aW9uUGxhbnNHZXRNZXRob2QgPSByZW1lZGlhdGlvblBsYW5zLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXBpRnVuY3Rpb24pLCBwcm90ZWN0ZWRNZXRob2RPcHRpb25zKTtcbmNvbnN0IHBsYW5CeUlkID0gcmVtZWRpYXRpb25QbGFucy5hZGRSZXNvdXJjZSgne3BsYW5JZH0nKTtcbmNvbnN0IGFwcHJvdmFsID0gcGxhbkJ5SWQuYWRkUmVzb3VyY2UoJ2FwcHJvdmFsJyk7XG5jb25zdCBhcHByb3ZhbFBvc3RNZXRob2QgPSBhcHByb3ZhbC5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlGdW5jdGlvbiksIHByb3RlY3RlZE1ldGhvZE9wdGlvbnMpO1xuXG5jb25zdCBhcGlLZXkgPSBhcGkuYWRkQXBpS2V5KCdDYXNjYWRlT3BlcmF0b3JBcGlLZXknLCB7XG5cdGFwaUtleU5hbWU6ICdDYXNjYWRlT3BlcmF0b3JBcGlLZXknLFxufSk7XG5cbmNvbnN0IHVzYWdlUGxhbiA9IGFwaS5hZGRVc2FnZVBsYW4oJ0Nhc2NhZGVBcGlVc2FnZVBsYW4nLCB7XG5cdG5hbWU6ICdDYXNjYWRlQXBpVXNhZ2VQbGFuJyxcblx0dGhyb3R0bGU6IHtcblx0XHRidXJzdExpbWl0OiAyMDAsXG5cdFx0cmF0ZUxpbWl0OiAxMDAwIC8gNjAsXG5cdH0sXG59KTtcblxudXNhZ2VQbGFuLmFkZEFwaUtleShhcGlLZXkpO1xudXNhZ2VQbGFuLmFkZEFwaVN0YWdlKHtcblx0YXBpLFxuXHRzdGFnZTogYXBpLmRlcGxveW1lbnRTdGFnZSxcblx0dGhyb3R0bGU6IFtcblx0XHR7XG5cdFx0XHRtZXRob2Q6IGRlcGVuZGVuY3lHcmFwaEdldE1ldGhvZCxcblx0XHRcdHRocm90dGxlOiB7XG5cdFx0XHRcdGJ1cnN0TGltaXQ6IDIwMCxcblx0XHRcdFx0cmF0ZUxpbWl0OiAxMDAwIC8gNjAsXG5cdFx0XHR9LFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0bWV0aG9kOiBhY3RpdmVTaWduYXR1cmVzR2V0TWV0aG9kLFxuXHRcdFx0dGhyb3R0bGU6IHtcblx0XHRcdFx0YnVyc3RMaW1pdDogMjAwLFxuXHRcdFx0XHRyYXRlTGltaXQ6IDEwMDAgLyA2MCxcblx0XHRcdH0sXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRtZXRob2Q6IHJlbWVkaWF0aW9uUGxhbnNHZXRNZXRob2QsXG5cdFx0XHR0aHJvdHRsZToge1xuXHRcdFx0XHRidXJzdExpbWl0OiAyMDAsXG5cdFx0XHRcdHJhdGVMaW1pdDogMTAwMCAvIDYwLFxuXHRcdFx0fSxcblx0XHR9LFxuXHRcdHtcblx0XHRcdG1ldGhvZDogYXBwcm92YWxQb3N0TWV0aG9kLFxuXHRcdFx0dGhyb3R0bGU6IHtcblx0XHRcdFx0YnVyc3RMaW1pdDogMjAwLFxuXHRcdFx0XHRyYXRlTGltaXQ6IDEwMDAgLyA2MCxcblx0XHRcdH0sXG5cdFx0fSxcblx0XSxcbn0pO1xuXG5uZXcgY2RrLkNmbk91dHB1dChzdGFjaywgJ0Nhc2NhZGVQcmV2ZW50aW9uVXNlclBvb2xJZCcsIHtcblx0dmFsdWU6IHVzZXJQb29sLnVzZXJQb29sSWQsXG59KTtcblxubmV3IGNkay5DZm5PdXRwdXQoc3RhY2ssICdDYXNjYWRlUHJldmVudGlvblVzZXJQb29sQ2xpZW50SWQnLCB7XG5cdHZhbHVlOiB1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxufSk7XG5cbm5ldyBjZGsuQ2ZuT3V0cHV0KHN0YWNrLCAnQ2FzY2FkZU9wZXJhdG9yQXBpS2V5SWQnLCB7XG5cdHZhbHVlOiBhcGlLZXkua2V5SWQsXG59KTtcbiJdfQ==