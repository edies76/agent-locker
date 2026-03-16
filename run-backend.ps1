# Agent-Lock Backend Launcher
# This script targets the backend specifically.

$BackendPath = Join-Path $PSScriptRoot "backend"

Write-Host "🦞 Starting Agent-Lock Backend..." -ForegroundColor Cyan

if (!(Test-Path "$BackendPath\venv")) {
    Write-Host "⚠️ Virtual environment not found in $BackendPath\venv" -ForegroundColor Red
    Write-Host "Please run install-plugin.ps1 first or create the venv manually."
    Pause
    exit
}

Set-Location $BackendPath
& ".\venv\Scripts\python.exe" main.py
