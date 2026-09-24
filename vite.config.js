import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * Vite acá es **servidor de desarrollo y build de producción**: la página se
 * sigue sirviendo como ES modules + importmap (README §5) y el `importmap` de
 * `src/index.html` queda intacto, pero `vite build` además empaqueta las tres
 * dependencias (`viem`, `lucide`, `qrcode`) dentro de `dist/` para que el bundle
 * no dependa de ningún CDN.
 *
 * El servidor de la verificación sigue siendo otro (`serve.py`, en 8899): ahí
 * viven `/__hold__` y `/__report__`, que el harness necesita. Vite no los tiene.
 */

/**
 * Ruta absoluta a la carpeta ESM de Lucide. Se ancla en `import.meta.url` (la
 * ubicación de ESTE archivo, o sea la raíz del repo) y no en `root`: `root` es
 * `src/`, así que una ruta relativa se resolvería contra `src/` y no existiría.
 */
const LUCIDE_ESM = fileURLToPath(
  new URL("node_modules/lucide/dist/esm", import.meta.url)
);

/**
 * Sirve la página de donación en la ruta que se comparte: `/u/<0x…>`.
 *
 * El link que se comparte (`SITE + "/u/" + dirección`) es el que abre el
 * donante, y esa página es OTRA que la landing: la tarjeta sola, centrada.
 *
 * **Redirige, no reescribe**, y no es un detalle: en dev Vite deja las rutas de
 * los assets del HTML **relativas** (`./js/entries/donate.js`, `styles.css`). Si la
 * página se sirviera *en* `/u/0x…`, el navegador pediría `/u/js/entries/donate.js` y el
 * fallback de SPA le devolvería el HTML con un 200: el módulo no carga, la
 * tarjeta nunca se registra y la página queda muerta sin un solo error visible.
 * Con el redirect el documento vive en `/donate.html`, donde las rutas
 * relativas resuelven bien. (En el build las rutas salen absolutas, así que en
 * producción un rewrite del host puede conservar la URL linda.)
 *
 * Va en dev y en preview porque el link compartido se prueba en los dos.
 */
function sharedLinkRoute() {
  // La ruta compartida: `/u/<40 dígitos hex>`, con barra final opcional y el
  // hex en cualquier caso (las direcciones se copian como vengan).
  const SHARED_LINK = /^\/u\/(0x[0-9a-fA-F]{40})\/?$/;

  /** Manda la ruta compartida a la página de donación; el resto pasa igual. */
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
    // `server.middlewares.use(...)` DENTRO del hook es lo que corre antes de los
    // middlewares internos de Vite; devolver la función también los agregaría,
    // pero DESPUÉS, y para entonces el fallback de SPA ya habría contestado.
    configureServer(server) {
      server.middlewares.use(redirectSharedLink());
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirectSharedLink());
    },
  };
}

/**
 * Sirve la página del historial en la ruta `/historial` (con o sin la dirección
 * atrás).
 *
 * Es el mismo caso que `sharedLinkRoute` —una página APARTE (`historial.html`)
 * servida en una ruta que no es la del archivo— y por eso usa el MISMO
 * mecanismo, con el mismo razonamiento: **redirige, no reescribe**. En dev Vite
 * deja las rutas de los assets del HTML relativas (`./js/entries/historial.js`,
 * `styles.css`), así que si la página se sirviera *en* `/historial` el navegador
 * pediría `/historial/js/entries/historial.js`, el fallback de SPA devolvería el HTML
 * con un 200 y la página quedaría muerta sin un solo error visible. Con el
 * redirect el documento vive en `/historial.html`, donde las rutas relativas
 * resuelven bien.
 *
 * La dirección puede venir en el query (`?u=0x…`, que es lo que conserva este
 * redirect) o en la ruta (`/historial/0x…`). En el segundo caso la ruta NO se
 * puede conservar —ahí no habría dónde resolver los assets relativos—, así que
 * la dirección se muda al query: `resolvePageOwner` entiende las dos formas y
 * con eso el flujo recibe la misma dirección por el camino de siempre.
 */
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
  // Ver `sharedLinkRoute` y `historyRoute`: las rutas compartidas/lindas tienen
  // que servir su propia página, no la landing.
  plugins: [sharedLinkRoute(), historyRoute()],
  // La raíz es `src/` (donde vive `index.html`), no el repo: así el build sale
  // como `dist/index.html` limpio, sin el prefijo `src/`, y `vite build` no
  // escanea los `.html` del andamiaje de verificación (`.refactor-baseline/`).
  root: "src",
  publicDir: false,
  // Cualquier ruta que no sea un archivo ni el link compartido sirve la landing, así una URL
  // "de más" no termina en 404 mientras se prueba. El link compartido **no** depende de esto:
  // lo maneja `sharedLinkRoute`, que corre antes y redirige. (`serve.py` no hace fallback a
  // propósito: el harness vive de los 404 para delatar rutas rotas.)
  appType: "spa",
  resolve: {
    // El `importmap` del HTML sólo lo entiende el navegador; Vite resuelve los
    // especificadores con resolución de Node, así que las URLs de CDN hay que
    // traducirlas a paquetes locales. Sin estos alias el build dejaría
    // `https://esm.sh/...` como import externo y `dist/` seguiría dependiendo
    // de la red.
    alias: [
      // La app importa `viem` desde esm.sh en chain.js, solidity-functions.js y
      // fund-abi.js. `viem` está en node_modules: el alias lo mete al grafo.
      { find: "https://esm.sh/viem", replacement: "viem" },
      // `whiskito-share-card.js` hace `await import("https://esm.sh/qrcode@1.5.4")`.
      { find: "https://esm.sh/qrcode@1.5.4", replacement: "qrcode" },
      // La app importa `lucide/icons/x.mjs` y `lucide/replaceElement.mjs`: son
      // especificadores que resuelve el importmap del navegador. Vite los
      // resuelve con resolución de Node, y el paquete `lucide` no publica
      // `exports` ni una carpeta `icons/` en su raíz (los archivos viven en
      // `dist/esm/`), así que sin este alias el módulo `src/js/dom/icons.js` no
      // carga ni en dev ni en build.
      { find: /^lucide\//, replacement: `${LUCIDE_ESM}/` },
    ],
  },
  optimizeDeps: {
    // Sin esto, el escaneo de dependencias mira TODOS los `.html` del repo
    // (incluidos los del andamiaje de verificación). Las tres páginas entran:
    // la de donación y la del historial también usan viem y lucide.
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
    // El destino es `../dist`, o sea la raíz del repo (fuera de `root`).
    outDir: "../dist",
    // Obligatorio: Vite no vacía un `outDir` que está fuera de `root` si no se
    // pide explícito. Sin esto, los assets de builds viejos se acumulan.
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      // Tres entradas: la landing, la página de donación (la que se comparte en
      // `/u/0x…`) y la del historial (`/historial`). Sin las otras dos, el build
      // no emitiría `dist/donate.html` ni `dist/historial.html` y esas rutas
      // caerían en la landing publicada.
      input: {
        index: "index.html",
        donate: "donate.html",
        historial: "historial.html",
      },
    },
  },
});
