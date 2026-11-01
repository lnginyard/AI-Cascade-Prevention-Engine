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
const acm = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
const cloudformation_include_1 = require("aws-cdk-lib/cloudformation-include");
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
const route53Targets = __importStar(require("aws-cdk-lib/aws-route53-targets"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const s3deploy = __importStar(require("aws-cdk-lib/aws-s3-deployment"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const snsSubscriptions = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
const sfn = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const sfnTasks = __importStar(require("aws-cdk-lib/aws-stepfunctions-tasks"));
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
const path = __importStar(require("path"));
const playbook_mappings_construct_1 = require("../lib/playbook-mappings-construct");
const app = new cdk.App({ analyticsReporting: false });
const cdkAccount = process.env.CDK_DEFAULT_ACCOUNT;
const cdkRegion = process.env.CDK_DEFAULT_REGION;
const stack = new cdk.Stack(app, 'CascadePreventionStack', cdkAccount && cdkRegion
    ? { env: { account: cdkAccount, region: cdkRegion } }
    : undefined);
function parseCsvContext(value) {
    if (!value)
        return [];
    const values = Array.isArray(value) ? value : value.split(',');
    return values
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}
const configuredWebhookUrl = app.node.tryGetContext('webhookUrl');
const configuredSlackWebhookUrl = app.node.tryGetContext('slackWebhookUrl');
const configuredTeamsWebhookUrl = app.node.tryGetContext('teamsWebhookUrl');
const configuredStatuspageWebhookUrl = app.node.tryGetContext('statuspageWebhookUrl');
const configuredAllowedOrigins = parseCsvContext(app.node.tryGetContext('allowedOrigins'));
const configuredExecutiveEmails = parseCsvContext(app.node.tryGetContext('executiveEmails'));
const configuredStakeholderEmails = parseCsvContext(app.node.tryGetContext('stakeholderEmails'));
const configuredStakeholderSms = parseCsvContext(app.node.tryGetContext('stakeholderSms'));
const remediationExecutionEnabled = app.node.tryGetContext('remediationExecutionEnabled') === true;
const webhookUrl = configuredWebhookUrl ?? '';
const slackWebhookUrl = configuredSlackWebhookUrl ?? '';
const teamsWebhookUrl = configuredTeamsWebhookUrl ?? '';
const statuspageWebhookUrl = configuredStatuspageWebhookUrl ?? '';
const webhookEnabled = (configuredWebhookUrl || configuredSlackWebhookUrl || configuredTeamsWebhookUrl || configuredStatuspageWebhookUrl) ? 'true' : 'false';
const contextUiDomainName = app.node.tryGetContext('uiDomainName');
const contextUiHostedZoneDomain = app.node.tryGetContext('uiHostedZoneDomain');
const contextArticleDomainName = app.node.tryGetContext('articleDomainName');
const contextArticleHostedZoneDomain = app.node.tryGetContext('articleHostedZoneDomain');
const canUseCustomDomains = Boolean(cdkAccount && cdkRegion);
const allowedOrigins = configuredAllowedOrigins.length > 0 ? configuredAllowedOrigins : ['https://aicpe.dev'];
if (!canUseCustomDomains && (contextUiDomainName || contextArticleDomainName)) {
    console.warn('Custom domain context detected, but CDK_DEFAULT_ACCOUNT/CDK_DEFAULT_REGION are not set. Falling back to CloudFront domains for synth.');
}
const uiDomainName = canUseCustomDomains ? contextUiDomainName : undefined;
const uiHostedZoneDomain = canUseCustomDomains ? contextUiHostedZoneDomain : undefined;
const articleDomainName = canUseCustomDomains ? contextArticleDomainName : undefined;
const articleHostedZoneDomain = canUseCustomDomains ? contextArticleHostedZoneDomain : undefined;
function resolveRecordName(domainName, zoneName) {
    if (domainName === zoneName) {
        return undefined;
    }
    const suffix = `.${zoneName}`;
    if (domainName.endsWith(suffix)) {
        return domainName.slice(0, -suffix.length);
    }
    return domainName;
}
function createStaticSite(config) {
    const websiteBucket = new s3.Bucket(stack, `${config.id}Bucket`, {
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        autoDeleteObjects: false,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    let hostedZone;
    let certificate;
    if (config.domainName && config.hostedZoneDomain) {
        hostedZone = route53.HostedZone.fromLookup(stack, `${config.id}HostedZone`, {
            domainName: config.hostedZoneDomain,
        });
        certificate = new acm.DnsValidatedCertificate(stack, `${config.id}Certificate`, {
            domainName: config.domainName,
            hostedZone,
            region: 'us-east-1',
        });
    }
    const distribution = new cloudfront.Distribution(stack, `${config.id}Distribution`, {
        certificate,
        domainNames: config.domainName ? [config.domainName] : undefined,
        defaultRootObject: 'index.html',
        defaultBehavior: {
            origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            compress: true,
        },
        errorResponses: config.spa
            ? [
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: cdk.Duration.minutes(5),
                },
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: cdk.Duration.minutes(5),
                },
            ]
            : undefined,
        comment: config.description,
    });
    new s3deploy.BucketDeployment(stack, `${config.id}Deployment`, {
        destinationBucket: websiteBucket,
        distribution,
        distributionPaths: ['/*'],
        sources: [s3deploy.Source.asset(config.assetPath)],
    });
    if (hostedZone && config.domainName) {
        const recordName = resolveRecordName(config.domainName, hostedZone.zoneName);
        new route53.ARecord(stack, `${config.id}AliasRecord`, {
            zone: hostedZone,
            recordName,
            target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
        });
        new route53.AaaaRecord(stack, `${config.id}AliasRecordIpv6`, {
            zone: hostedZone,
            recordName,
            target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
        });
    }
    new cdk.CfnOutput(stack, `${config.id}BucketName`, {
        value: websiteBucket.bucketName,
    });
    new cdk.CfnOutput(stack, `${config.id}CloudFrontDomain`, {
        value: distribution.distributionDomainName,
    });
    new cdk.CfnOutput(stack, `${config.id}Url`, {
        value: config.domainName ? `https://${config.domainName}` : `https://${distribution.distributionDomainName}`,
    });
    return {
        bucket: websiteBucket,
        distribution,
    };
}
const included = new cloudformation_include_1.CfnInclude(stack, 'CascadePreventionTemplate', {
    templateFile: 'cfn-template.yaml',
});
createStaticSite({
    id: 'OperationsConsole',
    assetPath: path.join(__dirname, '../ui'),
    domainName: uiDomainName,
    hostedZoneDomain: uiHostedZoneDomain,
    spa: true,
    description: 'Cascade Prevention Engine operations console',
});
createStaticSite({
    id: 'ArticleSite',
    assetPath: path.join(__dirname, '../article'),
    domainName: articleDomainName,
    hostedZoneDomain: articleHostedZoneDomain,
    spa: false,
    description: 'Cascade Prevention Engine article site',
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
const encryptionKey = included.getResource('EncryptionKey1B843E66');
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
const auditEventsTable = new dynamodb.Table(stack, 'AuditEventsTable', {
    tableName: 'CascadePrevention-AuditEvents',
    partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'eventKey', type: dynamodb.AttributeType.STRING },
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
const notificationEmails = [...new Set([...configuredExecutiveEmails, ...configuredStakeholderEmails])];
for (const email of notificationEmails) {
    cascadeAlertsTopic.addSubscription(new snsSubscriptions.EmailSubscription(email));
}
for (const smsNumber of configuredStakeholderSms) {
    cascadeAlertsTopic.addSubscription(new snsSubscriptions.SmsSubscription(smsNumber));
}
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
    actions: ['kms:GenerateDataKey', 'kms:Decrypt'],
    resources: [encryptionKey.attrArn],
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
    actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
    resources: [encryptionKey.attrArn],
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
        AUDIT_EVENTS_TABLE: auditEventsTable.tableName,
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
        auditEventsTable.tableArn,
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
        SLACK_WEBHOOK_URL: slackWebhookUrl,
        TEAMS_WEBHOOK_URL: teamsWebhookUrl,
        STATUSPAGE_WEBHOOK_URL: statuspageWebhookUrl,
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
        REMEDIATION_EXECUTION_ENABLED: String(remediationExecutionEnabled),
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
    description: 'Enterprise foundation API for cascade-risk telemetry and governed operator actions',
    deployOptions: { stageName: 'v1' },
    defaultCorsPreflightOptions: {
        allowOrigins: allowedOrigins,
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
new cdk.CfnOutput(stack, 'CascadePreventionApiUrl', {
    value: api.url,
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vaW5mcmFzdHJ1Y3R1cmUvYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHdFQUEwRDtBQUMxRCwrRUFBZ0U7QUFDaEUsdUVBQXlEO0FBQ3pELGlFQUFtRDtBQUNuRCx1RUFBeUQ7QUFDekQsNEVBQThEO0FBQzlELG1FQUFxRDtBQUNyRCwrREFBaUQ7QUFDakQsd0VBQTBEO0FBQzFELHlEQUEyQztBQUMzQywrREFBaUQ7QUFFakQsaUVBQW1EO0FBQ25ELGdGQUFrRTtBQUNsRSx1REFBeUM7QUFDekMsd0VBQTBEO0FBQzFELHlEQUEyQztBQUMzQyxvRkFBc0U7QUFDdEUsbUVBQXFEO0FBQ3JELDhFQUFnRTtBQUNoRSxxRUFBK0Q7QUFDL0QsMkNBQTZCO0FBQzdCLG9GQUFzRTtBQUV0RSxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxrQkFBa0IsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0FBQ3ZELE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUM7QUFDbkQsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQztBQUNqRCxNQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLHdCQUF3QixFQUFFLFVBQVUsSUFBSSxTQUFTO0lBQ2pGLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxFQUFFO0lBQ3JELENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUVkLFNBQVMsZUFBZSxDQUFDLEtBQW9DO0lBQzVELElBQUksQ0FBQyxLQUFLO1FBQUUsT0FBTyxFQUFFLENBQUM7SUFDdEIsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQy9ELE9BQU8sTUFBTTtTQUNYLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1NBQzFCLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNyQyxDQUFDO0FBRUQsTUFBTSxvQkFBb0IsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQXVCLENBQUM7QUFDeEYsTUFBTSx5QkFBeUIsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBdUIsQ0FBQztBQUNsRyxNQUFNLHlCQUF5QixHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGlCQUFpQixDQUF1QixDQUFDO0FBQ2xHLE1BQU0sOEJBQThCLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsc0JBQXNCLENBQXVCLENBQUM7QUFDNUcsTUFBTSx3QkFBd0IsR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQWtDLENBQUMsQ0FBQztBQUM1SCxNQUFNLHlCQUF5QixHQUFHLGVBQWUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBdUIsQ0FBQyxDQUFDO0FBQ25ILE1BQU0sMkJBQTJCLEdBQUcsZUFBZSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLG1CQUFtQixDQUF1QixDQUFDLENBQUM7QUFDdkgsTUFBTSx3QkFBd0IsR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQXVCLENBQUMsQ0FBQztBQUNqSCxNQUFNLDJCQUEyQixHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLDZCQUE2QixDQUFDLEtBQUssSUFBSSxDQUFDO0FBQ25HLE1BQU0sVUFBVSxHQUFHLG9CQUFvQixJQUFJLEVBQUUsQ0FBQztBQUM5QyxNQUFNLGVBQWUsR0FBRyx5QkFBeUIsSUFBSSxFQUFFLENBQUM7QUFDeEQsTUFBTSxlQUFlLEdBQUcseUJBQXlCLElBQUksRUFBRSxDQUFDO0FBQ3hELE1BQU0sb0JBQW9CLEdBQUcsOEJBQThCLElBQUksRUFBRSxDQUFDO0FBQ2xFLE1BQU0sY0FBYyxHQUFHLENBQUMsb0JBQW9CLElBQUkseUJBQXlCLElBQUkseUJBQXlCLElBQUksOEJBQThCLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFDN0osTUFBTSxtQkFBbUIsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQXVCLENBQUM7QUFDekYsTUFBTSx5QkFBeUIsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxvQkFBb0IsQ0FBdUIsQ0FBQztBQUNyRyxNQUFNLHdCQUF3QixHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLG1CQUFtQixDQUF1QixDQUFDO0FBQ25HLE1BQU0sOEJBQThCLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMseUJBQXlCLENBQXVCLENBQUM7QUFDL0csTUFBTSxtQkFBbUIsR0FBRyxPQUFPLENBQUMsVUFBVSxJQUFJLFNBQVMsQ0FBQyxDQUFDO0FBQzdELE1BQU0sY0FBYyxHQUFHLHdCQUF3QixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUM7QUFFOUcsSUFBSSxDQUFDLG1CQUFtQixJQUFJLENBQUMsbUJBQW1CLElBQUksd0JBQXdCLENBQUMsRUFBRSxDQUFDO0lBQy9FLE9BQU8sQ0FBQyxJQUFJLENBQUMsdUlBQXVJLENBQUMsQ0FBQztBQUN2SixDQUFDO0FBRUQsTUFBTSxZQUFZLEdBQUcsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDM0UsTUFBTSxrQkFBa0IsR0FBRyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMseUJBQXlCLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUN2RixNQUFNLGlCQUFpQixHQUFHLG1CQUFtQixDQUFDLENBQUMsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQ3JGLE1BQU0sdUJBQXVCLEdBQUcsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLDhCQUE4QixDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFXakcsU0FBUyxpQkFBaUIsQ0FBQyxVQUFrQixFQUFFLFFBQWdCO0lBQzlELElBQUksVUFBVSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQzdCLE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFFRCxNQUFNLE1BQU0sR0FBRyxJQUFJLFFBQVEsRUFBRSxDQUFDO0lBQzlCLElBQUksVUFBVSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1FBQ2pDLE9BQU8sVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVELE9BQU8sVUFBVSxDQUFDO0FBQ25CLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLE1BQXdCO0lBQ2pELE1BQU0sYUFBYSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsR0FBRyxNQUFNLENBQUMsRUFBRSxRQUFRLEVBQUU7UUFDaEUsVUFBVSxFQUFFLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVO1FBQzFDLGlCQUFpQixFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTO1FBQ2pELFVBQVUsRUFBRSxJQUFJO1FBQ2hCLGlCQUFpQixFQUFFLEtBQUs7UUFDeEIsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtLQUN2QyxDQUFDLENBQUM7SUFFSCxJQUFJLFVBQTJDLENBQUM7SUFDaEQsSUFBSSxXQUF5QyxDQUFDO0lBRTlDLElBQUksTUFBTSxDQUFDLFVBQVUsSUFBSSxNQUFNLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUNsRCxVQUFVLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLEdBQUcsTUFBTSxDQUFDLEVBQUUsWUFBWSxFQUFFO1lBQzNFLFVBQVUsRUFBRSxNQUFNLENBQUMsZ0JBQWdCO1NBQ25DLENBQUMsQ0FBQztRQUVILFdBQVcsR0FBRyxJQUFJLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLEVBQUUsR0FBRyxNQUFNLENBQUMsRUFBRSxhQUFhLEVBQUU7WUFDL0UsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVO1lBQzdCLFVBQVU7WUFDVixNQUFNLEVBQUUsV0FBVztTQUNuQixDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsTUFBTSxZQUFZLEdBQUcsSUFBSSxVQUFVLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxHQUFHLE1BQU0sQ0FBQyxFQUFFLGNBQWMsRUFBRTtRQUNuRixXQUFXO1FBQ1gsV0FBVyxFQUFFLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO1FBQ2hFLGlCQUFpQixFQUFFLFlBQVk7UUFDL0IsZUFBZSxFQUFFO1lBQ2hCLE1BQU0sRUFBRSxPQUFPLENBQUMsY0FBYyxDQUFDLHVCQUF1QixDQUFDLGFBQWEsQ0FBQztZQUNyRSxvQkFBb0IsRUFBRSxVQUFVLENBQUMsb0JBQW9CLENBQUMsaUJBQWlCO1lBQ3ZFLFFBQVEsRUFBRSxJQUFJO1NBQ2Q7UUFDRCxjQUFjLEVBQUUsTUFBTSxDQUFDLEdBQUc7WUFDekIsQ0FBQyxDQUFDO2dCQUNEO29CQUNDLFVBQVUsRUFBRSxHQUFHO29CQUNmLGtCQUFrQixFQUFFLEdBQUc7b0JBQ3ZCLGdCQUFnQixFQUFFLGFBQWE7b0JBQy9CLEdBQUcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7aUJBQzVCO2dCQUNEO29CQUNDLFVBQVUsRUFBRSxHQUFHO29CQUNmLGtCQUFrQixFQUFFLEdBQUc7b0JBQ3ZCLGdCQUFnQixFQUFFLGFBQWE7b0JBQy9CLEdBQUcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7aUJBQzVCO2FBQ0Q7WUFDRCxDQUFDLENBQUMsU0FBUztRQUNaLE9BQU8sRUFBRSxNQUFNLENBQUMsV0FBVztLQUMzQixDQUFDLENBQUM7SUFFSCxJQUFJLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsR0FBRyxNQUFNLENBQUMsRUFBRSxZQUFZLEVBQUU7UUFDOUQsaUJBQWlCLEVBQUUsYUFBYTtRQUNoQyxZQUFZO1FBQ1osaUJBQWlCLEVBQUUsQ0FBQyxJQUFJLENBQUM7UUFDekIsT0FBTyxFQUFFLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0tBQ2xELENBQUMsQ0FBQztJQUVILElBQUksVUFBVSxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNyQyxNQUFNLFVBQVUsR0FBRyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUU3RSxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsTUFBTSxDQUFDLEVBQUUsYUFBYSxFQUFFO1lBQ3JELElBQUksRUFBRSxVQUFVO1lBQ2hCLFVBQVU7WUFDVixNQUFNLEVBQUUsT0FBTyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsSUFBSSxjQUFjLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLENBQUM7U0FDekYsQ0FBQyxDQUFDO1FBRUgsSUFBSSxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBRSxHQUFHLE1BQU0sQ0FBQyxFQUFFLGlCQUFpQixFQUFFO1lBQzVELElBQUksRUFBRSxVQUFVO1lBQ2hCLFVBQVU7WUFDVixNQUFNLEVBQUUsT0FBTyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsSUFBSSxjQUFjLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLENBQUM7U0FDekYsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsR0FBRyxNQUFNLENBQUMsRUFBRSxZQUFZLEVBQUU7UUFDbEQsS0FBSyxFQUFFLGFBQWEsQ0FBQyxVQUFVO0tBQy9CLENBQUMsQ0FBQztJQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsR0FBRyxNQUFNLENBQUMsRUFBRSxrQkFBa0IsRUFBRTtRQUN4RCxLQUFLLEVBQUUsWUFBWSxDQUFDLHNCQUFzQjtLQUMxQyxDQUFDLENBQUM7SUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLEdBQUcsTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFO1FBQzNDLEtBQUssRUFBRSxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxXQUFXLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUMsV0FBVyxZQUFZLENBQUMsc0JBQXNCLEVBQUU7S0FDNUcsQ0FBQyxDQUFDO0lBRUgsT0FBTztRQUNOLE1BQU0sRUFBRSxhQUFhO1FBQ3JCLFlBQVk7S0FDWixDQUFDO0FBQ0gsQ0FBQztBQUVELE1BQU0sUUFBUSxHQUFHLElBQUksbUNBQVUsQ0FBQyxLQUFLLEVBQUUsMkJBQTJCLEVBQUU7SUFDbkUsWUFBWSxFQUFFLG1CQUFtQjtDQUNqQyxDQUFDLENBQUM7QUFFSCxnQkFBZ0IsQ0FBQztJQUNoQixFQUFFLEVBQUUsbUJBQW1CO0lBQ3ZCLFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUM7SUFDeEMsVUFBVSxFQUFFLFlBQVk7SUFDeEIsZ0JBQWdCLEVBQUUsa0JBQWtCO0lBQ3BDLEdBQUcsRUFBRSxJQUFJO0lBQ1QsV0FBVyxFQUFFLDhDQUE4QztDQUMzRCxDQUFDLENBQUM7QUFFSCxnQkFBZ0IsQ0FBQztJQUNoQixFQUFFLEVBQUUsYUFBYTtJQUNqQixTQUFTLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsWUFBWSxDQUFDO0lBQzdDLFVBQVUsRUFBRSxpQkFBaUI7SUFDN0IsZ0JBQWdCLEVBQUUsdUJBQXVCO0lBQ3pDLEdBQUcsRUFBRSxLQUFLO0lBQ1YsV0FBVyxFQUFFLHdDQUF3QztDQUNyRCxDQUFDLENBQUM7QUFFSCxNQUFNLGdCQUFnQixHQUFHLElBQUksOENBQWdCLENBQUMsS0FBSyxFQUFFLGtCQUFrQixFQUFFO0lBQ3hFLFNBQVMsRUFBRSxvQ0FBb0M7SUFDL0MsWUFBWSxFQUFFLG9DQUFvQztDQUNsRCxDQUFDLENBQUM7QUFFSCxNQUFNLGVBQWUsR0FBRyxRQUFRLENBQUMsV0FBVyxDQUFDLHlCQUF5QixDQUFpQixDQUFDO0FBQ3hGLE1BQU0sbUJBQW1CLEdBQUcsUUFBUSxDQUFDLFdBQVcsQ0FBQyx3QkFBd0IsQ0FBc0IsQ0FBQztBQUNoRyxNQUFNLG9CQUFvQixHQUFHLFFBQVEsQ0FBQyxXQUFXLENBQUMseUJBQXlCLENBQXNCLENBQUM7QUFDbEcsTUFBTSxlQUFlLEdBQUcsUUFBUSxDQUFDLFdBQVcsQ0FBQyx5QkFBeUIsQ0FBc0IsQ0FBQztBQUM3RixNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUF1QixDQUFDO0FBQ2hGLE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxXQUFXLENBQUMsdUJBQXVCLENBQWUsQ0FBQztBQUVsRixNQUFNLHFCQUFxQixHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsdUJBQXVCLEVBQUU7SUFDaEYsU0FBUyxFQUFFLG9DQUFvQztJQUMvQyxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtJQUNyRSxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO0lBQ2pELGdDQUFnQyxFQUFFO1FBQ2pDLDBCQUEwQixFQUFFLElBQUk7S0FDaEM7SUFDRCxVQUFVLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQyxXQUFXO0lBQ2hELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07Q0FDdkMsQ0FBQyxDQUFDO0FBRUgsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLGtCQUFrQixFQUFFO0lBQ3RFLFNBQVMsRUFBRSwrQkFBK0I7SUFDMUMsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7SUFDdkUsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7SUFDbEUsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtJQUNqRCxnQ0FBZ0MsRUFBRTtRQUNqQywwQkFBMEIsRUFBRSxJQUFJO0tBQ2hDO0lBQ0QsVUFBVSxFQUFFLFFBQVEsQ0FBQyxlQUFlLENBQUMsV0FBVztJQUNoRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNO0NBQ3ZDLENBQUMsQ0FBQztBQUVILE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxvQkFBb0IsRUFBRTtJQUNyRSxXQUFXLEVBQUUsMkJBQTJCO0NBQ3hDLENBQUMsQ0FBQztBQUVILE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLENBQUMsR0FBRyx5QkFBeUIsRUFBRSxHQUFHLDJCQUEyQixDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3hHLEtBQUssTUFBTSxLQUFLLElBQUksa0JBQWtCLEVBQUUsQ0FBQztJQUN4QyxrQkFBa0IsQ0FBQyxlQUFlLENBQUMsSUFBSSxnQkFBZ0IsQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ25GLENBQUM7QUFFRCxLQUFLLE1BQU0sU0FBUyxJQUFJLHdCQUF3QixFQUFFLENBQUM7SUFDbEQsa0JBQWtCLENBQUMsZUFBZSxDQUFDLElBQUksZ0JBQWdCLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDckYsQ0FBQztBQUVELE1BQU0sdUJBQXVCLEdBQUcsSUFBSSxrQ0FBYyxDQUFDLEtBQUssRUFBRSx5QkFBeUIsRUFBRTtJQUNwRixPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO0lBQ25DLEtBQUssRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSx1Q0FBdUMsQ0FBQztJQUNwRSxPQUFPLEVBQUUsU0FBUztJQUNsQixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO0lBQ2pDLFVBQVUsRUFBRSxHQUFHO0lBQ2YsV0FBVyxFQUFFO1FBQ1osZ0JBQWdCLEVBQUUsZUFBZSxDQUFDLEdBQUc7UUFDckMsY0FBYyxFQUFFLFFBQVEsQ0FBQyxHQUFHO1FBQzVCLHFCQUFxQixFQUFFLG1CQUFtQixDQUFDLEdBQUc7S0FDOUM7Q0FDRCxDQUFDLENBQUM7QUFFSCx1QkFBdUIsQ0FBQyxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO0lBQy9ELE9BQU8sRUFBRSxDQUFDLGNBQWMsQ0FBQztJQUN6QixTQUFTLEVBQUUsQ0FBQyxHQUFHLGVBQWUsQ0FBQyxPQUFPLElBQUksQ0FBQztDQUMzQyxDQUFDLENBQUMsQ0FBQztBQUNKLHVCQUF1QixDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7SUFDL0QsT0FBTyxFQUFFLENBQUMscUJBQXFCLEVBQUUsYUFBYSxDQUFDO0lBQy9DLFNBQVMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUM7Q0FDbEMsQ0FBQyxDQUFDLENBQUM7QUFDSix1QkFBdUIsQ0FBQyxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO0lBQy9ELE9BQU8sRUFBRSxDQUFDLGtCQUFrQixDQUFDO0lBQzdCLFNBQVMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7Q0FDOUMsQ0FBQyxDQUFDLENBQUM7QUFDSix1QkFBdUIsQ0FBQyxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO0lBQy9ELE9BQU8sRUFBRSxDQUFDLGtCQUFrQixDQUFDO0lBQzdCLFNBQVMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQztDQUN4QyxDQUFDLENBQUMsQ0FBQztBQUVKLE1BQU0sMEJBQTBCLEdBQUcsSUFBSSxrQ0FBYyxDQUFDLEtBQUssRUFBRSw0QkFBNEIsRUFBRTtJQUMxRixPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO0lBQ25DLEtBQUssRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSwrQ0FBK0MsQ0FBQztJQUM1RSxPQUFPLEVBQUUsU0FBUztJQUNsQixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO0lBQ2pDLFVBQVUsRUFBRSxHQUFHO0lBQ2YsV0FBVyxFQUFFO1FBQ1oscUJBQXFCLEVBQUUsZUFBZSxDQUFDLEdBQUc7UUFDMUMsY0FBYyxFQUFFLFFBQVEsQ0FBQyxHQUFHO1FBQzVCLGVBQWUsRUFBRSxrQkFBa0IsQ0FBQyxRQUFRO0tBQzVDO0NBQ0QsQ0FBQyxDQUFDO0FBRUgsMEJBQTBCLENBQUMsZUFBZSxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztJQUNsRSxPQUFPLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQztJQUM3QixTQUFTLEVBQUUsQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDO0NBQ3BDLENBQUMsQ0FBQyxDQUFDO0FBQ0osMEJBQTBCLENBQUMsZUFBZSxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztJQUNsRSxPQUFPLEVBQUUsQ0FBQyxhQUFhLEVBQUUscUJBQXFCLENBQUM7SUFDL0MsU0FBUyxFQUFFLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQztDQUNsQyxDQUFDLENBQUMsQ0FBQztBQUNKLDBCQUEwQixDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7SUFDbEUsT0FBTyxFQUFFLENBQUMsa0JBQWtCLENBQUM7SUFDN0IsU0FBUyxFQUFFLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztDQUM5QyxDQUFDLENBQUMsQ0FBQztBQUNKLGtCQUFrQixDQUFDLFlBQVksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO0FBRTVELE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSwwQkFBMEIsRUFBRTtJQUNuRixZQUFZLEVBQUU7UUFDYixNQUFNLEVBQUUsQ0FBQyw0QkFBNEIsQ0FBQztRQUN0QyxVQUFVLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQztLQUMvQjtJQUNELFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSx5QkFBeUIsRUFBRSxRQUFRLENBQUMsR0FBRyxDQUFDO0NBQzFGLENBQUMsQ0FBQztBQUNILHdCQUF3QixDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxjQUFjLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDO0FBRTNGLE1BQU0sV0FBVyxHQUFHLElBQUksa0NBQWMsQ0FBQyxLQUFLLEVBQUUsb0JBQW9CLEVBQUU7SUFDbkUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztJQUNuQyxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsMkJBQTJCLENBQUM7SUFDeEQsT0FBTyxFQUFFLFNBQVM7SUFDbEIsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztJQUNqQyxVQUFVLEVBQUUsR0FBRztJQUNmLFdBQVcsRUFBRTtRQUNaLHNCQUFzQixFQUFFLG9CQUFvQixDQUFDLEdBQUc7UUFDaEQscUJBQXFCLEVBQUUsZUFBZSxDQUFDLEdBQUc7UUFDMUMsdUJBQXVCLEVBQUUscUJBQXFCLENBQUMsU0FBUztRQUN4RCxrQkFBa0IsRUFBRSxnQkFBZ0IsQ0FBQyxTQUFTO1FBQzlDLGNBQWMsRUFBRSxRQUFRLENBQUMsR0FBRztRQUM1QixlQUFlLEVBQUUsa0JBQWtCLENBQUMsUUFBUTtLQUM1QztDQUNELENBQUMsQ0FBQztBQUVILFdBQVcsQ0FBQyxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO0lBQ25ELE9BQU8sRUFBRSxDQUFDLGtCQUFrQixFQUFFLGVBQWUsRUFBRSxnQkFBZ0IsRUFBRSxrQkFBa0IsQ0FBQztJQUNwRixTQUFTLEVBQUU7UUFDVixvQkFBb0IsQ0FBQyxPQUFPO1FBQzVCLGVBQWUsQ0FBQyxPQUFPO1FBQ3ZCLHFCQUFxQixDQUFDLFFBQVE7UUFDOUIsZ0JBQWdCLENBQUMsUUFBUTtLQUN6QjtDQUNELENBQUMsQ0FBQyxDQUFDO0FBQ0osV0FBVyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7SUFDbkQsT0FBTyxFQUFFLENBQUMsa0JBQWtCLENBQUM7SUFDN0IsU0FBUyxFQUFFLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztDQUM5QyxDQUFDLENBQUMsQ0FBQztBQUNKLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUU3QyxNQUFNLHVCQUF1QixHQUFHLElBQUksa0NBQWMsQ0FBQyxLQUFLLEVBQUUseUJBQXlCLEVBQUU7SUFDcEYsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztJQUNuQyxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsaURBQWlELENBQUM7SUFDOUUsT0FBTyxFQUFFLFNBQVM7SUFDbEIsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztJQUNqQyxVQUFVLEVBQUUsR0FBRztJQUNmLFdBQVcsRUFBRTtRQUNaLFdBQVcsRUFBRSxVQUFVO1FBQ3ZCLGlCQUFpQixFQUFFLGVBQWU7UUFDbEMsaUJBQWlCLEVBQUUsZUFBZTtRQUNsQyxzQkFBc0IsRUFBRSxvQkFBb0I7UUFDNUMsZUFBZSxFQUFFLGNBQWM7S0FDL0I7Q0FDRCxDQUFDLENBQUM7QUFFSCxNQUFNLGlDQUFpQyxHQUFHLElBQUksa0NBQWMsQ0FBQyxLQUFLLEVBQUUsbUNBQW1DLEVBQUU7SUFDeEcsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztJQUNuQyxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsaURBQWlELENBQUM7SUFDOUUsT0FBTyxFQUFFLFNBQVM7SUFDbEIsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztJQUNqQyxVQUFVLEVBQUUsR0FBRztJQUNmLFdBQVcsRUFBRTtRQUNaLGNBQWMsRUFBRSxRQUFRLENBQUMsR0FBRztLQUM1QjtDQUNELENBQUMsQ0FBQztBQUNILGlDQUFpQyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7SUFDekUsT0FBTyxFQUFFLENBQUMsa0JBQWtCLENBQUM7SUFDN0IsU0FBUyxFQUFFLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztDQUM5QyxDQUFDLENBQUMsQ0FBQztBQUVKLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxRQUFRLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxtQkFBbUIsRUFBRTtJQUMvRSxjQUFjLEVBQUUsaUNBQWlDO0lBQ2pELE9BQU8sRUFBRSxHQUFHLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQztRQUNqQyxNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDO1FBQ3pDLFdBQVcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUM7UUFDbkQsSUFBSSxFQUFFLFNBQVM7UUFDZixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsbUJBQW1CLENBQUM7S0FDbEQsQ0FBQztJQUNGLFVBQVUsRUFBRSxXQUFXO0NBQ3ZCLENBQUMsQ0FBQztBQUVILE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxRQUFRLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxvQkFBb0IsRUFBRTtJQUNqRixjQUFjLEVBQUUsaUNBQWlDO0lBQ2pELE9BQU8sRUFBRSxHQUFHLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQztRQUNqQyxNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDO1FBQ3pDLFdBQVcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUM7UUFDbkQsSUFBSSxFQUFFLFVBQVU7UUFDaEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDO0tBQ2xELENBQUM7SUFDRixVQUFVLEVBQUUsV0FBVztDQUN2QixDQUFDLENBQUM7QUFFSCxNQUFNLGlCQUFpQixHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsbUJBQW1CLEVBQUU7SUFDakUsU0FBUyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQztJQUM3QyxjQUFjLEVBQUUsQ0FBQztDQUNqQixDQUFDLENBQUM7QUFDSCxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUVuRCxNQUFNLGtCQUFrQixHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsb0JBQW9CLEVBQUU7SUFDbkUsU0FBUyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDO0lBQ3JELGNBQWMsRUFBRSxDQUFDO0NBQ2pCLENBQUMsQ0FBQztBQUNILGtCQUFrQixDQUFDLGFBQWEsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBRXJELGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUVoRyxNQUFNLHVCQUF1QixHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUUseUJBQXlCLEVBQUU7SUFDdEYsY0FBYyxFQUFFLEdBQUcsQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLHdCQUF3QixDQUFDLENBQUMsQ0FBQztJQUMxSCxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDO0NBQ2xDLENBQUMsQ0FBQztBQUVILE1BQU0sMEJBQTBCLEdBQUcsSUFBSSxrQ0FBYyxDQUFDLEtBQUssRUFBRSw0QkFBNEIsRUFBRTtJQUMxRixPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO0lBQ25DLEtBQUssRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxxREFBcUQsQ0FBQztJQUNsRixPQUFPLEVBQUUsU0FBUztJQUNsQixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO0lBQ2pDLFVBQVUsRUFBRSxHQUFHO0lBQ2YsV0FBVyxFQUFFO1FBQ1osdUJBQXVCLEVBQUUscUJBQXFCLENBQUMsU0FBUztRQUN4RCxjQUFjLEVBQUUsUUFBUSxDQUFDLEdBQUc7UUFDNUIsNkJBQTZCLEVBQUUsdUJBQXVCLENBQUMsZUFBZTtRQUN0RSw2QkFBNkIsRUFBRSxNQUFNLENBQUMsMkJBQTJCLENBQUM7S0FDbEU7Q0FDRCxDQUFDLENBQUM7QUFDSCwwQkFBMEIsQ0FBQyxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO0lBQ2xFLE9BQU8sRUFBRSxDQUFDLGtCQUFrQixDQUFDO0lBQzdCLFNBQVMsRUFBRSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBQztDQUMzQyxDQUFDLENBQUMsQ0FBQztBQUNKLDBCQUEwQixDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7SUFDbEUsT0FBTyxFQUFFLENBQUMsa0JBQWtCLENBQUM7SUFDN0IsU0FBUyxFQUFFLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztDQUM5QyxDQUFDLENBQUMsQ0FBQztBQUNKLDBCQUEwQixDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7SUFDbEUsT0FBTyxFQUFFLENBQUMsdUJBQXVCLENBQUM7SUFDbEMsU0FBUyxFQUFFLENBQUMsdUJBQXVCLENBQUMsZUFBZSxDQUFDO0NBQ3BELENBQUMsQ0FBQyxDQUFDO0FBRUosTUFBTSwyQkFBMkIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLDZCQUE2QixFQUFFO0lBQ3pGLFlBQVksRUFBRTtRQUNiLE1BQU0sRUFBRSxDQUFDLCtCQUErQixDQUFDO1FBQ3pDLFVBQVUsRUFBRSxDQUFDLHNCQUFzQixDQUFDO0tBQ3BDO0lBQ0QsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLG9CQUFvQixFQUFFLFFBQVEsQ0FBQyxHQUFHLENBQUM7Q0FDckYsQ0FBQyxDQUFDO0FBQ0gsMkJBQTJCLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxDQUFDLGNBQWMsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUM7QUFFOUYsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLHNCQUFzQixFQUFFO0lBQzNFLFlBQVksRUFBRTtRQUNiLE1BQU0sRUFBRTtZQUNQLDhCQUE4QjtZQUM5QiwrQkFBK0I7WUFDL0IsZ0NBQWdDO1NBQ2hDO1FBQ0QsVUFBVSxFQUFFO1lBQ1gsMEJBQTBCO1lBQzFCLHNCQUFzQjtZQUN0QiwyQkFBMkI7U0FDM0I7S0FDRDtJQUNELFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxxQkFBcUIsRUFBRSxRQUFRLENBQUMsR0FBRyxDQUFDO0NBQ3RGLENBQUMsQ0FBQztBQUNILG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxjQUFjLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUFDO0FBRXBGLE1BQU0sR0FBRyxHQUFHLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsc0JBQXNCLEVBQUU7SUFDakUsV0FBVyxFQUFFLHNCQUFzQjtJQUNuQyxXQUFXLEVBQUUsb0ZBQW9GO0lBQ2pHLGFBQWEsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUU7SUFDbEMsMkJBQTJCLEVBQUU7UUFDNUIsWUFBWSxFQUFFLGNBQWM7UUFDNUIsWUFBWSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVztRQUN6QyxZQUFZLEVBQUUsQ0FBQyxjQUFjLEVBQUUsZUFBZSxFQUFFLFdBQVcsQ0FBQztLQUM1RDtDQUNELENBQUMsQ0FBQztBQUVILE1BQU0sUUFBUSxHQUFHLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsMkJBQTJCLEVBQUU7SUFDekUsWUFBWSxFQUFFLHdCQUF3QjtJQUN0QyxpQkFBaUIsRUFBRSxLQUFLO0lBQ3hCLGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7SUFDOUIsa0JBQWtCLEVBQUU7UUFDbkIsS0FBSyxFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFO0tBQ3pDO0lBQ0QsY0FBYyxFQUFFO1FBQ2YsU0FBUyxFQUFFLEVBQUU7UUFDYixnQkFBZ0IsRUFBRSxJQUFJO1FBQ3RCLGdCQUFnQixFQUFFLElBQUk7UUFDdEIsYUFBYSxFQUFFLElBQUk7UUFDbkIsY0FBYyxFQUFFLElBQUk7S0FDcEI7SUFDRCxHQUFHLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRO0lBQ3pCLGVBQWUsRUFBRSxPQUFPLENBQUMsZUFBZSxDQUFDLFVBQVU7SUFDbkQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtDQUN2QyxDQUFDLENBQUM7QUFFSCxNQUFNLGNBQWMsR0FBRyxJQUFJLE9BQU8sQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFFLGlDQUFpQyxFQUFFO0lBQzNGLFFBQVE7SUFDUixjQUFjLEVBQUUsS0FBSztJQUNyQixTQUFTLEVBQUU7UUFDVixZQUFZLEVBQUUsSUFBSTtRQUNsQixPQUFPLEVBQUUsSUFBSTtLQUNiO0NBQ0QsQ0FBQyxDQUFDO0FBRUgsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLFVBQVUsQ0FBQywwQkFBMEIsQ0FBQyxLQUFLLEVBQUUsc0JBQXNCLEVBQUU7SUFDbEcsZ0JBQWdCLEVBQUUsQ0FBQyxRQUFRLENBQUM7Q0FDNUIsQ0FBQyxDQUFDO0FBRUgsTUFBTSxzQkFBc0IsR0FBNkI7SUFDeEQsaUJBQWlCLEVBQUUsVUFBVSxDQUFDLGlCQUFpQixDQUFDLE9BQU87SUFDdkQsVUFBVSxFQUFFLGlCQUFpQjtJQUM3QixjQUFjLEVBQUUsSUFBSTtDQUNwQixDQUFDO0FBRUYsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDcEQsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMvQyxNQUFNLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFO0lBQ25GLGlCQUFpQixFQUFFLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHO0NBQ25ELENBQUMsQ0FBQztBQUVILE1BQU0sZUFBZSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLENBQUM7QUFDakUsTUFBTSx3QkFBd0IsR0FBRyxlQUFlLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO0FBRXpJLE1BQU0saUJBQWlCLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsb0JBQW9CLENBQUMsQ0FBQztBQUNyRSxNQUFNLGdCQUFnQixHQUFHLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNqRSxNQUFNLHlCQUF5QixHQUFHLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsV0FBVyxDQUFDLEVBQUUsc0JBQXNCLENBQUMsQ0FBQztBQUUzSSxNQUFNLGdCQUFnQixHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLG1CQUFtQixDQUFDLENBQUM7QUFDbkUsTUFBTSx5QkFBeUIsR0FBRyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxFQUFFLHNCQUFzQixDQUFDLENBQUM7QUFDM0ksTUFBTSxRQUFRLEdBQUcsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQzFELE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDbEQsTUFBTSxrQkFBa0IsR0FBRyxRQUFRLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO0FBRTdILE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxTQUFTLENBQUMsdUJBQXVCLEVBQUU7SUFDckQsVUFBVSxFQUFFLHVCQUF1QjtDQUNuQyxDQUFDLENBQUM7QUFFSCxNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUMsWUFBWSxDQUFDLHFCQUFxQixFQUFFO0lBQ3pELElBQUksRUFBRSxxQkFBcUI7SUFDM0IsUUFBUSxFQUFFO1FBQ1QsVUFBVSxFQUFFLEdBQUc7UUFDZixTQUFTLEVBQUUsSUFBSSxHQUFHLEVBQUU7S0FDcEI7Q0FDRCxDQUFDLENBQUM7QUFFSCxTQUFTLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzVCLFNBQVMsQ0FBQyxXQUFXLENBQUM7SUFDckIsR0FBRztJQUNILEtBQUssRUFBRSxHQUFHLENBQUMsZUFBZTtJQUMxQixRQUFRLEVBQUU7UUFDVDtZQUNDLE1BQU0sRUFBRSx3QkFBd0I7WUFDaEMsUUFBUSxFQUFFO2dCQUNULFVBQVUsRUFBRSxHQUFHO2dCQUNmLFNBQVMsRUFBRSxJQUFJLEdBQUcsRUFBRTthQUNwQjtTQUNEO1FBQ0Q7WUFDQyxNQUFNLEVBQUUseUJBQXlCO1lBQ2pDLFFBQVEsRUFBRTtnQkFDVCxVQUFVLEVBQUUsR0FBRztnQkFDZixTQUFTLEVBQUUsSUFBSSxHQUFHLEVBQUU7YUFDcEI7U0FDRDtRQUNEO1lBQ0MsTUFBTSxFQUFFLHlCQUF5QjtZQUNqQyxRQUFRLEVBQUU7Z0JBQ1QsVUFBVSxFQUFFLEdBQUc7Z0JBQ2YsU0FBUyxFQUFFLElBQUksR0FBRyxFQUFFO2FBQ3BCO1NBQ0Q7UUFDRDtZQUNDLE1BQU0sRUFBRSxrQkFBa0I7WUFDMUIsUUFBUSxFQUFFO2dCQUNULFVBQVUsRUFBRSxHQUFHO2dCQUNmLFNBQVMsRUFBRSxJQUFJLEdBQUcsRUFBRTthQUNwQjtTQUNEO0tBQ0Q7Q0FDRCxDQUFDLENBQUM7QUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLDZCQUE2QixFQUFFO0lBQ3ZELEtBQUssRUFBRSxRQUFRLENBQUMsVUFBVTtDQUMxQixDQUFDLENBQUM7QUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLG1DQUFtQyxFQUFFO0lBQzdELEtBQUssRUFBRSxjQUFjLENBQUMsZ0JBQWdCO0NBQ3RDLENBQUMsQ0FBQztBQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUseUJBQXlCLEVBQUU7SUFDbkQsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFLO0NBQ25CLENBQUMsQ0FBQztBQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUseUJBQXlCLEVBQUU7SUFDbkQsS0FBSyxFQUFFLEdBQUcsQ0FBQyxHQUFHO0NBQ2QsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGFjbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2VydGlmaWNhdGVtYW5hZ2VyJztcbmltcG9ydCB7IENmbkluY2x1ZGUgfSBmcm9tICdhd3MtY2RrLWxpYi9jbG91ZGZvcm1hdGlvbi1pbmNsdWRlJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMga21zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1rbXMnO1xuaW1wb3J0ICogYXMgcm91dGU1MyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtcm91dGU1Myc7XG5pbXBvcnQgKiBhcyByb3V0ZTUzVGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtcm91dGU1My10YXJnZXRzJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBzM2RlcGxveSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMtZGVwbG95bWVudCc7XG5pbXBvcnQgKiBhcyBzbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucyc7XG5pbXBvcnQgKiBhcyBzbnNTdWJzY3JpcHRpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMtc3Vic2NyaXB0aW9ucyc7XG5pbXBvcnQgKiBhcyBzZm4gZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgc2ZuVGFza3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMtdGFza3MnO1xuaW1wb3J0IHsgTm9kZWpzRnVuY3Rpb24gfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLW5vZGVqcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgUGxheWJvb2tNYXBwaW5ncyB9IGZyb20gJy4uL2xpYi9wbGF5Ym9vay1tYXBwaW5ncy1jb25zdHJ1Y3QnO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCh7IGFuYWx5dGljc1JlcG9ydGluZzogZmFsc2UgfSk7XG5jb25zdCBjZGtBY2NvdW50ID0gcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVDtcbmNvbnN0IGNka1JlZ2lvbiA9IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTjtcbmNvbnN0IHN0YWNrID0gbmV3IGNkay5TdGFjayhhcHAsICdDYXNjYWRlUHJldmVudGlvblN0YWNrJywgY2RrQWNjb3VudCAmJiBjZGtSZWdpb25cblx0PyB7IGVudjogeyBhY2NvdW50OiBjZGtBY2NvdW50LCByZWdpb246IGNka1JlZ2lvbiB9IH1cblx0OiB1bmRlZmluZWQpO1xuXG5mdW5jdGlvbiBwYXJzZUNzdkNvbnRleHQodmFsdWU6IHN0cmluZyB8IHN0cmluZ1tdIHwgdW5kZWZpbmVkKTogc3RyaW5nW10ge1xuXHRpZiAoIXZhbHVlKSByZXR1cm4gW107XG5cdGNvbnN0IHZhbHVlcyA9IEFycmF5LmlzQXJyYXkodmFsdWUpID8gdmFsdWUgOiB2YWx1ZS5zcGxpdCgnLCcpO1xuXHRyZXR1cm4gdmFsdWVzXG5cdFx0Lm1hcCgoaXRlbSkgPT4gaXRlbS50cmltKCkpXG5cdFx0LmZpbHRlcigoaXRlbSkgPT4gaXRlbS5sZW5ndGggPiAwKTtcbn1cblxuY29uc3QgY29uZmlndXJlZFdlYmhvb2tVcmwgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCd3ZWJob29rVXJsJykgYXMgc3RyaW5nIHwgdW5kZWZpbmVkO1xuY29uc3QgY29uZmlndXJlZFNsYWNrV2ViaG9va1VybCA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ3NsYWNrV2ViaG9va1VybCcpIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbmNvbnN0IGNvbmZpZ3VyZWRUZWFtc1dlYmhvb2tVcmwgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCd0ZWFtc1dlYmhvb2tVcmwnKSBhcyBzdHJpbmcgfCB1bmRlZmluZWQ7XG5jb25zdCBjb25maWd1cmVkU3RhdHVzcGFnZVdlYmhvb2tVcmwgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdzdGF0dXNwYWdlV2ViaG9va1VybCcpIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbmNvbnN0IGNvbmZpZ3VyZWRBbGxvd2VkT3JpZ2lucyA9IHBhcnNlQ3N2Q29udGV4dChhcHAubm9kZS50cnlHZXRDb250ZXh0KCdhbGxvd2VkT3JpZ2lucycpIGFzIHN0cmluZyB8IHN0cmluZ1tdIHwgdW5kZWZpbmVkKTtcbmNvbnN0IGNvbmZpZ3VyZWRFeGVjdXRpdmVFbWFpbHMgPSBwYXJzZUNzdkNvbnRleHQoYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnZXhlY3V0aXZlRW1haWxzJykgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKTtcbmNvbnN0IGNvbmZpZ3VyZWRTdGFrZWhvbGRlckVtYWlscyA9IHBhcnNlQ3N2Q29udGV4dChhcHAubm9kZS50cnlHZXRDb250ZXh0KCdzdGFrZWhvbGRlckVtYWlscycpIGFzIHN0cmluZyB8IHVuZGVmaW5lZCk7XG5jb25zdCBjb25maWd1cmVkU3Rha2Vob2xkZXJTbXMgPSBwYXJzZUNzdkNvbnRleHQoYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnc3Rha2Vob2xkZXJTbXMnKSBhcyBzdHJpbmcgfCB1bmRlZmluZWQpO1xuY29uc3QgcmVtZWRpYXRpb25FeGVjdXRpb25FbmFibGVkID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgncmVtZWRpYXRpb25FeGVjdXRpb25FbmFibGVkJykgPT09IHRydWU7XG5jb25zdCB3ZWJob29rVXJsID0gY29uZmlndXJlZFdlYmhvb2tVcmwgPz8gJyc7XG5jb25zdCBzbGFja1dlYmhvb2tVcmwgPSBjb25maWd1cmVkU2xhY2tXZWJob29rVXJsID8/ICcnO1xuY29uc3QgdGVhbXNXZWJob29rVXJsID0gY29uZmlndXJlZFRlYW1zV2ViaG9va1VybCA/PyAnJztcbmNvbnN0IHN0YXR1c3BhZ2VXZWJob29rVXJsID0gY29uZmlndXJlZFN0YXR1c3BhZ2VXZWJob29rVXJsID8/ICcnO1xuY29uc3Qgd2ViaG9va0VuYWJsZWQgPSAoY29uZmlndXJlZFdlYmhvb2tVcmwgfHwgY29uZmlndXJlZFNsYWNrV2ViaG9va1VybCB8fCBjb25maWd1cmVkVGVhbXNXZWJob29rVXJsIHx8IGNvbmZpZ3VyZWRTdGF0dXNwYWdlV2ViaG9va1VybCkgPyAndHJ1ZScgOiAnZmFsc2UnO1xuY29uc3QgY29udGV4dFVpRG9tYWluTmFtZSA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ3VpRG9tYWluTmFtZScpIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbmNvbnN0IGNvbnRleHRVaUhvc3RlZFpvbmVEb21haW4gPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCd1aUhvc3RlZFpvbmVEb21haW4nKSBhcyBzdHJpbmcgfCB1bmRlZmluZWQ7XG5jb25zdCBjb250ZXh0QXJ0aWNsZURvbWFpbk5hbWUgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdhcnRpY2xlRG9tYWluTmFtZScpIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbmNvbnN0IGNvbnRleHRBcnRpY2xlSG9zdGVkWm9uZURvbWFpbiA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ2FydGljbGVIb3N0ZWRab25lRG9tYWluJykgYXMgc3RyaW5nIHwgdW5kZWZpbmVkO1xuY29uc3QgY2FuVXNlQ3VzdG9tRG9tYWlucyA9IEJvb2xlYW4oY2RrQWNjb3VudCAmJiBjZGtSZWdpb24pO1xuY29uc3QgYWxsb3dlZE9yaWdpbnMgPSBjb25maWd1cmVkQWxsb3dlZE9yaWdpbnMubGVuZ3RoID4gMCA/IGNvbmZpZ3VyZWRBbGxvd2VkT3JpZ2lucyA6IFsnaHR0cHM6Ly9haWNwZS5kZXYnXTtcblxuaWYgKCFjYW5Vc2VDdXN0b21Eb21haW5zICYmIChjb250ZXh0VWlEb21haW5OYW1lIHx8IGNvbnRleHRBcnRpY2xlRG9tYWluTmFtZSkpIHtcblx0Y29uc29sZS53YXJuKCdDdXN0b20gZG9tYWluIGNvbnRleHQgZGV0ZWN0ZWQsIGJ1dCBDREtfREVGQVVMVF9BQ0NPVU5UL0NES19ERUZBVUxUX1JFR0lPTiBhcmUgbm90IHNldC4gRmFsbGluZyBiYWNrIHRvIENsb3VkRnJvbnQgZG9tYWlucyBmb3Igc3ludGguJyk7XG59XG5cbmNvbnN0IHVpRG9tYWluTmFtZSA9IGNhblVzZUN1c3RvbURvbWFpbnMgPyBjb250ZXh0VWlEb21haW5OYW1lIDogdW5kZWZpbmVkO1xuY29uc3QgdWlIb3N0ZWRab25lRG9tYWluID0gY2FuVXNlQ3VzdG9tRG9tYWlucyA/IGNvbnRleHRVaUhvc3RlZFpvbmVEb21haW4gOiB1bmRlZmluZWQ7XG5jb25zdCBhcnRpY2xlRG9tYWluTmFtZSA9IGNhblVzZUN1c3RvbURvbWFpbnMgPyBjb250ZXh0QXJ0aWNsZURvbWFpbk5hbWUgOiB1bmRlZmluZWQ7XG5jb25zdCBhcnRpY2xlSG9zdGVkWm9uZURvbWFpbiA9IGNhblVzZUN1c3RvbURvbWFpbnMgPyBjb250ZXh0QXJ0aWNsZUhvc3RlZFpvbmVEb21haW4gOiB1bmRlZmluZWQ7XG5cbnR5cGUgU3RhdGljU2l0ZUNvbmZpZyA9IHtcblx0aWQ6IHN0cmluZztcblx0YXNzZXRQYXRoOiBzdHJpbmc7XG5cdGRvbWFpbk5hbWU/OiBzdHJpbmc7XG5cdGhvc3RlZFpvbmVEb21haW4/OiBzdHJpbmc7XG5cdHNwYTogYm9vbGVhbjtcblx0ZGVzY3JpcHRpb246IHN0cmluZztcbn07XG5cbmZ1bmN0aW9uIHJlc29sdmVSZWNvcmROYW1lKGRvbWFpbk5hbWU6IHN0cmluZywgem9uZU5hbWU6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdGlmIChkb21haW5OYW1lID09PSB6b25lTmFtZSkge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRjb25zdCBzdWZmaXggPSBgLiR7em9uZU5hbWV9YDtcblx0aWYgKGRvbWFpbk5hbWUuZW5kc1dpdGgoc3VmZml4KSkge1xuXHRcdHJldHVybiBkb21haW5OYW1lLnNsaWNlKDAsIC1zdWZmaXgubGVuZ3RoKTtcblx0fVxuXG5cdHJldHVybiBkb21haW5OYW1lO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVTdGF0aWNTaXRlKGNvbmZpZzogU3RhdGljU2l0ZUNvbmZpZykge1xuXHRjb25zdCB3ZWJzaXRlQnVja2V0ID0gbmV3IHMzLkJ1Y2tldChzdGFjaywgYCR7Y29uZmlnLmlkfUJ1Y2tldGAsIHtcblx0XHRlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG5cdFx0YmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcblx0XHRlbmZvcmNlU1NMOiB0cnVlLFxuXHRcdGF1dG9EZWxldGVPYmplY3RzOiBmYWxzZSxcblx0XHRyZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG5cdH0pO1xuXG5cdGxldCBob3N0ZWRab25lOiByb3V0ZTUzLklIb3N0ZWRab25lIHwgdW5kZWZpbmVkO1xuXHRsZXQgY2VydGlmaWNhdGU6IGFjbS5JQ2VydGlmaWNhdGUgfCB1bmRlZmluZWQ7XG5cblx0aWYgKGNvbmZpZy5kb21haW5OYW1lICYmIGNvbmZpZy5ob3N0ZWRab25lRG9tYWluKSB7XG5cdFx0aG9zdGVkWm9uZSA9IHJvdXRlNTMuSG9zdGVkWm9uZS5mcm9tTG9va3VwKHN0YWNrLCBgJHtjb25maWcuaWR9SG9zdGVkWm9uZWAsIHtcblx0XHRcdGRvbWFpbk5hbWU6IGNvbmZpZy5ob3N0ZWRab25lRG9tYWluLFxuXHRcdH0pO1xuXG5cdFx0Y2VydGlmaWNhdGUgPSBuZXcgYWNtLkRuc1ZhbGlkYXRlZENlcnRpZmljYXRlKHN0YWNrLCBgJHtjb25maWcuaWR9Q2VydGlmaWNhdGVgLCB7XG5cdFx0XHRkb21haW5OYW1lOiBjb25maWcuZG9tYWluTmFtZSxcblx0XHRcdGhvc3RlZFpvbmUsXG5cdFx0XHRyZWdpb246ICd1cy1lYXN0LTEnLFxuXHRcdH0pO1xuXHR9XG5cblx0Y29uc3QgZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKHN0YWNrLCBgJHtjb25maWcuaWR9RGlzdHJpYnV0aW9uYCwge1xuXHRcdGNlcnRpZmljYXRlLFxuXHRcdGRvbWFpbk5hbWVzOiBjb25maWcuZG9tYWluTmFtZSA/IFtjb25maWcuZG9tYWluTmFtZV0gOiB1bmRlZmluZWQsXG5cdFx0ZGVmYXVsdFJvb3RPYmplY3Q6ICdpbmRleC5odG1sJyxcblx0XHRkZWZhdWx0QmVoYXZpb3I6IHtcblx0XHRcdG9yaWdpbjogb3JpZ2lucy5TM0J1Y2tldE9yaWdpbi53aXRoT3JpZ2luQWNjZXNzQ29udHJvbCh3ZWJzaXRlQnVja2V0KSxcblx0XHRcdHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuXHRcdFx0Y29tcHJlc3M6IHRydWUsXG5cdFx0fSxcblx0XHRlcnJvclJlc3BvbnNlczogY29uZmlnLnNwYVxuXHRcdFx0PyBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRodHRwU3RhdHVzOiA0MDMsXG5cdFx0XHRcdFx0cmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG5cdFx0XHRcdFx0cmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcblx0XHRcdFx0XHR0dGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aHR0cFN0YXR1czogNDA0LFxuXHRcdFx0XHRcdHJlc3BvbnNlSHR0cFN0YXR1czogMjAwLFxuXHRcdFx0XHRcdHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG5cdFx0XHRcdFx0dHRsOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcblx0XHRcdFx0fSxcblx0XHRcdF1cblx0XHRcdDogdW5kZWZpbmVkLFxuXHRcdGNvbW1lbnQ6IGNvbmZpZy5kZXNjcmlwdGlvbixcblx0fSk7XG5cblx0bmV3IHMzZGVwbG95LkJ1Y2tldERlcGxveW1lbnQoc3RhY2ssIGAke2NvbmZpZy5pZH1EZXBsb3ltZW50YCwge1xuXHRcdGRlc3RpbmF0aW9uQnVja2V0OiB3ZWJzaXRlQnVja2V0LFxuXHRcdGRpc3RyaWJ1dGlvbixcblx0XHRkaXN0cmlidXRpb25QYXRoczogWycvKiddLFxuXHRcdHNvdXJjZXM6IFtzM2RlcGxveS5Tb3VyY2UuYXNzZXQoY29uZmlnLmFzc2V0UGF0aCldLFxuXHR9KTtcblxuXHRpZiAoaG9zdGVkWm9uZSAmJiBjb25maWcuZG9tYWluTmFtZSkge1xuXHRcdGNvbnN0IHJlY29yZE5hbWUgPSByZXNvbHZlUmVjb3JkTmFtZShjb25maWcuZG9tYWluTmFtZSwgaG9zdGVkWm9uZS56b25lTmFtZSk7XG5cblx0XHRuZXcgcm91dGU1My5BUmVjb3JkKHN0YWNrLCBgJHtjb25maWcuaWR9QWxpYXNSZWNvcmRgLCB7XG5cdFx0XHR6b25lOiBob3N0ZWRab25lLFxuXHRcdFx0cmVjb3JkTmFtZSxcblx0XHRcdHRhcmdldDogcm91dGU1My5SZWNvcmRUYXJnZXQuZnJvbUFsaWFzKG5ldyByb3V0ZTUzVGFyZ2V0cy5DbG91ZEZyb250VGFyZ2V0KGRpc3RyaWJ1dGlvbikpLFxuXHRcdH0pO1xuXG5cdFx0bmV3IHJvdXRlNTMuQWFhYVJlY29yZChzdGFjaywgYCR7Y29uZmlnLmlkfUFsaWFzUmVjb3JkSXB2NmAsIHtcblx0XHRcdHpvbmU6IGhvc3RlZFpvbmUsXG5cdFx0XHRyZWNvcmROYW1lLFxuXHRcdFx0dGFyZ2V0OiByb3V0ZTUzLlJlY29yZFRhcmdldC5mcm9tQWxpYXMobmV3IHJvdXRlNTNUYXJnZXRzLkNsb3VkRnJvbnRUYXJnZXQoZGlzdHJpYnV0aW9uKSksXG5cdFx0fSk7XG5cdH1cblxuXHRuZXcgY2RrLkNmbk91dHB1dChzdGFjaywgYCR7Y29uZmlnLmlkfUJ1Y2tldE5hbWVgLCB7XG5cdFx0dmFsdWU6IHdlYnNpdGVCdWNrZXQuYnVja2V0TmFtZSxcblx0fSk7XG5cblx0bmV3IGNkay5DZm5PdXRwdXQoc3RhY2ssIGAke2NvbmZpZy5pZH1DbG91ZEZyb250RG9tYWluYCwge1xuXHRcdHZhbHVlOiBkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZSxcblx0fSk7XG5cblx0bmV3IGNkay5DZm5PdXRwdXQoc3RhY2ssIGAke2NvbmZpZy5pZH1VcmxgLCB7XG5cdFx0dmFsdWU6IGNvbmZpZy5kb21haW5OYW1lID8gYGh0dHBzOi8vJHtjb25maWcuZG9tYWluTmFtZX1gIDogYGh0dHBzOi8vJHtkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZX1gLFxuXHR9KTtcblxuXHRyZXR1cm4ge1xuXHRcdGJ1Y2tldDogd2Vic2l0ZUJ1Y2tldCxcblx0XHRkaXN0cmlidXRpb24sXG5cdH07XG59XG5cbmNvbnN0IGluY2x1ZGVkID0gbmV3IENmbkluY2x1ZGUoc3RhY2ssICdDYXNjYWRlUHJldmVudGlvblRlbXBsYXRlJywge1xuXHR0ZW1wbGF0ZUZpbGU6ICdjZm4tdGVtcGxhdGUueWFtbCcsXG59KTtcblxuY3JlYXRlU3RhdGljU2l0ZSh7XG5cdGlkOiAnT3BlcmF0aW9uc0NvbnNvbGUnLFxuXHRhc3NldFBhdGg6IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi91aScpLFxuXHRkb21haW5OYW1lOiB1aURvbWFpbk5hbWUsXG5cdGhvc3RlZFpvbmVEb21haW46IHVpSG9zdGVkWm9uZURvbWFpbixcblx0c3BhOiB0cnVlLFxuXHRkZXNjcmlwdGlvbjogJ0Nhc2NhZGUgUHJldmVudGlvbiBFbmdpbmUgb3BlcmF0aW9ucyBjb25zb2xlJyxcbn0pO1xuXG5jcmVhdGVTdGF0aWNTaXRlKHtcblx0aWQ6ICdBcnRpY2xlU2l0ZScsXG5cdGFzc2V0UGF0aDogcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL2FydGljbGUnKSxcblx0ZG9tYWluTmFtZTogYXJ0aWNsZURvbWFpbk5hbWUsXG5cdGhvc3RlZFpvbmVEb21haW46IGFydGljbGVIb3N0ZWRab25lRG9tYWluLFxuXHRzcGE6IGZhbHNlLFxuXHRkZXNjcmlwdGlvbjogJ0Nhc2NhZGUgUHJldmVudGlvbiBFbmdpbmUgYXJ0aWNsZSBzaXRlJyxcbn0pO1xuXG5jb25zdCBwbGF5Ym9va01hcHBpbmdzID0gbmV3IFBsYXlib29rTWFwcGluZ3Moc3RhY2ssICdQbGF5Ym9va01hcHBpbmdzJywge1xuXHR0YWJsZU5hbWU6ICdDYXNjYWRlUHJldmVudGlvbi1QbGF5Ym9va01hcHBpbmdzJyxcblx0ZXZlbnRCdXNOYW1lOiAnQ2FzY2FkZVByZXZlbnRpb24tUGxheWJvb2tFdmVudEJ1cycsXG59KTtcblxuY29uc3QgdGVsZW1ldHJ5QnVja2V0ID0gaW5jbHVkZWQuZ2V0UmVzb3VyY2UoJ1RlbGVtZXRyeUJ1Y2tldDcxMEZGMkM4JykgYXMgczMuQ2ZuQnVja2V0O1xuY29uc3QgdGVsZW1ldHJ5Q2FjaGVUYWJsZSA9IGluY2x1ZGVkLmdldFJlc291cmNlKCdUZWxlbWV0cnlDYWNoZUQyOUEwMzk1JykgYXMgZHluYW1vZGIuQ2ZuVGFibGU7XG5jb25zdCBkZXBlbmRlbmN5R3JhcGhUYWJsZSA9IGluY2x1ZGVkLmdldFJlc291cmNlKCdEZXBlbmRlbmN5R3JhcGgzMzI0ODMzRScpIGFzIGR5bmFtb2RiLkNmblRhYmxlO1xuY29uc3Qgc2lnbmF0dXJlc1RhYmxlID0gaW5jbHVkZWQuZ2V0UmVzb3VyY2UoJ1NpZ25hdHVyZXNUYWJsZTc5NzMzQTlDJykgYXMgZHluYW1vZGIuQ2ZuVGFibGU7XG5jb25zdCBldmVudEJ1cyA9IGluY2x1ZGVkLmdldFJlc291cmNlKCdFdmVudEJ1czdCODc0OEFBJykgYXMgZXZlbnRzLkNmbkV2ZW50QnVzO1xuY29uc3QgZW5jcnlwdGlvbktleSA9IGluY2x1ZGVkLmdldFJlc291cmNlKCdFbmNyeXB0aW9uS2V5MUI4NDNFNjYnKSBhcyBrbXMuQ2ZuS2V5O1xuXG5jb25zdCByZW1lZGlhdGlvblBsYW5zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUoc3RhY2ssICdSZW1lZGlhdGlvblBsYW5zVGFibGUnLCB7XG5cdHRhYmxlTmFtZTogJ0Nhc2NhZGVQcmV2ZW50aW9uLVJlbWVkaWF0aW9uUGxhbnMnLFxuXHRwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3BsYW5JZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG5cdGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG5cdHBvaW50SW5UaW1lUmVjb3ZlcnlTcGVjaWZpY2F0aW9uOiB7XG5cdFx0cG9pbnRJblRpbWVSZWNvdmVyeUVuYWJsZWQ6IHRydWUsXG5cdH0sXG5cdGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcblx0cmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxufSk7XG5cbmNvbnN0IGF1ZGl0RXZlbnRzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUoc3RhY2ssICdBdWRpdEV2ZW50c1RhYmxlJywge1xuXHR0YWJsZU5hbWU6ICdDYXNjYWRlUHJldmVudGlvbi1BdWRpdEV2ZW50cycsXG5cdHBhcnRpdGlvbktleTogeyBuYW1lOiAndGVuYW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuXHRzb3J0S2V5OiB7IG5hbWU6ICdldmVudEtleScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG5cdGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG5cdHBvaW50SW5UaW1lUmVjb3ZlcnlTcGVjaWZpY2F0aW9uOiB7XG5cdFx0cG9pbnRJblRpbWVSZWNvdmVyeUVuYWJsZWQ6IHRydWUsXG5cdH0sXG5cdGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcblx0cmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxufSk7XG5cbmNvbnN0IGNhc2NhZGVBbGVydHNUb3BpYyA9IG5ldyBzbnMuVG9waWMoc3RhY2ssICdDYXNjYWRlQWxlcnRzVG9waWMnLCB7XG5cdGRpc3BsYXlOYW1lOiAnQ2FzY2FkZSBQcmV2ZW50aW9uIEFsZXJ0cycsXG59KTtcblxuY29uc3Qgbm90aWZpY2F0aW9uRW1haWxzID0gWy4uLm5ldyBTZXQoWy4uLmNvbmZpZ3VyZWRFeGVjdXRpdmVFbWFpbHMsIC4uLmNvbmZpZ3VyZWRTdGFrZWhvbGRlckVtYWlsc10pXTtcbmZvciAoY29uc3QgZW1haWwgb2Ygbm90aWZpY2F0aW9uRW1haWxzKSB7XG5cdGNhc2NhZGVBbGVydHNUb3BpYy5hZGRTdWJzY3JpcHRpb24obmV3IHNuc1N1YnNjcmlwdGlvbnMuRW1haWxTdWJzY3JpcHRpb24oZW1haWwpKTtcbn1cblxuZm9yIChjb25zdCBzbXNOdW1iZXIgb2YgY29uZmlndXJlZFN0YWtlaG9sZGVyU21zKSB7XG5cdGNhc2NhZGVBbGVydHNUb3BpYy5hZGRTdWJzY3JpcHRpb24obmV3IHNuc1N1YnNjcmlwdGlvbnMuU21zU3Vic2NyaXB0aW9uKHNtc051bWJlcikpO1xufVxuXG5jb25zdCB0ZWxlbWV0cnlJbmdlc3RGdW5jdGlvbiA9IG5ldyBOb2RlanNGdW5jdGlvbihzdGFjaywgJ1RlbGVtZXRyeUluZ2VzdEZ1bmN0aW9uJywge1xuXHRydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcblx0ZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9zcmMvdGVsZW1ldHJ5L2luZ2VzdGlvbl9oYW5kbGVyLnRzJyksXG5cdGhhbmRsZXI6ICdoYW5kbGVyJyxcblx0dGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuXHRtZW1vcnlTaXplOiAyNTYsXG5cdGVudmlyb25tZW50OiB7XG5cdFx0VEVMRU1FVFJZX0JVQ0tFVDogdGVsZW1ldHJ5QnVja2V0LnJlZixcblx0XHRFVkVOVF9CVVNfTkFNRTogZXZlbnRCdXMucmVmLFxuXHRcdFRFTEVNRVRSWV9DQUNIRV9UQUJMRTogdGVsZW1ldHJ5Q2FjaGVUYWJsZS5yZWYsXG5cdH0sXG59KTtcblxudGVsZW1ldHJ5SW5nZXN0RnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcblx0YWN0aW9uczogWydzMzpQdXRPYmplY3QnXSxcblx0cmVzb3VyY2VzOiBbYCR7dGVsZW1ldHJ5QnVja2V0LmF0dHJBcm59LypgXSxcbn0pKTtcbnRlbGVtZXRyeUluZ2VzdEZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG5cdGFjdGlvbnM6IFsna21zOkdlbmVyYXRlRGF0YUtleScsICdrbXM6RGVjcnlwdCddLFxuXHRyZXNvdXJjZXM6IFtlbmNyeXB0aW9uS2V5LmF0dHJBcm5dLFxufSkpO1xudGVsZW1ldHJ5SW5nZXN0RnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcblx0YWN0aW9uczogWydldmVudHM6UHV0RXZlbnRzJ10sXG5cdHJlc291cmNlczogW2V2ZW50QnVzLmdldEF0dCgnQXJuJykudG9TdHJpbmcoKV0sXG59KSk7XG50ZWxlbWV0cnlJbmdlc3RGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuXHRhY3Rpb25zOiBbJ2R5bmFtb2RiOlB1dEl0ZW0nXSxcblx0cmVzb3VyY2VzOiBbdGVsZW1ldHJ5Q2FjaGVUYWJsZS5hdHRyQXJuXSxcbn0pKTtcblxuY29uc3Qgc2lnbmF0dXJlTWF0Y2hlclYyRnVuY3Rpb24gPSBuZXcgTm9kZWpzRnVuY3Rpb24oc3RhY2ssICdTaWduYXR1cmVNYXRjaGVyVjJGdW5jdGlvbicsIHtcblx0cnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG5cdGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vc3JjL2RldGVjdGlvbi9zaWduYXR1cmVfbWF0Y2hlcl9oYW5kbGVyLnRzJyksXG5cdGhhbmRsZXI6ICdoYW5kbGVyJyxcblx0dGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuXHRtZW1vcnlTaXplOiAyNTYsXG5cdGVudmlyb25tZW50OiB7XG5cdFx0U0lHTkFUVVJFU19UQUJMRV9OQU1FOiBzaWduYXR1cmVzVGFibGUucmVmLFxuXHRcdEVWRU5UX0JVU19OQU1FOiBldmVudEJ1cy5yZWYsXG5cdFx0QUxFUlRfVE9QSUNfQVJOOiBjYXNjYWRlQWxlcnRzVG9waWMudG9waWNBcm4sXG5cdH0sXG59KTtcblxuc2lnbmF0dXJlTWF0Y2hlclYyRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcblx0YWN0aW9uczogWydkeW5hbW9kYjpQdXRJdGVtJ10sXG5cdHJlc291cmNlczogW3NpZ25hdHVyZXNUYWJsZS5hdHRyQXJuXSxcbn0pKTtcbnNpZ25hdHVyZU1hdGNoZXJWMkZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG5cdGFjdGlvbnM6IFsna21zOkRlY3J5cHQnLCAna21zOkdlbmVyYXRlRGF0YUtleSddLFxuXHRyZXNvdXJjZXM6IFtlbmNyeXB0aW9uS2V5LmF0dHJBcm5dLFxufSkpO1xuc2lnbmF0dXJlTWF0Y2hlclYyRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcblx0YWN0aW9uczogWydldmVudHM6UHV0RXZlbnRzJ10sXG5cdHJlc291cmNlczogW2V2ZW50QnVzLmdldEF0dCgnQXJuJykudG9TdHJpbmcoKV0sXG59KSk7XG5jYXNjYWRlQWxlcnRzVG9waWMuZ3JhbnRQdWJsaXNoKHNpZ25hdHVyZU1hdGNoZXJWMkZ1bmN0aW9uKTtcblxuY29uc3QgYW5vbWFseVRvU2lnbmF0dXJlVjJSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHN0YWNrLCAnQW5vbWFseVRvU2lnbmF0dXJlVjJSdWxlJywge1xuXHRldmVudFBhdHRlcm46IHtcblx0XHRzb3VyY2U6IFsnY2FzY2FkZS1wcmV2ZW50aW9uLmFub21hbHknXSxcblx0XHRkZXRhaWxUeXBlOiBbJ0Fub21hbHlEZXRlY3RlZCddLFxuXHR9LFxuXHRldmVudEJ1czogZXZlbnRzLkV2ZW50QnVzLmZyb21FdmVudEJ1c05hbWUoc3RhY2ssICdJbXBvcnRlZENhc2NhZGVFdmVudEJ1cycsIGV2ZW50QnVzLnJlZiksXG59KTtcbmFub21hbHlUb1NpZ25hdHVyZVYyUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oc2lnbmF0dXJlTWF0Y2hlclYyRnVuY3Rpb24pKTtcblxuY29uc3QgYXBpRnVuY3Rpb24gPSBuZXcgTm9kZWpzRnVuY3Rpb24oc3RhY2ssICdDYXNjYWRlQXBpRnVuY3Rpb24nLCB7XG5cdHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuXHRlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL3NyYy9hcGkvYXBpX2hhbmRsZXIudHMnKSxcblx0aGFuZGxlcjogJ2hhbmRsZXInLFxuXHR0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG5cdG1lbW9yeVNpemU6IDI1Nixcblx0ZW52aXJvbm1lbnQ6IHtcblx0XHRERVBFTkRFTkNZX0dSQVBIX1RBQkxFOiBkZXBlbmRlbmN5R3JhcGhUYWJsZS5yZWYsXG5cdFx0U0lHTkFUVVJFU19UQUJMRV9OQU1FOiBzaWduYXR1cmVzVGFibGUucmVmLFxuXHRcdFJFTUVESUFUSU9OX1BMQU5TX1RBQkxFOiByZW1lZGlhdGlvblBsYW5zVGFibGUudGFibGVOYW1lLFxuXHRcdEFVRElUX0VWRU5UU19UQUJMRTogYXVkaXRFdmVudHNUYWJsZS50YWJsZU5hbWUsXG5cdFx0RVZFTlRfQlVTX05BTUU6IGV2ZW50QnVzLnJlZixcblx0XHRBTEVSVF9UT1BJQ19BUk46IGNhc2NhZGVBbGVydHNUb3BpYy50b3BpY0Fybixcblx0fSxcbn0pO1xuXG5hcGlGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuXHRhY3Rpb25zOiBbJ2R5bmFtb2RiOkdldEl0ZW0nLCAnZHluYW1vZGI6U2NhbicsICdkeW5hbW9kYjpRdWVyeScsICdkeW5hbW9kYjpQdXRJdGVtJ10sXG5cdHJlc291cmNlczogW1xuXHRcdGRlcGVuZGVuY3lHcmFwaFRhYmxlLmF0dHJBcm4sXG5cdFx0c2lnbmF0dXJlc1RhYmxlLmF0dHJBcm4sXG5cdFx0cmVtZWRpYXRpb25QbGFuc1RhYmxlLnRhYmxlQXJuLFxuXHRcdGF1ZGl0RXZlbnRzVGFibGUudGFibGVBcm4sXG5cdF0sXG59KSk7XG5hcGlGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuXHRhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcblx0cmVzb3VyY2VzOiBbZXZlbnRCdXMuZ2V0QXR0KCdBcm4nKS50b1N0cmluZygpXSxcbn0pKTtcbmNhc2NhZGVBbGVydHNUb3BpYy5ncmFudFB1Ymxpc2goYXBpRnVuY3Rpb24pO1xuXG5jb25zdCB3ZWJob29rTm90aWZpZXJGdW5jdGlvbiA9IG5ldyBOb2RlanNGdW5jdGlvbihzdGFjaywgJ1dlYmhvb2tOb3RpZmllckZ1bmN0aW9uJywge1xuXHRydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcblx0ZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9zcmMvaW50ZWdyYXRpb25zL3dlYmhvb2tfbm90aWZpZXJfaGFuZGxlci50cycpLFxuXHRoYW5kbGVyOiAnaGFuZGxlcicsXG5cdHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcblx0bWVtb3J5U2l6ZTogMjU2LFxuXHRlbnZpcm9ubWVudDoge1xuXHRcdFdFQkhPT0tfVVJMOiB3ZWJob29rVXJsLFxuXHRcdFNMQUNLX1dFQkhPT0tfVVJMOiBzbGFja1dlYmhvb2tVcmwsXG5cdFx0VEVBTVNfV0VCSE9PS19VUkw6IHRlYW1zV2ViaG9va1VybCxcblx0XHRTVEFUVVNQQUdFX1dFQkhPT0tfVVJMOiBzdGF0dXNwYWdlV2ViaG9va1VybCxcblx0XHRXRUJIT09LX0VOQUJMRUQ6IHdlYmhvb2tFbmFibGVkLFxuXHR9LFxufSk7XG5cbmNvbnN0IHJlbWVkaWF0aW9uQWN0aW9uRXhlY3V0b3JGdW5jdGlvbiA9IG5ldyBOb2RlanNGdW5jdGlvbihzdGFjaywgJ1JlbWVkaWF0aW9uQWN0aW9uRXhlY3V0b3JGdW5jdGlvbicsIHtcblx0cnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG5cdGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vc3JjL29yY2hlc3RyYXRpb24vYWN0aW9uX2V4ZWN1dG9yX2hhbmRsZXIudHMnKSxcblx0aGFuZGxlcjogJ2hhbmRsZXInLFxuXHR0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG5cdG1lbW9yeVNpemU6IDI1Nixcblx0ZW52aXJvbm1lbnQ6IHtcblx0XHRFVkVOVF9CVVNfTkFNRTogZXZlbnRCdXMucmVmLFxuXHR9LFxufSk7XG5yZW1lZGlhdGlvbkFjdGlvbkV4ZWN1dG9yRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcblx0YWN0aW9uczogWydldmVudHM6UHV0RXZlbnRzJ10sXG5cdHJlc291cmNlczogW2V2ZW50QnVzLmdldEF0dCgnQXJuJykudG9TdHJpbmcoKV0sXG59KSk7XG5cbmNvbnN0IGV4ZWN1dGVBY3Rpb25TdGVwID0gbmV3IHNmblRhc2tzLkxhbWJkYUludm9rZShzdGFjaywgJ0V4ZWN1dGVBY3Rpb25TdGVwJywge1xuXHRsYW1iZGFGdW5jdGlvbjogcmVtZWRpYXRpb25BY3Rpb25FeGVjdXRvckZ1bmN0aW9uLFxuXHRwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xuXHRcdHBsYW5JZDogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLnBsYW5JZCcpLFxuXHRcdHNpZ25hdHVyZUlkOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuc2lnbmF0dXJlSWQnKSxcblx0XHRtb2RlOiAnZXhlY3V0ZScsXG5cdFx0YWN0aW9uOiBzZm4uSnNvblBhdGgub2JqZWN0QXQoJyQkLk1hcC5JdGVtLlZhbHVlJyksXG5cdH0pLFxuXHRvdXRwdXRQYXRoOiAnJC5QYXlsb2FkJyxcbn0pO1xuXG5jb25zdCByb2xsYmFja0FjdGlvblN0ZXAgPSBuZXcgc2ZuVGFza3MuTGFtYmRhSW52b2tlKHN0YWNrLCAnUm9sbGJhY2tBY3Rpb25TdGVwJywge1xuXHRsYW1iZGFGdW5jdGlvbjogcmVtZWRpYXRpb25BY3Rpb25FeGVjdXRvckZ1bmN0aW9uLFxuXHRwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xuXHRcdHBsYW5JZDogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLnBsYW5JZCcpLFxuXHRcdHNpZ25hdHVyZUlkOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuc2lnbmF0dXJlSWQnKSxcblx0XHRtb2RlOiAncm9sbGJhY2snLFxuXHRcdGFjdGlvbjogc2ZuLkpzb25QYXRoLm9iamVjdEF0KCckJC5NYXAuSXRlbS5WYWx1ZScpLFxuXHR9KSxcblx0b3V0cHV0UGF0aDogJyQuUGF5bG9hZCcsXG59KTtcblxuY29uc3QgZXhlY3V0ZUFjdGlvbnNNYXAgPSBuZXcgc2ZuLk1hcChzdGFjaywgJ0V4ZWN1dGVBY3Rpb25zTWFwJywge1xuXHRpdGVtc1BhdGg6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5hY3Rpb25zJyksXG5cdG1heENvbmN1cnJlbmN5OiAxLFxufSk7XG5leGVjdXRlQWN0aW9uc01hcC5pdGVtUHJvY2Vzc29yKGV4ZWN1dGVBY3Rpb25TdGVwKTtcblxuY29uc3Qgcm9sbGJhY2tBY3Rpb25zTWFwID0gbmV3IHNmbi5NYXAoc3RhY2ssICdSb2xsYmFja0FjdGlvbnNNYXAnLCB7XG5cdGl0ZW1zUGF0aDogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLnJvbGxiYWNrQWN0aW9ucycpLFxuXHRtYXhDb25jdXJyZW5jeTogMSxcbn0pO1xucm9sbGJhY2tBY3Rpb25zTWFwLml0ZW1Qcm9jZXNzb3Iocm9sbGJhY2tBY3Rpb25TdGVwKTtcblxuZXhlY3V0ZUFjdGlvbnNNYXAuYWRkQ2F0Y2gocm9sbGJhY2tBY3Rpb25zTWFwLm5leHQobmV3IHNmbi5GYWlsKHN0YWNrLCAnUGxhbkV4ZWN1dGlvbkZhaWxlZCcpKSk7XG5cbmNvbnN0IHJlbWVkaWF0aW9uU3RhdGVNYWNoaW5lID0gbmV3IHNmbi5TdGF0ZU1hY2hpbmUoc3RhY2ssICdSZW1lZGlhdGlvblN0YXRlTWFjaGluZScsIHtcblx0ZGVmaW5pdGlvbkJvZHk6IHNmbi5EZWZpbml0aW9uQm9keS5mcm9tQ2hhaW5hYmxlKGV4ZWN1dGVBY3Rpb25zTWFwLm5leHQobmV3IHNmbi5TdWNjZWVkKHN0YWNrLCAnUGxhbkV4ZWN1dGlvblN1Y2NlZWRlZCcpKSksXG5cdHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwMCksXG59KTtcblxuY29uc3QgcmVtZWRpYXRpb25QbGFubmVyRnVuY3Rpb24gPSBuZXcgTm9kZWpzRnVuY3Rpb24oc3RhY2ssICdSZW1lZGlhdGlvblBsYW5uZXJGdW5jdGlvbicsIHtcblx0cnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG5cdGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vc3JjL29yY2hlc3RyYXRpb24vcmVtZWRpYXRpb25fcGxhbm5lcl9oYW5kbGVyLnRzJyksXG5cdGhhbmRsZXI6ICdoYW5kbGVyJyxcblx0dGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuXHRtZW1vcnlTaXplOiAyNTYsXG5cdGVudmlyb25tZW50OiB7XG5cdFx0UkVNRURJQVRJT05fUExBTlNfVEFCTEU6IHJlbWVkaWF0aW9uUGxhbnNUYWJsZS50YWJsZU5hbWUsXG5cdFx0RVZFTlRfQlVTX05BTUU6IGV2ZW50QnVzLnJlZixcblx0XHRSRU1FRElBVElPTl9TVEFURV9NQUNISU5FX0FSTjogcmVtZWRpYXRpb25TdGF0ZU1hY2hpbmUuc3RhdGVNYWNoaW5lQXJuLFxuXHRcdFJFTUVESUFUSU9OX0VYRUNVVElPTl9FTkFCTEVEOiBTdHJpbmcocmVtZWRpYXRpb25FeGVjdXRpb25FbmFibGVkKSxcblx0fSxcbn0pO1xucmVtZWRpYXRpb25QbGFubmVyRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcblx0YWN0aW9uczogWydkeW5hbW9kYjpQdXRJdGVtJ10sXG5cdHJlc291cmNlczogW3JlbWVkaWF0aW9uUGxhbnNUYWJsZS50YWJsZUFybl0sXG59KSk7XG5yZW1lZGlhdGlvblBsYW5uZXJGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuXHRhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcblx0cmVzb3VyY2VzOiBbZXZlbnRCdXMuZ2V0QXR0KCdBcm4nKS50b1N0cmluZygpXSxcbn0pKTtcbnJlbWVkaWF0aW9uUGxhbm5lckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG5cdGFjdGlvbnM6IFsnc3RhdGVzOlN0YXJ0RXhlY3V0aW9uJ10sXG5cdHJlc291cmNlczogW3JlbWVkaWF0aW9uU3RhdGVNYWNoaW5lLnN0YXRlTWFjaGluZUFybl0sXG59KSk7XG5cbmNvbnN0IHByZWRpY3Rpb25Ub1JlbWVkaWF0aW9uUnVsZSA9IG5ldyBldmVudHMuUnVsZShzdGFjaywgJ1ByZWRpY3Rpb25Ub1JlbWVkaWF0aW9uUnVsZScsIHtcblx0ZXZlbnRQYXR0ZXJuOiB7XG5cdFx0c291cmNlOiBbJ2Nhc2NhZGUtcHJldmVudGlvbi5wcmVkaWN0aW9uJ10sXG5cdFx0ZGV0YWlsVHlwZTogWydDYXNjYWRlUGF0aFByZWRpY3RlZCddLFxuXHR9LFxuXHRldmVudEJ1czogZXZlbnRzLkV2ZW50QnVzLmZyb21FdmVudEJ1c05hbWUoc3RhY2ssICdQcmVkaWN0aW9uRXZlbnRCdXMnLCBldmVudEJ1cy5yZWYpLFxufSk7XG5wcmVkaWN0aW9uVG9SZW1lZGlhdGlvblJ1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKHJlbWVkaWF0aW9uUGxhbm5lckZ1bmN0aW9uKSk7XG5cbmNvbnN0IGludGVncmF0aW9uRXZlbnRSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHN0YWNrLCAnSW50ZWdyYXRpb25FdmVudFJ1bGUnLCB7XG5cdGV2ZW50UGF0dGVybjoge1xuXHRcdHNvdXJjZTogW1xuXHRcdFx0J2Nhc2NhZGUtcHJldmVudGlvbi5zaWduYXR1cmUnLFxuXHRcdFx0J2Nhc2NhZGUtcHJldmVudGlvbi5wcmVkaWN0aW9uJyxcblx0XHRcdCdjYXNjYWRlLXByZXZlbnRpb24ucmVtZWRpYXRpb24nLFxuXHRcdF0sXG5cdFx0ZGV0YWlsVHlwZTogW1xuXHRcdFx0J0Nhc2NhZGVTaWduYXR1cmVEZXRlY3RlZCcsXG5cdFx0XHQnQ2FzY2FkZVBhdGhQcmVkaWN0ZWQnLFxuXHRcdFx0J1JlbWVkaWF0aW9uQWN0aW9uUmVjb3JkZWQnLFxuXHRcdF0sXG5cdH0sXG5cdGV2ZW50QnVzOiBldmVudHMuRXZlbnRCdXMuZnJvbUV2ZW50QnVzTmFtZShzdGFjaywgJ0ludGVncmF0aW9uRXZlbnRCdXMnLCBldmVudEJ1cy5yZWYpLFxufSk7XG5pbnRlZ3JhdGlvbkV2ZW50UnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24od2ViaG9va05vdGlmaWVyRnVuY3Rpb24pKTtcblxuY29uc3QgYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaShzdGFjaywgJ0Nhc2NhZGVQcmV2ZW50aW9uQXBpJywge1xuXHRyZXN0QXBpTmFtZTogJ0Nhc2NhZGVQcmV2ZW50aW9uQXBpJyxcblx0ZGVzY3JpcHRpb246ICdFbnRlcnByaXNlIGZvdW5kYXRpb24gQVBJIGZvciBjYXNjYWRlLXJpc2sgdGVsZW1ldHJ5IGFuZCBnb3Zlcm5lZCBvcGVyYXRvciBhY3Rpb25zJyxcblx0ZGVwbG95T3B0aW9uczogeyBzdGFnZU5hbWU6ICd2MScgfSxcblx0ZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG5cdFx0YWxsb3dPcmlnaW5zOiBhbGxvd2VkT3JpZ2lucyxcblx0XHRhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcblx0XHRhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ0F1dGhvcml6YXRpb24nLCAnWC1BcGktS2V5J10sXG5cdH0sXG59KTtcblxuY29uc3QgdXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbChzdGFjaywgJ0Nhc2NhZGVQcmV2ZW50aW9uVXNlclBvb2wnLCB7XG5cdHVzZXJQb29sTmFtZTogJ0Nhc2NhZGVQcmV2ZW50aW9uVXNlcnMnLFxuXHRzZWxmU2lnblVwRW5hYmxlZDogZmFsc2UsXG5cdHNpZ25JbkFsaWFzZXM6IHsgZW1haWw6IHRydWUgfSxcblx0c3RhbmRhcmRBdHRyaWJ1dGVzOiB7XG5cdFx0ZW1haWw6IHsgcmVxdWlyZWQ6IHRydWUsIG11dGFibGU6IGZhbHNlIH0sXG5cdH0sXG5cdHBhc3N3b3JkUG9saWN5OiB7XG5cdFx0bWluTGVuZ3RoOiAxMixcblx0XHRyZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuXHRcdHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG5cdFx0cmVxdWlyZURpZ2l0czogdHJ1ZSxcblx0XHRyZXF1aXJlU3ltYm9sczogdHJ1ZSxcblx0fSxcblx0bWZhOiBjb2duaXRvLk1mYS5PUFRJT05BTCxcblx0YWNjb3VudFJlY292ZXJ5OiBjb2duaXRvLkFjY291bnRSZWNvdmVyeS5FTUFJTF9PTkxZLFxuXHRyZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG59KTtcblxuY29uc3QgdXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudChzdGFjaywgJ0Nhc2NhZGVQcmV2ZW50aW9uVXNlclBvb2xDbGllbnQnLCB7XG5cdHVzZXJQb29sLFxuXHRnZW5lcmF0ZVNlY3JldDogZmFsc2UsXG5cdGF1dGhGbG93czoge1xuXHRcdHVzZXJQYXNzd29yZDogdHJ1ZSxcblx0XHR1c2VyU3JwOiB0cnVlLFxuXHR9LFxufSk7XG5cbmNvbnN0IGNvZ25pdG9BdXRob3JpemVyID0gbmV3IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXIoc3RhY2ssICdDYXNjYWRlQXBpQXV0aG9yaXplcicsIHtcblx0Y29nbml0b1VzZXJQb29sczogW3VzZXJQb29sXSxcbn0pO1xuXG5jb25zdCBwcm90ZWN0ZWRNZXRob2RPcHRpb25zOiBhcGlnYXRld2F5Lk1ldGhvZE9wdGlvbnMgPSB7XG5cdGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG5cdGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxuXHRhcGlLZXlSZXF1aXJlZDogdHJ1ZSxcbn07XG5cbmNvbnN0IHRlbGVtZXRyeSA9IGFwaS5yb290LmFkZFJlc291cmNlKCd0ZWxlbWV0cnknKTtcbmNvbnN0IGluZ2VzdCA9IHRlbGVtZXRyeS5hZGRSZXNvdXJjZSgnaW5nZXN0Jyk7XG5pbmdlc3QuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGVsZW1ldHJ5SW5nZXN0RnVuY3Rpb24pLCB7XG5cdGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLklBTSxcbn0pO1xuXG5jb25zdCBkZXBlbmRlbmN5R3JhcGggPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnZGVwZW5kZW5jeS1ncmFwaCcpO1xuY29uc3QgZGVwZW5kZW5jeUdyYXBoR2V0TWV0aG9kID0gZGVwZW5kZW5jeUdyYXBoLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXBpRnVuY3Rpb24pLCBwcm90ZWN0ZWRNZXRob2RPcHRpb25zKTtcblxuY29uc3QgY2FzY2FkZVNpZ25hdHVyZXMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnY2FzY2FkZS1zaWduYXR1cmVzJyk7XG5jb25zdCBhY3RpdmVTaWduYXR1cmVzID0gY2FzY2FkZVNpZ25hdHVyZXMuYWRkUmVzb3VyY2UoJ2FjdGl2ZScpO1xuY29uc3QgYWN0aXZlU2lnbmF0dXJlc0dldE1ldGhvZCA9IGFjdGl2ZVNpZ25hdHVyZXMuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlGdW5jdGlvbiksIHByb3RlY3RlZE1ldGhvZE9wdGlvbnMpO1xuXG5jb25zdCByZW1lZGlhdGlvblBsYW5zID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3JlbWVkaWF0aW9uLXBsYW5zJyk7XG5jb25zdCByZW1lZGlhdGlvblBsYW5zR2V0TWV0aG9kID0gcmVtZWRpYXRpb25QbGFucy5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaUZ1bmN0aW9uKSwgcHJvdGVjdGVkTWV0aG9kT3B0aW9ucyk7XG5jb25zdCBwbGFuQnlJZCA9IHJlbWVkaWF0aW9uUGxhbnMuYWRkUmVzb3VyY2UoJ3twbGFuSWR9Jyk7XG5jb25zdCBhcHByb3ZhbCA9IHBsYW5CeUlkLmFkZFJlc291cmNlKCdhcHByb3ZhbCcpO1xuY29uc3QgYXBwcm92YWxQb3N0TWV0aG9kID0gYXBwcm92YWwuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXBpRnVuY3Rpb24pLCBwcm90ZWN0ZWRNZXRob2RPcHRpb25zKTtcblxuY29uc3QgYXBpS2V5ID0gYXBpLmFkZEFwaUtleSgnQ2FzY2FkZU9wZXJhdG9yQXBpS2V5Jywge1xuXHRhcGlLZXlOYW1lOiAnQ2FzY2FkZU9wZXJhdG9yQXBpS2V5Jyxcbn0pO1xuXG5jb25zdCB1c2FnZVBsYW4gPSBhcGkuYWRkVXNhZ2VQbGFuKCdDYXNjYWRlQXBpVXNhZ2VQbGFuJywge1xuXHRuYW1lOiAnQ2FzY2FkZUFwaVVzYWdlUGxhbicsXG5cdHRocm90dGxlOiB7XG5cdFx0YnVyc3RMaW1pdDogMjAwLFxuXHRcdHJhdGVMaW1pdDogMTAwMCAvIDYwLFxuXHR9LFxufSk7XG5cbnVzYWdlUGxhbi5hZGRBcGlLZXkoYXBpS2V5KTtcbnVzYWdlUGxhbi5hZGRBcGlTdGFnZSh7XG5cdGFwaSxcblx0c3RhZ2U6IGFwaS5kZXBsb3ltZW50U3RhZ2UsXG5cdHRocm90dGxlOiBbXG5cdFx0e1xuXHRcdFx0bWV0aG9kOiBkZXBlbmRlbmN5R3JhcGhHZXRNZXRob2QsXG5cdFx0XHR0aHJvdHRsZToge1xuXHRcdFx0XHRidXJzdExpbWl0OiAyMDAsXG5cdFx0XHRcdHJhdGVMaW1pdDogMTAwMCAvIDYwLFxuXHRcdFx0fSxcblx0XHR9LFxuXHRcdHtcblx0XHRcdG1ldGhvZDogYWN0aXZlU2lnbmF0dXJlc0dldE1ldGhvZCxcblx0XHRcdHRocm90dGxlOiB7XG5cdFx0XHRcdGJ1cnN0TGltaXQ6IDIwMCxcblx0XHRcdFx0cmF0ZUxpbWl0OiAxMDAwIC8gNjAsXG5cdFx0XHR9LFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0bWV0aG9kOiByZW1lZGlhdGlvblBsYW5zR2V0TWV0aG9kLFxuXHRcdFx0dGhyb3R0bGU6IHtcblx0XHRcdFx0YnVyc3RMaW1pdDogMjAwLFxuXHRcdFx0XHRyYXRlTGltaXQ6IDEwMDAgLyA2MCxcblx0XHRcdH0sXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRtZXRob2Q6IGFwcHJvdmFsUG9zdE1ldGhvZCxcblx0XHRcdHRocm90dGxlOiB7XG5cdFx0XHRcdGJ1cnN0TGltaXQ6IDIwMCxcblx0XHRcdFx0cmF0ZUxpbWl0OiAxMDAwIC8gNjAsXG5cdFx0XHR9LFxuXHRcdH0sXG5cdF0sXG59KTtcblxubmV3IGNkay5DZm5PdXRwdXQoc3RhY2ssICdDYXNjYWRlUHJldmVudGlvblVzZXJQb29sSWQnLCB7XG5cdHZhbHVlOiB1c2VyUG9vbC51c2VyUG9vbElkLFxufSk7XG5cbm5ldyBjZGsuQ2ZuT3V0cHV0KHN0YWNrLCAnQ2FzY2FkZVByZXZlbnRpb25Vc2VyUG9vbENsaWVudElkJywge1xuXHR2YWx1ZTogdXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbn0pO1xuXG5uZXcgY2RrLkNmbk91dHB1dChzdGFjaywgJ0Nhc2NhZGVPcGVyYXRvckFwaUtleUlkJywge1xuXHR2YWx1ZTogYXBpS2V5LmtleUlkLFxufSk7XG5cbm5ldyBjZGsuQ2ZuT3V0cHV0KHN0YWNrLCAnQ2FzY2FkZVByZXZlbnRpb25BcGlVcmwnLCB7XG5cdHZhbHVlOiBhcGkudXJsLFxufSk7XG4iXX0=