<#
.SYNOPSIS
    Keeps the ByteQuest grading worker running.

.DESCRIPTION
    The worker grades every code submission. When it died, nothing restarted it:
    submissions stayed queued forever and students watched a spinner with no error.
    This supervisor restarts it and records every restart with its exit code.

    Each run writes to its own temporary files, which this script then appends to
    the shared logs. Appending to a redirected log from two processes fails
    instantly and silently, which made an earlier version spin without ever
    saying why, so the supervisor owns the shared files alone.

    A worker that exits immediately is failing for a reason a restart cannot fix
    (a bad interpreter, a missing module, an unreachable database), so the wait
    grows up to 30 seconds instead of spinning on the same error.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Python,
    [Parameter(Mandatory)][string]$WorkingDirectory,
    [Parameter(Mandatory)][string]$OutLog,
    [Parameter(Mandatory)][string]$ErrorLog
)

$ErrorActionPreference = 'Continue'

function Write-SupervisorLine {
    param([string]$Message)
    try { Add-Content -LiteralPath $ErrorLog -Value "$(Get-Date -Format o) | supervisor | $Message" }
    catch { Write-Error $Message }
}

function Copy-RunOutput {
    param([string]$From, [string]$To)
    if (-not (Test-Path -LiteralPath $From)) { return }
    try {
        $text = Get-Content -LiteralPath $From -Raw -ErrorAction Stop
        if (-not [string]::IsNullOrWhiteSpace($text)) { Add-Content -LiteralPath $To -Value $text.TrimEnd() }
    }
    catch { }
    Remove-Item -LiteralPath $From -Force -ErrorAction SilentlyContinue
}

$backoffSeconds = 3
while ($true) {
    $runOut = [System.IO.Path]::GetTempFileName()
    $runErr = [System.IO.Path]::GetTempFileName()
    $startedAt = Get-Date
    $exitCode = $null
    $startFailure = $null

    try {
        $child = Start-Process -FilePath $Python -ArgumentList @('-m', 'app.services.submission_worker') `
            -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -PassThru -Wait `
            -RedirectStandardOutput $runOut -RedirectStandardError $runErr
        $exitCode = $child.ExitCode
    }
    catch {
        $startFailure = $_.Exception.Message
    }

    $ranSeconds = [int]((Get-Date) - $startedAt).TotalSeconds
    Copy-RunOutput -From $runOut -To $OutLog
    Copy-RunOutput -From $runErr -To $ErrorLog

    if ($ranSeconds -ge 30) { $backoffSeconds = 3 }
    else { $backoffSeconds = [math]::Min(30, $backoffSeconds * 2) }

    if ($startFailure) {
        Write-SupervisorLine "could not start the grading worker: $startFailure; retrying in ${backoffSeconds}s"
    }
    else {
        Write-SupervisorLine "grading worker exited after ${ranSeconds}s (exit code $exitCode); restarting in ${backoffSeconds}s"
    }
    Start-Sleep -Seconds $backoffSeconds
}
