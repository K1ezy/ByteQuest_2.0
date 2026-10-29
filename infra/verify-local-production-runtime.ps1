[CmdletBinding()]
param(
    [string]$ImageTag = "bytequest-backend:phase7-local-20261026"
)

$ErrorActionPreference = "Stop"

$backendDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..\backend")).Path
$localEnvironmentPath = Join-Path $backendDirectory ".env.local"
$supabaseNetwork = "supabase_network_bytequest-local"
$containerName = "bytequest-phase7-runtime-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
$temporaryEnvironmentPath = Join-Path ([System.IO.Path]::GetTempPath()) "bytequest-phase7-$([guid]::NewGuid().ToString('N')).env"
$containerStarted = $false

function Invoke-Docker {
    param([Parameter(Mandatory)][string[]]$Arguments)

    & docker @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed with exit code $LASTEXITCODE."
    }
}

function Get-HttpStatusCode {
    param([Parameter(Mandatory)][string]$Uri)

    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 5
        return [int]$response.StatusCode
    }
    catch {
        $response = $_.Exception.Response
        if ($null -ne $response) {
            return [int]$response.StatusCode
        }
        throw "HTTP request to $Uri failed with $($_.Exception.GetType().Name)."
    }
}

try {
    if (-not (Test-Path -LiteralPath $localEnvironmentPath -PathType Leaf)) {
        throw "Local backend settings were not found at backend/.env.local. Start the local ByteQuest setup first."
    }

    Invoke-Docker -Arguments @("info", "--format", "{{.ServerVersion}}") | Out-Null
    Invoke-Docker -Arguments @("network", "inspect", $supabaseNetwork) | Out-Null

    $settings = @{}
    foreach ($line in Get-Content -LiteralPath $localEnvironmentPath) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            $key = $matches[1]
            $value = $matches[2].Trim()
            if (
                $value.Length -ge 2 -and
                (($value.StartsWith('"') -and $value.EndsWith('"')) -or
                    ($value.StartsWith("'") -and $value.EndsWith("'")))
            ) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            if ($value.Contains("`n") -or $value.Contains("`r")) {
                throw "Multiline environment values are not supported by this runtime check ($key)."
            }
            $settings[$key] = $value
        }
    }

    $databaseUrl = [string]$settings["DATABASE_URL"]
    if ($databaseUrl -notmatch '@127\.0\.0\.1:54322(?=/|\?|$)') {
        throw "DATABASE_URL is not the expected local Supabase endpoint. No container was started."
    }
    $databaseUrl = $databaseUrl -replace '@127\.0\.0\.1:54322(?=/|\?|$)', '@db:5432'

    $supabaseUrl = [string]$settings["SUPABASE_URL"]
    if ($supabaseUrl -ne "http://127.0.0.1:54321") {
        throw "SUPABASE_URL is not the expected local Supabase endpoint. No container was started."
    }

    $runtimeKeys = @(
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SECRET_KEY",
        "SUPABASE_ANON_KEY",
        "SUPABASE_JWT_SECRET",
        "JUDGE0_BASE_URL",
        "JUDGE0_API_KEY",
        "GEMINI_API_KEY",
        "DB_POOL_SIZE",
        "DB_MAX_OVERFLOW",
        "DB_POOL_TIMEOUT_SECONDS",
        "DB_CONNECT_TIMEOUT_SECONDS",
        "DB_POOL_RECYCLE_SECONDS"
    )

    $environmentLines = [System.Collections.Generic.List[string]]::new()
    $environmentLines.Add("DATABASE_URL=$databaseUrl")
    $environmentLines.Add("SUPABASE_URL=http://kong:8000")
    $environmentLines.Add("ENVIRONMENT=production")
    $environmentLines.Add('CORS_ORIGINS=["https://bytequest.example"]')
    foreach ($key in $runtimeKeys) {
        if ($settings.ContainsKey($key)) {
            $environmentLines.Add("$key=$($settings[$key])")
        }
    }
    [System.IO.File]::WriteAllLines(
        $temporaryEnvironmentPath,
        $environmentLines,
        [System.Text.UTF8Encoding]::new($false)
    )

    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls.exe $temporaryEnvironmentPath /inheritance:r /grant:r `
        "${currentIdentity}:(F)" "SYSTEM:(F)" "BUILTIN\Administrators:(F)" *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Could not restrict the temporary local environment file permissions."
    }

    Invoke-Docker -Arguments @(
        "build",
        "--tag", $ImageTag,
        "--file", (Join-Path $backendDirectory "Dockerfile"),
        $backendDirectory
    ) | Out-Null

    $portProbe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $portProbe.Start()
    $hostPort = $portProbe.LocalEndpoint.Port
    $portProbe.Stop()

    Invoke-Docker -Arguments @(
        "run",
        "--detach",
        "--name", $containerName,
        "--label", "com.bytequest.validation=phase7-local",
        "--network", $supabaseNetwork,
        "--publish", "127.0.0.1:${hostPort}:8000",
        "--env-file", $temporaryEnvironmentPath,
        "--read-only",
        "--tmpfs", "/tmp:rw,noexec,nosuid,size=32m",
        "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges",
        $ImageTag
    ) | Out-Null
    $containerStarted = $true

    $ready = $false
    $lastReadinessFailure = "No readiness response was received."
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Seconds 1
        try {
            $readiness = Invoke-RestMethod "http://127.0.0.1:${hostPort}/readyz" -TimeoutSec 2
            if ($readiness.status -eq "ready") {
                $ready = $true
                break
            }
            $lastReadinessFailure = "The readiness endpoint returned an unexpected status."
        }
        catch {
            $lastReadinessFailure = "Readiness request failed with $($_.Exception.GetType().Name)."
            $running = & docker inspect $containerName --format '{{.State.Running}}' 2>$null
            if ($LASTEXITCODE -ne 0 -or $running -ne "true") {
                break
            }
        }
    }
    if (-not $ready) {
        $containerState = & docker inspect $containerName --format '{{.State.Status}}' 2>$null
        $containerHealth = & docker inspect $containerName --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}not-configured{{end}}' 2>$null
        Write-Output "Container state: $containerState; Docker health: $containerHealth."

        $safeDiagnostics = @(& docker logs --tail 25 $containerName 2>$null)
        foreach ($diagnostic in $safeDiagnostics) {
            foreach ($key in @($settings.Keys | Sort-Object { ([string]$settings[$_]).Length } -Descending)) {
                $secretValue = [string]$settings[$key]
                if ($secretValue.Length -ge 4 -and $key -match '(?i)KEY|SECRET|PASSWORD|TOKEN|DATABASE_URL|SUPABASE_URL') {
                    $diagnostic = $diagnostic.Replace($secretValue, "<redacted>")
                }
            }
            $diagnostic = $diagnostic -replace '(?i)(postgres(?:ql)?(?:\+[^:]*)?://)[^@\s]+@', '$1<redacted>@'
            $diagnostic = $diagnostic -replace '(?i)(password|secret|token|api[_-]?key)(\s*[:=]\s*)[^\s,;]+', '$1$2<redacted>'
            $diagnostic = $diagnostic -replace '(?i)(bearer\s+)[^\s,;]+', '$1<redacted>'
            if (-not [string]::IsNullOrWhiteSpace([string]$diagnostic)) {
                Write-Output "Container log (redacted): $diagnostic"
            }
        }
        throw "Container did not become database-ready within 40 seconds. $lastReadinessFailure"
    }

    $liveness = Invoke-RestMethod "http://127.0.0.1:${hostPort}/health" -TimeoutSec 5
    $apiHealth = Invoke-RestMethod "http://127.0.0.1:${hostPort}/api/v1/health" -TimeoutSec 5
    $docsStatus = Get-HttpStatusCode "http://127.0.0.1:${hostPort}/docs"
    $redocStatus = Get-HttpStatusCode "http://127.0.0.1:${hostPort}/redoc"
    $openApiStatus = Get-HttpStatusCode "http://127.0.0.1:${hostPort}/api/v1/openapi.json"
    $containerUser = & docker inspect $containerName --format '{{.Config.User}}'
    $healthState = "starting"
    for ($attempt = 0; $attempt -lt 45; $attempt++) {
        $healthState = & docker inspect $containerName --format '{{.State.Health.Status}}'
        if ($LASTEXITCODE -ne 0 -or $healthState -ne "starting") {
            break
        }
        Start-Sleep -Seconds 1
    }

    if ($liveness.status -ne "online") {
        throw "The container liveness response was not the expected status."
    }
    if ($apiHealth.status -ne "healthy") {
        throw "The versioned API health response was not the expected status."
    }
    if ($docsStatus -ne 404 -or $redocStatus -ne 404 -or $openApiStatus -ne 404) {
        throw "Interactive API documentation remained available in production mode."
    }
    if ($containerUser -ne "appuser") {
        throw "The backend container did not run as its configured non-root user."
    }
    if ($healthState -ne "healthy") {
        throw "The configured Docker health check did not report healthy (state: $healthState)."
    }

    Write-Output "PASS: current backend image built successfully."
    Write-Output "PASS: production-mode container ran as appuser with a read-only root filesystem and dropped Linux capabilities."
    Write-Output "PASS: public liveness, versioned API health, and database readiness responded successfully."
    Write-Output "PASS: Swagger, ReDoc, and OpenAPI returned HTTP 404 in production mode."
    Write-Output "PASS: the configured Docker health check reported healthy."
    Write-Output "Scope: local synthetic-runtime check only; no rows, uploads, VM settings, or checkpoints were changed."
}
finally {
    if ($containerStarted) {
        & docker stop --time 10 $containerName *> $null
        & docker rm -f $containerName *> $null
    }
    Remove-Item -LiteralPath $temporaryEnvironmentPath -Force -ErrorAction SilentlyContinue
}
