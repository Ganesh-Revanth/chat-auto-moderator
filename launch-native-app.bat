@echo off
title Moderation Studio - Native App Launcher
cd /d "%~dp0"

echo ========================================================
echo   Moderation Studio - Native Desktop Launcher
echo ========================================================

if not exist "node_modules" (
  echo [1/2] Installing dependencies for first-time setup...
  call npm install
)

echo [2/2] Starting local backend and launching Native App Window...
start "" cmd /c "timeout /t 2 /nobreak >nul & start --app=http://localhost:3000 msedge || start --app=http://localhost:3000 chrome || start http://localhost:3000"
call npm run dev
