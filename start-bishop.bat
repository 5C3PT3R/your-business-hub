@echo off
title Bishop Startup
echo Starting Bishop AI (ngrok + n8n)...

:: Start ngrok in a new window
start "ngrok" cmd /k ""C:\Users\Eashan Singh\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe" http 5678"

:: Wait 3 seconds for ngrok to connect
timeout /t 3 /nobreak >nul

:: Start n8n with the correct base URL in a new window
start "n8n" cmd /k "set N8N_EDITOR_BASE_URL=https://unhairy-unreflectingly-zack.ngrok-free.dev && npx n8n"

echo.
echo Both windows started!
echo  - ngrok: https://unhairy-unreflectingly-zack.ngrok-free.dev
echo  - n8n:   http://localhost:5678
echo.
echo Press any key to close this window...
pause >nul
