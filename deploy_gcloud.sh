#!/usr/bin/env bash
# =========================================================================
# EnverAI Artificer: Google Cloud Run Automated Deployment Script
# =========================================================================

set -e

SERVICE_NAME="${SERVICE_NAME:-enverai-artificer}"
REGION="${REGION:-us-central1}"
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null || echo '')}"

echo "========================================================================="
echo "  ENVERAI ARTIFICER CITADEL - GOOGLE CLOUD RUN DEPLOYMENT"
echo "========================================================================="
echo "Service Name: ${SERVICE_NAME}"
echo "Region:       ${REGION}"
echo "Project ID:   ${PROJECT_ID:-[Current Default]}"
echo "========================================================================="

# 1. Verify gcloud CLI is authenticated
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: Google Cloud SDK (gcloud) is not installed."
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo "🚀 Building and deploying single-container citadel to Cloud Run..."

gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --platform managed \
  --region "${REGION}" \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production

echo "========================================================================="
echo "✅ DEPLOYMENT COMPLETE! EnverAI Artificer Citadel is live on Google Cloud."
echo "========================================================================="
