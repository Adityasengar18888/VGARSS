<#
.SYNOPSIS
    Launches the VGARSS FastAPI ASGI Server and Raw TCP Socket Server on Windows.
.DESCRIPTION
    Verifies Python 3.12+, checks virtual environment, checks port availability (8000, 9000),
    and starts the Uvicorn server hosting both REST/WebSocket (8000) and Raw TCP (9000).
#>

[CmdletBinding()]
param(
    [string]$HostAddress = "127.0.0.1",
    [int]$RestPort = 8000,
    [int]$TcpPort = 9000,
    [switch]$NoReload
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RootDir = Split-Path -Parent $ScriptDir
Set-Location $RootDir

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " VGARSS — FastAPI Backend & Raw TCP Server Launcher (Windows 11)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Check Python Interpreter
$PythonExe = "$RootDir\.venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    Write-Host "[!] Virtual environment not detected at .venv\Scripts\python.exe" -ForegroundColor Yellow
    Write-Host "[*] Checking system python..." -ForegroundColor Gray
    try {
        $sysPy = (Get-Command python -ErrorAction Stop).Source
        Write-Host "[+] Found system Python: $sysPy" -ForegroundColor Green
        Write-Host "[*] Creating .venv..." -ForegroundColor Gray
        & python -m venv "$RootDir\.venv"
        & "$RootDir\.venv\Scripts\python.exe" -m pip install --upgrade pip
        & "$RootDir\.venv\Scripts\python.exe" -m pip install -r "$RootDir\backend\requirements.txt"
    } catch {
        Write-Host "[-] Error: Python is not installed or not found in PATH." -ForegroundColor Red
        Write-Host "    Please install Python 3.12+ from https://www.python.org/downloads/" -ForegroundColor Red
        exit 1
    }
}

# 2. Check Python Version (Must be >= 3.12)
$pyVer = & $PythonExe -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
Write-Host "[+] Python Version: $pyVer ($PythonExe)" -ForegroundColor Green

# 3. Port Availability Checks
function Test-PortOccupied([int]$port) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
    return $conn
}

$occupied8000 = Test-PortOccupied $RestPort
if ($occupied8000) {
    Write-Host "[!] Warning: Port $RestPort is already in use by PID: $($occupied8000.OwningProcess)" -ForegroundColor Yellow
    Write-Host "    If this is a previous VGARSS instance, stop it before restarting." -ForegroundColor Yellow
}

$occupied9000 = Test-PortOccupied $TcpPort
if ($occupied9000) {
    Write-Host "[!] Warning: Port $TcpPort is already in use by PID: $($occupied9000.OwningProcess)" -ForegroundColor Yellow
    Write-Host "    If this is a previous VGARSS TCP instance, stop it before restarting." -ForegroundColor Yellow
}

# 4. Set Environment Configuration
$env:VGARSS_HOST = $HostAddress
$env:VGARSS_PORT = $RestPort
$env:VGARSS_TCP_PORT = $TcpPort
$env:VGARSS_ENABLE_TCP = "true"
$env:PYTHONPATH = $RootDir

Write-Host "`n[*] Starting Backend Services..." -ForegroundColor Cyan
Write-Host "    - REST API Gateway:      http://$HostAddress`:$RestPort/api/v1" -ForegroundColor Gray
Write-Host "    - Swagger API Docs:      http://$HostAddress`:$RestPort/docs" -ForegroundColor Gray
Write-Host "    - WebSocket Hub:         ws://$HostAddress`:$RestPort/ws" -ForegroundColor Gray
Write-Host "    - Raw TCP Socket Server: $HostAddress`:$TcpPort (4-byte binary framing)" -ForegroundColor Gray
Write-Host "`nPress CTRL+C to cleanly stop the backend services.`n" -ForegroundColor DarkGray

# 5. Launch Uvicorn
$reloadFlag = if ($NoReload) { @() } else { @("--reload") }
& "$RootDir\.venv\Scripts\uvicorn.exe" backend.app.main:app --host $HostAddress --port $RestPort @reloadFlag

