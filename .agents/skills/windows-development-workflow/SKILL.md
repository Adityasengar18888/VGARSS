---
name: windows-development-workflow
description: >-
  Use this skill when managing Windows PowerShell terminal sessions, Python virtual environments,
  Node.js scripts, process port management, and Git workflows on Windows 11 in VGARSS.
---

# Windows Development Workflow Skill for VGARSS

This skill provides best practices, command templates, and troubleshooting steps for Windows 11 PowerShell development in VGARSS.

## 1. PowerShell Conventions

1. **Avoid Command-Chaining Pitfalls**:
   - In PowerShell, prefer semicolon `;` or explicit multi-line script execution over bash-style `&&`.
   - Never nest `powershell -Command "..."` inside an existing PowerShell subshell to prevent variable expansion bugs (`$_` escaping).
2. **Path Handling**:
   - Use standard Windows backslashes `\` or forward slashes `/` consistently.
   - Quote paths containing spaces (e.g. `"c:\Users\Welcome\OneDrive\Desktop\os cn project"`).

## 2. Virtual Environment Management

1. **Activation**:
   ```powershell
   .\.venv\Scripts\Activate.ps1
   ```
2. **Direct Execution Alternative (without activating)**:
   ```powershell
   .\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
   .\.venv\Scripts\pytest.exe tests/backend -v
   ```

## 3. Port & Process Management

1. **Check if a Port is in Use**:
   ```powershell
   Get-NetTCPConnection -LocalPort 8000, 5173, 9000 -ErrorAction SilentlyContinue
   ```
2. **Stop a Stuck Background Process by Port**:
   ```powershell
   $conn = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
   if ($conn) { Stop-Process -Id $conn.OwningProcess -Force }
   ```

## 4. Git Hygiene on Windows

1. **Line Endings**:
   - Ensure `git config core.autocrlf true` (or `input`) to prevent CRLF vs LF merge conflicts.
2. **Branch Management**:
   - Work in dedicated topic branches: `git checkout -b feature/schedulers`.
