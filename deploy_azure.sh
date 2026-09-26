#!/usr/bin/env bash
# =========================================================================
# EnverAI Artificer: Microsoft Azure Automated Deployment Script
# Deploys Single-Container Citadel to Azure Container Apps
# Target Domain: https://artificer.enveraitech.in/
# =========================================================================

set -e

APP_NAME="${APP_NAME:-artificer-enverai}"
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-artificer}"
LOCATION="${LOCATION:-centralindia}"
CUSTOM_DOMAIN="artificer.enveraitech.in"

echo "========================================================================="
echo "  ENVERAI ARTIFICER CITADEL - MICROSOFT AZURE DEPLOYMENT"
echo "========================================================================="
echo "Application Name: ${APP_NAME}"
echo "Resource Group:   ${RESOURCE_GROUP}"
echo "Region:           ${LOCATION}"
echo "Target Domain:    https://${CUSTOM_DOMAIN}/"
echo "========================================================================="

# 1. Verify az CLI
if ! command -v az &> /dev/null; then
    echo "❌ Error: Azure CLI (az) is not installed."
    exit 1
fi

# 2. Verify az login
az account show > /dev/null 2>&1 || {
    echo "Initiating az login..."
    az login
}

# 3. Create Resource Group
echo "🚀 Creating Resource Group ${RESOURCE_GROUP}..."
az group create --name "${RESOURCE_GROUP}" --location "${LOCATION}"

# 4. Deploy to Azure Container Apps
echo "📦 Building and deploying Single-Container Citadel..."
az containerapp up \
  --name "${APP_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --location "${LOCATION}" \
  --ingress external \
  --target-port 8080 \
  --source . \
  --env-vars NODE_ENV=production PORT=8080

echo "========================================================================="
echo "✅ Deployment completed on Azure!"
echo "========================================================================="
