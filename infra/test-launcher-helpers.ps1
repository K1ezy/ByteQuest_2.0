<#
.SYNOPSIS
    Regression tests for the ByteQuest launcher's port/process helpers.

.DESCRIPTION
    Startup once failed with "Index operation failed; the array index evaluated
    to null" whenever a port had no listener, because @($map[$port]) on a
    hashtable miss produces a ONE-element array holding $null (not an empty
    array), so a `.Count -eq 0` guard passed it through and the $null was then
    used as a hashtable key.

    This script locks that behaviour down two ways:
      1. Unit tests over Get-PortListenerPids / Get-ProcessDetail /
         Get-ProcessDetailMap and Get-FrontendListenerState, covering the
         free-port case that used to crash.
      2. A lint pass that fails if any launcher script indexes a listener map
         or a process-detail map directly instead of going through the helpers.

    Runs on any platform: no Windows-only cmdlet is invoked.

.EXAMPLE
    pwsh -NoProfile -File infra\test-launcher-helpers.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$infraPath = $PSScriptRoot
$script:Failures = 0

function Assert-That {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][scriptblock]$Test
    )
    try {
        if (& $Test) { Write-Host "  PASS  $Name" -ForegroundColor Green; return }
        Write-Host "  FAIL  $Name" -ForegroundColor Red
        $script:Failures++
    }
    catch {
        Write-Host "  THREW $Name -> $($_.Exception.Message)" -ForegroundColor Red
        $script:Failures++
    }
}

Write-Host "`nByteQuest launcher helper tests" -ForegroundColor Cyan

# --------------------------------------------------------------------------
Write-Host "`n[1] Every launcher script parses"
foreach ($file in (Get-ChildItem -LiteralPath $infraPath -Filter '*.ps1' | Sort-Object Name)) {
    $parseErrors = $null
    $null = [System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$null, [ref]$parseErrors)
    if ($parseErrors.Count -gt 0) {
        Write-Host "  FAIL  $($file.Name): $($parseErrors[0].Message) (line $($parseErrors[0].Extent.StartLineNumber))" -ForegroundColor Red
        $script:Failures++
    }
    else { Write-Host "  PASS  $($file.Name)" -ForegroundColor Green }
}

# --------------------------------------------------------------------------
Write-Host "`n[2] No launcher script indexes a PID map directly"
# The helpers exist so that a missing key can never become a $null index. Any
# new `$somePidMap[$x]` or `$someDetails[$x]` outside launcher-common.ps1
# reintroduces the original failure, so it fails the build here instead.
$bannedPattern = '\$\w*(?:PidMap|[Dd]etails|[Pp]arents)\s*\['
foreach ($file in (Get-ChildItem -LiteralPath $infraPath -Filter '*.ps1' | Sort-Object Name)) {
    if ($file.Name -in @('launcher-common.ps1', 'test-launcher-helpers.ps1')) { continue }
    $hits = Select-String -LiteralPath $file.FullName -Pattern $bannedPattern -AllMatches |
    Where-Object { $_.Line -notmatch '^\s*#' }
    if ($hits) {
        foreach ($hit in $hits) {
            Write-Host "  FAIL  $($file.Name):$($hit.LineNumber) indexes a map directly: $($hit.Line.Trim())" -ForegroundColor Red
            Write-Host "        Use Get-PortListenerPids / Get-ProcessDetail instead." -ForegroundColor Yellow
            $script:Failures++
        }
    }
    else { Write-Host "  PASS  $($file.Name) uses the helpers" -ForegroundColor Green }
}

# --------------------------------------------------------------------------
. (Join-Path $infraPath 'launcher-common.ps1')

Write-Host "`n[3] Get-PortListenerPids never yields a null"
Assert-That 'absent port returns an empty collection'      { (Get-PortListenerPids -ListenerPidMap @{ 5432 = @(10) } -Port 3000).Count -eq 0 }
Assert-That 'absent port contains no null element'         { @(Get-PortListenerPids -ListenerPidMap @{} -Port 3000) -notcontains $null }
Assert-That 'absent port still returns an int[]'           { (Get-PortListenerPids -ListenerPidMap @{} -Port 3000) -is [int[]] }
Assert-That 'null map returns empty'                       { (Get-PortListenerPids -ListenerPidMap $null -Port 3000).Count -eq 0 }
Assert-That 'null port returns empty'                      { (Get-PortListenerPids -ListenerPidMap @{ 3000 = @(7) } -Port $null).Count -eq 0 }
Assert-That 'non-dictionary map returns empty'             { (Get-PortListenerPids -ListenerPidMap 'nonsense' -Port 3000).Count -eq 0 }
Assert-That 'present key with empty list returns empty'    { (Get-PortListenerPids -ListenerPidMap @{ 3000 = [System.Collections.Generic.List[int]]::new() } -Port 3000).Count -eq 0 }
Assert-That 'list of nulls returns empty'                  { (Get-PortListenerPids -ListenerPidMap @{ 3000 = @($null, $null) } -Port 3000).Count -eq 0 }
Assert-That 'zero and negative PIDs are dropped'           { ((Get-PortListenerPids -ListenerPidMap @{ 3000 = @(0, -1, 42) } -Port 3000) -join ',') -eq '42' }
Assert-That 'duplicate PIDs collapse'                      { ((Get-PortListenerPids -ListenerPidMap @{ 3000 = @(42, 42, 43) } -Port 3000) -join ',') -eq '42,43' }
Assert-That 'real PIDs come back in order'                 { ((Get-PortListenerPids -ListenerPidMap @{ 3000 = @(900, 901) } -Port 3000) -join ',') -eq '900,901' }
Assert-That 'string port argument resolves'                { ((Get-PortListenerPids -ListenerPidMap @{ 3000 = @(900) } -Port '3000') -join ',') -eq '900' }
Assert-That 'string-keyed map resolves'                    { ((Get-PortListenerPids -ListenerPidMap @{ '3000' = @(900) } -Port 3000) -join ',') -eq '900' }
Assert-That 'scalar (unwrapped) value resolves'            { ((Get-PortListenerPids -ListenerPidMap @{ 3000 = 900 } -Port 3000) -join ',') -eq '900' }
Assert-That 'loopback and all-address listeners block'     { @('127.0.0.1', '0.0.0.0', '::', '[::]', '[::1]' | Where-Object { -not (Test-BlocksLoopbackListener -Address $_) }).Count -eq 0 }
Assert-That 'a ZeroTier-only listener does not block'      { -not (Test-BlocksLoopbackListener -Address '10.210.245.210') }

Write-Host "`n[4] Get-ProcessDetail returns null instead of throwing"
Assert-That 'null PID'          { $null -eq (Get-ProcessDetail -DetailMap @{ 5 = 'x' } -ProcessId $null) }
Assert-That 'null map'          { $null -eq (Get-ProcessDetail -DetailMap $null -ProcessId 5) }
Assert-That 'absent PID'        { $null -eq (Get-ProcessDetail -DetailMap @{ 5 = 'x' } -ProcessId 9) }
Assert-That 'zero PID'          { $null -eq (Get-ProcessDetail -DetailMap @{ 5 = 'x' } -ProcessId 0) }
Assert-That 'unparseable PID'   { $null -eq (Get-ProcessDetail -DetailMap @{ 5 = 'x' } -ProcessId 'abc') }
Assert-That 'present PID'       { (Get-ProcessDetail -DetailMap @{ 5 = 'x' } -ProcessId 5) -eq 'x' }

Write-Host "`n[5] Get-ProcessDetailMap tolerates a loose PID list"
# Win32_Process exists only on Windows; stub it so the input handling is what
# gets tested, on any platform.
function Get-CimInstance { param($ClassName, $Filter, $ErrorAction) }
Assert-That 'null input'            { (Get-ProcessDetailMap -ProcessIds $null).Count -eq 0 }
Assert-That 'array of nulls'        { (Get-ProcessDetailMap -ProcessIds @($null, $null)).Count -eq 0 }
Assert-That 'unparseable entries'   { (Get-ProcessDetailMap -ProcessIds @('abc', $null, 0)).Count -eq 0 }
Assert-That 'empty array'           { (Get-ProcessDetailMap -ProcessIds @()).Count -eq 0 }

Write-Host "`n[6] Select-LocalApiPort"
# A fake process table keyed the way Get-ProcessDetailMap returns one, so the
# selection logic is exercised without CIM.
function Get-ProcessDetailMap {
    param([AllowNull()][object[]]$ProcessIds)
    $table = @{
        3301 = [pscustomobject]@{ ProcessId = 3301; Name = 'python.exe'; CommandLine = 'python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000'; ParentProcessId = 0 }
        3302 = [pscustomobject]@{ ProcessId = 3302; Name = 'python.exe'; CommandLine = 'python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001'; ParentProcessId = 0 }
        3400 = [pscustomobject]@{ ProcessId = 3400; Name = 'postgres.exe'; CommandLine = 'postgres -D data'; ParentProcessId = 0 }
    }
    $map = @{}
    foreach ($id in @(@($ProcessIds) | ForEach-Object { $_ -as [int] } | Where-Object { $_ -gt 0 })) {
        if ($table.ContainsKey($id)) { $map[$id] = $table[$id] }
    }
    return $map
}

Assert-That 'all ports free -> first candidate' {
    (Select-LocalApiPort -ListenerPidMap @{} -CandidatePorts @(8000..8010)) -eq 8000
}
Assert-That 'empty listener map does not throw on int port keys' {
    # An [ordered] dictionary indexed with an [int] is read positionally and
    # throws "argument was out of the range of valid values"; this guards
    # against that pattern coming back into the selection path.
    $null -ne (Select-LocalApiPort -ListenerPidMap @{} -CandidatePorts @(8000, 8001))
}
Assert-That 'null listener map -> first candidate' {
    (Select-LocalApiPort -ListenerPidMap $null -CandidatePorts @(8000, 8001)) -eq 8000
}
Assert-That 'first port taken by a stranger -> next free port' {
    (Select-LocalApiPort -ListenerPidMap @{ 8000 = @(3400) } -CandidatePorts @(8000, 8001, 8002)) -eq 8001
}
Assert-That 'our own uvicorn on a port -> reuse that port' {
    (Select-LocalApiPort -ListenerPidMap @{ 8000 = @(3301) } -CandidatePorts @(8000, 8001)) -eq 8000
}
Assert-That 'our uvicorn on the second port is still reused ahead of a free third' {
    (Select-LocalApiPort -ListenerPidMap @{ 8000 = @(3400); 8001 = @(3302) } -CandidatePorts @(8000, 8001, 8002)) -eq 8001
}
Assert-That 'uvicorn on a different port does not count as ours' {
    (Select-LocalApiPort -ListenerPidMap @{ 8000 = @(3302) } -CandidatePorts @(8000, 8001)) -eq 8001
}
Assert-That 'every candidate taken by strangers -> null' {
    $null -eq (Select-LocalApiPort -ListenerPidMap @{ 8000 = @(3400); 8001 = @(3400) } -CandidatePorts @(8000, 8001))
}
Assert-That 'preferred port honoured when listed first' {
    (Select-LocalApiPort -ListenerPidMap @{} -CandidatePorts @(8007, 8000, 8001)) -eq 8007
}
Assert-That 'unresolvable PID on a port treats it as occupied by a stranger' {
    (Select-LocalApiPort -ListenerPidMap @{ 8000 = @(9999) } -CandidatePorts @(8000, 8001)) -eq 8001
}

Write-Host "`n[7] Get-FrontendListenerState, including the case that used to crash"
# Load just the function out of the launcher so the launcher's own body, which
# would try to start services, does not run.
$launcherText = Get-Content -Raw -LiteralPath (Join-Path $infraPath 'start-bytequest.ps1')
$launcherAst = [System.Management.Automation.Language.Parser]::ParseInput($launcherText, [ref]$null, [ref]$null)
$functionAst = $launcherAst.FindAll({
        $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
        $args[0].Name -eq 'Get-FrontendListenerState'
    }, $true) | Select-Object -First 1
if (-not $functionAst) {
    Write-Host "  FAIL  Get-FrontendListenerState not found in start-bytequest.ps1" -ForegroundColor Red
    $script:Failures++
}
else {
    . ([scriptblock]::Create($functionAst.Extent.Text))

    Assert-That 'free port reports not in use (the original crash)' {
        $state = Get-FrontendListenerState -FrontendPath 'C:\x\frontend' -ListenerPidMap @{ 5432 = @(10) }
        (-not $state.InUse) -and (-not $state.IsByteQuest) -and @($state.Processes).Count -eq 0
    }
    Assert-That 'empty map reports not in use'   { (Get-FrontendListenerState -FrontendPath 'C:\x\frontend' -ListenerPidMap @{}).InUse -eq $false }
    Assert-That 'null map reports not in use'    { (Get-FrontendListenerState -FrontendPath 'C:\x\frontend' -ListenerPidMap $null).InUse -eq $false }
    Assert-That 'key with no owners not in use'  { (Get-FrontendListenerState -FrontendPath 'C:\x\frontend' -ListenerPidMap @{ 3000 = @() }).InUse -eq $false }

    # Occupied-port behaviour must stay exactly as it was. Swap in a fake
    # process table so the real matching logic runs without CIM.
    function Get-ProcessDetailMap {
        param([AllowNull()][object[]]$ProcessIds)
        $table = @{
            4100 = [pscustomobject]@{ ProcessId = 4100; Name = 'node.exe'; CommandLine = 'node C:\x\frontend\node_modules\next dev'; ParentProcessId = 4000 }
            4000 = [pscustomobject]@{ ProcessId = 4000; Name = 'node.exe'; CommandLine = 'npm run dev C:\x\frontend'; ParentProcessId = 0 }
            5500 = [pscustomobject]@{ ProcessId = 5500; Name = 'node.exe'; CommandLine = 'node D:\other\app'; ParentProcessId = 0 }
            6600 = [pscustomobject]@{ ProcessId = 6600; Name = 'Grafana.exe'; CommandLine = 'grafana server'; ParentProcessId = 0 }
            7700 = [pscustomobject]@{ ProcessId = 7700; Name = 'node.exe'; CommandLine = $null; ParentProcessId = 7000 }
        }
        $map = @{}
        foreach ($id in @(@($ProcessIds) | ForEach-Object { $_ -as [int] } | Where-Object { $_ -gt 0 })) {
            if ($table.ContainsKey($id)) { $map[$id] = $table[$id] }
        }
        return $map
    }

    Assert-That 'our frontend matched on its own command line' {
        $state = Get-FrontendListenerState -FrontendPath 'C:\x\frontend' -ListenerPidMap @{ 3000 = @(4100) }
        $state.InUse -and $state.IsByteQuest -and @($state.Processes)[0].ProcessId -eq 4100
    }
    Assert-That 'our frontend matched through its npm parent' {
        (Get-FrontendListenerState -FrontendPath 'C:\x\frontend' -ListenerPidMap @{ 3000 = @(4100, 4000) }).IsByteQuest
    }
    Assert-That 'foreign node app is in use but not ours' {
        $state = Get-FrontendListenerState -FrontendPath 'C:\x\frontend' -ListenerPidMap @{ 3000 = @(5500) }
        $state.InUse -and (-not $state.IsByteQuest) -and $state.Owners -eq 'node.exe (PID 5500)'
    }
    Assert-That 'foreign non-node app is in use but not ours' {
        $state = Get-FrontendListenerState -FrontendPath 'C:\x\frontend' -ListenerPidMap @{ 3000 = @(6600) }
        $state.InUse -and (-not $state.IsByteQuest) -and $state.Owners -eq 'Grafana.exe (PID 6600)'
    }
    Assert-That 'node with no command line and absent parent does not throw' {
        $state = Get-FrontendListenerState -FrontendPath 'C:\x\frontend' -ListenerPidMap @{ 3000 = @(7700) }
        $state.InUse -and (-not $state.IsByteQuest)
    }
    Assert-That 'unresolvable PID falls back to a PID label' {
        (Get-FrontendListenerState -FrontendPath 'C:\x\frontend' -ListenerPidMap @{ 3000 = @(9999) }).Owners -eq 'PID 9999'
    }
    Assert-That 'the -Port parameter is honoured' {
        (Get-FrontendListenerState -FrontendPath 'C:\x\frontend' -ListenerPidMap @{ 3100 = @(4100) } -Port 3100).IsByteQuest
    }
    Assert-That 'helpers hold up under Set-StrictMode -Version Latest' {
        Set-StrictMode -Version Latest
        try {
            ((Get-PortListenerPids -ListenerPidMap @{} -Port 3000).Count -eq 0) -and
            ($null -eq (Get-ProcessDetail -DetailMap @{} -ProcessId $null)) -and
            ((Get-FrontendListenerState -FrontendPath 'C:\x\frontend' -ListenerPidMap @{}).InUse -eq $false)
        }
        finally { Set-StrictMode -Off }
    }
}

Write-Host "`nBackend reuse and native listener discovery"
& {
    function netstat.exe {
        $global:LASTEXITCODE = 0
        '  TCP    127.0.0.1:8000    0.0.0.0:0   LISTENING    3301'
        '  TCP    [::]:8000         [::]:0      LISTENING    3301'
        '  TCP    [::1]:8001        [::]:0      LISTENING    3302'
        '  TCP    10.210.245.210:8000 0.0.0.0:0 LISTENING    3400'
        '  TCP    127.0.0.1:8002    127.0.0.1:9000 ESTABLISHED 3500'
    }
    function Get-NetTCPConnection { throw 'Native listing should be sufficient.' }
    Assert-That 'both TCP families are included and relay-only and established sockets are ignored' {
        $listeners = Get-ListenerPidMap
        ((Get-PortListenerPids -ListenerPidMap $listeners -Port 8000) -join ',') -eq '3301' -and
        ((Get-PortListenerPids -ListenerPidMap $listeners -Port 8001) -join ',') -eq '3302' -and
        (Get-PortListenerPids -ListenerPidMap $listeners -Port 8002).Count -eq 0
    }

    function Get-ProcessDetailMap {
        param($ProcessIds)
        return @{
            3301 = [pscustomobject]@{ Name = 'python.exe'; StartedUtcTicks = 100 }
            3303 = [pscustomobject]@{ Name = 'pwsh.exe'; StartedUtcTicks = 200 }
        }
    }
    function Get-CimInstance {
        param($ClassName, $Filter)
        if ($workerAlive -and $Filter -eq "ParentProcessId = 3303 AND Name = 'python.exe'") {
            [pscustomobject]@{ ProcessId = 3310 }
        }
    }
    $runtime = [pscustomobject]@{
        ApiPort = 8000; ApiPid = 3301; ApiStartedUtcTicks = 100
        SupervisorPid = 3303; SupervisorStartedUtcTicks = 200
    }
    $listenerMap = @{ 8000 = @(3301) }
    $workerAlive = $true
    Assert-That 'owned API and its live worker may be reused' {
        Test-LocalBackendProcesses -State $runtime -ListenerPidMap $listenerMap
    }
    Assert-That 'a listener replacement at the same port is rejected' {
        -not (Test-LocalBackendProcesses -State $runtime -ListenerPidMap @{ 8000 = @(3400) })
    }
    Assert-That 'an identical PID with a new launch time is rejected' {
        $runtime.ApiStartedUtcTicks = 10
        try { -not (Test-LocalBackendProcesses -State $runtime -ListenerPidMap $listenerMap) }
        finally { $runtime.ApiStartedUtcTicks = 100 }
    }
    $workerAlive = $false
    Assert-That 'a supervisor without a running worker is rejected' {
        -not (Test-LocalBackendProcesses -State $runtime -ListenerPidMap $listenerMap)
    }
}

Write-Host "`n[8] The frontend counts as ready only when its page scripts load"
# Startup once opened every page stuck on "Loading...": an old `next start`
# outlived a rebuild, so its HTML answered 200 but pointed at deleted chunks.
$pageHtml = '<html><head><script src="/_next/static/chunks/main-a1.js" async=""></script>' +
    '<link rel="preload" href="/_next/static/media/font.woff2"/></head><body>' +
    '<script>self.__next_f.push([1,"2:I[\"/_next/static/chunks/page-b2.js\",\"/_next/static/chunks/main-a1.js\"]"])</script>' +
    '<script src="/_next/static/chunks/dpl-c3.js?dpl=abc"></script>' +
    '<a href="/_next/static/build/_buildManifest.json">x</a></body></html>'
Assert-That 'collects src and RSC-payload scripts once, skipping fonts and json' {
    ((Get-PageScriptPaths -Html $pageHtml) -join ',') -eq '/_next/static/chunks/main-a1.js,/_next/static/chunks/page-b2.js,/_next/static/chunks/dpl-c3.js'
}
Assert-That 'empty or null HTML yields no scripts' {
    (Get-PageScriptPaths -Html '').Count -eq 0 -and (Get-PageScriptPaths -Html $null).Count -eq 0
}

# A fake site in place of the network, so the readiness decision is what is tested.
$script:FakeSite = @{}
function Invoke-WebRequest {
    param($Uri, $TimeoutSec, [switch]$UseBasicParsing)
    $path = ([uri]$Uri).PathAndQuery
    if ($script:FakeSite.ContainsKey($path)) { return [pscustomobject]@{ StatusCode = 200; Content = $script:FakeSite[$path] } }
    throw "404 Not Found: $path"
}
$pageUri = 'http://127.0.0.1:3000/onboarding?startup_auth=1'
Assert-That 'page and every script load -> ready' {
    $script:FakeSite = @{
        '/onboarding?startup_auth=1'          = $pageHtml
        '/_next/static/chunks/main-a1.js'     = 'js'
        '/_next/static/chunks/page-b2.js'     = 'js'
        '/_next/static/chunks/dpl-c3.js'      = 'js'
    }
    Test-FrontendAssets -Uri $pageUri
}
Assert-That 'page answers but a chunk is gone (stale server after rebuild) -> not ready' {
    $script:FakeSite = @{
        '/onboarding?startup_auth=1'      = $pageHtml
        '/_next/static/chunks/main-a1.js' = 'js'
        '/_next/static/chunks/dpl-c3.js'  = 'js'
    }
    -not (Test-FrontendAssets -Uri $pageUri)
}
Assert-That 'page does not answer -> not ready' {
    $script:FakeSite = @{}
    -not (Test-FrontendAssets -Uri $pageUri)
}
Assert-That 'page with no Next.js scripts -> not ready' {
    $script:FakeSite = @{ '/onboarding?startup_auth=1' = '<html>Some other app</html>' }
    -not (Test-FrontendAssets -Uri $pageUri)
}
Remove-Item Function:\Invoke-WebRequest

Write-Host "`n[9] The launcher never serves a rebuilt .next from an old server"
$buildAt = $launcherText.IndexOf('& npm run build')
$stopBeforeBuildAt = $launcherText.LastIndexOf('Stop-ByteQuestFrontend', $buildAt)
$assetGateAt = $launcherText.IndexOf('Test-FrontendAssets -Uri $frontendUrl')
$openBrowserAt = $launcherText.IndexOf('Start-Process $frontendUrl')
Assert-That 'the old frontend is stopped before the build replaces .next' {
    $buildAt -gt 0 -and $stopBeforeBuildAt -gt $launcherText.IndexOf('Check the offline frontend build') -and $stopBeforeBuildAt -lt $buildAt
}
Assert-That 'page scripts are verified before the browser opens' {
    $assetGateAt -gt 0 -and $openBrowserAt -gt $assetGateAt
}

Write-Host "`n[10] Supabase readiness and local settings"
& {
    $localAst = [System.Management.Automation.Language.Parser]::ParseFile(
        (Join-Path $infraPath 'start-local.ps1'), [ref]$null, [ref]$null)
    $helpers = @('Test-ByteQuestServiceUp', 'Wait-ByteQuestEssentialServices', 'Add-ByteQuestFallbackValues',
        'Get-ByteQuestStackAction', 'Get-ByteQuestStoppedContainers', 'Protect-ByteQuestLogText',
        'Write-ByteQuestSupabaseDiagnostics')
    foreach ($definition in $localAst.FindAll({
        $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -in $helpers
    }, $true)) {
        . ([scriptblock]::Create($definition.Extent.Text))
    }

    $startingDb = @{ db = @{ State = 'running'; Status = 'Up 2 seconds (health: starting)' } }
    $healthyDb = @{ State = 'running'; Status = 'Up 5 seconds (healthy)' }
    function Start-Sleep { param([int]$Seconds) }
    function Get-ByteQuestServiceState {
        param($ProjectId)
        @{ db = $healthyDb; studio = @{ State = 'running'; Status = 'Up 1 second (health: starting)' } }
    }

    Assert-That 'a running database that is still warming counts as unready' {
        $result = Wait-ByteQuestEssentialServices -ProjectId 'test' -Services @('db') -State $startingDb -TimeoutSeconds 0
        ($result.Down -join ',') -eq 'db'
    }
    Assert-That 'startup waits for Postgres and ignores an optional service that is still warming' {
        $result = Wait-ByteQuestEssentialServices -ProjectId 'test' -Services @('db') -State $startingDb
        $result.Down.Count -eq 0 -and $result.State.db.Status -eq $healthyDb.Status
    }
    Assert-That 'a missing required container counts as unready' {
        $result = Wait-ByteQuestEssentialServices -ProjectId 'test' -Services @('db') -State @{} -TimeoutSeconds 0
        ($result.Down -join ',') -eq 'db'
    }

    function Get-ByteQuestPublishedPort {
        param($Container, $ContainerPort)
        @{ supabase_db_test = 15432; supabase_kong_test = 15431 }[$Container]
    }
    function Get-ByteQuestContainerSetting {
        param($Container, $Names)
        $settings = @{
            supabase_db_test      = @{ POSTGRES_PASSWORD = 'test@password' }
            supabase_auth_test    = @{ GOTRUE_JWT_SECRET = 'test-jwt' }
            supabase_storage_test = @{ ANON_KEY = 'test-anon'; SERVICE_KEY = 'test-service' }
        }
        if ($settings.ContainsKey($Container)) { $settings[$Container][$Names[0]] }
    }
    Assert-That 'an empty CLI response can be recovered from the active containers' {
        $values = @{}
        Add-ByteQuestFallbackValues -Values $values -ProjectId 'test'
        $values.API_URL -eq 'http://127.0.0.1:15431' -and
            $values.DB_URL -eq 'postgresql://postgres:test%40password@127.0.0.1:15432/postgres' -and
            $values.JWT_SECRET -eq 'test-jwt' -and $values.ANON_KEY -eq 'test-anon' -and $values.SERVICE_ROLE_KEY -eq 'test-service'
    }

    # Resume or rebuild: the decision the launcher makes before touching Docker.
    $up = @{ State = 'running'; Status = 'Up 5 minutes (healthy)' }
    $required = @('db', 'storage')
    Assert-That 'no containers means a fresh start' {
        (Get-ByteQuestStackAction -State @{} -Services $required) -eq 'start'
    }
    Assert-That 'a missing required container means a rebuild' {
        (Get-ByteQuestStackAction -State @{ db = $up; studio = $up } -Services $required) -eq 'rebuild'
    }
    Assert-That 'a dead required container means a rebuild' {
        (Get-ByteQuestStackAction -State @{ db = $up; storage = @{ State = 'dead'; Status = 'Dead' } } -Services $required) -eq 'rebuild'
    }
    Assert-That 'a stopped required container is resumed in place' {
        (Get-ByteQuestStackAction -State @{ db = @{ State = 'exited'; Status = 'Exited (0) 2 hours ago' }; storage = $up } -Services $required) -eq 'resume'
    }
    Assert-That 'a running stack is reused even while Postgres warms up' {
        (Get-ByteQuestStackAction -State @{ db = @{ State = 'running'; Status = 'Up 2 seconds (health: starting)' }; storage = $up } -Services $required) -eq 'reuse'
    }
    Assert-That 'a reused stack that stays unhealthy is rebuilt' {
        (Get-ByteQuestStackAction -State @{ db = @{ State = 'running'; Status = 'Up 3 minutes (unhealthy)' }; storage = $up } -Services $required -AfterWait) -eq 'rebuild'
    }
    Assert-That 'a stack that lost its port mappings is rebuilt' {
        (Get-ByteQuestStackAction -State @{ db = $up; storage = $up } -Services $required -AfterWait -PortsMapped $false) -eq 'rebuild'
    }
    Assert-That 'a healthy stack with its ports is ready' {
        (Get-ByteQuestStackAction -State @{ db = $up; storage = $up } -Services $required -AfterWait) -eq 'ready'
    }
    Assert-That 'only stopped containers are resumed' {
        $state = @{ db = @{ State = 'exited' }; storage = $up; inbucket = @{ State = 'created' } }
        $stopped = @(Get-ByteQuestStoppedContainers -State $state -Services @('db', 'storage', 'inbucket', 'kong') -ProjectId 'test')
        ($stopped -join ',') -eq 'supabase_db_test,supabase_inbucket_test'
    }

    # Failure log: container logs are kept, with secrets masked.
    Assert-That 'tokens, keys and passwords are masked in saved logs' {
        $jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl'
        $line = Protect-ByteQuestLogText "key=$jwt url=postgresql://postgres:s3cret@db:5432/postgres ALTER ROLE x PASSWORD 'hunter2' password=letmein sb_secret_abc123"
        $line -notmatch 'eyJ|s3cret|hunter2|letmein|sb_secret_abc' -and $line -match '\[redacted'
    }
    Assert-That 'the failure log keeps each container status and its masked logs' {
        function docker { 'FATAL: could not open file "base/1/2600"'; 'apikey eyJa1.eyJb2.c3' }
        $logPath = Join-Path ([System.IO.Path]::GetTempPath()) ("bytequest-diag-test-" + [guid]::NewGuid().ToString('N') + '.log')
        try {
            $state = @{ db = @{ State = 'running'; Status = 'Up 3 minutes (unhealthy)' } }
            Write-ByteQuestSupabaseDiagnostics -Path $logPath -Heading 'test heading' -ProjectId 'test' -Services @('db', 'kong') -State $state
            $text = Get-Content -LiteralPath $logPath -Raw
            $text -match 'test heading' -and
                $text -match '\[supabase_db_test\] Up 3 minutes \(unhealthy\)' -and
                $text -match 'could not open file' -and
                $text -match '\[supabase_kong_test\] missing' -and
                $text -notmatch 'eyJa1'
        }
        finally { Remove-Item -LiteralPath $logPath -Force -ErrorAction SilentlyContinue }
    }
}

# --------------------------------------------------------------------------
Write-Host ""
if ($script:Failures -gt 0) {
    Write-Host "$script:Failures check(s) failed." -ForegroundColor Red
    exit 1
}
Write-Host "All launcher helper checks passed." -ForegroundColor Green
exit 0
