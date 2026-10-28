# Workflow 1 — Environment Diagnostics

## Objective
Verify the health, integrity, and availability of development tools, ports, and execution policies on the Windows host.

## Step-by-Step Procedure
1. Check PowerShell execution policy:
   ```powershell
   Get-ExecutionPolicy -List
   ```
2. Verify Node.js, npm, Python, and Git:
   ```powershell
   node -v; npm -v; python --version; git --version
   ```
3. Check local TCP port availability (8000, 5173, 9000):
   ```powershell
   Get-NetTCPConnection -LocalPort 8000, 5173, 9000 -ErrorAction SilentlyContinue
   ```
4. Verify disk space and RAM:
   ```powershell
   Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Format-Table DeviceId, FreeSpace, Size
   ```
5. Confirm no orphan processes are holding required dev ports.
