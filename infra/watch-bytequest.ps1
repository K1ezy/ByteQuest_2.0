<#
.SYNOPSIS
    Checks the running ByteQuest stack once and logs the result. Run it every minute during class.

.DESCRIPTION
    Each run appends one line to logs/ops/watchdog.log after checking that:
      - the Docker engine answers;
      - the API and its database answer (/readyz);
      - the submission queue is moving and the grading worker's heartbeat is fresh;
      - every 5 minutes, or with -Judge0, Judge0 grades one real test program.

    A Windows message appears only when the result changes, so a failure that lasts an hour is
    announced once, not every minute.

    The watchdog reports downtime. Use START-BYTEQUEST.bat when you want to start the stack again.

.EXAMPLE
    Run one check by hand, including Judge0:
    pwsh -NoProfile -File infra\watch-bytequest.ps1 -Judge0

.EXAMPLE
    Run it every minute while you're signed in, without a window flashing up:
    schtasks /Create /TN "ByteQuest watchdog" /SC MINUTE /MO 1 /F /TR "conhost.exe --headless pwsh.exe -NoProfile -File C:\path\to\ByteQuest_2.0\infra\watch-bytequest.ps1"
    Remove it after the pilot:
    schtasks /Delete /TN "ByteQuest watchdog" /F
#>
[CmdletBinding()]
param([switch]$Judge0)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'launcher-common.ps1')

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backendPath = Join-Path $repoRoot 'backend'
$opsPath = Join-Path $repoRoot 'logs\ops'
$statePath = Join-Path $opsPath 'watchdog.state'
New-Item -ItemType Directory -Path $opsPath -Force | Out-Null

$runJudge0 = $Judge0 -or ((Get-Date).Minute % 5 -eq 0)
$problems = [System.Collections.Generic.List[string]]::new()

$docker = Get-DockerDesktopFile -RelativePath 'resources\bin\docker.exe'
$dockerUp = $false
if ($docker) {
    & $docker info *> $null
    $dockerUp = $LASTEXITCODE -eq 0
}

if (-not $dockerUp) {
    $problems.Add('Docker engine is unavailable. Run START-BYTEQUEST.bat when you want to start ByteQuest.')
}
else {
    $apiUrl = Read-EnvValue -Path (Join-Path $repoRoot 'frontend\.env.local') -Name 'NEXT_PUBLIC_API_URL'
    if ($apiUrl -notmatch '^(?<origin>https?://[^/]+)') {
        $problems.Add('No API address in frontend/.env.local. Run START-BYTEQUEST.bat.')
    }
    elseif (-not (Test-HttpReady -Uri "$($Matches.origin)/readyz" -TimeoutSeconds 5)) {
        $problems.Add("API or database not ready at $($Matches.origin)/readyz. Rerun START-BYTEQUEST.bat.")
    }

    $arguments = @('-m', 'scripts.check_stack_health') + @(if ($runJudge0) { '--judge0' })
    Push-Location $backendPath
    try {
        $output = & (Join-Path $backendPath '.venv\Scripts\python.exe') @arguments 2>&1
        $stackExitCode = $LASTEXITCODE
    }
    finally { Pop-Location }
    if ($stackExitCode -ne 0) {
        $output | ForEach-Object { "$_" } | Where-Object { $_ -and $_ -notmatch ' healthy: ' } |
            Select-Object -Last 3 | ForEach-Object { $problems.Add($_) }
    }
}

$healthy = $problems.Count -eq 0
$detail = if ($healthy) { 'All checks passed' + $(if ($runJudge0) { ', Judge0 included.' } else { '.' }) } else { $problems -join ' | ' }
# shortcut: the log is never rotated (about 150 KB a day); trim it by hand after the pilot.
Add-Content -LiteralPath (Join-Path $opsPath 'watchdog.log') -Value "$(Get-Date -Format o) | $(if ($healthy) { 'ok  ' } else { 'FAIL' }) | $detail"

$previous = if (Test-Path -LiteralPath $statePath) { (Get-Content -LiteralPath $statePath -Raw).Trim() } else { $null }
$notice = Get-WatchdogNotice -Previous $previous -Healthy $healthy -Detail $detail
Set-Content -LiteralPath $statePath -Value $(if ($healthy) { 'ok' } else { 'fail' })
if ($notice) {
    try { & msg.exe $env:USERNAME /TIME:600 $notice }
    catch { Write-Warning "Could not show the Windows message: $($_.Exception.Message)" }
}
Write-Host $detail
exit $(if ($healthy) { 0 } else { 1 })
