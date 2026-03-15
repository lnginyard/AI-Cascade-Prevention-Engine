#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-cascade-free-tier}"
REGION="${2:-us-east-1}"
UI_DOMAIN_NAME="${UI_DOMAIN_NAME:-aicpe.dev}"
HOSTED_ZONE_DOMAIN="${HOSTED_ZONE_DOMAIN:-aicpe.dev}"
ARTICLE_DOMAIN_NAME="${ARTICLE_DOMAIN_NAME:-article.aicpe.dev}"
ALLOW_CLOUDFRONT_FALLBACK="${ALLOW_CLOUDFRONT_FALLBACK:-false}"

echo "[free-tier-deploy] profile=$PROFILE region=$REGION uiDomain=$UI_DOMAIN_NAME articleDomain=$ARTICLE_DOMAIN_NAME hostedZone=$HOSTED_ZONE_DOMAIN"

AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" npm run build

CDK_ACCOUNT_ID=$(AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_ACCOUNT="$CDK_ACCOUNT_ID"
export CDK_DEFAULT_REGION="$REGION"

HOSTED_ZONE_COUNT=$(AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" aws route53 list-hosted-zones-by-name \
  --dns-name "$HOSTED_ZONE_DOMAIN" \
  --query "length(HostedZones[?Name=='${HOSTED_ZONE_DOMAIN}.'])" \
  --output text)

if [[ "$HOSTED_ZONE_COUNT" == "0" ]]; then
  echo ""
  echo "[free-tier-deploy] Route53 hosted zone not found: $HOSTED_ZONE_DOMAIN"
  echo "To deploy custom domains, create/import this hosted zone in this AWS account first."
  echo ""
  if [[ "$ALLOW_CLOUDFRONT_FALLBACK" != "true" ]]; then
    echo "Set ALLOW_CLOUDFRONT_FALLBACK=true to deploy without custom domains (CloudFront URLs only)."
    exit 2
  fi

  echo "[free-tier-deploy] ALLOW_CLOUDFRONT_FALLBACK=true, deploying without custom domains..."
  AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" npx cdk deploy \
    --require-approval never \
    --context environment=development \
    --context multiRegion=false \
    --context telemetryRetentionDays=30 \
    --context snapshotRetentionDays=14 \
    --context uiDomainName= \
    --context uiHostedZoneDomain= \
    --context articleDomainName= \
    --context articleHostedZoneDomain=

  echo "Deployment complete (CloudFront URLs). Next: configure DNS + hosted zone, then redeploy for aicpe.dev."
  exit 0
fi

AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" npx cdk deploy \
  --require-approval never \
  --context environment=development \
  --context multiRegion=false \
  --context telemetryRetentionDays=30 \
  --context snapshotRetentionDays=14 \
  --context uiDomainName="$UI_DOMAIN_NAME" \
  --context uiHostedZoneDomain="$HOSTED_ZONE_DOMAIN" \
  --context articleDomainName="$ARTICLE_DOMAIN_NAME" \
  --context articleHostedZoneDomain="$HOSTED_ZONE_DOMAIN"

echo "Deployment complete. Next: configure UI live mode with API URL, API key, and Cognito token."
