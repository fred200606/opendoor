"""Start the whole OpenDoor stack locally: opens one terminal per service (5 in total).

    Business Registry (SOAP)  http://127.0.0.1:8003/soap?wsdl
    Core Service (Laravel)    http://127.0.0.1:8001
    Insights Service          http://127.0.0.1:8002
    API Gateway               http://127.0.0.1:8080
    React client (Vite)       http://localhost:5173

Standard library only, Windows. Setup (composer install, npm ci, .env files, migrate --seed) is
not done here - see "Local setup" in README.md. A service whose port is already in use is skipped,
so running the script twice does not start duplicates. Close a terminal (or Ctrl+C in it) to stop
that service.

    python start_opendoor.py               # 5 separate PowerShell windows, then open the browser
    python start_opendoor.py --tabs        # one Windows Terminal window with 5 tabs
    python start_opendoor.py --no-browser  # do not open http://localhost:5173
"""

import argparse
import shutil
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND_URL = "http://localhost:5173"

# (title, folder, command, port, files that must exist before it can start)
SERVICES = [
    ("Registry SOAP :8003", "services/business-registry-soap",
     "php -S 127.0.0.1:8003 -t public", 8003, [".env"]),
    ("Core API :8001", "services/core-api",
     "php artisan serve --port=8001", 8001, [".env", "vendor"]),
    ("Insights :8002", "services/insights-service",
     "npm.cmd run dev", 8002, [".env", "node_modules"]),
    ("Gateway :8080", "gateway",
     "npm.cmd run dev", 8080, [".env", "node_modules"]),
    ("Frontend :5173", "frontend",
     "npm.cmd run dev", 5173, [".env", "node_modules"]),
]

parser = argparse.ArgumentParser(description="Open one terminal per OpenDoor service.")
parser.add_argument("--tabs", action="store_true", help="use one Windows Terminal window with tabs")
parser.add_argument("--no-browser", action="store_true", help=f"do not open {FRONTEND_URL}")
parser.add_argument("--wait", type=float, default=60.0,
                    help="seconds to wait for all ports to answer (default 60, 0 = do not wait)")
args = parser.parse_args()


def port_open(port):
    """True if something listens on the port (IPv4 or IPv6: Vite may bind ::1 only)."""
    for host in ("127.0.0.1", "::1"):
        try:
            with socket.create_connection((host, port), timeout=0.3):
                return True
        except OSError:
            pass
    return False


def missing_files(folder, required):
    return [name for name in required if not (ROOT / folder / name).exists()]


if sys.platform != "win32":
    sys.exit("This launcher opens PowerShell windows and only runs on Windows.")

for tool in ("php", "node", "npm"):
    if shutil.which(tool) is None:
        sys.exit(f"'{tool}' is not on PATH - install it first (see README.md, Requirements).")

to_start = []
for title, folder, command, port, required in SERVICES:
    if port_open(port):
        print(f"  skip   {title:<20} port {port} already in use (already running?)")
        continue
    missing = missing_files(folder, required)
    if missing:
        print(f"  warn   {title:<20} missing {', '.join(missing)} in {folder} - see README.md, Local setup")
    to_start.append((title, folder, command, port))

if to_start and args.tabs and shutil.which("wt") is None:
    print("Windows Terminal (wt) not found - opening separate windows instead.")
    args.tabs = False

if args.tabs and to_start:
    # wt new-tab ... ; new-tab ... - each ";" must be its own argument
    wt_args = ["wt", "-w", "new"]
    for i, (title, folder, command, _) in enumerate(to_start):
        if i:
            wt_args.append(";")
        wt_args += ["new-tab", "--title", title, "--suppressApplicationTitle",
                    "-d", str(ROOT / folder), "powershell", "-NoExit", "-Command", command]
    subprocess.Popen(wt_args)
else:
    for title, folder, command, _ in to_start:
        subprocess.Popen(
            ["powershell", "-NoExit", "-Command", f"$Host.UI.RawUI.WindowTitle = '{title}'; {command}"],
            cwd=ROOT / folder,
            creationflags=subprocess.CREATE_NEW_CONSOLE,
        )
        time.sleep(0.3)  # keeps the windows in a stable order

for title, *_ in to_start:
    print(f"  start  {title}")

if not to_start:
    print("Nothing to start - all 5 services are already running.")
elif args.wait > 0:
    print(f"Waiting up to {args.wait:.0f} s for the services to answer...")
    pending = {port: title for title, _, _, port in to_start}
    deadline = time.monotonic() + args.wait
    while pending and time.monotonic() < deadline:
        for port in [p for p in pending if port_open(p)]:
            print(f"  up     {pending.pop(port)}")
        time.sleep(1)
    for title in pending.values():
        print(f"  DOWN   {title:<20} not answering yet - check its terminal for errors")

if not args.no_browser and port_open(5173):
    webbrowser.open(FRONTEND_URL)
