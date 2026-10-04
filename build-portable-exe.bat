@echo off
title Moderation Studio - Portable .EXE Builder
cd /d "%~dp0"

echo ========================================================
echo   Building ModerationStudio-Portable.exe
echo ========================================================

echo [1/3] Building frontend production bundle...
call npm run build

echo [2/3] Installing Electron packager...
call npm install -D electron electron-builder

echo [3/3] Packaging standalone portable .EXE...
call npx electron-builder --win portable

echo.
echo Done! Your standalone portable .exe is ready in the /release folder.
pause
