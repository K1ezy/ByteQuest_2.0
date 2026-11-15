[CmdletBinding()]
param(
    # Stop the phone relay and exit.
    [switch]$Stop,
    # Only open access on this ZeroTier network (recommended when the PC is on several).
    [string]$NetworkId
)

# Opens ByteQuest to devices on this PC's ZeroTier network only (for example your phone).
# Run START-BYTEQUEST.bat first. Re-run this after a reboot; run with -Stop to close access.
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$relayScript = Join-Path $PSScriptRoot "zerotier-relay.mjs"
$logPath = Join-Path $repoRoot "logs/zerotier-relay.log"

function Stop-Relay {
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
        Where-Object { $_.CommandLine -like "*zerotier-relay.mjs*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

Stop-Relay
if ($Stop) {
    Write-Host "ZeroTier phone access is closed."
    exit 0
}

# One relay per joined ZeroTier network that has an address (a PC can be on several).
$networks = @(Get-NetAdapter | Where-Object { $_.InterfaceDescription -like "ZeroTier*" -and $_.Status -eq "Up" } | ForEach-Object {
    $ip = (Get-NetIPAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1).IPAddress
    $id = if ($_.Name -match "\[(?<id>[0-9a-f]{16})\]") { $Matches.id } else { "unknown" }
    if ($ip -and (-not $NetworkId -or $id -eq $NetworkId)) { [pscustomobject]@{ Id = $id; Address = $ip } }
})
if (-not $networks) { throw "No ZeroTier network with an address is connected on this PC. Join your network in ZeroTier One and authorize this PC first." }

# Ports come from the frontend settings the launcher writes, so they always match the running app.
$ports = @(3000)
$frontendEnv = Join-Path $repoRoot "frontend/.env.local"
if (Test-Path -LiteralPath $frontendEnv) {
    foreach ($line in Get-Content -LiteralPath $frontendEnv) {
        if ($line -match '^NEXT_PUBLIC_(API|SUPABASE)_URL=http://(127\.0\.0\.1|localhost):(?<port>\d+)') { $ports += [int]$Matches.port }
    }
}
$ports = $ports | Select-Object -Unique

$node = (Get-Command node -ErrorAction Stop).Source
New-Item -ItemType Directory -Force -Path (Split-Path $logPath) | Out-Null
# Started through WMI so the relay is not a child of this window: closing the console (or the
# tool that ran this script) would otherwise end phone access with it.
$hidden = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }
foreach ($network in $networks) {
    $log = $logPath -replace "\.log$", "-$($network.Id).log"
    $command = "cmd.exe /d /s /c `"`"$node`" `"$relayScript`" $($network.Address) $($ports -join ' ') > `"$log`" 2> `"$log.err`"`""
    $started = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
        CommandLine = $command; CurrentDirectory = $repoRoot; ProcessStartupInformation = $hidden
    }
    if ($started.ReturnValue -ne 0) { throw "Could not start the phone relay for network $($network.Id) (code $($started.ReturnValue))." }
}

Start-Sleep -Milliseconds 800
Write-Host ""
Write-Host "ZeroTier phone access is open (only devices on these private networks):" -ForegroundColor Green
foreach ($network in $networks) {
    $unreachable = foreach ($port in $ports) {
        $client = [System.Net.Sockets.TcpClient]::new()
        try {
            if (-not $client.ConnectAsync($network.Address, $port).Wait(2000)) { $port }
        } catch { $port } finally { $client.Dispose() }
    }
    Write-Host ("  network {0}:  http://{1}:3000" -f $network.Id, $network.Address) -ForegroundColor Cyan
    if ($unreachable) { Write-Host "    not reachable yet on ports: $($unreachable -join ', '). Is ByteQuest running?" -ForegroundColor Yellow }
}
Write-Host "API access for a network joined after ByteQuest started needs one launcher restart (START-BYTEQUEST.bat)."
Write-Host "Keep this PC awake. To close access: infra/start-zerotier-relay.ps1 -Stop"
