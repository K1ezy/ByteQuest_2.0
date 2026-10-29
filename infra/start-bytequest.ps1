[CmdletBinding()]
param(
    [Parameter()]
    [string]$Judge0VmName = "ByteQuest-Judge0-Install",

    [Parameter()]
    [string]$Judge0SshUser = "bytequest"
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

function ConvertTo-PowerShellLiteral {
    param([Parameter(Mandatory)][string]$Value)
    return "'" + $Value.Replace("'", "''") + "'"
}

function ConvertTo-EncodedPowerShellCommand {
    param([Parameter(Mandatory)][string]$Command)
    return [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Command))
}

function Write-Step {
    param([Parameter(Mandatory)][string]$Message)
    $elapsed = if ($script:StartupClock) {
        $script:StartupClock.Elapsed.ToString('mm\:ss')
    }
    else {
        '00:00'
    }
    Write-Host "`n==> [$elapsed elapsed] $Message" -ForegroundColor Cyan
}

function Test-TcpPort {
    param(
        [Parameter(Mandatory)][string]$ComputerName,
        [Parameter(Mandatory)][int]$Port,
        [int]$TimeoutMilliseconds = 1200
    )

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $connect = $client.BeginConnect($ComputerName, $Port, $null, $null)
        if (-not $connect.AsyncWaitHandle.WaitOne($TimeoutMilliseconds, $false)) {
            return $false
        }
        $client.EndConnect($connect)
        return $client.Connected
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

function Test-HttpReady {
    param(
        [Parameter(Mandatory)][string]$Uri,
        [int]$TimeoutSeconds = 3
    )

    try {
        $null = Invoke-WebRequest -Uri $Uri -TimeoutSec $TimeoutSeconds -UseBasicParsing
        return $true
    }
    catch {
        return $false
    }
}

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Start-OrResumeJudge0Vm {
    param([Parameter(Mandatory)][string]$Name)

    Import-Module Hyper-V -ErrorAction Stop
    $vm = Get-VM -Name $Name -ErrorAction Stop

    if ($vm.State -eq "Running") {
        Write-Host "Judge0 VM '$Name' is already running."
        return
    }

    if ($vm.State -eq "Paused") {
        Resume-VM -VM $vm -ErrorAction Stop | Out-Null
    }
    else {
        Start-VM -VM $vm -ErrorAction Stop | Out-Null
    }

    $deadline = (Get-Date).AddSeconds(45)
    do {
        Start-Sleep -Seconds 2
        $vm = Get-VM -Name $Name -ErrorAction Stop
        if ($vm.State -eq "Running") {
            Write-Host "Judge0 VM '$Name' is running."
            return
        }
    } while ((Get-Date) -lt $deadline)

    throw "The VM '$Name' did not reach Running state. Open Hyper-V Manager/VM Connection, resolve any guest boot prompt, then rerun this launcher."
}

function Get-Judge0VmIPv4 {
    param([Parameter(Mandatory)][string]$Name)

    $addresses = @(
        Get-VMNetworkAdapter -VMName $Name -ErrorAction SilentlyContinue |
        ForEach-Object { $_.IPAddresses }
    )

    foreach ($address in $addresses) {
        $parsed = $null
        if ([System.Net.IPAddress]::TryParse([string]$address, [ref]$parsed) -and
            $parsed.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
            -not $parsed.IsLoopback -and
            -not ([string]$address).StartsWith("169.254.")) {
            return [string]$parsed
        }
    }
    return $null
}

function Get-Judge0VmIPv4FromNeighbor {
    param([Parameter(Mandatory)][string]$Name)

    $vmAdapters = @(
        Get-VMNetworkAdapter -VMName $Name -ErrorAction SilentlyContinue |
        Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.MacAddress) }
    )
    if ($vmAdapters.Count -eq 0) { return $null }

    $neighbors = @(Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.State -notin @("Incomplete", "Unreachable") })

    foreach ($adapter in $vmAdapters) {
        $adapterMac = ([string]$adapter.MacAddress) -replace "[^0-9A-Fa-f]", ""
        if ([string]::IsNullOrWhiteSpace($adapterMac)) { continue }

        foreach ($neighbor in $neighbors) {
            $neighborMac = ([string]$neighbor.LinkLayerAddress) -replace "[^0-9A-Fa-f]", ""
            if ($neighborMac -ne $adapterMac) { continue }

            $parsed = $null
            $address = [string]$neighbor.IPAddress
            if ([System.Net.IPAddress]::TryParse($address, [ref]$parsed) -and
                $parsed.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
                -not $parsed.IsLoopback -and
                -not $address.StartsWith("169.254.")) {
                return [string]$parsed
            }
        }
    }

    return $null
}

function Read-Judge0VmIPv4FromConsole {
    param([Parameter(Mandatory)][string]$Name)

    $adapterDetails = @(
        Get-VMNetworkAdapter -VMName $Name -ErrorAction SilentlyContinue |
        ForEach-Object { "$($_.SwitchName), MAC $($_.MacAddress)" }
    ) -join "; "
    $kvp = Get-VMIntegrationService -VMName $Name -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "Key.?Value Pair Exchange|Data Exchange" } |
    Select-Object -First 1

    Write-Warning "Hyper-V has not reported the guest IP after 45 seconds."
    if ($adapterDetails) { Write-Host "VM network adapter: $adapterDetails" }
    if ($kvp) {
        $enabledText = if ($kvp.Enabled) { "enabled" } else { "disabled" }
        Write-Host "Hyper-V IP reporting service '$($kvp.Name)': $enabledText ($($kvp.PrimaryStatusDescription))."
    }
    Write-Host "In the '$Name' VM Connection, sign in to Ubuntu if needed and run: ip -4 -brief addr show eth0"
    Write-Host "Enter the IPv4 address before the slash (for example, 172.23.175.189). Do not enter your password here."
    Write-Host "Press Enter to retry automatic discovery, or type Q to stop startup."

    while ($true) {
        $enteredAddress = (Read-Host "Current Ubuntu VM IPv4 address")
        if ([string]::IsNullOrWhiteSpace($enteredAddress)) {
            $address = Get-Judge0VmIPv4 -Name $Name
            if (-not $address) { $address = Get-Judge0VmIPv4FromNeighbor -Name $Name }
            if ($address) { return $address }
            Write-Host "Hyper-V and the host neighbor table still have no guest address. Check the VM console, then retry or enter its IP."
            continue
        }
        if ($enteredAddress.Trim() -match "^(?i:q|quit|cancel)$") {
            throw "Startup canceled at the Judge0 VM address prompt. Docker and local Supabase remain running; no database reset or VM disk change was made."
        }

        $candidate = $enteredAddress.Trim().Split("/")[0]
        $parsed = $null
        if ([System.Net.IPAddress]::TryParse($candidate, [ref]$parsed) -and
            $parsed.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
            -not $parsed.IsLoopback -and
            -not $candidate.StartsWith("169.254.")) {
            return [string]$parsed
        }
        Write-Warning "'$enteredAddress' is not a usable IPv4 address. Enter the IPv4 value shown by the Ubuntu command, or press Enter to retry discovery."
    }
}

function Read-EnvValue {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Name
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $null
    }
    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        if ($line -match ('^' + [Regex]::Escape($Name) + '=(.*)$')) {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    return $null
}

function Get-ListeningProcesses {
    param([Parameter(Mandatory)][int]$Port)

    $ids = @(
        Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    )
    foreach ($id in $ids) {
        Get-CimInstance Win32_Process -Filter "ProcessId = $id" -ErrorAction SilentlyContinue
    }
}

function Test-IsByteQuestFrontendListener {
    param(
        [Parameter(Mandatory)]$Process,
        [Parameter(Mandatory)][string]$FrontendPath
    )

    if ($Process.Name -eq "node.exe") {
        if ($Process.CommandLine -and $Process.CommandLine -like "*$FrontendPath*") {
            return $true
        }
        if ($Process.ParentProcessId) {
            $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($Process.ParentProcessId)" -ErrorAction SilentlyContinue
            if ($parent -and $parent.Name -eq "node.exe" -and $parent.CommandLine -like "*$FrontendPath*") {
                return $true
            }
        }
    }
    return $false
}

function Start-Frontend {
    param(
        [Parameter(Mandatory)][string]$FrontendPath,
        [Parameter(Mandatory)][string]$FrontendEnvPath,
        [AllowNull()][string]$PreviousApiUrl
    )

    Write-Step "Start the Next.js frontend while Judge0 initializes"
    $frontendListener = @(Get-ListeningProcesses -Port 3000)
    if ($frontendListener.Count -gt 0) {
        $byteQuestProcesses = @($frontendListener | Where-Object {
                Test-IsByteQuestFrontendListener -Process $_ -FrontendPath $FrontendPath
            })
        $frontendListenerIsByteQuest = ($byteQuestProcesses.Count -gt 0)

        if (-not $frontendListenerIsByteQuest) {
            $ownerDetails = @($frontendListener | ForEach-Object { "$($_.Name) (PID $($_.ProcessId))" } | Select-Object -Unique) -join ", "
            throw "Port 3000 is already used by an external process ($ownerDetails). Stop the process using port 3000, then rerun this launcher. It did not terminate any process."
        }

        $currentFrontendApiUrl = Read-EnvValue -Path $FrontendEnvPath -Name "NEXT_PUBLIC_API_URL"
        if ($PreviousApiUrl -and $currentFrontendApiUrl -and $PreviousApiUrl -ne $currentFrontendApiUrl) {
            Write-Host "The existing ByteQuest frontend was running against a previous API address ($PreviousApiUrl vs $currentFrontendApiUrl). Restarting it..."
            foreach ($p in $byteQuestProcesses) {
                if ($p.ParentProcessId) {
                    Stop-Process -Id $p.ParentProcessId -Force -ErrorAction SilentlyContinue
                }
                Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
            }
            Start-Sleep -Seconds 1
        }
        else {
            Write-Host "This ByteQuest frontend already appears to be running on port 3000; reusing it."
            return
        }
    }

    $pwshPath = (Get-Command pwsh.exe -ErrorAction Stop).Source
    $frontendLiteral = ConvertTo-PowerShellLiteral -Value $FrontendPath
    $frontendCommand = "Set-Location -LiteralPath $frontendLiteral; npm run dev -- --hostname 127.0.0.1 --port 3000"
    $frontendEncoded = ConvertTo-EncodedPowerShellCommand -Command $frontendCommand
    # Minimized so the dev-server window stays available in the taskbar (for logs
    # or to close it) without crowding the desktop during startup.
    Start-Process -FilePath $pwshPath -WindowStyle Minimized -ArgumentList @("-NoLogo", "-NoProfile", "-NoExit", "-EncodedCommand", $frontendEncoded) | Out-Null
}

function Wait-FrontendReady {
    param(
        [Parameter(Mandatory)][string]$Uri,
        [int]$TimeoutSeconds = 90
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while (-not (Test-HttpReady -Uri $Uri)) {
        if ((Get-Date) -ge $deadline) {
            throw "The frontend did not answer at $Uri within $TimeoutSeconds seconds. Check the Next.js PowerShell window and rerun this launcher after resolving its error."
        }
        Start-Sleep -Seconds 2
    }
    Write-Host "The frontend is responding at $Uri."
}

if ($PSVersionTable.PSVersion.Major -lt 7) {
    throw "This launcher requires PowerShell 7 (pwsh.exe). Install it and run START-BYTEQUEST.bat again."
}

if (-not (Test-IsAdministrator)) {
    Write-Host "Requesting administrator access for Hyper-V management..."
    $scriptLiteral = ConvertTo-PowerShellLiteral -Value $PSCommandPath
    $vmNameLiteral = ConvertTo-PowerShellLiteral -Value $Judge0VmName
    $sshUserLiteral = ConvertTo-PowerShellLiteral -Value $Judge0SshUser
    $elevatedCommand = "& $scriptLiteral -Judge0VmName $vmNameLiteral -Judge0SshUser $sshUserLiteral"
    $encodedCommand = ConvertTo-EncodedPowerShellCommand -Command $elevatedCommand

    try {
        $elevatedProcess = Start-Process -FilePath (Get-Command pwsh.exe -ErrorAction Stop).Source `
            -ArgumentList @("-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encodedCommand) `
            -Verb RunAs -PassThru -Wait
    }
    catch {
        throw "ByteQuest needs administrator access to inspect and start its Hyper-V Judge0 VM. Approve the Windows prompt, or right-click START-BYTEQUEST.bat and choose Run as administrator. No services were started by this attempt."
    }

    exit $elevatedProcess.ExitCode
}

$script:StartupClock = [System.Diagnostics.Stopwatch]::StartNew()
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendPath = Join-Path $repoRoot "backend"
$frontendPath = Join-Path $repoRoot "frontend"
$backendPython = Join-Path $backendPath ".venv\Scripts\python.exe"
$localSetupScript = Join-Path $PSScriptRoot "start-local.ps1"
$judge0ConfigScript = Join-Path $PSScriptRoot "configure-judge0-vm.ps1"
$backendEnvPath = Join-Path $backendPath ".env.local"
$frontendEnvPath = Join-Path $frontendPath ".env.local"
$previousJudge0BaseUrl = Read-EnvValue -Path $backendEnvPath -Name "JUDGE0_BASE_URL"
$previousFrontendApiUrl = Read-EnvValue -Path $frontendEnvPath -Name "NEXT_PUBLIC_API_URL"

Write-Host "ByteQuest local startup" -ForegroundColor Green

foreach ($requiredPath in @($backendPython, (Join-Path $frontendPath "node_modules\next\dist\bin\next"), $localSetupScript)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required local file is missing: $requiredPath. Install dependencies first."
    }
}

foreach ($requiredCommand in @("pwsh.exe", "node", "npm", "supabase")) {
    if (-not (Get-Command $requiredCommand -ErrorAction SilentlyContinue)) {
        throw "Required command '$requiredCommand' was not found on PATH."
    }
}

# Resolve Docker CLI path if missing
if (-not (Get-Command docker.exe -ErrorAction SilentlyContinue)) {
    $dockerCliPaths = @(
        (Join-Path $env:ProgramFiles "Docker\Docker\resources\bin\docker.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin\docker.exe")
    )
    $dockerExe = $dockerCliPaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($dockerExe) {
        $env:PATH = "$(Split-Path -Parent $dockerExe);$env:PATH"
    }
}

Write-Step "Start Docker Desktop and local Supabase"
$judge0VmStarted = $false
& docker.exe info *> $null
if ($LASTEXITCODE -ne 0) {
    $dockerDesktopPaths = @(
        (Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\Docker Desktop.exe")
    )
    $dockerDesktop = $dockerDesktopPaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $dockerDesktop) {
        throw "Docker Desktop application not found."
    }
    Start-Process -FilePath $dockerDesktop | Out-Null
    Start-OrResumeJudge0Vm -Name $Judge0VmName
    $judge0VmStarted = $true
}

if (-not $judge0VmStarted) {
    Start-OrResumeJudge0Vm -Name $Judge0VmName
}

Write-Step "Initialize local Supabase and write settings"
& $localSetupScript
$frontendApiUrl = Read-EnvValue -Path $frontendEnvPath -Name "NEXT_PUBLIC_API_URL"
if ($frontendApiUrl -match '^http://(?:127\.0\.0\.1|localhost):(?<port>\d+)/api/v1/?$') {
    $apiPort = [int]$Matches.port
}
else {
    throw "Invalid local NEXT_PUBLIC_API_URL."
}

Start-Frontend -FrontendPath $frontendPath -FrontendEnvPath $frontendEnvPath -PreviousApiUrl $previousFrontendApiUrl

Write-Step "Discover Judge0 VM address and verify API"
$guestIPv4 = $null
$ipDeadline = (Get-Date).AddSeconds(45)
do {
    $guestIPv4 = Get-Judge0VmIPv4 -Name $Judge0VmName
    if (-not $guestIPv4) {
        $guestIPv4 = Get-Judge0VmIPv4FromNeighbor -Name $Judge0VmName
    }
    if ($guestIPv4) { break }
    Start-Sleep -Seconds 5
} while ((Get-Date) -lt $ipDeadline)

if (-not $guestIPv4) {
    $guestIPv4 = Read-Judge0VmIPv4FromConsole -Name $Judge0VmName
}

$judge0Url = "http://$guestIPv4`:2358"
$judge0PortOpen = Test-TcpPort -ComputerName $guestIPv4 -Port 2358
if (-not $judge0PortOpen) {
    if (Test-TcpPort -ComputerName $guestIPv4 -Port 22) {
        $sshCommand = Get-Command ssh.exe -ErrorAction SilentlyContinue
        if ($sshCommand) {
            & $sshCommand.Source -tt "$Judge0SshUser@$guestIPv4" "cd ~/judge0-v1.13.1-extra && sudo docker compose up -d"
        }
    }
    $judge0Deadline = (Get-Date).AddSeconds(150)
    do {
        if (Test-TcpPort -ComputerName $guestIPv4 -Port 2358) { $judge0PortOpen = $true; break }
        Start-Sleep -Seconds 5
    } while ((Get-Date) -lt $judge0Deadline)
}

$judge0Ready = $false
if ($judge0PortOpen) {
    & $judge0ConfigScript -BaseUrl $judge0Url
    try {
        $languageResponse = Invoke-WebRequest -Uri "$judge0Url/languages" -TimeoutSec 8 -UseBasicParsing -SkipHttpErrorCheck
        if ($languageResponse.StatusCode -eq 200) {
            $languageList = $languageResponse.Content | ConvertFrom-Json -ErrorAction Stop
            $judge0Ready = $languageList -is [array] -and $languageList.Count -gt 0
        }
    }
    catch {
        $judge0Ready = $false
    }
}

Write-Step "Start FastAPI"
$existingApi = @(Get-ListeningProcesses -Port $apiPort | Where-Object {
        $_.CommandLine -match "(?i)(?:-m\s+)?uvicorn\s+app\.main:app.*--port\s+$apiPort(?:\s|$)"
    })
if ($existingApi.Count -eq 0) {
    $pwshPath = (Get-Command pwsh.exe -ErrorAction Stop).Source
    $pythonLiteral = ConvertTo-PowerShellLiteral -Value $backendPython
    $backendLiteral = ConvertTo-PowerShellLiteral -Value $backendPath
    $backendCommand = "Set-Location -LiteralPath $backendLiteral; & $pythonLiteral -m uvicorn app.main:app --reload --host 127.0.0.1 --port $apiPort"
    $backendEncoded = ConvertTo-EncodedPowerShellCommand -Command $backendCommand
    # Minimized to match the frontend window: available in the taskbar, out of the way.
    Start-Process -FilePath $pwshPath -WindowStyle Minimized -ArgumentList @("-NoLogo", "-NoProfile", "-NoExit", "-EncodedCommand", $backendEncoded) | Out-Null
}

$apiHealthUrl = "http://127.0.0.1:$apiPort/health"
$apiDeadline = (Get-Date).AddSeconds(60)
while (-not (Test-HttpReady -Uri $apiHealthUrl)) {
    if ((Get-Date) -ge $apiDeadline) {
        throw "FastAPI did not become healthy within 60 seconds."
    }
    Start-Sleep -Seconds 2
}

Write-Step "Start grading worker"
$existingWorkers = @(Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
        $_.ExecutablePath -eq $backendPython -and
        $_.CommandLine -match '(?i)-m\s+app\.services\.submission_worker(?:\s|$)'
    })
foreach ($worker in $existingWorkers) {
    Stop-Process -Id $worker.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 1

$logPath = Join-Path $repoRoot "logs"
New-Item -ItemType Directory -Path $logPath -Force | Out-Null
$worker = Start-Process -FilePath $backendPython -ArgumentList @("-m", "app.services.submission_worker") `
    -WorkingDirectory $backendPath -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $logPath "submission-worker.log") `
    -RedirectStandardError (Join-Path $logPath "submission-worker.err.log")
Start-Sleep -Seconds 2
if ($worker.HasExited) {
    throw "The grading worker exited during startup. Check logs/submission-worker.err.log."
}
Write-Host "Grading worker started cleanly (PID $($worker.Id))."

$startupAuthRun = [guid]::NewGuid().ToString("N")
$frontendUrl = "http://127.0.0.1:3000/onboarding?startup_auth=1&startup_run=$startupAuthRun"
Wait-FrontendReady -Uri $frontendUrl

Write-Step "ByteQuest is ready"
Start-Process $frontendUrl | Out-Null