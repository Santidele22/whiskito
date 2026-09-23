/**
 * Configuración de Whiskito.
 * Acá vive SÓLO lo que es configuración:
 *   1. por red → dónde está el contrato y por dónde se le habla. Esto no se
 *      puede derivar: es un hecho del deploy, distinto en anvil (31337), en
 *      Polygon Amoy (80002) y en mainnet. Lo que sí es dinámico es *cuál* de
 *      estas entradas se usa: se elige con la cadena en la que está la wallet,
 *      en runtime.
 *   2. de la app → valores de marca que comparten varios archivos.
 */

export const NETWORKS = {
  31337: {
    name: "anvil",
    fund: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
    deployBlock: 0,
    priceFeed: "0x5fbdb2315678afecb367f032d93f642f64180aa3",
    rpc: "http://127.0.0.1:8545",
    explorer: null,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    professional: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  },

  80002: {
    name: "amoy",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    fund: "0xc92b0cAB9Bd6247250d483613B804593c7f3fEF8",
    deployBlock: 48371056,
    priceFeed: "0xF0d50568e3A7e8259E16663972b11910F89BD8e7",
    rpc: "https://polygon-amoy-bor-rpc.publicnode.com",
    explorer: "https://amoy.polygonscan.com",
    professional: "0x74ffced34e75fb4b31f18889fa2a4de66be34523",
  },

  // Ejemplo FUTURO, no confundir con Amoy: ésta es Ethereum Sepolia, otra red y
  // otro explorer (chainId 11155111). Hoy está comentada, no se usa.
  // 11155111: {
  //   name: "sepolia",
  //   fund: "0x…",
  //   // Primer bloque del contrato (mismo campo que las otras redes): 0 es un
  //   // PLACEHOLDER, no el bloque real; se completa cuando haya deploy.
  //   deployBlock: 0,
  //   priceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  //   rpc: "https://ethereum-sepolia-rpc.publicnode.com",
  //   explorer: "https://sepolia.etherscan.io",
  //   nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  //   // Ejemplo local: la misma cuenta 0 de anvil (ver `professionalFor`).
  //   professional: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  // },
};

/** chainId de anvil: la red del desarrollo local. */
const LOCAL_CHAIN_ID = 31337;
/** chainId de Polygon Amoy: la red de la publicación. */
const PUBLISHED_CHAIN_ID = 80002;

/**
 * ¿Este hostname es un entorno local?
 *
 * La lista de redes privadas es **deliberada**: el QR de desarrollo abre el
 * servidor local desde el celular por la IP de LAN (192.168.x.x, 10.x.x.x,
 * 172.16–31.x.x), y esa visita tiene que seguir apuntando a anvil, igual que
 * `localhost`. Un `?chain=` en la URL la puede forzar a otra cosa.
 */
function isLocalHostname(hostname) {
  // `[::1]` es cómo el navegador escribe el loopback IPv6.
  const host = String(hostname)
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  if (
    host === "" ||
    host === "localhost" ||
    host === "::1" ||
    host === "0.0.0.0"
  ) {
    return true;
  }
  if (host.endsWith(".local") || host.endsWith(".localhost")) return true;
  if (
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.")
  ) {
    return true;
  }
  // 172.16.0.0 – 172.31.255.255 (el resto de 172/8 es público).
  return /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

/**
 * Red que se asume mientras la wallet no dijo en cuál está.
 *
 * Depende del origen porque la app se publica en Vercel apuntando a Amoy, pero
 * en desarrollo el servidor es local y ahí la red es anvil:
 *   - local (sin `location`, `file://`, `localhost`, loopback, red privada o
 *     `.local`) → 31337;
 *   - cualquier otro origen (`whiskito.vercel.app`, una IP pública) → 80002.
 * El override `?chain=` de `urlConfig()` sigue ganando siempre.
 */
function defaultChainId() {
  const hostname = globalThis.location?.hostname;
  if (hostname === undefined) return LOCAL_CHAIN_ID; // scripts de Node
  return isLocalHostname(hostname) ? LOCAL_CHAIN_ID : PUBLISHED_CHAIN_ID;
}

export const DEFAULT_CHAIN_ID = defaultChainId();

/**
 * A quién le donan en la red `chainId`: el destinatario por defecto cuando la
 * página no trae dueño propio (el link `/u/0x…` sigue mandando sobre esto).
 *
 * Es un hecho POR RED, no una constante global, porque el destinatario depende
 * de dónde está desplegado el contrato:
 *   - anvil (31337): la cuenta 0, la que despliega el contrato local y con la que
 *     el harness se comporta como dueño;
 *   - Polygon Amoy (80002), donde se publica el sitio: la cuenta del deployer.
 *
 * Con una sola constante, alguna de las dos se rompe: o el deploy local deja de
 * juntar en la cuenta que el harness puede retirar, o el sitio publicado junta
 * las donaciones en una cuenta que nadie del proyecto puede retirar.
 *
 * Si la red no está en `NETWORKS` cae al `professional` de `DEFAULT_CHAIN_ID` en
 * vez de lanzar: se consulta dentro del flujo de donación, y un throw ahí
 * rompería el botón.
 */
export function professionalFor(chainId = DEFAULT_CHAIN_ID) {
  const network = NETWORKS[Number(chainId)] ?? NETWORKS[DEFAULT_CHAIN_ID];
  return network.professional;
}

/** El dominio real de la app: con éste se comparte cuando no hay origen ni override. */
const CANONICAL_SITE = "https://whiskito.app";

/**
 * Base de los links que se comparten (el QR y las redes sociales).
 *
 * Por defecto es **el origen que está sirviendo esta página**: en dev apunta a
 * tu servidor local (`http://localhost:5173`), así el link que compartís abre la
 * app que estás mirando y el QR se puede probar **en local** sin publicar nada;
 * en producción es el dominio real. Un dominio fijo hacía que el QR de dev
 * mandara a whiskito.app, donde no hay nada que probar.
 *
 * `?site=https://…` lo fuerza (por ejemplo, para compartir links de producción
 * desde el dev); fuera del navegador —los scripts de verificación importan este
 * módulo con Node— cae al dominio canónico.
 */
export const SITE = (() => {
  const override = new URLSearchParams(globalThis.location?.search ?? "").get(
    "site"
  );
  if (override) return override.replace(/\/+$/, "");
  const origin = globalThis.location?.origin;
  // `file://` deja el origen en la cadena "null", que no es una base válida.
  return origin && origin !== "null" ? origin : CANONICAL_SITE;
})();

/**
 * La configuración declarada de una red.
 * Tira error si no existe: mejor un mensaje claro que un `undefined` lejos.
 */
export function networkConfig(chainId) {
  const network = NETWORKS[Number(chainId)];
  if (!network) {
    throw new Error(
      `No hay configuración para la red ${chainId}. Agregala en src/js/config.js (NETWORKS).`
    );
  }
  return { ...network, chainId: Number(chainId) };
}

/**
 * Permite apuntar la app a otro nodo o a otro deploy sin tocar este archivo:
 *
 *   index.html?chain=31337&rpc=http://127.0.0.1:8545&fund=0x…
 *
 * Sirve para probar contra otra red, para una demo, y para verificar qué pasa
 * cuando el nodo no responde (apuntando a un RPC inválido).
 * Devuelve null si no hay ningún override en la URL.
 */
export function urlConfig(search = globalThis.location?.search ?? "") {
  const params = new URLSearchParams(search);
  const chain = params.get("chain");
  const rpc = params.get("rpc");
  const fund = params.get("fund");
  if (!chain && !rpc && !fund) return null;
  const chainId = Number(chain) || DEFAULT_CHAIN_ID;
  const base = NETWORKS[chainId] ?? NETWORKS[DEFAULT_CHAIN_ID];
  return {
    ...base,
    chainId,
    ...(rpc ? { rpc } : {}),
    ...(fund ? { fund } : {}),
  };
}

/** La configuración efectiva: el override de la URL si lo hay, si no la red. */
export function effectiveNetwork(chainId = DEFAULT_CHAIN_ID) {
  return urlConfig() ?? networkConfig(chainId);
}
