#!/usr/bin/env python3
"""Servidor de verificación: sirve el workspace y permite retener el evento load.

- /__hold__    espera HOLD segundos y devuelve un GIF 1x1 (mantiene viva la página
               hasta que el harness terminó de medir).
- /__report__* responde 200 vacío; su querystring queda en el log de stderr.
- POST /__upload__?name=X guarda el cuerpo en .refactor-baseline/X.png, para poder
  decodificar con `zbarimg` un QR renderizado en el navegador.

Sin `Cache-Control: no-store` Firefox reusa copias viejas de index.html/styles.css
y las comparaciones se hacen contra el archivo anterior: verificación vacua.
"""
import functools
import http.server
import os
import re
import socketserver
import sys
import time
from urllib.parse import parse_qs, urlparse

ROOT = sys.argv[1]
PORT = int(sys.argv[2])
HOLD = float(sys.argv[3]) if len(sys.argv) > 3 else 8.0
HERE = os.path.dirname(os.path.abspath(__file__))
GIF = bytes.fromhex("47494638396101000100800000ffffff00000021f90401000000002c00000000010001000002024401003b")


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):  # noqa: N802
        path = urlparse(self.path).path
        if path == "/__hold__":
            time.sleep(HOLD)
            self.send_response(200)
            self.send_header("Content-Type", "image/gif")
            self.send_header("Content-Length", str(len(GIF)))
            self.end_headers()
            self.wfile.write(GIF)
            return
        if path == "/__report__":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"ok")
            return
        return super().do_GET()

    def do_POST(self):  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path != "/__upload__":
            self.send_error(404)
            return
        name = (parse_qs(parsed.query).get("name") or ["upload"])[0]
        name = re.sub(r"[^A-Za-z0-9_-]", "", name) or "upload"
        data = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        with open(os.path.join(HERE, name + ".png"), "wb") as fh:
            fh.write(data)
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))
        sys.stderr.flush()


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True


with Server(("127.0.0.1", PORT), functools.partial(Handler, directory=ROOT)) as httpd:
    httpd.serve_forever()
