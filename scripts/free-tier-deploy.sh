#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-cascade-free-tier}"
REGION="${2:-us-east-1}"

echo "[free-tier-deploy] profile=$PROFILE region=$REGION"

AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" npm run build

AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" cdk deploy \
  --require-approval never \
  --context environment=development \
  --context multiRegion=false \
  --context telemetryRetentionDays=30 \
  --context snapshotRetentionDays=14

echo "Deployment complete. Next: configure UI live mode with API URL, API key, and Cognito token."
