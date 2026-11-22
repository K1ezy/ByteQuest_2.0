@echo off
setlocal
pwsh.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra\test-offline-battery.ps1"
set "exitCode=%ERRORLEVEL%"
echo.
echo Results: %~dp0logs\offline-battery-acceptance.log
pause
exit /b %exitCode%
