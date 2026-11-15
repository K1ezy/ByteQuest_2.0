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

# --------------------------------------------------------------------------
Write-Host ""
if ($script:Failures -gt 0) {
    Write-Host "$script:Failures check(s) failed." -ForegroundColor Red
    exit 1
}
Write-Host "All launcher helper checks passed." -ForegroundColor Green
exit 0
