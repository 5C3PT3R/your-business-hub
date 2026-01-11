@echo off
echo ====================================
echo Deploying Gmail Sync Edge Function
echo ====================================
echo.

REM Check if logged in to Supabase
echo Checking Supabase login status...
npx supabase projects list >nul 2>&1
if %errorlevel% neq 0 (
    echo Not logged in to Supabase. Opening browser for login...
    npx supabase login
    if %errorlevel% neq 0 (
        echo Login failed. Please try again.
        pause
        exit /b 1
    )
)

echo.
echo Deploying gmail-sync function...
npx supabase functions deploy gmail-sync --project-ref pesqbkgfsfkqdquhilsv

if %errorlevel% equ 0 (
    echo.
    echo ====================================
    echo SUCCESS! Gmail Sync function deployed
    echo ====================================
    echo.
    echo Next steps:
    echo 1. Navigate to http://localhost:8080/inbox
    echo 2. Click the "Sync Gmail" button
    echo 3. Your Gmail messages will be synced to the inbox!
    echo.
) else (
    echo.
    echo ====================================
    echo Deployment failed
    echo ====================================
    echo.
    echo Please check the error above.
    echo You may need to run: npx supabase login
    echo.
)

pause
