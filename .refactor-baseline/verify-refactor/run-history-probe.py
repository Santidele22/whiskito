#!/usr/bin/env python3
"""Driver de la sonda de la página del historial (`history-probe.html`).

Corre la sonda en Firefox headless y deja el veredicto crudo en la salida. La
sonda comprueba la página `/historial` de punta a punta: la ruta redirige (302)
a `/historial.html` conservando la dirección y la página NO queda servida bajo
`/historial/`; la isla `whiskito-history-table` monta con shadow root y dibuja;
una **donación real** aparece como fila (donante acortado, monto y USD); sin
explorador la columna de la transacción no se dibuja; `/historial` sin `?u=`
muestra el aviso Y el botón "Conectá tu wallet" (y con dirección ese botón no se
ve); y una lectura que falla se lee como error, nunca como "no recibiste nada".

Por qué se sirve así (medido, no supuesto):

  - la sonda se copia a `src/__history-probe.html` para ser del MISMO ORIGEN que
    la página: si no, no se le puede leer el DOM del iframe. Este runner la borra
    al terminar (criterio: `src/` no queda con archivos nuevos);
  - las PÁGINAS las sirve el dev server del repo (`vite.config.js`, root `src`),
    que es el único con la ruta `/historial`: el plugin `historyRoute` contesta
    302 → `/historial.html` (con la dirección de la ruta mudada a `?u=`). Un
    rewrite no serviría: en dev los assets del HTML son relativos y el navegador
    los pediría bajo `/historial/`, dejando la página muerta con un 200;
  - el REPORTE lo colecta `serve.py` (`/__hold__` y `/__report__`, HOLD), que es
    el servidor con `no-store` de siempre; la sonda es de otro origen, así que se
    lo manda cross-origin y el runner lo lee del log del servidor.

La chain la prepara ESTE driver, no la sonda: deriva la dirección dueña y el
contrato **importando `src/js/config/config.js`** (nada de direcciones a mano), lee el
oráculo y el historial REAL de esa dirección (para saber qué resumen exacto tiene
que mostrar la tabla), manda UNA donación real de 0,001 desde otra cuenta de
anvil (`cast send …, --unlocked`) y verifica el recibo. La sonda sólo lee.

Necesita **anvil en http://127.0.0.1:8545 (chainId 31337) con el deploy hecho y
el oráculo fresco** (con el oráculo viejo `fund()` revierte con `StalePrice` y no
hay donación que mostrar). No lo levanta, no lo baja y no deploya.

Uso:  python3 .refactor-baseline/verify-refactor/run-history-probe.py [puerto]
"""
import http.client
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request
from urllib.parse import quote, unquote

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.dirname(os.path.abspath(__file__))
BASELINE = os.path.join(ROOT, ".refactor-baseline")
PROBE_SRC = os.path.join(BASELINE, "history-probe.html")
PROBE_DST = os.path.join(ROOT, "src", "__history-probe.html")
VITE_BIN = os.path.join(ROOT, "node_modules", ".bin", "vite")

HOLD = 300          # el `__hold__` que retiene el `load` de la sonda
DEADLINE = 300.0    # lo que se espera el reporte (la sonda tarda ~1 min)

CHAIN_ID = 31337
# La donación real: 0,001 de la nativa (ETH en anvil). Con el oráculo en 2000e8
# son 2,00 USD, y es lo que la fila tiene que decir.
DONATION_WEI = 1000000000000000
FUNDED_SIG = "Funded(address,address,uint256,uint256)"

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


# ── La chain (sólo lectura + la donación que prepara el estado) ──────────────

def rpc(url, method, params):
    cuerpo = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    ).encode()
    req = urllib.request.Request(
        url, data=cuerpo, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        datos = json.load(r)
    if "error" in datos:
        raise RuntimeError(f"{method}: {datos['error']}")
    return datos["result"]


def config_de_la_app():
    """La config de la red local, IMPORTANDO `src/js/config/config.js`.

    Nada de direcciones a mano: `professional` (el dueño de anvil) y `fund` (el
    contrato) salen del módulo real, que es el mismo que usa la página.
    """
    codigo = (
        "import('./src/js/config/config.js').then((m) => {"
        f"const n = m.NETWORKS[{CHAIN_ID}];"
        "console.log(JSON.stringify({ fund: n.fund, professional: n.professional,"
        " rpc: n.rpc, priceFeed: n.priceFeed, explorer: n.explorer }));"
        "});"
    )
    out = subprocess.run(
        ["node", "--input-type=module", "-e", codigo], cwd=ROOT,
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        raise SystemExit("no se pudo importar src/js/config/config.js con node:\n" + out.stderr[-1500:])
    return json.loads(out.stdout.strip().splitlines()[-1])


def cast_bin():
    """`cast` (foundry) — el mismo binario con el que el repo dona y deploya."""
    found = shutil.which("cast")
    if found:
        return found
    local = os.path.expanduser("~/.foundry/bin/cast")
    if os.path.exists(local):
        return local
    raise SystemExit("no encuentro `cast` (foundry) en el PATH")


def topic0_funded():
    """El topic0 del evento `Funded` (derivado con `cast keccak`, no copiado)."""
    out = subprocess.run(
        [cast_bin(), "keccak", FUNDED_SIG], capture_output=True, text=True, check=True
    )
    return out.stdout.strip()


def logs_funded(rpc_url, fund, owner, tema0):
    """Los eventos `Funded` de ESA dirección, en orden: (ethWei, usdWei) por log."""
    padded = "0x" + "0" * 24 + owner[2:].lower()
    logs = rpc(rpc_url, "eth_getLogs", [{
        "fromBlock": "0x0",
        "toBlock": "latest",
        "address": fund,
        "topics": [tema0, None, padded],
    }])
    filas = []
    for log in logs:
        data = log["data"][2:]
        eth_wei = int(data[0:64], 16)
        usd_wei = int(data[64:128], 16)
        filas.append((eth_wei, usd_wei, log.get("transactionHash", "")))
    return filas


def latest_round(rpc_url, feed):
    """(answer, updatedAt) del feed: es lo que el contrato usa para valuar."""
    datos = rpc(rpc_url, "eth_call", [{"to": feed, "data": "0xfeaf968c"}, "latest"])
    palabras = [datos[2 + i * 64: 2 + (i + 1) * 64] for i in range(5)]
    answer = int(palabras[1], 16)
    if answer >= 2 ** 255:
        answer -= 2 ** 256
    return answer, int(palabras[3], 16)


def feed_decimals(rpc_url, feed):
    datos = rpc(rpc_url, "eth_call", [{"to": feed, "data": "0x313ce567"}, "latest"])
    return int(datos, 16)


# ── Los formateadores de la tabla, espejados (para el resumen EXACTO) ────────

def js_number(v):
    """`String(roundTo(v, 4))` de `formatEth` (hasta 4 decimales, sin ceros de cola)."""
    return ("%.4f" % v).rstrip("0").rstrip(".") or "0"


def fila_eth(wei):
    """`Number(formatEther(ethAmount))`: el monto crudo de la fila."""
    return wei / 10 ** 18


def fila_usd(wei_usd):
    """`Number(formatEther(usdValue)).toFixed(2)`: el USD YA redondeado de la fila."""
    return float("%.2f" % (wei_usd / 10 ** 18))


def ruta_cruda(puerto, path):
    """El status y el `Location` crudos de la ruta, sin que urllib los siga."""
    conn = http.client.HTTPConnection("127.0.0.1", puerto, timeout=5)
    try:
        conn.request("GET", path)
        r = conn.getresponse()
        status, location = r.status, r.getheader("Location")
        r.read()
        return status, location
    finally:
        conn.close()


PORT = free_port(int(sys.argv[1]) if len(sys.argv) > 1 else 8899)
VITE_PORT = free_port(5310)
serve_log = os.path.join(OUT, f"server-{PORT}.log")
vite_log = os.path.join(OUT, f"vite-{VITE_PORT}.log")
ff_log = os.path.join(OUT, f"firefox-{PORT}.log")

# ── 0) La config (importada) y el estado de la chain, ANTES de la donación ───

cfg = config_de_la_app()
RPC_URL = cfg["rpc"]
FUND = cfg["fund"]
OWNER = cfg["professional"]
FEED = cfg["priceFeed"]
print(f"config.js  →  chainId={CHAIN_ID} fund={FUND} professional={OWNER}")
print(f"              priceFeed={FEED} rpc={RPC_URL} explorer={cfg['explorer']!r}")

chain_id = int(rpc(RPC_URL, "eth_chainId", []), 16)
if chain_id != CHAIN_ID:
    raise SystemExit(f"anvil contesta chainId {chain_id}, no {CHAIN_ID}: no es la chain de esta sonda")

cuentas = rpc(RPC_URL, "eth_accounts", [])
if len(cuentas) < 2:
    raise SystemExit("anvil no tiene una segunda cuenta desbloqueada para donar")
DONOR = cuentas[1]
if DONOR.lower() == OWNER.lower():
    raise SystemExit("la cuenta que dona es la misma que la dueña: la fila no probaría nada")
print(f"donante    →  {DONOR} (cuenta 1 de anvil; la sonda lee, no firma)")

precio, actualizado = latest_round(RPC_URL, FEED)
decimales = feed_decimals(RPC_URL, FEED)
altura = int(rpc(RPC_URL, "eth_blockNumber", []), 16)
bloque_ts = int(rpc(RPC_URL, "eth_getBlockByNumber", [hex(altura), False])["timestamp"], 16)
edad = bloque_ts - actualizado
print(f"oráculo    →  answer={precio} (decimals={decimales}) updatedAt={actualizado} "
      f"bloque={altura} ts={bloque_ts} edad={edad}s (tope 10800s)")
if edad > 10800:
    print("  AVISO: el oráculo está VIEJO: `fund()` va a revertir con StalePrice.")
if precio <= 0:
    raise SystemExit("el oráculo no da un precio positivo")

tema0 = topic0_funded()
previos = logs_funded(RPC_URL, FUND, OWNER, tema0)
prev_count = len(previos)
prev_eth = sum(fila_eth(eth) for eth, _usd, _tx in previos)
prev_usd = sum(fila_usd(usd) for _eth, usd, _tx in previos)
print(f"historial  →  ANTES de donar: {prev_count} donación(es) a {OWNER} "
      f"(POL={prev_eth} USD={prev_usd})  [topic0={tema0}]")

# ── 1) La donación real, desde OTRA cuenta, antes de lanzar el navegador ─────

donacion_cmd = [
    cast_bin(), "send", FUND, "fund(address)", OWNER,
    "--value", str(DONATION_WEI),
    "--unlocked", "--from", DONOR,
    "--rpc-url", RPC_URL,
]
print("\n$ " + " ".join(donacion_cmd))
envio = subprocess.run(donacion_cmd, capture_output=True, text=True)
print(envio.stdout.strip() or envio.stderr.strip())
if envio.returncode != 0 or "1 (success)" not in envio.stdout:
    print("\nLA DONACIÓN FALLÓ: la tabla no puede tener filas y la sonda no probaría nada.")
    print("stderr:", envio.stderr.strip()[-1500:])
    sys.exit(3)
hash_donacion = (
    re.search(r"transactionHash\s+(0x[0-9a-fA-F]{64})", envio.stdout) or [None, "?"]
)[1]

posteriores = logs_funded(RPC_URL, FUND, OWNER, tema0)
if len(posteriores) != prev_count + 1:
    print(f"\nLA DONACIÓN NO DEJÓ EL EVENTO ESPERADO: {prev_count} → {len(posteriores)}")
    sys.exit(3)
eth_wei, usd_wei, tx_log = posteriores[-1]
if (eth_wei, usd_wei) != (
    DONATION_WEI,
    DONATION_WEI * precio * 10 ** (18 - decimales) // 10 ** 18,
):
    print(f"\nEL EVENTO DICE OTRA COSA: eth={eth_wei} usd={usd_wei} (esperado "
          f"{DONATION_WEI} / {DONATION_WEI * precio * 10 ** (18 - decimales) // 10 ** 18})")
    sys.exit(3)
print(f"DONACIÓN REAL →  {DONATION_WEI} wei ({DONATION_WEI / 1e18} nativa) desde {DONOR} "
      f"a {OWNER}: Funded(ethAmount={eth_wei}, usdValue={usd_wei}) tx={tx_log} "
      f"(esperada {hash_donacion})")

# Lo que la tabla tiene que decir, calculado con el historial REAL (si ya había
# donaciones —de una corrida anterior del harness—, el total no es el de una).
rondas = prev_count + 1
total_eth = round(round(prev_eth + fila_eth(eth_wei), 6), 4)   # sumEth → formatEth
total_usd = round(prev_usd + fila_usd(usd_wei), 2)             # sumUsd → formatUsd
EXP_ETH = js_number(total_eth)
EXP_USD = "%.2f" % total_usd
EXP_RONDAS = rondas
EXP_SUMMARY = f"{'1 ronda' if rondas == 1 else f'{rondas} rondas'} · {EXP_ETH} POL · ≈ ${EXP_USD} USD"
EXP_DONOR_SHORT = DONOR[:6] + "..." + DONOR[-4:]
# Lo que dice la FILA de esta donación (no el total: eso es el resumen).
ROW_ETH = js_number(fila_eth(eth_wei))
ROW_USD = "%.2f" % fila_usd(usd_wei)
print(f"la tabla tiene que decir → {rondas} fila(s), {EXP_DONOR_SHORT} · +"
      f"{ROW_ETH} POL · ≈ ${ROW_USD}; resumen „{EXP_SUMMARY}“")

# La sonda LEE: todo lo que tiene que afirmar viaja por query (la dirección que
# se le pide a la página, la cuenta que donó y lo esperado, derivado de la chain).
PROBE_URL = (
    f"http://127.0.0.1:{VITE_PORT}/__history-probe.html"
    f"?report=http://127.0.0.1:{PORT}"
    f"&u={OWNER}"
    f"&donor={DONOR}"
    f"&expRondas={EXP_RONDAS}"
    f"&expEth={EXP_ETH}"
    f"&expUsd={EXP_USD}"
    f"&rowEth={ROW_ETH}"
    f"&rowUsd={ROW_USD}"
    f"&expSummary={quote(EXP_SUMMARY)}"
)

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
    # 2) El colector del reporte: `serve.py`, el de siempre.
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

    # 3) Las páginas (con `/historial`): el dev server del repo, con su config real.
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
            with urllib.request.urlopen(f"http://127.0.0.1:{VITE_PORT}/", timeout=1):
                listo = True
                break
        except Exception:
            time.sleep(0.5)
    if not listo:
        print(f"EL DEV SERVER NO ARRANCÓ en {VITE_PORT} — log:")
        print(leer(vite_log)[-2000:])
        sys.exit(2)

    # Evidencia cruda de la ruta, sin el navegador de por medio: el 302 y su
    # Location. (La sonda lo afirma igual desde el `fetch`; esto lo muestra.)
    print("\nrutas que ve el dev server (crudo, sin seguir el redirect):")
    for path in (f"/historial?u={OWNER}", "/historial", f"/historial/{OWNER}"):
        try:
            status, location = ruta_cruda(VITE_PORT, path)
            print(f"  {status}  {path}  →  Location: {location}")
        except Exception as error:  # noqa: BLE001 — es evidencia, no una aserción
            print(f"  ???  {path}  →  {error}")

    print(f"\nsonda:   {PROBE_URL}")
    print(f"colector: http://127.0.0.1:{PORT} (serve.py, HOLD={HOLD}s)")

    # 4) La sonda, en Firefox headless. Sin `--screenshot`: acá el screenshot no
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
    # Y el `.parentlock` que deja Firefox al morir por SIGTERM no se queda acá:
    # `run-harness.py` NO lo borra, así que dejarlo es dejarle una trampa al
    # próximo run (arranca y no pide ni la primera URL → `NO REPORT RECEIVED`
    # con `HTTP requests seen: 0`, que parece un fallo de la app y no lo es).
    if os.path.exists(lock):
        os.remove(lock)

text = leer(serve_log)
statuses = STATUS_RE.findall(text)
bad = [(p, c) for p, c in statuses if not c.startswith("2") and not c.startswith("3")]

print("=" * 72)
print("HISTORY PROBE REPORT (/historial: ruta, montaje, datos reales, sin explorador,")
print("sin dirección y error de lectura):")
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
