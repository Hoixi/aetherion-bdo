@echo off
title BDO Optimizer Agent
echo.
echo  ==========================================
echo   BDO Optimizer Agent - aetheri.online
echo  ==========================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo [ERROR] Node.js bulunamadi. https://nodejs.org adresinden yukleyin.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [*] Ilk kez baslatiliyor, bagimliliklar yukleniyor...
  npm install
  echo.
)

echo [*] Agent baslatiliyor: http://127.0.0.1:7432
echo [*] Bu pencereyi oynarken acik tutun.
echo.
node server.js
pause
