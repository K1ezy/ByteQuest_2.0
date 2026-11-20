@echo off
rem Opens ByteQuest only on your own ZeroTier network (ByteQuest, 743993800f5d8819).
pwsh.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra\start-zerotier-relay.ps1" -NetworkId 743993800f5d8819 %*
pause
