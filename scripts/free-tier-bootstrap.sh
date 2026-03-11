#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-cascade-free-tier}"
REGION="${2:-us-east-1}"

echo "[free-tier-bootstrap] profile=$PROFILE region=$REGION"

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI is required. Install AWS CLI v2 first."
  exit 1
fi

if ! command -v cdk >/dev/null 2>&1; then
  echo "AWS CDK CLI is required. Run: npm install -g aws-cdk"
  exit 1
fi

aws configure set region "$REGION" --profile "$PROFILE"
aws configure set output json --profile "$PROFILE"

echo "If this is your first login for this profile, run:"
echo "  aws configure sso --profile $PROFILE"
echo "  aws sso login --profile $PROFILE"

AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" cdk bootstrap

echo "Bootstrap complete for profile=$PROFILE region=$REGION"
