"""
Centralized CLI for Agent-Lock - The Governance Layer for AI Agents.

Usage examples:
    python agent-lock.py install
    python agent-lock.py start
    python agent-lock.py connect --channel agentlock_dashboard
"""
import os
import sys
import json
import shutil
import subprocess
import argparse
import urllib.request
import urllib.error

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


def _post_json(url: str, payload: dict) -> dict:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        msg = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {e.code} while calling {url}: {msg}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Could not reach backend URL {url}: {e}")


def connect(channel: str, backend_url: str, label: str):
    print("🔗 Agent-Lock Connect (OpenClaw)")
    backend_url = backend_url.rstrip("/")
    pairing_url = f"{backend_url}/dashboard/plugin/pairings"

    print(f"   Backend: {backend_url}")
    print(f"   Channel: {channel}")
    print("\n[1/3] Requesting pairing token...")

    response = _post_json(
        pairing_url,
        {
            "label": label,
            "preferred_channel": channel,
        },
    )

    token = response.get("pairing", {}).get("token")
    if not token:
        raise RuntimeError("Backend did not return pairing token.")

    print("[2/3] Writing OpenClaw Agent-Lock config...")
    user_home = os.path.expanduser("~")
    config_dir = os.path.join(user_home, ".openclaw", "extensions", "agent-lock")
    os.makedirs(config_dir, exist_ok=True)
    config_path = os.path.join(config_dir, "agent-lock.config.json")

    config = {
        "dashboard_bridge_token": token,
        "preferred_channel": channel,
        "available_channels": ["agentlock_dashboard", "whatsapp", "telegram"],
        "client_label": "openclaw",
    }
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

    print(f"   ✅ Config saved: {config_path}")

    print("[3/3] Done.")
    print("\nNext steps:")
    print("  1) Restart OpenClaw gateway: openclaw gateway")
    print("  2) Open dashboard Plugin page to verify connection.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Agent-Lock CLI")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("install", help="Configure plugin in OpenClaw")
    sub.add_parser("start", help="Launch local Agent-Lock backend")

    p_connect = sub.add_parser("connect", help="Cloud-first OpenClaw pairing")
    p_connect.add_argument(
        "--channel",
        choices=["agentlock_dashboard", "whatsapp", "telegram"],
        default="agentlock_dashboard",
        help="Preferred control channel",
    )
    p_connect.add_argument(
        "--backend-url",
        default=os.environ.get("AGENT_LOCK_BACKEND_URL", "https://agent-lock-backend-api-7.azurewebsites.net"),
        help="Agent-Lock backend URL (cloud by default)",
    )
    p_connect.add_argument(
        "--label",
        default="OpenClaw",
        help="Pairing label",
    )

    return parser

if __name__ == "__main__":
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    if args.command == "install":
        install()
    elif args.command == "start":
        start()
    elif args.command == "connect":
        connect(args.channel, args.backend_url, args.label)
    else:
        parser.print_help()
