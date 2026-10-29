<#
.SYNOPSIS
    Launches the VGARSS React + TypeScript + Vite Frontend on Windows.
.DESCRIPTION
    Verifies Node.js and npm, checks frontend dependencies, checks port 5173,
    and starts the Vite development server with Hot Module Replacement (HMR).
#>

[CmdletBinding()]
param(
    [int]$Port = 5173
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RootDir = Split-Path -Parent $ScriptDir
$FrontendDir = Join-Path $RootDir "frontend"
Set-Location $FrontendDir

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " VGARSS — React Infrastructure Dashboard Launcher (Windows 11)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Check Node.js and npm
try {
    $nodeVer = (Get-Command node -ErrorAction Stop)
    $npmVer = (Get-Command npm -ErrorAction Stop)
    $nodeV = & node -v
    $npmV = & npm -v
    Write-Host "[+] Found Node.js: $nodeV" -ForegroundColor Green
    Write-Host "[+] Found npm:     $npmV" -ForegroundColor Green
} catch {
    Write-Host "[-] Error: Node.js or npm is not found in PATH." -ForegroundColor Red
    Write-Host "    Please install Node.js 20+ LTS from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# 2. Check node_modules
if (-not (Test-Path "$FrontendDir\node_modules")) {
    Write-Host "[*] node_modules not detected. Installing dependencies via npm install..." -ForegroundColor Yellow
    npm install
}

# 3. Port Availability Check
$occupied5173 = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
if ($occupied5173) {
    Write-Host "[!] Warning: Port $Port is already in use by PID: $($occupied5173.OwningProcess)" -ForegroundColor Yellow
}

Write-Host "`n[*] Starting Vite Development Server..." -ForegroundColor Cyan
Write-Host "    - Web Dashboard URL: http://localhost:$Port" -ForegroundColor Gray
Write-Host "    - Vite HMR Active" -ForegroundColor Gray
Write-Host "`nPress CTRL+C to stop the frontend server.`n" -ForegroundColor DarkGray

npm run dev

