#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-cascade-free-tier}"
REGION="${2:-us-east-1}"

echo "[free-tier-destroy] profile=$PROFILE region=$REGION"

AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" cdk destroy --force

echo "Stack destroyed in region=$REGION"
