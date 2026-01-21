@echo off
REM Deployment Script for SDR Agent System (Windows)
REM Run this script from the project root directory (e:/your-business-hub)

echo 🚀 Starting SDR Agent System Deployment
echo ========================================
echo.

REM Check if supabase CLI is installed
where supabase >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Supabase CLI is not installed. Please install it first:
    echo    npm install -g supabase
    echo    OR visit: https://supabase.com/docs/guides/cli
    pause
    exit /b 1
)

echo ✅ Supabase CLI is installed
echo.

REM Step 1: Apply Database Migrations
echo 📦 Step 1: Applying Database Migrations
echo ----------------------------------------
echo.

echo Migrations to apply:
echo   - 20260118_create_wallets_table.sql
echo   - 20260118_create_ai_drafts_table.sql
echo.

echo Running: supabase migration up
supabase migration up

if %errorlevel% equ 0 (
    echo ✅ Database migrations applied successfully
) else (
    echo ❌ Failed to apply migrations. Please check the error above.
    pause
    exit /b 1
)

echo.

REM Step 2: Deploy Edge Function
echo ⚡ Step 2: Deploying SDR Agent Brain Edge Function
echo --------------------------------------------------
echo.

echo Deploying function: sdr-agent-brain
supabase functions deploy sdr-agent-brain

if %errorlevel% equ 0 (
    echo ✅ Edge Function deployed successfully
) else (
    echo ❌ Failed to deploy Edge Function. Please check the error above.
    pause
    exit /b 1
)

echo.

REM Step 3: Set Environment Variables (Instructions)
echo 🔑 Step 3: Setting Environment Variables
echo ----------------------------------------
echo.
echo IMPORTANT: You need to set the following environment variables in Supabase:
echo.
echo 1. OPENAI_API_KEY - Your OpenAI API key for AI draft generation
echo 2. SUPABASE_URL - Your Supabase project URL (auto-detected if using CLI)
echo 3. SUPABASE_SERVICE_ROLE_KEY - Your Supabase service role key
echo.
echo To set the OpenAI API key, run:
echo   supabase secrets set OPENAI_API_KEY=your_openai_api_key_here
echo.
echo To view current secrets:
echo   supabase secrets list
echo.
echo Note: The SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are usually
echo automatically configured when you run 'supabase link'.
echo.

REM Step 4: Regenerate TypeScript Types
echo 📝 Step 4: Regenerating TypeScript Types
echo ----------------------------------------
echo.

echo Generating TypeScript types from database schema...
supabase gen types typescript --local > src/integrations/supabase/types.ts

if %errorlevel% equ 0 (
    echo ✅ TypeScript types regenerated successfully
    echo    File: src/integrations/supabase/types.ts
) else (
    echo ⚠️  Could not regenerate types. You may need to run this manually:
    echo    supabase gen types typescript --local ^> src/integrations/supabase/types.ts
)

echo.

REM Step 5: Verification Steps
echo 🔍 Step 5: Verification Steps
echo -----------------------------
echo.
echo To verify the deployment, run these SQL commands in the Supabase SQL Editor:
echo.

echo -- 1. Check if wallets table exists
echo SELECT EXISTS (
echo    SELECT FROM information_schema.tables 
echo    WHERE table_schema = 'public' 
echo    AND table_name = 'wallets'
echo );
echo.
echo -- 2. Check if ai_drafts table exists
echo SELECT EXISTS (
echo    SELECT FROM information_schema.tables 
echo    WHERE table_schema = 'public' 
echo    AND table_name = 'ai_drafts'
echo );
echo.
echo -- 3. Check if RPC functions exist
echo SELECT proname FROM pg_proc 
echo WHERE proname IN ('deduct_credits', 'add_credits', 'track_ai_usage', 'has_sufficient_credits');
echo.
echo -- 4. Test the track_ai_usage function (replace with actual workspace_id)
echo -- SELECT track_ai_usage('your-workspace-id-here');
echo.

echo To test the Edge Function, you can use curl:
echo.
echo curl -X POST "https://your-project-ref.supabase.co/functions/v1/sdr-agent-brain" ^
echo   -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" ^
echo   -H "Content-Type: application/json" ^
echo   -d "{\"leadIds\": [\"test-lead-id\"], \"personaKey\": \"FRIENDLY_FOUNDER\", \"workspaceId\": \"your-workspace-id\", \"userId\": \"your-user-id\"}"
echo.

echo 🎉 Deployment Complete!
echo ======================
echo.
echo Next steps:
echo 1. Test the CreditsBadge component in the UI
echo 2. Create test leads in your database
echo 3. Generate AI drafts using the SDR Agent Brain
echo 4. Monitor credit usage in real-time
echo.
echo For troubleshooting, check:
echo - Supabase Dashboard: https://supabase.com/dashboard/project/_/logs
echo - Edge Function logs: supabase functions logs sdr-agent-brain
echo - Database queries: https://supabase.com/dashboard/project/_/editor
echo.

pause