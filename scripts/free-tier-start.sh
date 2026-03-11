#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-cascade-free-tier}"
REGION="${2:-us-east-1}"
MONTHLY_BUDGET_USD="${3:-10}"
ALERT_EMAIL="${4:-}"

if [[ -z "$ALERT_EMAIL" ]]; then
  echo "Usage: $0 <profile> <region> <monthly-budget-usd> <alert-email>"
  echo "Example: $0 cascade-free-tier us-east-1 10 you@example.com"
  exit 1
fi

echo "[free-tier-start] profile=$PROFILE region=$REGION budget=$MONTHLY_BUDGET_USD email=$ALERT_EMAIL"

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI v2 is required."
  exit 1
fi

if ! command -v cdk >/dev/null 2>&1; then
  echo "AWS CDK CLI is required. Run: npm install -g aws-cdk"
  exit 1
fi

echo "[free-tier-start] Verifying AWS credentials"
if ! AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" aws sts get-caller-identity >/dev/null 2>&1; then
  echo "Profile not authenticated. Configure and login first:"
  echo "  npm run aws:configure -- $PROFILE $REGION sso"
  exit 1
fi

echo "[free-tier-start] Bootstrapping CDK"
bash ./scripts/free-tier-bootstrap.sh "$PROFILE" "$REGION"

echo "[free-tier-start] Applying cost guardrails"
bash ./scripts/free-tier-cost-guardrails.sh "$PROFILE" "$REGION" "$MONTHLY_BUDGET_USD" "$ALERT_EMAIL"

echo "[free-tier-start] Deploying stack"
bash ./scripts/free-tier-deploy.sh "$PROFILE" "$REGION"

echo "[free-tier-start] Completed successfully"
