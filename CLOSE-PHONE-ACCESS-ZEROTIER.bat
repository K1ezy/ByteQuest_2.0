@echo off
pwsh.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra\start-zerotier-relay.ps1" -Stop
pause
