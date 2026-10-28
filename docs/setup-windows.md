# VGARSS — Windows Development Environment Setup Guide

This guide describes how to run and develop VGARSS on Windows 11 with PowerShell.

---

## 1. Prerequisites Check

Verify your Windows environment:
```powershell
# Check Node & npm
node -v   # Expected: v22.x
npm -v    # Expected: 11.x

# Check Python & pip
python --version   # Expected: Python 3.12.x
pip --version

# Check Git
git --version
```

---

## 2. Python Virtual Environment Setup

From the project root (`c:\Users\Welcome\OneDrive\Desktop\os cn project`):

```powershell
# Create virtual environment (.venv)
python -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Upgrade pip and install backend dependencies
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
```

---

## 3. Frontend Scaffolding & Dependencies

From the project root:

```powershell
cd frontend
npm install
cd ..
```

---

## 4. Running the Development Services

Open two PowerShell windows:

### Terminal 1: Backend & Simulation Kernel
```powershell
# From project root
.\.venv\Scripts\Activate.ps1
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be available at: `http://127.0.0.1:8000/docs`

### Terminal 2: Frontend UI
```powershell
cd frontend
npm run dev
```
UI will be available at: `http://localhost:5173`

---

## 5. Running Automated Tests

```powershell
.\.venv\Scripts\Activate.ps1
pytest tests/backend -v
```
