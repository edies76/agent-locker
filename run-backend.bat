@echo off
TITLE Agent-Lock Backend
echo 🦞 Starting Agent-Lock Backend...
powershell -ExecutionPolicy Bypass -File "%~dp0run-backend.ps1"
pause
