[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$frontendPath = Join-Path $repoRoot 'frontend'
$backendPath = Join-Path $repoRoot 'backend'
$logPath = Join-Path $repoRoot 'logs'
New-Item -ItemType Directory -Path $logPath -Force | Out-Null

if (-not (Get-Command pwsh.exe -ErrorAction SilentlyContinue)) { throw 'PowerShell 7 is required.' }
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Node.js is required.' }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm is required.' }

if (-not (Test-Path -LiteralPath (Join-Path $frontendPath 'node_modules/monaco-editor/min/vs/loader.js')) -or
    -not (Test-Path -LiteralPath (Join-Path $frontendPath 'node_modules/next/dist/bin/next'))) {
    Write-Host 'Installing frontend packages for offline use...'
    Push-Location $frontendPath
    try { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'npm ci failed. Check the connection and retry.' } }
    finally { Pop-Location }
}

$backendPython = Join-Path $backendPath '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $backendPython)) {
    Write-Host 'Creating the backend Python environment...'
    & py.exe -3.11 -m venv (Join-Path $backendPath '.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Python 3.11 is required to prepare the backend.' }
    & $backendPython -m pip install -r (Join-Path $backendPath 'requirements-dev.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Backend package installation failed. Check the connection and retry.' }
}

# Windows chooses the integrated GPU for the default browser when its graphics
# preference is Power saving. This affects that browser outside ByteQuest too.
$browserId = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice' -ErrorAction SilentlyContinue).ProgId
$browserCandidates = if ($browserId -eq 'MSEdgeHTM') {
    @('C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', 'C:\Program Files\Microsoft\Edge\Application\msedge.exe')
} elseif ($browserId -eq 'ChromeHTML') {
    @('C:\Program Files\Google\Chrome\Application\chrome.exe', 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe')
} else { @() }
$browserPath = $browserCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if ($browserPath) {
    $gpuKey = 'HKCU:\Software\Microsoft\DirectX\UserGpuPreferences'
    New-Item -Path $gpuKey -Force | Out-Null
    $previous = (Get-ItemProperty -Path $gpuKey -Name $browserPath -ErrorAction SilentlyContinue).$browserPath
    if ($previous -ne 'GpuPreference=1;') {
        [pscustomobject]@{ Browser = $browserPath; PreviousPreference = $previous } |
            ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logPath 'browser-gpu-preference-backup.json')
        New-ItemProperty -Path $gpuKey -Name $browserPath -Value 'GpuPreference=1;' -PropertyType String -Force | Out-Null
    }
    Write-Host 'Default browser graphics preference set to Power saving (integrated GPU). Restart the browser to apply it.'
}
else {
    Write-Warning 'The default browser was not recognized. Set its Windows Graphics preference to Power saving before the battery test.'
}

# Docker's engine runs on CPU; its optional desktop window can still wake the
# discrete GPU. Give that UI the same integrated-graphics preference.
$dockerDesktopUi = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\frontend\Docker Desktop.exe'
if (Test-Path -LiteralPath $dockerDesktopUi -PathType Leaf) {
    $gpuKey = 'HKCU:\Software\Microsoft\DirectX\UserGpuPreferences'
    New-Item -Path $gpuKey -Force | Out-Null
    $previous = (Get-ItemProperty -Path $gpuKey -Name $dockerDesktopUi -ErrorAction SilentlyContinue).$dockerDesktopUi
    if ($previous -ne 'GpuPreference=1;') {
        [pscustomobject]@{ Application = $dockerDesktopUi; PreviousPreference = $previous } |
            ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logPath 'docker-ui-gpu-preference-backup.json')
        New-ItemProperty -Path $gpuKey -Name $dockerDesktopUi -Value 'GpuPreference=1;' -PropertyType String -Force | Out-Null
    }
    Write-Host 'Docker Desktop graphics preference set to Power saving for its next launch.'
}

& (Join-Path $PSScriptRoot 'start-bytequest.ps1') -PrepareOnly
exit 0
