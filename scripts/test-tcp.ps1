<#
.SYNOPSIS
    Demonstration Client for the VGARSS Raw TCP Socket Server on Port 9000.
.DESCRIPTION
    Encodes and transmits 4-byte big-endian length-prefixed JSON packets to the
    raw TCP server listening on 127.0.0.1:9000, displaying header hex dumps and server responses.
#>

[CmdletBinding()]
param(
    [string]$Action = "PING",
    [string]$ClientId = "windows_client",
    [string]$TargetId = "operator_alpha",
    [string]$Payload = '{"task": "TEST_BURST", "units": 4}',
    [string]$HostAddress = "127.0.0.1",
    [int]$Port = 9000
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RootDir = Split-Path -Parent $ScriptDir
$PythonExe = "$RootDir\.venv\Scripts\python.exe"
$ClientPy = "$ScriptDir\test_tcp_client.py"

if (-not (Test-Path $PythonExe)) {
    Write-Error "Python executable not found at $PythonExe. Please run python -m venv .venv."
    exit 1
}

& $PythonExe $ClientPy $HostAddress $Port $Action $ClientId $TargetId $Payload
