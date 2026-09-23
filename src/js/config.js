/**
 * Configuración de Whiskito.
 * Acá vive SÓLO lo que es configuración:
 *   1. por red → dónde está el contrato y por dónde se le habla. Esto no se
 *      puede derivar: es un hecho del deploy, distinto en anvil, en Sepolia y
 *      en mainnet. Lo que sí es dinámico es *cuál* de estas entradas se usa:
 *      se elige con la cadena en la que está la wallet, en runtime.
 *   2. de la app → valores de marca que comparten varios archivos.
 */

export const NETWORKS = {
  31337: {
    name: "anvil",
    // Direcciones del deploy local: salen de src/script/deploy.sol.
    // Las verifica .refactor-baseline/check-config.mjs contra el broadcast.
    fund: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
    priceFeed: "0x5fbdb2315678afecb367f032d93f642f64180aa3",
    rpc: "http://127.0.0.1:8545",
    explorer: null,
  },

  11155111: {
    name: "amoy",
    fund: "",
    priceFeed: "",
    rpc: "https://polygon-amoy.drpc.org",
    explorer: "https://sepolia.etherscan.io",
  },

  // Cuando deployes en una testnet, agregá su entrada (y ahí sí usá el
  // aggregator real de Chainlink, no el mock del script local):
  // 11155111: {
  //   name: "sepolia",
  //   fund: "0x…",
  //   priceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  //   rpc: "https://ethereum-sepolia-rpc.publicnode.com",
  //   explorer: "https://sepolia.etherscan.io",
  // },
};

/** Red que se asume mientras la wallet no dijo en cuál está. */
export const DEFAULT_CHAIN_ID = 31337;

/**
 * A quién le donan en esta landing. En el producto real sale de la URL
 * (`/u/0x…`); para el deploy local es la cuenta 0 de anvil, que es la que
 * despliega el contrato.
 */
export const PROFESSIONAL = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

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
