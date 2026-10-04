@echo off
title Moderation Studio - Portable .EXE Builder
cd /d "%~dp0"

echo ========================================================
echo   Building Standalone ModerationStudio-Portable.exe
echo ========================================================

if not exist "node_modules" (
  echo [1/4] Installing project dependencies...
  call npm install
)

echo [2/4] Building React frontend production bundle (/dist)...
call npm run build

echo [3/4] Bundling Express backend + Electron main into dist-electron/main.cjs...
call npm run bundle:electron

echo [4/4] Packaging single standalone ModerationStudio-Portable.exe...
call npx --yes electron-builder --win portable

echo.
echo ========================================================
echo   SUCCESS! Your standalone app is ready at:
echo   release\ModerationStudio-Portable.exe
echo ========================================================
pause
