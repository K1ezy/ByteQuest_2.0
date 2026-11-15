# Shared helpers for the ByteQuest launcher.
#
# Dot-sourced by start-bytequest.ps1 and, because thread jobs do not inherit the
# caller's functions, by every background job that needs them. Keep everything
# here free of script-scope state so a job can load it in isolation.

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

function Get-PageScriptPaths {
    # The same-origin Next.js scripts an HTML page tells the browser to load.
    # Matches both <script src="..."> and the escaped copies in the RSC payload;
    # the lookahead keeps ".json" and similar paths out.
    [OutputType([string[]])]
    param([AllowNull()][AllowEmptyString()][string]$Html)

    if ([string]::IsNullOrEmpty($Html)) { return , [string[]]@() }
    return , [string[]]@(
        [regex]::Matches($Html, '/_next/static/[A-Za-z0-9_\-./~%]+?\.js(?=[\\"''?\s>])') |
        ForEach-Object { $_.Value } |
        Select-Object -Unique
    )
}

function Test-FrontendAssets {
    # A page can answer 200 while the scripts it references no longer exist:
    # a `next start` that outlived a rebuild keeps serving its old manifest, and
    # every page then hangs on "Loading..." because its client code 404s. The
    # frontend is only ready when the page AND every script it references load.
    param(
        [Parameter(Mandatory)][string]$Uri,
        [int]$TimeoutSeconds = 10
    )

    try { $response = Invoke-WebRequest -Uri $Uri -TimeoutSec $TimeoutSeconds -UseBasicParsing }
    catch { return $false }
    $scripts = Get-PageScriptPaths -Html ([string]$response.Content)
    # A Next.js page always ships client scripts; none means the page is not ours.
    if ($scripts.Count -eq 0) { return $false }
    $origin = ([uri]$Uri).GetLeftPart([System.UriPartial]::Authority)
    foreach ($path in $scripts) {
        if (-not (Test-HttpReady -Uri "$origin$path" -TimeoutSeconds $TimeoutSeconds)) { return $false }
    }
    return $true
}

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Wait-Until {
    # Generic poller. The old launcher slept 2 seconds between probes, so a
    # service that came up in 100 ms still cost up to 2 seconds per wait; a
    # quarter-second poll removes that rounding without meaningful extra load.
    param(
        [Parameter(Mandatory)][scriptblock]$Condition,
        [int]$TimeoutSeconds = 60,
        [int]$PollMilliseconds = 250
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ($true) {
        if (& $Condition) { return $true }
        if ((Get-Date) -ge $deadline) { return $false }
        Start-Sleep -Milliseconds $PollMilliseconds
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

function Test-BlocksLoopbackListener {
    # ByteQuest binds every service to 127.0.0.1, so only a loopback or all-address
    # listener can block it. One bound to a single other address (the ZeroTier phone
    # relay on 10.x.x.x:3000) coexists, and must not be mistaken for a port conflict.
    param([AllowNull()][string]$Address)
    return ("$Address".Trim('[', ']')) -in @('127.0.0.1', '0.0.0.0', '::', '::1')
}

function Get-ListenerPidMap {
    # One socket enumeration for every listening port. Get-NetTCPConnection
    # can omit live listeners on some Windows power states; netstat fills gaps.
    # Returns @{ port = @(pid) }
    # with [int] keys and no null or non-positive PIDs, so callers can trust
    # both the key type and the contents. Only listeners that can block a
    # 127.0.0.1 bind are included (see Test-BlocksLoopbackListener).
    $map = @{}
    foreach ($connection in (Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue)) {
        if (-not (Test-BlocksLoopbackListener -Address $connection.LocalAddress)) { continue }
        $port = $connection.LocalPort -as [int]
        $processId = $connection.OwningProcess -as [int]
        if ($null -eq $port -or $port -le 0) { continue }
        if ($null -eq $processId -or $processId -le 0) { continue }
        if (-not $map.ContainsKey($port)) {
            $map[$port] = [System.Collections.Generic.List[int]]::new()
        }
        if (-not $map[$port].Contains($processId)) {
            $map[$port].Add($processId)
        }
    }
    foreach ($line in (& netstat.exe -ano -p tcp)) {
        if ($line -notmatch '^\s*TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$') { continue }
        if (-not (Test-BlocksLoopbackListener -Address $Matches[1])) { continue }
        $port = [int]$Matches[2]
        $processId = [int]$Matches[3]
        if ($processId -le 0) { continue }
        if (-not $map.ContainsKey($port)) {
            $map[$port] = [System.Collections.Generic.List[int]]::new()
        }
        if (-not $map[$port].Contains($processId)) {
            $map[$port].Add($processId)
        }
    }
    return $map
}

function Get-PortListenerPids {
    # The only supported way to read a listener map.
    #
    # A hashtable miss returns $null, and @($null) is a ONE-element array
    # holding $null -- not an empty array -- so a `.Count -eq 0` guard lets it
    # through and the $null is then used as a hashtable key, which PowerShell
    # rejects with "Index operation failed; the array index evaluated to null".
    # That is what stopped startup whenever a port had no listener at all.
    # Returning a real [int[]] makes "port absent" and "port with no owners"
    # indistinguishable to every caller, so the mistake cannot recur.
    [OutputType([int[]])]
    param(
        [Parameter(Mandatory)][AllowNull()]$ListenerPidMap,
        [Parameter(Mandatory)][AllowNull()]$Port
    )

    # The unary comma on every return matters: PowerShell enumerates a returned
    # collection, so a bare `return [int[]]@()` emits nothing and the caller
    # gets $null -- which is how "no listeners" turned back into a null again.
    # `,$array` emits the array itself, so the caller always has a real [int[]]
    # with a working .Count, even under Set-StrictMode.
    $empty = [int[]]@()
    if ($ListenerPidMap -isnot [System.Collections.IDictionary]) { return , $empty }

    $portKey = $Port -as [int]
    if ($null -eq $portKey -or $portKey -le 0) { return , $empty }

    # Accept a map keyed either way: an [int] key is what Get-ListenerPidMap
    # writes, but a caller-built map may have stringified its ports, and a
    # type-mismatched key is a silent miss rather than an error.
    $rawPids = $null
    if ($ListenerPidMap.Contains($portKey)) {
        $rawPids = $ListenerPidMap[$portKey]
    }
    elseif ($ListenerPidMap.Contains([string]$portKey)) {
        $rawPids = $ListenerPidMap[[string]$portKey]
    }
    else {
        return , $empty
    }

    return , [int[]]@(
        @($rawPids) |
        ForEach-Object { $_ -as [int] } |
        Where-Object { $null -ne $_ -and $_ -gt 0 } |
        Select-Object -Unique
    )
}

function Get-ProcessDetailMap {
    # Win32_Process is the only source of command lines, and it is slow, so ask
    # for every process of interest in a single query instead of one per PID.
    # The input is deliberately loose: nulls, zeros, duplicates and unparseable
    # values are dropped here rather than throwing on an [int[]] coercion.
    param([AllowNull()][object[]]$ProcessIds)

    $map = @{}
    $unique = @(
        @($ProcessIds) |
        ForEach-Object { $_ -as [int] } |
        Where-Object { $null -ne $_ -and $_ -gt 0 } |
        Select-Object -Unique
    )
    if ($unique.Count -eq 0) { return $map }

    $filter = ($unique | ForEach-Object { "ProcessId = $_" }) -join " OR "
    foreach ($process in (Get-CimInstance Win32_Process -Filter $filter -ErrorAction SilentlyContinue)) {
        $processId = $process.ProcessId -as [int]
        if ($null -eq $processId -or $processId -le 0) { continue }
        $parentProcessId = $process.ParentProcessId -as [int]
        if ($null -eq $parentProcessId) { $parentProcessId = 0 }
        $map[$processId] = [pscustomobject]@{
            ProcessId       = $processId
            Name            = [string]$process.Name
            CommandLine     = [string]$process.CommandLine
            ExecutablePath  = [string]$process.ExecutablePath
            ParentProcessId = $parentProcessId
        }
    }
    return $map
}

function Get-ProcessDetail {
    # Companion lookup for Get-ProcessDetailMap. A hashtable indexed with a
    # $null key throws instead of returning $null, so every PID lookup that can
    # miss goes through here rather than a bare [] index.
    param(
        [Parameter(Mandatory)][AllowNull()]$DetailMap,
        [Parameter(Mandatory)][AllowNull()]$ProcessId
    )

    if ($DetailMap -isnot [System.Collections.IDictionary]) { return $null }
    $key = $ProcessId -as [int]
    if ($null -eq $key -or $key -le 0) { return $null }
    if (-not $DetailMap.Contains($key)) { return $null }
    return $DetailMap[$key]
}

function Select-LocalApiPort {
    # Picks the first candidate port that is either free or already serving our
    # own uvicorn app, and returns $null when every candidate belongs to
    # something else.
    #
    # Lives here rather than inline in start-local.ps1 so that the listener map
    # is only ever read through Get-PortListenerPids, and so the selection is
    # covered by test-launcher-helpers.ps1. Note the deliberate use of a plain
    # array of objects for the resolved candidates: an [ordered] dictionary
    # indexed with an [int] is read POSITIONALLY by PowerShell, not by key, so
    # a port number used as a key throws "argument was out of the range of
    # valid values".
    param(
        [Parameter(Mandatory)][AllowNull()]$ListenerPidMap,
        [Parameter(Mandatory)][int[]]$CandidatePorts
    )

    # Resolve every candidate first so the process table costs one CIM query.
    $resolved = @(
        foreach ($candidatePort in $CandidatePorts) {
            [pscustomobject]@{
                Port = $candidatePort
                Pids = Get-PortListenerPids -ListenerPidMap $ListenerPidMap -Port $candidatePort
            }
        }
    )
    $details = Get-ProcessDetailMap -ProcessIds @($resolved | ForEach-Object { $_.Pids })

    foreach ($candidate in $resolved) {
        if ($candidate.Pids.Count -eq 0) {
            return $candidate.Port
        }
        foreach ($processId in $candidate.Pids) {
            $detail = Get-ProcessDetail -DetailMap $details -ProcessId $processId
            if ($detail -and $detail.CommandLine -match "(?i)(?:-m\s+)?uvicorn\s+app\.main:app.*--port\s+$($candidate.Port)(?:\s|$)") {
                return $candidate.Port
            }
        }
    }
    return $null
}

function Start-OrResumeJudge0Vm {
    param(
        [Parameter(Mandatory)][string]$Name,
        [int]$TimeoutSeconds = 45
    )

    Import-Module Hyper-V -ErrorAction Stop
    $vm = Get-VM -Name $Name -ErrorAction Stop

    if ($vm.State -eq "Running") {
        return "already-running"
    }

    if ($vm.State -eq "Paused") {
        Resume-VM -VM $vm -ErrorAction Stop | Out-Null
    }
    else {
        Start-VM -VM $vm -ErrorAction Stop | Out-Null
    }

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ($true) {
        $vm = Get-VM -Name $Name -ErrorAction Stop
        if ($vm.State -eq "Running") { return "started" }
        if ((Get-Date) -ge $deadline) {
            throw "The VM '$Name' did not reach Running state. Open Hyper-V Manager/VM Connection, resolve any guest boot prompt, then rerun this launcher."
        }
        Start-Sleep -Milliseconds 500
    }
}

function Test-UsableGuestIPv4 {
    param([Parameter()][string]$Address)

    if ([string]::IsNullOrWhiteSpace($Address)) { return $false }
    $parsed = $null
    return (
        [System.Net.IPAddress]::TryParse($Address, [ref]$parsed) -and
        $parsed.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
        -not $parsed.IsLoopback -and
        -not $Address.StartsWith("169.254.")
    )
}

function Get-Judge0VmIPv4 {
    param([Parameter(Mandatory)][string]$Name)

    $addresses = @(
        Get-VMNetworkAdapter -VMName $Name -ErrorAction SilentlyContinue |
        ForEach-Object { $_.IPAddresses }
    )

    foreach ($address in $addresses) {
        if (Test-UsableGuestIPv4 -Address ([string]$address)) {
            return [string]$address
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

            $address = [string]$neighbor.IPAddress
            if (Test-UsableGuestIPv4 -Address $address) {
                return $address
            }
        }
    }

    return $null
}

function ConvertTo-PowerShellLiteral {
    param([Parameter(Mandatory)][string]$Value)
    return "'" + $Value.Replace("'", "''") + "'"
}

function ConvertTo-EncodedPowerShellCommand {
    param([Parameter(Mandatory)][string]$Command)
    return [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Command))
}

function Test-Judge0Languages {
    param(
        [Parameter(Mandatory)][string]$BaseUrl,
        [Parameter(Mandatory)][string]$ApiToken
    )
    try {
        $languages = Invoke-RestMethod -Uri "$($BaseUrl.TrimEnd('/'))/languages" `
            -Headers @{ 'X-Auth-Token' = $ApiToken } -TimeoutSec 5
        foreach ($prefix in @('c++', 'python', 'java')) {
            if (-not @($languages | Where-Object {
                $_.name -and ([string]$_.name).StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
            }).Count) { return $false }
        }
        return $true
    }
    catch {
        return $false
    }
}

function Get-FrontendFingerprint {
    param([Parameter(Mandatory)][string]$FrontendPath)

    $files = @(
        Get-ChildItem -LiteralPath (Join-Path $FrontendPath 'src') -Recurse -File
        Get-ChildItem -LiteralPath (Join-Path $FrontendPath 'public') -Recurse -File |
            Where-Object { $_.FullName -notlike "$(Join-Path $FrontendPath 'public\monaco')*" }
        foreach ($name in @('package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json', '.env.local')) {
            $path = Join-Path $FrontendPath $name
            if (Test-Path -LiteralPath $path -PathType Leaf) { Get-Item -LiteralPath $path }
        }
    ) | Sort-Object FullName
    $parts = foreach ($file in $files) {
        "$($file.FullName.Substring($FrontendPath.Length)):$((Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash)"
    }
    $bytes = [Text.Encoding]::UTF8.GetBytes(($parts -join "`n"))
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
}
