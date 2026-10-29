# Judge0 Hyper-V Ubuntu VM: troubleshooting handoff

**Last updated:** 2026-10-24 (Asia/Manila)  
**Purpose:** Preserve the full troubleshooting history and current evidence so another helper can continue without repeating steps or treating guesses as confirmed fixes.

> **Recovery update:** The service was brought back using the existing `ByteQuest-Judge0-Install` VM. The original `ByteQuest-Judge0` boot issue was not conclusively repaired. The current verified status and repeatable recovery steps are in [the Judge0 Hyper-V boot recovery guide](judge0-hyperv-boot-recovery-2026-10-24.md). The sections below record the investigation before that recovery and are historical where they conflict with the guide.

## Current state

- The Hyper-V VM named `ByteQuest-Judge0` is running. The install VM, `ByteQuest-Judge0-Install`, was reported Off.
- Ubuntu does not show a login prompt in VM Connection. The latest screenshot (Screenshot 685) shows repeating Azure Linux Agent messages, including:
  - `Gateway:172.22.64.1`
  - `Routes:None`
  - `WireServer is not responding. Reset dhcp endpoint`
  - `Protocol endpoint not found: [ProtocolError] WireProtocol endpoint is None`
  - `No route exists to 168.63.129.16`
  - retries in the 200s
- This is strong evidence that the Azure Linux Agent (`walinuxagent`) is trying to contact Azure WireServer from a local Hyper-V VM. It does **not**, by itself, prove that the agent is the sole reason a login prompt is absent; console/getty and guest networking still need to be checked.
- Earlier, cloud-init repeatedly tried Azure IMDS at `169.254.169.254` and reported no route / no OVF or IMDS. The later screenshot shows the agent retry loop instead.
- The latest proposed repair, an offline systemd mask for `walinuxagent.service`, has **not** been confirmed as executed. No later output or screenshot verifies it.
- The user reported completing the cloud-init marker-file step and rebooting, but there is no captured `ls` output proving `/etc/cloud/cloud-init.disabled` exists. The later screen no longer shows the previous cloud-init Azure error; that is consistent with the marker working, but does not prove it.

## Confirmed project and Judge0 setup

- The VM is on D: under `D:\ByteQuestJudge0\vm` and was installed as Ubuntu Server 22.04.5 LTS. The root filesystem is an ext4 LVM volume of about 28 GB; the VM disk was configured around 60 GB.
- The image is Azure-specific: the booted kernel seen in GRUB is `6.8.0-1070-azure`.
- The user previously logged into the guest over SSH at `172.20.66.12` as `bytequest`. That address is historical and may have changed after VM/network restarts.
- Judge0 Extra CE 1.13.1 was downloaded and run inside Ubuntu with Docker Compose. A successful API docs page was reported. The Compose stack previously showed PostgreSQL, Redis, Judge0 server on guest port 2358, and workers running.
- `infra/configure-judge0-vm.ps1` was run from Windows PowerShell and reported configuring ByteQuest to use `http://172.20.66.12:2358`; the API token was saved to ignored `backend/.env.local` and not displayed. Treat this IP as stale until checked.
- Closing Docker Desktop on Windows does not stop Docker running inside the Ubuntu guest. The user later said Docker was closed while the VM was in recovery/boot troubleshooting.
- No VM disk, Judge0 database volume, or container data was intentionally deleted. Do not use Hyper-V **Revert**, delete checkpoints, delete VHDX files, reinstall Ubuntu, or run `waagent -deprovision` as part of routine diagnosis.

## What was observed about the disk and `/dev/sr0`

- Early boots stopped visually at `/dev/sr0: Can't lookup blockdev`.
- During a direct root-shell recovery, `cat /etc/fstab` showed only the root ext4 filesystem and `/boot/efi` vfat entry; it showed no `/dev/sr0`, CD-ROM, ISO9660, or UDF mount. No active DVD drive was visible in the Hyper-V SCSI settings screenshot.
- The root filesystem check reported it clean and mounted it read-only for the recovery boot. `mount -o remount,rw /` succeeded and the root was confirmed remounted read/write.
- Therefore, `/dev/sr0` has not been shown to be the cause of the missing login prompt. It is likely incidental; do not change `/etc/fstab` based on that line alone.
- Hyper-V logs earlier showed access-denied messages while adjusting ACLs on `D:\ByteQuestJudge0\vm\cloud-init-seed.vhdx` and `ubuntu-22.04.vhdx`, plus checkpoint merge events. A disk merge later completed successfully. These are historical Hyper-V host events, not proof of guest filesystem corruption.

## Timeline of important events and changes

1. **Ubuntu / Judge0 provisioned.** The user installed Ubuntu on the D: VM, logged in as `bytequest`, installed Docker, downloaded Judge0 Extra CE 1.13.1, brought up its Compose services, and reported the Judge0 Extra CE API docs page working.
2. **Hyper-V startup trouble.** The VM at one point could not start because Hyper-V could not allocate 4096 MB (`0x800705AA`), and separately reported that the hypervisor was not running. The user ran elevated `bcdedit /set hypervisorlaunchtype auto`; the VM later started.
3. **VM hung while shutting down.** `Get-VM` showed `Running / In service`; a VMMS event said the VM was already performing `Shutting Down`. The matching `vmwp.exe` process was stopped by VM GUID and VMMS restarted. `Get-VM` then showed `Off / Operating normally`. This was forceful recovery of a stuck host-side VM state, not a guest disk deletion.
4. **GRUB became accessible.** The user reached the GRUB menu and recovery entries. F-key and Ctrl+Alt+F1/F2 attempts in VM Connection did not change the display.
5. **Direct root shell worked.** Editing the first GRUB `linux /boot/vmlinuz-6.8.0-1070-azure` line and temporarily appending `init=/bin/bash console=tty1`, then pressing Ctrl+X, produced a root prompt `root@(none):/#`. The “cannot set terminal process group” / “no job control” messages were expected for this direct shell.
6. **Root remounted read/write.** `mount -o remount,rw /` succeeded. Linux commands were mistakenly tried once in Windows PowerShell (`grep`, `cp -a`, `mount -o`), where they failed because those are guest Linux commands. Run them only in the Ubuntu shell, not PowerShell.
7. **GRUB console settings changed.** In `/etc/default/grub.d/50-cloudimg-settings.cfg`, the serial-console options `console=ttyS0 earlyprintk=ttyS0` were removed from `GRUB_CMDLINE_LINUX`, retaining `console=tty1` and `nvme_core.io_timeout=240`. `GRUB_TERMINAL=serial` was changed to `GRUB_TERMINAL=console`, then `update-grub` completed successfully and found the kernel and initrd. This made the GRUB menu visible in VM Connection. These are persistent edits and should be inspected before further GRUB changes.
8. **Azure cloud-init errors identified.** A normal boot displayed repeated attempts to Azure IMDS at `169.254.169.254`, then `Azure datasource failure` / `No OVF or IMDS available`. This local Hyper-V VM is not an Azure VM.
9. **Cloud-init marker proposed/applied, but not verified.** The user was instructed in the direct root shell to run `touch /etc/cloud/cloud-init.disabled`, followed by `sync && reboot -f`. The user said “done” and later reached the normal GRUB menu. No terminal output confirms the marker file. Canonical documents this file as a way to prevent cloud-init from starting on subsequent systemd boots: https://docs.cloud-init.io/en/latest/howto/disable_cloud_init.html. Disabling cloud-init can also prevent future cloud-init network provisioning; inspect the existing Netplan configuration before changing more networking settings.
10. **Latest boot changed to Azure Agent loop.** Screenshot 685 no longer shows the earlier cloud-init traceback; it shows Azure Linux Agent WireServer retries (`168.63.129.16`) and `Routes:None`, gateway `172.22.64.1`, while no login prompt is visible. The message matches the `walinuxagent.service` Azure Linux Agent. This is likely another Azure-specific component inappropriate for this local Hyper-V environment.

## Known guest settings and identifiers

- `/etc/fstab` observed in the recovery shell:
  - root: ext4, UUID beginning `148a4c5b-813f-4ab0-abaa-a6db1ca2a681`, mounted at `/`, options include `errors=remount-ro`
  - `/boot/efi`: vfat, UUID beginning `DE51-7A7E`
  - no optical-media mount
- `/etc/default/grub.d/40-force-partuuid.cfg` contained `GRUB_FORCE_PARTUUID=7c72ce3c-8c74-4e43-a7a4-1b57822f1c25` when inspected. Do not change it without verifying the actual disk PARTUUID; `update-grub` previously found and included both kernel and initrd.
- `/etc/default/grub.d/50-cloudimg-settings.cfg` was observed to include Azure cloud-image settings and originally had serial-console options. It also contained a 1-second GRUB timeout/countdown and serial settings. It has since been edited as described above.
- Current guest network address is unknown. `172.20.66.12` worked previously; latest screenshot shows a gateway of `172.22.64.1` and no routes in the Azure agent’s report.
- Do not put the user's password or API token into this note, screenshots, terminal output, or another service.

## Historical recommendation written before the Install VM recovery

**Historical note:** This section records advice from before the separate Install VM was recovered. It is not the current recovery procedure. The original Azure-image VM remains unresolved; the working `ByteQuest-Judge0-Install` VM restored Judge0 service, and the later student workflow is verified in [the milestone log](../verification/milestone-1a-1b-2026-10-24.md). Do not repeat these original-VM repair steps for routine Judge0 recovery.

The user is frustrated and wants a competent independent diagnosis; avoid asking them to repeat the same wait/Enter/F-key steps. Start by acknowledging the failed loop and use the evidence above.

1. Treat this as an Azure-cloud-image-on-Hyper-V compatibility issue. There are at least two Azure-specific components in the evidence: cloud-init’s Azure datasource and the Azure Linux Agent (`walinuxagent`). The original `/dev/sr0` message is not established as causal.
2. The offline mask suggested but not yet confirmed is:

   ```text
   systemctl --root=/ mask walinuxagent.service
   ```

   It was proposed because Microsoft documents the Ubuntu service name as `walinuxagent.service` (and `service walinuxagent`): https://github.com/Azure/WALinuxAgent. Do not assume it succeeded. In the direct Bash root shell, `systemctl --root=/ ...` is intended to write the mask into the mounted guest filesystem without requiring the guest's systemd bus.
3. Before or alongside masking the agent, verify `/etc/cloud/cloud-init.disabled` and inspect `/etc/netplan/*.yaml`. The latest log's `Routes:None` means network behavior must be checked; do not blindly remove network configuration or disable more services.
4. If masking the agent, reboot normally and then separately verify (a) a local `bytequest-judge0 login:` prompt, (b) guest DHCP/default route and IP, (c) SSH from Windows, and only then (d) Judge0 API at the current guest IP on port 2358. A visible agent log loop stopping is not sufficient proof that login/network/Judge0 are fixed.
5. If no login appears after Azure agent output stops, inspect/enable the local `getty@tty1` service and confirm console settings. The guest previously accepted input in the direct `init=/bin/bash` shell, so the VMConnect keyboard itself was not completely unusable.
6. Do not reinstall or reformat as a first response. The direct-shell method has worked and the root filesystem check reported clean. If a fresh Ubuntu install is eventually chosen, preserve the existing VM disk and Judge0 data first and explain the consequences before destructive actions.

## Direct-shell recovery method that worked

Use only if another helper needs to inspect or repair the guest:

1. In VM Connection, **Action → Reset**.
2. At GRUB, highlight Ubuntu and press `e`.
3. On the first `linux /boot/vmlinuz-...` line (above the `initrd` line), press Ctrl+E and append ` init=/bin/bash console=tty1` to that same line.
4. Press Ctrl+X. At `root@(none):/#`, the guest is in a temporary direct Bash boot; remount root read/write before changing files:

   ```text
   mount -o remount,rw /
   ```

5. This GRUB `init=/bin/bash` change is temporary for that boot. Do not type the prompt text (`root@(none):/#`) as part of commands. Linux commands belong in this guest shell, not Windows PowerShell.

## Sources

- Cloud-init: disabling cloud-init with `/etc/cloud/cloud-init.disabled`: https://docs.cloud-init.io/en/latest/howto/disable_cloud_init.html
- Azure Linux Agent upstream project: https://github.com/Azure/WALinuxAgent
- Microsoft support material identifies `walinuxagent.service` as the Azure Linux Agent service: https://github.com/MicrosoftDocs/SupportArticles-docs/blob/main/support/azure/virtual-machines/linux/linux-azure-guest-agent.md
