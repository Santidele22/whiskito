import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const LUCIDE_ESM = fileURLToPath(
  new URL("node_modules/lucide/dist/esm", import.meta.url)
);

function sharedLinkRoute() {
  // La ruta compartida: `/u/<40 dígitos hex>`, con barra final opcional y el
  // hex en cualquier caso (las direcciones se copian como vengan).
  const SHARED_LINK = /^\/u\/(0x[0-9a-fA-F]{40})\/?$/;

  const redirectSharedLink = () => (req, res, next) => {
    // `req.url` es ruta + query (no una URL absoluta): el base la completa.
    const url = new URL(req.url, "http://localhost");
    const match = url.pathname.match(SHARED_LINK);
    if (!match) return next();
    url.pathname = "/donate.html";
    // Se conservan los otros parámetros (`?chain=…`, `?rpc=…`: la app los usa
    // para apuntar a otra red o a otro nodo).
    url.searchParams.set("u", match[1]);
    res.writeHead(302, { Location: url.pathname + url.search });
    res.end();
  };

  return {
    name: "whiskito:shared-link-route",
    configureServer(server) {
      server.middlewares.use(redirectSharedLink());
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirectSharedLink());
    },
  };
}

function historyRoute() {
  // `/historial`, `/historial/` y `/historial/<40 hex>`, con barra final
  // opcional y el hex en cualquier caso.
  const HISTORY = /^\/historial(?:\/(0x[0-9a-fA-F]{40}))?\/?$/;

  /** Manda la ruta del historial a su página; el resto pasa igual. */
  const redirectHistory = () => (req, res, next) => {
    // `req.url` es ruta + query (no una URL absoluta): el base la completa.
    const url = new URL(req.url, "http://localhost");
    const match = url.pathname.match(HISTORY);
    if (!match) return next();
    url.pathname = "/historial.html";
    // La dirección de la ruta se conserva en el query (y si ya venía un `?u=`,
    // ese gana: es el parámetro explícito). Los otros parámetros (`?chain=…`,
    // `?rpc=…`) viajan igual: la app los usa para apuntar a otra red o a otro
    // nodo.
    if (match[1] && !url.searchParams.has("u")) {
      url.searchParams.set("u", match[1]);
    }
    res.writeHead(302, { Location: url.pathname + url.search });
    res.end();
  };

  return {
    name: "whiskito:history-route",
    // `server.middlewares.use(...)` DENTRO del hook es lo que corre antes de los
    // middlewares internos de Vite; devolver la función también los agregaría,
    // pero DESPUÉS, y para entonces el fallback de SPA ya habría contestado.
    configureServer(server) {
      server.middlewares.use(redirectHistory());
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirectHistory());
    },
  };
}

export default defineConfig({
  plugins: [sharedLinkRoute(), historyRoute()],
  root: "src",
  publicDir: false,
  appType: "spa",
  resolve: {
    alias: [
      { find: "https://esm.sh/viem", replacement: "viem" },
      { find: "https://esm.sh/qrcode@1.5.4", replacement: "qrcode" },
      { find: /^lucide\//, replacement: `${LUCIDE_ESM}/` },
    ],
  },
  optimizeDeps: {
    entries: ["index.html", "donate.html", "historial.html"],
  },
  server: {
    port: 5173,
    open: "/index.html",
  },
  preview: {
    port: 4173,
    open: "/index.html",
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        index: "index.html",
        donate: "donate.html",
        historial: "historial.html",
      },
    },
  },
});
