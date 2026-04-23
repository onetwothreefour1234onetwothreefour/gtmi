@echo off
setlocal

set PROJECT_ID=gtmi-494008
set REGION=europe-west1
set SERVICE=gtmi-scraper
set REPO=gtmi

echo [1/6] Getting project number...
for /f "tokens=*" %%i in ('call gcloud projects describe %PROJECT_ID% --format="value(projectNumber)"') do set PROJECT_NUMBER=%%i
echo Project number: %PROJECT_NUMBER%

echo [2/6] Enabling required APIs...
call gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com compute.googleapis.com iam.googleapis.com --project=%PROJECT_ID%

echo [3/6] Granting service account permissions...
call gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:%PROJECT_NUMBER%@cloudbuild.gserviceaccount.com" --role="roles/run.admin" --quiet
call gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:%PROJECT_NUMBER%@cloudbuild.gserviceaccount.com" --role="roles/iam.serviceAccountUser" --quiet
call gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:%PROJECT_NUMBER%@cloudbuild.gserviceaccount.com" --role="roles/artifactregistry.writer" --quiet
call gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:%PROJECT_NUMBER%-compute@developer.gserviceaccount.com" --role="roles/artifactregistry.reader" --quiet
call gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:%PROJECT_NUMBER%-compute@developer.gserviceaccount.com" --role="roles/run.admin" --quiet
call gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:%PROJECT_NUMBER%-compute@developer.gserviceaccount.com" --role="roles/iam.serviceAccountUser" --quiet
call gcloud iam service-accounts add-iam-policy-binding %PROJECT_NUMBER%-compute@developer.gserviceaccount.com --member="serviceAccount:%PROJECT_NUMBER%@cloudbuild.gserviceaccount.com" --role="roles/iam.serviceAccountUser" --project=%PROJECT_ID% --quiet

echo [4/6] Creating Artifact Registry repository (skips if already exists)...
call gcloud artifacts repositories describe %REPO% --location=%REGION% --project=%PROJECT_ID% >nul 2>&1
if errorlevel 1 (
    call gcloud artifacts repositories create %REPO% --repository-format=docker --location=%REGION% --project=%PROJECT_ID%
) else (
    echo Repository already exists, skipping.
)

echo [5/6] Building and deploying scraper to Cloud Run...
call gcloud builds submit --config "%~dp0cloudbuild.yaml" "%~dp0." --project=%PROJECT_ID%

echo [6/6] Fetching deployed service URL...
for /f "tokens=*" %%i in ('call gcloud run services describe %SERVICE% --region=%REGION% --project=%PROJECT_ID% --format="value(status.url)"') do set SERVICE_URL=%%i

echo.
echo =========================================
echo  Deployment complete.
echo  SCRAPER_URL=%SERVICE_URL%
echo =========================================
echo.
echo Add this to your .env and Trigger.dev environment variables:
echo SCRAPER_URL=%SERVICE_URL%

endlocal
