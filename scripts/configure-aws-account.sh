#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-cascade-free-tier}"
REGION="${2:-us-east-1}"
MODE="${3:-sso}"

echo "[configure-aws-account] profile=$PROFILE region=$REGION mode=$MODE"

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI v2 is required. Install AWS CLI and retry."
  exit 1
fi

aws configure set region "$REGION" --profile "$PROFILE"
aws configure set output json --profile "$PROFILE"

if [[ "$MODE" == "sso" ]]; then
  echo "Starting SSO setup wizard..."
  aws configure sso --profile "$PROFILE"
  aws sso login --profile "$PROFILE"
else
  echo "Starting access-key setup wizard..."
  aws configure --profile "$PROFILE"
fi

echo "Verifying caller identity..."
AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" aws sts get-caller-identity

echo "AWS profile configured successfully."
echo "Use it in this shell with: export AWS_PROFILE=$PROFILE && export AWS_REGION=$REGION"
