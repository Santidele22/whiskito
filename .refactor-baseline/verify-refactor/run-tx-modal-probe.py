#!/usr/bin/env python3
"""Sonda del modal de transacción (`whiskito-tx-modal`) — driver del orquestador.

Corre `tx-modal-probe.html` (35 comprobaciones) en Firefox headless y deja el
veredicto en `.refactor-baseline/tx-modal-report.txt`.

Requisitos:
  1. Un dev server de la app sirviendo `/donate.html` y `/u/0x…` en 5211, con un
     endpoint `/__report__`. Se levanta con la config de la sonda:

        ~/.bun/bin/bunx --bun vite --config .refactor-baseline/vite.tx-modal-probe.config.js --host 127.0.0.1

     (esa config tiene el redirect de `/u/0x…` y el `POST /__report__` que
     escribe el veredicto; el Vite del usuario, en 5173, no se toca).

  2. La sonda copiada a `src/` para ser del mismo origen que la página:

        cp .refactor-baseline/tx-modal-probe.html src/__tx-modal-probe.html

     (este driver la copia sola si falta, y NO la borra: la sonda queda para
     volver a correrla.)

Uso:  python3 .refactor-baseline/verify-refactor/run-tx-modal-probe.py [segundos]
"""
import os
import shutil
import signal
import subprocess
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
BASELINE = os.path.join(ROOT, ".refactor-baseline")
PROBE_SRC = os.path.join(BASELINE, "tx-modal-probe.html")
PROBE = os.path.join(ROOT, "src", "__tx-modal-probe.html")
REPORT = os.path.join(BASELINE, "tx-modal-report.txt")
LOG = os.path.join(BASELINE, "tx-modal-firefox.log")
URL = "http://127.0.0.1:5211/__tx-modal-probe.html"
DEADLINE = float(sys.argv[1]) if len(sys.argv) > 1 else 90.0

if not os.path.exists(PROBE):
    shutil.copyfile(PROBE_SRC, PROBE)
if os.path.exists(REPORT):
    os.remove(REPORT)
# Firefox deja `.parentlock` cuando muere por SIGTERM y con él no pide ni la
# primera URL (ver AGENTS.md §4).
lock = os.path.join(BASELINE, ".ff", ".parentlock")
if os.path.exists(lock):
    os.remove(lock)

with open(LOG, "wb") as ff_out:
    firefox = subprocess.Popen(
        [
            "firefox",
            "--headless",
            "--no-remote",
            "--profile",
            os.path.join(BASELINE, ".ff"),
            "--window-size=1440,900",
            URL,
        ],
        stdout=ff_out,
        stderr=subprocess.STDOUT,
    )

    report = None
    start = time.time()
    while time.time() - start < DEADLINE:
        if os.path.exists(REPORT):
            text = open(REPORT, "rb").read().decode("utf-8", "replace")
            if " || " in text or text.startswith("ERROR"):
                report = text
                break
        if firefox.poll() is not None:
            break
        time.sleep(0.5)

    time.sleep(0.5)
    if firefox.poll() is None:
        firefox.send_signal(signal.SIGTERM)
        try:
            firefox.wait(timeout=8)
        except subprocess.TimeoutExpired:
            firefox.kill()

print("=" * 72)
if report:
    head, _, tail = report.partition(" || ")
    print(head)
    for item in tail.split(" | "):
        print("  " + item)
else:
    print("NO REPORT RECEIVED")
    print("últimas líneas del log de Firefox:")
    print(open(LOG, "rb").read().decode("utf-8", "replace")[-1500:])
print("=" * 72)
