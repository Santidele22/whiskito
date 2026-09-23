export const NETWORKS = {
  //Local
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
  //testnet
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
};

/** chainId de anvil: la red del desarrollo local. */
const LOCAL_CHAIN_ID = 31337;
/** chainId de Polygon Amoy: la red de la publicación. */
const PUBLISHED_CHAIN_ID = 80002;

function isLocalHostname(hostname) {
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

function defaultChainId() {
  const hostname = globalThis.location?.hostname;
  if (hostname === undefined) return LOCAL_CHAIN_ID; // scripts de Node
  return isLocalHostname(hostname) ? LOCAL_CHAIN_ID : PUBLISHED_CHAIN_ID;
}

export const DEFAULT_CHAIN_ID = defaultChainId();

export function professionalFor(chainId = DEFAULT_CHAIN_ID) {
  const network = NETWORKS[Number(chainId)] ?? NETWORKS[DEFAULT_CHAIN_ID];
  return network.professional;
}

const CANONICAL_SITE = "https://whiskito.vercel.app";

export const SITE = (() => {
  const override = new URLSearchParams(globalThis.location?.search ?? "").get(
    "site"
  );
  if (override) return override.replace(/\/+$/, "");
  const origin = globalThis.location?.origin;
  // `file://` deja el origen en la cadena "null", que no es una base válida.
  return origin && origin !== "null" ? origin : CANONICAL_SITE;
})();

export function networkConfig(chainId) {
  const network = NETWORKS[Number(chainId)];
  if (!network) {
    throw new Error(
      `No hay configuración para la red ${chainId}. Agregala en src/js/config.js (NETWORKS).`
    );
  }
  return { ...network, chainId: Number(chainId) };
}

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
