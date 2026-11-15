[CmdletBinding()]
param(
    # Set by start-bytequest.ps1, which has already confirmed the engine is up.
    [Parameter()]
    [switch]$DockerAlreadyVerified,

    # Re-run migrations and the seed even when nothing has changed.
    [Parameter()]
    [switch]$ForceMigrate
)

$ErrorActionPreference = "Stop"
# PowerShell 7 can promote native-command stderr to terminating errors when
# ErrorActionPreference is Stop. Docker and Supabase use stderr for progress.
$PSNativeCommandUseErrorActionPreference = $false

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$commonPath = Join-Path $PSScriptRoot "launcher-common.ps1"
if (-not (Test-Path -LiteralPath $commonPath -PathType Leaf)) {
    throw "Missing $commonPath. Restore it from source control before running this script."
}
. $commonPath

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    $dockerSearchPaths = @(
        (Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin"),
        (Join-Path $env:ProgramFiles "Docker\Docker\resources\bin")
    )
    $dockerCliDirectory = $dockerSearchPaths |
        Where-Object { Test-Path (Join-Path $_ "docker.exe") } |
        Select-Object -First 1

    if ($dockerCliDirectory) {
        $env:PATH = "$dockerCliDirectory;$env:PATH"
    }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker Desktop CLI was not found. Start Docker Desktop and ensure docker.exe is installed."
}

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    throw "Supabase CLI was not found on PATH. Install it before running local setup."
}
$supabaseVersion = (& supabase --version | Select-Object -First 1).Trim()
if ($supabaseVersion -notmatch '^2\.') {
    throw "ByteQuest local startup requires Supabase CLI v2; found '$supabaseVersion'. CLI v3 rejects this project's [inbucket] configuration. Install v2 before offline preparation."
}

# 'docker info' costs a round trip to the engine. The launcher already made that
# call before invoking this script, so repeating it only adds latency.
if (-not $DockerAlreadyVerified) {
    & docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Desktop is not ready. Wait for its engine to start, then rerun this script."
    }
}

# Supabase container names are supabase_<service>_<projectId>. Only these
# services are required for the app to run; everything else (the analytics log
# collector/vector, edge runtime, imgproxy, pooler) is optional and must never
# abort the launcher if it is slow or unhealthy.
$projectId = "bytequest-local"
$essentialServices = @("db", "kong", "auth", "rest", "storage")

function Get-ByteQuestServiceState {
    # Single docker call; returns @{ <service> = @{ State; Status } } for this
    # project, so readiness checks never fan out into one call per container.
    param([Parameter(Mandatory)][string]$ProjectId)
    $states = @{}
    $escaped = [regex]::Escape($ProjectId)
    foreach ($line in (& docker ps -a --filter "name=_$ProjectId" --format '{{.Names}}|{{.State}}|{{.Status}}' 2>$null)) {
        $parts = $line -split '\|', 3
        if ($parts.Count -ge 2 -and $parts[0] -match "^supabase_(?<svc>.+)_$escaped$") {
            $states[$Matches.svc] = [pscustomobject]@{ State = $parts[1]; Status = $parts[2] }
        }
    }
    return $states
}

function Test-ByteQuestServiceUp {
    param($ServiceState)
    return ($null -ne $ServiceState -and
        $ServiceState.State -eq "running" -and
        $ServiceState.Status -notmatch "unhealthy|Restarting")
}

function Invoke-SupabaseStatusEnv {
    # The CLI withholds its env block while ANY enabled service is unhealthy,
    # and its stderr is the only explanation for a blank read. Keep stderr off
    # the terminal (stdout carries local signing keys) but retain it for the
    # diagnostic thrown below.
    $stderrPath = Join-Path ([System.IO.Path]::GetTempPath()) ("bytequest-status-" + [guid]::NewGuid().ToString("N") + ".log")
    try {
        $lines = & cmd.exe /d /c "supabase status --output env 2>`"$stderrPath`""
        $exitCode = $LASTEXITCODE
        $stderrText = ""
        if (Test-Path -LiteralPath $stderrPath) {
            $stderrText = ([System.IO.File]::ReadAllText($stderrPath)).Trim()
        }
        return [pscustomobject]@{ Lines = @($lines); ExitCode = $exitCode; StdErr = $stderrText }
    }
    finally {
        Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
    }
}

function Get-ByteQuestContainerSetting {
    param(
        [Parameter(Mandatory)][string]$Container,
        [Parameter(Mandatory)][string[]]$Names
    )
    foreach ($name in $Names) {
        $value = (& docker exec $Container printenv $name 2>$null | Select-Object -First 1)
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value.Trim()
        }
    }
    return $null
}

function Get-ByteQuestPublishedPort {
    param(
        [Parameter(Mandatory)][string]$Container,
        [Parameter(Mandatory)][int]$ContainerPort
    )
    foreach ($line in (& docker port $Container $ContainerPort 2>$null)) {
        if ($line -match ':(?<port>\d+)\s*$') {
            return [int]$Matches.port
        }
    }
    return $null
}

function Add-ByteQuestFallbackValues {
    # Authoritative values read straight from the running containers, used only
    # when 'supabase status' stays silent. Nothing is guessed: anything that
    # cannot be read is left absent so validation still fails loudly.
    param(
        [Parameter(Mandatory)][hashtable]$Values,
        [Parameter(Mandatory)][string]$ProjectId
    )
    $kong = "supabase_kong_$ProjectId"
    $auth = "supabase_auth_$ProjectId"
    $db = "supabase_db_$ProjectId"

    if ([string]::IsNullOrWhiteSpace($Values["API_URL"])) {
        $apiPort = Get-ByteQuestPublishedPort -Container $kong -ContainerPort 8000
        if ($null -ne $apiPort) { $Values["API_URL"] = "http://127.0.0.1:$apiPort" }
    }
    if ([string]::IsNullOrWhiteSpace($Values["DB_URL"])) {
        $dbPort = Get-ByteQuestPublishedPort -Container $db -ContainerPort 5432
        if ($null -ne $dbPort) { $Values["DB_URL"] = "postgresql://postgres:postgres@127.0.0.1:$dbPort/postgres" }
    }
    if ([string]::IsNullOrWhiteSpace($Values["JWT_SECRET"])) {
        $jwtSecret = Get-ByteQuestContainerSetting -Container $auth -Names @("GOTRUE_JWT_SECRET")
        if ($jwtSecret) { $Values["JWT_SECRET"] = $jwtSecret }
    }
    if ([string]::IsNullOrWhiteSpace($Values["ANON_KEY"])) {
        $anonKey = Get-ByteQuestContainerSetting -Container $kong -Names @("SUPABASE_ANON_KEY", "ANON_KEY")
        if ($anonKey) { $Values["ANON_KEY"] = $anonKey }
    }
    if ([string]::IsNullOrWhiteSpace($Values["SERVICE_ROLE_KEY"])) {
        $serviceRoleKey = Get-ByteQuestContainerSetting -Container $kong -Names @("SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY")
        if ($serviceRoleKey) { $Values["SERVICE_ROLE_KEY"] = $serviceRoleKey }
    }
}

function Get-ByteQuestSchemaFingerprint {
    # Identifies "the same migrations and seed, applied to the same database
    # container". Migrations are idempotent but not free: pushing them and
    # replaying the seed on every launch costs several seconds for no change.
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][string]$ProjectId
    )

    $parts = [System.Collections.Generic.List[string]]::new()
    $migrationsPath = Join-Path $RepoRoot "supabase/migrations"
    if (Test-Path -LiteralPath $migrationsPath -PathType Container) {
        foreach ($file in (Get-ChildItem -LiteralPath $migrationsPath -Filter *.sql -File | Sort-Object Name)) {
            $parts.Add("$($file.Name):$($file.Length):$($file.LastWriteTimeUtc.Ticks)")
        }
    }
    $seedPath = Join-Path $RepoRoot "supabase/seed.sql"
    if (Test-Path -LiteralPath $seedPath -PathType Leaf) {
        $seedItem = Get-Item -LiteralPath $seedPath
        $parts.Add("seed.sql:$($seedItem.Length):$($seedItem.LastWriteTimeUtc.Ticks)")
    }

    # A recreated database container may mean a fresh volume, so its identity is
    # part of the fingerprint: a new container always re-migrates and re-seeds.
    $containerId = (& docker inspect --format '{{.Id}}' "supabase_db_$ProjectId" 2>$null | Select-Object -First 1)
    $parts.Add("db:$containerId")

    $hasher = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes(($parts -join "|"))
        return [System.BitConverter]::ToString($hasher.ComputeHash($bytes)).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $hasher.Dispose()
    }
}

$statusResult = Invoke-SupabaseStatusEnv
$statusLines = $statusResult.Lines
$firstStatusOk = ($statusResult.ExitCode -eq 0)
if ($firstStatusOk -and (
    $null -eq (Get-ByteQuestPublishedPort -Container "supabase_db_$projectId" -ContainerPort 5432) -or
    $null -eq (Get-ByteQuestPublishedPort -Container "supabase_kong_$projectId" -ContainerPort 8000))) {
    Write-Output "Supabase containers lost their host port mappings; recreating the local stack."
    & supabase stop --project-id $projectId *> $null
    if ($LASTEXITCODE -ne 0) { throw "Could not stop the broken local Supabase stack." }
    $firstStatusOk = $false
}
if ($firstStatusOk) {
    Write-Output "Local Supabase is already running; reusing its containers."
    $startReportedFailure = $false
}
else {
    # Supabase prints its local signing keys during startup, so suppress that
    # output rather than storing it in a transcript or terminal scrollback.
    Write-Output "Local Supabase is stopped; starting its containers. A cold Docker start can take a few minutes."
    # Studio, Realtime, local mail UI and image transforms are not needed for
    # local learning. Keep Storage for existing lesson files and avatars.
    & cmd.exe /d /c 'supabase start --exclude realtime,studio,inbucket,imgproxy,meta,vector,edge-runtime,functions,analytics >NUL 2>&1'
    # A non-zero exit here is often a single optional service; it is recorded
    # but not treated as fatal until the essential services are checked below.
    $startReportedFailure = ($LASTEXITCODE -ne 0)
}

# Wait only for the essential services, polling cheaply and breaking the moment
# they are up, so a healthy stack adds no measurable delay to startup.
$readyDeadline = (Get-Date).AddSeconds(90)
$serviceState = $null
$essentialReady = $false
while ($true) {
    $serviceState = Get-ByteQuestServiceState -ProjectId $projectId
    $essentialReady = $true
    foreach ($svc in $essentialServices) {
        if (-not (Test-ByteQuestServiceUp $serviceState[$svc])) {
            $essentialReady = $false
            break
        }
    }
    if ($essentialReady -or (Get-Date) -ge $readyDeadline) {
        break
    }
    Start-Sleep -Milliseconds 600
}

if (-not $essentialReady) {
    $down = @(foreach ($svc in $essentialServices) { if (-not (Test-ByteQuestServiceUp $serviceState[$svc])) { $svc } })
    $diagnosticPath = Join-Path $repoRoot "logs/startup-diagnostics.log"
    New-Item -ItemType Directory -Path (Split-Path -Parent $diagnosticPath) -Force | Out-Null
    @("Supabase startup failed at $(Get-Date -Format o)", "Unhealthy services: $($down -join ', ')") |
        Set-Content -LiteralPath $diagnosticPath
    foreach ($svc in $down) {
        $container = "supabase_$($svc)_$projectId"
        Add-Content -LiteralPath $diagnosticPath -Value "`n[$container]"
        & docker logs --tail 40 $container 2>&1 | Add-Content -LiteralPath $diagnosticPath
    }
    throw "Essential Supabase services did not become healthy ($($down -join ', ')). See logs/startup-diagnostics.log."
}

# Essential stack is up. Report any degraded optional services as a warning
# rather than aborting, and only then surface a non-zero 'supabase start' exit.
$degradedServices = @(
    foreach ($svc in ($serviceState.Keys | Sort-Object)) {
        if ($essentialServices -notcontains $svc -and -not (Test-ByteQuestServiceUp $serviceState[$svc])) {
            $svc
        }
    }
)
if ($degradedServices.Count -gt 0) {
    Write-Warning "Optional Supabase services are degraded; startup continues without them: $($degradedServices -join ', '). Inspect with 'docker logs supabase_<service>_$projectId'."
}
elseif ($startReportedFailure) {
    Write-Warning "'supabase start' returned a non-zero exit, but all essential services are healthy; continuing."
}

# Re-read status only if the first read failed (i.e. we just started the stack).
# The exit code is intentionally not gated: when an optional service is down the
# CLI can report non-zero even though the endpoints we need respond, so the
# required-key validation below is the authoritative readiness check.
if (-not $firstStatusOk) {
    $statusResult = Invoke-SupabaseStatusEnv
    $statusLines = $statusResult.Lines
}

$localValues = @{}
foreach ($line in $statusLines) {
    if ($line -match '^([A-Z0-9_]+)=(.*)$') {
        $value = $Matches[2].Trim()
        if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $localValues[$Matches[1]] = $value
    }
}

$requiredSettings = @("API_URL", "DB_URL", "JWT_SECRET", "ANON_KEY", "SERVICE_ROLE_KEY")
$missingSettings = @(
    foreach ($required in $requiredSettings) {
        if (-not $localValues.ContainsKey($required) -or [string]::IsNullOrWhiteSpace($localValues[$required])) { $required }
    }
)

if ($missingSettings.Count -gt 0) {
    # A degraded optional service makes the CLI withhold every value, including
    # those for services that are healthy. Read them from the containers rather
    # than aborting a stack whose essential services were just confirmed up.
    Add-ByteQuestFallbackValues -Values $localValues -ProjectId $projectId
    $missingSettings = @(
        foreach ($required in $requiredSettings) {
            if (-not $localValues.ContainsKey($required) -or [string]::IsNullOrWhiteSpace($localValues[$required])) { $required }
        }
    )
}

if ($missingSettings.Count -gt 0) {
    $detail = "Supabase did not return required local settings ($($missingSettings -join ', ')), and they could not be read from the running containers."
    if ($degradedServices.Count -gt 0) {
        $detail += " Degraded optional services ($($degradedServices -join ', ')) stop the CLI reporting status at all; disable them in supabase/config.toml or repair them."
    }
    if (-not [string]::IsNullOrWhiteSpace($statusResult.StdErr)) {
        $detail += " 'supabase status' reported: $($statusResult.StdErr)"
    }
    throw $detail
}

if ($localValues.API_URL -notmatch '^http://(127\.0\.0\.1|localhost):15431$' -or
    $localValues.DB_URL -notmatch '^postgres(ql)?://[^@]+@(127\.0\.0\.1|localhost):15432/') {
    throw "Supabase returned a non-local endpoint; refusing to write local configuration."
}

# Migrations and seed data are idempotent, so the only question is whether
# anything changed since the last successful start. When nothing has, both are
# skipped; '-ForceMigrate' re-runs them on demand.
$statePath = Join-Path $repoRoot "logs/.launcher-supabase-state.json"
$schemaFingerprint = Get-ByteQuestSchemaFingerprint -RepoRoot $repoRoot -ProjectId $projectId
$lastFingerprint = $null
if (Test-Path -LiteralPath $statePath -PathType Leaf) {
    try {
        $lastFingerprint = (Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json).SchemaFingerprint
    }
    catch {
        $lastFingerprint = $null
    }
}

if ($ForceMigrate -or $schemaFingerprint -ne $lastFingerprint) {
    # Existing local databases need new migrations too. --local prevents a linked
    # cloud project from being changed, and output is kept out of startup logs.
    & supabase db push --local --yes *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Local database migrations failed. Run 'supabase db push --local' for diagnostics."
    }

    $seedPath = Join-Path $repoRoot "supabase/seed.sql"
    $seedSql = [System.IO.File]::ReadAllText($seedPath)
    Write-Output "Applying idempotent local seed data without resetting existing records..."
    $seedSql | & docker exec -i "supabase_db_$projectId" psql -v ON_ERROR_STOP=1 -U postgres -d postgres *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Could not apply local seed data to supabase_db_$projectId. Check Docker and Supabase status."
    }

    New-Item -ItemType Directory -Path (Split-Path -Parent $statePath) -Force | Out-Null
    [pscustomobject]@{
        SchemaFingerprint = $schemaFingerprint
        AppliedUtc        = (Get-Date).ToUniversalTime().ToString("o")
    } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
    Write-Output "Local migrations are current and idempotent seed data has been applied without resetting existing records."
}
else {
    Write-Output "Migrations and seed data are unchanged since the last successful start; skipping both. Use -ForceMigrate to re-apply."
}

$backendEnvPath = Join-Path $repoRoot "backend/.env.local"
$backendSettings = [ordered]@{}
if (Test-Path -LiteralPath $backendEnvPath -PathType Leaf) {
    foreach ($line in [System.IO.File]::ReadAllLines($backendEnvPath)) {
        if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            $backendSettings[$Matches[1]] = $Matches[2]
        }
    }
}

# Preserve VM credentials and optional backend settings (such as Gemini API
# credentials) while forcing database/auth endpoints to the local Supabase.
if ([string]::IsNullOrWhiteSpace($backendSettings["JUDGE0_BASE_URL"])) {
    $backendSettings["JUDGE0_BASE_URL"] = "http://172.20.66.12:2358"
}
if (-not $backendSettings.Contains("JUDGE0_API_KEY")) {
    $backendSettings["JUDGE0_API_KEY"] = ""
}
$backendSettings["DATABASE_URL"] = $localValues.DB_URL
$backendSettings["SUPABASE_URL"] = $localValues.API_URL
$backendSettings["SUPABASE_JWT_SECRET"] = $localValues.JWT_SECRET
$backendSettings["SUPABASE_ANON_KEY"] = $localValues.ANON_KEY
$backendSettings["SUPABASE_SERVICE_ROLE_KEY"] = $localValues.SERVICE_ROLE_KEY
$backendSettings["SUPABASE_SECRET_KEY"] = ""
# Also allow this PC's private ZeroTier address, so the app opened through
# infra/start-zerotier-relay.ps1 (from a phone on the same ZeroTier network) can call the API.
$corsOrigins = @("http://localhost:3000", "http://127.0.0.1:3000")
$zeroTierAddresses = @(Get-NetAdapter -ErrorAction SilentlyContinue |
    Where-Object { $_.InterfaceDescription -like "ZeroTier*" -and $_.Status -eq "Up" } |
    ForEach-Object { Get-NetIPAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue } |
    ForEach-Object { $_.IPAddress })
foreach ($address in $zeroTierAddresses) { $corsOrigins += "http://${address}:3000" }
$backendSettings["CORS_ORIGINS"] = "[" + (($corsOrigins | ForEach-Object { '"' + $_ + '"' }) -join ",") + "]"
$backendEnv = foreach ($key in $backendSettings.Keys) {
    "$key=$($backendSettings[$key])"
}

$frontendEnvPath = Join-Path $repoRoot "frontend/.env.local"
$preferredApiPort = $null
if (Test-Path -LiteralPath $frontendEnvPath -PathType Leaf) {
    foreach ($line in [System.IO.File]::ReadAllLines($frontendEnvPath)) {
        if ($line -match '^NEXT_PUBLIC_API_URL=http://(?:127\.0\.0\.1|localhost):(?<port>\d+)/api/v1/?$') {
            $candidatePort = [int]$Matches.port
            if ($candidatePort -ge 8000 -and $candidatePort -le 8010) {
                $preferredApiPort = $candidatePort
            }
            break
        }
    }
}

# One snapshot of every listening socket, then one process query for the few
# PIDs that matter. The previous version issued a separate Get-NetTCPConnection
# for each of the eleven candidate ports and a separate CIM query per PID.
$listenerPidMap = Get-ListenerPidMap

$apiCandidates = @()
if ($null -ne $preferredApiPort) {
    $apiCandidates += $preferredApiPort
}
$apiCandidates += 8000..8010
$apiCandidates = @($apiCandidates | Select-Object -Unique)

# Select-LocalApiPort reads the listener map only through Get-PortListenerPids,
# so a candidate port with no listener is an empty result rather than the
# @($null) that used to be used as a hashtable key.
$apiPort = $null
foreach ($candidatePort in $apiCandidates) {
    $mappedPort = Select-LocalApiPort -ListenerPidMap $listenerPidMap -CandidatePorts @($candidatePort)
    if ($null -eq $mappedPort) { continue }
    if (Test-TcpPort -ComputerName '127.0.0.1' -Port $candidatePort -TimeoutMilliseconds 500) {
        $servesByteQuest = (Test-HttpReady -Uri "http://127.0.0.1:$candidatePort/readyz" -TimeoutSeconds 2) -and
            (@(Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" -ErrorAction SilentlyContinue |
                Where-Object { $_.CommandLine -match "(?i)uvicorn\s+app\.main:app.*--port\s+$candidatePort(?:\s|$)" }).Count -gt 0)
        if (-not $servesByteQuest) { continue }
    }
    $apiPort = $candidatePort
    break
}
if ($null -eq $apiPort) {
    throw "No available local FastAPI port was found between 8000 and 8010. Stop only a process you recognize, then rerun this script."
}

$frontendEnv = @(
    "NEXT_PUBLIC_API_URL=http://127.0.0.1:$apiPort/api/v1"
    "NEXT_PUBLIC_SUPABASE_URL=$($localValues.API_URL)"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=$($localValues.ANON_KEY)"
    "NEXT_PUBLIC_LOCAL_STAFF_REGISTRATION=true"
)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

# Rewriting an unchanged .env.local would make the Next.js dev server reload for
# nothing, throwing away the compile the launcher deliberately started early.
function Write-ByteQuestEnvFile {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string[]]$Lines,
        [Parameter(Mandatory)][System.Text.Encoding]$Encoding
    )
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        $existing = [System.IO.File]::ReadAllLines($Path)
        if (($existing -join "`n") -eq ($Lines -join "`n")) {
            return $false
        }
    }
    [System.IO.File]::WriteAllLines($Path, $Lines, $Encoding)
    return $true
}

$null = Write-ByteQuestEnvFile -Path $backendEnvPath -Lines @($backendEnv) -Encoding $utf8NoBom
$null = Write-ByteQuestEnvFile -Path $frontendEnvPath -Lines @($frontendEnv) -Encoding $utf8NoBom

Write-Output "Local Supabase is started. Judge0 remains on the configured private Ubuntu VM."
Write-Output "Local-only environment files were written without printing keys."
Write-Output "Selected local FastAPI port: $apiPort."
