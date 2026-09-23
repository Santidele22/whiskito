#!/usr/bin/env python3
"""Driver de verificación del camino de escritura contra la chain REAL.

Sirve el repo con el mismo servidor no-store que usa run-harness.py, abre
`.refactor-baseline/verify-refactor/tx-revert.html` en Firefox headless y reporta:

  - el veredicto de la página (A1 recibo revertido detectado, A2 sin falso
    positivo, A3 la simulación frena antes de firmar, A5 qué hace anvil);
  - los status HTTP que vio el navegador (un 404 delata un import roto);
  - la evidencia CRUDA pedida: `cast receipt <hash> --json` para el hash de la
    transacción revertida (y para la exitosa, como contraste).

No toca el anvil del 8545: sólo le habla por HTTP.

Usage: python3 run-tx-revert.py [puerto]
"""
import json
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
RPC = "http://127.0.0.1:8545"
CAST = os.path.expanduser("~/.foundry/bin/cast")


def free_port(preferred):
    for p in [preferred] + list(range(preferred + 1, preferred + 25)):
        s = socket.socket()
        try:
            s.bind(("127.0.0.1", p))
            s.close()
            return p
        except OSError:
            s.close()
    raise SystemExit("no hay ningún puerto libre cerca de %d" % preferred)


PORT = free_port(int(sys.argv[1]) if len(sys.argv) > 1 else 8911)
PAGE = sys.argv[2] if len(sys.argv) > 2 else "/.refactor-baseline/verify-refactor/tx-revert.html"
HOLD = 60
DEADLINE = 180.0

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

# El perfil queda con un `.parentlock` de 0 bytes cuando el navegador muere por
# SIGTERM (es lo que hace run-harness.py), y con ese archivo el arranque de
# Firefox se cuelga: no pide ni la primera URL. Un lock viejo no protege nada
# (no hay ningún proceso usándolo), así que se limpia antes de arrancar.
for lock in (".parentlock", "lock"):
    try:
        os.remove(os.path.join(ROOT, ".refactor-baseline", ".ff", lock))
    except FileNotFoundError:
        pass

ff_out = open(ff_log_path, "wb")
firefox = subprocess.Popen(
    [
        "firefox", "--headless", "--no-remote",
        "--profile", os.path.join(ROOT, ".refactor-baseline", ".ff"),
        "--screenshot", os.path.join(OUT, f"tx-revert-{PORT}.png"),
        "--window-size=1000,700",
        f"http://127.0.0.1:{PORT}{PAGE}",
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
    # Ojo: `firefox` bifurca y el lanzador puede volver enseguida; el navegador
    # de verdad sigue vivo. Si se cortara acá, la corrida quedaría sin veredicto.
    time.sleep(1.0)

time.sleep(0.6)
for p in (firefox, server):
    if p.poll() is None:
        p.send_signal(signal.SIGTERM)
        try:
            p.wait(timeout=8)
        except subprocess.TimeoutExpired:
            p.kill()
# El lanzador puede haber vuelto dejando el navegador vivo: se lo nombra exacto
# (`-x`) para no matar por accidente al shell que contiene "firefox" en su línea.
subprocess.run(["pkill", "-x", "firefox"], capture_output=True)
ff_out.close()

text = open(log_path, "rb").read().decode("utf-8", "replace")
statuses = re.findall(r'"(?:GET|POST) (\S+) HTTP/1\.[01]" (\d{3})', text)
bad = [(p, c) for p, c in statuses if not c.startswith("2") and not c.startswith("3")]

print("=" * 72)
print("REPORTE DE LA PÁGINA (tx-revert.html):")
print(report or "NO REPORT RECEIVED")
print("=" * 72)

print(f"\nHTTP requests seen: {len(statuses)}; non-2xx/3xx: {len(bad)}")
for p, c in bad:
    print(f"  {c}  {p}")

# Evidencia cruda obligatoria: el recibo tal cual lo devuelve la chain.
if report:
    for etiqueta in ("HASH_REVERTIDA", "HASH_OK", "HASH_A5"):
        m = re.search(rf"^{etiqueta}=(0x[0-9a-fA-F]{{64}})$", report, re.M)
        if not m:
            print(f"\n{etiqueta}: (la página no reportó hash)")
            continue
        h = m.group(1)
        print(f"\n$ cast receipt {h} --rpc-url {RPC}   [{etiqueta}]")
        r = subprocess.run([CAST, "receipt", h, "--json", "--rpc-url", RPC],
                           capture_output=True, text=True)
        if r.returncode != 0:
            print("  (cast receipt falló) " + (r.stderr or r.stdout).strip()[:400])
            continue
        try:
            d = json.loads(r.stdout)
            print("  " + json.dumps({k: d.get(k) for k in
                  ("status", "blockNumber", "gasUsed", "transactionHash", "from", "to")
                  if k in d}, ensure_ascii=False))
        except json.JSONDecodeError:
            print("  " + r.stdout.strip()[:400])

fflog = open(ff_log_path, "rb").read().decode("utf-8", "replace")
print("\nFirefox output lines mentioning Error/failed/refused:")
hits = [l for l in fflog.splitlines() if re.search(r"(Error|error|failed|Failed|refus)", l)]
for l in hits[:15]:
    print("  " + l.strip())
if not hits:
    print("  (none)")

verdict = bool(report) and report.startswith("RESULTADO: PASS") and not bad
print("\nVERDICT:", "PASS" if verdict else "FAIL")
sys.exit(0 if verdict else 1)
