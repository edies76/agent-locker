# Entry point for running as module: python -m mcp_server [setup]
import sys


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "setup":
        from .setup_wizard import run_setup
        run_setup()
    else:
        from .server import main as _run
        _run()


if __name__ == "__main__":
    main()
