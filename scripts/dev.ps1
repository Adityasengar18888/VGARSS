<#
.SYNOPSIS
    Unified Development & Demonstration Launcher for VGARSS on Windows 11.
.DESCRIPTION
    Checks system prerequisites, validates ports (8000, 9000, 5173),
    and launches both the FastAPI Backend (with TCP Server) and the Vite Frontend.
    Provides options to launch in separate terminal windows or managed background jobs.
#>

[CmdletBinding()]
param(
    [switch]$SeparateWindows,
    [switch]$RunTestsFirst
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RootDir = Split-Path -Parent $ScriptDir
Set-Location $RootDir

Clear-Host
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "   VGARSS — Virtual Group Asynchronous Real-Time Resource Synchronization" -ForegroundColor Cyan
Write-Host "                 Unified Windows 11 Development Launcher                 " -ForegroundColor White
Write-Host "==========================================================================" -ForegroundColor Cyan

# 1. Environment & Prerequisite Audit
Write-Host "`n[*] Verifying System Prerequisites..." -ForegroundColor Yellow

$allPassed = $true

# Python check
try {
    $pyVer = & "$RootDir\.venv\Scripts\python.exe" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')"
    Write-Host "  [OK] Python 3.12:    $pyVer (.venv)" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Python:       .venv Python not found or incompatible." -ForegroundColor Red
    $allPassed = $false
}

# Node.js check
try {
    $nodeVer = & node -v
    Write-Host "  [OK] Node.js:        $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Node.js:      node executable not found in PATH." -ForegroundColor Red
    $allPassed = $false
}

# npm check
try {
    $npmVer = & npm -v
    Write-Host "  [OK] npm:            v$npmVer" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] npm:          npm executable not found in PATH." -ForegroundColor Red
    $allPassed = $false
}

if (-not $allPassed) {
    Write-Host "`n[-] Prerequisite checks failed. Please review docs/setup-windows.md" -ForegroundColor Red
    exit 1
}

# 2. Port Conflict Inspection
Write-Host "`n[*] Checking Port Allocations..." -ForegroundColor Yellow
$portsToCheck = @(8000, 9000, 5173)
$portConflicts = @()

foreach ($p in $portsToCheck) {
    $conn = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
    if ($conn) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        Write-Host "  [!] Port $p in use by: $($proc.ProcessName) (PID: $($conn.OwningProcess))" -ForegroundColor Yellow
        $portConflicts += $p
    } else {
        Write-Host "  [OK] Port $p is free." -ForegroundColor Green
    }
}

# 3. Optional Pre-flight Tests
if ($RunTestsFirst) {
    Write-Host "`n[*] Running Pre-flight Test Suite..." -ForegroundColor Yellow
    & "$RootDir\.venv\Scripts\pytest.exe" tests/backend -q
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[-] Pre-flight test suite failed. Aborting launcher." -ForegroundColor Red
        exit 1
    }
    Write-Host "[+] All backend tests passed." -ForegroundColor Green
}

# 4. Launch Services
Write-Host "`n==========================================================================" -ForegroundColor Cyan
Write-Host " Services to be launched:" -ForegroundColor White
Write-Host "   1. FastAPI REST & WebSockets : http://127.0.0.1:8000" -ForegroundColor Gray
Write-Host "   2. Raw TCP Socket Server     : 127.0.0.1:9000 (Length-Prefixed Framing)" -ForegroundColor Gray
Write-Host "   3. React Vite UI Dashboard   : http://localhost:5173" -ForegroundColor Gray
Write-Host "==========================================================================" -ForegroundColor Cyan

if ($SeparateWindows) {
    Write-Host "`n[*] Spawning service processes in dedicated PowerShell windows..." -ForegroundColor Cyan
    Start-Process powershell.exe -ArgumentList "-NoExit", "-File", "$ScriptDir\run-backend.ps1"
    Start-Process powershell.exe -ArgumentList "-NoExit", "-File", "$ScriptDir\run-frontend.ps1"
    Write-Host "[+] Services launched in separate windows." -ForegroundColor Green
    Write-Host "[*] Open http://localhost:5173 in your browser to begin." -ForegroundColor Cyan
    exit 0
}

Write-Host "`n[*] Starting backend and frontend in concurrent mode..." -ForegroundColor Cyan
Write-Host "    Press Ctrl+C to stop all services simultaneously.`n" -ForegroundColor DarkGray

# Start Backend Process
$backendPsi = New-Object System.Diagnostics.ProcessStartInfo
$backendPsi.FileName = "$RootDir\.venv\Scripts\uvicorn.exe"
$backendPsi.Arguments = "backend.app.main:app --host 127.0.0.1 --port 8000"
$backendPsi.WorkingDirectory = $RootDir
$backendPsi.EnvironmentVariables["VGARSS_ENABLE_TCP"] = "true"
$backendPsi.EnvironmentVariables["PYTHONPATH"] = $RootDir
$backendPsi.UseShellExecute = $false

$backendProc = [System.Diagnostics.Process]::Start($backendPsi)

# Start Frontend Process
$frontendPsi = New-Object System.Diagnostics.ProcessStartInfo
$frontendPsi.FileName = "cmd.exe"
$frontendPsi.Arguments = "/c npm run dev"
$frontendPsi.WorkingDirectory = "$RootDir\frontend"
$frontendPsi.UseShellExecute = $false

$frontendProc = [System.Diagnostics.Process]::Start($frontendPsi)

Write-Host "[+] Backend PID: $($backendProc.Id) | Frontend PID: $($frontendProc.Id)" -ForegroundColor Green
Write-Host "[*] Services active. Monitoring... (Press Ctrl+C to terminate cleanly)" -ForegroundColor Cyan

try {
    while (-not $backendProc.HasExited -and -not $frontendProc.HasExited) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host "`n[*] Stopping VGARSS services gracefully..." -ForegroundColor Yellow
    if ($backendProc -and -not $backendProc.HasExited) {
        $backendProc.Kill()
        Write-Host "  [-] Backend terminated." -ForegroundColor Gray
    }
    if ($frontendProc -and -not $frontendProc.HasExited) {
        # Kill cmd and child node processes
        & taskkill.exe /PID $frontendProc.Id /T /F 2>$null | Out-Null
        Write-Host "  [-] Frontend terminated." -ForegroundColor Gray
    }
    Write-Host "[+] All VGARSS services cleanly shut down." -ForegroundColor Green
}

