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
# Mailpit (container "inbucket") is optional, but local password-reset emails are
# delivered to it at http://127.0.0.1:15434, so the launcher keeps it running.
$resumedOptionalServices = @("inbucket")

function Get-ByteQuestServiceState {
    # Single docker call; returns @{ <service> = @{ State; Status } } for this
    # project, so readiness checks never fan out into one call per container.
    param([Parameter(Mandatory)][string]$ProjectId)
    $states = @{}
    $escaped = [regex]::Escape($ProjectId)
    $containers = & docker ps -a --filter "name=_$ProjectId" --format '{{.Names}}|{{.State}}|{{.Status}}' 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Could not list Supabase containers. Check that Docker Desktop is running.' }
    foreach ($line in $containers) {
        $parts = $line -split '\|', 3
        if ($parts.Count -eq 3 -and $parts[0] -match "^supabase_(?<svc>.+)_$escaped$") {
            $states[$Matches.svc] = [pscustomobject]@{ State = $parts[1]; Status = $parts[2] }
        }
    }
    return $states
}

function Test-ByteQuestServiceUp {
    param($ServiceState)
    # "Up 4 seconds (health: starting)" is running but not ready: Postgres is still
    # initializing, and 'supabase status' refuses to report any keys until it is healthy.
    return ($null -ne $ServiceState -and
        $ServiceState.State -eq "running" -and
        $ServiceState.Status -notmatch "unhealthy|Restarting|health: starting")
}

function Invoke-SupabaseStatusEnv {
    # Keep status output private because stdout carries local signing keys.
    $stderrPath = Join-Path ([System.IO.Path]::GetTempPath()) ("bytequest-status-" + [guid]::NewGuid().ToString("N") + ".log")
    try {
        $lines = & supabase status --output env 2> $stderrPath
        $stderrText = ""
        if (Test-Path -LiteralPath $stderrPath) {
            $stderrText = ([System.IO.File]::ReadAllText($stderrPath)).Trim()
        }
        return [pscustomobject]@{ Lines = @($lines); StdErr = $stderrText }
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
    $storage = "supabase_storage_$ProjectId"

    if ([string]::IsNullOrWhiteSpace($Values["API_URL"])) {
        $apiPort = Get-ByteQuestPublishedPort -Container $kong -ContainerPort 8000
        if ($null -ne $apiPort) { $Values["API_URL"] = "http://127.0.0.1:$apiPort" }
    }
    if ([string]::IsNullOrWhiteSpace($Values["DB_URL"])) {
        $dbPort = Get-ByteQuestPublishedPort -Container $db -ContainerPort 5432
        $dbPassword = Get-ByteQuestContainerSetting -Container $db -Names @("POSTGRES_PASSWORD")
        if ($null -ne $dbPort -and $dbPassword) {
            $password = [uri]::EscapeDataString($dbPassword)
            $Values["DB_URL"] = "postgresql://postgres:$password@127.0.0.1:$dbPort/postgres"
        }
    }
    if ([string]::IsNullOrWhiteSpace($Values["JWT_SECRET"])) {
        $jwtSecret = Get-ByteQuestContainerSetting -Container $auth -Names @("GOTRUE_JWT_SECRET")
        if ($jwtSecret) { $Values["JWT_SECRET"] = $jwtSecret }
    }
    if ([string]::IsNullOrWhiteSpace($Values["ANON_KEY"])) {
        $anonKey = Get-ByteQuestContainerSetting -Container $storage -Names @("ANON_KEY")
        if (-not $anonKey) { $anonKey = Get-ByteQuestContainerSetting -Container $kong -Names @("SUPABASE_ANON_KEY", "ANON_KEY") }
        if ($anonKey) { $Values["ANON_KEY"] = $anonKey }
    }
    if ([string]::IsNullOrWhiteSpace($Values["SERVICE_ROLE_KEY"])) {
        $serviceRoleKey = Get-ByteQuestContainerSetting -Container $storage -Names @("SERVICE_KEY", "SERVICE_ROLE_KEY")
        if (-not $serviceRoleKey) { $serviceRoleKey = Get-ByteQuestContainerSetting -Container $kong -Names @("SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY") }
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

function Wait-ByteQuestEssentialServices {
    param(
        [Parameter(Mandatory)][string]$ProjectId,
        [Parameter(Mandatory)][string[]]$Services,
        [Parameter(Mandatory)][hashtable]$State,
        [int]$TimeoutSeconds = 180
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ($true) {
        $down = @(foreach ($service in $Services) { if (-not (Test-ByteQuestServiceUp $State[$service])) { $service } })
        if ($down.Count -eq 0 -or (Get-Date) -ge $deadline) {
            return [pscustomobject]@{ Down = $down; State = $State }
        }
        Start-Sleep -Seconds 1
        $State = Get-ByteQuestServiceState -ProjectId $ProjectId
    }
}

function Get-ByteQuestStackAction {
    # Decides how to bring the local stack up from what Docker reports. It makes no
    # Docker calls, so every branch is unit-tested in test-launcher-helpers.ps1.
    #   Before waiting: 'start'   no container exists yet
    #                   'rebuild' a required container is missing or can't be started in place
    #                   'resume'  a required container is stopped
    #                   'reuse'   every required container is running (some may still be warming)
    #   -AfterWait:     'ready', or 'rebuild' when a required container stayed unready
    #                   or the database or API lost its host port mapping
    param(
        [Parameter(Mandatory)][hashtable]$State,
        [Parameter(Mandatory)][string[]]$Services,
        [switch]$AfterWait,
        [bool]$PortsMapped = $true
    )
    if ($AfterWait) {
        $unready = @($Services | Where-Object { -not (Test-ByteQuestServiceUp $State[$_]) })
        if ($unready.Count -gt 0 -or -not $PortsMapped) { return 'rebuild' }
        return 'ready'
    }
    if ($State.Count -eq 0) { return 'start' }
    foreach ($service in $Services) {
        if (-not $State.ContainsKey($service) -or $State[$service].State -in @('dead', 'paused', 'removing')) {
            return 'rebuild'
        }
    }
    if (@($Services | Where-Object { $State[$_].State -in @('created', 'exited') }).Count -gt 0) { return 'resume' }
    return 'reuse'
}

function Get-ByteQuestStoppedContainers {
    param(
        [Parameter(Mandatory)][hashtable]$State,
        [Parameter(Mandatory)][string[]]$Services,
        [Parameter(Mandatory)][string]$ProjectId
    )
    foreach ($service in $Services) {
        if ($State.ContainsKey($service) -and $State[$service].State -in @('created', 'exited')) {
            "supabase_${service}_$ProjectId"
        }
    }
}

function Protect-ByteQuestLogText {
    # Container logs can echo connection strings, SQL or request URLs. Mask anything
    # shaped like a JWT, a Supabase API key or a password before it goes to a file.
    param([AllowNull()][AllowEmptyString()][string]$Text)
    if ([string]::IsNullOrEmpty($Text)) { return $Text }
    $masked = $Text -replace 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', '[redacted token]'
    $masked = $masked -replace 'sb_(secret|publishable)_[A-Za-z0-9_-]+', '[redacted key]'
    $masked = $masked -replace '(postgres(?:ql)?://[^:/@\s]+:)[^@\s]+@', '$1[redacted]@'
    $masked = $masked -replace "(?i)(password\s*[=:]?\s*')[^']*(')", '$1[redacted]$2'
    return ($masked -replace "(?i)\b(password=)(?!')\S+", '$1[redacted]')
}

function Write-ByteQuestSupabaseDiagnostics {
    # Records each named container's status and last 40 log lines, so a failure, or
    # an automatic rebuild (which deletes the old containers), can be explained later.
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string[]]$Heading,
        [Parameter(Mandatory)][string]$ProjectId,
        [Parameter(Mandatory)][string[]]$Services,
        [Parameter(Mandatory)][hashtable]$State
    )
    New-Item -ItemType Directory -Path (Split-Path -Parent $Path) -Force | Out-Null
    Add-Content -LiteralPath $Path -Value $Heading
    foreach ($service in $Services) {
        $container = "supabase_${service}_$ProjectId"
        if (-not $State.ContainsKey($service)) {
            Add-Content -LiteralPath $Path -Value "[$container] missing"
            continue
        }
        Add-Content -LiteralPath $Path -Value "[$container] $($State[$service].Status)"
        $logLines = @(& docker logs --tail 40 $container 2>&1 | ForEach-Object { Protect-ByteQuestLogText "$_" })
        if ($logLines.Count -gt 0) { Add-Content -LiteralPath $Path -Value $logLines }
    }
}

$diagnosticPath = Join-Path $repoRoot "logs/startup-diagnostics.log"

# Docker can restore an existing stack before Postgres is ready, and the CLI's
# status command fails during that window, so Docker's view decides what to do.
$serviceState = Get-ByteQuestServiceState -ProjectId $projectId
$stackAction = Get-ByteQuestStackAction -State $serviceState -Services $essentialServices
$startExitCode = 0
$essential = $null

if ($stackAction -in @('resume', 'reuse')) {
    $stoppedRequired = @(Get-ByteQuestStoppedContainers -State $serviceState -Services $essentialServices -ProjectId $projectId)
    $stoppedOptional = @(Get-ByteQuestStoppedContainers -State $serviceState -Services $resumedOptionalServices -ProjectId $projectId)
    if ($stoppedRequired.Count -gt 0) {
        Write-Output 'Resuming the existing local Supabase containers.'
        & docker start @stoppedRequired | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Output 'Docker could not resume them; rebuilding the stack from its existing volumes instead.'
            $stackAction = 'rebuild'
        }
    }
    elseif (@($essentialServices | Where-Object { -not (Test-ByteQuestServiceUp $serviceState[$_]) }).Count -gt 0) {
        Write-Output 'Waiting for the existing local Supabase containers to become healthy.'
    }
    else {
        Write-Output 'Local Supabase is already running; reusing its containers.'
    }
    if ($stackAction -ne 'rebuild' -and $stoppedOptional.Count -gt 0) {
        & docker start @stoppedOptional *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning 'Mailpit could not be resumed, so local password-reset emails are unavailable. ByteQuest still starts.'
        }
    }
}

if ($stackAction -in @('resume', 'reuse')) {
    $serviceState = Get-ByteQuestServiceState -ProjectId $projectId
    $essential = Wait-ByteQuestEssentialServices -ProjectId $projectId -Services $essentialServices -State $serviceState
    $portsMapped = $essential.Down.Count -eq 0 -and
        $null -ne (Get-ByteQuestPublishedPort -Container "supabase_db_$projectId" -ContainerPort 5432) -and
        $null -ne (Get-ByteQuestPublishedPort -Container "supabase_kong_$projectId" -ContainerPort 8000)
    $stackAction = Get-ByteQuestStackAction -State $essential.State -Services $essentialServices -AfterWait -PortsMapped $portsMapped
    if ($stackAction -eq 'rebuild' -and $essential.Down.Count -gt 0) {
        Write-Output "Supabase containers did not become healthy ($($essential.Down -join ', ')); rebuilding the stack from its existing volumes."
        # The rebuild deletes these containers, so keep their status and logs first.
        $rebuildDiagnostics = @{
            Path      = $diagnosticPath
            Heading   = "Supabase containers were rebuilt at $(Get-Date -Format o) because they stayed unready: $($essential.Down -join ', ')"
            ProjectId = $projectId
            Services  = $essential.Down
            State     = $essential.State
        }
        Write-ByteQuestSupabaseDiagnostics @rebuildDiagnostics
    }
    elseif ($stackAction -eq 'rebuild') {
        Write-Output 'Supabase containers lost their host port mappings; rebuilding the stack from its existing volumes.'
    }
}

if ($stackAction -in @('rebuild', 'start')) {
    if ($stackAction -eq 'rebuild') {
        # Supabase CLI v2 short-circuits start when the DB is already running, even
        # if other services are missing or stuck. Stop keeps the project volumes.
        Write-Output 'Recreating the local Supabase stack from its existing volumes.'
        & supabase stop --project-id $projectId *> $null
        if ($LASTEXITCODE -ne 0) { throw 'Could not stop the local Supabase stack before rebuilding it.' }
    }

    # Keep containers available for our readiness check if the CLI times out.
    # Suppress CLI output because it includes local signing keys.
    Write-Output 'Starting local Supabase. A cold Docker start can take a few minutes.'
    # ByteQuest doesn't use Studio, Realtime, image transforms or the other services
    # below. Mailpit stays (see $resumedOptionalServices). The v2 CLI uses service
    # aliases for image pulls and image names when starting containers, so pass
    # both where they differ.
    $optionalServices = @('realtime', 'studio', 'imgproxy', 'meta', 'postgres-meta',
        'vector', 'edge-runtime', 'functions', 'analytics', 'logflare')
    $startArguments = @('start', '--ignore-health-check') + @(
        foreach ($service in $optionalServices) {
            '--exclude'
            $service
        }
    )
    & supabase @startArguments *> $null
    $startExitCode = $LASTEXITCODE
    $serviceState = Get-ByteQuestServiceState -ProjectId $projectId
    if ($startExitCode -ne 0 -and $serviceState.Count -eq 0) {
        # The CLI removes every container when one of them cannot start, for example
        # when Windows has reserved Mailpit's port. Mailpit is the only extra service
        # kept, so try once more without it rather than stop here.
        Write-Output 'Supabase did not start with Mailpit; retrying without it. Local password-reset emails will be unavailable.'
        $retryArguments = $startArguments + @('--exclude', 'inbucket', '--exclude', 'mailpit')
        & supabase @retryArguments *> $null
        $startExitCode = $LASTEXITCODE
        $serviceState = Get-ByteQuestServiceState -ProjectId $projectId
    }
    $waitSeconds = if ($serviceState.Count -eq 0 -and $startExitCode -ne 0) { 0 } else { 180 }
    $essential = Wait-ByteQuestEssentialServices -ProjectId $projectId -Services $essentialServices -State $serviceState -TimeoutSeconds $waitSeconds
}
$serviceState = $essential.State

if ($essential.Down.Count -gt 0) {
    $heading = @("Supabase startup failed at $(Get-Date -Format o)", "Unready services: $($essential.Down -join ', ')")
    if ($startExitCode -ne 0) { $heading += "supabase start exit code: $startExitCode" }
    Write-ByteQuestSupabaseDiagnostics -Path $diagnosticPath -Heading $heading -ProjectId $projectId -Services $essential.Down -State $serviceState
    throw "Essential Supabase services did not become healthy ($($essential.Down -join ', ')). See logs/startup-diagnostics.log."
}

# Essential stack is up. Warn only about optional services that are running but
# broken; ones that are stopped or still warming up are not a problem.
$degradedServices = @(
    foreach ($svc in ($serviceState.Keys | Sort-Object)) {
        $optional = $serviceState[$svc]
        if ($essentialServices -notcontains $svc -and
            ($optional.State -eq 'restarting' -or ($optional.State -eq 'running' -and $optional.Status -match 'unhealthy'))) {
            $svc
        }
    }
)
if ($degradedServices.Count -gt 0) {
    Write-Warning "Optional Supabase services are degraded; startup continues without them: $($degradedServices -join ', '). Inspect with 'docker logs supabase_<service>_$projectId'."
}
if ($startExitCode -ne 0) {
    Write-Warning "'supabase start' exited with code $startExitCode. The required containers are now healthy."
}

$statusResult = Invoke-SupabaseStatusEnv
$localValues = @{}
foreach ($line in $statusResult.Lines) {
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
    # Read settings from the active containers if CLI status is unavailable.
    Add-ByteQuestFallbackValues -Values $localValues -ProjectId $projectId
    $missingSettings = @(
        foreach ($required in $requiredSettings) {
            if (-not $localValues.ContainsKey($required) -or [string]::IsNullOrWhiteSpace($localValues[$required])) { $required }
        }
    )
}

if ($missingSettings.Count -gt 0) {
    $detail = "Supabase did not return required local settings ($($missingSettings -join ', ')), and they could not be read from the running containers."
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
