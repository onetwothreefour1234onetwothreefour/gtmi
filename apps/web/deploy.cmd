@echo off
setlocal

set PROJECT_ID=gtmi-494008
set REGION=europe-west1
set SERVICE=gtmi-web
set REPO=gtmi

echo [1/4] Verifying secrets exist in Secret Manager...
for %%S in (gtmi-web-database-url gtmi-web-supabase-url gtmi-web-supabase-service-role-key gtmi-web-public-supabase-url gtmi-web-public-supabase-anon-key gtmi-web-public-app-url) do (
    call gcloud secrets describe %%S --project=%PROJECT_ID% >nul 2>&1
    if errorlevel 1 (
        echo ERROR: secret %%S does not exist. Run scripts\create-gtmi-web-secrets.cmd first.
        exit /b 1
    )
)

echo [2/4] Granting Cloud Run runtime SA access to runtime secrets (idempotent)...
for /f "tokens=*" %%i in ('call gcloud projects describe %PROJECT_ID% --format="value(projectNumber)"') do set PROJECT_NUMBER=%%i
set RUNTIME_SA=%PROJECT_NUMBER%-compute@developer.gserviceaccount.com
for %%S in (gtmi-web-database-url gtmi-web-supabase-url gtmi-web-supabase-service-role-key) do (
    call gcloud secrets add-iam-policy-binding %%S --member="serviceAccount:%RUNTIME_SA%" --role="roles/secretmanager.secretAccessor" --project=%PROJECT_ID% --quiet >nul
)
echo Granting Cloud Build SAs access to build-time secrets (legacy + compute default)...
set LEGACY_BUILD_SA=%PROJECT_NUMBER%@cloudbuild.gserviceaccount.com
set COMPUTE_SA=%PROJECT_NUMBER%-compute@developer.gserviceaccount.com
for %%S in (gtmi-web-public-supabase-url gtmi-web-public-supabase-anon-key gtmi-web-public-app-url) do (
    call gcloud secrets add-iam-policy-binding %%S --member="serviceAccount:%LEGACY_BUILD_SA%" --role="roles/secretmanager.secretAccessor" --project=%PROJECT_ID% --quiet >nul
    call gcloud secrets add-iam-policy-binding %%S --member="serviceAccount:%COMPUTE_SA%" --role="roles/secretmanager.secretAccessor" --project=%PROJECT_ID% --quiet >nul
)

echo [3/4] Submitting build to Cloud Build (build context = monorepo root)...
pushd "%~dp0..\.."
call gcloud builds submit --config apps\web\cloudbuild.yaml . --project=%PROJECT_ID%
set BUILD_EXIT=%errorlevel%
popd
if not "%BUILD_EXIT%"=="0" (
    echo Build failed with exit code %BUILD_EXIT%.
    exit /b %BUILD_EXIT%
)

echo [4/4] Fetching deployed service URL...
for /f "tokens=*" %%i in ('call gcloud run services describe %SERVICE% --region=%REGION% --project=%PROJECT_ID% --format="value(status.url)"') do set SERVICE_URL=%%i

echo.
echo =========================================
echo  Deployment complete.
echo  SERVICE URL=%SERVICE_URL%
echo =========================================
echo.
echo Next steps:
echo   1. If NEXT_PUBLIC_APP_URL secret is still a placeholder, update it:
echo      echo ^| set /p="%SERVICE_URL%" ^| gcloud secrets versions add gtmi-web-public-app-url --data-file=- --project=%PROJECT_ID%
echo      Then re-run this script to rebuild with the correct URL baked in.
echo   2. In Supabase dashboard ^(gtmi-staging^) Auth settings, add this redirect URL:
echo      %SERVICE_URL%/auth/callback

endlocal
