import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { CfnInclude } from 'aws-cdk-lib/cloudformation-include';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as sfnTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import { PlaybookMappings } from '../lib/playbook-mappings-construct';

const app = new cdk.App({ analyticsReporting: false });
const cdkAccount = process.env.CDK_DEFAULT_ACCOUNT;
const cdkRegion = process.env.CDK_DEFAULT_REGION;
const stack = new cdk.Stack(app, 'CascadePreventionStack', cdkAccount && cdkRegion
	? { env: { account: cdkAccount, region: cdkRegion } }
	: undefined);

function parseCsvContext(value: string | undefined): string[] {
	if (!value) return [];
	return value
		.split(',')
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

const configuredWebhookUrl = app.node.tryGetContext('webhookUrl') as string | undefined;
const configuredSlackWebhookUrl = app.node.tryGetContext('slackWebhookUrl') as string | undefined;
const configuredTeamsWebhookUrl = app.node.tryGetContext('teamsWebhookUrl') as string | undefined;
const configuredStatuspageWebhookUrl = app.node.tryGetContext('statuspageWebhookUrl') as string | undefined;
const configuredExecutiveEmails = parseCsvContext(app.node.tryGetContext('executiveEmails') as string | undefined);
const configuredStakeholderEmails = parseCsvContext(app.node.tryGetContext('stakeholderEmails') as string | undefined);
const configuredStakeholderSms = parseCsvContext(app.node.tryGetContext('stakeholderSms') as string | undefined);
const webhookUrl = configuredWebhookUrl ?? '';
const slackWebhookUrl = configuredSlackWebhookUrl ?? '';
const teamsWebhookUrl = configuredTeamsWebhookUrl ?? '';
const statuspageWebhookUrl = configuredStatuspageWebhookUrl ?? '';
const webhookEnabled = (configuredWebhookUrl || configuredSlackWebhookUrl || configuredTeamsWebhookUrl || configuredStatuspageWebhookUrl) ? 'true' : 'false';
const contextUiDomainName = app.node.tryGetContext('uiDomainName') as string | undefined;
const contextUiHostedZoneDomain = app.node.tryGetContext('uiHostedZoneDomain') as string | undefined;
const contextArticleDomainName = app.node.tryGetContext('articleDomainName') as string | undefined;
const contextArticleHostedZoneDomain = app.node.tryGetContext('articleHostedZoneDomain') as string | undefined;
const canUseCustomDomains = Boolean(cdkAccount && cdkRegion);

if (!canUseCustomDomains && (contextUiDomainName || contextArticleDomainName)) {
	console.warn('Custom domain context detected, but CDK_DEFAULT_ACCOUNT/CDK_DEFAULT_REGION are not set. Falling back to CloudFront domains for synth.');
}

const uiDomainName = canUseCustomDomains ? contextUiDomainName : undefined;
const uiHostedZoneDomain = canUseCustomDomains ? contextUiHostedZoneDomain : undefined;
const articleDomainName = canUseCustomDomains ? contextArticleDomainName : undefined;
const articleHostedZoneDomain = canUseCustomDomains ? contextArticleHostedZoneDomain : undefined;

type StaticSiteConfig = {
	id: string;
	assetPath: string;
	domainName?: string;
	hostedZoneDomain?: string;
	spa: boolean;
	description: string;
};

function resolveRecordName(domainName: string, zoneName: string): string | undefined {
	if (domainName === zoneName) {
		return undefined;
	}

	const suffix = `.${zoneName}`;
	if (domainName.endsWith(suffix)) {
		return domainName.slice(0, -suffix.length);
	}

	return domainName;
}

function createStaticSite(config: StaticSiteConfig) {
	const websiteBucket = new s3.Bucket(stack, `${config.id}Bucket`, {
		encryption: s3.BucketEncryption.S3_MANAGED,
		blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
		enforceSSL: true,
		autoDeleteObjects: false,
		removalPolicy: cdk.RemovalPolicy.RETAIN,
	});

	let hostedZone: route53.IHostedZone | undefined;
	let certificate: acm.ICertificate | undefined;

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

const included = new CfnInclude(stack, 'CascadePreventionTemplate', {
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

const playbookMappings = new PlaybookMappings(stack, 'PlaybookMappings', {
	tableName: 'CascadePrevention-PlaybookMappings',
	eventBusName: 'CascadePrevention-PlaybookEventBus',
});

const telemetryBucket = included.getResource('TelemetryBucket710FF2C8') as s3.CfnBucket;
const telemetryCacheTable = included.getResource('TelemetryCacheD29A0395') as dynamodb.CfnTable;
const dependencyGraphTable = included.getResource('DependencyGraph3324833E') as dynamodb.CfnTable;
const signaturesTable = included.getResource('SignaturesTable79733A9C') as dynamodb.CfnTable;
const eventBus = included.getResource('EventBus7B8748AA') as events.CfnEventBus;

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

const telemetryIngestFunction = new NodejsFunction(stack, 'TelemetryIngestFunction', {
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

const signatureMatcherV2Function = new NodejsFunction(stack, 'SignatureMatcherV2Function', {
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

const apiFunction = new NodejsFunction(stack, 'CascadeApiFunction', {
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

const webhookNotifierFunction = new NodejsFunction(stack, 'WebhookNotifierFunction', {
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

const remediationActionExecutorFunction = new NodejsFunction(stack, 'RemediationActionExecutorFunction', {
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

const remediationPlannerFunction = new NodejsFunction(stack, 'RemediationPlannerFunction', {
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

const protectedMethodOptions: apigateway.MethodOptions = {
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
