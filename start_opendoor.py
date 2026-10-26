"""Start the whole OpenDoor stack locally inside the current (VS Code) terminal.

All 5 services run as child processes of this script; every output line is prefixed with the
service name, and the links below are printed at the start and again once the ports answer
(Ctrl+click opens them in VS Code). Ctrl+C stops all 5.

    Registry SOAP  http://127.0.0.1:8003/soap?wsdl
    Core API       http://127.0.0.1:8001
    Insights       http://127.0.0.1:8002
    Gateway        http://127.0.0.1:8080
    Frontend       http://localhost:5173

Standard library only, Windows. Setup (composer install, npm ci, .env files, migrate --seed) is
not done here - see "Local setup" in README.md. A service whose port is already in use is skipped,
so running the script twice does not start duplicates.

    python start_opendoor.py               # start, then open the frontend in the browser
    python start_opendoor.py --no-browser  # do not open the browser
"""

import argparse
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# (name, folder, command, port, link, files that must exist before it can start, ANSI colour)
SERVICES = [
    ("registry", "services/business-registry-soap", ["php", "-S", "127.0.0.1:8003", "-t", "public"],
     8003, "http://127.0.0.1:8003/soap?wsdl", [".env"], "35"),
    ("core", "services/core-api", ["php", "artisan", "serve", "--port=8001"],
     8001, "http://127.0.0.1:8001", [".env", "vendor"], "31"),
    ("insights", "services/insights-service", ["npm.cmd", "run", "dev"],
     8002, "http://127.0.0.1:8002", [".env", "node_modules"], "33"),
    ("gateway", "gateway", ["npm.cmd", "run", "dev"],
     8080, "http://127.0.0.1:8080", [".env", "node_modules"], "36"),
    ("frontend", "frontend", ["npm.cmd", "run", "dev"],
     5173, "http://localhost:5173", [".env", "node_modules"], "32"),
]
FRONTEND_URL = "http://localhost:5173"
WIDTH = max(len(name) for name, *_ in SERVICES)

parser = argparse.ArgumentParser(description="Run the 5 OpenDoor services in this terminal.")
parser.add_argument("--no-browser", action="store_true", help=f"do not open {FRONTEND_URL}")
parser.add_argument("--wait", type=float, default=60.0,
                    help="seconds to wait for all ports to answer (default 60)")
args = parser.parse_args()

print_lock = threading.Lock()


def say(text=""):
    with print_lock:
        print(text, flush=True)


def tag(name, colour):
    return f"\033[{colour}m[{name:<{WIDTH}}]\033[0m"


def port_open(port):
    """True if something listens on the port (IPv4 or IPv6: Vite may bind ::1 only)."""
    for host in ("127.0.0.1", "::1"):
        try:
            with socket.create_connection((host, port), timeout=0.3):
                return True
        except OSError:
            pass
    return False


def print_links(title, up):
    """Print the link table in one block, so service output cannot land in the middle of it."""
    lines = [f"\n\033[1m{title}\033[0m"]
    for name, _, _, port, link, _, colour in SERVICES:
        state = "\033[32mup\033[0m  " if port in up else "\033[31mdown\033[0m"
        lines.append(f"  {tag(name, colour)} {state} {link}")
    say("\n".join(lines) + "\n")


def pump(name, colour, process):
    """Copy a service's output to this terminal, line by line, with its prefix."""
    for line in process.stdout:
        say(f"{tag(name, colour)} {line.rstrip()}")
    say(f"{tag(name, colour)} \033[31mstopped (exit code {process.wait()})\033[0m")


def stop(process):
    """Kill the whole process tree (npm.cmd -> cmd -> node, artisan serve -> php -S)."""
    if process.poll() is None:
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(process.pid)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if sys.platform != "win32":
    sys.exit("This launcher only runs on Windows.")
os.system("")  # turns on ANSI colours in older Windows consoles

for tool in ("php", "node", "npm"):
    if shutil.which(tool) is None:
        sys.exit(f"'{tool}' is not on PATH - install it first (see README.md, Requirements).")

env = dict(os.environ, FORCE_COLOR="1")  # keep Vite/Node colours although output is piped
env.pop("NO_COLOR", None)  # Node warns when both are set
running = []
up = set()  # ports known to answer; each is probed until it is up, then not again (log noise)
for name, folder, command, port, link, required, colour in SERVICES:
    if port_open(port):
        up.add(port)
        say(f"{tag(name, colour)} port {port} already in use - skipped (already running?)")
        continue
    missing = [f for f in required if not (ROOT / folder / f).exists()]
    if missing:
        say(f"{tag(name, colour)} \033[33mmissing {', '.join(missing)} in {folder}"
            " - see README.md, Local setup\033[0m")
    process = subprocess.Popen(
        command, cwd=ROOT / folder, env=env,
        stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding="utf-8", errors="replace", bufsize=1,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,  # Ctrl+C is handled here, not by them
    )
    threading.Thread(target=pump, args=(name, colour, process), daemon=True).start()
    running.append((port, process))

if not running:
    print_links("Nothing to start - all 5 services are already running:", up)
    sys.exit(0)

print_links("OpenDoor is starting (Ctrl+C stops all):", up)

try:
    deadline = time.monotonic() + args.wait
    while time.monotonic() < deadline and len(up) < len(SERVICES):
        time.sleep(1)
        up.update(port for port, _ in running if port not in up and port_open(port))
    print_links("OpenDoor services (Ctrl+click a link to open it, Ctrl+C stops all):", up)
    if not args.no_browser and 5173 in up:
        webbrowser.open(FRONTEND_URL)
    while any(process.poll() is None for _, process in running):
        time.sleep(0.5)
except KeyboardInterrupt:
    say("\nStopping all services...")
finally:
    for _, process in running:
        stop(process)
