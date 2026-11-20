[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logPath = Join-Path $repoRoot 'logs/offline-battery-acceptance.log'
New-Item -ItemType Directory -Path (Split-Path -Parent $logPath) -Force | Out-Null
Start-Transcript -Path $logPath -Force | Out-Null
try {
    $battery = Get-CimInstance Win32_Battery | Select-Object -First 1
    if (-not $battery -or $battery.BatteryStatus -ne 1) {
        throw 'Windows does not report battery power. Unplug AC and retry.'
    }
    $connectedPhysical = @(Get-NetAdapter -Physical -ErrorAction Stop | Where-Object Status -eq 'Up')
    if ($connectedPhysical.Count -gt 0) {
        throw "Physical network adapter still connected: $($connectedPhysical.Name -join ', '). Unplug Ethernet and disconnect Wi-Fi."
    }
    Write-Host "Battery: $($battery.EstimatedChargeRemaining)%; physical network adapters disconnected."

    & (Join-Path $PSScriptRoot 'start-bytequest.ps1') -PrepareOnly
    if ($LASTEXITCODE -ne 0) { throw 'ByteQuest launcher failed.' }

    foreach ($item in @(
        @{ Name = 'Frontend'; Url = 'http://127.0.0.1:3000/onboarding' },
        @{ Name = 'Local editor'; Url = 'http://127.0.0.1:3000/monaco/vs/loader.js' },
        @{ Name = 'FastAPI and database'; Url = 'http://127.0.0.1:8001/readyz' }
    )) {
        $response = Invoke-WebRequest -Uri $item.Url -TimeoutSec 10
        if ($response.StatusCode -ne 200) { throw "$($item.Name) returned HTTP $($response.StatusCode)." }
        Write-Host "$($item.Name): HTTP 200"
    }

    Push-Location (Join-Path $repoRoot 'backend')
    try {
        $python = Join-Path (Get-Location).Path '.venv/Scripts/python.exe'
        & $python -m scripts.check_offline_runtime
        if ($LASTEXITCODE -ne 0) { throw 'Python/C++/Java grading check failed.' }
        & $python scripts/smoke_local_python_quest_demo.py
        if ($LASTEXITCODE -ne 0) { throw 'Quiz, XP, progress, or challenge smoke check failed.' }
    }
    finally { Pop-Location }
    Write-Host 'OFFLINE BATTERY ACCEPTANCE PASSED'
}
catch {
    Write-Host "OFFLINE BATTERY ACCEPTANCE FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    Stop-Transcript | Out-Null
}
