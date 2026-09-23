#!/usr/bin/env python3
"""Driver de la sonda de la página de donación (`donate-probe.html`).

Corre la sonda en Firefox headless y deja el veredicto crudo en la salida. La
sonda comprueba la página que se comparte (`/u/0x…`) con una **wallet EIP-1193
falsa** inyectada en el iframe: los bloques D/E/M/P/Q/F de siempre (la ruta
abre la card, la card dice a quién le donás, la donación termina en `success`,
el modal abre/cierra por las tres vías, el dueño no se dona a sí mismo, cancelar
no es fallar y sin destinatario no se dona a cualquiera) más el bloque **S**
(cambiar de cuenta: el selector, `accountsChanged`, cancelar, wallet sin
`wallet_requestPermissions` y el navbar de la landing).

Por qué se sirve así (medido, no supuesto):

  - la sonda se copia a `src/__donate-probe.html` para ser del MISMO ORIGEN que
    la página: si no, no se le puede leer el DOM del iframe. Este runner la
    borra al terminar (criterio: `src/` no queda con archivos nuevos);
  - las PÁGINAS las sirve el dev server del repo (`vite.config.js`, root `src`),
    que es el único que tiene la ruta `/u/0x…`: el plugin `sharedLinkRoute`
    contesta 302 → `/donate.html?u=…`, y `/` es la landing. `serve.py` **no
    puede** servir esta sonda: mide 404 en `/u/0x…` y un listado de directorio
    en `/`. Usar el plugin real (y no un atajo) es el punto de D1: la trampa que
    la sonda caza es la página servida BAJO `/u/` con assets relativos, que baja
    muerta aunque el status sea 200;
  - el REPORTE lo colecta `serve.py` en 8899 (`/__hold__` y `/__report__`), que
    es el servidor con `no-store`, `/__hold__` y `/__report__` de siempre. La
    sonda es de otro origen, así que se lo manda cross-origin y el runner lo lee
    del log del servidor (mismo mecanismo que `run-harness.py`).

Necesita **anvil en http://127.0.0.1:8545 (chainId 31337) con el deploy hecho y
el oráculo fresco** (la card lee el precio de la chain; si está viejo, cae al
precio de ejemplo y las aserciones de monto siguen valiendo, pero el control
del harness no).

Uso:  python3 .refactor-baseline/verify-refactor/run-donate-probe.py [puerto]
"""
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
from urllib.parse import unquote
from urllib.request import urlopen

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.dirname(os.path.abspath(__file__))
BASELINE = os.path.join(ROOT, ".refactor-baseline")
PROBE_SRC = os.path.join(BASELINE, "donate-probe.html")
PROBE_DST = os.path.join(ROOT, "src", "__donate-probe.html")
VITE_BIN = os.path.join(ROOT, "node_modules", ".bin", "vite")

HOLD = 300          # el `__hold__` que retiene el `load` de la sonda
DEADLINE = 300.0    # lo que se espera el reporte (la sonda tarda ~1 min)

# El reporte se lee del log de `serve.py`: `"GET /__report__?d=… HTTP/1.1" 200`.
REPORT_RE = re.compile(r'"(?:GET|POST) (/__report__\S*) HTTP/1\.[01]" (\d{3})')
STATUS_RE = re.compile(r'"(?:GET|POST) ([^"]*?) HTTP/1\.[01]" (\d{3})')


def free_port(preferred):
    """Un puerto ocupado (p. ej. un serve.py o un Vite de otra sesión) hace morir
    al servidor en el bind: sin esto Firefox no tiene a quién pedirle nada y el
    run sale `NO REPORT RECEIVED`, que parece un fallo de la app y no lo es."""
    for p in [preferred] + list(range(preferred + 1, preferred + 40)):
        s = socket.socket()
        try:
            s.bind(("127.0.0.1", p))
            s.close()
            return p
        except OSError:
            s.close()
    raise SystemExit("no hay ningún puerto libre cerca de %d" % preferred)


def parar(proc):
    """SIGTERM a todo el grupo (Vite y Firefox dejan hijos) y después SIGKILL."""
    if proc is None or proc.poll() is not None:
        return
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    except OSError:
        proc.terminate()
    try:
        proc.wait(timeout=8)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except OSError:
            proc.kill()


def leer(path):
    if not os.path.exists(path):
        return ""
    return open(path, "rb").read().decode("utf-8", "replace")


PORT = free_port(int(sys.argv[1]) if len(sys.argv) > 1 else 8899)
VITE_PORT = free_port(5290)
serve_log = os.path.join(OUT, f"server-{PORT}.log")
vite_log = os.path.join(OUT, f"vite-{VITE_PORT}.log")
ff_log = os.path.join(OUT, f"firefox-{PORT}.log")
PROBE_URL = f"http://127.0.0.1:{VITE_PORT}/__donate-probe.html?report=http://127.0.0.1:{PORT}"

# Firefox deja `.parentlock` cuando muere por SIGTERM y con él no pide ni la
# primera URL (ver AGENTS.md §4).
os.makedirs(os.path.join(BASELINE, ".ff"), exist_ok=True)
lock = os.path.join(BASELINE, ".ff", ".parentlock")
if os.path.exists(lock):
    os.remove(lock)

# La copia a `src/` (mismo origen que la página). Este runner la BORRA al final.
shutil.copyfile(PROBE_SRC, PROBE_DST)

server = vite = firefox = None
ff_out = None
report = None
try:
    # 1) El colector del reporte: `serve.py`, el de siempre.
    server = subprocess.Popen(
        ["python3", ".refactor-baseline/serve.py", ROOT, str(PORT), str(HOLD)],
        cwd=ROOT, stdout=open(serve_log, "wb"), stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    time.sleep(1.0)
    if server.poll() is not None:
        print(f"EL COLECTOR (serve.py) NO ARRANCÓ en {PORT} — log:")
        print(leer(serve_log)[-2000:])
        sys.exit(2)

    # 2) Las páginas (con `/u/0x…`): el dev server del repo, con su config real.
    vite_cmd = [VITE_BIN] if os.path.exists(VITE_BIN) else ["bunx", "--bun", "vite"]
    vite = subprocess.Popen(
        vite_cmd + ["--port", str(VITE_PORT), "--strictPort", "--host", "127.0.0.1"],
        cwd=ROOT, stdout=open(vite_log, "wb"), stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    listo = False
    for _ in range(60):
        if vite.poll() is not None:
            break
        try:
            with urlopen(f"http://127.0.0.1:{VITE_PORT}/", timeout=1):
                listo = True
                break
        except Exception:
            time.sleep(0.5)
    if not listo:
        print(f"EL DEV SERVER NO ARRANCÓ en {VITE_PORT} — log:")
        print(leer(vite_log)[-2000:])
        sys.exit(2)

    print(f"sonda:  {PROBE_URL}")
    print(f"colector: http://127.0.0.1:{PORT} (serve.py, HOLD={HOLD}s)")

    # 3) La sonda, en Firefox headless. Sin `--screenshot`: acá el screenshot no
    #    escribe el PNG y el lanzador vuelve al instante (AGENTS.md §4).
    ff_out = open(ff_log, "wb")
    firefox = subprocess.Popen(
        [
            "firefox", "--headless", "--no-remote",
            "--profile", os.path.join(BASELINE, ".ff"),
            "--window-size=1440,900",
            PROBE_URL,
        ],
        stdout=ff_out, stderr=subprocess.STDOUT, start_new_session=True,
    )

    start = time.time()
    while time.time() - start < DEADLINE:
        text = leer(serve_log)
        for path, _code in REPORT_RE.findall(text):
            if "d=" in path:
                q = unquote(path.split("d=", 1)[-1])
                if q and not q.startswith("undefined"):
                    report = q
        if report:
            break
        if firefox.poll() is not None:
            break
        time.sleep(1.0)
finally:
    parar(firefox)
    parar(vite)
    parar(server)
    if ff_out is not None:
        ff_out.close()
    # Criterio: `src/` no puede quedar con archivos nuevos.
    if os.path.exists(PROBE_DST):
        os.remove(PROBE_DST)

text = leer(serve_log)
statuses = STATUS_RE.findall(text)
bad = [(p, c) for p, c in statuses if not c.startswith("2") and not c.startswith("3")]

print("=" * 72)
print("DONATE PROBE REPORT (/u/0x… + bloque S de cambio de cuenta):")
print((report or "NO REPORT RECEIVED")[:20000])
print("=" * 72)

print(f"\nPedidos que vio serve.py (sólo el reporte y el hold): {len(statuses)}; "
      f"no-2xx/3xx: {len(bad)}")
for p, c in bad:
    print(f"  {c}  {p}")

fflog = leer(ff_log)
hits = [l for l in fflog.splitlines() if re.search(r"(Error|error|failed|Failed|refus)", l)]
print("\nFirefox output lines mentioning Error/failed/refused:")
for l in hits[:15]:
    print("  " + l.strip())
if not hits:
    print("  (none)")

verdict = bool(report) and "FALLOS" not in report and "ERROR" not in report and not bad
if not verdict:
    print("\nlog del dev server (últimas líneas):")
    print(leer(vite_log)[-1500:])
print("\nVERDICT:", "PASS" if verdict else "FAIL")
sys.exit(0 if verdict else 1)
