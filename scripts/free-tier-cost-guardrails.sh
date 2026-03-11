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

echo "[free-tier-guardrails] profile=$PROFILE region=$REGION monthlyBudget=$MONTHLY_BUDGET_USD email=$ALERT_EMAIL"

ACCOUNT_ID=$(AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" aws sts get-caller-identity --query Account --output text)

TOPIC_ARN=$(AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" aws sns create-topic \
  --name cascade-free-tier-billing-alerts \
  --query TopicArn \
  --output text)

AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" aws sns subscribe \
  --topic-arn "$TOPIC_ARN" \
  --protocol email \
  --notification-endpoint "$ALERT_EMAIL" >/dev/null

AWS_PROFILE="$PROFILE" AWS_REGION="us-east-1" aws cloudwatch put-metric-alarm \
  --alarm-name "cascade-free-tier-estimated-charges" \
  --alarm-description "Alert when estimated charges exceed ${MONTHLY_BUDGET_USD} USD" \
  --namespace AWS/Billing \
  --metric-name EstimatedCharges \
  --dimensions Name=Currency,Value=USD \
  --statistic Maximum \
  --period 21600 \
  --evaluation-periods 1 \
  --threshold "$MONTHLY_BUDGET_USD" \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$TOPIC_ARN"

AWS_PROFILE="$PROFILE" AWS_REGION="us-east-1" aws budgets create-budget \
  --account-id "$ACCOUNT_ID" \
  --budget "{\"BudgetName\":\"CascadeFreeTierMonthly\",\"BudgetLimit\":{\"Amount\":\"$MONTHLY_BUDGET_USD\",\"Unit\":\"USD\"},\"TimeUnit\":\"MONTHLY\",\"BudgetType\":\"COST\"}" \
  --notifications-with-subscribers "[{\"Notification\":{\"NotificationType\":\"ACTUAL\",\"ComparisonOperator\":\"GREATER_THAN\",\"Threshold\":80,\"ThresholdType\":\"PERCENTAGE\"},\"Subscribers\":[{\"SubscriptionType\":\"EMAIL\",\"Address\":\"$ALERT_EMAIL\"}]},{\"Notification\":{\"NotificationType\":\"ACTUAL\",\"ComparisonOperator\":\"GREATER_THAN\",\"Threshold\":100,\"ThresholdType\":\"PERCENTAGE\"},\"Subscribers\":[{\"SubscriptionType\":\"EMAIL\",\"Address\":\"$ALERT_EMAIL\"}]}]" >/dev/null || true

echo "Guardrails configured. Confirm subscription email and billing alarm in CloudWatch (us-east-1)."
