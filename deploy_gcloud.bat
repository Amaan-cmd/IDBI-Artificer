@echo off
REM =========================================================================
REM EnverAI Artificer: Google Cloud Run Automated Deployment Script (Windows)
REM =========================================================================

set SERVICE_NAME=enverai-artificer
set REGION=us-central1

echo =========================================================================
echo   ENVERAI ARTIFICER CITADEL - GOOGLE CLOUD RUN DEPLOYMENT
echo =========================================================================
echo Service Name: %SERVICE_NAME%
echo Region:       %REGION%
echo =========================================================================

where gcloud >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Google Cloud SDK (gcloud) is not found in PATH.
    echo Please install it from: https://cloud.google.com/sdk/docs/install
    pause
    exit /b 1
)

echo Building and deploying single-container citadel to Google Cloud Run...

call gcloud run deploy %SERVICE_NAME% ^
  --source . ^
  --platform managed ^
  --region %REGION% ^
  --port 8080 ^
  --memory 1Gi ^
  --cpu 1 ^
  --min-instances 0 ^
  --max-instances 10 ^
  --allow-unauthenticated ^
  --set-env-vars NODE_ENV=production

echo =========================================================================
echo [SUCCESS] EnverAI Artificer Citadel is live on Google Cloud!
echo =========================================================================
pause
