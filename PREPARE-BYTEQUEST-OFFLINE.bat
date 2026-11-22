@echo off
setlocal
where pwsh.exe >nul 2>&1
if errorlevel 1 (
    echo PowerShell 7 was not found. Install it, then run this file again.
    pause
    exit /b 1
)
pwsh.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra\prepare-offline.ps1"
set "exitCode=%ERRORLEVEL%"
if not "%exitCode%"=="0" (
    echo.
    echo Offline preparation stopped. Read the message above, then press any key to close.
    pause >nul
)
exit /b %exitCode%
