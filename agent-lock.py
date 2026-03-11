"""
Centralized CLI for Agent-Lock - The Governance Layer for AI Agents.
Usage:
  python agent-lock.py install         Configure plugin in OpenClaw
  python agent-lock.py start           Launch the Governance Layer (Backend)
  python agent-lock.py setup-telegram  Assisted Telegram Setup
  python agent-lock.py policy add      Add a new mandatory human-approval rule
"""
import os
import sys
import json
import shutil
import subprocess

def install():
    print("🦞 Installing Agent-Lock Plugin...")
    plugin_src = os.path.join(os.getcwd(), "plugin", "agent-lock-plugin")
    
    # Check if inside project root
    if not os.path.exists(plugin_src):
        print("❌ Error: Run this from the agent-lock project root.")
        return

    # 1. Build plugin
    print("📦 Building TypeScript plugin...")
    subprocess.run(["npm", "run", "build"], cwd=plugin_src, shell=True)
    
    # 2. Find OpenClaw
    appdata = os.getenv("APPDATA")
    openclaw_path = os.path.join(appdata, "npm", "node_modules", "openclaw")
    
    if not os.path.exists(openclaw_path):
        print("❌ OpenClaw not found in standard npm directory.")
        return

    dest = os.path.join(openclaw_path, "plugins", "agent-lock")
    if not os.path.exists(dest):
        os.makedirs(dest, exist_ok=True)

    # 3. Copy files
    print("🚚 Injecting plugin into OpenClaw...")
    shutil.copytree(os.path.join(plugin_src, "dist"), os.path.join(dest, "dist"), dirs_exist_ok=True)
    shutil.copy(os.path.join(plugin_src, "plugin.json"), dest)
    shutil.copy(os.path.join(plugin_src, "package.json"), dest)
    
    print("✅ Installation complete! OpenClaw will now use Agent-Lock.")

def start():
    print("🚀 Starting Agent-Lock Backend...")
    backend_path = os.path.join(os.getcwd(), "backend")
    # Launch main.py using the venv python
    python_exe = os.path.join(backend_path, "venv", "Scripts", "python.exe")
    subprocess.run([python_exe, "main.py"], cwd=backend_path)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)
    
    cmd = sys.argv[1]
    if cmd == "install": install()
    elif cmd == "start": start()
    else: print(f"Unknown command: {cmd}")
