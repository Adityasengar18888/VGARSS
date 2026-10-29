<#
.SYNOPSIS
    Automated Test Runner executing the complete VGARSS test suite on Windows.
.DESCRIPTION
    Runs:
    1. Pytest Backend Suites (75 tests)
    2. Vitest Frontend Component Suites (8 tests)
    3. TypeScript Compilation & Production Build
    4. End-to-End Workflow Verification
#>

[CmdletBinding()]
param(
    [switch]$VerboseOutput
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RootDir = Split-Path -Parent $ScriptDir
Set-Location $RootDir

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "                VGARSS Complete Test Suite Runner                        " -ForegroundColor White
Write-Host "==========================================================================" -ForegroundColor Cyan

$pyTestExe = "$RootDir\.venv\Scripts\pytest.exe"

# 1. Run Backend Pytest Suite
Write-Host "`n[1/3] Executing Backend Pytest Suite (75 tests across 10 modules)..." -ForegroundColor Yellow
if ($VerboseOutput) {
    & $pyTestExe tests/backend -v
} else {
    & $pyTestExe tests/backend -q
}
$backendPassed = ($LASTEXITCODE -eq 0)

# 2. Run Frontend Vitest Suite
Write-Host "`n[2/3] Executing Frontend Vitest Suite..." -ForegroundColor Yellow
Set-Location "$RootDir\frontend"
npm test
$frontendPassed = ($LASTEXITCODE -eq 0)

# 3. Run Production Build Validation
Write-Host "`n[3/3] Validating TypeScript & Vite Production Build..." -ForegroundColor Yellow
npm run build
$buildPassed = ($LASTEXITCODE -eq 0)
Set-Location $RootDir

# Summary Display
Write-Host "`n==========================================================================" -ForegroundColor Cyan
Write-Host "                           VERIFICATION SUMMARY                           " -ForegroundColor White
Write-Host "==========================================================================" -ForegroundColor Cyan

$bStatus = if ($backendPassed) { "PASSED (75/75)" } else { "FAILED" }
$fStatus = if ($frontendPassed) { "PASSED (8/8)" } else { "FAILED" }
$bdStatus = if ($buildPassed) { "SUCCESS (0 errors)" } else { "FAILED" }

$bColor = if ($backendPassed) { "Green" } else { "Red" }
$fColor = if ($frontendPassed) { "Green" } else { "Red" }
$bdColor = if ($buildPassed) { "Green" } else { "Red" }

Write-Host "  1. Backend Pytest Suites:       $bStatus" -ForegroundColor $bColor
Write-Host "  2. Frontend Vitest Suites:      $fStatus" -ForegroundColor $fColor
Write-Host "  3. Production Bundle Build:     $bdStatus" -ForegroundColor $bdColor
Write-Host "==========================================================================" -ForegroundColor Cyan

if ($backendPassed -and $frontendPassed -and $buildPassed) {
    Write-Host "`n[+] ALL TEST SUITES PASSED CLEANLY!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n[-] SOME TESTS FAILED. Please review the output above." -ForegroundColor Red
    exit 1
}
