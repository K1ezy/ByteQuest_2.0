[CmdletBinding()]
param(
    [Parameter()]
    [string]$BaseUrl = "http://172.20.66.12:2358"
)

# Primary local Judge0 configuration. start-local.ps1 preserves these values.

$ErrorActionPreference = "Stop"

if (-not [Uri]::IsWellFormedUriString($BaseUrl, [UriKind]::Absolute)) {
    throw "BaseUrl must be an absolute URL, for example http://172.20.66.12:2358."
}

$baseUri = [Uri]$BaseUrl
if ($baseUri.Scheme -ne "http" -or $baseUri.Port -ne 2358) {
    throw "Use the local Judge0 VM URL over HTTP, with port 2358."
}

$secureToken = Read-Host "Paste the Judge0 API token (input is hidden)" -AsSecureString
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

if ($token -notmatch '^[A-Za-z0-9_-]+$') {
    throw "The API token contains unexpected characters; no settings were written."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $repoRoot "backend/.env.local"
if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
    throw "Missing backend/.env.local. Run the local ByteQuest setup first."
}

$updates = [ordered]@{
    JUDGE0_BASE_URL = $BaseUrl.TrimEnd("/")
    JUDGE0_API_KEY = $token
}
$written = @{}
$outputLines = [System.Collections.Generic.List[string]]::new()

foreach ($line in [System.IO.File]::ReadAllLines($envPath)) {
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

[System.IO.File]::WriteAllLines(
    $envPath,
    $outputLines,
    [System.Text.UTF8Encoding]::new($false)
)
$token = $null
$secureToken.Dispose()

Write-Output "Configured ByteQuest to use Judge0 at $($updates.JUDGE0_BASE_URL)."
Write-Output "The API token was saved to the ignored backend/.env.local file and was not displayed."
