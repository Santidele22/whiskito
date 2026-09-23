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
 * los assets del HTML **relativas** (`./js/donate.js`, `styles.css`). Si la
 * página se sirviera *en* `/u/0x…`, el navegador pediría `/u/js/donate.js` y el
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

export default defineConfig({
  // Ver `sharedLinkRoute`: la ruta compartida tiene que servir la página de
  // donación, no la landing.
  plugins: [sharedLinkRoute()],
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
      // `dist/esm/`), así que sin este alias el módulo `src/js/icons.js` no
      // carga ni en dev ni en build.
      { find: /^lucide\//, replacement: `${LUCIDE_ESM}/` },
    ],
  },
  optimizeDeps: {
    // Sin esto, el escaneo de dependencias mira TODOS los `.html` del repo
    // (incluidos los del andamiaje de verificación). Las dos páginas entran: la
    // de donación también usa viem y lucide.
    entries: ["index.html", "donate.html"],
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
      // Dos entradas: la landing y la página de donación (la que se comparte en
      // `/u/0x…`). Sin la segunda, el build no emitiría `dist/donate.html` y el
      // link compartido caería en la landing publicada.
      input: {
        index: "index.html",
        donate: "donate.html",
      },
    },
  },
});
