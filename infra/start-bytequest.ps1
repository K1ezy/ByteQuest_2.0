[CmdletBinding()]
param(
    [Parameter()]
    [string]$Judge0VmName = "ByteQuest-Judge0-Install",

    [Parameter()]
    [string]$Judge0SshUser = "bytequest",

    [Parameter()]
    [switch]$ForceMigrate,

    [Parameter()]
    [switch]$PrepareOnly,

    [Parameter()]
    [switch]$Development
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

$commonPath = Join-Path $PSScriptRoot "launcher-common.ps1"
if (-not (Test-Path -LiteralPath $commonPath -PathType Leaf)) {
    throw "Missing $commonPath. Restore it from source control before running this launcher."
}
. $commonPath

function Write-Step {
    param([Parameter(Mandatory)][string]$Message)
    $script:CurrentPhase = $Message
    $elapsed = if ($script:StartupClock) {
        $script:StartupClock.Elapsed.ToString('mm\:ss')
    }
    else {
        '00:00'
    }
    Write-Host "`n==> [$elapsed elapsed] $Message" -ForegroundColor Cyan
}

function Add-PhaseTiming {
    # Startup used to be one opaque minute. Recording each phase makes the next
    # slow step obvious instead of guesswork.
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][System.Diagnostics.Stopwatch]$Clock
    )
    $script:PhaseTimings[$Name] = [math]::Round($Clock.Elapsed.TotalSeconds, 1)
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
        if (Test-UsableGuestIPv4 -Address $candidate) {
            return $candidate
        }
        Write-Warning "'$enteredAddress' is not a usable IPv4 address. Enter the IPv4 value shown by the Ubuntu command, or press Enter to retry discovery."
    }
}

function Get-FrontendListenerState {
    # Resolves the frontend port with two CIM queries total (listeners, then
    # their parents) rather than one query per process as the old helper did.
    #
    # Every map read goes through Get-PortListenerPids / Get-ProcessDetail in
    # launcher-common.ps1. Reading the map directly is what broke startup: a
    # port with no listener yielded @($null), whose Count is 1, so the "no
    # listeners" guard below was skipped and the $null was then used as a
    # hashtable key -- "Index operation failed; the array index evaluated to
    # null". The helpers return a real [int[]] and never index with $null, so
    # the free-port case is now just the ordinary empty case.
    param(
        [Parameter(Mandatory)][string]$FrontendPath,
        [AllowNull()]$ListenerPidMap,
        [int]$Port = 3000
    )

    $listenerPids = Get-PortListenerPids -ListenerPidMap $ListenerPidMap -Port $Port
    if ($listenerPids.Count -eq 0) {
        return [pscustomobject]@{ InUse = $false; IsByteQuest = $false; Processes = @(); Owners = "" }
    }

    $details = Get-ProcessDetailMap -ProcessIds $listenerPids
    $parentIds = @(
        $details.Values |
        Where-Object { $_ -and $_.Name -eq "node.exe" } |
        ForEach-Object { $_.ParentProcessId }
    )
    $parents = Get-ProcessDetailMap -ProcessIds $parentIds

    $byteQuestProcesses = @(
        foreach ($processId in $listenerPids) {
            $process = Get-ProcessDetail -DetailMap $details -ProcessId $processId
            if (-not $process -or $process.Name -ne "node.exe") { continue }
            if ($process.CommandLine -and $process.CommandLine -like "*$FrontendPath*") {
                $process
                continue
            }
            $parent = Get-ProcessDetail -DetailMap $parents -ProcessId $process.ParentProcessId
            if ($parent -and $parent.Name -eq "node.exe" -and $parent.CommandLine -like "*$FrontendPath*") {
                $process
            }
        }
    )

    $owners = @(
        foreach ($processId in $listenerPids) {
            $process = Get-ProcessDetail -DetailMap $details -ProcessId $processId
            if ($process) { "$($process.Name) (PID $($process.ProcessId))" } else { "PID $processId" }
        }
    ) | Select-Object -Unique

    return [pscustomobject]@{
        InUse       = $true
        IsByteQuest = (@($byteQuestProcesses).Count -gt 0)
        Processes   = @($byteQuestProcesses)
        Owners      = (@($owners) -join ", ")
    }
}

function Start-FrontendProcess {
    param(
        [Parameter(Mandatory)][string]$FrontendPath,
        [switch]$Development
    )

    $pwshPath = (Get-Command pwsh.exe -ErrorAction Stop).Source
    $frontendLiteral = ConvertTo-PowerShellLiteral -Value $FrontendPath
    $scriptName = if ($Development) { 'dev' } else { 'start' }
    $frontendCommand = "Set-Location -LiteralPath $frontendLiteral; npm run $scriptName -- --hostname 127.0.0.1 --port 3000"
    $frontendEncoded = ConvertTo-EncodedPowerShellCommand -Command $frontendCommand
    $logs = Join-Path (Split-Path -Parent $FrontendPath) 'logs'
    New-Item -ItemType Directory -Path $logs -Force | Out-Null
    Start-Process -FilePath $pwshPath -WindowStyle Hidden `
        -ArgumentList @("-NoLogo", "-NoProfile", "-EncodedCommand", $frontendEncoded) `
        -RedirectStandardOutput (Join-Path $logs 'frontend.log') `
        -RedirectStandardError (Join-Path $logs 'frontend.err.log') | Out-Null
}

function Stop-ByteQuestFrontend {
    # Frees port 3000 when ByteQuest's own frontend holds it, so the next server
    # serves the current build. Returns $true when the port is free afterwards.
    param([Parameter(Mandatory)][string]$FrontendPath)

    $listenerPidMap = Get-ListenerPidMap
    $state = Get-FrontendListenerState -FrontendPath $FrontendPath -ListenerPidMap $listenerPidMap
    if (-not $state.InUse) { return $true }

    foreach ($process in $state.Processes) {
        if ($process.ParentProcessId) {
            Stop-Process -Id $process.ParentProcessId -Force -ErrorAction SilentlyContinue
        }
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }
    if (@($state.Processes).Count -eq 0 -and
        (Test-HttpReady -Uri 'http://127.0.0.1:3000/monaco/vs/loader.js' -TimeoutSeconds 3)) {
        # Windows sometimes hides a listener's command line. A node.exe listener
        # serving ByteQuest's own Monaco loader is ours; stop only that listener.
        $details = Get-ProcessDetailMap -ProcessIds (Get-PortListenerPids -ListenerPidMap $listenerPidMap -Port 3000)
        foreach ($process in @($details.Values | Where-Object { $_.Name -eq 'node.exe' })) {
            Write-Host "Stopping the previous ByteQuest frontend (node.exe PID $($process.ProcessId))."
            Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
    return Wait-Until -TimeoutSeconds 10 -PollMilliseconds 200 -Condition {
        (Get-PortListenerPids -ListenerPidMap (Get-ListenerPidMap) -Port 3000).Count -eq 0
    }
}

function Start-FrontendWarmupJob {
    # Next.js compiles a route on its first request. Issuing that request in the
    # background lets the compile overlap with Supabase, Judge0 and FastAPI
    # startup instead of running after all of them.
    param(
        [Parameter(Mandatory)][string]$CommonPath,
        [Parameter(Mandatory)][string]$Uri,
        [int]$TimeoutSeconds = 180
    )

    return Start-ThreadJob -Name "frontend-warmup" -ScriptBlock {
        param($CommonPath, $Uri, $TimeoutSeconds)
        . $CommonPath
        $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
        while ((Get-Date) -lt $deadline) {
            # A single long request: Next holds the connection open while it
            # compiles, so this returns the moment the route is actually served.
            if (Test-HttpReady -Uri $Uri -TimeoutSeconds 120) { return $true }
            Start-Sleep -Milliseconds 400
        }
        return $false
    } -ArgumentList $CommonPath, $Uri, $TimeoutSeconds
}

if ($PSVersionTable.PSVersion.Major -lt 7) {
    throw "This launcher requires PowerShell 7 (pwsh.exe). Install it and run START-BYTEQUEST.bat again."
}

if (-not (Test-IsAdministrator) -and
    -not (Test-TcpPort -ComputerName '172.30.95.2' -Port 22 -TimeoutMilliseconds 1000)) {
    Write-Host "Requesting administrator access for Hyper-V management..."
    $scriptLiteral = ConvertTo-PowerShellLiteral -Value $PSCommandPath
    $vmNameLiteral = ConvertTo-PowerShellLiteral -Value $Judge0VmName
    $sshUserLiteral = ConvertTo-PowerShellLiteral -Value $Judge0SshUser
    $elevatedCommand = "& $scriptLiteral -Judge0VmName $vmNameLiteral -Judge0SshUser $sshUserLiteral"
    if ($ForceMigrate) { $elevatedCommand += " -ForceMigrate" }
    if ($PrepareOnly) { $elevatedCommand += " -PrepareOnly" }
    if ($Development) { $elevatedCommand += " -Development" }
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

try {
$script:CurrentPhase = 'Prerequisites'
$script:StartupClock = [System.Diagnostics.Stopwatch]::StartNew()
$script:PhaseTimings = [ordered]@{}
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendPath = Join-Path $repoRoot "backend"
$frontendPath = Join-Path $repoRoot "frontend"
$backendPython = Join-Path $backendPath ".venv\Scripts\python.exe"
$localSetupScript = Join-Path $PSScriptRoot "start-local.ps1"
$judge0ConfigScript = Join-Path $PSScriptRoot "configure-judge0-vm.ps1"
$backendEnvPath = Join-Path $backendPath ".env.local"
$frontendEnvPath = Join-Path $frontendPath ".env.local"
$logPath = Join-Path $repoRoot "logs"
New-Item -ItemType Directory -Path $logPath -Force | Out-Null
$backendStatePath = Join-Path $logPath '.launcher-backend-state.json'
$backendRuntime = $null
if (-not $Development -and (Test-Path -LiteralPath $backendStatePath -PathType Leaf)) {
    try { $backendRuntime = Get-Content -LiteralPath $backendStatePath -Raw | ConvertFrom-Json }
    catch { $backendRuntime = $null }
}
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
    $dockerExe = Get-DockerDesktopFile -RelativePath 'resources\bin\docker.exe'
    if ($dockerExe) {
        $env:PATH = "$(Split-Path -Parent $dockerExe);$env:PATH"
    }
}

$startupAuthRun = [guid]::NewGuid().ToString("N")
$frontendUrl = "http://127.0.0.1:3000/onboarding?startup_auth=1&startup_run=$startupAuthRun"

# ---------------------------------------------------------------------------
# Phase 1: everything that does not depend on anything else starts at once.
# The Judge0 VM (Hyper-V), the Docker engine and the Next.js dev server used to
# run strictly one after another even though none of them needs the others.
# ---------------------------------------------------------------------------
Write-Step "Start Judge0 VM, Docker and the frontend in parallel"
$phaseClock = [System.Diagnostics.Stopwatch]::StartNew()

$judge0ScriptBlock = {
    param($CommonPath, $VmName)

    $outcome = [ordered]@{ VmState = $null; Address = $null; PortOpen = $false; ErrorMessage = $null }
    try {
        . $CommonPath
        # The preparation step provisions this host-only address. It remains
        # reachable when the physical Wi-Fi adapter is off.
        if (Test-TcpPort -ComputerName '172.30.95.2' -Port 2358 -TimeoutMilliseconds 700) {
            $outcome.VmState = 'already-running'
            $outcome.Address = '172.30.95.2'
            $outcome.PortOpen = $true
            return [pscustomobject]$outcome
        }
        if (Test-TcpPort -ComputerName '172.30.95.2' -Port 22 -TimeoutMilliseconds 700) {
            $outcome.VmState = 'already-running'
            $outcome.Address = '172.30.95.2'
            return [pscustomobject]$outcome
        }

        $outcome.VmState = Start-OrResumeJudge0Vm -Name $VmName

        $deadline = (Get-Date).AddSeconds(45)
        while ($true) {
            $address = Get-Judge0VmIPv4 -Name $VmName
            if (-not $address) { $address = Get-Judge0VmIPv4FromNeighbor -Name $VmName }
            if ($address) { $outcome.Address = $address; break }
            if ((Get-Date) -ge $deadline) { break }
            Start-Sleep -Milliseconds 750
        }

        if ($outcome.Address) {
            $outcome.PortOpen = Test-TcpPort -ComputerName $outcome.Address -Port 2358
        }
    }
    catch {
        $outcome.ErrorMessage = $_.Exception.Message
    }
    return [pscustomobject]$outcome
}
$judge0Job = Start-ThreadJob -Name "judge0" -ScriptBlock $judge0ScriptBlock -ArgumentList $commonPath, $Judge0VmName

# The frontend is the slowest single item in startup (Next.js has to compile the
# route before it answers), so it goes up first and against the environment file
# from the previous run. If Supabase later picks a different API port the server
# is restarted below; in the common case the port is unchanged and the compile
# has been running the whole time.
$frontendStartedEarly = $false
$frontendWarmupJob = $null
$listenerPidMap = Get-ListenerPidMap
$frontendState = Get-FrontendListenerState -FrontendPath $frontendPath -ListenerPidMap $listenerPidMap
# Windows can omit a listener from its process table on battery. A responding
# ByteQuest page plus its local editor asset identifies the existing server.
if (-not $frontendState.IsByteQuest -and
    (Test-HttpReady -Uri $frontendUrl -TimeoutSeconds 3) -and
    (Test-HttpReady -Uri 'http://127.0.0.1:3000/monaco/vs/loader.js' -TimeoutSeconds 3)) {
    $frontendState.IsByteQuest = $true
    $frontendState.InUse = $true
}

if ($frontendState.InUse -and -not $frontendState.IsByteQuest) {
    throw "Port 3000 is already used by an external process ($($frontendState.Owners)). Stop the process using port 3000, then rerun this launcher. It did not terminate any process."
}

if ($frontendState.IsByteQuest) {
    Write-Host "This ByteQuest frontend already appears to be running on port 3000; reusing it."
    $frontendStartedEarly = $true
    $frontendWarmupJob = Start-FrontendWarmupJob -CommonPath $commonPath -Uri $frontendUrl
}
elseif ($Development -and -not [string]::IsNullOrWhiteSpace($previousFrontendApiUrl)) {
    Write-Host "Starting the Next.js dev server now so it compiles while Supabase and Judge0 come up."
    Start-FrontendProcess -FrontendPath $frontendPath -Development:$Development
    $frontendStartedEarly = $true
    $frontendWarmupJob = Start-FrontendWarmupJob -CommonPath $commonPath -Uri $frontendUrl
}
else {
    Write-Host "No previous frontend environment file; the dev server will start once Supabase has written one."
}

& docker.exe info *> $null
if ($LASTEXITCODE -ne 0) {
    $dockerDesktop = Get-DockerDesktopFile -RelativePath 'Docker Desktop.exe'
    if (-not $dockerDesktop) {
        throw "Docker Desktop application not found."
    }
    Start-Process -FilePath $dockerDesktop | Out-Null
    Write-Host "Docker Desktop is starting; waiting for its engine..."
    # The launcher used to continue immediately and fail inside start-local.ps1,
    # forcing a second run on any cold Docker start.
    $dockerReady = Wait-Until -TimeoutSeconds 180 -PollMilliseconds 1000 -Condition {
        & docker.exe info *> $null
        $LASTEXITCODE -eq 0
    }
    if (-not $dockerReady) {
        throw "The Docker engine did not become ready within 3 minutes. Open Docker Desktop, wait for it to report Running, then rerun this launcher."
    }
}
Add-PhaseTiming -Name "Parallel kickoff (Docker ready)" -Clock $phaseClock

# ---------------------------------------------------------------------------
# Phase 2: Supabase. Docker is confirmed up, so start-local.ps1 skips its own
# engine probe, and it now skips migrations/seed when nothing has changed.
# ---------------------------------------------------------------------------
Write-Step "Initialize local Supabase and write settings"
$phaseClock = [System.Diagnostics.Stopwatch]::StartNew()
$localSetupArguments = @{ DockerAlreadyVerified = $true }
if ($ForceMigrate) { $localSetupArguments["ForceMigrate"] = $true }
if ($backendRuntime) { $localSetupArguments["BackendRuntime"] = $backendRuntime }
& $localSetupScript @localSetupArguments

$frontendApiUrl = Read-EnvValue -Path $frontendEnvPath -Name "NEXT_PUBLIC_API_URL"
if ($frontendApiUrl -match '^http://(?:127\.0\.0\.1|localhost):(?<port>\d+)/api/v1/?$') {
    $apiPort = [int]$Matches.port
}
else {
    throw "Invalid local NEXT_PUBLIC_API_URL."
}
Add-PhaseTiming -Name "Supabase" -Clock $phaseClock

if (-not $Development) {
    Write-Step "Check the offline frontend build"
    $buildStatePath = Join-Path $logPath '.frontend-build-state.json'
    $fingerprint = Get-FrontendFingerprint -FrontendPath $frontendPath
    $builtFingerprint = $null
    if (Test-Path -LiteralPath $buildStatePath -PathType Leaf) {
        try { $builtFingerprint = (Get-Content -LiteralPath $buildStatePath -Raw | ConvertFrom-Json).Fingerprint }
        catch { $builtFingerprint = $null }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $frontendPath '.next/BUILD_ID')) -or
        $builtFingerprint -ne $fingerprint) {
        Write-Host "Building the frontend from local packages. This is needed after source or local settings change."
        # A running `next start` keeps serving the manifest it loaded, so after
        # the build replaces .next its pages point at deleted scripts and hang on
        # "Loading...". Stop it first; phase 3 starts a fresh one on the new build.
        if ($frontendWarmupJob) {
            Stop-Job -Job $frontendWarmupJob -ErrorAction SilentlyContinue
            Remove-Job -Job $frontendWarmupJob -Force -ErrorAction SilentlyContinue
            $frontendWarmupJob = $null
        }
        if (-not (Stop-ByteQuestFrontend -FrontendPath $frontendPath)) {
            throw "Port 3000 is still in use, so the rebuilt frontend could not replace the old one. Stop the process using port 3000, then rerun this launcher."
        }
        $frontendStartedEarly = $false
        $buildLog = Join-Path $logPath 'frontend-build.log'
        Push-Location $frontendPath
        try { & npm run build *> $buildLog; $buildExitCode = $LASTEXITCODE }
        finally { Pop-Location }
        if ($buildExitCode -ne 0) {
            throw "The frontend build failed. See logs/frontend-build.log. Run PREPARE-BYTEQUEST-OFFLINE.bat while connected if packages are missing."
        }
        [pscustomobject]@{ Fingerprint = $fingerprint; BuiltUtc = (Get-Date).ToUniversalTime().ToString('o') } |
            ConvertTo-Json | Set-Content -LiteralPath $buildStatePath -Encoding utf8
    }
}

# ---------------------------------------------------------------------------
# Phase 3: reconcile the frontend against the settings Supabase just wrote.
# ---------------------------------------------------------------------------
$phaseClock = [System.Diagnostics.Stopwatch]::StartNew()
if (-not $frontendStartedEarly) {
    Write-Step "Start the Next.js frontend"
    # A server that was not recognised in phase 1 would make this start fail with
    # EADDRINUSE while the old server kept answering on the port.
    if (-not (Stop-ByteQuestFrontend -FrontendPath $frontendPath)) {
        throw "Port 3000 is already used by another process. Stop the process using port 3000, then rerun this launcher."
    }
    Start-FrontendProcess -FrontendPath $frontendPath -Development:$Development
    $frontendWarmupJob = Start-FrontendWarmupJob -CommonPath $commonPath -Uri $frontendUrl
}
elseif ($previousFrontendApiUrl -and $frontendApiUrl -and $previousFrontendApiUrl -ne $frontendApiUrl) {
    Write-Step "Restart the frontend for its new API address"
    Write-Host "The frontend was running against $previousFrontendApiUrl; it is now $frontendApiUrl."
    if ($frontendWarmupJob) {
        Stop-Job -Job $frontendWarmupJob -ErrorAction SilentlyContinue
        Remove-Job -Job $frontendWarmupJob -Force -ErrorAction SilentlyContinue
    }
    $null = Stop-ByteQuestFrontend -FrontendPath $frontendPath
    Start-FrontendProcess -FrontendPath $frontendPath -Development:$Development
    $frontendWarmupJob = Start-FrontendWarmupJob -CommonPath $commonPath -Uri $frontendUrl
}
Add-PhaseTiming -Name "Frontend reconcile" -Clock $phaseClock

# ---------------------------------------------------------------------------
# Phase 4: collect the Judge0 result. On a warm machine this job finished long
# ago, so the join is free; the interactive and SSH recovery paths stay on the
# main thread where they can prompt.
# ---------------------------------------------------------------------------
Write-Step "Resolve Judge0 VM address and endpoint"
$phaseClock = [System.Diagnostics.Stopwatch]::StartNew()
$judge0Outcome = Receive-Job -Job $judge0Job -Wait -AutoRemoveJob
if ($null -eq $judge0Outcome -or $judge0Outcome.ErrorMessage) {
    # Hyper-V is the one part of startup that has to work from a background
    # thread. If it did not, repeat the same work inline before giving up, so a
    # thread-specific quirk degrades to the old sequential behaviour instead of
    # failing the launcher.
    Write-Warning "Judge0 VM check did not complete in the background; retrying inline."
    $judge0Outcome = & $judge0ScriptBlock $commonPath $Judge0VmName
}
if ($judge0Outcome.ErrorMessage) {
    throw $judge0Outcome.ErrorMessage
}
if ($judge0Outcome.VmState -eq "already-running") {
    Write-Host "Judge0 VM '$Judge0VmName' was already running."
}
else {
    Write-Host "Judge0 VM '$Judge0VmName' is running."
}

$guestIPv4 = $judge0Outcome.Address
if (-not $guestIPv4) {
    $guestIPv4 = Read-Judge0VmIPv4FromConsole -Name $Judge0VmName
}

$judge0Url = "http://$guestIPv4`:2358"
$judge0PortOpen = $judge0Outcome.PortOpen
if ($PrepareOnly) {
    # The host-only link must be configured even when Judge0's containers are
    # stopped. SSH on the guest is enough to install the link.
    & (Join-Path $PSScriptRoot 'setup-judge0-offline-network.ps1') `
        -VmName $Judge0VmName -SshUser $Judge0SshUser -CurrentIp $guestIPv4
    $guestIPv4 = '172.30.95.2'
    $judge0Url = "http://$guestIPv4`:2358"
    $judge0PortOpen = Test-TcpPort -ComputerName $guestIPv4 -Port 2358
}
if (-not $judge0PortOpen) {
    $judge0PortOpen = Test-TcpPort -ComputerName $guestIPv4 -Port 2358
}
if (-not $judge0PortOpen) {
    if (Test-TcpPort -ComputerName $guestIPv4 -Port 22) {
        $sshCommand = Get-Command ssh.exe -ErrorAction SilentlyContinue
        if ($sshCommand) {
            Write-Host "Judge0 is not answering on 2358; asking the VM to bring its containers up."
            & $sshCommand.Source -tt "$Judge0SshUser@$guestIPv4" "cd ~/judge0-v1.13.1-extra && sudo docker compose up -d"
        }
    }
    $judge0PortOpen = Wait-Until -TimeoutSeconds 150 -PollMilliseconds 1000 -Condition {
        Test-TcpPort -ComputerName $guestIPv4 -Port 2358 -TimeoutMilliseconds 800
    }
}

if ($judge0PortOpen -and -not $PrepareOnly) {
    if (-not (Test-TcpPort -ComputerName '172.30.95.2' -Port 2358)) {
        throw 'Judge0 is running, but its Wi-Fi-independent host-only link is unavailable. Run PREPARE-BYTEQUEST-OFFLINE.bat while connected.'
    }
    $guestIPv4 = '172.30.95.2'
    $judge0Url = "http://$guestIPv4`:2358"
}

if ($judge0PortOpen) {
    # Writes JUDGE0_BASE_URL into backend/.env.local, so it must land before
    # Uvicorn reads its environment below.
    & $judge0ConfigScript -BaseUrl $judge0Url
}
else {
    throw "Judge0 is not reachable at $judge0Url. Open the VM console, check its containers, then run PREPARE-BYTEQUEST-OFFLINE.bat."
}
$judge0Token = Read-EnvValue -Path $backendEnvPath -Name 'JUDGE0_API_KEY'
if (-not $judge0Token -or -not (Test-Judge0Languages -BaseUrl $judge0Url -ApiToken $judge0Token)) {
    throw "Judge0 did not return the Python, C++, and Java runtimes. Check the VM containers and its saved API token."
}
Write-Host "Judge0 is ready with Python, C++, and Java runtimes."
Add-PhaseTiming -Name "Judge0" -Clock $phaseClock

# ---------------------------------------------------------------------------
# Phase 5: FastAPI and the grading worker, started together.
# ---------------------------------------------------------------------------
Write-Step "Check FastAPI and the grading worker"
$phaseClock = [System.Diagnostics.Stopwatch]::StartNew()

$apiHealthUrl = "http://127.0.0.1:$apiPort/readyz"
$backendFingerprint = if (-not $Development) { Get-BackendFingerprint -RepoRoot $repoRoot }
$canReuseBackend = $backendRuntime -and $backendRuntime.ApiPort -eq $apiPort -and
    $backendRuntime.Fingerprint -eq $backendFingerprint -and
    (Test-LocalBackendProcesses -State $backendRuntime -ListenerPidMap (Get-ListenerPidMap)) -and
    (Test-HttpReady -Uri $apiHealthUrl -TimeoutSeconds 2)
if ($canReuseBackend) {
    Write-Host 'FastAPI and the grading worker are already running with the current code and settings.'
}
else {
    Write-Host 'Starting FastAPI and the grading worker.'
    $existingApis = @(Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match "(?i)(?:-m\s+)?uvicorn\s+app\.main:app.*--port\s+$apiPort(?:\s|$)" })
    foreach ($existingApi in $existingApis) {
        Stop-Process -Id $existingApi.ProcessId -Force -ErrorAction SilentlyContinue
    }
    $apiPortFree = Wait-Until -TimeoutSeconds 10 -PollMilliseconds 250 -Condition {
        -not (Test-TcpPort -ComputerName '127.0.0.1' -Port $apiPort -TimeoutMilliseconds 300)
    }
    if (-not $apiPortFree) {
        throw "Port $apiPort is still held by a process the launcher could not stop (it may be running as administrator). Close it and run the launcher again, or it would keep serving old backend code."
    }

    $apiArguments = @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', "$apiPort")
    if ($Development) { $apiArguments += '--reload' }
    $apiProcess = Start-Process -FilePath $backendPython -WorkingDirectory $backendPath -WindowStyle Hidden -PassThru `
        -ArgumentList $apiArguments `
        -RedirectStandardOutput (Join-Path $logPath 'api.log') `
        -RedirectStandardError (Join-Path $logPath 'api.err.log')

    New-Item -ItemType Directory -Path $logPath -Force | Out-Null
    # Stop the supervisor before its worker, or it would restart the one just killed.
    $workerSupervisorScript = Join-Path $PSScriptRoot 'run-grading-worker.ps1'
    $existingSupervisors = @(Get-CimInstance Win32_Process -Filter "Name = 'pwsh.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match '(?i)run-grading-worker\.ps1' })
    foreach ($existingSupervisor in $existingSupervisors) {
        Stop-Process -Id $existingSupervisor.ProcessId -Force -ErrorAction SilentlyContinue
    }
    $existingWorkers = @(Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            $_.ExecutablePath -eq $backendPython -and
            $_.CommandLine -match '(?i)-m\s+app\.services\.submission_worker(?:\s|$)'
        })
    foreach ($existingWorker in $existingWorkers) {
        Stop-Process -Id $existingWorker.ProcessId -Force -ErrorAction SilentlyContinue
    }

    # The worker runs under a supervisor that restarts it if it dies. Without one, a
    # crashed worker left every submission queued and the student on an endless spinner.
    $worker = Start-Process -FilePath (Get-Command pwsh.exe -ErrorAction Stop).Source `
        -ArgumentList @(
            "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $workerSupervisorScript,
            "-Python", $backendPython,
            "-WorkingDirectory", $backendPath,
            "-OutLog", (Join-Path $logPath "submission-worker.log"),
            "-ErrorLog", (Join-Path $logPath "submission-worker.err.log")
        ) `
        -WorkingDirectory $backendPath -WindowStyle Hidden -PassThru

    # Quarter-second polling: Uvicorn's import of the router tree finishes on no
    # particular boundary, and the old two-second sleep rounded every start up.
    $apiReady = Wait-Until -TimeoutSeconds 60 -PollMilliseconds 250 -Condition {
        Test-HttpReady -Uri $apiHealthUrl -TimeoutSeconds 2
    }
    if (-not $apiReady) {
        throw "FastAPI or the local database did not become ready within 60 seconds. Check logs/api.err.log and logs/startup-diagnostics.log."
    }

    if ($worker.HasExited) {
        throw "The grading worker exited during startup. Check logs/submission-worker.err.log."
    }
    # The supervisor is alive; confirm it actually got a worker running underneath it,
    # so a worker that cannot start at all still fails startup instead of looping quietly.
    $workerRunning = Wait-Until -TimeoutSeconds 30 -PollMilliseconds 500 -Condition {
        [bool](Get-CimInstance Win32_Process -Filter "ParentProcessId = $($worker.Id) AND Name = 'python.exe'" -ErrorAction SilentlyContinue)
    }
    if (-not $workerRunning) {
        throw "The grading worker did not stay running. Check logs/submission-worker.err.log."
    }
    Write-Host "Grading worker started cleanly and is supervised (supervisor PID $($worker.Id))."
    if ($backendFingerprint) {
        $apiPids = Get-PortListenerPids -ListenerPidMap (Get-ListenerPidMap) -Port $apiPort
        $processes = Get-ProcessDetailMap -ProcessIds (@($apiPids) + @($worker.Id))
        $listener = $processes.Values | Where-Object {
            $_.ProcessId -in $apiPids -and
            ($_.ProcessId -eq $apiProcess.Id -or $_.ParentProcessId -eq $apiProcess.Id)
        } | Select-Object -First 1
        $supervisor = Get-ProcessDetail -DetailMap $processes -ProcessId $worker.Id
        if ($listener.StartedUtcTicks -and $supervisor.StartedUtcTicks) {
            [pscustomobject]@{
                Fingerprint = $backendFingerprint
                ApiPort = $apiPort
                ApiPid = $listener.ProcessId
                ApiStartedUtcTicks = $listener.StartedUtcTicks
                SupervisorPid = $supervisor.ProcessId
                SupervisorStartedUtcTicks = $supervisor.StartedUtcTicks
            } | ConvertTo-Json | Set-Content -LiteralPath $backendStatePath -Encoding utf8
        }
    }
}
Add-PhaseTiming -Name "FastAPI + worker" -Clock $phaseClock

# ---------------------------------------------------------------------------
# Phase 6: the frontend has been compiling since phase 1; collect it.
# ---------------------------------------------------------------------------
Write-Step "Wait for the frontend"
$phaseClock = [System.Diagnostics.Stopwatch]::StartNew()
$frontendReady = $false
if ($frontendWarmupJob) {
    $frontendReady = [bool](Receive-Job -Job $frontendWarmupJob -Wait -AutoRemoveJob)
}
if (-not $frontendReady) {
    $frontendReady = Wait-Until -TimeoutSeconds 90 -PollMilliseconds 500 -Condition {
        Test-HttpReady -Uri $frontendUrl -TimeoutSeconds 10
    }
}
if (-not $frontendReady) {
    throw "The frontend did not answer at $frontendUrl within its startup window. Check logs/frontend.err.log and rerun this launcher after resolving its error."
}
Write-Host "The frontend is responding at http://127.0.0.1:3000."
if (-not (Test-HttpReady -Uri 'http://127.0.0.1:3000/monaco/vs/loader.js' -TimeoutSeconds 5)) {
    throw 'The local Monaco editor assets are missing. See logs/frontend-build.log and rerun offline preparation.'
}
# Answering is not enough: the page's scripts must load too, or every screen
# stays on "Loading...". Whatever caused a mismatch, one fresh server fixes it.
if (-not (Test-FrontendAssets -Uri $frontendUrl)) {
    Write-Host "The frontend answered, but its page scripts did not load. Restarting it on the current build."
    if (-not (Stop-ByteQuestFrontend -FrontendPath $frontendPath)) {
        throw "Port 3000 is held by a process this launcher cannot restart. Stop the process using port 3000, then rerun this launcher."
    }
    Start-FrontendProcess -FrontendPath $frontendPath -Development:$Development
    $assetsReady = Wait-Until -TimeoutSeconds 120 -PollMilliseconds 1000 -Condition {
        Test-FrontendAssets -Uri $frontendUrl -TimeoutSeconds 60
    }
    if (-not $assetsReady) {
        throw "The frontend page loads but its scripts are missing. Check logs/frontend.err.log and logs/frontend-build.log, then rerun this launcher."
    }
}
Add-PhaseTiming -Name "Frontend ready" -Clock $phaseClock

if ($PrepareOnly) {
    Write-Step 'Check local accounts and published learning content'
    Push-Location $backendPath
    try { & $backendPython -m scripts.check_offline_readiness; $contentExitCode = $LASTEXITCODE }
    finally { Pop-Location }
    if ($contentExitCode -ne 0) {
        throw 'Local learning content check failed. Publish at least one activity to this laptop before offline use.'
    }
}

Write-Step 'Check grading end to end'
# The same checks as Admin > Monitoring, including one real Judge0 run. A failure here warns
# instead of stopping, because some (an exam waiting for a grading retry) are admin work, not a broken stack.
Push-Location $backendPath
try { & $backendPython -m scripts.check_stack_health --judge0; $stackExitCode = $LASTEXITCODE }
finally { Pop-Location }
if ($stackExitCode -ne 0) {
    Write-Host 'ByteQuest started, but a grading check failed (see above). Open Admin > Monitoring before class.' -ForegroundColor Red
}

Write-Step "ByteQuest is ready"
foreach ($phase in $script:PhaseTimings.Keys) {
    Write-Host ("  {0,-32} {1,6:N1}s" -f $phase, $script:PhaseTimings[$phase])
}
Write-Host ("  {0,-32} {1,6:N1}s" -f "TOTAL", $script:StartupClock.Elapsed.TotalSeconds) -ForegroundColor Green
if ($PrepareOnly) {
    Write-Host "Offline preparation passed. Local services and the frontend build are ready."
}
else {
    Start-Process $frontendUrl | Out-Null
}
}
catch {
    $failureLog = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')).Path 'logs/startup-diagnostics.log'
    New-Item -ItemType Directory -Path (Split-Path -Parent $failureLog) -Force | Out-Null
    Add-Content -LiteralPath $failureLog -Value "$(Get-Date -Format o) | $script:CurrentPhase | $($_.Exception.Message)"
    Write-Host "ByteQuest stopped during '$script:CurrentPhase'. See logs/startup-diagnostics.log." -ForegroundColor Red
    throw
}
