/**
 * Config TEMPORAL para correr la sonda del modal en un dev server propio
 * (5199), sin tocar `vite.config.js` ni el Vite del usuario (5173).
 *
 * Es la misma app (`root: "src"`), con dos middlewares de la sonda:
 *   - `/u/<0x…>` → redirect a `/donate.html?u=…` (igual que el plugin real);
 *   - `/__report__` (POST) → deja el veredicto en `.refactor-baseline/`.
 *
 * Se borra al terminar la tarea.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
// El mismo alias que `vite.config.js`: `lucide/icons/x.mjs` sólo lo resuelve el
// importmap del navegador, así que dev necesita el alias o los iconos no cargan.
const LUCIDE_ESM = path.join(ROOT, "..", "node_modules", "lucide", "dist", "esm");
const REPORT = path.join(ROOT, "tx-modal-report.txt");
const REQUEST_LOG = path.join(ROOT, "tx-modal-requests.log");
const SHARED_LINK = /^\/u\/(0x[0-9a-fA-F]{40})\/?$/;

function sharedLinkRoute() {
  return {
    name: "temp:shared-link-route",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        const match = url.pathname.match(SHARED_LINK);
        if (!match) return next();
        url.pathname = "/donate.html";
        url.searchParams.set("u", match[1]);
        res.writeHead(302, { Location: url.pathname + url.search });
        res.end();
      });
    },
  };
}

function reportRoute() {
  return {
    name: "temp:report",
    configureServer(server) {
      // Log de cada pedido: es lo que dice si Firefox llegó a pedir la sonda.
      server.middlewares.use((req, res, next) => {
        if (!req.url.startsWith("/__report__")) {
          fs.appendFileSync(REQUEST_LOG, req.method + " " + req.url + "\n");
          return next();
        }
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          fs.writeFileSync(REPORT, Buffer.concat(chunks));
          res.writeHead(200, { "content-type": "text/plain" });
          res.end("ok");
        });
      });
    },
  };
}

export default {
  plugins: [sharedLinkRoute(), reportRoute()],
  root: "src",
  publicDir: false,
  appType: "spa",
  resolve: {
    alias: [{ find: /^lucide\//, replacement: `${LUCIDE_ESM}/` }],
  },
  server: { port: 5211, strictPort: true },
};
