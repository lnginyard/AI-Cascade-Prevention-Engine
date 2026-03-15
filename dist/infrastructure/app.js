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
    return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}
const configuredWebhookUrl = app.node.tryGetContext('webhookUrl');
const configuredSlackWebhookUrl = app.node.tryGetContext('slackWebhookUrl');
const configuredTeamsWebhookUrl = app.node.tryGetContext('teamsWebhookUrl');
const configuredStatuspageWebhookUrl = app.node.tryGetContext('statuspageWebhookUrl');
const configuredExecutiveEmails = parseCsvContext(app.node.tryGetContext('executiveEmails'));
const configuredStakeholderEmails = parseCsvContext(app.node.tryGetContext('stakeholderEmails'));
const configuredStakeholderSms = parseCsvContext(app.node.tryGetContext('stakeholderSms'));
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
new cdk.CfnOutput(stack, 'CascadePreventionApiUrl', {
    value: api.url,
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vaW5mcmFzdHJ1Y3R1cmUvYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHdFQUEwRDtBQUMxRCwrRUFBZ0U7QUFDaEUsdUVBQXlEO0FBQ3pELGlFQUFtRDtBQUNuRCx1RUFBeUQ7QUFDekQsNEVBQThEO0FBQzlELG1FQUFxRDtBQUNyRCwrREFBaUQ7QUFDakQsd0VBQTBEO0FBQzFELHlEQUEyQztBQUMzQywrREFBaUQ7QUFDakQsaUVBQW1EO0FBQ25ELGdGQUFrRTtBQUNsRSx1REFBeUM7QUFDekMsd0VBQTBEO0FBQzFELHlEQUEyQztBQUMzQyxvRkFBc0U7QUFDdEUsbUVBQXFEO0FBQ3JELDhFQUFnRTtBQUNoRSxxRUFBK0Q7QUFDL0QsMkNBQTZCO0FBQzdCLG9GQUFzRTtBQUV0RSxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxrQkFBa0IsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0FBQ3ZELE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUM7QUFDbkQsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQztBQUNqRCxNQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLHdCQUF3QixFQUFFLFVBQVUsSUFBSSxTQUFTO0lBQ2pGLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxFQUFFO0lBQ3JELENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUVkLFNBQVMsZUFBZSxDQUFDLEtBQXlCO0lBQ2pELElBQUksQ0FBQyxLQUFLO1FBQUUsT0FBTyxFQUFFLENBQUM7SUFDdEIs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O1xuaW1wb3J0ICogYXMgYWNtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jZXJ0aWZpY2F0ZW1hbmFnZXInO1xuaW1wb3J0IHsgQ2ZuSW5jbHVkZSB9IGZyb20gJ2F3cy1jZGstbGliL2Nsb3VkZm9ybWF0aW9uLWluY2x1ZGUnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyByb3V0ZTUzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yb3V0ZTUzJztcbmltcG9ydCAqIGFzIHJvdXRlNTNUYXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yb3V0ZTUzLXRhcmdldHMnO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIHMzZGVwbG95IGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMy1kZXBsb3ltZW50JztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIHNuc1N1YnNjcmlwdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucy1zdWJzY3JpcHRpb25zJztcbmltcG9ydCAqIGFzIHNmbiBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3RlcGZ1bmN0aW9ucyc7XG5pbXBvcnQgKiBhcyBzZm5UYXNrcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3RlcGZ1bmN0aW9ucy10YXNrcyc7XG5pbXBvcnQgeyBOb2RlanNGdW5jdGlvbiB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEtbm9kZWpzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBQbGF5Ym9va01hcHBpbmdzIH0gZnJvbSAnLi4vbGliL3BsYXlib29rLW1hcHBpbmdzLWNvbnN0cnVjdCc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKHsgYW5hbHl0aWNzUmVwb3J0aW5nOiBmYWxzZSB9KTtcbmNvbnN0IGNka0FjY291bnQgPSBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5UO1xuY29uc3QgY2RrUmVnaW9uID0gcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OO1xuY29uc3Qgc3RhY2sgPSBuZXcgY2RrLlN0YWNrKGFwcCwgJ0Nhc2NhZGVQcmV2ZW50aW9uU3RhY2snLCBjZGtBY2NvdW50ICYmIGNka1JlZ2lvblxuXHQ/IHsgZW52OiB7IGFjY291bnQ6IGNka0FjY291bnQsIHJlZ2lvbjogY2RrUmVnaW9uIH0gfVxuXHQ6IHVuZGVmaW5lZCk7XG5cbmZ1bmN0aW9uIHBhcnNlQ3N2Q29udGV4dCh2YWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogc3RyaW5nW10ge1xuXHRpZiAoIXZhbHVlKSByZXR1cm4gW107XG5cdHJldHVybiB2YWx1ZVxuXHRcdC5zcGxpdCgnLCcpXG5cdFx0Lm1hcCgoaXRlbSkgPT4gaXRlbS50cmltKCkpXG5cdFx0LmZpbHRlcigoaXRlbSkgPT4gaXRlbS5sZW5ndGggPiAwKTtcbn1cblxuY29uc3QgY29uZmlndXJlZFdlYmhvb2tVcmwgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCd3ZWJob29rVXJsJykgYXMgc3RyaW5nIHwgdW5kZWZpbmVkO1xuY29uc3QgY29uZmlndXJlZFNsYWNrV2ViaG9va1VybCA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ3NsYWNrV2ViaG9va1VybCcpIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbmNvbnN0IGNvbmZpZ3VyZWRUZWFtc1dlYmhvb2tVcmwgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCd0ZWFtc1dlYmhvb2tVcmwnKSBhcyBzdHJpbmcgfCB1bmRlZmluZWQ7XG5jb25zdCBjb25maWd1cmVkU3RhdHVzcGFnZVdlYmhvb2tVcmwgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdzdGF0dXNwYWdlV2ViaG9va1VybCcpIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbmNvbnN0IGNvbmZpZ3VyZWRFeGVjdXRpdmVFbWFpbHMgPSBwYXJzZUNzdkNvbnRleHQoYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnZXhlY3V0aXZlRW1haWxzJykgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKTtcbmNvbnN0IGNvbmZpZ3VyZWRTdGFrZWhvbGRlckVtYWlscyA9IHBhcnNlQ3N2Q29udGV4dChhcHAubm9kZS50cnlHZXRDb250ZXh0KCdzdGFrZWhvbGRlckVtYWlscycpIGFzIHN0cmluZyB8IHVuZGVmaW5lZCk7XG5jb25zdCBjb25maWd1cmVkU3Rha2Vob2xkZXJTbXMgPSBwYXJzZUNzdkNvbnRleHQoYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnc3Rha2Vob2xkZXJTbXMnKSBhcyBzdHJpbmcgfCB1bmRlZmluZWQpO1xuY29uc3Qgd2ViaG9va1VybCA9IGNvbmZpZ3VyZWRXZWJob29rVXJsID8/ICcnO1xuY29uc3Qgc2xhY2tXZWJob29rVXJsID0gY29uZmlndXJlZFNsYWNrV2ViaG9va1VybCA/PyAnJztcbmNvbnN0IHRlYW1zV2ViaG9va1VybCA9IGNvbmZpZ3VyZWRUZWFtc1dlYmhvb2tVcmwgPz8gJyc7XG5jb25zdCBzdGF0dXNwYWdlV2ViaG9va1VybCA9IGNvbmZpZ3VyZWRTdGF0dXNwYWdlV2ViaG9va1VybCA/PyAnJztcbmNvbnN0IHdlYmhvb2tFbmFibGVkID0gKGNvbmZpZ3VyZWRXZWJob29rVXJsIHx8IGNvbmZpZ3VyZWRTbGFja1dlYmhvb2tVcmwgfHwgY29uZmlndXJlZFRlYW1zV2ViaG9va1VybCB8fCBjb25maWd1cmVkU3RhdHVzcGFnZVdlYmhvb2tVcmwpID8gJ3RydWUnIDogJ2ZhbHNlJztcbmNvbnN0IGNvbnRleHRVaURvbWFpbk5hbWUgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCd1aURvbWFpbk5hbWUnKSBhcyBzdHJpbmcgfCB1bmRlZmluZWQ7XG5jb25zdCBjb250ZXh0VWlIb3N0ZWRab25lRG9tYWluID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgndWlIb3N0ZWRab25lRG9tYWluJykgYXMgc3RyaW5nIHwgdW5kZWZpbmVkO1xuY29uc3QgY29udGV4dEFydGljbGVEb21haW5OYW1lID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnYXJ0aWNsZURvbWFpbk5hbWUnKSBhcyBzdHJpbmcgfCB1bmRlZmluZWQ7XG5jb25zdCBjb250ZXh0QXJ0aWNsZUhvc3RlZFpvbmVEb21haW4gPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdhcnRpY2xlSG9zdGVkWm9uZURvbWFpbicpIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbmNvbnN0IGNhblVzZUN1c3RvbURvbWFpbnMgPSBCb29sZWFuKGNka0FjY291bnQgJiYgY2RrUmVnaW9uKTtcblxuaWYgKCFjYW5Vc2VDdXN0b21Eb21haW5zICYmIChjb250ZXh0VWlEb21haW5OYW1lIHx8IGNvbnRleHRBcnRpY2xlRG9tYWluTmFtZSkpIHtcblx0Y29uc29sZS53YXJuKCdDdXN0b20gZG9tYWluIGNvbnRleHQgZGV0ZWN0ZWQsIGJ1dCBDREtfREVGQVVMVF9BQ0NPVU5UL0NES19ERUZBVUxUX1JFR0lPTiBhcmUgbm90IHNldC4gRmFsbGluZyBiYWNrIHRvIENsb3VkRnJvbnQgZG9tYWlucyBmb3Igc3ludGguJyk7XG59XG5cbmNvbnN0IHVpRG9tYWluTmFtZSA9IGNhblVzZUN1c3RvbURvbWFpbnMgPyBjb250ZXh0VWlEb21haW5OYW1lIDogdW5kZWZpbmVkO1xuY29uc3QgdWlIb3N0ZWRab25lRG9tYWluID0gY2FuVXNlQ3VzdG9tRG9tYWlucyA/IGNvbnRleHRVaUhvc3RlZFpvbmVEb21haW4gOiB1bmRlZmluZWQ7XG5jb25zdCBhcnRpY2xlRG9tYWluTmFtZSA9IGNhblVzZUN1c3RvbURvbWFpbnMgPyBjb250ZXh0QXJ0aWNsZURvbWFpbk5hbWUgOiB1bmRlZmluZWQ7XG5jb25zdCBhcnRpY2xlSG9zdGVkWm9uZURvbWFpbiA9IGNhblVzZUN1c3RvbURvbWFpbnMgPyBjb250ZXh0QXJ0aWNsZUhvc3RlZFpvbmVEb21haW4gOiB1bmRlZmluZWQ7XG5cbnR5cGUgU3RhdGljU2l0ZUNvbmZpZyA9IHtcblx0aWQ6IHN0cmluZztcblx0YXNzZXRQYXRoOiBzdHJpbmc7XG5cdGRvbWFpbk5hbWU/OiBzdHJpbmc7XG5cdGhvc3RlZFpvbmVEb21haW4/OiBzdHJpbmc7XG5cdHNwYTogYm9vbGVhbjtcblx0ZGVzY3JpcHRpb246IHN0cmluZztcbn07XG5cbmZ1bmN0aW9uIHJlc29sdmVSZWNvcmROYW1lKGRvbWFpbk5hbWU6IHN0cmluZywgem9uZU5hbWU6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdGlmIChkb21haW5OYW1lID09PSB6b25lTmFtZSkge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRjb25zdCBzdWZmaXggPSBgLiR7em9uZU5hbWV9YDtcblx0aWYgKGRvbWFpbk5hbWUuZW5kc1dpdGgoc3VmZml4KSkge1xuXHRcdHJldHVybiBkb21haW5OYW1lLnNsaWNlKDAsIC1zdWZmaXgubGVuZ3RoKTtcblx0fVxuXG5cdHJldHVybiBkb21haW5OYW1lO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVTdGF0aWNTaXRlKGNvbmZpZzogU3RhdGljU2l0ZUNvbmZpZykge1xuXHRjb25zdCB3ZWJzaXRlQnVja2V0ID0gbmV3IHMzLkJ1Y2tldChzdGFjaywgYCR7Y29uZmlnLmlkfUJ1Y2tldGAsIHtcblx0XHRlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG5cdFx0YmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcblx0XHRlbmZvcmNlU1NMOiB0cnVlLFxuXHRcdGF1dG9EZWxldGVPYmplY3RzOiBmYWxzZSxcblx0XHRyZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG5cdH0pO1xuXG5cdGxldCBob3N0ZWRab25lOiByb3V0ZTUzLklIb3N0ZWRab25lIHwgdW5kZWZpbmVkO1xuXHRsZXQgY2VydGlmaWNhdGU6IGFjbS5JQ2VydGlmaWNhdGUgfCB1bmRlZmluZWQ7XG5cblx0aWYgKGNvbmZpZy5kb21haW5OYW1lICYmIGNvbmZpZy5ob3N0ZWRab25lRG9tYWluKSB7XG5cdFx0aG9zdGVkWm9uZSA9IHJvdXRlNTMuSG9zdGVkWm9uZS5mcm9tTG9va3VwKHN0YWNrLCBgJHtjb25maWcuaWR9SG9zdGVkWm9uZWAsIHtcblx0XHRcdGRvbWFpbk5hbWU6IGNvbmZpZy5ob3N0ZWRab25lRG9tYWluLFxuXHRcdH0pO1xuXG5cdFx0Y2VydGlmaWNhdGUgPSBuZXcgYWNtLkRuc1ZhbGlkYXRlZENlcnRpZmljYXRlKHN0YWNrLCBgJHtjb25maWcuaWR9Q2VydGlmaWNhdGVgLCB7XG5cdFx0XHRkb21haW5OYW1lOiBjb25maWcuZG9tYWluTmFtZSxcblx0XHRcdGhvc3RlZFpvbmUsXG5cdFx0XHRyZWdpb246ICd1cy1lYXN0LTEnLFxuXHRcdH0pO1xuXHR9XG5cblx0Y29uc3QgZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKHN0YWNrLCBgJHtjb25maWcuaWR9RGlzdHJpYnV0aW9uYCwge1xuXHRcdGNlcnRpZmljYXRlLFxuXHRcdGRvbWFpbk5hbWVzOiBjb25maWcuZG9tYWluTmFtZSA/IFtjb25maWcuZG9tYWluTmFtZV0gOiB1bmRlZmluZWQsXG5cdFx0ZGVmYXVsdFJvb3RPYmplY3Q6ICdpbmRleC5odG1sJyxcblx0XHRkZWZhdWx0QmVoYXZpb3I6IHtcblx0XHRcdG9yaWdpbjogb3JpZ2lucy5TM0J1Y2tldE9yaWdpbi53aXRoT3JpZ2luQWNjZXNzQ29udHJvbCh3ZWJzaXRlQnVja2V0KSxcblx0XHRcdHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuXHRcdFx0Y29tcHJlc3M6IHRydWUsXG5cdFx0fSxcblx0XHRlcnJvclJlc3BvbnNlczogY29uZmlnLnNwYVxuXHRcdFx0PyBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRodHRwU3RhdHVzOiA0MDMsXG5cdFx0XHRcdFx0cmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG5cdFx0XHRcdFx0cmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcblx0XHRcdFx0XHR0dGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aHR0cFN0YXR1czogNDA0LFxuXHRcdFx0XHRcdHJlc3BvbnNlSHR0cFN0YXR1czogMjAwLFxuXHRcdFx0XHRcdHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG5cdFx0XHRcdFx0dHRsOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcblx0XHRcdFx0fSxcblx0XHRcdF1cblx0XHRcdDogdW5kZWZpbmVkLFxuXHRcdGNvbW1lbnQ6IGNvbmZpZy5kZXNjcmlwdGlvbixcblx0fSk7XG5cblx0bmV3IHMzZGVwbG95LkJ1Y2tldERlcGxveW1lbnQoc3RhY2ssIGAke2NvbmZpZy5pZH1EZXBsb3ltZW50YCwge1xuXHRcdGRlc3RpbmF0aW9uQnVja2V0OiB3ZWJzaXRlQnVja2V0LFxuXHRcdGRpc3RyaWJ1dGlvbixcblx0XHRkaXN0cmlidXRpb25QYXRoczogWycvKiddLFxuXHRcdHNvdXJjZXM6IFtzM2RlcGxveS5Tb3VyY2UuYXNzZXQoY29uZmlnLmFzc2V0UGF0aCldLFxuXHR9KTtcblxuXHRpZiAoaG9zdGVkWm9uZSAmJiBjb25maWcuZG9tYWluTmFtZSkge1xuXHRcdGNvbnN0IHJlY29yZE5hbWUgPSByZXNvbHZlUmVjb3JkTmFtZShjb25maWcuZG9tYWluTmFtZSwgaG9zdGVkWm9uZS56b25lTmFtZSk7XG5cblx0XHRuZXcgcm91dGU1My5BUmVjb3JkKHN0YWNrLCBgJHtjb25maWcuaWR9QWxpYXNSZWNvcmRgLCB7XG5cdFx0XHR6b25lOiBob3N0ZWRab25lLFxuXHRcdFx0cmVjb3JkTmFtZSxcblx0XHRcdHRhcmdldDogcm91dGU1My5SZWNvcmRUYXJnZXQuZnJvbUFsaWFzKG5ldyByb3V0ZTUzVGFyZ2V0cy5DbG91ZEZyb250VGFyZ2V0KGRpc3RyaWJ1dGlvbikpLFxuXHRcdH0pO1xuXG5cdFx0bmV3IHJvdXRlNTMuQWFhYVJlY29yZChzdGFjaywgYCR7Y29uZmlnLmlkfUFsaWFzUmVjb3JkSXB2NmAsIHtcblx0XHRcdHpvbmU6IGhvc3RlZFpvbmUsXG5cdFx0XHRyZWNvcmROYW1lLFxuXHRcdFx0dGFyZ2V0OiByb3V0ZTUzLlJlY29yZFRhcmdldC5mcm9tQWxpYXMobmV3IHJvdXRlNTNUYXJnZXRzLkNsb3VkRnJvbnRUYXJnZXQoZGlzdHJpYnV0aW9uKSksXG5cdFx0fSk7XG5cdH1cblxuXHRuZXcgY2RrLkNmbk91dHB1dChzdGFjaywgYCR7Y29uZmlnLmlkfUJ1Y2tldE5hbWVgLCB7XG5cdFx0dmFsdWU6IHdlYnNpdGVCdWNrZXQuYnVja2V0TmFtZSxcblx0fSk7XG5cblx0bmV3IGNkay5DZm5PdXRwdXQoc3RhY2ssIGAke2NvbmZpZy5pZH1DbG91ZEZyb250RG9tYWluYCwge1xuXHRcdHZhbHVlOiBkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZSxcblx0fSk7XG5cblx0bmV3IGNkay5DZm5PdXRwdXQoc3RhY2ssIGAke2NvbmZpZy5pZH1VcmxgLCB7XG5cdFx0dmFsdWU6IGNvbmZpZy5kb21haW5OYW1lID8gYGh0dHBzOi8vJHtjb25maWcuZG9tYWluTmFtZX1gIDogYGh0dHBzOi8vJHtkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZX1gLFxuXHR9KTtcblxuXHRyZXR1cm4ge1xuXHRcdGJ1Y2tldDogd2Vic2l0ZUJ1Y2tldCxcblx0XHRkaXN0cmlidXRpb24sXG5cdH07XG59XG5cbmNvbnN0IGluY2x1ZGVkID0gbmV3IENmbkluY2x1ZGUoc3RhY2ssICdDYXNjYWRlUHJldmVudGlvblRlbXBsYXRlJywge1xuXHR0ZW1wbGF0ZUZpbGU6ICdjZm4tdGVtcGxhdGUueWFtbCcsXG59KTtcblxuY3JlYXRlU3RhdGljU2l0ZSh7XG5cdGlkOiAnT3BlcmF0aW9uc0NvbnNvbGUnLFxuXHRhc3NldFBhdGg6IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi91aScpLFxuXHRkb21haW5OYW1lOiB1aURvbWFpbk5hbWUsXG5cdGhvc3RlZFpvbmVEb21haW46IHVpSG9zdGVkWm9uZURvbWFpbixcblx0c3BhOiB0cnVlLFxuXHRkZXNjcmlwdGlvbjogJ0Nhc2NhZGUgUHJldmVudGlvbiBFbmdpbmUgb3BlcmF0aW9ucyBjb25zb2xlJyxcbn0pO1xuXG5jcmVhdGVTdGF0aWNTaXRlKHtcblx0aWQ6ICdBcnRpY2xlU2l0ZScsXG5cdGFzc2V0UGF0aDogcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL2FydGljbGUnKSxcblx0ZG9tYWluTmFtZTogYXJ0aWNsZURvbWFpbk5hbWUsXG5cdGhvc3RlZFpvbmVEb21haW46IGFydGljbGVIb3N0ZWRab25lRG9tYWluLFxuXHRzcGE6IGZhbHNlLFxuXHRkZXNjcmlwdGlvbjogJ0Nhc2NhZGUgUHJldmVudGlvbiBFbmdpbmUgYXJ0aWNsZSBzaXRlJyxcbn0pO1xuXG5jb25zdCBwbGF5Ym9va01hcHBpbmdzID0gbmV3IFBsYXlib29rTWFwcGluZ3Moc3RhY2ssICdQbGF5Ym9va01hcHBpbmdzJywge1xuXHR0YWJsZU5hbWU6ICdDYXNjYWRlUHJldmVudGlvbi1QbGF5Ym9va01hcHBpbmdzJyxcblx0ZXZlbnRCdXNOYW1lOiAnQ2FzY2FkZVByZXZlbnRpb24tUGxheWJvb2tFdmVudEJ1cycsXG59KTtcblxuY29uc3QgdGVsZW1ldHJ5QnVja2V0ID0gaW5jbHVkZWQuZ2V0UmVzb3VyY2UoJ1RlbGVtZXRyeUJ1Y2tldDcxMEZGMkM4JykgYXMgczMuQ2ZuQnVja2V0O1xuY29uc3QgdGVsZW1ldHJ5Q2FjaGVUYWJsZSA9IGluY2x1ZGVkLmdldFJlc291cmNlKCdUZWxlbWV0cnlDYWNoZUQyOUEwMzk1JykgYXMgZHluYW1vZGIuQ2ZuVGFibGU7XG5jb25zdCBkZXBlbmRlbmN5R3JhcGhUYWJsZSA9IGluY2x1ZGVkLmdldFJlc291cmNlKCdEZXBlbmRlbmN5R3JhcGgzMzI0ODMzRScpIGFzIGR5bmFtb2RiLkNmblRhYmxlO1xuY29uc3Qgc2lnbmF0dXJlc1RhYmxlID0gaW5jbHVkZWQuZ2V0UmVzb3VyY2UoJ1NpZ25hdHVyZXNUYWJsZTc5NzMzQTlDJykgYXMgZHluYW1vZGIuQ2ZuVGFibGU7XG5jb25zdCBldmVudEJ1cyA9IGluY2x1ZGVkLmdldFJlc291cmNlKCdFdmVudEJ1czdCODc0OEFBJykgYXMgZXZlbnRzLkNmbkV2ZW50QnVzO1xuXG5jb25zdCByZW1lZGlhdGlvblBsYW5zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUoc3RhY2ssICdSZW1lZGlhdGlvblBsYW5zVGFibGUnLCB7XG5cdHRhYmxlTmFtZTogJ0Nhc2NhZGVQcmV2ZW50aW9uLVJlbWVkaWF0aW9uUGxhbnMnLFxuXHRwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3BsYW5JZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG5cdGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG5cdHBvaW50SW5UaW1lUmVjb3ZlcnlTcGVjaWZpY2F0aW9uOiB7XG5cdFx0cG9pbnRJblRpbWVSZWNvdmVyeUVuYWJsZWQ6IHRydWUsXG5cdH0sXG5cdGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcblx0cmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxufSk7XG5cbmNvbnN0IGNhc2NhZGVBbGVydHNUb3BpYyA9IG5ldyBzbnMuVG9waWMoc3RhY2ssICdDYXNjYWRlQWxlcnRzVG9waWMnLCB7XG5cdGRpc3BsYXlOYW1lOiAnQ2FzY2FkZSBQcmV2ZW50aW9uIEFsZXJ0cycsXG59KTtcblxuY29uc3Qgbm90aWZpY2F0aW9uRW1haWxzID0gWy4uLm5ldyBTZXQoWy4uLmNvbmZpZ3VyZWRFeGVjdXRpdmVFbWFpbHMsIC4uLmNvbmZpZ3VyZWRTdGFrZWhvbGRlckVtYWlsc10pXTtcbmZvciAoY29uc3QgZW1haWwgb2Ygbm90aWZpY2F0aW9uRW1haWxzKSB7XG5cdGNhc2NhZGVBbGVydHNUb3BpYy5hZGRTdWJzY3JpcHRpb24obmV3IHNuc1N1YnNjcmlwdGlvbnMuRW1haWxTdWJzY3JpcHRpb24oZW1haWwpKTtcbn1cblxuZm9yIChjb25zdCBzbXNOdW1iZXIgb2YgY29uZmlndXJlZFN0YWtlaG9sZGVyU21zKSB7XG5cdGNhc2NhZGVBbGVydHNUb3BpYy5hZGRTdWJzY3JpcHRpb24obmV3IHNuc1N1YnNjcmlwdGlvbnMuU21zU3Vic2NyaXB0aW9uKHNtc051bWJlcikpO1xufVxuXG5jb25zdCB0ZWxlbWV0cnlJbmdlc3RGdW5jdGlvbiA9IG5ldyBOb2RlanNGdW5jdGlvbihzdGFjaywgJ1RlbGVtZXRyeUluZ2VzdEZ1bmN0aW9uJywge1xuXHRydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcblx0ZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9zcmMvdGVsZW1ldHJ5L2luZ2VzdGlvbl9oYW5kbGVyLnRzJyksXG5cdGhhbmRsZXI6ICdoYW5kbGVyJyxcblx0dGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuXHRtZW1vcnlTaXplOiAyNTYsXG5cdGVudmlyb25tZW50OiB7XG5cdFx0VEVMRU1FVFJZX0JVQ0tFVDogdGVsZW1ldHJ5QnVja2V0LnJlZixcblx0XHRFVkVOVF9CVVNfTkFNRTogZXZlbnRCdXMucmVmLFxuXHRcdFRFTEVNRVRSWV9DQUNIRV9UQUJMRTogdGVsZW1ldHJ5Q2FjaGVUYWJsZS5yZWYsXG5cdH0sXG59KTtcblxudGVsZW1ldHJ5SW5nZXN0RnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcblx0YWN0aW9uczogWydzMzpQdXRPYmplY3QnXSxcblx0cmVzb3VyY2VzOiBbYCR7dGVsZW1ldHJ5QnVja2V0LmF0dHJBcm59LypgXSxcbn0pKTtcbnRlbGVtZXRyeUluZ2VzdEZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG5cdGFjdGlvbnM6IFsnZXZlbnRzOlB1dEV2ZW50cyddLFxuXHRyZXNvdXJjZXM6IFtldmVudEJ1cy5nZXRBdHQoJ0FybicpLnRvU3RyaW5nKCldLFxufSkpO1xudGVsZW1ldHJ5SW5nZXN0RnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcblx0YWN0aW9uczogWydkeW5hbW9kYjpQdXRJdGVtJ10sXG5cdHJlc291cmNlczogW3RlbGVtZXRyeUNhY2hlVGFibGUuYXR0ckFybl0sXG59KSk7XG5cbmNvbnN0IHNpZ25hdHVyZU1hdGNoZXJWMkZ1bmN0aW9uID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHN0YWNrLCAnU2lnbmF0dXJlTWF0Y2hlclYyRnVuY3Rpb24nLCB7XG5cdHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuXHRlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL3NyYy9kZXRlY3Rpb24vc2lnbmF0dXJlX21hdGNoZXJfaGFuZGxlci50cycpLFxuXHRoYW5kbGVyOiAnaGFuZGxlcicsXG5cdHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcblx0bWVtb3J5U2l6ZTogMjU2LFxuXHRlbnZpcm9ubWVudDoge1xuXHRcdFNJR05BVFVSRVNfVEFCTEVfTkFNRTogc2lnbmF0dXJlc1RhYmxlLnJlZixcblx0XHRFVkVOVF9CVVNfTkFNRTogZXZlbnRCdXMucmVmLFxuXHRcdEFMRVJUX1RPUElDX0FSTjogY2FzY2FkZUFsZXJ0c1RvcGljLnRvcGljQXJuLFxuXHR9LFxufSk7XG5cbnNpZ25hdHVyZU1hdGNoZXJWMkZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG5cdGFjdGlvbnM6IFsnZHluYW1vZGI6UHV0SXRlbSddLFxuXHRyZXNvdXJjZXM6IFtzaWduYXR1cmVzVGFibGUuYXR0ckFybl0sXG59KSk7XG5zaWduYXR1cmVNYXRjaGVyVjJGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuXHRhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcblx0cmVzb3VyY2VzOiBbZXZlbnRCdXMuZ2V0QXR0KCdBcm4nKS50b1N0cmluZygpXSxcbn0pKTtcbmNhc2NhZGVBbGVydHNUb3BpYy5ncmFudFB1Ymxpc2goc2lnbmF0dXJlTWF0Y2hlclYyRnVuY3Rpb24pO1xuXG5jb25zdCBhbm9tYWx5VG9TaWduYXR1cmVWMlJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUoc3RhY2ssICdBbm9tYWx5VG9TaWduYXR1cmVWMlJ1bGUnLCB7XG5cdGV2ZW50UGF0dGVybjoge1xuXHRcdHNvdXJjZTogWydjYXNjYWRlLXByZXZlbnRpb24uYW5vbWFseSddLFxuXHRcdGRldGFpbFR5cGU6IFsnQW5vbWFseURldGVjdGVkJ10sXG5cdH0sXG5cdGV2ZW50QnVzOiBldmVudHMuRXZlbnRCdXMuZnJvbUV2ZW50QnVzTmFtZShzdGFjaywgJ0ltcG9ydGVkQ2FzY2FkZUV2ZW50QnVzJywgZXZlbnRCdXMucmVmKSxcbn0pO1xuYW5vbWFseVRvU2lnbmF0dXJlVjJSdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihzaWduYXR1cmVNYXRjaGVyVjJGdW5jdGlvbikpO1xuXG5jb25zdCBhcGlGdW5jdGlvbiA9IG5ldyBOb2RlanNGdW5jdGlvbihzdGFjaywgJ0Nhc2NhZGVBcGlGdW5jdGlvbicsIHtcblx0cnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG5cdGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vc3JjL2FwaS9hcGlfaGFuZGxlci50cycpLFxuXHRoYW5kbGVyOiAnaGFuZGxlcicsXG5cdHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcblx0bWVtb3J5U2l6ZTogMjU2LFxuXHRlbnZpcm9ubWVudDoge1xuXHRcdERFUEVOREVOQ1lfR1JBUEhfVEFCTEU6IGRlcGVuZGVuY3lHcmFwaFRhYmxlLnJlZixcblx0XHRTSUdOQVRVUkVTX1RBQkxFX05BTUU6IHNpZ25hdHVyZXNUYWJsZS5yZWYsXG5cdFx0UkVNRURJQVRJT05fUExBTlNfVEFCTEU6IHJlbWVkaWF0aW9uUGxhbnNUYWJsZS50YWJsZU5hbWUsXG5cdFx0RVZFTlRfQlVTX05BTUU6IGV2ZW50QnVzLnJlZixcblx0XHRBTEVSVF9UT1BJQ19BUk46IGNhc2NhZGVBbGVydHNUb3BpYy50b3BpY0Fybixcblx0fSxcbn0pO1xuXG5hcGlGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuXHRhY3Rpb25zOiBbJ2R5bmFtb2RiOkdldEl0ZW0nLCAnZHluYW1vZGI6U2NhbicsICdkeW5hbW9kYjpRdWVyeScsICdkeW5hbW9kYjpQdXRJdGVtJ10sXG5cdHJlc291cmNlczogW1xuXHRcdGRlcGVuZGVuY3lHcmFwaFRhYmxlLmF0dHJBcm4sXG5cdFx0c2lnbmF0dXJlc1RhYmxlLmF0dHJBcm4sXG5cdFx0cmVtZWRpYXRpb25QbGFuc1RhYmxlLnRhYmxlQXJuLFxuXHRdLFxufSkpO1xuYXBpRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcblx0YWN0aW9uczogWydldmVudHM6UHV0RXZlbnRzJ10sXG5cdHJlc291cmNlczogW2V2ZW50QnVzLmdldEF0dCgnQXJuJykudG9TdHJpbmcoKV0sXG59KSk7XG5jYXNjYWRlQWxlcnRzVG9waWMuZ3JhbnRQdWJsaXNoKGFwaUZ1bmN0aW9uKTtcblxuY29uc3Qgd2ViaG9va05vdGlmaWVyRnVuY3Rpb24gPSBuZXcgTm9kZWpzRnVuY3Rpb24oc3RhY2ssICdXZWJob29rTm90aWZpZXJGdW5jdGlvbicsIHtcblx0cnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG5cdGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vc3JjL2ludGVncmF0aW9ucy93ZWJob29rX25vdGlmaWVyX2hhbmRsZXIudHMnKSxcblx0aGFuZGxlcjogJ2hhbmRsZXInLFxuXHR0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG5cdG1lbW9yeVNpemU6IDI1Nixcblx0ZW52aXJvbm1lbnQ6IHtcblx0XHRXRUJIT09LX1VSTDogd2ViaG9va1VybCxcblx0XHRTTEFDS19XRUJIT09LX1VSTDogc2xhY2tXZWJob29rVXJsLFxuXHRcdFRFQU1TX1dFQkhPT0tfVVJMOiB0ZWFtc1dlYmhvb2tVcmwsXG5cdFx0U1RBVFVTUEFHRV9XRUJIT09LX1VSTDogc3RhdHVzcGFnZVdlYmhvb2tVcmwsXG5cdFx0V0VCSE9PS19FTkFCTEVEOiB3ZWJob29rRW5hYmxlZCxcblx0fSxcbn0pO1xuXG5jb25zdCByZW1lZGlhdGlvbkFjdGlvbkV4ZWN1dG9yRnVuY3Rpb24gPSBuZXcgTm9kZWpzRnVuY3Rpb24oc3RhY2ssICdSZW1lZGlhdGlvbkFjdGlvbkV4ZWN1dG9yRnVuY3Rpb24nLCB7XG5cdHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuXHRlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL3NyYy9vcmNoZXN0cmF0aW9uL2FjdGlvbl9leGVjdXRvcl9oYW5kbGVyLnRzJyksXG5cdGhhbmRsZXI6ICdoYW5kbGVyJyxcblx0dGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuXHRtZW1vcnlTaXplOiAyNTYsXG5cdGVudmlyb25tZW50OiB7XG5cdFx0RVZFTlRfQlVTX05BTUU6IGV2ZW50QnVzLnJlZixcblx0fSxcbn0pO1xucmVtZWRpYXRpb25BY3Rpb25FeGVjdXRvckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG5cdGFjdGlvbnM6IFsnZXZlbnRzOlB1dEV2ZW50cyddLFxuXHRyZXNvdXJjZXM6IFtldmVudEJ1cy5nZXRBdHQoJ0FybicpLnRvU3RyaW5nKCldLFxufSkpO1xuXG5jb25zdCBleGVjdXRlQWN0aW9uU3RlcCA9IG5ldyBzZm5UYXNrcy5MYW1iZGFJbnZva2Uoc3RhY2ssICdFeGVjdXRlQWN0aW9uU3RlcCcsIHtcblx0bGFtYmRhRnVuY3Rpb246IHJlbWVkaWF0aW9uQWN0aW9uRXhlY3V0b3JGdW5jdGlvbixcblx0cGF5bG9hZDogc2ZuLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcblx0XHRwbGFuSWQ6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5wbGFuSWQnKSxcblx0XHRzaWduYXR1cmVJZDogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLnNpZ25hdHVyZUlkJyksXG5cdFx0bW9kZTogJ2V4ZWN1dGUnLFxuXHRcdGFjdGlvbjogc2ZuLkpzb25QYXRoLm9iamVjdEF0KCckJC5NYXAuSXRlbS5WYWx1ZScpLFxuXHR9KSxcblx0b3V0cHV0UGF0aDogJyQuUGF5bG9hZCcsXG59KTtcblxuY29uc3Qgcm9sbGJhY2tBY3Rpb25TdGVwID0gbmV3IHNmblRhc2tzLkxhbWJkYUludm9rZShzdGFjaywgJ1JvbGxiYWNrQWN0aW9uU3RlcCcsIHtcblx0bGFtYmRhRnVuY3Rpb246IHJlbWVkaWF0aW9uQWN0aW9uRXhlY3V0b3JGdW5jdGlvbixcblx0cGF5bG9hZDogc2ZuLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcblx0XHRwbGFuSWQ6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5wbGFuSWQnKSxcblx0XHRzaWduYXR1cmVJZDogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLnNpZ25hdHVyZUlkJyksXG5cdFx0bW9kZTogJ3JvbGxiYWNrJyxcblx0XHRhY3Rpb246IHNmbi5Kc29uUGF0aC5vYmplY3RBdCgnJCQuTWFwLkl0ZW0uVmFsdWUnKSxcblx0fSksXG5cdG91dHB1dFBhdGg6ICckLlBheWxvYWQnLFxufSk7XG5cbmNvbnN0IGV4ZWN1dGVBY3Rpb25zTWFwID0gbmV3IHNmbi5NYXAoc3RhY2ssICdFeGVjdXRlQWN0aW9uc01hcCcsIHtcblx0aXRlbXNQYXRoOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuYWN0aW9ucycpLFxuXHRtYXhDb25jdXJyZW5jeTogMSxcbn0pO1xuZXhlY3V0ZUFjdGlvbnNNYXAuaXRlbVByb2Nlc3NvcihleGVjdXRlQWN0aW9uU3RlcCk7XG5cbmNvbnN0IHJvbGxiYWNrQWN0aW9uc01hcCA9IG5ldyBzZm4uTWFwKHN0YWNrLCAnUm9sbGJhY2tBY3Rpb25zTWFwJywge1xuXHRpdGVtc1BhdGg6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5yb2xsYmFja0FjdGlvbnMnKSxcblx0bWF4Q29uY3VycmVuY3k6IDEsXG59KTtcbnJvbGxiYWNrQWN0aW9uc01hcC5pdGVtUHJvY2Vzc29yKHJvbGxiYWNrQWN0aW9uU3RlcCk7XG5cbmV4ZWN1dGVBY3Rpb25zTWFwLmFkZENhdGNoKHJvbGxiYWNrQWN0aW9uc01hcC5uZXh0KG5ldyBzZm4uRmFpbChzdGFjaywgJ1BsYW5FeGVjdXRpb25GYWlsZWQnKSkpO1xuXG5jb25zdCByZW1lZGlhdGlvblN0YXRlTWFjaGluZSA9IG5ldyBzZm4uU3RhdGVNYWNoaW5lKHN0YWNrLCAnUmVtZWRpYXRpb25TdGF0ZU1hY2hpbmUnLCB7XG5cdGRlZmluaXRpb25Cb2R5OiBzZm4uRGVmaW5pdGlvbkJvZHkuZnJvbUNoYWluYWJsZShleGVjdXRlQWN0aW9uc01hcC5uZXh0KG5ldyBzZm4uU3VjY2VlZChzdGFjaywgJ1BsYW5FeGVjdXRpb25TdWNjZWVkZWQnKSkpLFxuXHR0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMDApLFxufSk7XG5cbmNvbnN0IHJlbWVkaWF0aW9uUGxhbm5lckZ1bmN0aW9uID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHN0YWNrLCAnUmVtZWRpYXRpb25QbGFubmVyRnVuY3Rpb24nLCB7XG5cdHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuXHRlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL3NyYy9vcmNoZXN0cmF0aW9uL3JlbWVkaWF0aW9uX3BsYW5uZXJfaGFuZGxlci50cycpLFxuXHRoYW5kbGVyOiAnaGFuZGxlcicsXG5cdHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcblx0bWVtb3J5U2l6ZTogMjU2LFxuXHRlbnZpcm9ubWVudDoge1xuXHRcdFJFTUVESUFUSU9OX1BMQU5TX1RBQkxFOiByZW1lZGlhdGlvblBsYW5zVGFibGUudGFibGVOYW1lLFxuXHRcdEVWRU5UX0JVU19OQU1FOiBldmVudEJ1cy5yZWYsXG5cdFx0UkVNRURJQVRJT05fU1RBVEVfTUFDSElORV9BUk46IHJlbWVkaWF0aW9uU3RhdGVNYWNoaW5lLnN0YXRlTWFjaGluZUFybixcblx0fSxcbn0pO1xucmVtZWRpYXRpb25QbGFubmVyRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcblx0YWN0aW9uczogWydkeW5hbW9kYjpQdXRJdGVtJ10sXG5cdHJlc291cmNlczogW3JlbWVkaWF0aW9uUGxhbnNUYWJsZS50YWJsZUFybl0sXG59KSk7XG5yZW1lZGlhdGlvblBsYW5uZXJGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuXHRhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcblx0cmVzb3VyY2VzOiBbZXZlbnRCdXMuZ2V0QXR0KCdBcm4nKS50b1N0cmluZygpXSxcbn0pKTtcbnJlbWVkaWF0aW9uUGxhbm5lckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG5cdGFjdGlvbnM6IFsnc3RhdGVzOlN0YXJ0RXhlY3V0aW9uJ10sXG5cdHJlc291cmNlczogW3JlbWVkaWF0aW9uU3RhdGVNYWNoaW5lLnN0YXRlTWFjaGluZUFybl0sXG59KSk7XG5cbmNvbnN0IHByZWRpY3Rpb25Ub1JlbWVkaWF0aW9uUnVsZSA9IG5ldyBldmVudHMuUnVsZShzdGFjaywgJ1ByZWRpY3Rpb25Ub1JlbWVkaWF0aW9uUnVsZScsIHtcblx0ZXZlbnRQYXR0ZXJuOiB7XG5cdFx0c291cmNlOiBbJ2Nhc2NhZGUtcHJldmVudGlvbi5wcmVkaWN0aW9uJ10sXG5cdFx0ZGV0YWlsVHlwZTogWydDYXNjYWRlUGF0aFByZWRpY3RlZCddLFxuXHR9LFxuXHRldmVudEJ1czogZXZlbnRzLkV2ZW50QnVzLmZyb21FdmVudEJ1c05hbWUoc3RhY2ssICdQcmVkaWN0aW9uRXZlbnRCdXMnLCBldmVudEJ1cy5yZWYpLFxufSk7XG5wcmVkaWN0aW9uVG9SZW1lZGlhdGlvblJ1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKHJlbWVkaWF0aW9uUGxhbm5lckZ1bmN0aW9uKSk7XG5cbmNvbnN0IGludGVncmF0aW9uRXZlbnRSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHN0YWNrLCAnSW50ZWdyYXRpb25FdmVudFJ1bGUnLCB7XG5cdGV2ZW50UGF0dGVybjoge1xuXHRcdHNvdXJjZTogW1xuXHRcdFx0J2Nhc2NhZGUtcHJldmVudGlvbi5zaWduYXR1cmUnLFxuXHRcdFx0J2Nhc2NhZGUtcHJldmVudGlvbi5wcmVkaWN0aW9uJyxcblx0XHRcdCdjYXNjYWRlLXByZXZlbnRpb24ucmVtZWRpYXRpb24nLFxuXHRcdF0sXG5cdFx0ZGV0YWlsVHlwZTogW1xuXHRcdFx0J0Nhc2NhZGVTaWduYXR1cmVEZXRlY3RlZCcsXG5cdFx0XHQnQ2FzY2FkZVBhdGhQcmVkaWN0ZWQnLFxuXHRcdFx0J1JlbWVkaWF0aW9uQWN0aW9uUmVjb3JkZWQnLFxuXHRcdF0sXG5cdH0sXG5cdGV2ZW50QnVzOiBldmVudHMuRXZlbnRCdXMuZnJvbUV2ZW50QnVzTmFtZShzdGFjaywgJ0ludGVncmF0aW9uRXZlbnRCdXMnLCBldmVudEJ1cy5yZWYpLFxufSk7XG5pbnRlZ3JhdGlvbkV2ZW50UnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24od2ViaG9va05vdGlmaWVyRnVuY3Rpb24pKTtcblxuY29uc3QgYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaShzdGFjaywgJ0Nhc2NhZGVQcmV2ZW50aW9uQXBpJywge1xuXHRyZXN0QXBpTmFtZTogJ0Nhc2NhZGVQcmV2ZW50aW9uQXBpJyxcblx0ZGVzY3JpcHRpb246ICdNVlAgQVBJIGZvciBjYXNjYWRlIHByZXZlbnRpb24gdGVsZW1ldHJ5IGFuZCBvcGVyYXRvciBpbnRlcmZhY2VzJyxcblx0ZGVwbG95T3B0aW9uczogeyBzdGFnZU5hbWU6ICd2MScgfSxcblx0ZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG5cdFx0YWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG5cdFx0YWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG5cdFx0YWxsb3dIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdBdXRob3JpemF0aW9uJywgJ1gtQXBpLUtleSddLFxuXHR9LFxufSk7XG5cbmNvbnN0IHVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2woc3RhY2ssICdDYXNjYWRlUHJldmVudGlvblVzZXJQb29sJywge1xuXHR1c2VyUG9vbE5hbWU6ICdDYXNjYWRlUHJldmVudGlvblVzZXJzJyxcblx0c2VsZlNpZ25VcEVuYWJsZWQ6IGZhbHNlLFxuXHRzaWduSW5BbGlhc2VzOiB7IGVtYWlsOiB0cnVlIH0sXG5cdHN0YW5kYXJkQXR0cmlidXRlczoge1xuXHRcdGVtYWlsOiB7IHJlcXVpcmVkOiB0cnVlLCBtdXRhYmxlOiBmYWxzZSB9LFxuXHR9LFxuXHRwYXNzd29yZFBvbGljeToge1xuXHRcdG1pbkxlbmd0aDogMTIsXG5cdFx0cmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcblx0XHRyZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxuXHRcdHJlcXVpcmVEaWdpdHM6IHRydWUsXG5cdFx0cmVxdWlyZVN5bWJvbHM6IHRydWUsXG5cdH0sXG5cdG1mYTogY29nbml0by5NZmEuT1BUSU9OQUwsXG5cdGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcblx0cmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxufSk7XG5cbmNvbnN0IHVzZXJQb29sQ2xpZW50ID0gbmV3IGNvZ25pdG8uVXNlclBvb2xDbGllbnQoc3RhY2ssICdDYXNjYWRlUHJldmVudGlvblVzZXJQb29sQ2xpZW50Jywge1xuXHR1c2VyUG9vbCxcblx0Z2VuZXJhdGVTZWNyZXQ6IGZhbHNlLFxuXHRhdXRoRmxvd3M6IHtcblx0XHR1c2VyUGFzc3dvcmQ6IHRydWUsXG5cdFx0dXNlclNycDogdHJ1ZSxcblx0fSxcbn0pO1xuXG5jb25zdCBjb2duaXRvQXV0aG9yaXplciA9IG5ldyBhcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHN0YWNrLCAnQ2FzY2FkZUFwaUF1dGhvcml6ZXInLCB7XG5cdGNvZ25pdG9Vc2VyUG9vbHM6IFt1c2VyUG9vbF0sXG59KTtcblxuY29uc3QgcHJvdGVjdGVkTWV0aG9kT3B0aW9uczogYXBpZ2F0ZXdheS5NZXRob2RPcHRpb25zID0ge1xuXHRhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuXHRhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcblx0YXBpS2V5UmVxdWlyZWQ6IHRydWUsXG59O1xuXG5jb25zdCB0ZWxlbWV0cnkgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgndGVsZW1ldHJ5Jyk7XG5jb25zdCBpbmdlc3QgPSB0ZWxlbWV0cnkuYWRkUmVzb3VyY2UoJ2luZ2VzdCcpO1xuaW5nZXN0LmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRlbGVtZXRyeUluZ2VzdEZ1bmN0aW9uKSwge1xuXHRhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5JQU0sXG59KTtcblxuY29uc3QgZGVwZW5kZW5jeUdyYXBoID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2RlcGVuZGVuY3ktZ3JhcGgnKTtcbmNvbnN0IGRlcGVuZGVuY3lHcmFwaEdldE1ldGhvZCA9IGRlcGVuZGVuY3lHcmFwaC5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaUZ1bmN0aW9uKSwgcHJvdGVjdGVkTWV0aG9kT3B0aW9ucyk7XG5cbmNvbnN0IGNhc2NhZGVTaWduYXR1cmVzID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2Nhc2NhZGUtc2lnbmF0dXJlcycpO1xuY29uc3QgYWN0aXZlU2lnbmF0dXJlcyA9IGNhc2NhZGVTaWduYXR1cmVzLmFkZFJlc291cmNlKCdhY3RpdmUnKTtcbmNvbnN0IGFjdGl2ZVNpZ25hdHVyZXNHZXRNZXRob2QgPSBhY3RpdmVTaWduYXR1cmVzLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXBpRnVuY3Rpb24pLCBwcm90ZWN0ZWRNZXRob2RPcHRpb25zKTtcblxuY29uc3QgcmVtZWRpYXRpb25QbGFucyA9IGFwaS5yb290LmFkZFJlc291cmNlKCdyZW1lZGlhdGlvbi1wbGFucycpO1xuY29uc3QgcmVtZWRpYXRpb25QbGFuc0dldE1ldGhvZCA9IHJlbWVkaWF0aW9uUGxhbnMuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlGdW5jdGlvbiksIHByb3RlY3RlZE1ldGhvZE9wdGlvbnMpO1xuY29uc3QgcGxhbkJ5SWQgPSByZW1lZGlhdGlvblBsYW5zLmFkZFJlc291cmNlKCd7cGxhbklkfScpO1xuY29uc3QgYXBwcm92YWwgPSBwbGFuQnlJZC5hZGRSZXNvdXJjZSgnYXBwcm92YWwnKTtcbmNvbnN0IGFwcHJvdmFsUG9zdE1ldGhvZCA9IGFwcHJvdmFsLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaUZ1bmN0aW9uKSwgcHJvdGVjdGVkTWV0aG9kT3B0aW9ucyk7XG5cbmNvbnN0IGFwaUtleSA9IGFwaS5hZGRBcGlLZXkoJ0Nhc2NhZGVPcGVyYXRvckFwaUtleScsIHtcblx0YXBpS2V5TmFtZTogJ0Nhc2NhZGVPcGVyYXRvckFwaUtleScsXG59KTtcblxuY29uc3QgdXNhZ2VQbGFuID0gYXBpLmFkZFVzYWdlUGxhbignQ2FzY2FkZUFwaVVzYWdlUGxhbicsIHtcblx0bmFtZTogJ0Nhc2NhZGVBcGlVc2FnZVBsYW4nLFxuXHR0aHJvdHRsZToge1xuXHRcdGJ1cnN0TGltaXQ6IDIwMCxcblx0XHRyYXRlTGltaXQ6IDEwMDAgLyA2MCxcblx0fSxcbn0pO1xuXG51c2FnZVBsYW4uYWRkQXBpS2V5KGFwaUtleSk7XG51c2FnZVBsYW4uYWRkQXBpU3RhZ2Uoe1xuXHRhcGksXG5cdHN0YWdlOiBhcGkuZGVwbG95bWVudFN0YWdlLFxuXHR0aHJvdHRsZTogW1xuXHRcdHtcblx0XHRcdG1ldGhvZDogZGVwZW5kZW5jeUdyYXBoR2V0TWV0aG9kLFxuXHRcdFx0dGhyb3R0bGU6IHtcblx0XHRcdFx0YnVyc3RMaW1pdDogMjAwLFxuXHRcdFx0XHRyYXRlTGltaXQ6IDEwMDAgLyA2MCxcblx0XHRcdH0sXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRtZXRob2Q6IGFjdGl2ZVNpZ25hdHVyZXNHZXRNZXRob2QsXG5cdFx0XHR0aHJvdHRsZToge1xuXHRcdFx0XHRidXJzdExpbWl0OiAyMDAsXG5cdFx0XHRcdHJhdGVMaW1pdDogMTAwMCAvIDYwLFxuXHRcdFx0fSxcblx0XHR9LFxuXHRcdHtcblx0XHRcdG1ldGhvZDogcmVtZWRpYXRpb25QbGFuc0dldE1ldGhvZCxcblx0XHRcdHRocm90dGxlOiB7XG5cdFx0XHRcdGJ1cnN0TGltaXQ6IDIwMCxcblx0XHRcdFx0cmF0ZUxpbWl0OiAxMDAwIC8gNjAsXG5cdFx0XHR9LFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0bWV0aG9kOiBhcHByb3ZhbFBvc3RNZXRob2QsXG5cdFx0XHR0aHJvdHRsZToge1xuXHRcdFx0XHRidXJzdExpbWl0OiAyMDAsXG5cdFx0XHRcdHJhdGVMaW1pdDogMTAwMCAvIDYwLFxuXHRcdFx0fSxcblx0XHR9LFxuXHRdLFxufSk7XG5cbm5ldyBjZGsuQ2ZuT3V0cHV0KHN0YWNrLCAnQ2FzY2FkZVByZXZlbnRpb25Vc2VyUG9vbElkJywge1xuXHR2YWx1ZTogdXNlclBvb2wudXNlclBvb2xJZCxcbn0pO1xuXG5uZXcgY2RrLkNmbk91dHB1dChzdGFjaywgJ0Nhc2NhZGVQcmV2ZW50aW9uVXNlclBvb2xDbGllbnRJZCcsIHtcblx0dmFsdWU6IHVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG59KTtcblxubmV3IGNkay5DZm5PdXRwdXQoc3RhY2ssICdDYXNjYWRlT3BlcmF0b3JBcGlLZXlJZCcsIHtcblx0dmFsdWU6IGFwaUtleS5rZXlJZCxcbn0pO1xuXG5uZXcgY2RrLkNmbk91dHB1dChzdGFjaywgJ0Nhc2NhZGVQcmV2ZW50aW9uQXBpVXJsJywge1xuXHR2YWx1ZTogYXBpLnVybCxcbn0pO1xuIl19