@echo off
setlocal

where pwsh.exe >nul 2>&1
if errorlevel 1 (
    echo PowerShell 7 was not found. Install PowerShell 7, then run this file again.
    pause
    exit /b 1
)

pwsh.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra\start-bytequest.ps1"
set "exitCode=%ERRORLEVEL%"

if not "%exitCode%"=="0" (
    echo.
    echo ByteQuest startup stopped. Read the message above, then press any key to close this window.
    pause >nul
)

exit /b %exitCode%
