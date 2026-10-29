[CmdletBinding()]
param(
    [Parameter()]
    [string]$BaseUrl,

    [Parameter()]
    [switch]$SetApiToken
)

# Configure the private local Judge0 endpoint without displaying or needlessly
# re-entering its credential. The API process must be restarted separately.
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    $BaseUrl = Read-Host "Enter the current Judge0 VM URL (for example http://192.168.1.25:2358)"
}
$BaseUrl = $BaseUrl.Trim()

if (-not [Uri]::IsWellFormedUriString($BaseUrl, [UriKind]::Absolute)) {
    throw "BaseUrl must be an absolute URL, for example http://192.168.1.25:2358. No settings were written."
}

$baseUri = [Uri]$BaseUrl
if (
    $baseUri.Scheme -ne "http" -or
    $baseUri.Port -ne 2358 -or
    -not [string]::IsNullOrEmpty($baseUri.UserInfo) -or
    -not [string]::IsNullOrEmpty($baseUri.Query) -or
    -not [string]::IsNullOrEmpty($baseUri.Fragment)
) {
    throw "Use the Judge0 VM URL over HTTP on port 2358, without credentials, query, or fragment. No settings were written."
}

$normalizedBaseUrl = $BaseUrl.TrimEnd("/")
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $repoRoot "backend/.env.local"
if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
    throw "Missing backend/.env.local. Run the local ByteQuest setup first."
}

$existingLines = [System.IO.File]::ReadAllLines($envPath)
$existingToken = $null
foreach ($line in $existingLines) {
    if ($line -match '^JUDGE0_API_KEY=(.*)$') {
        $existingToken = $Matches[1]
        break
    }
}

$token = $existingToken
if ($SetApiToken -or [string]::IsNullOrWhiteSpace($token)) {
    $secureToken = Read-Host "Paste the Judge0 API token (input is hidden)" -AsSecureString
    try {
        if ($secureToken.Length -lt 32) {
            throw "The Judge0 API token looks too short; no settings were written."
        }

        $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
        try {
            $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
        }
        finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
        }
    }
    finally {
        $secureToken.Dispose()
    }
}

if ($token -notmatch '^[A-Za-z0-9_-]{32,}$') {
    $token = $null
    throw "The saved or entered API token is missing or has an unexpected format. Use -SetApiToken to enter the token configured on the Judge0 server. No settings were written."
}

$updates = [ordered]@{
    JUDGE0_BASE_URL = $normalizedBaseUrl
    JUDGE0_API_KEY = $token
}
$written = @{}
$outputLines = [System.Collections.Generic.List[string]]::new()

foreach ($line in $existingLines) {
    if ($line -match '^(JUDGE0_BASE_URL|JUDGE0_API_KEY)=') {
        $key = $Matches[1]
        if (-not $written.ContainsKey($key)) {
            $outputLines.Add("$key=$($updates[$key])")
            $written[$key] = $true
        }
    }
    else {
        $outputLines.Add($line)
    }
}

foreach ($key in $updates.Keys) {
    if (-not $written.ContainsKey($key)) {
        $outputLines.Add("$key=$($updates[$key])")
    }
}

# Write beside the destination and replace it with a same-volume rename so an
# interrupted write cannot leave a partially updated environment file.
$tempPath = Join-Path (Split-Path -Parent $envPath) ".env.local.$([Guid]::NewGuid().ToString('N')).tmp"
try {
    [System.IO.File]::WriteAllLines(
        $tempPath,
        $outputLines,
        [System.Text.UTF8Encoding]::new($false)
    )
    [System.IO.File]::Move($tempPath, $envPath, $true)
}
finally {
    if (Test-Path -LiteralPath $tempPath) {
        Remove-Item -LiteralPath $tempPath -Force
    }
    $token = $null
}

Write-Output "Configured ByteQuest to use Judge0 at $normalizedBaseUrl."
Write-Output "The existing token was preserved (or the replacement was saved) in ignored backend/.env.local and was not displayed."
Write-Output "Restart FastAPI for the new endpoint setting to take effect."
