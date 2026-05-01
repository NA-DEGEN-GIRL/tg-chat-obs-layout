@echo off
setlocal

set "APP_DIR=%~dp0"
set "EXE=%APP_DIR%dist\TG 9393 Overlay App-0.1.0-x64.exe"

if not exist "%EXE%" (
  echo Windows portable app is not built yet:
  echo   %EXE%
  echo Build it from WSL with: npm run build:win
  pause
  exit /b 1
)

start "" "%EXE%" --url=http://127.0.0.1:9393/ --control
