#!/usr/bin/env bash
set -euo pipefail
export AWS_PAGER=""

PROFILE="${1:-cascade-free-tier}"
REGION="${2:-us-east-1}"
API_KEY="${3:-}"
BEARER_TOKEN="${4:-}"
STACK_NAME="${5:-CascadePreventionStack}"

echo "[free-tier-status] profile=$PROFILE region=$REGION stack=$STACK_NAME"

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI v2 is required."
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required."
  exit 1
fi

echo
echo "== Caller Identity =="
AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" aws sts get-caller-identity

echo
echo "== Stack Status =="
if STACK_STATUS=$(AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].StackStatus' \
  --output text 2>/dev/null); then
  echo "$STACK_NAME: $STACK_STATUS"
else
  echo "$STACK_NAME not found in $REGION"
  exit 0
fi

echo
echo "== CloudFormation Outputs =="
AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs' \
  --output table || true

OPERATIONS_URL=$(AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='OperationsConsoleUrl'].OutputValue | [0]" \
  --output text)

ARTICLE_URL=$(AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='ArticleSiteUrl'].OutputValue | [0]" \
  --output text)

echo
echo "== Site URLs =="
echo "Operations Console: $OPERATIONS_URL"
echo "Article Site: $ARTICLE_URL"

if [[ "$OPERATIONS_URL" == *"cloudfront.net"* || "$ARTICLE_URL" == *"cloudfront.net"* ]]; then
  echo ""
  echo "Custom domain note: stack is currently using CloudFront URLs."
  echo "To use aicpe.dev/article.aicpe.dev, create Route53 hosted zone aicpe.dev in this AWS account and redeploy."
fi

echo
echo "== API Discovery =="
API_ID=$(AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" aws apigateway get-rest-apis \
  --query "items[?name=='CascadePreventionApi'].id | [0]" \
  --output text)

if [[ -z "$API_ID" || "$API_ID" == "None" ]]; then
  echo "CascadePreventionApi not found in API Gateway for region $REGION"
  exit 0
fi

BASE_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com/v1"
echo "API ID: $API_ID"
echo "Base URL: $BASE_URL"
echo "Dependency Graph: $BASE_URL/dependency-graph"
echo "Active Signatures: $BASE_URL/cascade-signatures/active"
echo "Remediation Plans: $BASE_URL/remediation-plans"

if [[ -z "$API_KEY" || -z "$BEARER_TOKEN" ]]; then
  echo
  echo "== Live Route Checks =="
  echo "Skipped (provide both API key and bearer token to execute protected route checks)."
  echo "Usage: npm run free-tier:status -- $PROFILE $REGION <api-key> <bearer-token>"
  exit 0
fi

echo
echo "== Live Route Checks =="
AUTH_HEADER="Authorization: Bearer $BEARER_TOKEN"
API_KEY_HEADER="x-api-key: $API_KEY"

check_route() {
  local url="$1"
  local label="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_HEADER" -H "$API_KEY_HEADER" "$url")
  echo "$label -> HTTP $code"
}

check_route "$BASE_URL/dependency-graph" "GET /dependency-graph"
check_route "$BASE_URL/cascade-signatures/active" "GET /cascade-signatures/active"
check_route "$BASE_URL/remediation-plans" "GET /remediation-plans"
