#!/usr/bin/env python3
"""Independent end-to-end driver for the Whiskito module refactor.

Serves the repo root with the project's own no-store server, opens the existing
196-assertion harness (.refactor-baseline/islands.html) in headless Firefox, and
reports: the harness verdict, every HTTP status the browser saw (a 404 is the
signal for a broken module path), which expected modules were actually fetched,
and any module-load error Firefox printed.

Usage: python3 run-harness.py [port]
"""
import os
import re
import signal
import socket
import subprocess
import sys
import time
from urllib.parse import unquote

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.dirname(os.path.abspath(__file__))


def free_port(preferred):
    """Un puerto ocupado (p. ej. un serve.py de otra sesión) hace morir a
    serve.py en el bind: sin esto Firefox no tiene a quién pedirle nada y el
    harness reporta 0 requests, que parece un fallo de la app y no lo es."""
    for p in [preferred] + list(range(preferred + 1, preferred + 25)):
        s = socket.socket()
        try:
            s.bind(("127.0.0.1", p))
            s.close()
            return p
        except OSError:
            s.close()
    raise SystemExit("no hay ningún puerto libre cerca de %d" % preferred)


PORT = free_port(int(sys.argv[1]) if len(sys.argv) > 1 else 8897)
HOLD = 120
DEADLINE = 150.0

os.makedirs(os.path.join(ROOT, ".refactor-baseline", ".ff"), exist_ok=True)
log_path = os.path.join(OUT, f"server-{PORT}.log")
ff_log_path = os.path.join(OUT, f"firefox-{PORT}.log")

server = subprocess.Popen(
    ["python3", ".refactor-baseline/serve.py", ROOT, str(PORT), str(HOLD)],
    cwd=ROOT,
    stdout=open(log_path, "wb"),
    stderr=subprocess.STDOUT,
)
time.sleep(1.2)
if server.poll() is not None:
    print("EL SERVIDOR NO ARRANCÓ (puerto %d) — log:" % PORT)
    print(open(log_path, "rb").read().decode("utf-8", "replace")[-2000:])
    sys.exit(2)
print("sirviendo en http://127.0.0.1:%d (HOLD=%ds)" % (PORT, HOLD))

ff_out = open(ff_log_path, "wb")
firefox = subprocess.Popen(
    [
        "firefox", "--headless", "--no-remote",
        "--profile", os.path.join(ROOT, ".refactor-baseline", ".ff"),
        "--screenshot", os.path.join(OUT, f"islands-{PORT}.png"),
        "--window-size=1440,900",
        f"http://127.0.0.1:{PORT}/.refactor-baseline/islands.html",
    ],
    stdout=ff_out,
    stderr=subprocess.STDOUT,
)

report = None
start = time.time()
while time.time() - start < DEADLINE:
    if os.path.exists(log_path):
        text = open(log_path, "rb").read().decode("utf-8", "replace")
        for path, _code in re.findall(r'"(?:GET|POST) (\S+) HTTP/1\.[01]" (\d{3})', text):
            if path.startswith("/__report__") and "d=" in path:
                q = unquote(path.split("d=", 1)[-1])
                if q and not q.startswith("undefined"):
                    report = q
        if report:
            break
    if firefox.poll() is not None:
        break
    time.sleep(1.0)

time.sleep(0.6)
for p in (firefox, server):
    if p.poll() is None:
        p.send_signal(signal.SIGTERM)
        try:
            p.wait(timeout=8)
        except subprocess.TimeoutExpired:
            p.kill()
ff_out.close()

text = open(log_path, "rb").read().decode("utf-8", "replace")
statuses = re.findall(r'"(?:GET|POST) (\S+) HTTP/1\.[01]" (\d{3})', text)

head, _, tail = (report or "NO REPORT RECEIVED").partition(" ;; ")
print("=" * 72)
print("HARNESS REPORT (islands.html):")
print(head[:1500])
print(tail[:5000])
print("=" * 72)

bad = [(p, c) for p, c in statuses if not c.startswith("2") and not c.startswith("3")]
print(f"\nHTTP requests seen: {len(statuses)}; non-2xx/3xx: {len(bad)}")
for p, c in bad:
    print(f"  {c}  {p}")

expected = [
    "/src/js/main.js", "/src/js/app.js", "/src/js/islands.js",
    "/src/js/config.js", "/src/js/constants.js", "/src/js/fund-abi.js",
    "/src/js/chain.js", "/src/js/solidity-functions.js", "/src/js/tx.js", "/src/js/format.js",
    "/src/js/viewer-role.js", "/src/js/icons.js", "/src/components/index.js",
    # El modo demo, la isla de "Mi Panel" y su lectura de la chain: la página
    # tiene que bajar los tres. (El ledger local de la demo ya no existe.)
    "/src/js/demo-mode.js",
    "/src/components/whiskito-dashboard.js",
]
seen_paths = {p.split("?")[0] for p, _ in statuses}
print("\nExpected modules fetched by the page:")
missing = []
for e in expected:
    ok = e in seen_paths
    if not ok:
        missing.append(e)
    print(f"  {'fetched    ' if ok else 'NOT FETCHED'}  {e}")

fflog = open(ff_log_path, "rb").read().decode("utf-8", "replace")
print("\nFirefox output lines mentioning Error/failed/refused:")
hits = [l for l in fflog.splitlines() if re.search(r"(Error|error|failed|Failed|refus)", l)]
for l in hits[:25]:
    print("  " + l.strip())
if not hits:
    print("  (none)")

verdict = (
    bool(report)
    and "FALLOS" not in report
    and "ERROR" not in report
    and not bad
    and not missing
)
print("\nVERDICT:", "PASS" if verdict else "FAIL")
sys.exit(0 if verdict else 1)
