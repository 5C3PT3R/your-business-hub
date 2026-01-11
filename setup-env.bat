@echo off
echo ====================================
echo Gmail Sync - Environment Setup
echo ====================================
echo.

echo This script will help you set up required environment variables.
echo.

REM Generate encryption key
echo Generating secure ENCRYPTION_KEY...
for /f %%i in ('node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"') do set ENCRYPTION_KEY=%%i
echo Generated: %ENCRYPTION_KEY%
echo.

echo Please provide your Google OAuth credentials:
echo.

set /p GMAIL_CLIENT_ID="Enter GMAIL_CLIENT_ID: "
echo.

set /p GMAIL_CLIENT_SECRET="Enter GMAIL_CLIENT_SECRET: "
echo.

echo ====================================
echo Setting environment variables in Supabase...
echo ====================================
echo.

npx supabase secrets set ENCRYPTION_KEY=%ENCRYPTION_KEY%
npx supabase secrets set GMAIL_CLIENT_ID=%GMAIL_CLIENT_ID%
npx supabase secrets set GMAIL_CLIENT_SECRET=%GMAIL_CLIENT_SECRET%

if %errorlevel% equ 0 (
    echo.
    echo ====================================
    echo SUCCESS! Environment variables set
    echo ====================================
    echo.
    echo Now redeploying functions to pick up new variables...
    echo.

    npx supabase functions deploy gmail-sync --project-ref pesqbkgfsfkqdquhilsv
    npx supabase functions deploy gmail-oauth --project-ref pesqbkgfsfkqdquhilsv
    npx supabase functions deploy gmail-webhook --project-ref pesqbkgfsfkqdquhilsv

    echo.
    echo ====================================
    echo Setup Complete!
    echo ====================================
    echo.
    echo You can now test Gmail Sync:
    echo 1. Go to http://localhost:8080/inbox
    echo 2. Click "Sync Gmail" button
    echo 3. Your emails should sync successfully!
    echo.
) else (
    echo.
    echo ====================================
    echo Setup failed
    echo ====================================
    echo.
    echo Please check the errors above and try again.
    echo You may need to run: npx supabase login
    echo.
)

pause
