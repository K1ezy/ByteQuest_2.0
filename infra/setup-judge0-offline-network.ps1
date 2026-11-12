[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$VmName,
    [Parameter(Mandatory)][string]$SshUser,
    [Parameter(Mandatory)][string]$CurrentIp
)

$ErrorActionPreference = 'Stop'
$switchName = 'ByteQuest Offline'
$guestIp = '172.30.95.2'
$hostIp = '172.30.95.1'
$adapterName = 'ByteQuest Offline'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
. (Join-Path $PSScriptRoot 'launcher-common.ps1')
$yamlPath = Join-Path $repoRoot 'logs/bytequest-offline-netplan.yaml'

if (Test-TcpPort -ComputerName $guestIp -Port 22 -TimeoutMilliseconds 1000) {
    Write-Host "Judge0 VM already responds on its host-only address $guestIp."
    return
}

Import-Module Hyper-V -ErrorAction Stop
$vm = Get-VM -Name $VmName -ErrorAction Stop
$switch = Get-VMSwitch -Name $switchName -ErrorAction SilentlyContinue
if ($switch -and $switch.SwitchType -ne 'Internal') {
    throw "A non-internal Hyper-V switch already uses the name '$switchName'. Resolve that conflict before continuing."
}
if (-not $switch) {
    $conflict = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -like '172.30.95.*' }
    if ($conflict) { throw '172.30.95.0/24 is already used by another adapter. Choose a free host-only subnet before setup.' }
    New-VMSwitch -Name $switchName -SwitchType Internal | Out-Null
}

$hostAlias = "vEthernet ($switchName)"
$adapterDeadline = (Get-Date).AddSeconds(15)
while (-not (Get-NetAdapter -Name $hostAlias -ErrorAction SilentlyContinue)) {
    if ((Get-Date) -ge $adapterDeadline) { throw "Windows did not create the $hostAlias adapter." }
    Start-Sleep -Milliseconds 500
}
if (-not (Get-NetIPAddress -InterfaceAlias $hostAlias -IPAddress $hostIp -ErrorAction SilentlyContinue)) {
    New-NetIPAddress -InterfaceAlias $hostAlias -IPAddress $hostIp -PrefixLength 24 -AddressFamily IPv4 | Out-Null
}

$adapter = Get-VMNetworkAdapter -VMName $VmName -Name $adapterName -ErrorAction SilentlyContinue
if (-not $adapter) {
    Add-VMNetworkAdapter -VMName $VmName -Name $adapterName -SwitchName $switchName
    $adapter = Get-VMNetworkAdapter -VMName $VmName -Name $adapterName -ErrorAction Stop
}
elseif ($adapter.SwitchName -ne $switchName) {
    Connect-VMNetworkAdapter -VMName $VmName -Name $adapterName -SwitchName $switchName
}

$mac = ([string]$adapter.MacAddress) -replace '[^0-9A-Fa-f]', ''
if ($mac.Length -ne 12 -or $mac -eq '000000000000') {
    throw "Hyper-V did not report the new VM adapter MAC address. Check the VM and rerun preparation."
}
$macAddress = (($mac.ToLowerInvariant() -split '([0-9a-f]{2})' | Where-Object { $_ }) -join ':')

@"
network:
  version: 2
  ethernets:
    bytequest-offline:
      match:
        macaddress: "$macAddress"
      addresses: [$guestIp/24]
      dhcp4: false
      optional: true
"@ | Set-Content -LiteralPath $yamlPath -Encoding utf8

try {
    Write-Host 'Configuring the Ubuntu guest. SSH and sudo may ask for the existing VM password.'
    & scp.exe -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 $yamlPath "${SshUser}@${CurrentIp}:/tmp/bytequest-offline.yaml"
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy the host-only network configuration to Ubuntu.' }
    & ssh.exe -tt -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "${SshUser}@${CurrentIp}" `
        'sudo install -m 600 /tmp/bytequest-offline.yaml /etc/netplan/60-bytequest-offline.yaml && sudo sh -c "nohup netplan apply >/tmp/bytequest-offline-netplan.log 2>&1 </dev/null &"'
    if ($LASTEXITCODE -ne 0 -and -not (Test-TcpPort -ComputerName $guestIp -Port 22 -TimeoutMilliseconds 1000)) {
        throw 'Ubuntu did not accept the host-only network configuration.'
    }
}
finally {
    Remove-Item -LiteralPath $yamlPath -Force -ErrorAction SilentlyContinue
}

$deadline = (Get-Date).AddSeconds(45)
while ((Get-Date) -lt $deadline) {
    if (Test-TcpPort -ComputerName $guestIp -Port 22 -TimeoutMilliseconds 1000) {
        Write-Host "Judge0 VM is reachable at $guestIp over the host-only switch."
        return
    }
    Start-Sleep -Seconds 2
}
throw "The host-only link was configured, but Ubuntu SSH did not answer at $guestIp`:22. Check 'ip -4 addr' and '/tmp/bytequest-offline-netplan.log' in the VM."
