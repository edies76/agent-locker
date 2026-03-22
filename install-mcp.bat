@echo off
echo Instalando dependencias MCP en el venv de Agent-Lock...
echo.

call "%~dp0venv\Scripts\activate.bat"

pip install "mcp>=1.0.0" httpx

echo.
echo Listo! Ahora reinicia Claude Desktop.
pause
