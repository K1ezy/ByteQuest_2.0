$ErrorActionPreference = "Stop"
# PowerShell 7 can promote native-command stderr to terminating errors when
# ErrorActionPreference is Stop. Docker and Supabase use stderr for progress.
$PSNativeCommandUseErrorActionPreference = $false

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

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

& docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Docker Desktop is not ready. Wait for its engine to start, then rerun this script."
}

$statusLines = & cmd.exe /d /c 'supabase status --output env 2>NUL'
if ($LASTEXITCODE -ne 0) {
    # Supabase prints its local signing keys during startup, so suppress that
    # output rather than storing it in a transcript or terminal scrollback.
    & cmd.exe /d /c 'supabase start >NUL 2>&1'
    if ($LASTEXITCODE -ne 0) {
        throw "Supabase failed to start. Check Docker Desktop and rerun 'supabase start' for diagnostics."
    }
    $statusLines = & cmd.exe /d /c 'supabase status --output env 2>NUL'
}

if ($LASTEXITCODE -ne 0) {
    throw "Could not read local Supabase status. Run 'supabase status' after startup."
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

foreach ($required in @("API_URL", "DB_URL", "JWT_SECRET", "ANON_KEY", "SERVICE_ROLE_KEY")) {
    if (-not $localValues.ContainsKey($required) -or [string]::IsNullOrWhiteSpace($localValues[$required])) {
        throw "Supabase did not return a required local setting ($required). Check 'supabase status --output env'."
    }
}

if ($localValues.API_URL -notmatch '^http://(127\.0\.0\.1|localhost):54321$' -or
    $localValues.DB_URL -notmatch '^postgres(ql)?://[^@]+@(127\.0\.0\.1|localhost):54322/') {
    throw "Supabase returned a non-local endpoint; refusing to write local configuration."
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
$backendSettings["CORS_ORIGINS"] = '["http://localhost:3000","http://127.0.0.1:3000"]'
$backendEnv = foreach ($key in $backendSettings.Keys) {
    "$key=$($backendSettings[$key])"
}
$frontendEnv = @(
    "NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1"
    "NEXT_PUBLIC_SUPABASE_URL=$($localValues.API_URL)"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=$($localValues.ANON_KEY)"
)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllLines($backendEnvPath, $backendEnv, $utf8NoBom)
[System.IO.File]::WriteAllLines((Join-Path $repoRoot "frontend/.env.local"), $frontendEnv, $utf8NoBom)

$seedPath = Join-Path $repoRoot "supabase/seed.sql"
$seedSql = [System.IO.File]::ReadAllText($seedPath)
$seedSql | & docker exec -i supabase_db_bytequest-local psql -v ON_ERROR_STOP=1 -U postgres -d postgres *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Could not apply local seed data to supabase_db_bytequest-local. Check Docker and Supabase status."
}

Write-Output "Local Supabase is started. Judge0 remains on the configured private Ubuntu VM."
Write-Output "Local-only environment files were written without printing keys."
Write-Output "Local migrations are current and idempotent seed data has been applied without resetting existing records."
Write-Output "Start FastAPI from backend/ and Next.js from frontend/."
