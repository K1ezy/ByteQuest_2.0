# Judge0 Hyper-V Ubuntu boot incident and recovery

**Incident date:** 2026-10-24 (Asia/Manila)  
**Status:** Judge0 service recovered and verified through the existing `ByteQuest-Judge0-Install` VM. The original `ByteQuest-Judge0` VM's boot problem was not repaired; it was left separate so its disk and checkpoint history could be preserved.  
**Audience:** Future ByteQuest maintainers and anyone helping recover this local Judge0 setup.

## Summary

Ubuntu repeatedly appeared to stop at `/dev/sr0: Can't lookup blockdev`, and the original `ByteQuest-Judge0` VM did not reliably reach a usable login. That line was investigated but was **not established as the cause**. The evidence instead showed that the original VM was booting an Azure-specific Ubuntu image under local Hyper-V and repeatedly trying to contact Azure metadata and WireServer services that are unavailable in this environment.

The practical recovery was to use the already-existing `ByteQuest-Judge0-Install` VM, whose standalone Ubuntu disk contained the working `bytequest` account and Judge0 Extra CE stack. Its disk was copied to a recovery folder and the copy was verified by SHA-256 before the VM was started. The recovered VM's Judge0 server, worker, PostgreSQL, and Redis containers were running; Windows could reach port 2358; the Judge0 API returned HTTP 200; and ByteQuest's configured Judge0 client ran a Python smoke submission successfully (Accepted, 1/1).

This restores the local Judge0 execution service. It does **not** prove that the original VM's GRUB/boot issue is fixed or that the full authenticated student submission, attempt, and XP flow has been verified.

## Current verified state

| Component | Verified state |
|---|---|
| Working VM | `ByteQuest-Judge0-Install`, Ubuntu 22.04.5 LTS, hostname `bytequest-judge0`, user `bytequest`; VM booted to a successful login. |
| Guest kernel | `5.15.0-198-generic` on the working Install VM. This differs from the original VM's Azure kernel. |
| Judge0 stack | Docker showed Judge0 Extra CE 1.13.1 server and workers, PostgreSQL 16.2, and Redis 7.2.4 running. The Compose port mapping published guest port 2358. |
| Persistent volume | `judge0-v1131-extra_data` appeared in `sudo docker volume ls`. The volume exists; this check did not inspect or validate every database record. |
| Guest address at verification | `172.22.69.143` on Hyper-V's Default Switch. This address can change. |
| Windows-to-VM network | `Test-NetConnection 172.22.69.143 -Port 2358` returned `TcpTestSucceeded: True`. |
| Judge0 HTTP endpoint | A request to `http://172.22.69.143:2358/` returned HTTP 200. |
| ByteQuest backend-to-Judge0 | A one-case Python smoke submission through `Judge0Client` returned `successful=True`, `passed=1/1`, `status=Accepted`. It did not create a ByteQuest student attempt or XP record. |
| FastAPI | `http://localhost:8000/docs` displayed the ByteQuest 2.0 API docs. The server must remain running in its PowerShell window. |
| Full student workflow | Subsequently verified: see the [Milestone 1A–1C verification log](../verification/milestone-1a-1b-2026-10-24.md) for authenticated browser, API, attempt, XP, privacy, and authorization evidence. |
| Original `ByteQuest-Judge0` VM | Boot issue remains unresolved/unverified. Keep its VHDX/AVHDX chain and checkpoint intact. |

The current local `backend/.env.local` has `JUDGE0_BASE_URL=http://172.22.69.143:2358`. The API key remains in that ignored local file and was not printed or changed during the URL update. Do not commit the file or paste its contents into a chat.

## How the incident developed

1. **Judge0 was installed in Ubuntu on D:.** The user installed Ubuntu Server 22.04.5, logged in as `bytequest`, installed Docker, unpacked Judge0 Extra CE 1.13.1, and started the Judge0, worker, PostgreSQL, and Redis services. Earlier, the user reported that the Judge0 Extra CE API documentation page loaded.
2. **Host-level Hyper-V trouble delayed access.** Hyper-V first reported insufficient memory for a 4096 MB VM allocation and separately that the hypervisor was not running. The user enabled the hypervisor with elevated `bcdedit /set hypervisorlaunchtype auto`. Later, the VM entered a prolonged `Shutting Down` state. Hyper-V's event log showed a failed state change because a shutdown was already in progress; a matching VM worker process was stopped and VMMS restarted, after which the VM reported Off. A disk merge later completed. These events explain management delays but do not prove guest disk corruption.
3. **The original VM repeatedly failed to reach a usable login.** The console showed `/dev/sr0: Can't lookup blockdev`, followed by no visible login prompt. GRUB recovery and emergency-shell paths were attempted. Several Linux commands were accidentally entered in Windows PowerShell; those commands did not repair the Ubuntu guest.
4. **The original VM was identified as Azure-specific.** Its GRUB entry used kernel `6.8.0-1070-azure`. Cloud-init logs showed repeated failed Azure IMDS requests to `169.254.169.254`; later logs showed Azure Linux Agent (`walinuxagent`) trying to reach Azure WireServer `168.63.129.16`, reporting no route and `Routes:None`. A local Hyper-V guest does not have Azure's metadata service.
5. **Several boot-console changes were made to the original VM.** A temporary GRUB `init=/bin/bash console=tty1` boot reached a root shell. The root filesystem check reported clean; `/etc/fstab` showed root ext4 and `/boot/efi` only, with no `/dev/sr0` or optical-media mount. GRUB serial-console settings were edited and `update-grub` completed. A cloud-init disable marker was proposed and the user reported applying it, but the file was not independently verified. None of this confirmed repair of the original VM's ordinary login.
6. **The separate Install VM was recovered instead of continuing risky edits.** Hyper-V inventory showed `ByteQuest-Judge0-Install` with a standalone disk at `D:\ByteQuestJudge0\install-vm\ubuntu-server.vhdx`. The primary VM used a differencing disk (`.avhdx`) and had an automatic checkpoint, so its disk chain was left untouched.
7. **The Install VM disk backup was verified.** An existing backup was found at `D:\ByteQuestJudge0\recovery-backup-20261024\ubuntu-server.vhdx`. The source and backup had matching SHA-256:

   ```text
   97590097021170A4953AA5D3F568699174179361D45AFC56E5FE5908B06D14CB
   ```

8. **The Install VM booted and its login worked.** It displayed `Ubuntu 22.04.5 LTS bytequest-judge0 tty1`; logging in as `bytequest` with the user's existing VM password succeeded. The password is intentionally not recorded here.
9. **The Judge0 stack and connection were checked.** Docker showed the server, workers, PostgreSQL, and Redis Up, plus the persistent `judge0-v1131-extra_data` volume. The guest IP was then `172.22.69.143`; Windows reached port 2358 and the HTTP endpoint returned 200.
10. **ByteQuest was pointed to the recovered VM.** Only `JUDGE0_BASE_URL` in the ignored `backend/.env.local` was changed from the old `172.20.66.12` address to `172.22.69.143`. The existing API token was preserved. FastAPI was restarted; it displayed its docs at port 8000. One direct Judge0 client smoke submission was Accepted. At one point FastAPI stopped after Ctrl+C; the `KeyboardInterrupt`/`CancelledError` output was the expected result of that interrupt, not an application startup failure.

## What the `Can't lookup blockdev` message means here

`/dev/sr0` is the conventional Linux device name for an optical drive. In this incident:

- The observed `/etc/fstab` did not contain `/dev/sr0`, CD-ROM, ISO9660, or UDF mounts.
- The Hyper-V settings screenshot did not show an attached DVD drive.
- The root filesystem check reported clean.
- The message appeared among early boot messages and was followed by Azure-specific cloud-init/agent retries.

Therefore, the `sr0` line was **not shown to be the cause** of the missing login. Treat it as a likely incidental warning unless new evidence shows an actual required optical device or a failed root disk. Do not edit `/etc/fstab` or remove virtual disks just because this line appears.

The strongest explanation for the original VM's stalled startup is an Azure-provisioned Ubuntu image running locally under Hyper-V, with cloud-init and `walinuxagent` waiting for Azure metadata/network services. This is an evidence-based diagnosis, not proof that those services alone caused the missing login. The specific reason the original VM did not reach a getty/login remains undetermined.

## Repeatable recovery procedure

Use this procedure if the original VM again shows the boot loop, or if the Judge0 address stops working. The working service VM is `ByteQuest-Judge0-Install`.

### 1. Start and open the known-good VM

In **elevated Windows PowerShell**:

```powershell
$vmName = 'ByteQuest-Judge0-Install'
$vm = Get-VM -Name $vmName
if ($vm.State -eq 'Off') {
    Start-VM -Name $vmName
} elseif ($vm.State -ne 'Running') {
    throw "VM state is $($vm.State); stop here and inspect it before proceeding."
}
vmconnect.exe localhost $vmName
```

If already Running, do not start a second copy; open its connection with `vmconnect.exe`. In VMConnect, log in as `bytequest`. Password input is invisible. Do not share or save the password in this document.

### 2. Confirm the Judge0 services and volume inside Ubuntu

At the Ubuntu prompt `bytequest@bytequest-judge0:~$`, run each command separately:

```bash
sudo docker ps -a
sudo docker volume ls
```

The expected services include Judge0 server, Judge0 workers, PostgreSQL, and Redis. A volume named `judge0-v1131-extra_data` should be present. If a service is Exited or Restarting, capture `sudo docker compose ps` and relevant logs before changing or removing anything. Never use `docker compose down -v` or `docker volume prune` during recovery.

### 3. Get the current guest IP and check the port

The Default Switch assigns an address dynamically; do not assume `172.20.66.12` or `172.22.69.143` will remain valid. In Ubuntu, run:

```bash
hostname -I
```

Use the current IPv4 address in **Windows PowerShell**:

```powershell
Test-NetConnection -ComputerName <CURRENT-VM-IP> -Port 2358
```

Replace `<CURRENT-VM-IP>` with the actual address (omit angle brackets). Continue only when `TcpTestSucceeded` is `True`. Then open `http://<CURRENT-VM-IP>:2358/` in a browser; the Judge0 API documentation should respond.

### 4. Update ByteQuest if the VM IP changed

The endpoint belongs in the ignored `backend/.env.local` file. Change only the `JUDGE0_BASE_URL` value to `http://<CURRENT-VM-IP>:2358`; preserve `JUDGE0_API_KEY` exactly as it is and do not print or share the file's contents. The repository helper `infra/configure-judge0-vm.ps1` can also configure the URL, but it prompts for the API token and writes both settings; use it only when the token is available locally.

### 5. Restart FastAPI and leave it running

In the PowerShell terminal that runs ByteQuest's backend, stop an existing Uvicorn process with **Ctrl+C once**, then start it from the backend directory:

```powershell
Set-Location C:\Users\User\Documents\ByteQuest_2.0\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Wait for `Application startup complete`, then leave the terminal open. Ctrl+C after startup shuts FastAPI down, causing `http://localhost:8000/docs` to show connection refused. The warning that trained ML artifacts are unavailable is separate; the application reports that deterministic rule-based sequencing remains active.

### 6. Verify service integration without exposing secrets

Check `http://localhost:8000/docs` loads. The incident's direct one-case Python smoke submission through ByteQuest's `Judge0Client` returned Accepted. For a complete product verification, still perform an authenticated student submission through the ByteQuest UI/API and confirm the intended attempt/XP database effects. Do not treat the Swagger page alone as proof of the student flow.

## Disk and data safety

Hyper-V reported these relevant disk relationships during diagnosis:

- The known-good Install VM uses the standalone `D:\ByteQuestJudge0\install-vm\ubuntu-server.vhdx` disk.
- The original `ByteQuest-Judge0` VM uses a differencing `.avhdx` over `ubuntu-22.04.vhdx` and had an automatic checkpoint.
- The verified Install VM backup is `D:\ByteQuestJudge0\recovery-backup-20261024\ubuntu-server.vhdx`.

Do not delete or rename VHDX/AVHDX files, delete/revert/merge the original VM checkpoint, or reinstall/reformat Ubuntu as routine troubleshooting. Do not run `waagent -deprovision`, `docker compose down -v`, `docker system prune`, or `docker volume prune`. If the original VM needs repair, first make and verify a separate copy of its complete active disk chain and work on that copy; do not improvise disk-chain operations while the VM is running.

## Security and remaining work

- The VM password was described as the user's mobile number. Change it to a strong, unique password once the recovered setup is stable, and never include passwords in screenshots, logs, source control, or this documentation.
- Keep the Judge0 API token only in ignored backend configuration. Never put it in frontend variables or paste it into chat.
- The original VM boot repair remains unresolved. The authenticated browser-to-database student submission flow was completed later; use the linked milestone verification log for that evidence. The recovered service and its current guest IP can change after a restart.

## Earlier detailed troubleshooting handoff

For the pre-recovery console edits, observed GRUB settings, and historical logs, see [the original troubleshooting handoff](judge0-hyperv-ubuntu-boot-handoff-2026-10-24.md). Its initial “Current state” was written before the Install VM was recovered; use this document for the latest status.
