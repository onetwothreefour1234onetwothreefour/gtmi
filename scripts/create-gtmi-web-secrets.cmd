@echo off
setlocal enabledelayedexpansion

set PROJECT_ID=gtmi-494008

echo Creating Secret Manager secrets for gtmi-web in project %PROJECT_ID%.
echo Each prompt below accepts a value; leave blank to skip if the secret already exists.
echo For gtmi-web-public-app-url, use a placeholder on first run ^(e.g. http://placeholder^).
echo.

call gcloud services enable secretmanager.googleapis.com --project=%PROJECT_ID%

call :createSecret gtmi-web-database-url "DATABASE_URL (Supabase transaction pooler URI)"
call :createSecret gtmi-web-supabase-url "SUPABASE_URL (same as NEXT_PUBLIC_SUPABASE_URL)"
call :createSecret gtmi-web-supabase-service-role-key "SUPABASE service role (secret) key"
call :createSecret gtmi-web-public-supabase-url "NEXT_PUBLIC_SUPABASE_URL (public Supabase URL)"
call :createSecret gtmi-web-public-supabase-anon-key "NEXT_PUBLIC_SUPABASE_ANON_KEY (publishable anon key)"
call :createSecret gtmi-web-public-app-url "NEXT_PUBLIC_APP_URL (use http://placeholder on first run)"

echo.
echo All secrets processed. Next: run apps\web\deploy.cmd
exit /b 0

:createSecret
set SECRET_NAME=%~1
set SECRET_DESC=%~2
echo.
echo --- %SECRET_NAME% ---
echo %SECRET_DESC%
call gcloud secrets describe %SECRET_NAME% --project=%PROJECT_ID% >nul 2>&1
if errorlevel 1 (
    set /p VAL="Enter value: "
    if "!VAL!"=="" (
        echo Skipped creating %SECRET_NAME% — no value entered.
        goto :eof
    )
    call gcloud secrets create %SECRET_NAME% --replication-policy=automatic --project=%PROJECT_ID%
    echo !VAL!| call gcloud secrets versions add %SECRET_NAME% --data-file=- --project=%PROJECT_ID%
    echo Created %SECRET_NAME%.
) else (
    echo %SECRET_NAME% already exists.
    set /p UPDATE="Add a new version with a new value? (y/N): "
    if /i "!UPDATE!"=="y" (
        set /p VAL="Enter new value: "
        if "!VAL!"=="" (
            echo No value entered — skipping.
            goto :eof
        )
        echo !VAL!| call gcloud secrets versions add %SECRET_NAME% --data-file=- --project=%PROJECT_ID%
        echo Added new version for %SECRET_NAME%.
    )
)
goto :eof
