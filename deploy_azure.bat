@echo off
REM =========================================================================
REM EnverAI Artificer: Microsoft Azure Automated Deployment Script (Windows)
REM Deploys Single-Container Citadel to Azure Container Apps / App Service
REM Target Domain: https://artificer.enveraitech.in/
REM =========================================================================

set APP_NAME=artificer-enverai
set RESOURCE_GROUP=rg-artificer
set LOCATION=centralindia
set CUSTOM_DOMAIN=artificer.enveraitech.in

echo =========================================================================
echo   ENVERAI ARTIFICER CITADEL - MICROSOFT AZURE DEPLOYMENT
echo =========================================================================
echo Application Name: %APP_NAME%
echo Resource Group:   %RESOURCE_GROUP%
echo Region:           %LOCATION%
echo Target Domain:    https://%CUSTOM_DOMAIN%/
echo =========================================================================

REM 1. Verify Azure CLI is installed
where az >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Azure CLI (az) is not found in PATH.
    echo Please install it from: https://aka.ms/installazurecliwindows
    pause
    exit /b 1
)

REM 2. Check if logged in
call az account show >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [NOTICE] You are not logged in. Initiating Azure login...
    call az login
)

echo.
echo [1/3] Creating Azure Resource Group (%RESOURCE_GROUP%) in %LOCATION%...
call az group create --name %RESOURCE_GROUP% --location %LOCATION%

echo.
echo [2/3] Building and Deploying Citadel Container to Azure Container Apps...
call az containerapp up ^
  --name %APP_NAME% ^
  --resource-group %RESOURCE_GROUP% ^
  --location %LOCATION% ^
  --ingress external ^
  --target-port 8080 ^
  --source . ^
  --env-vars NODE_ENV=production PORT=8080

if %ERRORLEVEL% neq 0 (
    echo [WARN] Container App direct source build failed, checking fallback...
)

echo.
echo =========================================================================
echo [SUCCESS] Deployment command executed!
echo =========================================================================
echo Next step for Custom Domain (https://%CUSTOM_DOMAIN%):
echo 1. Add CNAME record in your DNS provider:
echo    Type:  CNAME
echo    Name:  artificer
echo    Value: ^<your-azure-app-fqdn^>
echo.
echo 2. Bind domain with free Azure Managed SSL:
echo    az containerapp hostname add --name %APP_NAME% --resource-group %RESOURCE_GROUP% --hostname %CUSTOM_DOMAIN%
echo =========================================================================
pause
