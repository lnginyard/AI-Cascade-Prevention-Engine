# Deployment Guide

This guide covers deploying the Cascade Prevention Engine infrastructure using AWS CDK.

## Prerequisites

1. **AWS Account**: Active AWS account with appropriate permissions
2. **AWS CLI**: Installed and configured with credentials
   ```bash
   aws configure
   ```
3. **Node.js**: Version 18 or higher
4. **AWS CDK**: Install globally
   ```bash
   npm install -g aws-cdk
   ```

## Initial Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Bootstrap CDK (First Time Only)

Bootstrap creates the necessary S3 bucket and IAM roles for CDK deployments:

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

Replace `ACCOUNT-ID` and `REGION` with your values, or use:

```bash
cdk bootstrap
```

This will use the default account and region from your AWS CLI configuration.

## Single-Region Deployment

Deploy to a single AWS region:

```bash
npm run deploy
```

Or using CDK directly:

```bash
cdk deploy
```

### Configuration Options

You can customize the deployment using CDK context parameters:

```bash
cdk deploy \
  --context telemetryRetentionDays=365 \
  --context snapshotRetentionDays=90 \
  --context environment=production
```

Or add them to `cdk.json`:

```json
{
  "context": {
    "telemetryRetentionDays": 365,
    "snapshotRetentionDays": 90,
    "environment": "production"
  }
}
```

## Multi-Region Deployment

For multi-region deployments:

### 1. Deploy to Primary Region

```bash
export AWS_REGION=us-east-1
cdk deploy --context multiRegion=true
```

### 2. Deploy to Secondary Region(s)

```bash
export AWS_REGION=us-west-2
cdk deploy --context multiRegion=true
```

### 3. Configure Cross-Region Replication

After deploying to multiple regions, configure S3 cross-region replication:

1. Create replication role in IAM
2. Configure replication rules on source buckets
3. Set up DynamoDB Global Tables for cross-region synchronization

## Verification

After deployment, verify the infrastructure:

### 1. Check CloudFormation Stack

```bash
aws cloudformation describe-stacks \
  --stack-name CascadePreventionStack \
  --query 'Stacks[0].StackStatus'
```

Expected output: `CREATE_COMPLETE` or `UPDATE_COMPLETE`

### 2. List Created Resources

```bash
aws cloudformation describe-stack-resources \
  --stack-name CascadePreventionStack
```

### 3. Verify DynamoDB Tables

```bash
aws dynamodb list-tables | grep CascadePrevention
```

Expected tables:
- `CascadePrevention-DependencyGraph`
- `CascadePrevention-TelemetryCache`
- `CascadePrevention-CircuitBreakerState`

### 4. Verify S3 Buckets

```bash
aws s3 ls | grep cascade-prevention
```

Expected buckets:
- `cascade-prevention-telemetry-{account}-{region}`
- `cascade-prevention-snapshots-{account}-{region}`

### 5. Verify EventBridge Event Bus

```bash
aws events describe-event-bus --name CascadePrevention
```

## IAM Permissions

The deployment creates the following IAM resources:

### Service Roles
- Lambda execution roles for telemetry processing
- Step Functions execution roles for remediation orchestration
- EventBridge invocation roles

### Policies
- DynamoDB read/write access
- S3 read/write access
- KMS encrypt/decrypt permissions
- EventBridge put events permissions
- CloudWatch Logs write permissions

All roles follow the principle of least privilege.

## Cost Estimation

Estimated monthly costs for a typical deployment:

| Service | Usage | Estimated Cost |
|---------|-------|----------------|
| DynamoDB | Pay-per-request, ~1M requests/day | $25-50 |
| S3 | 100GB telemetry + snapshots | $2-5 |
| EventBridge | 10M events/month | $10 |
| KMS | 1 key, 100K requests/month | $1 |
| **Total** | | **$38-66/month** |

Actual costs depend on:
- Number of services monitored
- Telemetry volume
- Cascade detection frequency
- Remediation action frequency

## Updating the Stack

To update an existing deployment:

```bash
# Review changes
cdk diff

# Apply updates
cdk deploy
```

## Rollback

If deployment fails or you need to rollback:

```bash
# Rollback to previous version
aws cloudformation rollback-stack --stack-name CascadePreventionStack

# Or delete and redeploy
cdk destroy
cdk deploy
```

## Cleanup

To remove all infrastructure:

```bash
cdk destroy
```

**Warning**: This will delete all data in DynamoDB tables and S3 buckets. Ensure you have backups if needed.

## Troubleshooting

### Bootstrap Issues

If bootstrap fails:
```bash
cdk bootstrap --verbose
```

### Deployment Failures

Check CloudFormation events:
```bash
aws cloudformation describe-stack-events \
  --stack-name CascadePreventionStack \
  --max-items 20
```

### Permission Errors

Ensure your AWS credentials have:
- `cloudformation:*`
- `dynamodb:*`
- `s3:*`
- `events:*`
- `kms:*`
- `iam:CreateRole`, `iam:AttachRolePolicy`

### Resource Limits

If you hit AWS service limits:
- Request limit increases via AWS Support
- Check Service Quotas in AWS Console

## Next Steps

After successful deployment:

1. Configure telemetry collection (CloudWatch, X-Ray, CloudTrail)
2. Deploy Lambda functions for processing
3. Set up anomaly detection baselines
4. Configure remediation policies
5. Test with simulation mode

See the main README.md for development and operational guidance.

## Restricting Bedrock Permissions (Optional, recommended)

By default the stack will allow Bedrock invocation with a wildcard if no specific model ARNs are provided. For least-privilege production deployments, restrict Bedrock invocation to a specific set of model ARNs.

You can supply allowed Bedrock model ARNs either via CDK context or an environment variable.

Examples using CDK context (comma-separated list):

```bash
cdk deploy --context allowedBedrockModelArns="arn:aws:bedrock:us-east-1:123456789012:model/model-abc,arn:aws:bedrock:us-east-1:123456789012:model/model-def"
```

Or set an environment variable before running CDK:

```bash
export ALLOWED_BEDROCK_MODEL_ARNS="arn:aws:bedrock:us-east-1:123456789012:model/model-abc,arn:aws:bedrock:us-east-1:123456789012:model/model-def"
cdk deploy
```

After deployment, the stack outputs the `CascadePrevention-AllowedBedrockModels` value showing which ARNs are allowed (or `ALL` if no restriction was applied).
