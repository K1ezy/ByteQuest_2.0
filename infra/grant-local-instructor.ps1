param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Email
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

$normalizedEmail = $Email.Trim().ToLowerInvariant()
try {
    $parsedEmail = [System.Net.Mail.MailAddress]::new($normalizedEmail)
    if ($parsedEmail.Address -ne $normalizedEmail) { throw "Enter one valid email address." }
} catch {
    throw "Enter the exact email address used for this ByteQuest account."
}

# This helper is intentionally pinned to this repository's local Supabase
# container. It cannot target a configured cloud database or another project.
$containerName = "supabase_db_bytequest-local"
$container = @(& docker ps --filter "name=^/$containerName`$" --format "{{.Names}}")
if ($LASTEXITCODE -ne 0) { throw "Docker could not be queried. Start Docker Desktop and local Supabase first." }
if ($container -notcontains $containerName) {
    throw "The local Supabase database container is not running. Start local services with .\infra\start-local.ps1 first."
}

$sql = @'
UPDATE public.profiles AS p
SET role = 'instructor'
FROM auth.users AS u
WHERE p.id = u.id
  AND lower(u.email) = lower(:'email')
  AND p.role = 'student'
RETURNING u.email, p.role;

SELECT u.email, p.role
FROM auth.users AS u
JOIN public.profiles AS p ON p.id = u.id
WHERE lower(u.email) = lower(:'email');
'@

$output = $sql | & docker exec -i $containerName psql -X -v ON_ERROR_STOP=1 -v "email=$normalizedEmail" -U postgres -d postgres
if ($LASTEXITCODE -ne 0) {
    throw "Local role setup failed. Confirm you have signed into ByteQuest once so the profile exists, then retry."
}

$outputText = $output -join [Environment]::NewLine
if ($outputText -notmatch '(?im)\b(instructor|admin)\b') {
    throw "No ByteQuest profile was found for that email. Sign in to the app once to create the profile, then rerun this command."
}

Write-Output "Local instructor access is enabled for $normalizedEmail. Sign out of ByteQuest and sign back in."
